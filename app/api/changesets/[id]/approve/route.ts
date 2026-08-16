import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { PROJECTS } from "@/lib/projects"
import { getChangeset, approveChangeset } from "@/lib/changesets"

// POST /api/changesets/:id/approve
//
// Dit is HET moment waarop een gebruiker expliciet besluit dat een door
// Claude voorgesteld wijzigingsvoorstel daadwerkelijk naar GitHub mag.
// Alle 6 audit-bevindingen (atomaire claim, re-validatie, concurrency-
// check, idempotentie, etc.) zitten in approveChangeset() zelf
// (lib/changesets.ts) — deze route is bewust dun, puur routing + auth.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = requireAuth(req)
  if (authError) return authError

  const { id } = await params

  const changeset = await getChangeset(id)
  if (!changeset) {
    return NextResponse.json({ error: "Changeset not found" }, { status: 404 })
  }

  const project = PROJECTS.find(p => p.slug === changeset.projectSlug)
  if (!project) {
    return NextResponse.json({ error: `Project "${changeset.projectSlug}" not found` }, { status: 404 })
  }

  const result = await approveChangeset(id, project)

  switch (result.outcome) {
    case "applied":
      return NextResponse.json({ status: "applied", commitSha: result.commitSha })

    case "stale":
      return NextResponse.json(
        {
          status: "stale",
          error: "GitHub is gewijzigd sinds dit voorstel werd gemaakt — niet toegepast om een nieuwere wijziging niet per ongeluk te overschrijven.",
          currentSha: result.currentSha,
          expectedSha: result.expectedSha
        },
        { status: 409 }
      )

    case "invalid":
      return NextResponse.json(
        { status: "invalid", error: "Changeset bevat ongeldige bestanden", details: result.errors },
        { status: 422 }
      )

    case "already_processed":
      return NextResponse.json(
        { status: result.status, error: `Deze changeset is al verwerkt (status: ${result.status})` },
        { status: 409 }
      )

    case "not_found":
      return NextResponse.json({ error: "Changeset not found" }, { status: 404 })

    case "failed":
      return NextResponse.json({ status: "failed", error: result.error }, { status: 500 })
  }
}
