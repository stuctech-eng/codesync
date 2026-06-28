import { NextRequest, NextResponse } from "next/server"

const APP_KEY = process.env.DROPBOX_APP_KEY!
const APP_SECRET = process.env.DROPBOX_APP_SECRET!
const REDIRECT_URI = "https://codesync-three-gamma.vercel.app/api/dropbox/callback"

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
    return NextResponse.json({ error: data }, { status: 500 })
  }

  // Toon refresh token zodat je hem in Vercel kunt zetten
  return NextResponse.json({
    success: true,
    refresh_token: data.refresh_token,
    access_token: data.access_token,
    message: "Kopieer de refresh_token naar Vercel als DROPBOX_REFRESH_TOKEN"
  })
}
