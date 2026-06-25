import { initializeApp, getApps, cert } from "firebase-admin/app"
import { getFirestore } from "firebase-admin/firestore"

function getApp() {
  if (getApps().length > 0) return getApps()[0]

  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT!)

  return initializeApp({
    credential: cert(serviceAccount)
  })
}

export function getDb() {
  getApp()
  return getFirestore()
}
