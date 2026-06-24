import { NextRequest, NextResponse } from "next/server"
import { getGitHubSnapshot } from "@/lib/snapshot"
import { calculateDiff } from "@/lib/diff"
import { PROJECTS } from "@/lib/projects"

export async function POST(req: NextRequest) {
  try {
    const { projectSlug, files } = await req.json()

    if (!projectSlug || !files) {
      return NextResponse.json(
        { error: "projectSlug and files are required" },
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

    const githubSnapshot = await getGitHubSnapshot(project)
    const diff = calculateDiff(githubSnapshot.files, files)

    return NextResponse.json({
      diff,
      snapshotSource: githubSnapshot.source,
      isStale: githubSnapshot.isStale ?? false,
      snapshotAt: githubSnapshot.createdAt,
      summary: {
        new: diff.newFiles.length,
        modified: diff.modifiedFiles.length,
        deleted: diff.deletedFiles.length,
        unchanged: diff.unchanged.length
      }
    })

  } catch (error) {
    return NextResponse.json(
      { error: `Diff failed: ${String(error)}` },
      { status: 500 }
    )
  }
}
