import { NextRequest, NextResponse } from "next/server"
import { PROJECTS } from "@/lib/projects"
import { requireAuth } from "@/lib/auth"

const BASE = "https://api.github.com"
const TOKEN = process.env.GITHUB_PAT!
const headers = {
  Authorization: `Bearer ${TOKEN}`,
  Accept: "application/vnd.github+json"
}

export async function GET(req: NextRequest) {
  const authError = requireAuth(req)
  if (authError) return authError

  const slug = req.nextUrl.searchParams.get("slug")
  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 })

  const project = PROJECTS.find(p => p.slug === slug)
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 })

  try {
    const res = await fetch(
      `${BASE}/repos/${project.githubRepo}/commits?sha=${project.branch}&per_page=20`,
      { headers }
    )
    if (!res.ok) return NextResponse.json({ error: "GitHub error" }, { status: 500 })

    const data = await res.json()

    const commits = data.map((c: any) => ({
      sha: c.sha.slice(0, 7),
      message: c.commit.message,
      date: c.commit.author.date,
      author: c.commit.author.name
    }))

    return NextResponse.json({ commits })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
