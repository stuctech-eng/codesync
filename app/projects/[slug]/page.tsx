"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
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
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  // Group files by top-level directory
  const fileTree: Record<string, string[]> = {}
  if (snapshot) {
    for (const file of snapshot.files) {
      const parts = file.path.split("/")
      const dir = parts.length > 1 ? parts[0] : "root"
      if (!fileTree[dir]) fileTree[dir] = []
      fileTree[dir].push(file.path)
    }
  }

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
              <div style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                backgroundColor: statusColor
              }} />
              <span style={{
                fontSize: 11,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: statusColor,
                fontWeight: 700
              }}>
                {project.status}
              </span>
            </div>
            <h1 style={{
              fontSize: 18,
              fontWeight: 700,
              margin: 0,
              letterSpacing: "-0.01em",
              color: "#1c1c1e"
            }}>
              {project.name}
            </h1>
          </div>
        </div>

        <div style={{ padding: "16px" }}>

          {/* Repo */}
          <div style={{
            background: "#ffffff",
            border: "1px solid #e5e5ea",
            borderRadius: 12,
            padding: "12px 16px",
            marginBottom: 12
          }}>
            <p style={{ fontSize: 11, color: "#8e8e93", margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Repository
            </p>
            <p style={{
              fontSize: 14,
              color: "#1c1c1e",
              margin: 0,
              fontFamily: "'SF Mono', 'Fira Code', monospace"
            }}>
              {project.githubRepo}
            </p>
          </div>

          {/* Actions */}
          {project.status === "active" && (
            <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
              <Link
                href={`/projects/${slug}/import`}
                style={{
                  flex: 1,
                  background: "#007aff",
                  color: "#ffffff",
                  borderRadius: 12,
                  padding: "14px 16px",
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
                  padding: "14px 16px",
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

          {/* File tree — lazy */}
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
              marginBottom: treeOpen ? 0 : 12
            }}
          >
            <span>
              {loading ? "Laden..." : treeLoaded ? `${snapshot?.files.length} bestanden` : "Bekijk bestanden"}
            </span>
            {!loading && (
              <span style={{
                transform: treeOpen ? "rotate(90deg)" : "rotate(0deg)",
                transition: "transform 0.2s",
                display: "inline-block",
                color: "#8e8e93"
              }}>
                ›
              </span>
            )}
          </button>

          {/* Error */}
          {error && (
            <div style={{
              background: "#fff5f5",
              border: "1px solid #fecaca",
              borderRadius: 10,
              padding: 14,
              marginTop: 8
            }}>
              <p style={{ fontSize: 13, color: "#dc2626", margin: 0 }}>{error}</p>
            </div>
          )}

          {/* Tree content */}
          {treeOpen && snapshot && (
            <div style={{
              background: "#ffffff",
              border: "1px solid #e5e5ea",
              borderTop: "none",
              borderRadius: "0 0 12px 12px",
              overflow: "hidden",
              marginBottom: 12
            }}>
              {Object.entries(fileTree).map(([dir, files], i) => (
                <div key={dir} style={{
                  borderTop: i > 0 ? "1px solid #f2f2f7" : "none"
                }}>
                  <div style={{
                    padding: "8px 16px",
                    backgroundColor: "#f9f9fb"
                  }}>
                    <p style={{
                      fontSize: 12,
                      color: "#6b7280",
                      margin: 0,
                      fontFamily: "monospace",
                      fontWeight: 600
                    }}>
                      {dir}/
                    </p>
                  </div>
                  {files.map(file => {
                    // Toon pad relatief aan top-level map
                    const parts = file.split("/")
                    const relativePath = parts.length > 1 ? parts.slice(1).join("/") : file
                    return (
                      <div key={file} style={{ padding: "7px 16px 7px 28px" }}>
                        <p style={{
                          fontSize: 13,
                          color: "#8e8e93",
                          margin: 0,
                          fontFamily: "monospace"
                        }}>
                          {relativePath}
                        </p>
                      </div>
                    )
                  })}
                </div>
              ))}

              {snapshot.isStale && (
                <div style={{ padding: "10px 16px", borderTop: "1px solid #f2f2f7" }}>
                  <p style={{ fontSize: 12, color: "#d97706", margin: 0 }}>
                    ⚠ Cache — GitHub niet bereikbaar
                  </p>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </main>
  )
}
