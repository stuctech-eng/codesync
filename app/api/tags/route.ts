import { NextRequest, NextResponse } from "next/server"
import { createTag, getTags, getCommitCount } from "@/lib/github"
import { PROJECTS } from "@/lib/projects"

// GET — haal tags op per project
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug")
  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 })

  const project = PROJECTS.find(p => p.slug === slug)
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 })

  const tags = await getTags(project.githubRepo)
  return NextResponse.json({ tags })
}

// POST — maak herstelpunt aan
export async function POST(req: NextRequest) {
  try {
    const { projectSlug, sha } = await req.json()

    const project = PROJECTS.find(p => p.slug === projectSlug)
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 })

    // Versienummer op basis van commit count
    const commitCount = await getCommitCount(project.githubRepo, project.branch)
    const tag = `v1.0.${commitCount}`

    const date = new Date().toLocaleDateString("nl-NL", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    })
    const message = `Herstelpunt ${tag} — ${date}`

    const success = await createTag(project.githubRepo, sha, tag, message)

    if (!success) {
      return NextResponse.json({ error: "Tag aanmaken mislukt" }, { status: 500 })
    }

    return NextResponse.json({ success: true, tag, message })

  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
