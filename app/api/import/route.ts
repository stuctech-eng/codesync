import { NextRequest, NextResponse } from "next/server"
import JSZip from "jszip"

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get("zip") as File | null

    if (!file) {
      return NextResponse.json({ error: "No ZIP file provided" }, { status: 400 })
    }

    if (!file.name.endsWith(".zip")) {
      return NextResponse.json({ error: "File must be a .zip" }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const zip = await JSZip.loadAsync(bytes)
    const files: { path: string; content: string }[] = []

    for (const [path, entry] of Object.entries(zip.files)) {
      // Skip directories, macOS metadata, hidden files
      if (entry.dir) continue
      if (path.startsWith("__MACOSX")) continue
      if (path.includes("/.")) continue

      try {
        const content = await entry.async("string")
        files.push({ path, content })
      } catch {
        // Skip binary or unreadable files
        continue
      }
    }

    return NextResponse.json({
      files,
      count: files.length,
      filename: file.name
    })

  } catch (error) {
    return NextResponse.json(
      { error: `Import failed: ${String(error)}` },
      { status: 500 }
    )
  }
}
