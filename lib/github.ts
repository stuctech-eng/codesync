import type { ProjectFile } from "@/types"

const BASE = "https://api.github.com"
const TOKEN = process.env.GITHUB_PAT!

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  "Content-Type": "application/json",
  Accept: "application/vnd.github+json"
}

// Eén efficiënte call voor de VOLLEDIGE bestandsboom (paden + git blob SHA's),
// i.p.v. losse calls per map/bestand. Dit is de basis voor zowel de
// structuur-weergave als de diff-vergelijking (zie lib/diff.ts).
export async function getTreeWithShas(
  repo: string,
  branch: string
): Promise<{ path: string; sha: string }[]> {
  const res = await fetch(
    `${BASE}/repos/${repo}/git/trees/${branch}?recursive=1`,
    { headers }
  )

  // Lege/gloednieuwe repo zonder commits — geen boom om op te halen,
  // behandel als leeg (alle ZIP-bestanden tellen dan als "nieuw")
  if (res.status === 404) {
    return []
  }

  if (!res.ok) {
    throw new Error(`GitHub fetch failed: ${res.status} ${res.statusText}`)
  }

  // Verdedig tegen het geval dat GitHub een 200-status geeft maar HTML
  // i.p.v. JSON terugstuurt (bijv. bij rate limiting of een gedegradeerde
  // backend) — geeft een duidelijke fout i.p.v. een cryptische SyntaxError.
  const contentType = res.headers.get("content-type") ?? ""
  if (!contentType.includes("application/json")) {
    const bodyPreview = (await res.text()).slice(0, 120)
    throw new Error(
      `GitHub gaf geen geldige JSON terug (mogelijk rate limit of tijdelijke storing): ${bodyPreview}`
    )
  }

  const data = await res.json()
  const tree = data.tree ?? []

  return tree
    .filter((item: { type: string }) => item.type === "blob")
    .map((item: { path: string; sha: string }) => ({
      path: item.path,
      sha: item.sha
    }))
}

// Structuur only — geen file content (snel, 1 API-call)
// Toont ALLE bestanden inclusief binaire (read-only in UI)
export async function getStructure(
  repo: string,
  branch: string
): Promise<ProjectFile[]> {
  const tree = await getTreeWithShas(repo, branch)

  return tree.map(item => ({
    path: item.path,
    content: "",
    sha: item.sha,
    isBinary: isBinary(item.path.split("/").pop() ?? "")
  } as ProjectFile))
}

// Haal inhoud op van specifieke bestanden
export async function getFileContents(
  repo: string,
  branch: string,
  paths: string[]
): Promise<ProjectFile[]> {
  const files: ProjectFile[] = []

  for (const path of paths) {
    try {
      const res = await fetch(
        `${BASE}/repos/${repo}/contents/${path}?ref=${branch}`,
        { headers }
      )
      if (!res.ok) continue
      const data = await res.json()
      if (!data.content) continue
      files.push({
        path,
        content: Buffer.from(data.content, "base64").toString("utf-8"),
        sha: data.sha
      })
    } catch {
      continue
    }
  }

  return files
}

// Concurrency-conflict — GitHub HEAD is gewijzigd sinds de analyse waarop
// deze commit gebaseerd is (Master Plan v1.1, sectie 9).
export class ConcurrencyConflictError extends Error {
  currentSha: string
  expectedSha: string
  constructor(currentSha: string, expectedSha: string) {
    super(`GitHub is gewijzigd sinds de laatste check (verwacht ${expectedSha}, actueel ${currentSha})`)
    this.name = "ConcurrencyConflictError"
    this.currentSha = currentSha
    this.expectedSha = expectedSha
  }
}

// Haal de huidige HEAD-SHA van een branch op — gebruikt om een concurrency-
// anker vast te leggen op het moment van diff/analyse.
export async function getBranchHeadSha(repo: string, branch: string): Promise<string | null> {
  try {
    const res = await fetch(`${BASE}/repos/${repo}/git/refs/heads/${branch}`, { headers })
    if (res.status === 404) return null // lege repo — geen HEAD
    if (!res.ok) return null
    const data = await res.json()
    return data.object?.sha ?? null
  } catch {
    return null
  }
}

export async function batchCommit(
  repo: string,
  branch: string,
  files: ProjectFile[],
  message: string,
  options: { deletePaths?: string[]; expectedBaseSha?: string } = {}
): Promise<string> {
  const { deletePaths = [], expectedBaseSha } = options

  // 1. Probeer de huidige branch ref op te halen — bij een gloednieuwe,
  // lege repo (geen commits) bestaat deze nog niet (404). Dat is geen
  // fout, maar het "eerste commit" scenario dat hieronder apart wordt
  // afgehandeld.
  const refRes = await fetch(
    `${BASE}/repos/${repo}/git/refs/heads/${branch}`,
    { headers }
  )
  const isEmptyRepo = refRes.status === 404

  let latestSha: string | null = null
  let baseTreeSha: string | null = null

  if (!isEmptyRepo) {
    if (!refRes.ok) throw new Error(`Failed to get ref: ${refRes.status}`)
    const refData = await refRes.json()
    latestSha = refData.object.sha

    // Concurrency-check (Master Plan v1.1, sectie 9) — alleen relevant
    // als de repo al bestaat; bij een lege repo is er niets om tegen
    // te vergelijken, dus wordt deze check overgeslagen.
    if (expectedBaseSha && latestSha !== expectedBaseSha) {
      throw new ConcurrencyConflictError(latestSha!, expectedBaseSha)
    }

    // 2. Get base tree sha
    const commitRes = await fetch(
      `${BASE}/repos/${repo}/git/commits/${latestSha}`,
      { headers }
    )
    if (!commitRes.ok) throw new Error(`Failed to get commit: ${commitRes.status}`)
    const commitData = await commitRes.json()
    baseTreeSha = commitData.tree.sha
  }

  // 3. Eén Git tree: nieuwe/gewijzigde bestanden als normale entries,
  // te verwijderen bestanden EXPLICIET met sha: null.
  //
  // Correctie (Master Plan v1.1, sectie 9 / laatste audit): paden
  // simpelweg weglaten uit de tree-array verwijdert ze NIET wanneer er
  // een base_tree wordt gebruikt — bestaande paden erven dan automatisch
  // over. Het expliciete sha: null-signaal is de correcte manier om een
  // bestand via de Git Trees API te verwijderen.
  const addOrModify = files.map(f => ({
    path: f.path,
    mode: "100644" as const,
    type: "blob" as const,
    content: f.content
  }))
  const deletions = deletePaths.map(path => ({
    path,
    mode: "100644" as const,
    type: "blob" as const,
    sha: null
  }))
  const tree = [...addOrModify, ...deletions]

  const treeBody: { tree: typeof tree; base_tree?: string } = { tree }
  if (baseTreeSha) treeBody.base_tree = baseTreeSha

  const treeRes = await fetch(`${BASE}/repos/${repo}/git/trees`, {
    method: "POST",
    headers,
    body: JSON.stringify(treeBody)
  })
  if (!treeRes.ok) throw new Error(`Failed to create tree: ${treeRes.status}`)
  const treeData = await treeRes.json()

  // 4. Create commit — bij een lege repo geen parents (dit wordt de allereerste commit)
  const commitBody: { message: string; tree: string; parents?: string[] } = {
    message,
    tree: treeData.sha
  }
  if (latestSha) commitBody.parents = [latestSha]

  const newCommitRes = await fetch(`${BASE}/repos/${repo}/git/commits`, {
    method: "POST",
    headers,
    body: JSON.stringify(commitBody)
  })
  if (!newCommitRes.ok) throw new Error(`Failed to create commit: ${newCommitRes.status}`)
  const newCommit = await newCommitRes.json()

  // 5. Update de branch ref — bij een lege repo bestaat de ref nog niet
  // en moet die aangemaakt worden (POST) i.p.v. bijgewerkt (PATCH)
  if (isEmptyRepo) {
    const createRefRes = await fetch(`${BASE}/repos/${repo}/git/refs`, {
      method: "POST",
      headers,
      body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: newCommit.sha })
    })
    if (!createRefRes.ok) throw new Error(`Failed to create ref: ${createRefRes.status}`)
  } else {
    const updateRes = await fetch(
      `${BASE}/repos/${repo}/git/refs/heads/${branch}`,
      {
        method: "PATCH",
        headers,
        body: JSON.stringify({ sha: newCommit.sha })
      }
    )
    if (!updateRes.ok) throw new Error(`Failed to update ref: ${updateRes.status}`)
  }

  return newCommit.sha
}

// Verwijder bestanden via Contents API (per bestand)
export async function deleteFiles(
  repo: string,
  branch: string,
  paths: string[]
): Promise<{ success: string[]; failed: string[] }> {
  const success: string[] = []
  const failed: string[] = []

  for (const path of paths) {
    try {
      // Haal huidige SHA op
      const res = await fetch(`${BASE}/repos/${repo}/contents/${path}?ref=${branch}`, { headers })
      if (!res.ok) {
        failed.push(path)
        continue
      }
      const data = await res.json()
      const sha = data.sha

      // Verwijder bestand
      const deleteRes = await fetch(`${BASE}/repos/${repo}/contents/${path}`, {
        method: "DELETE",
        headers,
        body: JSON.stringify({
          message: `Delete ${path}`,
          sha,
          branch
        })
      })

      if (deleteRes.ok) {
        success.push(path)
      } else {
        failed.push(path)
      }
    } catch {
      failed.push(path)
    }
  }

  return { success, failed }
}

// Maak een Git tag aan
export async function createTag(
  repo: string,
  sha: string,
  tag: string,
  message: string
): Promise<boolean> {
  try {
    // 1. Maak tag object
    const tagRes = await fetch(`${BASE}/repos/${repo}/git/tags`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        tag,
        message,
        object: sha,
        type: "commit"
      })
    })
    if (!tagRes.ok) return false
    const tagData = await tagRes.json()

    // 2. Maak ref aan
    const refRes = await fetch(`${BASE}/repos/${repo}/git/refs`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        ref: `refs/tags/${tag}`,
        sha: tagData.sha
      })
    })
    return refRes.ok
  } catch {
    return false
  }
}

// Haal alle tags op
export async function getTags(repo: string): Promise<{ name: string; sha: string }[]> {
  try {
    const res = await fetch(`${BASE}/repos/${repo}/tags?per_page=20`, { headers })
    if (!res.ok) return []
    const data = await res.json()
    const tags = data.map((t: { name: string; commit: { sha: string } }) => ({
      name: t.name,
      sha: t.commit.sha
    }))

    // Sorteer op versienummer — hoogste eerst
    return tags.sort((a: { name: string }, b: { name: string }) => {
      const numA = parseInt(a.name.replace(/[^0-9]/g, "").slice(-4) || "0")
      const numB = parseInt(b.name.replace(/[^0-9]/g, "").slice(-4) || "0")
      return numB - numA
    })
  } catch {
    return []
  }
}

// Haal commit count op voor versienummer
export async function getCommitCount(repo: string, branch: string): Promise<number> {
  try {
    const res = await fetch(
      `${BASE}/repos/${repo}/commits?sha=${branch}&per_page=1`,
      { headers }
    )
    if (!res.ok) return 0
    // GitHub geeft totaal aan in Link header
    const link = res.headers.get("link") ?? ""
    const match = link.match(/page=(\d+)>; rel="last"/)
    if (match) return parseInt(match[1])
    // Als geen link header: 1 commit
    const data = await res.json()
    return Array.isArray(data) ? data.length : 0
  } catch {
    return 0
  }
}

// Haal datum van laatste commit op (voor "laatst gebruikt" sortering)
export async function getLastCommit(
  repo: string,
  branch: string
): Promise<{ sha: string; date: string } | null> {
  try {
    const res = await fetch(
      `${BASE}/repos/${repo}/commits?sha=${branch}&per_page=1`,
      { headers }
    )
    if (!res.ok) return null
    const data = await res.json()
    if (!Array.isArray(data) || data.length === 0) return null
    const commit = data[0]
    const date = commit.commit?.committer?.date ?? commit.commit?.author?.date
    if (!date) return null
    return { sha: commit.sha, date }
  } catch {
    return null
  }
}

// Herstel project naar een specifieke tag
export async function restoreTag(
  repo: string,
  branch: string,
  tag: string
): Promise<string> {
  // 1. Haal de commit SHA op van de tag
  const tagRes = await fetch(`${BASE}/repos/${repo}/git/refs/tags/${tag}`, { headers })
  if (!tagRes.ok) throw new Error(`Tag niet gevonden: ${tag}`)
  const tagData = await tagRes.json()

  // Tag object kan een annotated tag zijn — dan nog een stap
  let commitSha = tagData.object.sha
  if (tagData.object.type === "tag") {
    const annotatedRes = await fetch(`${BASE}/repos/${repo}/git/tags/${commitSha}`, { headers })
    const annotatedData = await annotatedRes.json()
    commitSha = annotatedData.object.sha
  }

  // 2. Haal de tree op van die commit
  const commitRes = await fetch(`${BASE}/repos/${repo}/git/commits/${commitSha}`, { headers })
  if (!commitRes.ok) throw new Error(`Commit niet gevonden`)
  const commitData = await commitRes.json()
  const treeSha = commitData.tree.sha

  // 3. Haal huidige branch ref op
  const refRes = await fetch(`${BASE}/repos/${repo}/git/refs/heads/${branch}`, { headers })
  if (!refRes.ok) throw new Error(`Branch niet gevonden: ${branch}`)
  const refData = await refRes.json()
  const latestSha = refData.object.sha

  // 4. Maak nieuwe commit met de tree van de tag
  const date = new Date().toLocaleDateString("nl-NL", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  })
  const newCommitRes = await fetch(`${BASE}/repos/${repo}/git/commits`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      message: `Herstel naar ${tag} — ${date}`,
      tree: treeSha,
      parents: [latestSha]
    })
  })
  if (!newCommitRes.ok) throw new Error(`Commit aanmaken mislukt`)
  const newCommit = await newCommitRes.json()

  // 5. Update branch ref
  const updateRes = await fetch(`${BASE}/repos/${repo}/git/refs/heads/${branch}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ sha: newCommit.sha })
  })
  if (!updateRes.ok) throw new Error(`Branch updaten mislukt`)

  return newCommit.sha
}

// Test connection — call this in /api/health
export async function testConnection(repo: string): Promise<{
  ok: boolean
  repo?: string
  error?: string
}> {
  try {
    const res = await fetch(`${BASE}/repos/${repo}`, { headers })
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` }
    const data = await res.json()
    return { ok: true, repo: data.full_name }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

function isBinary(filename: string): boolean {
  const binaryExtensions = [
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico",
    ".pdf", ".zip", ".tar", ".gz",
    ".woff", ".woff2", ".ttf", ".eot",
    ".mp4", ".mp3", ".mov"
  ]
  return binaryExtensions.some(ext => filename.toLowerCase().endsWith(ext))
}
