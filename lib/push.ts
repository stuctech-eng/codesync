import webpush from "web-push"

// In-memory subscription store (V1)
let storedSubscription: webpush.PushSubscription | null = null
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

export function saveSubscription(sub: webpush.PushSubscription) {
  storedSubscription = sub
}

export function getSubscription(): webpush.PushSubscription | null {
  return storedSubscription
}

export async function sendPushNotification(payload: {
  title: string
  body: string
  url?: string
}): Promise<boolean> {
  if (!storedSubscription) return false
  try {
    init()
    await webpush.sendNotification(
      storedSubscription,
      JSON.stringify(payload)
    )
    return true
  } catch (error) {
    console.error("Push failed:", error)
    storedSubscription = null
    return false
  }
}
