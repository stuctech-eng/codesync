import { NextRequest, NextResponse } from "next/server"
import { sendPushNotification } from "@/lib/push"

const VERCEL_TOKEN = process.env.VERCEL_TOKEN!
const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID!

// In-memory — per serverless instance, maar genoeg voor deduplicatie binnen één poll sessie
const notifiedDeployments = new Set<string>()

export async function GET(req: NextRequest) {
  try {
    const commitSha = req.nextUrl.searchParams.get("sha")
    const projectName = req.nextUrl.searchParams.get("project") ?? "CodeSync"

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

    // Notificeer alleen als deployment minder dan 10 minuten oud is
    const deployAge = Date.now() - deployment.createdAt
    const isRecent = deployAge < 10 * 60 * 1000 // 10 minuten

    if (isRecent && !notifiedDeployments.has(deployment.uid)) {
      if (state === "READY") {
        notifiedDeployments.add(deployment.uid)
        await sendPushNotification({
          title: `✅ ${projectName} deployment geslaagd`,
          body: message ?? `${projectName} is live`,
          url: `https://vercel.com/stuctech-83adc60b/codesync`
        })
      } else if (state === "ERROR" || state === "CANCELED") {
        notifiedDeployments.add(deployment.uid)
        await sendPushNotification({
          title: `❌ ${projectName} deployment mislukt`,
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
