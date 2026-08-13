import { NextRequest, NextResponse } from "next/server"
import { sendPushNotification } from "@/lib/push"
import { requireAuth } from "@/lib/auth"

export async function POST(req: NextRequest) {
  const authError = requireAuth(req)
  if (authError) return authError

  try {
    const { title, body, url } = await req.json()
    const sent = await sendPushNotification({ title, body, url })
    return NextResponse.json({ sent })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
