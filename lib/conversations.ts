import { getDb } from "@/lib/firebase-admin"

// Conversation model (Master Plan v1.1, sectie 7).
//
// Belangrijke regel (correctie 6 uit de laatste audit): volledige
// bestandsinhoud die via get_file_contents binnenkomt, wordt NIET
// permanent bewaard — alleen een compacte referentie (welke tool, welke
// paden). De inhoud zelf kan bij een volgend bericht opnieuw worden
// opgehaald. Dit voorkomt dat conversatie-documenten Firestore's limiet
// van 1MB per document naderen, en houdt de geschiedenis compact.

export type ToolActivity = {
  tool: string
  input: Record<string, unknown>
}

export type StoredMessage = {
  role: "user" | "assistant"
  content: string
  toolActivity?: ToolActivity[]
  createdAt: string
}

export type ConversationSummary = {
  id: string
  projectSlug: string
  title: string
  createdAt: string
  updatedAt: string
  lastMessagePreview: string
}

export async function createConversation(projectSlug: string): Promise<string> {
  const db = getDb()
  const now = new Date().toISOString()
  const ref = await db.collection("conversations").add({
    projectSlug,
    title: "Nieuw gesprek",
    createdAt: now,
    updatedAt: now,
    lastMessagePreview: ""
  })
  return ref.id
}

export async function getConversation(id: string): Promise<ConversationSummary | null> {
  const db = getDb()
  const doc = await db.collection("conversations").doc(id).get()
  if (!doc.exists) return null
  const data = doc.data()!
  return {
    id: doc.id,
    projectSlug: data.projectSlug,
    title: data.title,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    lastMessagePreview: data.lastMessagePreview ?? ""
  }
}

export async function listConversations(projectSlug: string): Promise<ConversationSummary[]> {
  const db = getDb()
  // Bewust GEEN .orderBy() in combinatie met .where() op een ander veld —
  // dat vereist een samengestelde Firestore-index die niet automatisch
  // bestaat, en de query faalt dan stil (ving dit op als "lege chat" bug).
  // Sorteren gebeurt hieronder gewoon in JavaScript i.p.v. in Firestore.
  const snap = await db.collection("conversations")
    .where("projectSlug", "==", projectSlug)
    .limit(20)
    .get()

  const conversations = snap.docs.map(d => {
    const data = d.data()
    return {
      id: d.id,
      projectSlug: data.projectSlug,
      title: data.title,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      lastMessagePreview: data.lastMessagePreview ?? ""
    }
  })

  return conversations.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function getMessages(conversationId: string): Promise<StoredMessage[]> {
  const db = getDb()
  const snap = await db.collection("conversations").doc(conversationId)
    .collection("messages")
    .orderBy("createdAt", "asc")
    .get()
  return snap.docs.map(d => d.data() as StoredMessage)
}

export async function appendMessage(conversationId: string, message: StoredMessage): Promise<void> {
  const db = getDb()
  const convRef = db.collection("conversations").doc(conversationId)
  await convRef.collection("messages").add(message)

  const update: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
    lastMessagePreview: message.content.slice(0, 120)
  }

  // Bij het eerste bericht: een korte titel afleiden
  const existing = await convRef.get()
  if (existing.exists && existing.data()?.title === "Nieuw gesprek" && message.role === "user") {
    update.title = message.content.slice(0, 60)
  }

  await convRef.update(update)
}
