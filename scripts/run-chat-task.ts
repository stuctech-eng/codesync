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

  await updateTaskStatus(taskId, "running")

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

    const emphasizedMessage = `${message}\n\n[Beantwoord uitsluitend deze vraag. Ga niet in op eerder besproken onderwerpen, ook niet als inleiding.]`
    history.push({ role: "user", content: emphasizedMessage })

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
      (activity) => { toolActivityLog.push(activity) }
    )

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

    await updateTaskStatus(taskId, "completed", {
      answer: finalText,
      toolActivity
    })

    console.log(`Taak ${taskId} voltooid.`)
  } catch (error) {
    console.error("Taak mislukt:", error)
    await updateTaskStatus(taskId, "failed", { error: String(error) })
    process.exit(1)
  }
}

main()
