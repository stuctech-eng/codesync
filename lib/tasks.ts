import { getDb } from "@/lib/firebase-admin"

// Task-model (Master Plan v1.2, sectie 3). Fase 1: puur data-model + API.
// Er wordt in Fase 1 nog NIETS echt uitgevoerd — GitHub Actions komt pas
// in Fase 2, na een apart, expliciet akkoord.

export type TaskStatus = "queued" | "running" | "completed" | "failed" | "cancelled"
export type TaskType = "test" | "build" | "typecheck" | "custom"

export type Task = {
  id: string
  projectSlug: string
  conversationId?: string
  type: TaskType
  command?: string
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
}): Promise<Task> {
  const db = getDb()
  const now = new Date().toISOString()

  const task: Omit<Task, "id"> = {
    projectSlug: input.projectSlug,
    type: input.type,
    status: "queued",
    createdAt: now,
    ...(input.command ? { command: input.command } : {}),
    ...(input.conversationId ? { conversationId: input.conversationId } : {})
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
  extra: { result?: string; error?: string } = {}
): Promise<void> {
  const db = getDb()
  const update: Record<string, unknown> = { status }

  if (status === "running") update.startedAt = new Date().toISOString()
  if (status === "completed" || status === "failed" || status === "cancelled") {
    update.completedAt = new Date().toISOString()
  }
  if (extra.result !== undefined) update.result = extra.result
  if (extra.error !== undefined) update.error = extra.error

  await db.collection("tasks").doc(id).update(update)
}
