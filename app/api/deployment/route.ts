import { NextRequest, NextResponse } from "next/server"
import { sendPushNotification } from "@/lib/push"

const VERCEL_TOKEN = process.env.VERCEL_TOKEN!
const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID!

const notifiedDeployments = new Set<string>()

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

    // Zoek deployment die bij de commit SHA hoort
    let deployment = commitSha
      ? deployments.find((d: any) =>
          d.meta?.githubCommitSha?.startsWith(commitSha) ||
          d.meta?.githubCommitRef === commitSha
        )
      : deployments[0]

    // Fallback naar nieuwste als SHA niet gevonden
    if (!deployment) deployment = deployments[0]
    if (!deployment) return NextResponse.json({ state: "NONE" })

    const state = deployment.readyState ?? deployment.state
    const message = deployment.meta?.githubCommitMessage ?? null

    // Push notificatie bij READY of ERROR (eenmalig)
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
