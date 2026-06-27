import { NextRequest, NextResponse } from "next/server"
import { batchCommit, getCommitCount, deleteFiles, createTag, getTags } from "@/lib/github"
import { PROJECTS } from "@/lib/projects"

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
  try {
    const { projectSlug, files, filesToDelete, zipName } = await req.json()

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

    let commitSha = null
    let deleteResult = null

    // Push nieuwe + gewijzigde bestanden
    if (files && files.length > 0) {
      commitSha = await batchCommit(
        project.githubRepo,
        project.branch,
        files,
        commitMessage
      )
    }

    // Verwijder geselecteerde bestanden
    if (filesToDelete && filesToDelete.length > 0) {
      deleteResult = await deleteFiles(
        project.githubRepo,
        project.branch,
        filesToDelete
      )
    }

    // Intelligente auto-tagging
    let autoTag = null
    const allChangedPaths = [
      ...(files?.map((f: { path: string }) => f.path) ?? []),
      ...(filesToDelete ?? [])
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
      filesCommitted: files?.length ?? 0,
      filesDeleted: deleteResult?.success ?? [],
      deletesFailed: deleteResult?.failed ?? [],
      autoTag
    })

  } catch (error) {
    return NextResponse.json(
      { error: `Sync failed: ${String(error)}` },
      { status: 500 }
    )
  }
}
