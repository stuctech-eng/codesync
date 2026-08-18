"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { PROJECTS } from "@/lib/projects"
import { authFetch } from "@/lib/access-key"

type Doc = { path: string; content: string }

// Knowledge-weergave (Master Plan v1.5, Niveau 2). Puur read-only
// weergave van wat Niveau 1 al automatisch aan elke nieuwe chat
// meegeeft — geen nieuwe data, geen nieuw datamodel.
export default function KnowledgePage() {
  const params = useParams()
  const slug = params.slug as string
  const project = PROJECTS.find(p => p.slug === slug)

  const [docs, setDocs] = useState<Doc[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    authFetch(`/api/projects/${slug}/knowledge`)
      .then(res => res.json())
      .then(data => setDocs(data.docs ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [slug])

  const labels: Record<string, string> = {
    "STARTPROMPT.md": "📘 Startprompt",
    "README.md": "📘 README",
    "docs/architecture.md": "📐 Architecture",
    "docs/changelog.md": "📝 Changelog",
    "docs/roadmap.md": "🗺 Roadmap"
  }

  if (!project) return null

  return (
    <main style={{
      minHeight: "100dvh",
      backgroundColor: "var(--bg)",
      color: "var(--title)",
      fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
      padding: "env(safe-area-inset-top, 0px) 0 0"
    }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <div style={{
          position: "sticky", top: 0, backgroundColor: "var(--header-bg)",
          borderBottom: "1px solid var(--border)", padding: "12px 16px",
          display: "flex", alignItems: "center", gap: 12, zIndex: 10
        }}>
          <Link href={`/projects/${slug}/chat`} style={{ fontSize: 15, color: "#007aff", textDecoration: "none", minHeight: 44, display: "flex", alignItems: "center" }}>←</Link>
          <div>
            <p style={{ fontSize: 11, color: "var(--subtitle)", margin: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>Knowledge</p>
            <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{project.name}</h1>
          </div>
        </div>

        <div style={{ padding: 16 }}>
          <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 16px" }}>
            Deze documenten worden automatisch meegegeven bij elke nieuwe chat — je hoeft ze niet zelf te delen.
          </p>

          {loading && <p style={{ fontSize: 14, color: "var(--muted)", textAlign: "center" }}>Laden...</p>}

          {!loading && docs.length === 0 && (
            <p style={{ fontSize: 14, color: "var(--muted)", textAlign: "center", marginTop: 32 }}>
              Geen van de herkende documenten (STARTPROMPT.md, README.md, docs/architecture.md, docs/changelog.md, docs/roadmap.md) is gevonden in deze repository.
            </p>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {docs.map(doc => {
              const isExpanded = expanded === doc.path
              return (
                <div key={doc.path} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
                  <button
                    onClick={() => setExpanded(isExpanded ? null : doc.path)}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "14px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left"
                    }}
                  >
                    <span style={{ fontSize: 15, fontWeight: 600 }}>{labels[doc.path] ?? doc.path}</span>
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>{isExpanded ? "▲" : "▼"}</span>
                  </button>
                  {isExpanded && (
                    <pre style={{
                      margin: 0, padding: "12px 14px", fontSize: 12, lineHeight: 1.5,
                      background: "var(--bg)", borderTop: "1px solid var(--border)",
                      overflow: "auto", maxHeight: 400, whiteSpace: "pre-wrap", wordBreak: "break-word"
                    }}>
                      {doc.content}
                    </pre>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </main>
  )
}
