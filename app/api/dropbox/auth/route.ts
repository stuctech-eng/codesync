import { NextResponse } from "next/server"

const APP_KEY = process.env.DROPBOX_APP_KEY!
const REDIRECT_URI = "https://codesync-three-gamma.vercel.app/api/dropbox/callback"

export async function GET() {
  const url = `https://www.dropbox.com/oauth2/authorize?client_id=${APP_KEY}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&token_access_type=offline`
  return NextResponse.redirect(url)
}
