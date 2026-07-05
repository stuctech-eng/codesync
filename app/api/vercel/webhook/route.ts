import { NextRequest, NextResponse } from "next/server"
import { sendPushNotification } from "@/lib/push"
import { getDb } from "@/lib/firebase-admin"

const WEBHOOK_SECRET = process.env.VERCEL_WEBHOOK_SECRET!

export async function POST(req: NextRequest) {
  try {
    // Verificeer webhook secret
    const secret = req.headers.get("x-vercel-signature") ?? req.nextUrl.searchParams.get("secret")
    if (secret !== WEBHOOK_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { type, payload } = body

    // Alleen deployment events
    if (!type?.startsWith("deployment")) {
      return NextResponse.json({ ok: true })
    }

    const state = payload?.deployment?.state ?? payload?.state
    const name = payload?.deployment?.name ?? payload?.name ?? "CodeSync"
    const message = payload?.deployment?.meta?.githubCommitMessage ?? null
    const deploymentId = payload?.deployment?.id ?? payload?.id

    if (!deploymentId) return NextResponse.json({ ok: true })

    // Stuur notificatie bij READY of ERROR
    if (state === "READY" || state === "ERROR") {
      // Sla op in Firestore zodat de UI ook kan pollen
      try {
        const db = getDb()
        await db.collection("codesync").doc(`deployment-${deploymentId}`).set({
          state,
          message,
          updatedAt: new Date().toISOString()
        })
      } catch {}

      await sendPushNotification({
        title: state === "READY"
          ? `✅ ${name} deployment geslaagd`
          : `❌ ${name} deployment mislukt`,
        body: message ?? (state === "READY" ? `${name} is live` : "Check Vercel voor details"),
        url: `https://vercel.com/stuctech-83adc60b/codesync`
      })
    }

    return NextResponse.json({ ok: true })

  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
