import { NextRequest, NextResponse } from "next/server"

const VERCEL_TOKEN = process.env.VERCEL_TOKEN!
const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID!

export async function GET(req: NextRequest) {
  try {
    const commitSha = req.nextUrl.searchParams.get("sha")

    const res = await fetch(
      `https://api.vercel.com/v6/deployments?projectId=${VERCEL_PROJECT_ID}&limit=5`,
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
