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

// Vercel Pro-functie-duur — nodig voor het tijdsbudget van de tool-loop
// (max. 45s) plus marge. Op een Hobby-plan (10s-limiet) zal een gesprek
// met tool-gebruik hier niet altijd binnen passen; bevestig het actuele
// Vercel-plan vóór productiegebruik (Master Plan v1.1, sectie 6).
export const maxDuration = 60

export async function POST(req: NextRequest) {
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
  if (conversationId) {
    const conv = await getConversation(conversationId)
    if (!conv || conv.projectSlug !== projectSlug) {
      return NextResponse.json(
        { error: "Conversation not found for this project" },
        { status: 404 }
      )
    }
  } else {
    conversationId = await createConversation(projectSlug)
  }

  const storedMessages = await getMessages(conversationId)

  // Geschiedenis reconstrueren uit opgeslagen berichten. Bewust alleen
  // tekst-turns — geen oude tool_results worden gereplayed (die zijn niet
  // permanent opgeslagen, zie lib/conversations.ts). Claude kan bestanden
  // desgewenst opnieuw opvragen als dat voor een vervolgvraag nodig is.
  const history: Anthropic.MessageParam[] = storedMessages.map(m => ({
    role: m.role,
    content: m.content
  }))

  await appendMessage(conversationId, {
    role: "user",
    content: message,
    createdAt: new Date().toISOString()
  })

  history.push({ role: "user", content: message })

  const encoder = new TextEncoder()
  const finalConversationId = conversationId

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: string, data: unknown) {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }

      send("conversationId", { conversationId: finalConversationId })

      try {
        const { finalText, toolActivity } = await runClaudeTurn(
          project,
          history,
          (chunk) => send("text", { chunk }),
          (activity) => send("tool", activity)
        )

        await appendMessage(finalConversationId, {
          role: "assistant",
          content: finalText,
          toolActivity: toolActivity.length > 0 ? toolActivity : undefined,
          createdAt: new Date().toISOString()
        })

        send("done", {})
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
