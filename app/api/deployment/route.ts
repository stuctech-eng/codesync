import { NextResponse } from "next/server"

const VERCEL_TOKEN = process.env.VERCEL_TOKEN!
const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID!

export async function GET() {
  try {
    const res = await fetch(
      `https://api.vercel.com/v6/deployments?projectId=${VERCEL_PROJECT_ID}&limit=1`,
      {
        headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
        cache: "no-store"
      }
    )

    if (!res.ok) return NextResponse.json({ error: "Vercel API error" }, { status: 500 })

    const data = await res.json()
    const d = data.deployments?.[0]
    if (!d) return NextResponse.json({ state: "NONE" })

    return NextResponse.json({
      id: d.uid,
      state: d.readyState ?? d.state,
      url: d.url ? `https://${d.url}` : null,
      createdAt: d.createdAt,
      message: d.meta?.githubCommitMessage ?? null
    })

  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
