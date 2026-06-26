import type { ProjectFile } from "@/types"

const BASE = "https://api.github.com"
const TOKEN = process.env.GITHUB_PAT!

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  "Content-Type": "application/json",
  Accept: "application/vnd.github+json"
}

// Structuur only — geen file content (snel)
export async function getStructure(
  repo: string,
  branch: string,
  dir = ""
): Promise<ProjectFile[]> {
  const res = await fetch(
    `${BASE}/repos/${repo}/contents/${dir}?ref=${branch}`,
    { headers }
  )

  if (!res.ok) {
    throw new Error(`GitHub fetch failed: ${res.status} ${res.statusText}`)
  }

  const items = await res.json()
  const files: ProjectFile[] = []

  for (const item of items) {
    if (item.type === "file") {
      if (isBinary(item.name)) continue
      // Alleen pad en sha — geen content
      files.push({ path: item.path, content: "", sha: item.sha })
    } else if (item.type === "dir") {
      if (item.name === "node_modules" || item.name === ".git") continue
      const nested = await getStructure(repo, branch, item.path)
      files.push(...nested)
    }
  }

  return files
}

// Volledige snapshot — inclusief file content
export async function getSnapshot(
  repo: string,
  branch: string,
  dir = ""
): Promise<ProjectFile[]> {
  const res = await fetch(
    `${BASE}/repos/${repo}/contents/${dir}?ref=${branch}`,
    { headers }
  )

  if (!res.ok) {
    throw new Error(`GitHub fetch failed: ${res.status} ${res.statusText}`)
  }

  const items = await res.json()
  const files: ProjectFile[] = []

  for (const item of items) {
    if (item.type === "file") {
      // Skip large files (>500KB) and binaries
      if (item.size > 500_000) continue
      if (isBinary(item.name)) continue

      const fileRes = await fetch(item.url, { headers })
      const fileData = await fileRes.json()

      // GitHub geeft geen content bij bestanden >1MB
      if (!fileData.content) continue

      files.push({
        path: item.path,
        content: Buffer.from(fileData.content, "base64").toString("utf-8"),
        sha: item.sha
      })
    } else if (item.type === "dir") {
      // Skip node_modules and .git
      if (item.name === "node_modules" || item.name === ".git") continue

      const nested = await getSnapshot(repo, branch, item.path)
      files.push(...nested)
    }
  }

  return files
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

export async function batchCommit(
  repo: string,
  branch: string,
  files: ProjectFile[],
  message: string
): Promise<string> {
  // 1. Get current branch ref
  const refRes = await fetch(
    `${BASE}/repos/${repo}/git/refs/heads/${branch}`,
    { headers }
  )
  if (!refRes.ok) throw new Error(`Failed to get ref: ${refRes.status}`)
  const refData = await refRes.json()
  const latestSha = refData.object.sha

  // 2. Get base tree sha
  const commitRes = await fetch(
    `${BASE}/repos/${repo}/git/commits/${latestSha}`,
    { headers }
  )
  if (!commitRes.ok) throw new Error(`Failed to get commit: ${commitRes.status}`)
  const commitData = await commitRes.json()
  const baseTreeSha = commitData.tree.sha

  // 3. Create new tree (content inline, max ~1MB per file safe)
  const tree = files.map(f => ({
    path: f.path,
    mode: "100644" as const,
    type: "blob" as const,
    content: f.content
  }))

  const treeRes = await fetch(`${BASE}/repos/${repo}/git/trees`, {
    method: "POST",
    headers,
    body: JSON.stringify({ base_tree: baseTreeSha, tree })
  })
  if (!treeRes.ok) throw new Error(`Failed to create tree: ${treeRes.status}`)
  const treeData = await treeRes.json()

  // 4. Create commit
  const newCommitRes = await fetch(`${BASE}/repos/${repo}/git/commits`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      message,
      tree: treeData.sha,
      parents: [latestSha]
    })
  })
  if (!newCommitRes.ok) throw new Error(`Failed to create commit: ${newCommitRes.status}`)
  const newCommit = await newCommitRes.json()

  // 5. Update branch ref
  const updateRes = await fetch(
    `${BASE}/repos/${repo}/git/refs/heads/${branch}`,
    {
      method: "PATCH",
      headers,
      body: JSON.stringify({ sha: newCommit.sha })
    }
  )
  if (!updateRes.ok) throw new Error(`Failed to update ref: ${updateRes.status}`)

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
    const res = await fetch(`${BASE}/repos/${repo}/tags?per_page=10`, { headers })
    if (!res.ok) return []
    const data = await res.json()
    return data.map((t: { name: string; commit: { sha: string } }) => ({
      name: t.name,
      sha: t.commit.sha
    }))
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
