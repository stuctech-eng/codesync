import { NextRequest, NextResponse } from "next/server"
import JSZip from "jszip"
import { requireAuth } from "@/lib/auth"

export async function POST(req: NextRequest) {
  const authError = requireAuth(req)
  if (authError) return authError

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
    const skipped: { path: string; reason: string }[] = []

    for (const [path, entry] of Object.entries(zip.files)) {
      // Skip directories, macOS metadata, hidden files
      if (entry.dir) continue
      if (path.startsWith("__MACOSX")) continue
      if (path.includes("/.")) continue

      try {
        const content = await entry.async("string")

        // Fase 1 — Finding 5 fix: JSZip's "string"-modus decodeert als
        // UTF-8 en gooit niet altijd een fout bij binaire inhoud — in
        // plaats daarvan vult het ongeldige bytes op met het
        // vervangingsteken U+FFFD. Dat is het signaal dat dit bestand
        // waarschijnlijk binair is en NIET stilzwijgend als (corrupte)
        // tekst moet worden doorgestuurd.
        if (content.includes("\uFFFD")) {
          skipped.push({
            path,
            reason: "Waarschijnlijk een binair bestand (afbeelding, font, etc.) — nog niet ondersteund via ZIP-import"
          })
          continue
        }

        files.push({ path, content })
      } catch (e) {
        skipped.push({ path, reason: `Kon niet worden gelezen: ${String(e)}` })
        continue
      }
    }

    return NextResponse.json({
      files,
      count: files.length,
      filename: file.name,
      skipped
    })

  } catch (error) {
    return NextResponse.json(
      { error: `Import failed: ${String(error)}` },
      { status: 500 }
    )
  }
}
