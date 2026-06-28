import { NextRequest, NextResponse } from "next/server"
import { getDropboxToken } from "@/lib/dropbox"

export async function POST(req: NextRequest) {
  try {
    const { path } = await req.json()
    if (!path) return NextResponse.json({ error: "path required" }, { status: 400 })

    const res = await fetch("https://content.dropboxapi.com/2/files/download", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${await getDropboxToken()}`,
        "Dropbox-API-Arg": JSON.stringify({ path })
      }
    })

    if (!res.ok) {
      const err = await res.text()
      return NextResponse.json({ error: err }, { status: 500 })
    }

    const buffer = await res.arrayBuffer()
    const base64 = Buffer.from(buffer).toString("base64")

    return NextResponse.json({ data: base64 })

  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
