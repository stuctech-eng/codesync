import { PROJECTS } from "@/lib/projects"
import type { ProjectStatus } from "@/types"
import Link from "next/link"

const STATUS_CONFIG: Record<ProjectStatus, { label: string; color: string; dim: boolean }> = {
  active: { label: "ACTIVE", color: "#4ade80", dim: false },
  experimental: { label: "EXPERIMENTAL", color: "#facc15", dim: false },
  archive: { label: "ARCHIVE", color: "#4a4a6a", dim: true }
}

const STATUS_ORDER: ProjectStatus[] = ["active", "experimental", "archive"]

export default function Home() {
  const grouped = STATUS_ORDER.map(status => ({
    status,
    projects: PROJECTS.filter(p => p.status === status)
  }))

  return (
    <main style={{
      minHeight: "100dvh",
      backgroundColor: "#0a0a0f",
      color: "#e8e8f0",
      fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
      padding: "env(safe-area-inset-top, 24px) 16px env(safe-area-inset-bottom, 40px)"
    }}>
      <div style={{ maxWidth: 480, margin: "0 auto", paddingTop: 48 }}>

        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <p style={{
            fontSize: 11,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "#5a5a7a",
            marginBottom: 8
          }}>
            AI Project State Engine
          </p>
          <h1 style={{
            fontSize: 32,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            margin: 0,
            background: "linear-gradient(135deg, #e8e8f0 0%, #7878aa 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent"
          }}>
            CodeSync
          </h1>
        </div>

        {/* Project groups */}
        {grouped.map(({ status, projects }) => {
          const config = STATUS_CONFIG[status]
          return (
            <div key={status} style={{ marginBottom: 32 }}>
              {/* Group header */}
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 12
              }}>
                <div style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  backgroundColor: config.color,
                  flexShrink: 0
                }} />
                <p style={{
                  fontSize: 11,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: config.color,
                  margin: 0,
                  fontWeight: 600
                }}>
                  {config.label}
                </p>
                <p style={{
                  fontSize: 11,
                  color: "#3a3a5a",
                  margin: 0
                }}>
                  {projects.length}
                </p>
              </div>

              {/* Project cards */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {projects.map(project => (
                  <Link
                    key={project.slug}
                    href={`/projects/${project.slug}`}
                    style={{ textDecoration: "none" }}
                  >
                    <div style={{
                      background: "#12121a",
                      border: "1px solid #1e1e2e",
                      borderRadius: 12,
                      padding: "16px 20px",
                      minHeight: 44,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      opacity: config.dim ? 0.5 : 1
                    }}>
                      <div>
                        <p style={{
                          fontSize: 16,
                          fontWeight: 600,
                          color: "#e8e8f0",
                          margin: 0,
                          letterSpacing: "-0.01em"
                        }}>
                          {project.name}
                        </p>
                        <p style={{
                          fontSize: 12,
                          color: "#4a4a6a",
                          margin: "3px 0 0",
                          fontFamily: "'SF Mono', 'Fira Code', monospace"
                        }}>
                          {project.githubRepo}
                        </p>
                      </div>
                      <span style={{ color: "#3a3a5a", fontSize: 18 }}>›</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )
        })}

        {/* Health link */}
        <div style={{ marginTop: 24, textAlign: "center" }}>
          <Link
            href="/api/health"
            style={{
              fontSize: 12,
              color: "#3a3a5a",
              textDecoration: "none",
              letterSpacing: "0.04em"
            }}
          >
            GitHub status →
          </Link>
        </div>

      </div>
    </main>
  )
}
