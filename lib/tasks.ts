import { getDb } from "@/lib/firebase-admin"

// Task-model (Master Plan v1.2, sectie 3+6). Fase 1: data-model + API.
// Fase 2: task-type "chat" — GitHub Actions voert de volledige Claude-
// tool-loop uit buiten Vercel's tijdslimiet, en schrijft het resultaat
// hier terug.

export type TaskStatus = "queued" | "running" | "completed" | "failed" | "cancelled"
export type TaskType = "test" | "build" | "typecheck" | "custom" | "chat"

export type Task = {
  id: string
  projectSlug: string
  conversationId?: string
  type: TaskType
  command?: string
  // Specifiek voor type "chat" — het gebruikersbericht dat de GitHub
  // Actions-worker moet verwerken, en het resultaat (tekst + gebruikte
  // tools) zodra de taak is afgerond.
  message?: string
  // Screenshot-ondersteuning (Master Plan v1.5-uitbreiding). Let op:
  // base64-afbeeldingen tellen mee in Firestore's 1MB-documentlimiet --
  // de client verkleint/comprimeert al vóór het versturen (max 1568px,
  // JPEG-kwaliteit 0.82), dus dit blijft ruim binnen de marge.
  image?: { base64: string; mediaType: string }
  answer?: string
  toolActivity?: { tool: string; input: Record<string, unknown> }[]
  status: TaskStatus
  createdAt: string
  startedAt?: string
  completedAt?: string
  result?: string
  error?: string
}

export async function createTask(input: {
  projectSlug: string
  type: TaskType
  command?: string
  conversationId?: string
  message?: string
  image?: { base64: string; mediaType: string }
}): Promise<Task> {
  const db = getDb()
  const now = new Date().toISOString()

  const task: Omit<Task, "id"> = {
    projectSlug: input.projectSlug,
    type: input.type,
    status: "queued",
    createdAt: now,
    ...(input.command ? { command: input.command } : {}),
    ...(input.conversationId ? { conversationId: input.conversationId } : {}),
    ...(input.message ? { message: input.message } : {}),
    ...(input.image ? { image: input.image } : {})
  }

  const ref = await db.collection("tasks").add(task)
  return { id: ref.id, ...task }
}

export async function getTask(id: string): Promise<Task | null> {
  const db = getDb()
  const doc = await db.collection("tasks").doc(id).get()
  if (!doc.exists) return null
  return { id: doc.id, ...(doc.data() as Omit<Task, "id">) }
}

export async function listTasks(projectSlug: string): Promise<Task[]> {
  const db = getDb()
  // Bewust geen .orderBy() in combinatie met .where() op een ander veld
  // (zelfde les als bij conversations.ts — voorkomt de noodzaak van een
  // samengestelde Firestore-index). Sorteren gebeurt in JavaScript.
  const snap = await db.collection("tasks")
    .where("projectSlug", "==", projectSlug)
    .limit(50)
    .get()

  const tasks = snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Task, "id">) }))
  return tasks.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function updateTaskStatus(
  id: string,
  status: TaskStatus,
  extra: {
    result?: string
    error?: string
    answer?: string
    toolActivity?: { tool: string; input: Record<string, unknown> }[]
  } = {}
): Promise<void> {
  const db = getDb()
  const update: Record<string, unknown> = { status }

  if (status === "running") update.startedAt = new Date().toISOString()
  if (status === "completed" || status === "failed" || status === "cancelled") {
    update.completedAt = new Date().toISOString()
  }
  if (extra.result !== undefined) update.result = extra.result
  if (extra.error !== undefined) update.error = extra.error
  if (extra.answer !== undefined) update.answer = extra.answer
  if (extra.toolActivity !== undefined) update.toolActivity = extra.toolActivity

  await db.collection("tasks").doc(id).update(update)
}
