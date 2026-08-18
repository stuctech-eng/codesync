import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { PROJECTS } from "@/lib/projects"
import { createConversation } from "@/lib/conversations"

// POST /api/conversations — maakt DIRECT een leeg gesprek aan (Master
// Plan v1.5, Niveau 2). Voorheen ontstond een gesprek pas bij het eerste
// bericht, waardoor een net geopende, nog lege chat niet in de
// chat-lijst kon verschijnen. Hergebruikt de bestaande, ongewijzigde
// createConversation() — geen nieuw datamodel.
export async function POST(req: NextRequest) {
  const authError = requireAuth(req)
  if (authError) return authError

  let body: { projectSlug?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { projectSlug } = body
  if (!projectSlug) {
    return NextResponse.json({ error: "projectSlug is required" }, { status: 400 })
  }

  const project = PROJECTS.find(p => p.slug === projectSlug)
  if (!project) {
    return NextResponse.json({ error: `Project "${projectSlug}" not found` }, { status: 404 })
  }

  const conversationId = await createConversation(projectSlug)
  return NextResponse.json({ conversationId })
}
