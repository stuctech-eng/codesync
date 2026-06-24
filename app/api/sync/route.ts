import { NextRequest, NextResponse } from "next/server"
import { batchCommit, getCommitCount, deleteFiles } from "@/lib/github"
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

    return NextResponse.json({
      success: true,
      commitSha,
      message: commitMessage,
      version,
      filesCommitted: files?.length ?? 0,
      filesDeleted: deleteResult?.success ?? [],
      deletesFailed: deleteResult?.failed ?? []
    })

  } catch (error) {
    return NextResponse.json(
      { error: `Sync failed: ${String(error)}` },
      { status: 500 }
    )
  }
}
