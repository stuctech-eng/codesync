import { NextResponse } from "next/server"

const APP_KEY = process.env.DROPBOX_APP_KEY!
const REDIRECT_URI = "https://codesync-three-gamma.vercel.app/api/dropbox/callback"

// LET OP: bewust GEEN X-CodeSync-Key check op deze route — dit is de
// startpagina van de eenmalige Dropbox OAuth-setup, rechtstreeks in de
// browser bezocht (geen JS fetch die een custom header kan meesturen).
// Zie ook app/api/dropbox/callback/route.ts.
export async function GET() {
  const url = `https://www.dropbox.com/oauth2/authorize?client_id=${APP_KEY}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&token_access_type=offline`
  return NextResponse.redirect(url)
}
