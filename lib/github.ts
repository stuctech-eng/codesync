import type { ProjectFile } from "@/types"

const BASE = "https://api.github.com"
const TOKEN = process.env.GITHUB_PAT!

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  "Content-Type": "application/json",
  Accept: "application/vnd.github+json"
}

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
