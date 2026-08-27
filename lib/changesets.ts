import { getDb } from "@/lib/firebase-admin"
import { isValidProjectPath } from "@/lib/path-validation"
import { isProtectedFile } from "@/lib/protected-files"
import {
  batchCommit,
  getBranchHeadSha,
  getCommitDetails,
  getFileContents,
  ConcurrencyConflictError
} from "@/lib/github"
import type { Project } from "@/types"

// Changeset-model (Master Plan v1.3, Deel B / Taak B).
//
// Harde grens, ongewijzigd sinds de allereerste audit: Claude stelt een
// wijziging voor via prepare_changeset — dat schrijft ALLEEN dit
// Firestore-document, nooit iets naar GitHub. Alleen een expliciete
// gebruikers-approval via approveChangeset() kan dat doen.

export type ChangesetFileAction = "create" | "modify" | "delete"

export type ChangesetFile = {
  path: string
  action: ChangesetFileAction
  content?: string // vereist bij create/modify, genegeerd bij delete
}

export type ChangesetStatus =
  | "proposed"
  | "approving"
  | "applied"
  | "rejected"
  | "stale"
  | "failed"

export type Changeset = {
  id: string
  projectSlug: string
  conversationId?: string
  baseCommitSha: string | null
  files: ChangesetFile[]
  explanation: string
  status: ChangesetStatus
  createdAt: string
  appliedCommitSha?: string
  appliedAt?: string
  error?: string
}

// Audit-bevinding 5: vaste groottelimiet, zelfde soort grens als
// get_file_contents (max. 10 paden) — voorkomt een onbedoeld enorme
// changeset.
export const MAX_CHANGESET_FILES = 15

export type ChangesetValidationError = { path: string; reason: string }

// Audit-bevinding 2: padvalidatie EN protected-files-check gelden voor
// ALLE drie de acties (create/modify/delete) — geen uitzondering voor
// delete, want een delete-actie zou anders een protected file als
// ".env" kunnen proberen te verwijderen.
export function validateChangesetFiles(files: ChangesetFile[]): ChangesetValidationError[] {
  const errors: ChangesetValidationError[] = []

  if (files.length === 0) {
    errors.push({ path: "(geen bestanden)", reason: "Een changeset moet minstens 1 bestand bevatten" })
    return errors
  }

  if (files.length > MAX_CHANGESET_FILES) {
    errors.push({
      path: "(te veel bestanden)",
      reason: `Maximaal ${MAX_CHANGESET_FILES} bestanden per changeset, dit zijn er ${files.length}`
    })
    return errors
  }

  for (const file of files) {
    if (!isValidProjectPath(file.path)) {
      errors.push({ path: file.path, reason: "Ongeldig pad (bijv. path traversal of absoluut pad)" })
      continue
    }
    if (isProtectedFile(file.path)) {
      errors.push({ path: file.path, reason: "Dit bestand is beschermd en kan niet via een changeset worden gewijzigd" })
      continue
    }
    if ((file.action === "create" || file.action === "modify") && !file.content) {
      errors.push({ path: file.path, reason: `Actie '${file.action}' vereist inhoud (content)` })
    }
  }

  return errors
}

export async function createChangeset(input: {
  projectSlug: string
  conversationId?: string
  files: ChangesetFile[]
  explanation: string
  baseCommitSha: string | null
}): Promise<Changeset> {
  const db = getDb()
  const now = new Date().toISOString()

  const changeset: Omit<Changeset, "id"> = {
    projectSlug: input.projectSlug,
    baseCommitSha: input.baseCommitSha,
    files: input.files,
    explanation: input.explanation,
    status: "proposed",
    createdAt: now,
    ...(input.conversationId ? { conversationId: input.conversationId } : {})
  }

  const ref = await db.collection("changesets").add(changeset)
  return { id: ref.id, ...changeset }
}

export async function getChangeset(id: string): Promise<Changeset | null> {
  const db = getDb()
  const doc = await db.collection("changesets").doc(id).get()
  if (!doc.exists) return null
  return { id: doc.id, ...(doc.data() as Omit<Changeset, "id">) }
}

export async function listChangesets(projectSlug: string): Promise<Changeset[]> {
  const db = getDb()
  // Zelfde les als conversations.ts/tasks.ts: geen .orderBy() gecombineerd
  // met .where() — voorkomt de noodzaak van een samengestelde index.
  const snap = await db.collection("changesets")
    .where("projectSlug", "==", projectSlug)
    .limit(50)
    .get()
  const changesets = snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Changeset, "id">) }))
  return changesets.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export type ApproveResult =
  | { outcome: "applied"; commitSha: string }
  | { outcome: "stale"; currentSha: string; expectedSha: string }
  | { outcome: "invalid"; errors: ChangesetValidationError[] }
  | { outcome: "not_found" }
  | { outcome: "already_processed"; status: ChangesetStatus }
  | { outcome: "failed"; error: string }

// De kern van de approval-flow. Verwerkt ALLE 6 audit-bevindingen, in
// exact deze volgorde (audit-bevinding 3: server-side re-validatie,
// nooit blind vertrouwen op een eerder voorstel):
//
// 1. Changeset ophalen, bestaat/status checken
// 2. Padvalidatie + protected-files opnieuw uitvoeren (bevinding 2+3)
// 3. Atomaire Firestore-claim via runTransaction (bevinding 1)
// 4. Concurrency-check tegen de actuele GitHub-HEAD (bevinding 3+idempotentie-hulp)
// 5. batchCommit() — bestaande, geteste functie (hergebruik, geen nieuwe logica)
// 6. Resultaat opslaan; bij falen expliciet naar 'failed' i.p.v. vast te
//    blijven zitten in 'approving' (bevinding 4 — idempotentie/geen
//    permanent vastgelopen staat)
export async function approveChangeset(
  changesetId: string,
  project: Project
): Promise<ApproveResult> {
  const db = getDb()
  const changesetRef = db.collection("changesets").doc(changesetId)

  // Stap 1: ophalen (buiten de transactie — puur om vroeg een duidelijke
  // "not_found" te kunnen geven; de daadwerkelijke claim in stap 3 leest
  // opnieuw, binnen de transactie, en is de bron van waarheid).
  const initialDoc = await changesetRef.get()
  if (!initialDoc.exists) return { outcome: "not_found" }
  const initial = initialDoc.data() as Omit<Changeset, "id">

  if (initial.status !== "proposed") {
    // Idempotentie (bevinding 4): een changeset die al 'applied' is,
    // wordt niet opnieuw gecommit bij een dubbele/herhaalde approve-
    // aanroep (bijv. een client-side retry na een netwerkhapering).
    return { outcome: "already_processed", status: initial.status }
  }

  // Stap 2: server-side re-validatie — NOOIT vertrouwen op het eerder
  // voorgestelde zonder opnieuw te checken (bevinding 2+3).
  const validationErrors = validateChangesetFiles(initial.files)
  if (validationErrors.length > 0) {
    return { outcome: "invalid", errors: validationErrors }
  }

  // Stap 3: atomaire claim — lezen én de statuswijziging binnen dezelfde
  // Firestore-transactie (bevinding 1). Voorkomt dat twee gelijktijdige
  // approve-verzoeken allebei de check doorstaan.
  let claimed = false
  try {
    await db.runTransaction(async (tx) => {
      const doc = await tx.get(changesetRef)
      if (!doc.exists) throw new Error("not_found_in_transaction")
      const data = doc.data() as Omit<Changeset, "id">
      if (data.status !== "proposed") {
        throw new Error("already_processed_in_transaction")
      }
      tx.update(changesetRef, { status: "approving" })
    })
    claimed = true
  } catch (e) {
    if (e instanceof Error && e.message === "already_processed_in_transaction") {
      const fresh = await changesetRef.get()
      const freshData = fresh.data() as Omit<Changeset, "id">
      return { outcome: "already_processed", status: freshData.status }
    }
    return { outcome: "not_found" }
  }

  if (!claimed) return { outcome: "not_found" }

  // Stap 4: concurrency-check tegen de ACTUELE GitHub-HEAD — niet tegen
  // wat er ooit bij het voorstellen gold.
  const currentHeadSha = await getBranchHeadSha(project.githubRepo, project.branch)
  if (initial.baseCommitSha !== null && currentHeadSha !== initial.baseCommitSha) {
    await changesetRef.update({
      status: "stale",
      error: `GitHub is gewijzigd sinds dit voorstel (verwacht ${initial.baseCommitSha}, actueel ${currentHeadSha})`
    })
    return {
      outcome: "stale",
      currentSha: currentHeadSha ?? "onbekend",
      expectedSha: initial.baseCommitSha
    }
  }

  // Stap 5: hergebruik van de bestaande, geteste batchCommit() — geen
  // nieuwe GitHub-schrijflogica, dezelfde functie als de ZIP-sync-flow.
  try {
    const filesToCommit = initial.files
      .filter(f => f.action === "create" || f.action === "modify")
      .map(f => ({ path: f.path, content: f.content! }))
    const deletePaths = initial.files
      .filter(f => f.action === "delete")
      .map(f => f.path)

    // Changeset-ID in de commit-message (bevinding 4: idempotentie-hulp
    // bij een eventuele externe retry — herkenbaar in de git-historie
    // welke changeset tot welke commit leidde).
    const commitMessage = `CodeSync changeset ${changesetId} — ${initial.explanation}`.slice(0, 500)

    const commitSha = await batchCommit(
      project.githubRepo,
      project.branch,
      filesToCommit,
      commitMessage,
      { deletePaths, expectedBaseSha: initial.baseCommitSha ?? undefined }
    )

    await changesetRef.update({
      status: "applied",
      appliedCommitSha: commitSha,
      appliedAt: new Date().toISOString()
    })

    return { outcome: "applied", commitSha }
  } catch (error) {
    // Bevinding 4: bij een fout NIET op 'approving' laten staan (dat zou
    // de changeset permanent laten vastzitten, geen retry meer mogelijk)
    // — expliciet naar 'failed', met de foutmelding erbij.
    if (error instanceof ConcurrencyConflictError) {
      await changesetRef.update({
        status: "stale",
        error: error.message
      })
      return { outcome: "stale", currentSha: error.currentSha, expectedSha: error.expectedSha }
    }

    const errorMessage = String(error)
    await changesetRef.update({ status: "failed", error: errorMessage })
    return { outcome: "failed", error: errorMessage }
  }
}

export async function rejectChangeset(changesetId: string): Promise<{ ok: boolean }> {
  const db = getDb()
  const changesetRef = db.collection("changesets").doc(changesetId)
  const doc = await changesetRef.get()
  if (!doc.exists) return { ok: false }
  const data = doc.data() as Omit<Changeset, "id">
  if (data.status !== "proposed") return { ok: false }
  await changesetRef.update({ status: "rejected" })
  return { ok: true }
}

// Master Plan v1.6 — "Herstel deze wijziging" (chirurgisch, per commit).
//
// Berekent wat er nodig is om PRECIES ÉÉN commit terug te draaien, met
// expliciete conflict-detectie per bestand: als een bestand na de
// originele commit alweer is aangepast (door wie dan ook), wordt dat
// gedetecteerd en het bestand NIET automatisch teruggedraaid — in
// plaats van stilzwijgend een nieuwere wijziging te overschrijven.
export type RevertConflict = {
  path: string
  reason: string
}

export type RevertPlanResult =
  | { outcome: "ok"; files: ChangesetFile[]; conflicts: RevertConflict[]; commitMessage: string }
  | { outcome: "commit_not_found" }
  | { outcome: "no_parent"; reason: string }
  | { outcome: "merge_commit" }
  | { outcome: "nothing_to_revert"; conflicts: RevertConflict[] }

export async function buildRevertPlan(project: Project, commitSha: string): Promise<RevertPlanResult> {
  const commit = await getCommitDetails(project.githubRepo, commitSha)
  if (!commit) return { outcome: "commit_not_found" }
  if (commit.isMergeCommit) return { outcome: "merge_commit" }
  if (!commit.parentSha) {
    return { outcome: "no_parent", reason: "Dit is de allereerste commit in de repository — die kan niet automatisch teruggedraaid worden." }
  }

  const files: ChangesetFile[] = []
  const conflicts: RevertConflict[] = []

  for (const change of commit.files) {
    if (change.status === "renamed" || change.status === "other") {
      conflicts.push({
        path: change.path,
        reason: `Actie '${change.status}' wordt niet automatisch ondersteund — controleer en verwerk dit bestand handmatig.`
      })
      continue
    }

    if (change.status === "added") {
      // Terugdraaien = verwijderen. Conflict-check: staat het bestand
      // er nog EXACT zo bij als direct na deze commit? Zo niet, is het
      // sindsdien alweer aangepast -- niet blind verwijderen.
      const [currentFile] = await getFileContents(project.githubRepo, project.branch, [change.path])
      const [asOfThisCommit] = await getFileContents(project.githubRepo, commitSha, [change.path])

      if (!currentFile) {
        // Al niet meer aanwezig -- niets te doen, geen conflict
        continue
      }
      if (asOfThisCommit && currentFile.content !== asOfThisCommit.content) {
        conflicts.push({
          path: change.path,
          reason: "Dit bestand is na deze commit alweer aangepast — niet automatisch verwijderd om die nieuwere wijziging niet te verliezen."
        })
        continue
      }
      files.push({ path: change.path, action: "delete" })
    }

    if (change.status === "removed") {
      // Terugdraaien = herstellen met de inhoud van vóór deze commit.
      // Conflict-check: bestaat het bestand nu weer (door iemand anders
      // opnieuw aangemaakt)? Dan niet blind overschrijven.
      const [currentFile] = await getFileContents(project.githubRepo, project.branch, [change.path])
      if (currentFile) {
        conflicts.push({
          path: change.path,
          reason: "Dit bestand bestaat nu weer (opnieuw aangemaakt na deze commit) — niet automatisch overschreven."
        })
        continue
      }
      const [beforeContent] = await getFileContents(project.githubRepo, commit.parentSha, [change.path])
      if (!beforeContent) {
        conflicts.push({ path: change.path, reason: "Kon de inhoud van vóór deze commit niet ophalen." })
        continue
      }
      files.push({ path: change.path, action: "create", content: beforeContent.content })
    }

    if (change.status === "modified") {
      // Terugdraaien = de inhoud van vóór deze commit terugzetten.
      // Conflict-check: is de HUIDIGE inhoud nog exact zoals deze
      // commit die achterliet? Zo niet, is het sindsdien alweer
      // aangepast -- dan niet overschrijven.
      const [currentFile] = await getFileContents(project.githubRepo, project.branch, [change.path])
      const [asOfThisCommit] = await getFileContents(project.githubRepo, commitSha, [change.path])
      const [beforeContent] = await getFileContents(project.githubRepo, commit.parentSha, [change.path])

      if (!currentFile || !beforeContent) {
        conflicts.push({ path: change.path, reason: "Kon de benodigde bestandsversies niet ophalen." })
        continue
      }
      if (asOfThisCommit && currentFile.content !== asOfThisCommit.content) {
        conflicts.push({
          path: change.path,
          reason: "Dit bestand is na deze commit alweer aangepast — niet automatisch teruggezet om die nieuwere wijziging niet te verliezen."
        })
        continue
      }
      files.push({ path: change.path, action: "modify", content: beforeContent.content })
    }
  }

  if (files.length === 0) {
    return { outcome: "nothing_to_revert", conflicts }
  }

  const messageFirstLine = commit.message.split("\n")[0]
  return { outcome: "ok", files, conflicts, commitMessage: messageFirstLine }
}
