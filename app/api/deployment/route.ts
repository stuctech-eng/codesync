import { NextRequest, NextResponse } from "next/server"
import { PROJECTS } from "@/lib/projects"
import { requireAuth } from "@/lib/auth"

const VERCEL_TOKEN = process.env.VERCEL_TOKEN!
const FALLBACK_PROJECT_ID = process.env.VERCEL_PROJECT_ID!

export async function GET(req: NextRequest) {
  const authError = requireAuth(req)
  if (authError) return authError

  try {
    const commitSha = req.nextUrl.searchParams.get("sha")
    const slug = req.nextUrl.searchParams.get("project")

    // Zoek het juiste Vercel-project op basis van de projectslug.
    // Valt terug op de env var (CodeSync zelf) als het project geen
    // vercelProject heeft ingesteld in lib/projects.ts.
    const project = slug ? PROJECTS.find(p => p.slug === slug) : undefined
    const vercelProjectId = project?.vercelProject ?? FALLBACK_PROJECT_ID

    const res = await fetch(
      `https://api.vercel.com/v6/deployments?projectId=${vercelProjectId}&limit=5`,
      {
        headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
        cache: "no-store"
      }
    )

    if (!res.ok) return NextResponse.json({ error: "Vercel API error" }, { status: 500 })

    const data = await res.json()
    const deployments = data.deployments ?? []

    if (deployments.length === 0) return NextResponse.json({ state: "NONE" })

    let deployment = deployments[0]
    if (commitSha) {
      const match = deployments.find((d: any) => {
        const sha = d.meta?.githubCommitSha ?? ""
        return sha.slice(0, 7) === commitSha.slice(0, 7)
      })
      if (match) deployment = match
    }

    const state = deployment.readyState ?? deployment.state
    const message = deployment.meta?.githubCommitMessage ?? null

    return NextResponse.json({
      id: deployment.uid,
      state,
      url: deployment.url ? `https://${deployment.url}` : null,
      createdAt: deployment.createdAt,
      message
    })

  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
