import { NextResponse } from "next/server"
import { testConnection } from "@/lib/github"
import { PROJECTS } from "@/lib/projects"

const BASE = "https://api.github.com"
const TOKEN = process.env.GITHUB_PAT!
const headers = {
  Authorization: `Bearer ${TOKEN}`,
  Accept: "application/vnd.github+json"
}

async function getFileCount(repo: string, branch: string): Promise<number> {
  try {
    const res = await fetch(
      `${BASE}/repos/${repo}/git/trees/${branch}?recursive=1`,
      { headers }
    )
    if (!res.ok) return 0
    const data = await res.json()
    return (data.tree ?? []).filter((f: { type: string }) => f.type === "blob").length
  } catch {
    return 0
  }
}

export async function GET() {
  const results = await Promise.all(
    PROJECTS.filter(p => p.status === "active").map(async project => {
      const result = await testConnection(project.githubRepo)
      const fileCount = result.ok ? await getFileCount(project.githubRepo, project.branch) : 0
      return {
        slug: project.slug,
        name: project.name,
        repo: project.githubRepo,
        fileCount,
        ...result
      }
    })
  )

  const allOk = results.every(r => r.ok)

  return NextResponse.json({
    status: allOk ? "ok" : "degraded",
    pat: process.env.GITHUB_PAT ? "set" : "MISSING",
    projects: results,
    checkedAt: new Date().toISOString()
  })
}
