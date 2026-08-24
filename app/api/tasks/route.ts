import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { PROJECTS } from "@/lib/projects"
import { createTask, listTasks, type TaskType } from "@/lib/tasks"

const VALID_TYPES: TaskType[] = ["test", "build", "typecheck", "custom", "chat"]

const GITHUB_API = "https://api.github.com"
const CODESYNC_REPO = "stuctech-eng/codesync"
const WORKFLOW_FILE = "claude-chat-task.yml"

// Triggert de GitHub Actions-workflow die de Claude-tool-loop uitvoert
// buiten Vercel's tijdslimiet om (Master Plan v1.2, Fase 2). Faalt de
// trigger zelf, dan wordt de taak als "failed" gemarkeerd — de aanroeper
// hoeft niet te wachten op de daadwerkelijke workflow-uitvoering.
async function triggerChatWorkflow(taskId: string, projectSlug: string, message: string, conversationId?: string) {
  const res = await fetch(
    `${GITHUB_API}/repos/${CODESYNC_REPO}/actions/workflows/${WORKFLOW_FILE}/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_PAT}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        ref: "main",
        inputs: {
          task_id: taskId,
          project_slug: projectSlug,
          message,
          conversation_id: conversationId ?? ""
        }
      })
    }
  )
  if (!res.ok) {
    throw new Error(`workflow_dispatch failed: ${res.status} ${await res.text()}`)
  }
}

// POST — maak een taak aan. Geeft direct het task ID terug, wacht NIET
// op een resultaat — de Vercel-request blijft kort, ongeacht hoe lang
// het onderliggende werk (bij "chat": de volledige Claude-tool-loop in
// GitHub Actions) straks duurt.
export async function POST(req: NextRequest) {
  const authError = requireAuth(req)
  if (authError) return authError

  let body: {
    projectSlug?: string; type?: string; command?: string; conversationId?: string; message?: string
    image?: { base64: string; mediaType: string }
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { projectSlug, type, command, conversationId, message, image } = body

  if (!projectSlug || !type) {
    return NextResponse.json({ error: "projectSlug and type are required" }, { status: 400 })
  }

  const project = PROJECTS.find(p => p.slug === projectSlug)
  if (!project) {
    return NextResponse.json({ error: `Project "${projectSlug}" not found` }, { status: 404 })
  }

  if (!VALID_TYPES.includes(type as TaskType)) {
    return NextResponse.json(
      { error: `type must be one of: ${VALID_TYPES.join(", ")}` },
      { status: 400 }
    )
  }

  // Screenshot-ondersteuning: een bericht met ALLEEN een afbeelding
  // (geen tekst) is nu ook geldig, niet meer verplicht beide.
  if (type === "chat" && !image && (!message || typeof message !== "string" || !message.trim())) {
    return NextResponse.json({ error: "message or image is required for type=chat" }, { status: 400 })
  }

  const task = await createTask({
    projectSlug,
    type: type as TaskType,
    command,
    conversationId,
    message,
    image
  })

  if (type === "chat") {
    try {
      await triggerChatWorkflow(task.id, projectSlug, message ?? "", conversationId)
    } catch (error) {
      // De taak is al aangemaakt — markeer 'm meteen als mislukt i.p.v.
      // de aanroeper te laten wachten/pollen op een taak die nooit start.
      const { updateTaskStatus } = await import("@/lib/tasks")
      await updateTaskStatus(task.id, "failed", { error: String(error) })
      return NextResponse.json(
        { error: "Kon GitHub Actions niet starten", detail: String(error), task },
        { status: 502 }
      )
    }
  }

  return NextResponse.json({ task })
}

// GET — lijst van taken voor een project
export async function GET(req: NextRequest) {
  const authError = requireAuth(req)
  if (authError) return authError

  const projectSlug = req.nextUrl.searchParams.get("projectSlug")
  if (!projectSlug) {
    return NextResponse.json({ error: "projectSlug is required" }, { status: 400 })
  }

  const tasks = await listTasks(projectSlug)
  return NextResponse.json({ tasks })
}
