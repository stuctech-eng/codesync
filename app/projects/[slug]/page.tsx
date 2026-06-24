import { PROJECTS } from "@/lib/projects"
import { getGitHubSnapshot } from "@/lib/snapshot"
import { notFound } from "next/navigation"
import Link from "next/link"
import type { ProjectStatus } from "@/types"

const STATUS_COLOR: Record<ProjectStatus, string> = {
  active: "#4ade80",
  experimental: "#facc15",
  archive: "#4a4a6a"
}

type Props = {
  params: Promise<{ slug: string }>
}

export default async function ProjectPage({ params }: Props) {
  const { slug } = await params
  const project = PROJECTS.find(p => p.slug === slug)
  if (!project) notFound()

  let snapshot = null
  let error = null

  try {
    snapshot = await getGitHubSnapshot(project)
  } catch (e) {
    error = String(e)
  }

  // Group files by directory
  const fileTree: Record<string, string[]> = {}
  if (snapshot) {
    for (const file of snapshot.files) {
      const parts = file.path.split("/")
      const dir = parts.length > 1 ? parts[0] : "/"
      if (!fileTree[dir]) fileTree[dir] = []
      fileTree[dir].push(file.path)
    }
  }

  const statusColor = STATUS_COLOR[project.status]

  return (
    <main style={{
      minHeight: "100dvh",
      backgroundColor: "#0a0a0f",
      color: "#e8e8f0",
      fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
      padding: "env(safe-area-inset-top, 24px) 16px env(safe-area-inset-bottom, 40px)"
    }}>
      <div style={{ maxWidth: 480, margin: "0 auto", paddingTop: 24 }}>

        {/* Back */}
        <Link href="/" style={{
          fontSize: 15,
          color: "#5a5a7a",
          textDecoration: "none",
          display: "inline-block",
          marginBottom: 24
        }}>
          ← Terug
        </Link>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <div style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              backgroundColor: statusColor
            }} />
            <span style={{
              fontSize: 11,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: statusColor,
              fontWeight: 600
            }}>
              {project.status}
            </span>
          </div>
          <h1 style={{
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            margin: "0 0 4px"
          }}>
            {project.name}
          </h1>
          <p style={{
            fontSize: 12,
            color: "#4a4a6a",
            margin: 0,
            fontFamily: "'SF Mono', 'Fira Code', monospace"
          }}>
            {project.githubRepo}
          </p>
        </div>

        {/* Actions — alleen voor active */}
        {project.status === "active" && (
          <div style={{ display: "flex", gap: 10, marginBottom: 28 }}>
            <Link
              href={`/projects/${slug}/import`}
              style={{
                flex: 1,
                background: "#4ade80",
                color: "#0a0a0f",
                borderRadius: 10,
                padding: "12px 16px",
                fontSize: 14,
                fontWeight: 700,
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
                background: "#12121a",
                border: "1px solid #1e1e2e",
                color: "#e8e8f0",
                borderRadius: 10,
                padding: "12px 16px",
                fontSize: 14,
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

        {/* Error state */}
        {error && (
          <div style={{
            background: "#1a0a0a",
            border: "1px solid #3a1a1a",
            borderRadius: 10,
            padding: 16,
            marginBottom: 24
          }}>
            <p style={{ fontSize: 13, color: "#f87171", margin: 0 }}>
              GitHub niet bereikbaar
            </p>
            <p style={{ fontSize: 11, color: "#5a3a3a", margin: "4px 0 0", fontFamily: "monospace" }}>
              {error}
            </p>
          </div>
        )}

        {/* Snapshot info */}
        {snapshot && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <p style={{ fontSize: 13, color: "#5a5a7a", margin: 0 }}>
                {snapshot.files.length} bestanden
              </p>
              {snapshot.isStale && (
                <span style={{ fontSize: 11, color: "#facc15", background: "#1a1a0a", padding: "2px 8px", borderRadius: 6 }}>
                  cache
                </span>
              )}
            </div>

            {/* File tree */}
            <div style={{
              background: "#12121a",
              border: "1px solid #1e1e2e",
              borderRadius: 12,
              overflow: "hidden"
            }}>
              {Object.entries(fileTree).map(([dir, files], i) => (
                <div key={dir} style={{
                  borderBottom: i < Object.keys(fileTree).length - 1 ? "1px solid #1e1e2e" : "none"
                }}>
                  <div style={{
                    padding: "10px 16px",
                    background: "#0e0e18"
                  }}>
                    <p style={{
                      fontSize: 12,
                      color: "#7878aa",
                      margin: 0,
                      fontFamily: "'SF Mono', 'Fira Code', monospace",
                      fontWeight: 600
                    }}>
                      {dir === "/" ? "root" : dir + "/"}
                    </p>
                  </div>
                  {files.map(file => (
                    <div key={file} style={{ padding: "8px 16px 8px 28px" }}>
                      <p style={{
                        fontSize: 13,
                        color: "#6a6a8a",
                        margin: 0,
                        fontFamily: "'SF Mono', 'Fira Code', monospace"
                      }}>
                        {file.split("/").pop()}
                      </p>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Snapshot timestamp */}
        {snapshot && (
          <p style={{ fontSize: 11, color: "#3a3a5a", textAlign: "center" }}>
            {new Date(snapshot.createdAt).toLocaleString("nl-NL")}
          </p>
        )}

      </div>
    </main>
  )
}
