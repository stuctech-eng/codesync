import { NextResponse } from "next/server"
import { sendPushNotification } from "@/lib/push"

const VERCEL_TOKEN = process.env.VERCEL_TOKEN!
const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID!

let lastNotifiedId: string | null = null

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

    const state = d.readyState ?? d.state
    const message = d.meta?.githubCommitMessage ?? null

    // Stuur push notificatie bij READY (eenmalig per deployment)
    if (state === "READY" && d.uid !== lastNotifiedId) {
      lastNotifiedId = d.uid
      await sendPushNotification({
        title: "✅ Deployment geslaagd",
        body: message ?? "CodeSync deployment klaar",
        url: `https://vercel.com/stuctech-83adc60b/codesync`
      })
    }

    if (state === "ERROR" && d.uid !== lastNotifiedId) {
      lastNotifiedId = d.uid
      await sendPushNotification({
        title: "❌ Deployment mislukt",
        body: message ?? "Check Vercel voor details",
        url: `https://vercel.com/stuctech-83adc60b/codesync`
      })
    }

    return NextResponse.json({
      id: d.uid,
      state,
      url: d.url ? `https://${d.url}` : null,
      createdAt: d.createdAt,
      message
    })

  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
