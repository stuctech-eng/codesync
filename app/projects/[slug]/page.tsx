"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { PROJECTS } from "@/lib/projects"
import type { ProjectStatus, Snapshot } from "@/types"
import Link from "next/link"

const STATUS_COLOR: Record<ProjectStatus, string> = {
  active: "#16a34a",
  experimental: "#d97706",
  archive: "#6b7280"
}

export default function ProjectPage() {
  const params = useParams()
  const slug = params.slug as string
  const project = PROJECTS.find(p => p.slug === slug)

  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [treeLoaded, setTreeLoaded] = useState(false)
  const [treeOpen, setTreeOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // Delete mode
  const [deleteMode, setDeleteMode] = useState(false)
  const [deleteSelected, setDeleteSelected] = useState<Record<string, boolean>>({})
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteResult, setDeleteResult] = useState<{ deleted: string[]; failed: string[] } | null>(null)

  // Tags
  const [tags, setTags] = useState<{ name: string; sha: string }[]>([])
  const [tagsLoaded, setTagsLoaded] = useState(false)
  const [creatingTag, setCreatingTag] = useState(false)
  const [tagResult, setTagResult] = useState<{ tag: string } | null>(null)

  // Tag herstel
  const [restoringTag, setRestoringTag] = useState<string | null>(null)
  const [restoreResult, setRestoreResult] = useState<{ tag: string; sha: string } | null>(null)
  const [restoreConfirm, setRestoreConfirm] = useState<string | null>(null)

  // Commit history
  const [commits, setCommits] = useState<{ sha: string; message: string; date: string; author: string }[]>([])
  const [commitsLoaded, setCommitsLoaded] = useState(false)
  const [commitsOpen, setCommitsOpen] = useState(false)
  const [commitsLoading, setCommitsLoading] = useState(false)

  // Copy to Claude
  const [copyMode, setCopyMode] = useState(false)
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [copied, setCopied] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  if (!project) return null

  const statusColor = STATUS_COLOR[project.status]

  async function handleRestore(tag: string) {
    setRestoringTag(tag)
    setRestoreConfirm(null)
    try {
      const res = await fetch("/api/tags", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectSlug: slug, tag })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setRestoreResult({ tag, sha: data.commitSha.slice(0, 7) })
      // Reload tags
      const tagRes = await fetch(`/api/tags?slug=${slug}`)
      const tagData = await tagRes.json()
      if (tagRes.ok) setTags(tagData.tags)
    } catch (e) {
      setError(String(e))
    } finally {
      setRestoringTag(null)
    }
  }

  async function loadCommits() {
    if (commitsLoaded) {
      setCommitsOpen(o => !o)
      return
    }
    setCommitsLoading(true)
    try {
      const res = await fetch(`/api/commits?slug=${slug}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setCommits(data.commits)
      setCommitsLoaded(true)
      setCommitsOpen(true)
    } catch (e) {
      setError(String(e))
    } finally {
      setCommitsLoading(false)
    }
  }

  async function loadTree() {
    if (treeLoaded) {
      setTreeOpen(o => !o)
      return
    }
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/snapshot?slug=${slug}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSnapshot(data)
      setTreeLoaded(true)
      setTreeOpen(true)

      if (!tagsLoaded) {
        const tagRes = await fetch(`/api/tags?slug=${slug}`)
        const tagData = await tagRes.json()
        if (tagRes.ok) {
          setTags(tagData.tags)
          setTagsLoaded(true)
        }
      }
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  async function copyAll() {
    setLoading(true)
    setError("")
    try {
      // Laad structuur als nog niet gedaan
      let snap = snapshot
      if (!treeLoaded) {
        const res = await fetch(`/api/snapshot?slug=${slug}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        setSnapshot(data)
        setTreeLoaded(true)
        snap = data
      }
      if (!snap || !project) return

      // Haal key files inhoud op (niet alle bestanden)
      const keyPaths = project.keyFiles?.map(k => k.path) ?? []
      let fileContentsText = ""

      if (keyPaths.length > 0) {
        const contentsRes = await fetch("/api/contents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectSlug: slug, paths: keyPaths })
        })
        const contentsData = await contentsRes.json()
        if (contentsRes.ok && contentsData.files) {
          fileContentsText = contentsData.files.map((f: { path: string; content: string }) =>
            `### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``
          ).join("\n\n")
        }
      }

      const stackLine = project.stack?.length ? `Stack: ${project.stack.join(", ")}` : ""
      const keyFilesSection = project.keyFiles?.length
        ? `\n## Key files\n${project.keyFiles.map(k => `- ${k.path} — ${k.description}`).join("\n")}`
        : ""
      const fileTree = snap.files.map(f => `  ${f.path}`).join("\n")

      const context = `# Project: ${project.name}
Repository: ${project.githubRepo}
${stackLine}
${keyFilesSection}

## Bestandsstructuur
\`\`\`
${fileTree}
\`\`\`
${fileContentsText ? `\n## Key file inhoud\n\n${fileContentsText}` : ""}`

      try {
        await navigator.clipboard.writeText(context)
      } catch {
        const ta = document.createElement("textarea")
        ta.value = context
        ta.style.position = "fixed"
        ta.style.opacity = "0"
        document.body.appendChild(ta)
        ta.focus()
        ta.select()
        document.execCommand("copy")
        document.body.removeChild(ta)
      }

      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  async function loadAndCopy() {
    if (!treeLoaded) {
      setLoading(true)
      try {
        const res = await fetch(`/api/snapshot?slug=${slug}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        setSnapshot(data)
        setTreeLoaded(true)
        setTreeOpen(true)
        const init: Record<string, boolean> = {}
        data.files.forEach((f: { path: string }) => { init[f.path] = true })
        setSelected(init)
      } catch (e) {
        setError(String(e))
        return
      } finally {
        setLoading(false)
      }
    } else {
      const init: Record<string, boolean> = {}
      snapshot?.files.forEach(f => { init[f.path] = true })
      setSelected(init)
    }
    setCopyMode(true)
    setTreeOpen(true)
  }

  async function createRestorePoint() {
    setCreatingTag(true)
    try {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectSlug: slug })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setTagResult(data)
      const tagRes = await fetch(`/api/tags?slug=${slug}`)
      const tagData = await tagRes.json()
      if (tagRes.ok) setTags(tagData.tags)
    } catch (e) {
      setError(String(e))
    } finally {
      setCreatingTag(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    const paths = Object.entries(deleteSelected).filter(([, v]) => v).map(([k]) => k)
    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectSlug: slug,
          files: [],
          filesToDelete: paths,
          zipName: "delete-files"
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setDeleteResult({ deleted: data.filesDeleted, failed: data.deletesFailed })
      setDeleteMode(false)
      setDeleteConfirm(false)
      setDeleteSelected({})
      setTreeLoaded(false)
      setSnapshot(null)
    } catch (e) {
      setError(String(e))
    } finally {
      setDeleting(false)
    }
  }

  async function copyToClipboard() {
    if (!snapshot || !project) return
    setLoading(true)
    try {
      const selectedPaths = Object.entries(selected).filter(([, v]) => v).map(([k]) => k)

      // Haal inhoud op van geselecteerde bestanden
      const contentsRes = await fetch("/api/contents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectSlug: slug, paths: selectedPaths })
      })
      const contentsData = await contentsRes.json()
      const filesWithContent: { path: string; content: string }[] = contentsData.files ?? []

      const stackLine = project.stack?.length ? `Stack: ${project.stack.join(", ")}` : ""
      const keyFilesSection = project.keyFiles?.length
        ? `\n## Key files\n${project.keyFiles.map(k => `- ${k.path} — ${k.description}`).join("\n")}`
        : ""
      const fileTree = selectedPaths.map(p => `  ${p}`).join("\n")
      const fileContents = filesWithContent.map(f =>
        `### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``
      ).join("\n\n")

      const context = `# Project: ${project.name}
Repository: ${project.githubRepo}
${stackLine}
${keyFilesSection}

## Bestandsstructuur
\`\`\`
${fileTree}
\`\`\`

## Bestandsinhoud

${fileContents}`

      try {
        await navigator.clipboard.writeText(context)
      } catch {
        const ta = document.createElement("textarea")
        ta.value = context
        ta.style.position = "fixed"
        ta.style.opacity = "0"
        document.body.appendChild(ta)
        ta.focus()
        ta.select()
        document.execCommand("copy")
        document.body.removeChild(ta)
      }

      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  const fileTree: Record<string, { path: string; content: string; sha?: string }[]> = {}
  if (snapshot) {
    for (const file of snapshot.files) {
      const dir = file.path.includes("/") ? file.path.split("/")[0] : "root"
      if (!fileTree[dir]) fileTree[dir] = []
      fileTree[dir].push(file)
    }
  }

  const selectedCount = Object.values(selected).filter(Boolean).length
  const deleteCount = Object.values(deleteSelected).filter(Boolean).length

  return (
    <main style={{
      minHeight: "100dvh",
      backgroundColor: "#f5f5f7",
      color: "#1c1c1e",
      fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
      padding: "env(safe-area-inset-top, 0px) 0 env(safe-area-inset-bottom, 40px)"
    }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>

        {/* Header */}
        <div style={{
          position: "sticky",
          top: 0,
          backgroundColor: "#ffffff",
          borderBottom: "1px solid #e5e5ea",
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          zIndex: 10
        }}>
          <Link href="/" style={{ fontSize: 15, color: "#007aff", textDecoration: "none", minHeight: 44, display: "flex", alignItems: "center" }}>←</Link>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: statusColor }} />
              <span style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: statusColor, fontWeight: 700 }}>{project.status}</span>
            </div>
            <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "#1c1c1e" }}>{project.name}</h1>
          </div>
          {(copyMode || deleteMode) && (
            <button onClick={() => { setCopyMode(false); setDeleteMode(false); setDeleteSelected({}) }}
              style={{ fontSize: 13, color: "#8e8e93", background: "none", border: "none", cursor: "pointer", minHeight: 44 }}>
              Annuleer
            </button>
          )}
        </div>

        <div style={{ padding: "16px" }}>

          {/* Repo */}
          <div style={{ background: "#ffffff", border: "1px solid #e5e5ea", borderRadius: 12, padding: "12px 16px", marginBottom: 12 }}>
            <p style={{ fontSize: 11, color: "#8e8e93", margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Repository</p>
            <p style={{ fontSize: 14, color: "#1c1c1e", margin: 0, fontFamily: "monospace" }}>{project.githubRepo}</p>
          </div>

          {/* Acties */}
          {!copyMode && !deleteMode && project.status === "active" && (
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <Link href={`/projects/${slug}/import`} style={{
                flex: 1, background: "#007aff", color: "#ffffff", borderRadius: 12,
                padding: "14px", fontSize: 15, fontWeight: 600, textAlign: "center",
                textDecoration: "none", minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center"
              }}>ZIP Import</Link>
              <a href={`https://github.com/${project.githubRepo}`} target="_blank" rel="noopener noreferrer" style={{
                flex: 1, background: "#ffffff", border: "1px solid #e5e5ea", color: "#1c1c1e",
                borderRadius: 12, padding: "14px", fontSize: 15, fontWeight: 600, textAlign: "center",
                textDecoration: "none", minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center"
              }}>GitHub →</a>
            </div>
          )}

          {/* Herstelpunten */}
          {!copyMode && !deleteMode && treeLoaded && (
            <div style={{ marginBottom: 12 }}>
              <button onClick={createRestorePoint} disabled={creatingTag} style={{
                width: "100%", background: "#ffffff", border: "1px solid #e5e5ea", borderRadius: 12,
                padding: "14px 16px", fontSize: 15, fontWeight: 600, color: creatingTag ? "#8e8e93" : "#1c1c1e",
                cursor: creatingTag ? "default" : "pointer", minHeight: 44, display: "flex",
                alignItems: "center", justifyContent: "space-between", marginBottom: 8
              }}>
                <span>{creatingTag ? "Aanmaken..." : "🔖 Maak herstelpunt"}</span>
              </button>

              {tagResult && (
                <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 10, padding: "10px 14px", marginBottom: 8 }}>
                  <p style={{ fontSize: 13, color: "#16a34a", margin: 0, fontWeight: 600 }}>✓ {tagResult.tag} aangemaakt</p>
                </div>
              )}

              {tags.length > 0 && (
                <div style={{ background: "#ffffff", border: "1px solid #e5e5ea", borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ padding: "8px 16px", backgroundColor: "#f9f9fb", borderBottom: "1px solid #f2f2f7" }}>
                    <p style={{ fontSize: 12, color: "#6b7280", margin: 0, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Herstelpunten</p>
                  </div>
                  {/* Herstel resultaat */}
                  {restoreResult && (
                    <div style={{ padding: "10px 16px", backgroundColor: "#f0fdf4", borderBottom: "1px solid #86efac" }}>
                      <p style={{ fontSize: 13, color: "#16a34a", margin: 0, fontWeight: 600 }}>
                        ✓ Hersteld naar {restoreResult.tag} — {restoreResult.sha}
                      </p>
                    </div>
                  )}

                  {tags.slice(0, 5).map((tag, i) => (
                    <div key={tag.name} style={{ padding: "12px 16px", borderTop: i > 0 ? "1px solid #f2f2f7" : "none" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                        <div>
                          <p style={{ fontSize: 14, fontWeight: 600, color: "#1c1c1e", margin: 0 }}>{tag.name}</p>
                          <p style={{ fontSize: 12, color: "#8e8e93", margin: "2px 0 0", fontFamily: "monospace" }}>{tag.sha.slice(0, 7)}</p>
                        </div>
                        <a href={`https://github.com/${project.githubRepo}/tree/${tag.name}`} target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: 13, color: "#007aff", textDecoration: "none" }}>Bekijk →</a>
                      </div>
                      {restoreConfirm === tag.name ? (
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={() => setRestoreConfirm(null)} style={{
                            flex: 1, background: "#ffffff", border: "1px solid #e5e5ea", color: "#1c1c1e",
                            borderRadius: 8, padding: "8px", fontSize: 13, cursor: "pointer"
                          }}>Annuleer</button>
                          <button onClick={() => handleRestore(tag.name)} style={{
                            flex: 2, background: "#d97706", border: "none", color: "#ffffff",
                            borderRadius: 8, padding: "8px", fontSize: 13, fontWeight: 700, cursor: "pointer"
                          }}>
                            {restoringTag === tag.name ? "Herstellen..." : `✓ Herstel naar ${tag.name}`}
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => setRestoreConfirm(tag.name)} style={{
                          width: "100%", background: "#fffbeb", border: "1px solid #fde68a",
                          color: "#92400e", borderRadius: 8, padding: "8px", fontSize: 13,
                          fontWeight: 600, cursor: "pointer"
                        }}>
                          Herstel naar deze versie
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Commit history */}
          {!copyMode && !deleteMode && (
            <div style={{ marginBottom: 12 }}>
              <button
                onClick={loadCommits}
                style={{
                  width: "100%",
                  background: "#ffffff",
                  border: "1px solid #e5e5ea",
                  borderRadius: commitsOpen ? "12px 12px 0 0" : 12,
                  padding: "14px 16px",
                  fontSize: 15,
                  fontWeight: 600,
                  color: "#1c1c1e",
                  cursor: "pointer",
                  minHeight: 44,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between"
                }}
              >
                <span>{commitsLoading ? "Laden..." : "📋 Commit history"}</span>
                {!commitsLoading && (
                  <span style={{
                    transform: commitsOpen ? "rotate(90deg)" : "rotate(0deg)",
                    transition: "transform 0.2s",
                    display: "inline-block",
                    color: "#8e8e93"
                  }}>›</span>
                )}
              </button>

              {commitsOpen && commits.length > 0 && (
                <div style={{
                  background: "#ffffff",
                  border: "1px solid #e5e5ea",
                  borderTop: "none",
                  borderRadius: "0 0 12px 12px",
                  overflow: "hidden"
                }}>
                  {commits.map((commit, i) => (
                    <div key={commit.sha} style={{
                      padding: "12px 16px",
                      borderTop: i > 0 ? "1px solid #f2f2f7" : "none"
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                        <p style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: "#1c1c1e",
                          margin: 0,
                          flex: 1,
                          lineHeight: 1.4
                        }}>
                          {commit.message.split("\n")[0]}
                        </p>
                        <span style={{
                          fontSize: 11,
                          color: "#8e8e93",
                          fontFamily: "monospace",
                          flexShrink: 0
                        }}>
                          {commit.sha}
                        </span>
                      </div>
                      <p style={{
                        fontSize: 11,
                        color: "#8e8e93",
                        margin: "4px 0 0"
                      }}>
                        {new Date(commit.date).toLocaleDateString("nl-NL", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Delete result */}
          {deleteResult && (
            <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 10, padding: "10px 14px", marginBottom: 12 }}>
              <p style={{ fontSize: 13, color: "#16a34a", margin: 0 }}>
                ✓ {deleteResult.deleted.length} bestand{deleteResult.deleted.length !== 1 ? "en" : ""} verwijderd
              </p>
              {deleteResult.failed.length > 0 && (
                <p style={{ fontSize: 12, color: "#dc2626", margin: "4px 0 0" }}>Mislukt: {deleteResult.failed.join(", ")}</p>
              )}
            </div>
          )}

          {/* Kopieer knoppen */}
          {!copyMode && !deleteMode && (
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <button onClick={loadAndCopy} style={{
                flex: 2, background: "#1c1c1e", border: "none",
                color: "#ffffff", borderRadius: 12, padding: "14px",
                fontSize: 15, fontWeight: 600, minHeight: 44, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8
              }}>
                ✂ Selecteer
              </button>
              <button onClick={copyAll} style={{
                flex: 1, background: "#ffffff", border: "1px solid #e5e5ea",
                color: "#1c1c1e", borderRadius: 12, padding: "14px",
                fontSize: 15, fontWeight: 600, minHeight: 44, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center"
              }}>
                📋
              </button>
            </div>
          )}

          {/* Bekijk bestanden + delete knop */}
          {!copyMode && (
            <div style={{ display: "flex", gap: 8, marginBottom: treeOpen ? 0 : 12 }}>
              <button onClick={loadTree} style={{
                flex: 1, background: "#ffffff", border: "1px solid #e5e5ea", borderRadius: 12,
                padding: "14px 16px", fontSize: 15, fontWeight: 600, color: "#1c1c1e",
                cursor: "pointer", minHeight: 44, display: "flex", alignItems: "center", justifyContent: "space-between"
              }}>
                <span>{loading ? "Laden..." : treeLoaded ? `${snapshot?.files.length} bestanden` : "Bekijk bestanden"}</span>
                {!loading && <span style={{ transform: treeOpen ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s", display: "inline-block", color: "#8e8e93" }}>›</span>}
              </button>
              {treeLoaded && !deleteMode && (
                <button onClick={() => { setDeleteMode(true); setTreeOpen(true) }} style={{
                  background: "#fff5f5", border: "1px solid #fecaca", borderRadius: 12,
                  padding: "14px", fontSize: 18, color: "#dc2626", cursor: "pointer",
                  minHeight: 44, minWidth: 48, display: "flex", alignItems: "center", justifyContent: "center"
                }}>🗑</button>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{ background: "#fff5f5", border: "1px solid #fecaca", borderRadius: 10, padding: 14, marginBottom: 12 }}>
              <p style={{ fontSize: 13, color: "#dc2626", margin: 0 }}>{error}</p>
            </div>
          )}

          {/* Copy mode */}
          {copyMode && snapshot && (
            <div>
              {/* Zoekbalk */}
              <div style={{ background: "#ffffff", border: "1px solid #e5e5ea", borderRadius: 12, padding: "10px 14px", marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 15, color: "#8e8e93" }}>🔍</span>
                <input
                  type="text"
                  placeholder="Zoek bestand..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{
                    flex: 1,
                    border: "none",
                    outline: "none",
                    fontSize: 15,
                    color: "#1c1c1e",
                    background: "transparent",
                    fontFamily: "'SF Pro Display', -apple-system, sans-serif"
                  }}
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 15, color: "#8e8e93", padding: 0 }}>✕</button>
                )}
              </div>

              {/* Stats balk */}
              <div style={{ background: "#ffffff", border: "1px solid #e5e5ea", borderRadius: 12, padding: "12px 16px", marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: selectedCount > 0 ? 10 : 0 }}>
                  <p style={{ fontSize: 13, color: "#8e8e93", margin: 0 }}>
                    {searchQuery
                      ? `${snapshot.files.filter(f => f.path.toLowerCase().includes(searchQuery.toLowerCase())).length} van ${snapshot.files.length} gevonden`
                      : `${selectedCount} van ${snapshot.files.length} geselecteerd`
                    }
                  </p>
                  <button onClick={() => {
                    const allSelected = snapshot.files.every(f => selected[f.path])
                    const next: Record<string, boolean> = {}
                    snapshot.files.forEach(f => { next[f.path] = !allSelected })
                    setSelected(next)
                  }} style={{ fontSize: 13, color: "#007aff", background: "none", border: "none", cursor: "pointer" }}>
                    {snapshot.files.every(f => selected[f.path]) ? "Alles uit" : "Alles aan"}
                  </button>
                </div>

                {/* Geselecteerde bestanden als tags */}
                {selectedCount > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {Object.entries(selected).filter(([, v]) => v).map(([path]) => (
                      <div key={path} onClick={() => setSelected(s => ({ ...s, [path]: false }))}
                        style={{
                          background: "#f2f2f7",
                          borderRadius: 8,
                          padding: "4px 10px",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          cursor: "pointer"
                        }}>
                        <span style={{ fontSize: 12, color: "#1c1c1e", fontFamily: "monospace" }}>
                          {path.includes("/") ? path.split("/").slice(-2).join("/") : path}
                        </span>
                        <span style={{ fontSize: 12, color: "#8e8e93" }}>✕</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ background: "#ffffff", border: "1px solid #e5e5ea", borderRadius: 12, overflow: "hidden", marginBottom: 12 }}>
                {(() => {
                  const filteredTree = Object.entries(fileTree)
                    .map(([dir, files]) => ({
                      dir,
                      files: searchQuery
                        ? files.filter(f => f.path.toLowerCase().includes(searchQuery.toLowerCase()))
                        : files
                    }))
                    .filter(({ files }) => files.length > 0)

                  if (filteredTree.length === 0) {
                    return (
                      <div style={{ padding: 24, textAlign: "center" }}>
                        <p style={{ fontSize: 14, color: "#8e8e93", margin: 0 }}>Geen bestanden gevonden</p>
                      </div>
                    )
                  }

                  return filteredTree.map(({ dir, files }, di) => (
                    <div key={dir} style={{ borderTop: di > 0 ? "1px solid #f2f2f7" : "none" }}>
                      <div style={{ padding: "8px 16px", backgroundColor: "#f9f9fb", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <p style={{ fontSize: 12, color: "#6b7280", margin: 0, fontFamily: "monospace", fontWeight: 600 }}>{dir}/</p>
                        <button onClick={() => {
                          const allOn = files.every(f => selected[f.path])
                          const next = { ...selected }
                          files.forEach(f => { next[f.path] = !allOn })
                          setSelected(next)
                        }} style={{ fontSize: 11, color: "#007aff", background: "none", border: "none", cursor: "pointer" }}>
                          {files.every(f => selected[f.path]) ? "Uit" : "Aan"}
                        </button>
                      </div>
                      {files.map((file, fi) => (
                        <div key={file.path} onClick={() => setSelected(s => ({ ...s, [file.path]: !s[file.path] }))}
                          style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 16px", borderTop: fi > 0 ? "1px solid #f2f2f7" : "none", cursor: "pointer", minHeight: 44 }}>
                          <div style={{
                            width: 22, height: 22, borderRadius: 6,
                            border: selected[file.path] ? "none" : "2px solid #d1d1d6",
                            backgroundColor: selected[file.path] ? "#1c1c1e" : "transparent",
                            flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center"
                          }}>
                            {selected[file.path] && <svg width="12" height="10" viewBox="0 0 12 10" fill="none"><path d="M1 5L4.5 8.5L11 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                          </div>
                          <p style={{ fontSize: 13, color: selected[file.path] ? "#1c1c1e" : "#8e8e93", margin: 0, fontFamily: "monospace", flex: 1, wordBreak: "break-all" }}>
                            {file.path.includes("/") ? file.path.split("/").slice(1).join("/") : file.path}
                          </p>
                        </div>
                      ))}
                    </div>
                  ))
                })()}
              </div>

              {/* Spacer voor sticky knop */}
              <div style={{ height: 80 }} />
            </div>
          )}

          {/* Sticky kopieer knop */}
          {copyMode && (
            <div style={{
              position: "fixed",
              bottom: 0,
              left: 0,
              right: 0,
              padding: "12px 16px 24px",
              backgroundColor: "#f5f5f7",
              borderTop: "1px solid #e5e5ea",
              zIndex: 50
            }}>
              <button onClick={copyToClipboard} disabled={selectedCount === 0} style={{
                width: "100%",
                background: copied ? "#16a34a" : selectedCount > 0 ? "#1c1c1e" : "#e5e5ea",
                border: "none",
                color: selectedCount > 0 ? "#ffffff" : "#8e8e93",
                borderRadius: 12,
                padding: "16px",
                fontSize: 16,
                fontWeight: 700,
                minHeight: 52,
                cursor: selectedCount > 0 ? "pointer" : "default",
                transition: "background 0.2s"
              }}>
                {copied ? "✓ Gekopieerd!" : `Kopieer ${selectedCount} bestand${selectedCount !== 1 ? "en" : ""} naar Claude`}
              </button>
            </div>
          )}

          {/* Normale file tree */}
          {treeOpen && !copyMode && snapshot && (
            <div>
              <div style={{ background: "#ffffff", border: "1px solid #e5e5ea", borderTop: "none", borderRadius: "0 0 12px 12px", overflow: "hidden", marginBottom: 12 }}>
                {Object.entries(fileTree).map(([dir, files], i) => (
                  <div key={dir} style={{ borderTop: i > 0 ? "1px solid #f2f2f7" : "none" }}>
                    <div style={{ padding: "8px 16px", backgroundColor: "#f9f9fb" }}>
                      <p style={{ fontSize: 12, color: "#6b7280", margin: 0, fontFamily: "monospace", fontWeight: 600 }}>{dir}/</p>
                    </div>
                    {files.map((file, fi) => (
                      <div key={file.path}
                        onClick={() => deleteMode && setDeleteSelected(s => ({ ...s, [file.path]: !s[file.path] }))}
                        style={{
                          padding: "10px 16px 10px 28px", borderTop: fi > 0 ? "1px solid #f2f2f7" : "none",
                          display: "flex", alignItems: "center", gap: 10,
                          cursor: deleteMode ? "pointer" : "default",
                          backgroundColor: deleteMode && deleteSelected[file.path] ? "#fff5f5" : "transparent"
                        }}>
                        {deleteMode && (
                          <div style={{
                            width: 20, height: 20, borderRadius: 5,
                            border: deleteSelected[file.path] ? "none" : "2px solid #d1d1d6",
                            backgroundColor: deleteSelected[file.path] ? "#dc2626" : "transparent",
                            flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center"
                          }}>
                            {deleteSelected[file.path] && <svg width="10" height="8" viewBox="0 0 12 10" fill="none"><path d="M1 5L4.5 8.5L11 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                          </div>
                        )}
                        <p style={{ fontSize: 13, color: deleteMode && deleteSelected[file.path] ? "#dc2626" : "#8e8e93", margin: 0, fontFamily: "monospace" }}>
                          {file.path.includes("/") ? file.path.split("/").slice(1).join("/") : file.path}
                        </p>
                      </div>
                    ))}
                  </div>
                ))}
                {snapshot.isStale && (
                  <div style={{ padding: "10px 16px", borderTop: "1px solid #f2f2f7" }}>
                    <p style={{ fontSize: 12, color: "#d97706", margin: 0 }}>⚠ Cache — GitHub niet bereikbaar</p>
                  </div>
                )}
              </div>

              {/* Delete actie balk */}
              {deleteMode && (
                <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                  <button onClick={() => { setDeleteMode(false); setDeleteSelected({}) }} style={{
                    flex: 1, background: "#ffffff", border: "1px solid #e5e5ea", color: "#1c1c1e",
                    borderRadius: 12, padding: "14px", fontSize: 15, fontWeight: 600, minHeight: 44, cursor: "pointer"
                  }}>Annuleer</button>
                  <button onClick={() => setDeleteConfirm(true)} disabled={deleteCount === 0} style={{
                    flex: 2, background: deleteCount > 0 ? "#dc2626" : "#e5e5ea", border: "none",
                    color: deleteCount > 0 ? "#ffffff" : "#8e8e93", borderRadius: 12, padding: "14px",
                    fontSize: 15, fontWeight: 700, minHeight: 44, cursor: deleteCount > 0 ? "pointer" : "default"
                  }}>Verwijder {deleteCount} bestand{deleteCount !== 1 ? "en" : ""}</button>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* Delete bevestiging modal */}
      {deleteConfirm && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end", zIndex: 100 }}>
          <div style={{ background: "#ffffff", borderRadius: "16px 16px 0 0", padding: "24px 16px 40px", width: "100%" }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 8px", color: "#1c1c1e" }}>Verwijder definitief?</h2>
            <p style={{ fontSize: 14, color: "#8e8e93", margin: "0 0 16px" }}>Deze bestanden worden permanent verwijderd van GitHub:</p>
            <div style={{ background: "#fff5f5", border: "1px solid #fecaca", borderRadius: 10, padding: "10px 14px", marginBottom: 20 }}>
              {Object.entries(deleteSelected).filter(([, v]) => v).map(([path]) => (
                <p key={path} style={{ fontSize: 13, color: "#dc2626", margin: "4px 0", fontFamily: "monospace" }}>{path}</p>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setDeleteConfirm(false)} style={{
                flex: 1, background: "#ffffff", border: "1px solid #e5e5ea", color: "#1c1c1e",
                borderRadius: 12, padding: "14px", fontSize: 15, fontWeight: 600, minHeight: 44, cursor: "pointer"
              }}>Annuleer</button>
              <button onClick={handleDelete} disabled={deleting} style={{
                flex: 2, background: deleting ? "#e5e5ea" : "#dc2626", border: "none",
                color: "#ffffff", borderRadius: 12, padding: "14px", fontSize: 15,
                fontWeight: 700, minHeight: 44, cursor: deleting ? "default" : "pointer"
              }}>
                {deleting ? "Verwijderen..." : `Verwijder ${deleteCount} bestand${deleteCount !== 1 ? "en" : ""}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
