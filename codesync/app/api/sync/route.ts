import { NextRequest, NextResponse } from "next/server"
import { batchCommit, getCommitCount } from "@/lib/github"
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
  // Verwijder .zip extensie en maak leesbaar
  const label = zipName
    .replace(/\.zip$/i, "")
    .replace(/[-_]/g, " ")
    .trim()

  const date = formatDate(new Date())
  return `${label} — ${version} — ${date}`
}

export async function POST(req: NextRequest) {
  try {
    const { projectSlug, files, zipName } = await req.json()

    if (!projectSlug || !files || !Array.isArray(files)) {
      return NextResponse.json(
        { error: "projectSlug and files array are required" },
        { status: 400 }
      )
    }

    const project = PROJECTS.find(p => p.slug === projectSlug)
    if (!project) {
      return NextResponse.json(
        { error: `Project "${projectSlug}" not found` },
        { status: 404 }
      )
    }

    // Haal commit count op voor versienummer
    const commitCount = await getCommitCount(project.githubRepo, project.branch)
    const patch = commitCount + 1
    const version = `v1.0.${patch}`

    // Bouw commit message
    const label = zipName ?? "claude-import"
    const commitMessage = buildCommitMessage(label, version)

    const commitSha = await batchCommit(
      project.githubRepo,
      project.branch,
      files,
      commitMessage
    )

    return NextResponse.json({
      success: true,
      commitSha,
      message: commitMessage,
      version,
      filesCommitted: files.length
    })

  } catch (error) {
    return NextResponse.json(
      { error: `Sync failed: ${String(error)}` },
      { status: 500 }
    )
  }
}
