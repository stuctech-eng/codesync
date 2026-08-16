"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { PROJECTS } from "@/lib/projects"
import { authFetch } from "@/lib/access-key"

type ChangesetFile = {
  path: string
  action: "create" | "modify" | "delete"
  content?: string
}

type Changeset = {
  id: string
  projectSlug: string
  files: ChangesetFile[]
  explanation: string
  status: string
  createdAt: string
  appliedCommitSha?: string
  error?: string
}

// Review-scherm voor een door Claude voorgesteld wijzigingsvoorstel
// (Master Plan v1.3, Taak B). Hergebruikt bewust dezelfde visuele stijl
// als de bestaande ZIP-import-review (kleurcodering per actie, geen
// nieuwe diff-viewer), maar met Goedkeuren/Afwijzen i.p.v. Push.
export default function ChangesetPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string
  const changesetId = params.id as string
  const project = PROJECTS.find(p => p.slug === slug)

  const [changeset, setChangeset] = useState<Changeset | null>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState("")
  const [expandedFile, setExpandedFile] = useState<string | null>(null)

  useEffect(() => {
    authFetch(`/api/changesets?id=${changesetId}`)
      .then(res => res.json())
      .then(data => {
        if (data.changeset) setChangeset(data.changeset)
        else setError(data.error ?? "Changeset niet gevonden")
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [changesetId])

  async function handleApprove() {
    setProcessing(true)
    setError("")
    try {
      const res = await authFetch(`/api/changesets/${changesetId}/approve`, { method: "POST" })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`)
      }
      setChangeset(c => c ? { ...c, status: "applied", appliedCommitSha: data.commitSha } : c)
    } catch (e) {
      setError(String(e))
    } finally {
      setProcessing(false)
    }
  }

  async function handleReject() {
    setProcessing(true)
    setError("")
    try {
      const res = await authFetch(`/api/changesets/${changesetId}/reject`, { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      setChangeset(c => c ? { ...c, status: "rejected" } : c)
    } catch (e) {
      setError(String(e))
    } finally {
      setProcessing(false)
    }
  }

  function actionLabel(action: string): { label: string; color: string; bg: string } {
    if (action === "create") return { label: "NIEUW", color: "#16a34a", bg: "#f0fdf4" }
    if (action === "delete") return { label: "VERWIJDEREN", color: "#dc2626", bg: "#fef2f2" }
    return { label: "GEWIJZIGD", color: "#ca8a04", bg: "#fefce8" }
  }

  if (!project) return null

  return (
    <main style={{
      minHeight: "100dvh",
      backgroundColor: "var(--bg)",
      color: "var(--title)",
      fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
    }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <div style={{
          position: "sticky", top: 0, backgroundColor: "var(--header-bg)",
          borderBottom: "1px solid var(--border)", padding: "12px 16px",
          display: "flex", alignItems: "center", gap: 12, zIndex: 10
        }}>
          <Link href={`/projects/${slug}/chat`} style={{ fontSize: 15, color: "#007aff", textDecoration: "none", minHeight: 44, display: "flex", alignItems: "center" }}>←</Link>
          <div>
            <p style={{ fontSize: 11, color: "var(--subtitle)", margin: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>Wijzigingsvoorstel</p>
            <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{project.name}</h1>
          </div>
        </div>

        <div style={{ padding: 16 }}>
          {loading && <p style={{ fontSize: 14, color: "var(--muted)", textAlign: "center" }}>Laden...</p>}

          {error && (
            <div style={{ background: "#fff5f5", border: "1px solid #fecaca", borderRadius: 10, padding: "12px 14px", marginBottom: 12 }}>
              <p style={{ fontSize: 13, color: "#dc2626", margin: 0 }}>{error}</p>
            </div>
          )}

          {changeset && (
            <>
              <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: 16, marginBottom: 16 }}>
                <p style={{ fontSize: 15, margin: "0 0 4px", lineHeight: 1.5 }}>{changeset.explanation}</p>
                <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>
                  {changeset.files.length} bestand{changeset.files.length !== 1 ? "en" : ""} · status: <strong>{changeset.status}</strong>
                </p>
              </div>

              {changeset.status === "applied" && (
                <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "12px 14px", marginBottom: 16 }}>
                  <p style={{ fontSize: 13, color: "#16a34a", margin: 0, fontWeight: 600 }}>✓ Toegepast en gecommit naar GitHub</p>
                  {changeset.appliedCommitSha && (
                    <p style={{ fontSize: 11, color: "#16a34a", margin: "4px 0 0", fontFamily: "monospace" }}>
                      {changeset.appliedCommitSha.slice(0, 7)}
                    </p>
                  )}
                </div>
              )}

              {changeset.status === "stale" && (
                <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "12px 14px", marginBottom: 16 }}>
                  <p style={{ fontSize: 13, color: "#92400e", margin: 0, fontWeight: 600 }}>⚠ GitHub is gewijzigd sinds dit voorstel</p>
                  <p style={{ fontSize: 12, color: "#92400e", margin: "4px 0 0" }}>
                    Om te voorkomen dat een nieuwere wijziging per ongeluk wordt overschreven, is dit voorstel niet toegepast. Vraag Claude om het voorstel opnieuw te maken op basis van de actuele stand.
                  </p>
                </div>
              )}

              {changeset.status === "rejected" && (
                <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px", marginBottom: 16 }}>
                  <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>Afgewezen — niet toegepast.</p>
                </div>
              )}

              {changeset.status === "failed" && changeset.error && (
                <div style={{ background: "#fff5f5", border: "1px solid #fecaca", borderRadius: 10, padding: "12px 14px", marginBottom: 16 }}>
                  <p style={{ fontSize: 13, color: "#dc2626", margin: 0, fontWeight: 600 }}>✗ Mislukt</p>
                  <p style={{ fontSize: 12, color: "#dc2626", margin: "4px 0 0", fontFamily: "monospace" }}>{changeset.error}</p>
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
                {changeset.files.map(file => {
                  const { label, color, bg } = actionLabel(file.action)
                  const isExpanded = expandedFile === file.path
                  return (
                    <div key={file.path} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
                      <button
                        onClick={() => setExpandedFile(isExpanded ? null : file.path)}
                        style={{
                          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                          padding: "12px 14px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left"
                        }}
                      >
                        <span style={{ fontSize: 13, fontFamily: "monospace", color: "var(--title)" }}>{file.path}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, color, background: bg, padding: "2px 8px", borderRadius: 6, whiteSpace: "nowrap" }}>
                          {label}
                        </span>
                      </button>
                      {isExpanded && file.content && (
                        <pre style={{
                          margin: 0, padding: "12px 14px", fontSize: 11, lineHeight: 1.5,
                          background: "var(--bg)", borderTop: "1px solid var(--border)",
                          overflow: "auto", maxHeight: 300, whiteSpace: "pre-wrap", wordBreak: "break-word"
                        }}>
                          {file.content}
                        </pre>
                      )}
                    </div>
                  )
                })}
              </div>

              {changeset.status === "proposed" && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={handleReject}
                    disabled={processing}
                    style={{
                      flex: 1, padding: "14px", borderRadius: 12, border: "1px solid var(--border)",
                      background: "var(--card)", color: "var(--title)", fontSize: 15, fontWeight: 600,
                      cursor: processing ? "default" : "pointer"
                    }}
                  >
                    Afwijzen
                  </button>
                  <button
                    onClick={handleApprove}
                    disabled={processing}
                    style={{
                      flex: 1, padding: "14px", borderRadius: 12, border: "none",
                      background: processing ? "var(--border)" : "#16a34a", color: "#ffffff",
                      fontSize: 15, fontWeight: 700, cursor: processing ? "default" : "pointer"
                    }}
                  >
                    {processing ? "Bezig..." : "Goedkeuren →"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  )
}
