"use client"

import { useState, useEffect, useRef } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { PROJECTS } from "@/lib/projects"
import { authFetch } from "@/lib/access-key"

type ToolActivity = { tool: string; input: Record<string, unknown> }
type ChatMessage = {
  id: string
  role: "user" | "assistant"
  content: string
  toolActivity?: ToolActivity[]
}

function generateId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export default function ChatPage() {
  const params = useParams()
  const slug = params.slug as string
  const project = PROJECTS.find(p => p.slug === slug)

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [error, setError] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)

  // Laatste gesprek voor dit project laden bij openen — zodat je niet
  // steeds opnieuw hoeft uit te leggen waar je mee bezig was.
  //
  // Robuustheid: gebruikt useRef (niet useState) om bij te houden of er al
  // een keer geladen is, zodat een eventuele dubbele/late uitvoering van
  // dit effect (bijv. door React StrictMode of een her-render) nooit een
  // gesprek dat al bezig is zomaar overschrijft.
  const hasLoadedRef = useRef(false)

  useEffect(() => {
    async function loadLatest() {
      if (hasLoadedRef.current) return
      hasLoadedRef.current = true

      try {
        const res = await authFetch(`/api/claude/chat?projectSlug=${slug}`)
        const data = await res.json()
        if (res.ok && data.conversations?.length > 0) {
          const latest = data.conversations[0]
          setConversationId(latest.id)
          const detailRes = await authFetch(`/api/claude/chat?conversationId=${latest.id}`)
          const detailData = await detailRes.json()
          if (detailRes.ok) {
            setMessages(
              detailData.messages.map((m: any) => ({
                id: generateId(),
                role: m.role,
                content: m.content,
                toolActivity: m.toolActivity
              }))
            )
          }
        }
      } catch {
        // Stil falen — begin gewoon met een leeg gesprek
      } finally {
        setLoadingHistory(false)
      }
    }
    loadLatest()
  }, [slug])

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  async function sendMessage() {
    const text = input.trim()
    if (!text || sending) return

    setInput("")
    setError("")
    setSending(true)

    const assistantId = generateId()
    setMessages(m => [
      ...m,
      { id: generateId(), role: "user", content: text },
      { id: assistantId, role: "assistant", content: "", toolActivity: [] }
    ])

    try {
      const res = await authFetch("/api/claude/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectSlug: slug, message: text, conversationId })
      })

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? `HTTP ${res.status}`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const events = buffer.split("\n\n")
        buffer = events.pop() ?? ""

        for (const rawEvent of events) {
          const lines = rawEvent.split("\n")
          const eventLine = lines.find(l => l.startsWith("event: "))
          const dataLine = lines.find(l => l.startsWith("data: "))
          if (!eventLine || !dataLine) continue

          const eventType = eventLine.slice("event: ".length)
          const data = JSON.parse(dataLine.slice("data: ".length))

          if (eventType === "conversationId") {
            setConversationId(data.conversationId)
          } else if (eventType === "text") {
            // Doelbewust op id — nooit "het laatste item", zodat een
            // eventuele gelijktijdige state-wijziging (bijv. een dubbele
            // geschiedenis-laadpoging) nooit de verkeerde bubbel raakt.
            setMessages(m => m.map(msg =>
              msg.id === assistantId ? { ...msg, content: msg.content + data.chunk } : msg
            ))
          } else if (eventType === "tool") {
            setMessages(m => m.map(msg =>
              msg.id === assistantId
                ? { ...msg, toolActivity: [...(msg.toolActivity ?? []), data] }
                : msg
            ))
          } else if (eventType === "error") {
            setError(data.message)
          }
        }
      }
    } catch (e) {
      setError(String(e))
    } finally {
      setSending(false)
    }
  }

  function toolLabel(activity: ToolActivity): string {
    if (activity.tool === "get_project_structure") return "📂 Bestandsstructuur bekeken"
    if (activity.tool === "get_file_contents") {
      const paths = (activity.input.paths as string[]) ?? []
      return `📄 Bestanden bekeken: ${paths.join(", ")}`
    }
    return `🔧 ${activity.tool}`
  }

  if (!project) return null

  return (
    <main style={{
      minHeight: "100dvh",
      backgroundColor: "var(--bg)",
      color: "var(--title)",
      fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
      display: "flex",
      flexDirection: "column",
      padding: "env(safe-area-inset-top, 0px) 0 0"
    }}>
      <div style={{ maxWidth: 480, margin: "0 auto", width: "100%", display: "flex", flexDirection: "column", flex: 1 }}>

        {/* Header */}
        <div style={{
          position: "sticky",
          top: 0,
          backgroundColor: "var(--header-bg)",
          borderBottom: "1px solid var(--border)",
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          zIndex: 10
        }}>
          <Link href={`/projects/${slug}`} style={{ fontSize: 15, color: "#007aff", textDecoration: "none", minHeight: 44, display: "flex", alignItems: "center" }}>←</Link>
          <div>
            <p style={{ fontSize: 11, color: "var(--subtitle)", margin: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Claude chat — alleen-lezen (Fase 2)
            </p>
            <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "var(--title)" }}>{project.name}</h1>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, padding: "16px", display: "flex", flexDirection: "column", gap: 12, paddingBottom: 110 }}>
          {loadingHistory && (
            <p style={{ fontSize: 13, color: "var(--muted)", textAlign: "center" }}>Laden...</p>
          )}
          {!loadingHistory && messages.length === 0 && (
            <div style={{ textAlign: "center", paddingTop: 48 }}>
              <p style={{ fontSize: 15, color: "var(--muted)", margin: "0 0 8px" }}>
                Stel een vraag over {project.name}.
              </p>
              <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>
                Claude kan de bestandsstructuur en -inhoud bekijken, maar nog geen wijzigingen voorstellen of doorvoeren.
              </p>
            </div>
          )}
          {messages.map((msg) => (
            <div key={msg.id} style={{ display: "flex", flexDirection: "column", alignItems: msg.role === "user" ? "flex-end" : "flex-start" }}>
              {msg.toolActivity && msg.toolActivity.length > 0 && (
                <div style={{ marginBottom: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                  {msg.toolActivity.map((activity, j) => (
                    <p key={j} style={{ fontSize: 11, color: "var(--muted)", margin: 0, fontStyle: "italic" }}>
                      {toolLabel(activity)}
                    </p>
                  ))}
                </div>
              )}
              <div style={{
                maxWidth: "85%",
                background: msg.role === "user" ? "#007aff" : "var(--card)",
                border: msg.role === "user" ? "none" : "1px solid var(--border)",
                color: msg.role === "user" ? "#ffffff" : "var(--title)",
                borderRadius: 16,
                padding: "10px 14px",
                fontSize: 15,
                lineHeight: 1.5,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word"
              }}>
                {msg.content || (sending && msg.role === "assistant" ? "…" : "")}
              </div>
            </div>
          ))}
          <div ref={scrollRef} />
        </div>

        {/* Error */}
        {error && (
          <div style={{ position: "fixed", bottom: 76, left: 16, right: 16, maxWidth: 448, margin: "0 auto", background: "#fff5f5", border: "1px solid #fecaca", borderRadius: 10, padding: "10px 14px" }}>
            <p style={{ fontSize: 12, color: "#dc2626", margin: 0 }}>{error}</p>
          </div>
        )}

        {/* Input */}
        <div style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          padding: "12px 16px 24px",
          backgroundColor: "var(--bg)",
          borderTop: "1px solid var(--border)"
        }}>
          <div style={{ maxWidth: 480, margin: "0 auto", display: "flex", gap: 8, alignItems: "flex-end" }}>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  sendMessage()
                }
              }}
              placeholder="Stel een vraag over dit project..."
              rows={1}
              disabled={sending}
              style={{
                flex: 1,
                padding: "12px 14px",
                fontSize: 15,
                border: "1px solid var(--border)",
                borderRadius: 12,
                background: "var(--card)",
                color: "var(--title)",
                resize: "none",
                maxHeight: 120,
                boxSizing: "border-box",
                fontFamily: "'SF Pro Display', -apple-system, sans-serif"
              }}
            />
            <button
              onClick={sendMessage}
              disabled={sending || !input.trim()}
              style={{
                background: sending || !input.trim() ? "var(--border)" : "#007aff",
                color: sending || !input.trim() ? "var(--muted)" : "#ffffff",
                border: "none",
                borderRadius: 12,
                padding: "12px 18px",
                fontSize: 15,
                fontWeight: 700,
                minHeight: 44,
                cursor: sending || !input.trim() ? "default" : "pointer"
              }}
            >
              →
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}
