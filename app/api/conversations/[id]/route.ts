import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { getConversation, deleteConversation } from "@/lib/conversations"

// DELETE /api/conversations/:id — verwijdert een gesprek volledig
// (Master Plan v1.5, Niveau 2-uitbreiding). Verwijdert ook de
// berichten-subcollectie (zie deleteConversation() in lib/conversations.ts).
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = requireAuth(req)
  if (authError) return authError

  const { id } = await params

  const conversation = await getConversation(id)
  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 })
  }

  await deleteConversation(id)
  return NextResponse.json({ status: "deleted" })
}
