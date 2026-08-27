import { NextRequest, NextResponse } from "next/server"
import { PROJECTS } from "@/lib/projects"
import { getDropboxToken } from "@/lib/dropbox"
import { requireAuth } from "@/lib/auth"

const DROPBOX_FOLDER = "/CodeSyncApp"

export async function GET(req: NextRequest) {
  const authError = requireAuth(req)
  if (authError) return authError

  try {
    const res = await fetch("https://api.dropboxapi.com/2/files/list_folder", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${await getDropboxToken()}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        path: DROPBOX_FOLDER,
        recursive: false,
        include_deleted: false
      })
    })

    if (!res.ok) {
      const err = await res.text()
      // Finding 2 fix: geen tokenfragment meer in de foutrespons
      return NextResponse.json({
        error: err,
        status: res.status,
        folder: DROPBOX_FOLDER
      }, { status: 500 })
    }

    const data = await res.json()
    const entries = data.entries ?? []

    const zips = entries
      .filter((e: any) => e[".tag"] === "file" && e.name.endsWith(".zip"))
      .map((e: any) => {
        const name = e.name.toLowerCase()
        // Bugfix: .find() pakte de EERSTE match in array-volgorde, niet
        // de langste/specifiekste. Bij overlappende slugs (bijv.
        // "coachos" vs "coachos-connect-ios") werd een ZIP voor het
        // specifiekere project altijd fout aan het kortere, generiekere
        // project gekoppeld -- puur omdat dat toevallig eerder in de
        // PROJECTS-array staat. Nu: alle geldige kandidaten verzamelen,
        // en de kandidaat met de LANGSTE (dus specifiekste) slug kiezen.
        const nameClean = name.replace(/-/g, "")
        const candidates = PROJECTS.filter(p => {
          const slug = p.slug.toLowerCase().replace(/-/g, "")
          return nameClean.startsWith(slug)
        })
        const project = candidates.length > 0
          ? candidates.reduce((longest, current) =>
              current.slug.length > longest.slug.length ? current : longest
            )
          : undefined
        const isFix = /fix|hotfix|patch/.test(name)

        return {
          name: e.name,
          path: e.path_lower,
          size: e.size,
          modified: e.server_modified,
          projectSlug: project?.slug ?? null,
          projectName: project?.name ?? null,
          isFix,
          isFeature: /feature|update|refactor|release/.test(name),
          priority: isFix ? "high" : "normal"
        }
      })

    const queues: Record<string, any[]> = {}
    const unmatched: any[] = []

    for (const zip of zips) {
      if (zip.projectSlug) {
        if (!queues[zip.projectSlug]) queues[zip.projectSlug] = []
        queues[zip.projectSlug].push(zip)
      } else {
        unmatched.push(zip)
      }
    }

    for (const slug of Object.keys(queues)) {
      queues[slug].sort((a: any, b: any) => {
        if (a.isFix && !b.isFix) return -1
        if (!a.isFix && b.isFix) return 1
        return new Date(a.modified).getTime() - new Date(b.modified).getTime()
      })
    }

    return NextResponse.json({ queues, unmatched, total: zips.length })

  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
