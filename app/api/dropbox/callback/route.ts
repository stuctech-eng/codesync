import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/firebase-admin"

const APP_KEY = process.env.DROPBOX_APP_KEY!
const APP_SECRET = process.env.DROPBOX_APP_SECRET!
const REDIRECT_URI = "https://codesync-three-gamma.vercel.app/api/dropbox/callback"

// LET OP: bewust GEEN X-CodeSync-Key check op deze route — dit is de
// eindpagina van de eenmalige Dropbox OAuth-setup, rechtstreeks door de
// browser bezocht (redirect, geen JS fetch die een custom header kan
// meesturen). Zie ook app/api/dropbox/auth/route.ts.
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code")
  if (!code) return NextResponse.json({ error: "No code" }, { status: 400 })

  const res = await fetch("https://api.dropboxapi.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      grant_type: "authorization_code",
      client_id: APP_KEY,
      client_secret: APP_SECRET,
      redirect_uri: REDIRECT_URI
    })
  })

  const data = await res.json()

  if (!res.ok) {
    // Geen tokendetails in de foutrespons
    return NextResponse.json({ error: "Dropbox OAuth exchange failed" }, { status: 500 })
  }

  // Finding 1 fix (aangescherpt na review): de refresh token wordt NOOIT
  // teruggegeven in de HTTP-response, EN NOOIT gelogd (ook niet server-
  // side) — dat voorkomt dat het volledige geheim onnodig in Vercel
  // function logs terechtkomt. In plaats daarvan: opslaan in Firestore
  // (zelfde vertrouwenszone als de overige server-only secrets), waar je
  // 'm via de Firebase Console kunt ophalen om handmatig naar Vercel's
  // DROPBOX_REFRESH_TOKEN environment variable te kopiëren.
  try {
    const db = getDb()
    await db.collection("codesync").doc("dropbox-oauth-setup").set({
      refresh_token: data.refresh_token,
      obtainedAt: new Date().toISOString()
    })
  } catch (e) {
    // Als opslaan faalt, in elk geval niet alsnog naar logs/response lekken
    return NextResponse.json(
      { error: "OAuth succeeded but failed to store token — check Firestore connectivity" },
      { status: 500 }
    )
  }

  return NextResponse.json({
    success: true,
    message: "Dropbox gekoppeld. Haal de refresh_token op via Firebase Console → Firestore → codesync/dropbox-oauth-setup, en zet 'm in Vercel als DROPBOX_REFRESH_TOKEN. Verwijder daarna dat Firestore-document weer."
  })
}
