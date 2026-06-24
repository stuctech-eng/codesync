import { NextRequest, NextResponse } from "next/server"
import { batchCommit } from "@/lib/github"
import { PROJECTS } from "@/lib/projects"

export async function POST(req: NextRequest) {
  try {
    const { projectSlug, files, message } = await req.json()

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

    const commitMessage = message ?? `Claude import — ${new Date().toISOString()}`
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
      filesCommitted: files.length
    })

  } catch (error) {
    return NextResponse.json(
      { error: `Sync failed: ${String(error)}` },
      { status: 500 }
    )
  }
}
