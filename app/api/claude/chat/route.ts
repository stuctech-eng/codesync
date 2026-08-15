import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { PROJECTS } from "@/lib/projects"
import { runClaudeTurn } from "@/lib/claude"
import {
  createConversation,
  getConversation,
  getMessages,
  appendMessage,
  listConversations
} from "@/lib/conversations"
import type Anthropic from "@anthropic-ai/sdk"

// Vercel-functieduur. Bronnen over Hobby's exacte limiet lopen uiteen
// (10s tot 300s, afhankelijk van wanneer/waar je het opzoekt) — daarom
// hier bewust op de strengste, veiligste waarde gezet. Bij een upgrade
// naar Pro kan dit samen met MAX_TOTAL_MS in lib/claude.ts ruimer.
export const maxDuration = 10

export async function POST(req: NextRequest) {
  const requestStart = Date.now()
  const authError = requireAuth(req)
  if (authError) return authError

  let body: { projectSlug?: string; message?: string; conversationId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { projectSlug, message } = body
  let conversationId = body.conversationId

  if (!projectSlug || !message || typeof message !== "string" || !message.trim()) {
    return NextResponse.json({ error: "projectSlug and message are required" }, { status: 400 })
  }

  const project = PROJECTS.find(p => p.slug === projectSlug)
  if (!project) {
    return NextResponse.json({ error: `Project "${projectSlug}" not found` }, { status: 404 })
  }

  // Project-scope wordt hier, server-side, aan de conversatie gekoppeld —
  // Claude kan dit later in het gesprek niet meer wijzigen (Master Plan
  // v1.1, sectie 4/6: projectcontext wordt server-side gekoppeld, nooit
  // vertrouwd als los, door Claude aan te leveren argument).
  //
  // Snelheidsoptimalisatie (Master Plan v1.3 — timing-onderzoek wees uit
  // dat auth+Firestore-setup 1,6s kostte): bij een bestaand gesprek
  // gebeurde getConversation() (validatie) en getMessages() (geschiedenis)
  // voorheen na elkaar. Ze zijn onafhankelijk van elkaar — parallel
  // uitvoeren scheelt een volledige netwerk-round-trip. Bij een nieuw
  // gesprek wordt getMessages() helemaal overgeslagen — die was toch
  // altijd leeg voor een net aangemaakte conversatie.
  let storedMessages: Awaited<ReturnType<typeof getMessages>> = []

  if (conversationId) {
    const [conv, msgs] = await Promise.all([
      getConversation(conversationId),
      getMessages(conversationId)
    ])
    if (!conv || conv.projectSlug !== projectSlug) {
      return NextResponse.json(
        { error: "Conversation not found for this project" },
        { status: 404 }
      )
    }
    storedMessages = msgs
  } else {
    conversationId = await createConversation(projectSlug)
  }

  // Geschiedenis reconstrueren uit opgeslagen berichten. Bewust alleen
  // tekst-turns — geen oude tool_results worden gereplayed (die zijn niet
  // permanent opgeslagen, zie lib/conversations.ts). Claude kan bestanden
  // desgewenst opnieuw opvragen als dat voor een vervolgvraag nodig is.
  const history: Anthropic.MessageParam[] = storedMessages.map(m => ({
    role: m.role,
    content: m.content
  }))

  // Welke bestanden zijn dit gesprek al bekeken? Dit voorkomt dat Claude
  // bij elke vervolgvraag onnodig dezelfde bestanden opnieuw opvraagt —
  // dat kostte extra tool-rondes en duwde de functie over Vercel's
  // 10s-timeout heen (bevestigd in productie via een echte timeout-fout).
  const alreadySeenPaths = Array.from(new Set(
    storedMessages
      .flatMap(m => m.toolActivity ?? [])
      .filter(a => a.tool === "get_file_contents")
      .flatMap(a => (a.input.paths as string[]) ?? [])
  ))

  const structureAlreadyFetched = storedMessages.some(m =>
    (m.toolActivity ?? []).some(a => a.tool === "get_project_structure")
  )

  await appendMessage(conversationId, {
    role: "user",
    content: message,
    createdAt: new Date().toISOString()
  }, { isFirstMessage: storedMessages.length === 0 })

  // Extra nadruk op de huidige vraag, alléén voor de API-call — niet
  // opgeslagen in Firestore (daar blijft het originele bericht schoon).
  // Dit is dezelfde aanpak die in een handmatige test bevestigd bleek te
  // werken: expliciete nadruk IN het bericht zelf, niet alleen als losse
  // systeeminstructie.
  const emphasizedMessage = `${message}\n\n[Beantwoord uitsluitend deze vraag. Ga niet in op eerder besproken onderwerpen, ook niet als inleiding.]`
  history.push({ role: "user", content: emphasizedMessage })

  // Diagnostische timing (tijdelijk, Master Plan v1.3): tijd tot hier is
  // auth + Firestore (conversatie laden/opslaan) — vóórdat runClaudeTurn
  // (Anthropic + GitHub-tools) ook maar begint.
  const firestoreSetupMs = Date.now() - requestStart
  console.log(`[timing] auth+Firestore-setup: ${firestoreSetupMs}ms`)

  const encoder = new TextEncoder()
  const finalConversationId = conversationId

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: string, data: unknown) {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }

      send("conversationId", { conversationId: finalConversationId })

      try {
        const { finalText, toolActivity, timingMs } = await runClaudeTurn(
          project,
          history,
          alreadySeenPaths,
          structureAlreadyFetched,
          (chunk) => send("text", { chunk }),
          (activity) => send("tool", activity)
        )

        const totalMs = Date.now() - requestStart
        console.log(`[timing] TOTAAL: ${totalMs}ms — uitsplitsing: auth+Firestore-setup=${firestoreSetupMs}ms, Anthropic=${timingMs.anthropic}ms, GitHub-tools=${timingMs.tools}ms, rondes=${timingMs.rounds}, opslaan-erna=${totalMs - firestoreSetupMs - timingMs.anthropic - timingMs.tools}ms`)

        // 'done' eerst sturen — de gebruiker heeft de volledige tekst al
        // ontvangen op dit punt. De Firestore-opslag hierna is voor
        // persistence en hoeft het "klaar"-signaal niet op te houden; als
        // de functie precies hierna wordt afgekapt door de Vercel-
        // tijdslimiet, heeft de gebruiker toch terecht een compleet
        // antwoord gezien (voorheen kon dit een onterechte "niet
        // afgerond"-melding geven bij een verder prima antwoord).
        send("done", {})

        await appendMessage(finalConversationId, {
          role: "assistant",
          content: finalText,
          createdAt: new Date().toISOString(),
          ...(toolActivity.length > 0 ? { toolActivity } : {})
        })
      } catch (error) {
        send("error", { message: String(error) })
      } finally {
        controller.close()
      }
    }
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive"
    }
  })
}

// GET met ?conversationId=X → geschiedenis van dat gesprek
// GET met ?projectSlug=X    → lijst van gesprekken voor dat project
export async function GET(req: NextRequest) {
  const authError = requireAuth(req)
  if (authError) return authError

  const conversationId = req.nextUrl.searchParams.get("conversationId")
  const projectSlug = req.nextUrl.searchParams.get("projectSlug")

  if (conversationId) {
    const conv = await getConversation(conversationId)
    if (!conv) return NextResponse.json({ error: "Not found" }, { status: 404 })
    const messages = await getMessages(conversationId)
    return NextResponse.json({ conversation: conv, messages })
  }

  if (projectSlug) {
    const conversations = await listConversations(projectSlug)
    return NextResponse.json({ conversations })
  }

  return NextResponse.json({ error: "projectSlug or conversationId is required" }, { status: 400 })
}
