import { NextResponse } from "next/server"
import { sendPushNotification } from "@/lib/push"

export async function GET() {
  const result = await sendPushNotification({
    title: "✅ CodeSync Test",
    body: "Push notificaties werken!",
    url: "https://codesync-three-gamma.vercel.app"
  })
  return NextResponse.json({ sent: result })
}
