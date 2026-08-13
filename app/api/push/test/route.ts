import { NextRequest, NextResponse } from "next/server"
import { getSubscription } from "@/lib/push"
import { requireAuth } from "@/lib/auth"
import webpush from "web-push"

export async function GET(req: NextRequest) {
  const authError = requireAuth(req)
  if (authError) return authError

  try {
    const sub = await getSubscription()
    if (!sub) return NextResponse.json({ error: "No subscription found" })

    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT!,
      process.env.VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!
    )

    await webpush.sendNotification(sub, JSON.stringify({
      title: "✅ CodeSync Test",
      body: "Push notificaties werken!",
      url: "https://codesync-three-gamma.vercel.app"
    }))

    return NextResponse.json({ sent: true })
  } catch (error: any) {
    return NextResponse.json({ 
      sent: false, 
      error: error?.message ?? String(error),
      statusCode: error?.statusCode ?? null,
      body: error?.body ?? null
    })
  }
}
