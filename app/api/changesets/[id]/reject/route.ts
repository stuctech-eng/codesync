import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { rejectChangeset } from "@/lib/changesets"

// POST /api/changesets/:id/reject
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = requireAuth(req)
  if (authError) return authError

  const { id } = await params
  const result = await rejectChangeset(id)

  if (!result.ok) {
    return NextResponse.json(
      { error: "Kon changeset niet afwijzen (bestaat niet, of al verwerkt)" },
      { status: 409 }
    )
  }

  return NextResponse.json({ status: "rejected" })
}
