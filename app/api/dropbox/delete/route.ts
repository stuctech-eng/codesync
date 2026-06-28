import { NextRequest, NextResponse } from "next/server"

const DROPBOX_TOKEN = process.env.DROPBOX_ACCESS_TOKEN!

export async function POST(req: NextRequest) {
  try {
    const { path } = await req.json()
    if (!path) return NextResponse.json({ error: "path required" }, { status: 400 })

    const res = await fetch("https://api.dropboxapi.com/2/files/delete_v2", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${DROPBOX_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ path })
    })

    if (!res.ok) {
      const err = await res.text()
      return NextResponse.json({ error: err }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
