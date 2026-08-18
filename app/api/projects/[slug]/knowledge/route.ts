import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { PROJECTS } from "@/lib/projects"
import { fetchProjectContextDocsList } from "@/lib/claude"

// GET /api/projects/:slug/knowledge — maakt de Niveau 1-projectcontext
// zichtbaar in de UI (Master Plan v1.5, Niveau 2). Puur weergave; geen
// nieuwe data, geen nieuw datamodel — hergebruikt exact dezelfde
// functie die de chat al gebruikt om de system prompt te vullen.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const authError = requireAuth(req)
  if (authError) return authError

  const { slug } = await params
  const project = PROJECTS.find(p => p.slug === slug)
  if (!project) {
    return NextResponse.json({ error: `Project "${slug}" not found` }, { status: 404 })
  }

  const docs = await fetchProjectContextDocsList(project)
  return NextResponse.json({ docs })
}
