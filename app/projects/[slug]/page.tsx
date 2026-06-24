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

  // Tags state
  const [tags, setTags] = useState<{ name: string; sha: string }[]>([])
  const [tagsLoaded, setTagsLoaded] = useState(false)
  const [creatingTag, setCreatingTag] = useState(false)
  const [tagResult, setTagResult] = useState<{ tag: string; message: string } | null>(null)
  const [lastCommitSha, setLastCommitSha] = useState<string | null>(null)

  // Copy to Claude state
  const [copyMode, setCopyMode] = useState(false)
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [copied, setCopied] = useState(false)

  if (!project) return null

  const statusColor = STATUS_COLOR[project.status]

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

      // Laad tags
      if (!tagsLoaded) {
        const tagRes = await fetch(`/api/tags?slug=${slug}`)
        const tagData = await tagRes.json()
        if (tagRes.ok) {
          setTags(tagData.tags)
          setTagsLoaded(true)
          if (tagData.tags.length > 0) {
            setLastCommitSha(tagData.tags[0].sha)
          }
        }
      }
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
        // Standaard alle bestanden aangevinkt
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
    if (!lastCommitSha && !snapshot) return
    setCreatingTag(true)
    try {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectSlug: slug,
          sha: lastCommitSha ?? ""
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setTagResult(data)
      // Refresh tags
      const tagRes = await fetch(`/api/tags?slug=${slug}`)
      const tagData = await tagRes.json()
      if (tagRes.ok) setTags(tagData.tags)
    } catch (e) {
      setError(String(e))
    } finally {
      setCreatingTag(false)
    }
  }

  function buildClaudeContext(): string {
    if (!snapshot || !project) return ""
    const selectedFiles = snapshot.files.filter(f => selected[f.path])

    const fileTree = selectedFiles.map(f => `  ${f.path}`).join("\n")
    const fileContents = selectedFiles.map(f =>
      `### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``
    ).join("\n\n")

    return `# Project: ${project.name}
Repository: ${project.githubRepo}

## Bestandsstructuur
\`\`\`
${fileTree}
\`\`\`

## Bestandsinhoud

${fileContents}`
  }

  async function copyToClipboard() {
    const context = buildClaudeContext()
    await navigator.clipboard.writeText(context)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  // Group files by top-level directory
  const fileTree: Record<string, { path: string; content: string; sha?: string }[]> = {}
  if (snapshot) {
    for (const file of snapshot.files) {
      const dir = file.path.includes("/") ? file.path.split("/")[0] : "root"
      if (!fileTree[dir]) fileTree[dir] = []
      fileTree[dir].push(file)
    }
  }

  const selectedCount = Object.values(selected).filter(Boolean).length

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
          <Link href="/" style={{
            fontSize: 15,
            color: "#007aff",
            textDecoration: "none",
            minHeight: 44,
            display: "flex",
            alignItems: "center"
          }}>
            ←
          </Link>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: statusColor }} />
              <span style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: statusColor, fontWeight: 700 }}>
                {project.status}
              </span>
            </div>
            <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0, letterSpacing: "-0.01em", color: "#1c1c1e" }}>
              {project.name}
            </h1>
          </div>
          {copyMode && (
            <button
              onClick={() => { setCopyMode(false); setCopied(false) }}
              style={{ fontSize: 13, color: "#8e8e93", background: "none", border: "none", cursor: "pointer", minHeight: 44 }}
            >
              Annuleer
            </button>
          )}
        </div>

        <div style={{ padding: "16px" }}>

          {/* Repo info */}
          <div style={{
            background: "#ffffff",
            border: "1px solid #e5e5ea",
            borderRadius: 12,
            padding: "12px 16px",
            marginBottom: 12
          }}>
            <p style={{ fontSize: 11, color: "#8e8e93", margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Repository</p>
            <p style={{ fontSize: 14, color: "#1c1c1e", margin: 0, fontFamily: "monospace" }}>{project.githubRepo}</p>
          </div>

          {/* Acties */}
          {!copyMode && project.status === "active" && (
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <Link
                href={`/projects/${slug}/import`}
                style={{
                  flex: 1,
                  background: "#007aff",
                  color: "#ffffff",
                  borderRadius: 12,
                  padding: "14px",
                  fontSize: 15,
                  fontWeight: 600,
                  textAlign: "center",
                  textDecoration: "none",
                  minHeight: 44,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                ZIP Import
              </Link>
              <a
                href={`https://github.com/${project.githubRepo}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  flex: 1,
                  background: "#ffffff",
                  border: "1px solid #e5e5ea",
                  color: "#1c1c1e",
                  borderRadius: 12,
                  padding: "14px",
                  fontSize: 15,
                  fontWeight: 600,
                  textAlign: "center",
                  textDecoration: "none",
                  minHeight: 44,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                GitHub →
              </a>
            </div>
          )}

          {/* Herstelpunten */}
          {!copyMode && treeLoaded && (
            <div style={{ marginBottom: 12 }}>
              {/* Maak herstelpunt knop */}
              <button
                onClick={createRestorePoint}
                disabled={creatingTag}
                style={{
                  width: "100%",
                  background: "#ffffff",
                  border: "1px solid #e5e5ea",
                  borderRadius: 12,
                  padding: "14px 16px",
                  fontSize: 15,
                  fontWeight: 600,
                  color: creatingTag ? "#8e8e93" : "#1c1c1e",
                  cursor: creatingTag ? "default" : "pointer",
                  minHeight: 44,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 8
                }}
              >
                <span>{creatingTag ? "Aanmaken..." : "🔖 Maak herstelpunt"}</span>
              </button>

              {/* Tag bevestiging */}
              {tagResult && (
                <div style={{
                  background: "#f0fdf4",
                  border: "1px solid #86efac",
                  borderRadius: 10,
                  padding: "10px 14px",
                  marginBottom: 8
                }}>
                  <p style={{ fontSize: 13, color: "#16a34a", margin: 0, fontWeight: 600 }}>
                    ✓ {tagResult.tag} aangemaakt
                  </p>
                </div>
              )}

              {/* Tags lijst */}
              {tags.length > 0 && (
                <div style={{
                  background: "#ffffff",
                  border: "1px solid #e5e5ea",
                  borderRadius: 12,
                  overflow: "hidden"
                }}>
                  <div style={{ padding: "8px 16px", backgroundColor: "#f9f9fb", borderBottom: "1px solid #f2f2f7" }}>
                    <p style={{ fontSize: 12, color: "#6b7280", margin: 0, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      Herstelpunten
                    </p>
                  </div>
                  {tags.slice(0, 5).map((tag, i) => (
                    <div key={tag.name} style={{
                      padding: "12px 16px",
                      borderTop: i > 0 ? "1px solid #f2f2f7" : "none",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between"
                    }}>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 600, color: "#1c1c1e", margin: 0 }}>
                          {tag.name}
                        </p>
                        <p style={{ fontSize: 12, color: "#8e8e93", margin: "2px 0 0", fontFamily: "monospace" }}>
                          {tag.sha.slice(0, 7)}
                        </p>
                      </div>
                      <a
                        href={`https://github.com/${project.githubRepo}/tree/${tag.name}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: 13, color: "#007aff", textDecoration: "none" }}
                      >
                        Bekijk →
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Kopieer naar Claude knop */}
          {!copyMode && (
            <button
              onClick={loadAndCopy}
              style={{
                width: "100%",
                background: loading ? "#e5e5ea" : "#1c1c1e",
                border: "none",
                color: loading ? "#8e8e93" : "#ffffff",
                borderRadius: 12,
                padding: "14px",
                fontSize: 15,
                fontWeight: 600,
                minHeight: 44,
                cursor: loading ? "default" : "pointer",
                marginBottom: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8
              }}
            >
              {loading ? "Laden..." : "✂ Kopieer naar Claude"}
            </button>
          )}

          {/* Bekijk bestanden knop */}
          {!copyMode && (
            <button
              onClick={loadTree}
              style={{
                width: "100%",
                background: "#ffffff",
                border: "1px solid #e5e5ea",
                borderRadius: 12,
                padding: "14px 16px",
                fontSize: 15,
                fontWeight: 600,
                color: "#1c1c1e",
                cursor: "pointer",
                minHeight: 44,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: treeOpen && !copyMode ? 0 : 12
              }}
            >
              <span>{loading ? "Laden..." : treeLoaded ? `${snapshot?.files.length} bestanden` : "Bekijk bestanden"}</span>
              {!loading && (
                <span style={{
                  transform: treeOpen ? "rotate(90deg)" : "rotate(0deg)",
                  transition: "transform 0.2s",
                  display: "inline-block",
                  color: "#8e8e93"
                }}>›</span>
              )}
            </button>
          )}

          {/* Error */}
          {error && (
            <div style={{ background: "#fff5f5", border: "1px solid #fecaca", borderRadius: 10, padding: 14, marginBottom: 12 }}>
              <p style={{ fontSize: 13, color: "#dc2626", margin: 0 }}>{error}</p>
            </div>
          )}

          {/* COPY MODE — file selectie */}
          {copyMode && snapshot && (
            <div>
              <div style={{
                background: "#ffffff",
                border: "1px solid #e5e5ea",
                borderRadius: 12,
                padding: "12px 16px",
                marginBottom: 12,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}>
                <p style={{ fontSize: 13, color: "#8e8e93", margin: 0 }}>
                  {selectedCount} van {snapshot.files.length} geselecteerd
                </p>
                <button
                  onClick={() => {
                    const allSelected = snapshot.files.every(f => selected[f.path])
                    const next: Record<string, boolean> = {}
                    snapshot.files.forEach(f => { next[f.path] = !allSelected })
                    setSelected(next)
                  }}
                  style={{ fontSize: 13, color: "#007aff", background: "none", border: "none", cursor: "pointer" }}
                >
                  {snapshot.files.every(f => selected[f.path]) ? "Alles uit" : "Alles aan"}
                </button>
              </div>

              {/* File tree met checkboxes */}
              <div style={{
                background: "#ffffff",
                border: "1px solid #e5e5ea",
                borderRadius: 12,
                overflow: "hidden",
                marginBottom: 12
              }}>
                {Object.entries(fileTree).map(([dir, files], di) => (
                  <div key={dir} style={{ borderTop: di > 0 ? "1px solid #f2f2f7" : "none" }}>
                    {/* Dir header */}
                    <div style={{
                      padding: "8px 16px",
                      backgroundColor: "#f9f9fb",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between"
                    }}>
                      <p style={{ fontSize: 12, color: "#6b7280", margin: 0, fontFamily: "monospace", fontWeight: 600 }}>
                        {dir}/
                      </p>
                      <button
                        onClick={() => {
                          const allOn = files.every(f => selected[f.path])
                          const next = { ...selected }
                          files.forEach(f => { next[f.path] = !allOn })
                          setSelected(next)
                        }}
                        style={{ fontSize: 11, color: "#007aff", background: "none", border: "none", cursor: "pointer" }}
                      >
                        {files.every(f => selected[f.path]) ? "Uit" : "Aan"}
                      </button>
                    </div>

                    {/* Files */}
                    {files.map((file, fi) => (
                      <div
                        key={file.path}
                        onClick={() => setSelected(s => ({ ...s, [file.path]: !s[file.path] }))}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          padding: "11px 16px",
                          borderTop: fi > 0 ? "1px solid #f2f2f7" : "none",
                          cursor: "pointer",
                          minHeight: 44
                        }}
                      >
                        <div style={{
                          width: 22,
                          height: 22,
                          borderRadius: 6,
                          border: selected[file.path] ? "none" : "2px solid #d1d1d6",
                          backgroundColor: selected[file.path] ? "#1c1c1e" : "transparent",
                          flexShrink: 0,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center"
                        }}>
                          {selected[file.path] && (
                            <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
                              <path d="M1 5L4.5 8.5L11 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </div>
                        <p style={{
                          fontSize: 13,
                          color: selected[file.path] ? "#1c1c1e" : "#8e8e93",
                          margin: 0,
                          fontFamily: "monospace",
                          flex: 1,
                          wordBreak: "break-all"
                        }}>
                          {file.path.includes("/") ? file.path.split("/").slice(1).join("/") : file.path}
                        </p>
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              {/* Kopieer knop */}
              <button
                onClick={copyToClipboard}
                disabled={selectedCount === 0}
                style={{
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
                }}
              >
                {copied ? "✓ Gekopieerd!" : `Kopieer ${selectedCount} bestand${selectedCount !== 1 ? "en" : ""} naar Claude`}
              </button>
            </div>
          )}

          {/* Normale file tree (geen copy mode) */}
          {treeOpen && !copyMode && snapshot && (
            <div style={{
              background: "#ffffff",
              border: "1px solid #e5e5ea",
              borderTop: "none",
              borderRadius: "0 0 12px 12px",
              overflow: "hidden",
              marginBottom: 12
            }}>
              {Object.entries(fileTree).map(([dir, files], i) => (
                <div key={dir} style={{ borderTop: i > 0 ? "1px solid #f2f2f7" : "none" }}>
                  <div style={{ padding: "8px 16px", backgroundColor: "#f9f9fb" }}>
                    <p style={{ fontSize: 12, color: "#6b7280", margin: 0, fontFamily: "monospace", fontWeight: 600 }}>
                      {dir}/
                    </p>
                  </div>
                  {files.map((file, fi) => (
                    <div key={file.path} style={{ padding: "7px 16px 7px 28px", borderTop: fi > 0 ? "1px solid #f2f2f7" : "none" }}>
                      <p style={{ fontSize: 13, color: "#8e8e93", margin: 0, fontFamily: "monospace" }}>
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
          )}

        </div>
      </div>
    </main>
  )
}
