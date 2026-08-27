import { NextRequest, NextResponse } from "next/server"
import { createTag, getTags, getCommitCount, restoreTag, getCommitDetails } from "@/lib/github"
import { getDb } from "@/lib/firebase-admin"
import { PROJECTS } from "@/lib/projects"
import { requireAuth } from "@/lib/auth"

const BASE = "https://api.github.com"
const TOKEN = process.env.GITHUB_PAT!
const headers = {
  Authorization: `Bearer ${TOKEN}`,
  "Content-Type": "application/json",
  Accept: "application/vnd.github+json"
}

async function getLatestCommitSha(repo: string, branch: string): Promise<string | null> {
  try {
    const res = await fetch(`${BASE}/repos/${repo}/git/refs/heads/${branch}`, { headers })
    if (!res.ok) return null
    const data = await res.json()
    return data.object?.sha ?? null
  } catch {
    return null
  }
}

// GET — haal tags op per project, inclusief eventuele notities uit Firestore
export async function GET(req: NextRequest) {
  const authError = requireAuth(req)
  if (authError) return authError

  const slug = req.nextUrl.searchParams.get("slug")
  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 })

  const project = PROJECTS.find(p => p.slug === slug)
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 })

  const tags = await getTags(project.githubRepo)

  // Notities ophalen — 1 Firestore call, geen extra GitHub-calls per tag
  let notes: Record<string, string> = {}
  try {
    const db = getDb()
    const snapshot = await db.collection("tag-notes").where("projectSlug", "==", slug).get()
    snapshot.forEach(doc => {
      const data = doc.data()
      if (data?.tag && data?.note) notes[data.tag] = data.note
    })
  } catch {
    // Stil falen — herstelpunten werken ook zonder notities
  }

  // Master Plan v1.6: naast de optionele handmatige notitie, ALTIJD het
  // echte commit-bericht meesturen -- zodat een herstelpunt ook zonder
  // handmatige notitie duidelijk laat zien wat het bevat (voorheen: kaal
  // versienummer, geen idee wat erin zat zonder door te klikken).
  const tagsWithDetails = await Promise.all(
    tags.map(async t => {
      const commit = await getCommitDetails(project.githubRepo, t.sha)
      return {
        ...t,
        note: notes[t.name] ?? null,
        commitMessage: commit?.message.split("\n")[0] ?? null,
        filesChanged: commit?.files.length ?? null
      }
    })
  )

  return NextResponse.json({ tags: tagsWithDetails })
}

// PUT — herstel naar tag
export async function PUT(req: NextRequest) {
  const authError = requireAuth(req)
  if (authError) return authError

  try {
    const { projectSlug, tag } = await req.json()

    const project = PROJECTS.find(p => p.slug === projectSlug)
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 })

    const commitSha = await restoreTag(project.githubRepo, project.branch, tag)

    return NextResponse.json({ success: true, commitSha, tag })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

// POST — maak herstelpunt aan, met optionele notitie (opgeslagen in Firestore)
export async function POST(req: NextRequest) {
  const authError = requireAuth(req)
  if (authError) return authError

  try {
    const { projectSlug, note } = await req.json()

    const project = PROJECTS.find(p => p.slug === projectSlug)
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 })

    // Haal latest commit SHA op via branch ref
    const sha = await getLatestCommitSha(project.githubRepo, project.branch)
    if (!sha) return NextResponse.json({ error: "Kan commit SHA niet ophalen" }, { status: 500 })

    // Versienummer op basis van commit count
    const commitCount = await getCommitCount(project.githubRepo, project.branch)
    const tag = `v1.0.${commitCount}`

    const date = new Date().toLocaleDateString("nl-NL", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    })
    const message = `Herstelpunt ${tag} — ${date}`

    const success = await createTag(project.githubRepo, sha, tag, message)

    if (!success) {
      return NextResponse.json({ error: "Tag aanmaken mislukt" }, { status: 500 })
    }

    // Notitie opslaan — optioneel, faalt de tag zelf niet als dit misgaat
    if (note && typeof note === "string" && note.trim()) {
      try {
        const db = getDb()
        await db.collection("tag-notes").doc(`${projectSlug}__${tag}`).set({
          projectSlug,
          tag,
          note: note.trim().slice(0, 100),
          createdAt: new Date().toISOString()
        })
      } catch {
        // Stil falen — de tag zelf is al aangemaakt
      }
    }

    return NextResponse.json({ success: true, tag, message })

  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
