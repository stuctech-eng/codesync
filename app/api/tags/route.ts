import { NextRequest, NextResponse } from "next/server"
import { createTag, getTags, getCommitCount, restoreTag } from "@/lib/github"
import { PROJECTS } from "@/lib/projects"

const BASE = "https://api.github.com"
const TOKEN = process.env.GITHUB_PAT!
const headers = {
  Authorization: `Bearer ${TOKEN}`,
  "Content-Type": "application/json",
  Accept: "application/vnd.github+json"
}

async function getLatestCommitSha(repo: string, branch: string): Promise<string | null> {
  try {
    const res = await fetch(`${BASE}/repos/${repo}/git/refs/heads/${branch}`, { headers })
    if (!res.ok) return null
    const data = await res.json()
    return data.object?.sha ?? null
  } catch {
    return null
  }
}

// GET — haal tags op per project
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug")
  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 })

  const project = PROJECTS.find(p => p.slug === slug)
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 })

  const tags = await getTags(project.githubRepo)
  return NextResponse.json({ tags })
}

// PUT — herstel naar tag
export async function PUT(req: NextRequest) {
  try {
    const { projectSlug, tag } = await req.json()

    const project = PROJECTS.find(p => p.slug === projectSlug)
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 })

    const commitSha = await restoreTag(project.githubRepo, project.branch, tag)

    return NextResponse.json({ success: true, commitSha, tag })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

// POST — maak herstelpunt aan
export async function POST(req: NextRequest) {
  try {
    const { projectSlug } = await req.json()

    const project = PROJECTS.find(p => p.slug === projectSlug)
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 })

    // Haal latest commit SHA op via branch ref
    const sha = await getLatestCommitSha(project.githubRepo, project.branch)
    if (!sha) return NextResponse.json({ error: "Kan commit SHA niet ophalen" }, { status: 500 })

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
