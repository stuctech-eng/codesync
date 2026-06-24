import { NextResponse } from "next/server"
import { testConnection } from "@/lib/github"
import { PROJECTS } from "@/lib/projects"

export async function GET() {
  const results = await Promise.all(
    PROJECTS.map(async project => {
      const result = await testConnection(project.githubRepo)
      return {
        slug: project.slug,
        name: project.name,
        repo: project.githubRepo,
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
