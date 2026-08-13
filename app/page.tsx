"use client"

import { useState, useEffect, useRef } from "react"
import { getStoredMode, storeMode } from "@/lib/theme"
import { authFetch } from "@/lib/access-key"
import { PROJECTS } from "@/lib/projects"
import type { ProjectStatus } from "@/types"
import Link from "next/link"
import { useRouter } from "next/navigation"

const STATUS_ORDER: ProjectStatus[] = ["active", "experimental", "archive"]

const STATUS_CONFIG = {
  light: {
    active:       { label: "ACTIVE",       dot: "#16a34a", text: "#15803d" },
    experimental: { label: "EXPERIMENTAL", dot: "#d97706", text: "#b45309" },
    archive:      { label: "ARCHIVE",      dot: "#9ca3af", text: "#6b7280" }
  },
  dark: {
    active:       { label: "ACTIVE",       dot: "#4ade80", text: "#4ade80" },
    experimental: { label: "EXPERIMENTAL", dot: "#facc15", text: "#facc15" },
    archive:      { label: "ARCHIVE",      dot: "#4a4a6a", text: "#4a4a6a" }
  }
}

export default function Home() {
  const router = useRouter()
  const [mode, setMode] = useState<"light" | "dark">("light")

  useEffect(() => {
    setMode(getStoredMode())
  }, [])
  const [healthStatus, setHealthStatus] = useState<Record<string, boolean>>({})
  const [fileCount, setFileCount] = useState<Record<string, number>>({})
  const [lastCommit, setLastCommit] = useState<Record<string, string | null>>({})
  const [queues, setQueues] = useState<Record<string, any[]>>({})
  const [unmatched, setUnmatched] = useState<any[]>([])
  const [queueLoading, setQueueLoading] = useState(false)
  const [queueLoaded, setQueueLoaded] = useState(false)
  const [deleteConfirmZip, setDeleteConfirmZip] = useState<string | null>(null)
  const [deletingZip, setDeletingZip] = useState<string | null>(null)

  // Handmatige status-wijzigingen (via slepen), opgeslagen in Firestore
  const [statusOverrides, setStatusOverrides] = useState<Record<string, ProjectStatus>>({})

  // Sleep-state
  const [dragSlug, setDragSlug] = useState<string | null>(null)
  const [dragPos, setDragPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [dragOverStatus, setDragOverStatus] = useState<ProjectStatus | null>(null)
  const sectionRefs = useRef<Record<ProjectStatus, HTMLDivElement | null>>({
    active: null,
    experimental: null,
    archive: null
  })
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const touchStartPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const dragCardLabel = useRef<string>("")
  const justDragged = useRef(false)

  function effectiveStatus(project: { slug: string; status: ProjectStatus }): ProjectStatus {
    return statusOverrides[project.slug] ?? project.status
  }

  useEffect(() => {
    authFetch("/api/projects/status")
      .then(r => r.json())
      .then(data => setStatusOverrides(data.overrides ?? {}))
      .catch(() => {})
  }, [])

  useEffect(() => {
    authFetch("/api/health")
      .then(r => r.json())
      .then(data => {
        const status: Record<string, boolean> = {}
        const counts: Record<string, number> = {}
        const commits: Record<string, string | null> = {}
        data.projects?.forEach((p: { slug: string; ok: boolean; fileCount?: number; lastCommitDate?: string | null }) => {
          status[p.slug] = p.ok
          if (p.fileCount) counts[p.slug] = p.fileCount
          commits[p.slug] = p.lastCommitDate ?? null
        })
        setHealthStatus(status)
        setFileCount(counts)
        setLastCommit(commits)
      })
      .catch(() => {})
  }, [])

  // Wachtrij automatisch verversen zodra je terugkomt in de app
  // (bijv. na het wisselen naar een andere app om de ZIP te kopiëren)
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === "visible" && queueLoaded) {
        loadQueues()
      }
    }
    document.addEventListener("visibilitychange", handleVisibility)
    return () => document.removeEventListener("visibilitychange", handleVisibility)
  }, [queueLoaded])
  const [collapsed, setCollapsed] = useState<Record<ProjectStatus, boolean>>({
    active: false,
    experimental: true,
    archive: true
  })

  const s = STATUS_CONFIG[mode]

  const grouped = STATUS_ORDER.map(status => {
    let projects = PROJECTS.filter(p => effectiveStatus(p) === status)

    // Laatst gebruikte repo bovenaan — alleen zinvol voor ACTIVE (health data)
    if (status === "active") {
      projects = [...projects].sort((a, b) => {
        const da = lastCommit[a.slug]
        const db = lastCommit[b.slug]
        if (da && db) return new Date(db).getTime() - new Date(da).getTime()
        if (da) return -1
        if (db) return 1
        return 0
      })
    }

    return { status, projects }
  })

  function handleCardTouchStart(e: React.TouchEvent, project: { slug: string; status: ProjectStatus; name: string }) {
    const touch = e.touches[0]
    touchStartPos.current = { x: touch.clientX, y: touch.clientY }
    dragCardLabel.current = project.name

    longPressTimer.current = setTimeout(() => {
      setDragSlug(project.slug)
      setDragPos({ x: touch.clientX, y: touch.clientY })
      setDragOverStatus(effectiveStatus(project))
      justDragged.current = true
      if (navigator.vibrate) navigator.vibrate(12)
    }, 350)
  }

  function handleCardTouchMove(e: React.TouchEvent) {
    // Vóór drag-modus: bij vroege beweging de long-press annuleren (normale scroll toestaan)
    if (dragSlug) return
    const touch = e.touches[0]
    const dx = touch.clientX - touchStartPos.current.x
    const dy = touch.clientY - touchStartPos.current.y
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current)
        longPressTimer.current = null
      }
    }
  }

  function handleCardTouchEnd() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  function handleCardClick(e: React.MouseEvent, slug: string) {
    // Voorkom navigatie als er net gesleept is
    if (justDragged.current) {
      e.preventDefault()
      return
    }
    router.push(`/projects/${slug}`)
  }

  // Document-brede listeners tijdens het slepen — nodig omdat de vinger
  // buiten de oorspronkelijke kaart kan bewegen, en om preventDefault te
  // kunnen gebruiken (voorkomt dat de pagina meescrollt tijdens het slepen)
  useEffect(() => {
    if (!dragSlug) return

    function handleMove(e: TouchEvent) {
      e.preventDefault()
      const touch = e.touches[0]
      setDragPos({ x: touch.clientX, y: touch.clientY })

      for (const status of STATUS_ORDER) {
        const el = sectionRefs.current[status]
        if (!el) continue
        const rect = el.getBoundingClientRect()
        if (touch.clientY >= rect.top - 12 && touch.clientY <= rect.bottom + 12) {
          setDragOverStatus(status)
          // Automatisch openklappen als de doelsectie is ingeklapt
          setCollapsed(c => (c[status] ? { ...c, [status]: false } : c))
          break
        }
      }
    }

    function handleEnd() {
      const slug = dragSlug
      const targetStatus = dragOverStatus

      if (slug && targetStatus) {
        const project = PROJECTS.find(p => p.slug === slug)
        const currentStatus = project ? effectiveStatus(project) : null

        if (currentStatus && targetStatus !== currentStatus) {
          // Optimistisch bijwerken — direct zichtbaar, geen wachttijd
          setStatusOverrides(o => ({ ...o, [slug]: targetStatus }))

          authFetch("/api/projects/status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ slug, status: targetStatus })
          }).catch(() => {
            // Bij falen: terugzetten naar de vorige status
            setStatusOverrides(o => {
              const next = { ...o }
              delete next[slug]
              return next
            })
          })
        }
      }

      setDragSlug(null)
      setDragOverStatus(null)
      // Korte vertraging zodat de klik die na touchend volgt nog geblokkeerd wordt
      setTimeout(() => { justDragged.current = false }, 80)
    }

    document.addEventListener("touchmove", handleMove, { passive: false })
    document.addEventListener("touchend", handleEnd)
    document.addEventListener("touchcancel", handleEnd)

    return () => {
      document.removeEventListener("touchmove", handleMove)
      document.removeEventListener("touchend", handleEnd)
      document.removeEventListener("touchcancel", handleEnd)
    }
  }, [dragSlug, dragOverStatus])

  async function loadQueues() {
    setQueueLoading(true)
    try {
      const res = await authFetch("/api/dropbox/list")
      const data = await res.json()
      if (res.ok) {
        setQueues(data.queues ?? {})
        setUnmatched(data.unmatched ?? [])
        setQueueLoaded(true)
      }
    } catch {}
    setQueueLoading(false)
  }

  async function deleteZip(path: string) {
    setDeletingZip(path)
    try {
      const res = await authFetch("/api/dropbox/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path })
      })
      if (res.ok) {
        // Lokaal verwijderen uit queues en unmatched — geen herlaad nodig
        setQueues(q => {
          const next: Record<string, any[]> = {}
          for (const [slug, zips] of Object.entries(q)) {
            next[slug] = (zips as any[]).filter(z => z.path !== path)
          }
          return next
        })
        setUnmatched(u => u.filter(z => z.path !== path))
      }
    } catch {}
    setDeletingZip(null)
    setDeleteConfirmZip(null)
  }

  return (
    <main style={{
      minHeight: "100dvh",
      backgroundColor: "var(--bg)",
      color: "var(--title)",
      fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
      padding: "env(safe-area-inset-top, 0px) 0 env(safe-area-inset-bottom, 40px)",
      transition: "background-color 0.2s, color 0.2s"
    }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>

        {/* Header */}
        <div style={{
          position: "sticky",
          top: 0,
          backgroundColor: "var(--header-bg)",
          padding: "16px 16px 12px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          zIndex: 10,
          transition: "background-color 0.2s, border-color 0.2s"
        }}>
          <div>
            <p style={{
              fontSize: 11,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--subtitle)",
              margin: "0 0 2px"
            }}>
              AI Project State Engine
            </p>
            <h1 style={{
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              margin: 0,
              color: "var(--title)"
            }}>
              CodeSync
            </h1>
          </div>

          {/* Day/Night toggle */}
          <button
            onClick={() => { const next = mode === "light" ? "dark" : "light"; setMode(next); storeMode(next); document.documentElement.setAttribute("data-theme", next) }}
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 20,
              padding: "8px 14px",
              fontSize: 18,
              cursor: "pointer",
              minHeight: 44,
              minWidth: 44,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "background 0.2s"
            }}
          >
            {mode === "light" ? "🌙" : "☀️"}
          </button>
        </div>

        {/* Dropbox Queue knop */}
        <div style={{ padding: "12px 16px 0" }}>
          <button onClick={loadQueues} style={{
            width: "100%",
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: "14px 16px",
            fontSize: 15,
            fontWeight: 600,
            color: "var(--title)",
            cursor: "pointer",
            minHeight: 44,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12
          }}>
            <span>📥 {queueLoading ? "Laden..." : "Importeer nieuwe ZIPs"}</span>
            {queueLoaded && Object.keys(queues).length > 0 && (
              <span style={{
                background: "#007aff",
                color: "#ffffff",
                borderRadius: 10,
                padding: "2px 8px",
                fontSize: 12,
                fontWeight: 700
              }}>
                {Object.values(queues).reduce((a, b) => a + b.length, 0)}
              </span>
            )}
          </button>

          {/* Queue per project */}
          {queueLoaded && Object.keys(queues).length > 0 && (
            <div style={{ marginBottom: 16 }}>
              {Object.entries(queues).map(([slug, zips]) => (
                <div key={slug} style={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  marginBottom: 8,
                  overflow: "hidden"
                }}>
                  <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)" }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "var(--title)", margin: 0 }}>
                      {PROJECTS.find(p => p.slug === slug)?.name ?? slug}
                      <span style={{ color: "var(--subtitle)", fontWeight: 400, marginLeft: 8 }}>
                        {zips.length} ZIP{zips.length !== 1 ? "s" : ""}
                      </span>
                    </p>
                  </div>
                  {(zips as any[]).map((zip: any, i: number) => (
                    <div key={zip.path} style={{
                      padding: "10px 16px",
                      borderTop: i > 0 ? "1px solid var(--border)" : "none",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, color: "var(--title)", margin: 0, fontFamily: "monospace", wordBreak: "break-all" }}>
                          {zip.isFix && <span style={{ color: "#d97706", marginRight: 4 }}>🔧</span>}
                          {zip.name}
                        </p>
                        <p style={{ fontSize: 11, color: "var(--subtitle)", margin: "2px 0 0" }}>
                          {(zip.size / 1024).toFixed(0)} KB
                        </p>
                      </div>
                      {deleteConfirmZip === zip.path ? (
                        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                          <button onClick={() => setDeleteConfirmZip(null)} style={{
                            background: "var(--card)", border: "1px solid var(--border)", color: "var(--title)",
                            borderRadius: 8, padding: "6px 10px", fontSize: 12, cursor: "pointer"
                          }}>Annuleer</button>
                          <button onClick={() => deleteZip(zip.path)} disabled={deletingZip === zip.path} style={{
                            background: "#dc2626", border: "none", color: "#ffffff",
                            borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer"
                          }}>{deletingZip === zip.path ? "..." : "Verwijder"}</button>
                        </div>
                      ) : (
                        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                          <button onClick={() => setDeleteConfirmZip(zip.path)} style={{
                            background: "var(--card)", border: "1px solid var(--border)", color: "#dc2626",
                            borderRadius: 8, padding: "6px 10px", fontSize: 13, cursor: "pointer", minHeight: 32
                          }}>🗑</button>
                          <Link href={`/projects/${slug}/import?dropbox=${encodeURIComponent(zip.path)}`}
                            style={{
                              background: "#007aff",
                              color: "#ffffff",
                              borderRadius: 8,
                              padding: "6px 14px",
                              fontSize: 13,
                              fontWeight: 600,
                              textDecoration: "none",
                              display: "flex",
                              alignItems: "center"
                            }}>
                            Verwerk
                          </Link>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))}

              {unmatched.length > 0 && (
                <div style={{
                  background: "var(--card)",
                  border: "1px solid #fde68a",
                  borderRadius: 12,
                  overflow: "hidden"
                }}>
                  <div style={{ padding: "10px 16px", borderBottom: "1px solid #fde68a" }}>
                    <p style={{ fontSize: 12, color: "#92400e", margin: 0, fontWeight: 700 }}>
                      ⚠ {unmatched.length} ZIP{unmatched.length !== 1 ? "s" : ""} niet herkend
                    </p>
                  </div>
                  {unmatched.map((zip: any, i: number) => (
                    <div key={zip.path} style={{
                      padding: "10px 16px",
                      borderTop: i > 0 ? "1px solid #fde68a" : "none",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, color: "var(--title)", margin: 0, fontFamily: "monospace", wordBreak: "break-all" }}>
                          {zip.name}
                        </p>
                        <p style={{ fontSize: 11, color: "var(--subtitle)", margin: "2px 0 0" }}>
                          {(zip.size / 1024).toFixed(0)} KB — geen project herkend
                        </p>
                      </div>
                      {deleteConfirmZip === zip.path ? (
                        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                          <button onClick={() => setDeleteConfirmZip(null)} style={{
                            background: "var(--card)", border: "1px solid var(--border)", color: "var(--title)",
                            borderRadius: 8, padding: "6px 10px", fontSize: 12, cursor: "pointer"
                          }}>Annuleer</button>
                          <button onClick={() => deleteZip(zip.path)} disabled={deletingZip === zip.path} style={{
                            background: "#dc2626", border: "none", color: "#ffffff",
                            borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer"
                          }}>{deletingZip === zip.path ? "..." : "Verwijder"}</button>
                        </div>
                      ) : (
                        <button onClick={() => setDeleteConfirmZip(zip.path)} style={{
                          background: "var(--card)", border: "1px solid var(--border)", color: "#dc2626",
                          borderRadius: 8, padding: "6px 10px", fontSize: 13, cursor: "pointer", minHeight: 32, flexShrink: 0
                        }}>🗑</button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {queueLoaded && Object.keys(queues).length === 0 && unmatched.length === 0 && (
            <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 16px", marginBottom: 12 }}>
              <p style={{ fontSize: 13, color: "var(--subtitle)", margin: 0 }}>✓ Geen nieuwe ZIPs in Dropbox</p>
            </div>
          )}
        </div>

        {/* Project groups */}
        <div style={{ padding: "0 16px 0" }}>
          {grouped.map(({ status, projects }) => {
            const config = s[status]
            const isCollapsed = collapsed[status]

            return (
              <div
                key={status}
                ref={el => { sectionRefs.current[status] = el }}
                style={{
                  marginBottom: 20,
                  borderRadius: 12,
                  outline: dragSlug && dragOverStatus === status ? "2px dashed #007aff" : "2px dashed transparent",
                  outlineOffset: 4,
                  transition: "outline-color 0.15s"
                }}
              >

                {/* Group header — tappable */}
                <button
                  onClick={() => setCollapsed(c => ({ ...c, [status]: !c[status] }))}
                  style={{
                    width: "100%",
                    background: "none",
                    border: "none",
                    padding: "8px 0",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    minHeight: 44
                  }}
                >
                  <div style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    backgroundColor: config.dot,
                    flexShrink: 0
                  }} />
                  <span style={{
                    fontSize: 11,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: config.text,
                    fontWeight: 700,
                    flex: 1,
                    textAlign: "left"
                  }}>
                    {config.label}
                  </span>
                  <span style={{
                    fontSize: 12,
                    color: "var(--subtitle)",
                    marginRight: 4
                  }}>
                    {projects.length}
                  </span>
                  <span style={{
                    fontSize: 12,
                    color: "var(--arrow)",
                    transform: isCollapsed ? "rotate(0deg)" : "rotate(90deg)",
                    transition: "transform 0.2s",
                    display: "inline-block"
                  }}>
                    ›
                  </span>
                </button>

                {/* Project cards */}
                {!isCollapsed && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {projects.map(project => (
                      <div
                        key={project.slug}
                        onTouchStart={e => handleCardTouchStart(e, project)}
                        onTouchMove={handleCardTouchMove}
                        onTouchEnd={handleCardTouchEnd}
                        onClick={e => handleCardClick(e, project.slug)}
                        style={{
                          textDecoration: "none",
                          cursor: "pointer",
                          opacity: dragSlug === project.slug ? 0.3 : 1,
                          transition: "opacity 0.15s",
                          touchAction: "pan-y",
                          WebkitTouchCallout: "none",
                          WebkitUserSelect: "none",
                          userSelect: "none"
                        } as React.CSSProperties}
                      >
                        <div style={{
                          background: "var(--card)",
                          border: "1px solid var(--border)",
                          borderRadius: 12,
                          padding: "14px 16px",
                          minHeight: 44,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          opacity: status === "archive" ? 0.5 : 1,
                          transition: "background 0.2s"
                        }}>
                          <div style={{ flex: 1 }}>
                            <p style={{
                              fontSize: 16,
                              fontWeight: 600,
                              color: "var(--title)",
                              margin: 0,
                              letterSpacing: "-0.01em"
                            }}>
                              {project.name}
                            </p>
                            <p style={{
                              fontSize: 12,
                              color: "var(--repo)",
                              margin: "3px 0 0",
                              fontFamily: "'SF Mono', 'Fira Code', monospace"
                            }}>
                              {project.githubRepo}
                            </p>
                            {healthStatus[project.slug] !== undefined && (
                              <p style={{
                                fontSize: 11,
                                color: healthStatus[project.slug] ? "#16a34a" : "#dc2626",
                                margin: "3px 0 0"
                              }}>
                                {healthStatus[project.slug]
                                  ? `● ${fileCount[project.slug] ? `${fileCount[project.slug]} bestanden` : "verbonden"}`
                                  : "● niet bereikbaar"}
                              </p>
                            )}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            {effectiveStatus(project) === "active" && (
                              <Link
                                href={`/projects/${project.slug}/import`}
                                onClick={e => e.stopPropagation()}
                                style={{
                                  background: "#007aff",
                                  color: "#ffffff",
                                  borderRadius: 8,
                                  padding: "6px 12px",
                                  fontSize: 12,
                                  fontWeight: 600,
                                  textDecoration: "none",
                                  minHeight: 32,
                                  display: "flex",
                                  alignItems: "center"
                                }}
                              >
                                ZIP
                              </Link>
                            )}
                            <span style={{ color: "var(--arrow)", fontSize: 18 }}>›</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div style={{ padding: "8px 16px 0", textAlign: "center" }}>
          <Link
            href="/api/health"
            style={{
              fontSize: 12,
              color: "var(--muted)",
              textDecoration: "none"
            }}
          >
            GitHub status →
          </Link>
        </div>

      </div>

      {/* Ghost-kaart tijdens het slepen */}
      {dragSlug && (
        <div style={{
          position: "fixed",
          left: dragPos.x - 100,
          top: dragPos.y - 24,
          width: 200,
          pointerEvents: "none",
          zIndex: 100,
          background: "var(--card)",
          border: "2px solid #007aff",
          borderRadius: 12,
          padding: "12px 14px",
          boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
          transform: "scale(1.03)"
        }}>
          <p style={{
            fontSize: 14,
            fontWeight: 600,
            color: "var(--title)",
            margin: 0,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis"
          }}>
            {dragCardLabel.current}
          </p>
          {dragOverStatus && (
            <p style={{ fontSize: 11, color: "#007aff", margin: "2px 0 0", fontWeight: 600 }}>
              → {STATUS_CONFIG[mode][dragOverStatus].label}
            </p>
          )}
        </div>
      )}
    </main>
  )
} 
