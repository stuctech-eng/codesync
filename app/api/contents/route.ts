import { NextRequest, NextResponse } from "next/server"
import { getFileContentsForProject } from "@/lib/snapshot"
import { PROJECTS } from "@/lib/projects"
import { requireAuth } from "@/lib/auth"

export async function POST(req: NextRequest) {
  const authError = requireAuth(req)
  if (authError) return authError

  try {
    const { projectSlug, paths } = await req.json()

    if (!projectSlug || !paths || !Array.isArray(paths)) {
      return NextResponse.json({ error: "projectSlug and paths required" }, { status: 400 })
    }

    const project = PROJECTS.find(p => p.slug === projectSlug)
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 })

    const files = await getFileContentsForProject(project, paths)
    return NextResponse.json({ files })

  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
