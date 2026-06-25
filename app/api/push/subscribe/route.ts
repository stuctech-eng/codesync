import { NextRequest, NextResponse } from "next/server"
import { saveSubscription, getSubscription } from "@/lib/push"
import webpush from "web-push"

export async function POST(req: NextRequest) {
  try {
    const sub = await req.json() as webpush.PushSubscription
    await saveSubscription(sub)
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function GET() {
  const sub = await getSubscription()
  return NextResponse.json({ hasSubscription: !!sub })
}
