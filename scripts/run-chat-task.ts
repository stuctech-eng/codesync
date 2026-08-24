// Wordt uitgevoerd door GitHub Actions (.github/workflows/claude-chat-task.yml),
// NIET door Vercel. Geen tijdslimiet van 10-60s hier — dit proces mag
// gewoon zo lang duren als de Claude-tool-loop nodig heeft.
//
// Hergebruikt lib/claude.ts en lib/claude-tools.ts VOLLEDIG ongewijzigd —
// die functies deden altijd al alleen externe API-calls (Anthropic,
// GitHub), nooit iets dat aan de Vercel-runtime gebonden is.

import { runClaudeTurn } from "../lib/claude"
import { PROJECTS } from "../lib/projects"
import { getTask, updateTaskStatus } from "../lib/tasks"
import {
  createConversation,
  getConversation,
  getMessages,
  appendMessage
} from "../lib/conversations"
import type Anthropic from "@anthropic-ai/sdk"

async function main() {
  const scriptStart = Date.now()

  const taskId = process.env.TASK_ID
  const projectSlug = process.env.PROJECT_SLUG
  const message = process.env.CHAT_MESSAGE
  const conversationIdInput = process.env.CONVERSATION_ID || undefined

  if (!taskId || !projectSlug || !message) {
    console.error("Ontbrekende omgevingsvariabelen: TASK_ID, PROJECT_SLUG, CHAT_MESSAGE zijn verplicht")
    process.exit(1)
  }

  const task = await getTask(taskId)
  if (!task) {
    console.error(`Taak ${taskId} niet gevonden in Firestore`)
    process.exit(1)
  }

  // Timing-diagnose (tijdelijk, om te bepalen waar de 25-40s vandaan komt):
  // T0 = task aangemaakt door de Vercel-route (createdAt)
  // T2 = dit script daadwerkelijk gestart (na checkout+setup+install)
  // Het verschil T2-T0 omvat: workflow_dispatch-latentie + runner-
  // provisioning + checkout + Node-setup + npm install — allemaal vóór
  // onze eigen code ook maar draait.
  const t0 = new Date(task.createdAt).getTime()
  const dispatchToScriptStartMs = scriptStart - t0
  console.log(`[timing] T0→T2 (dispatch tot scriptstart): ${dispatchToScriptStartMs}ms`)

  await updateTaskStatus(taskId, "running")
  const t3 = Date.now()

  try {
    const project = PROJECTS.find(p => p.slug === projectSlug)
    if (!project) {
      throw new Error(`Project "${projectSlug}" niet gevonden`)
    }

    let conversationId = conversationIdInput
    if (conversationId) {
      const conv = await getConversation(conversationId)
      if (!conv || conv.projectSlug !== projectSlug) {
        throw new Error("Conversation not found for this project")
      }
    } else {
      conversationId = await createConversation(projectSlug)
    }

    const storedMessages = await getMessages(conversationId)
    const history: Anthropic.MessageParam[] = storedMessages.map(m => ({
      role: m.role,
      content: m.content
    }))

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
    })

    const t4 = Date.now()
    console.log(`[timing] T2→T4 (scriptstart tot vlak vóór runClaudeTurn — Firestore-setup): ${t4 - scriptStart}ms`)

    const emphasizedMessage = `${message}\n\n[Beantwoord uitsluitend deze vraag. Ga niet in op eerder besproken onderwerpen, ook niet als inleiding.]`

    // Screenshot-ondersteuning: afbeelding komt uit het Task-document
    // zelf (opgeslagen bij createTask), niet via de workflow_dispatch-
    // inputs -- die geven alleen de task_id door.
    if (task.image) {
      history.push({
        role: "user",
        content: [
          { type: "text", text: emphasizedMessage },
          {
            type: "image",
            source: {
              type: "base64",
              media_type: task.image.mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
              data: task.image.base64
            }
          }
        ]
      })
    } else {
      history.push({ role: "user", content: emphasizedMessage })
    }

    const toolActivityLog: { tool: string; input: Record<string, unknown> }[] = []

    // Geen streaming naar een client nodig — GitHub Actions heeft geen
    // langlopende verbinding met de telefoon. Tekst wordt simpelweg
    // verzameld; de bestaande buffer-per-ronde-logica in runClaudeTurn
    // zorgt er al voor dat alleen de finale ronde meetelt.
    const { finalText, toolActivity } = await runClaudeTurn(
      project,
      history,
      alreadySeenPaths,
      structureAlreadyFetched,
      () => {}, // geen live tekst-streaming nodig
      (activity) => { toolActivityLog.push(activity) },
      conversationId,
      // Fase 3-correctie: GitHub Actions heeft ~5 minuten (workflow-
      // timeout), niet Vercel's 10s. De standaardwaarden in lib/claude.ts
      // zijn afgestemd op Vercel; hier expliciet ruimer instellen zodat
      // een changeset-flow (lezen → bedenken → prepare_changeset) niet
      // onterecht wordt afgekapt door een limiet die hier niet relevant is.
      // maxTokens ruim ingesteld: prepare_changeset moet volledige
      // bestandsinhoud kunnen meesturen, wat bij 1024 (de Vercel-
      // afgestemde standaard) werd afgekapt — precies de oorzaak van een
      // leeg resultaat zonder tool-aanroep tijdens de live Fase 3-test.
      // Verder verhoogd (8192 -> 16000): grotere bestanden zoals de
      // chat-pagina zelf (600+ regels) hebben meer ruimte nodig voor een
      // volledige prepare_changeset-aanroep. Kost alleen extra als het
      // daadwerkelijk nodig is (max_tokens is een plafond, geen vast
      // verbruik) — bij $10/miljoen output-tokens blijft dit voor normaal
      // gebruik in de orde van centen per voorstel.
      {
        maxToolRounds: 10,
        maxTotalMs: 240_000,
        maxTokens: 16000,
        // Master Plan v1.4, Niveau 1: bij het allereerste bericht van
        // een gesprek README/docs vooraf laden in de system prompt.
        // Zelfde bugfix als in de Vercel-route: kijk naar "ooit al een
        // geslaagd antwoord", niet naar "zijn er berichten" — anders
        // slaat een retry na een mislukte poging de automatische
        // projectcontext onterecht over.
        isNewConversation: !storedMessages.some(m => m.role === "assistant")
      }
    )

    const t5 = Date.now()
    console.log(`[timing] T4→T5 (runClaudeTurn zelf — Anthropic + tools): ${t5 - t4}ms`)

    await appendMessage(conversationId, {
      role: "assistant",
      content: finalText,
      createdAt: new Date().toISOString(),
      // Firestore accepteert geen 'undefined'-waarden — het veld moet
      // volledig ontbreken i.p.v. op undefined gezet worden, anders
      // gooit de Admin SDK een fout (precies dit gebeurde bij vragen
      // zonder tool-gebruik, bijv. een meta-vraag over het gesprek zelf).
      ...(toolActivity.length > 0 ? { toolActivity } : {})
    })

    const totalMs = Date.now() - t0
    console.log(`[timing] TOTAAL (task aangemaakt tot resultaat klaar): ${totalMs}ms`)
    console.log(`[timing] Samenvatting: dispatch+provisioning=${dispatchToScriptStartMs}ms, Firestore-setup=${t4 - scriptStart}ms, runClaudeTurn=${t5 - t4}ms, opslaan-resultaat=${Date.now() - t5}ms`)

    await updateTaskStatus(taskId, "completed", {
      answer: finalText,
      toolActivity,
      result: JSON.stringify({
        timingMs: {
          dispatchAndProvisioning: dispatchToScriptStartMs,
          firestoreSetup: t4 - scriptStart,
          runClaudeTurn: t5 - t4,
          total: totalMs
        }
      })
    })

    console.log(`Taak ${taskId} voltooid in ${totalMs}ms totaal.`)
  } catch (error) {
    console.error("Taak mislukt:", error)
    await updateTaskStatus(taskId, "failed", { error: String(error) })
    process.exit(1)
  }
}

main()
