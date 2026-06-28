"use client"

import { useState, useEffect } from "react"
import { getStoredMode, storeMode, THEME as T } from "@/lib/theme"
import { PROJECTS } from "@/lib/projects"
import type { ProjectStatus } from "@/types"
import Link from "next/link"

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

const THEME = {
  light: {
    bg: "#f5f5f7",
    card: "#ffffff",
    border: "#e5e5ea",
    headerBg: "#ffffff",
    title: "#1c1c1e",
    subtitle: "#8e8e93",
    repo: "#8e8e93",
    arrow: "#c7c7cc",
    statusLink: "#8e8e93",
    archiveOpacity: 0.5
  },
  dark: {
    bg: "#0a0a0f",
    card: "#12121a",
    border: "#1e1e2e",
    headerBg: "#0a0a0f",
    title: "#e8e8f0",
    subtitle: "#5a5a7a",
    repo: "#4a4a6a",
    arrow: "#3a3a5a",
    statusLink: "#3a3a5a",
    archiveOpacity: 0.5
  }
}

export default function Home() {
  const [mode, setMode] = useState<"light" | "dark">("light")

  useEffect(() => {
    setMode(getStoredMode())
  }, [])
  const [healthStatus, setHealthStatus] = useState<Record<string, boolean>>({})
  const [fileCount, setFileCount] = useState<Record<string, number>>({})
  const [queues, setQueues] = useState<Record<string, any[]>>({})
  const [unmatched, setUnmatched] = useState<any[]>([])
  const [queueLoading, setQueueLoading] = useState(false)
  const [queueLoaded, setQueueLoaded] = useState(false)

  useEffect(() => {
    fetch("/api/health")
      .then(r => r.json())
      .then(data => {
        const status: Record<string, boolean> = {}
        const counts: Record<string, number> = {}
        data.projects?.forEach((p: { slug: string; ok: boolean; fileCount?: number }) => {
          status[p.slug] = p.ok
          if (p.fileCount) counts[p.slug] = p.fileCount
        })
        setHealthStatus(status)
        setFileCount(counts)
      })
      .catch(() => {})
  }, [])
  const [collapsed, setCollapsed] = useState<Record<ProjectStatus, boolean>>({
    active: false,
    experimental: true,
    archive: true
  })

  const t = THEME[mode]
  const s = STATUS_CONFIG[mode]

  const grouped = STATUS_ORDER.map(status => ({
    status,
    projects: PROJECTS.filter(p => p.status === status)
  }))

  async function loadQueues() {
    setQueueLoading(true)
    try {
      const res = await fetch("/api/dropbox/list")
      const data = await res.json()
      if (res.ok) {
        setQueues(data.queues ?? {})
        setUnmatched(data.unmatched ?? [])
        setQueueLoaded(true)
      }
    } catch {}
    setQueueLoading(false)
  }

  return (
    <main style={{
      minHeight: "100dvh",
      backgroundColor: t.bg,
      color: t.title,
      fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
      padding: "env(safe-area-inset-top, 0px) 0 env(safe-area-inset-bottom, 40px)",
      transition: "background-color 0.2s, color 0.2s"
    }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>

        {/* Header */}
        <div style={{
          position: "sticky",
          top: 0,
          backgroundColor: t.headerBg,
          padding: "16px 16px 12px",
          borderBottom: `1px solid ${t.border}`,
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
              color: t.subtitle,
              margin: "0 0 2px"
            }}>
              AI Project State Engine
            </p>
            <h1 style={{
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              margin: 0,
              color: t.title
            }}>
              CodeSync
            </h1>
          </div>

          {/* Day/Night toggle */}
          <button
            onClick={() => { const next = mode === "light" ? "dark" : "light"; setMode(next); storeMode(next); document.documentElement.setAttribute("data-theme", next) }}
            style={{
              background: t.card,
              border: `1px solid ${t.border}`,
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
            background: t.card,
            border: `1px solid ${t.border}`,
            borderRadius: 12,
            padding: "14px 16px",
            fontSize: 15,
            fontWeight: 600,
            color: t.title,
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
                  background: t.card,
                  border: `1px solid ${t.border}`,
                  borderRadius: 12,
                  marginBottom: 8,
                  overflow: "hidden"
                }}>
                  <div style={{ padding: "10px 16px", borderBottom: `1px solid ${t.border}` }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: t.title, margin: 0 }}>
                      {PROJECTS.find(p => p.slug === slug)?.name ?? slug}
                      <span style={{ color: t.subtitle, fontWeight: 400, marginLeft: 8 }}>
                        {zips.length} ZIP{zips.length !== 1 ? "s" : ""}
                      </span>
                    </p>
                  </div>
                  {(zips as any[]).map((zip: any, i: number) => (
                    <div key={zip.path} style={{
                      padding: "10px 16px",
                      borderTop: i > 0 ? `1px solid ${t.border}` : "none",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between"
                    }}>
                      <div>
                        <p style={{ fontSize: 13, color: t.title, margin: 0, fontFamily: "monospace" }}>
                          {zip.isFix && <span style={{ color: "#d97706", marginRight: 4 }}>🔧</span>}
                          {zip.name}
                        </p>
                        <p style={{ fontSize: 11, color: t.subtitle, margin: "2px 0 0" }}>
                          {(zip.size / 1024).toFixed(0)} KB
                        </p>
                      </div>
                      <Link href={`/projects/${slug}/import?dropbox=${encodeURIComponent(zip.path)}`}
                        style={{
                          background: "#007aff",
                          color: "#ffffff",
                          borderRadius: 8,
                          padding: "6px 14px",
                          fontSize: 13,
                          fontWeight: 600,
                          textDecoration: "none"
                        }}>
                        Verwerk
                      </Link>
                    </div>
                  ))}
                </div>
              ))}

              {unmatched.length > 0 && (
                <div style={{ background: t.card, border: `1px solid #fde68a`, borderRadius: 12, padding: "10px 16px" }}>
                  <p style={{ fontSize: 12, color: "#92400e", margin: 0 }}>
                    ⚠ {unmatched.length} ZIP{unmatched.length !== 1 ? "s" : ""} niet herkend: {unmatched.map((z: any) => z.name).join(", ")}
                  </p>
                </div>
              )}
            </div>
          )}

          {queueLoaded && Object.keys(queues).length === 0 && unmatched.length === 0 && (
            <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: "12px 16px", marginBottom: 12 }}>
              <p style={{ fontSize: 13, color: t.subtitle, margin: 0 }}>✓ Geen nieuwe ZIPs in Dropbox</p>
            </div>
          )}
        </div>

        {/* Project groups */}
        <div style={{ padding: "0 16px 0" }}>
          {grouped.map(({ status, projects }) => {
            const config = s[status]
            const isCollapsed = collapsed[status]

            async function loadQueues() {
    setQueueLoading(true)
    try {
      const res = await fetch("/api/dropbox/list")
      const data = await res.json()
      if (res.ok) {
        setQueues(data.queues ?? {})
        setUnmatched(data.unmatched ?? [])
        setQueueLoaded(true)
      }
    } catch {}
    setQueueLoading(false)
  }

  return (
              <div key={status} style={{ marginBottom: 20 }}>

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
                    color: t.subtitle,
                    marginRight: 4
                  }}>
                    {projects.length}
                  </span>
                  <span style={{
                    fontSize: 12,
                    color: t.arrow,
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
                      <Link
                        key={project.slug}
                        href={`/projects/${project.slug}`}
                        style={{ textDecoration: "none" }}
                      >
                        <div style={{
                          background: t.card,
                          border: `1px solid ${t.border}`,
                          borderRadius: 12,
                          padding: "14px 16px",
                          minHeight: 44,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          opacity: status === "archive" ? t.archiveOpacity : 1,
                          transition: "background 0.2s"
                        }}>
                          <div style={{ flex: 1 }}>
                            <p style={{
                              fontSize: 16,
                              fontWeight: 600,
                              color: t.title,
                              margin: 0,
                              letterSpacing: "-0.01em"
                            }}>
                              {project.name}
                            </p>
                            <p style={{
                              fontSize: 12,
                              color: t.repo,
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
                            {project.status === "active" && (
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
                            <span style={{ color: t.arrow, fontSize: 18 }}>›</span>
                          </div>
                        </div>
                      </Link>
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
              color: t.statusLink,
              textDecoration: "none"
            }}
          >
            GitHub status →
          </Link>
        </div>

      </div>
    </main>
  )
}
