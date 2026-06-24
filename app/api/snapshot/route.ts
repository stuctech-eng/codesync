import { NextRequest, NextResponse } from "next/server"
import { getGitHubSnapshot } from "@/lib/snapshot"
import { PROJECTS } from "@/lib/projects"

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug")
  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 })

  const project = PROJECTS.find(p => p.slug === slug)
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 })

  try {
    const snapshot = await getGitHubSnapshot(project)
    return NextResponse.json(snapshot)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
