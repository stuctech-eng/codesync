import webpush from "web-push"
import { getDb } from "@/lib/firebase-admin"

let initialized = false

function init() {
  if (initialized) return
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  )
  initialized = true
}

export async function saveSubscription(sub: webpush.PushSubscription) {
  const db = getDb()
  await db.collection("codesync").doc("push-subscription").set({
    subscription: JSON.stringify(sub),
    updatedAt: new Date().toISOString()
  })
}

export async function getSubscription(): Promise<webpush.PushSubscription | null> {
  try {
    const db = getDb()
    const doc = await db.collection("codesync").doc("push-subscription").get()
    if (!doc.exists) return null
    const data = doc.data()
    return JSON.parse(data?.subscription) as webpush.PushSubscription
  } catch {
    return null
  }
}

export async function sendPushNotification(payload: {
  title: string
  body: string
  url?: string
}): Promise<boolean> {
  const sub = await getSubscription()
  if (!sub) return false

  try {
    init()
    await webpush.sendNotification(sub, JSON.stringify(payload))
    return true
  } catch (error) {
    console.error("Push failed:", error)
    return false
  }
}
