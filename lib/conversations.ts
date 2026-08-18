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

export async function appendMessage(
  conversationId: string,
  message: StoredMessage,
  options: { isFirstMessage?: boolean } = {}
): Promise<void> {
  const db = getDb()
  const convRef = db.collection("conversations").doc(conversationId)

  const update: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
    lastMessagePreview: message.content.slice(0, 120)
  }

  // Titel afleiden bij het eerste bericht — de aanroeper geeft dit door
  // (bekend uit een eerdere getMessages()-aanroep), zodat we hier geen
  // extra Firestore-read hoeven te doen om het te checken.
  if (options.isFirstMessage && message.role === "user") {
    update.title = message.content.slice(0, 60)
  }

  // Snelheidsoptimalisatie (Master Plan v1.3 — timing-onderzoek wees uit
  // dat auth+Firestore-setup 1,6s kostte): het toevoegen van het bericht
  // en het bijwerken van de conversatie zijn onafhankelijke schrijf-
  // operaties naar verschillende Firestore-paden. Voorheen gebeurde dit
  // na elkaar, mét een extra 'get()' ertussenin om te checken of de titel
  // moest worden aangepast (in totaal 3 sequentiële round-trips). Nu:
  // parallel uitvoeren, zonder de tussentijdse get — scheelt twee volledige
  // netwerk-round-trips per bericht.
  await Promise.all([
    convRef.collection("messages").add(message),
    convRef.update(update)
  ])
}

// Master Plan v1.5, Niveau 2-uitbreiding: een gesprek verwijderen. Ruimt
// ook de berichten-subcollectie op — Firestore verwijdert een
// subcollectie niet automatisch mee met het bovenliggende document.
export async function deleteConversation(id: string): Promise<void> {
  const db = getDb()
  const convRef = db.collection("conversations").doc(id)

  const messagesSnap = await convRef.collection("messages").get()
  const batch = db.batch()
  messagesSnap.docs.forEach(doc => batch.delete(doc.ref))
  batch.delete(convRef)

  await batch.commit()
}
