import { PROJECTS } from "@/lib/projects"
import Link from "next/link"

export default function Home() {
  return (
    <main style={{
      minHeight: "100dvh",
      backgroundColor: "#0a0a0f",
      color: "#e8e8f0",
      fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
      padding: "env(safe-area-inset-top, 24px) 16px env(safe-area-inset-bottom, 24px)"
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

        {/* Projects */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {PROJECTS.map(project => (
            <Link
              key={project.slug}
              href={`/projects/${project.slug}`}
              style={{ textDecoration: "none" }}
            >
              <div style={{
                background: "#12121a",
                border: "1px solid #1e1e2e",
                borderRadius: 16,
                padding: "20px 20px",
                minHeight: 44,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                cursor: "pointer",
                transition: "border-color 0.15s"
              }}>
                <div>
                  <p style={{
                    fontSize: 17,
                    fontWeight: 600,
                    color: "#e8e8f0",
                    margin: 0,
                    letterSpacing: "-0.01em"
                  }}>
                    {project.name}
                  </p>
                  <p style={{
                    fontSize: 13,
                    color: "#4a4a6a",
                    margin: "4px 0 0",
                    fontFamily: "'SF Mono', 'Fira Code', monospace"
                  }}>
                    {project.githubRepo}
                  </p>
                </div>
                <span style={{ color: "#3a3a5a", fontSize: 20 }}>›</span>
              </div>
            </Link>
          ))}
        </div>

        {/* Health link */}
        <div style={{ marginTop: 32, textAlign: "center" }}>
          <Link
            href="/api/health"
            style={{
              fontSize: 13,
              color: "#3a3a5a",
              textDecoration: "none",
              letterSpacing: "0.04em"
            }}
          >
            Check GitHub connection →
          </Link>
        </div>

      </div>
    </main>
  )
}
