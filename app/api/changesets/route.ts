import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { listChangesets, getChangeset } from "@/lib/changesets"

// GET ?projectSlug=X → lijst changesets voor een project
// GET ?id=X          → één changeset
export async function GET(req: NextRequest) {
  const authError = requireAuth(req)
  if (authError) return authError

  const id = req.nextUrl.searchParams.get("id")
  const projectSlug = req.nextUrl.searchParams.get("projectSlug")

  if (id) {
    const changeset = await getChangeset(id)
    if (!changeset) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json({ changeset })
  }

  if (projectSlug) {
    const changesets = await listChangesets(projectSlug)
    return NextResponse.json({ changesets })
  }

  return NextResponse.json({ error: "id or projectSlug is required" }, { status: 400 })
}
