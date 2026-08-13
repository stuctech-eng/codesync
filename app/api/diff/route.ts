import { NextRequest, NextResponse } from "next/server"
import { getGitHubTree } from "@/lib/snapshot"
import { calculateDiff } from "@/lib/diff"
import { PROJECTS } from "@/lib/projects"
import { getBranchHeadSha } from "@/lib/github"
import { requireAuth } from "@/lib/auth"

export async function POST(req: NextRequest) {
  const authError = requireAuth(req)
  if (authError) return authError

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

    const githubTree = await getGitHubTree(project)
    const diff = calculateDiff(githubTree, files)

    // Fase 1 — Finding 4: HEAD-SHA op moment van diff vastleggen, zodat
    // de client dit als concurrency-anker kan meesturen bij de push.
    const baseSha = await getBranchHeadSha(project.githubRepo, project.branch)

    return NextResponse.json({
      diff,
      snapshotSource: "github",
      isStale: false,
      snapshotAt: new Date().toISOString(),
      baseSha,
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
