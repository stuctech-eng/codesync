import { NextRequest, NextResponse } from "next/server"

const VERCEL_TOKEN = process.env.VERCEL_TOKEN!
const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID!

export async function GET(req: NextRequest) {
  try {
    const since = req.nextUrl.searchParams.get("since")

    const url = since
      ? `https://api.vercel.com/v6/deployments?projectId=${VERCEL_PROJECT_ID}&limit=5&target=production&since=${since}`
      : `https://api.vercel.com/v6/deployments?projectId=${VERCEL_PROJECT_ID}&limit=1&target=production`

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${VERCEL_TOKEN}` }
    })

    if (!res.ok) return NextResponse.json({ error: "Vercel API error" }, { status: 500 })

    const data = await res.json()
    const deployment = data.deployments?.[0]

    if (!deployment) return NextResponse.json({ state: "NONE" })

    return NextResponse.json({
      id: deployment.uid,
      state: deployment.state,
      url: `https://${deployment.url}`,
      createdAt: deployment.createdAt,
      message: deployment.meta?.githubCommitMessage ?? null
    })

  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
