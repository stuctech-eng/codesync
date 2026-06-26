import { NextRequest, NextResponse } from "next/server"
import { sendPushNotification } from "@/lib/push"
import { getDb } from "@/lib/firebase-admin"

const VERCEL_TOKEN = process.env.VERCEL_TOKEN!
const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID!

// Sla genotificeerde deployments op in Firestore — persistent over serverless instances
async function hasNotified(deploymentId: string): Promise<boolean> {
  try {
    const db = getDb()
    const doc = await db.collection("codesync").doc(`notified-${deploymentId}`).get()
    return doc.exists
  } catch {
    return false
  }
}

async function markNotified(deploymentId: string): Promise<void> {
  try {
    const db = getDb()
    await db.collection("codesync").doc(`notified-${deploymentId}`).set({
      notifiedAt: new Date().toISOString()
    })
  } catch {
    // stil falen
  }
}

export async function GET(req: NextRequest) {
  try {
    const commitSha = req.nextUrl.searchParams.get("sha")
    const after = req.nextUrl.searchParams.get("after")
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

    // Push notificatie — eenmalig per deployment via Firestore
    const alreadyNotified = await hasNotified(deployment.uid)

    if (!alreadyNotified) {
      if (state === "READY") {
        await markNotified(deployment.uid)
        await sendPushNotification({
          title: `✅ ${projectName} deployment geslaagd`,
          body: message ?? `${projectName} is live`,
          url: `https://vercel.com/stuctech-83adc60b/codesync`
        })
      } else if (state === "ERROR" || state === "CANCELED") {
        await markNotified(deployment.uid)
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
