import { NextRequest, NextResponse } from "next/server"
import { sendPushNotification } from "@/lib/push"

const VERCEL_TOKEN = process.env.VERCEL_TOKEN!
const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID!

const notifiedDeployments = new Set<string>()

export async function GET(req: NextRequest) {
  try {
    const commitSha = req.nextUrl.searchParams.get("sha")
    const after = req.nextUrl.searchParams.get("after")

    const res = await fetch(
      `https://api.vercel.com/v6/deployments?projectId=${VERCEL_PROJECT_ID}&limit=5`,
      {
        headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
        cache: "no-store"
      }
    )

    if (!res.ok) return NextResponse.json({ error: "Vercel API error" }, { status: 500 })

    const data = await res.json()
    let deployments = data.deployments ?? []

    // Filter op deployments aangemaakt na de push
    if (after) {
      const afterTs = parseInt(after)
      deployments = deployments.filter((d: any) => d.createdAt >= afterTs)
    }

    if (deployments.length === 0) {
      return NextResponse.json({ state: "NONE" })
    }

    // Zoek op commit SHA of neem nieuwste
    let deployment = commitSha
      ? deployments.find((d: any) =>
          d.meta?.githubCommitSha?.startsWith(commitSha)
        ) ?? deployments[0]
      : deployments[0]

    const state = deployment.readyState ?? deployment.state
    const message = deployment.meta?.githubCommitMessage ?? null

    // Push notificatie (eenmalig per deployment)
    if (!notifiedDeployments.has(deployment.uid)) {
      if (state === "READY") {
        notifiedDeployments.add(deployment.uid)
        await sendPushNotification({
          title: "✅ Deployment geslaagd",
          body: message ?? "CodeSync deployment klaar",
          url: `https://vercel.com/stuctech-83adc60b/codesync`
        })
      } else if (state === "ERROR" || state === "CANCELED") {
        notifiedDeployments.add(deployment.uid)
        await sendPushNotification({
          title: "❌ Deployment mislukt",
          body: message ?? "Check Vercel voor details",
          url: `https://vercel.com/stuctech-83adc60b/codesync`
        })
      }
    }

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
