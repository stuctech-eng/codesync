import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { PROJECTS } from "@/lib/projects"
import { createTask, listTasks, type TaskType } from "@/lib/tasks"

const VALID_TYPES: TaskType[] = ["test", "build", "typecheck", "custom"]

// POST — maak een taak aan. Fase 1: geeft direct het task ID terug,
// wacht NIET op een resultaat (dat is het hele punt — de Vercel-request
// blijft kort, ongeacht hoe lang het onderliggende werk straks duurt).
// In Fase 1 wordt er nog niets uitgevoerd — GitHub Actions komt pas in
// Fase 2, na een apart, expliciet akkoord (Master Plan v1.2, sectie 6).
export async function POST(req: NextRequest) {
  const authError = requireAuth(req)
  if (authError) return authError

  let body: { projectSlug?: string; type?: string; command?: string; conversationId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { projectSlug, type, command, conversationId } = body

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

  const task = await createTask({
    projectSlug,
    type: type as TaskType,
    command,
    conversationId
  })

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
