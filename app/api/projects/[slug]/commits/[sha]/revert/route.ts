import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { PROJECTS } from "@/lib/projects"
import { getBranchHeadSha } from "@/lib/github"
import { buildRevertPlan, createChangeset } from "@/lib/changesets"

// POST /api/projects/:slug/commits/:sha/revert — bouwt een changeset-
// voorstel dat PRECIES ÉÉN commit terugdraait (Master Plan v1.6).
// Maakt NIETS direct ongedaan -- levert alleen een voorstel op dat via
// het bestaande review-scherm goedgekeurd moet worden, net als elke
// andere changeset.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; sha: string }> }
) {
  const authError = requireAuth(req)
  if (authError) return authError

  const { slug, sha } = await params
  const project = PROJECTS.find(p => p.slug === slug)
  if (!project) {
    return NextResponse.json({ error: `Project "${slug}" not found` }, { status: 404 })
  }

  const plan = await buildRevertPlan(project, sha)

  switch (plan.outcome) {
    case "commit_not_found":
      return NextResponse.json({ error: "Commit niet gevonden" }, { status: 404 })
    case "merge_commit":
      return NextResponse.json({ error: "Merge-commits kunnen niet automatisch worden teruggedraaid." }, { status: 422 })
    case "no_parent":
      return NextResponse.json({ error: plan.reason }, { status: 422 })
    case "nothing_to_revert":
      return NextResponse.json({
        error: "Niets om terug te draaien — alle bestanden zijn sindsdien alweer aangepast.",
        conflicts: plan.conflicts
      }, { status: 409 })
    case "ok": {
      const baseCommitSha = await getBranchHeadSha(project.githubRepo, project.branch)
      const changeset = await createChangeset({
        projectSlug: slug,
        files: plan.files,
        explanation: `Herstel wijziging: "${plan.commitMessage}" (${sha.slice(0, 7)})`,
        baseCommitSha
      })
      return NextResponse.json({
        changesetId: changeset.id,
        conflicts: plan.conflicts,
        filesReverted: plan.files.length
      })
    }
  }
}
