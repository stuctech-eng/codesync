import { NextRequest, NextResponse } from "next/server"
import { batchCommit, getCommitCount, createTag, getTags, ConcurrencyConflictError } from "@/lib/github"
import { PROJECTS } from "@/lib/projects"
import { requireAuth } from "@/lib/auth"

function formatDate(date: Date): string {
  return date.toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  })
}

function buildCommitMessage(zipName: string, version: string): string {
  const label = zipName
    .replace(/\.zip$/i, "")
    .replace(/[-_]/g, " ")
    .trim()
  const date = formatDate(new Date())
  return `${label} — ${version} — ${date}`
}

function shouldAutoTag(zipName: string, fileCount: number, changedPaths: string[]): boolean {
  const name = zipName.toLowerCase()

  // Geen tag bij fixes, docs, config
  if (/fix|hotfix|patch|docs|config|test/.test(name)) return false

  // Wel tag bij features, updates, refactors
  if (/feature|update|refactor|release/.test(name)) return true

  // Kern bestanden gewijzigd + meer dan 2 bestanden
  const kernFiles = changedPaths.filter(p =>
    p.startsWith("lib/") || p.startsWith("app/api/") || p.startsWith("types/")
  )
  if (kernFiles.length > 0 && fileCount > 2) return true

  // 5+ bestanden gewijzigd
  if (fileCount >= 5) return true

  return false
}

async function cleanupOldTags(repo: string, maxTags = 10): Promise<void> {
  try {
    const tags = await getTags(repo)
    if (tags.length <= maxTags) return

    const BASE = "https://api.github.com"
    const TOKEN = process.env.GITHUB_PAT!
    const headers = {
      Authorization: `Bearer ${TOKEN}`,
      Accept: "application/vnd.github+json"
    }

    // Verwijder oudste tags (laatste in de lijst)
    const toDelete = tags.slice(maxTags)
    for (const tag of toDelete) {
      await fetch(`${BASE}/repos/${repo}/git/refs/tags/${tag.name}`, {
        method: "DELETE",
        headers
      })
    }
  } catch {
    // stil falen — cleanup is niet kritiek
  }
}

export async function POST(req: NextRequest) {
  const authError = requireAuth(req)
  if (authError) return authError

  try {
    const { projectSlug, files, filesToDelete, zipName, expectedBaseSha } = await req.json()

    if (!projectSlug) {
      return NextResponse.json({ error: "projectSlug is required" }, { status: 400 })
    }

    const project = PROJECTS.find(p => p.slug === projectSlug)
    if (!project) {
      return NextResponse.json(
        { error: `Project "${projectSlug}" not found` },
        { status: 404 }
      )
    }

    const commitCount = await getCommitCount(project.githubRepo, project.branch)
    const patch = commitCount + 1
    const version = `v1.0.${patch}`
    const label = zipName ?? "claude-import"
    const commitMessage = buildCommitMessage(label, version)

    const filesToPush = files ?? []
    const pathsToDelete = filesToDelete ?? []

    let commitSha: string | null = null

    // Fase 1 — Finding 3 fix: nieuwe/gewijzigde bestanden EN verwijderingen
    // gaan nu samen in één atomic batchCommit-call (één tree, één commit)
    // i.p.v. twee losse mechanismen die bij gedeeltelijk falen een
    // tussentoestand konden achterlaten.
    if (filesToPush.length > 0 || pathsToDelete.length > 0) {
      commitSha = await batchCommit(
        project.githubRepo,
        project.branch,
        filesToPush,
        commitMessage,
        {
          deletePaths: pathsToDelete,
          // Fase 1 — Finding 4 fix: alleen meegeven als de client een
          // concurrency-anker heeft (bijv. uit de diff-stap). Optioneel,
          // zodat bestaande aanroepen zonder dit veld blijven werken.
          expectedBaseSha: expectedBaseSha || undefined
        }
      )
    }

    // Intelligente auto-tagging
    let autoTag = null
    const allChangedPaths = [
      ...filesToPush.map((f: { path: string }) => f.path),
      ...pathsToDelete
    ]
    const totalChanged = allChangedPaths.length

    if (commitSha && shouldAutoTag(label, totalChanged, allChangedPaths)) {
      const tagName = `auto-${version}`
      const tagMessage = `Auto-herstelpunt ${version} — ${formatDate(new Date())}`
      const success = await createTag(project.githubRepo, commitSha, tagName, tagMessage)
      if (success) {
        autoTag = tagName
        // Opruimen — max 10 tags bewaren
        await cleanupOldTags(project.githubRepo, 10)
      }
    }

    return NextResponse.json({
      success: true,
      commitSha,
      message: commitMessage,
      version,
      filesCommitted: filesToPush.length,
      filesDeleted: commitSha ? pathsToDelete : [],
      autoTag
    })

  } catch (error) {
    if (error instanceof ConcurrencyConflictError) {
      return NextResponse.json(
        {
          error: "CONCURRENCY_CONFLICT",
          message: "GitHub is gewijzigd sinds je laatste check. Ververs en probeer opnieuw.",
          currentSha: error.currentSha,
          expectedSha: error.expectedSha
        },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: `Sync failed: ${String(error)}` },
      { status: 500 }
    )
  }
}
