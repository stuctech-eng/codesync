import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { getConversation, deleteConversation, renameConversation } from "@/lib/conversations"

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

// PATCH /api/conversations/:id — hernoemen (Master Plan v1.5-uitbreiding)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = requireAuth(req)
  if (authError) return authError

  const { id } = await params

  let body: { title?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const title = body.title?.trim()
  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 })
  }
  if (title.length > 100) {
    return NextResponse.json({ error: "title mag maximaal 100 tekens zijn" }, { status: 400 })
  }

  const conversation = await getConversation(id)
  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 })
  }

  await renameConversation(id, title)
  return NextResponse.json({ status: "renamed", title })
}
