"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { PROJECTS } from "@/lib/projects"
import { authFetch } from "@/lib/access-key"

type ConversationSummary = {
  id: string
  title: string
  updatedAt: string
  lastMessagePreview: string
}

// Chat-lijst per project (Master Plan v1.5, Niveau 2). Hergebruikt de
// al bestaande GET /api/claude/chat?projectSlug=X — geen nieuwe route
// nodig voor het ophalen zelf.
export default function ChatsListPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string
  const project = PROJECTS.find(p => p.slug === slug)

  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  async function handleDelete(id: string) {
    if (confirmingId !== id) {
      // Eerste tik: bevestiging vragen, niks verwijderen
      setConfirmingId(id)
      return
    }
    setDeletingId(id)
    try {
      const res = await authFetch(`/api/conversations/${id}`, { method: "DELETE" })
      if (res.ok) {
        setConversations(prev => prev.filter(c => c.id !== id))
      }
    } finally {
      setDeletingId(null)
      setConfirmingId(null)
    }
  }
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    authFetch(`/api/claude/chat?projectSlug=${slug}`)
      .then(res => res.json())
      .then(data => setConversations(data.conversations ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [slug])

  async function startNewChat() {
    setCreating(true)
    try {
      const res = await authFetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectSlug: slug })
      })
      const data = await res.json()
      if (res.ok && data.conversationId) {
        router.push(`/projects/${slug}/chat?conversationId=${data.conversationId}`)
      }
    } finally {
      setCreating(false)
    }
  }

  function relativeTime(iso: string): string {
    const diffMs = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diffMs / 60000)
    if (mins < 1) return "nu"
    if (mins < 60) return `${mins}m geleden`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}u geleden`
    const days = Math.floor(hours / 24)
    return `${days}d geleden`
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
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 11, color: "var(--subtitle)", margin: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>Chats</p>
            <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{project.name}</h1>
          </div>
          <Link
            href={`/projects/${slug}/knowledge`}
            style={{
              background: "var(--card)", border: "1px solid var(--border)", color: "var(--title)",
              borderRadius: 10, padding: "8px 10px", fontSize: 15, minHeight: 36,
              display: "flex", alignItems: "center", textDecoration: "none"
            }}
          >
            🧠
          </Link>
        </div>

        <div style={{ padding: 16 }}>
          <button
            onClick={startNewChat}
            disabled={creating}
            style={{
              width: "100%", padding: "14px", borderRadius: 12, border: "none",
              background: "#007aff", color: "#ffffff", fontSize: 15, fontWeight: 700,
              marginBottom: 16, cursor: creating ? "default" : "pointer"
            }}
          >
            {creating ? "Bezig..." : "+ Nieuwe chat"}
          </button>

          {loading && <p style={{ fontSize: 14, color: "var(--muted)", textAlign: "center" }}>Laden...</p>}

          {!loading && conversations.length === 0 && (
            <p style={{ fontSize: 14, color: "var(--muted)", textAlign: "center", marginTop: 32 }}>
              Nog geen gesprekken — begin met "+ Nieuwe chat".
            </p>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {conversations.map(c => (
              <div
                key={c.id}
                style={{
                  display: "flex", alignItems: "stretch", gap: 8,
                  borderRadius: 12, border: "1px solid var(--border)",
                  background: "var(--card)", overflow: "hidden"
                }}
              >
                <Link
                  href={`/projects/${slug}/chat?conversationId=${c.id}`}
                  style={{
                    flex: 1, display: "block", padding: "14px",
                    textDecoration: "none", color: "var(--title)"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                    <span style={{ fontSize: 15, fontWeight: 600 }}>💬 {c.title || "Nieuw gesprek"}</span>
                    <span style={{ fontSize: 11, color: "var(--muted)", whiteSpace: "nowrap", marginLeft: 8 }}>{relativeTime(c.updatedAt)}</span>
                  </div>
                  {c.lastMessagePreview && (
                    <p style={{ fontSize: 13, color: "var(--muted)", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {c.lastMessagePreview}
                    </p>
                  )}
                </Link>
                {/* Verwijderen — tweetraps: eerste tik vraagt bevestiging
                    (wordt rood + "Zeker?"), tweede tik verwijdert echt.
                    Voorkomt een los popup-venster, blijft simpel op iPhone. */}
                <button
                  onClick={() => handleDelete(c.id)}
                  disabled={deletingId === c.id}
                  style={{
                    border: "none",
                    borderLeft: "1px solid var(--border)",
                    background: confirmingId === c.id ? "#fee2e2" : "transparent",
                    color: confirmingId === c.id ? "#dc2626" : "var(--muted)",
                    padding: "0 16px",
                    fontSize: 12,
                    fontWeight: confirmingId === c.id ? 700 : 400,
                    cursor: "pointer",
                    whiteSpace: "nowrap"
                  }}
                >
                  {deletingId === c.id ? "..." : confirmingId === c.id ? "Zeker?" : "🗑"}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
