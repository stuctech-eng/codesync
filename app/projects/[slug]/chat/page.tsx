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
  changesetId?: string
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
  // Master Plan v1.3, Taak A: gebruiker kiest zelf per bericht welk pad —
  // geen automatische fallback (bewust vermeden, zie plan: voorkomt race
  // conditions en dubbele uitvoering). Beide paden bestaan al en zijn
  // beide al getest; dit voegt alleen een zichtbare keuze toe.
  const [executionMode, setExecutionMode] = useState<"normal" | "actions">("normal")
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [error, setError] = useState("")
  const [copiedId, setCopiedId] = useState<string | null>(null)

  async function copyMessage(msg: ChatMessage) {
    try {
      await navigator.clipboard.writeText(msg.content)
      setCopiedId(msg.id)
      setTimeout(() => setCopiedId(id => (id === msg.id ? null : id)), 1500)
    } catch {
      // Klembord-toegang kan falen (bijv. geen HTTPS-context) — stil
      // negeren, geen kritieke functionaliteit
    }
  }
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  // Houdt de DOM-elementen van elk bericht bij (op id), zodat we gericht
  // naar het BEGIN van het nieuwste bericht kunnen scrollen i.p.v.
  // altijd naar de bodem van de hele lijst — bij een lang antwoord zag
  // je anders alleen het einde, niet waar het begon.
  const messageElRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const lastUserMessageIdRef = useRef<string | null>(null)

  // Auto-groeiend invoerveld — meegroeien met de tekst tot een maximum
  // van 200px, daarna scrollen binnen het veld zelf.
  function autoResizeTextarea() {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }

  // Laatste gesprek voor dit project laden bij openen -- zodat je niet
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
        // Stil falen -- begin gewoon met een leeg gesprek
      } finally {
        setLoadingHistory(false)
      }
    }
    loadLatest()
  }, [slug])

  useEffect(() => {
    const targetId = lastUserMessageIdRef.current
    const targetEl = targetId ? messageElRefs.current.get(targetId) : null
    if (targetEl) {
      // Scroll zodat het BEGIN van het nieuwe bericht bovenaan in beeld
      // komt — je ziet dan je eigen vraag + het begin van het antwoord,
      // i.p.v. dat de pagina meteen naar de bodem springt.
      targetEl.scrollIntoView({ behavior: "smooth", block: "start" })
    } else {
      scrollRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages])

  // Master Plan v1.3, Taak B: als een bericht een prepare_changeset-
  // tool-aanroep bevat maar nog geen gekoppeld changesetId heeft, zoek
  // de meest recente changeset voor dit gesprek op en koppel 'm — zodat
  // er een "Bekijk wijzigingsvoorstel"-kaart getoond kan worden.
  useEffect(() => {
    // Correctie: voorheen werd hier op 'm.content' gecheckt om te
    // wachten tot het bericht "klaar" was — maar als Claude's finale
    // tekst leeg bleef (bijv. na prepare_changeset zonder afsluitende
    // zin), gebeurde de changeset-zoekactie dan NOOIT, ook al bestond de
    // changeset gewoon. '!sending' is de juiste "is dit bericht klaar"-
    // check: onafhankelijk van of de tekst zelf leeg is.
    const needsLookup = messages.find(m =>
      m.role === "assistant" &&
      !m.changesetId &&
      m.toolActivity?.some(a => a.tool === "prepare_changeset") &&
      !sending
    )
    if (!needsLookup || !conversationId) return

    authFetch(`/api/changesets?projectSlug=${slug}`)
      .then(res => res.json())
      .then(data => {
        const match = (data.changesets ?? []).find((c: any) => c.conversationId === conversationId)
        if (match) {
          setMessages(m => m.map(msg =>
            msg.id === needsLookup.id ? { ...msg, changesetId: match.id } : msg
          ))
        }
      })
      .catch((e) => {
      })
  }, [messages, conversationId, slug])

  async function sendMessage() {
    const text = input.trim()
    if (!text || sending) return

    setInput("")
    // Textarea terug naar standaardhoogte na verzenden — anders blijft
    // hij groot staan na een lang bericht.
    if (textareaRef.current) textareaRef.current.style.height = "auto"
    setError("")
    setSending(true)

    const assistantId = generateId()
    const userMessageId = generateId()
    lastUserMessageIdRef.current = userMessageId
    setMessages(m => [
      ...m,
      { id: userMessageId, role: "user", content: text },
      { id: assistantId, role: "assistant", content: "", toolActivity: [] }
    ])

    try {
      if (executionMode === "actions") {
        await sendViaActions(text, assistantId)
      } else {
        await sendViaVercel(text, assistantId)
      }
    } catch (e) {
      setError(String(e))
    } finally {
      setSending(false)
    }
  }

  // Pad 1: rechtstreeks via Vercel (streaming). Snel, maar kan bij
  // tool-vragen tegen de Hobby-tijdslimiet aanlopen (Master Plan v1.3,
  // timing-onderzoek: Anthropic's eigen antwoordgeneratie kostte alleen al
  // 6,7s+ bij een tool-vraag).
  async function sendViaVercel(text: string, assistantId: string) {
    const controller = new AbortController()
    let lastActivity = Date.now()
    let tickCount = 0
    const watchdog = setInterval(() => {
      tickCount++
      const elapsed = Date.now() - lastActivity
      if (elapsed > 15_000) {
        controller.abort()
      }
    }, 1000)

    try {
      const res = await authFetch("/api/claude/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectSlug: slug, message: text, conversationId }),
        signal: controller.signal
      })

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? `HTTP ${res.status}`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      let receivedDone = false

      while (true) {
        const { done, value } = await reader.read()
        lastActivity = Date.now()
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
          } else if (eventType === "done") {
            receivedDone = true
          }
        }
      }

      if (!receivedDone) {
        setError("Het antwoord werd niet volledig afgerond — waarschijnlijk door een tijdslimiet. Probeer een kortere of specifiekere vraag, of stel de vraag opnieuw, of kies 'GitHub Actions' voor deze vraag.")
      }
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        setError("Geen reactie ontvangen binnen 15s — de verbinding werd afgebroken. Probeer 'GitHub Actions' voor deze vraag, dat is betrouwbaarder bij bestand-gerelateerde vragen.")
      } else {
        throw e
      }
    } finally {
      clearInterval(watchdog)
    }
  }

  // Pad 2: via GitHub Actions (taak aanmaken + pollen). Geen live
  // streaming, duurt altijd minstens ~20-25s (Actions-opstarttijd), maar
  // geen Vercel-tijdslimiet — betrouwbaar ook bij zware tool-vragen.
  // Bewust een expliciete keuze, geen automatische fallback (Master Plan
  // v1.3: voorkomt race conditions/dubbele uitvoering).
  async function sendViaActions(text: string, assistantId: string) {
    const createRes = await authFetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectSlug: slug,
        type: "chat",
        message: text,
        conversationId
      })
    })

    const createData = await createRes.json()
    if (!createRes.ok) {
      throw new Error(createData.error ?? `HTTP ${createRes.status}`)
    }

    const taskId = createData.task.id
    const POLL_INTERVAL_MS = 2000
    // Bugfix: was 120_000 (2 min), maar de server (GitHub Actions) heeft
    // intern tot 240_000ms (4 min) de tijd, en de workflow zelf mag 5
    // minuten draaien — de client gaf het dus soms te vroeg op, terwijl
    // de taak nog gewoon bezig (of zelfs al klaar) was. Nu ruim boven de
    // server-kant afgestemd.
    const MAX_POLL_MS = 280_000
    const pollStart = Date.now()
    let finished = false
    let pollCount = 0

    while (!finished && Date.now() - pollStart < MAX_POLL_MS) {
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS))
      pollCount++

      const pollRes = await authFetch(`/api/tasks/${taskId}`)
      const pollData = await pollRes.json()
      if (!pollRes.ok) throw new Error(pollData.error ?? `HTTP ${pollRes.status}`)

      const task = pollData.task

      if (task.status === "completed") {
        finished = true
        // Volledige, ruwe taakinhoud loggen — om definitief vast te
        // stellen of prepare_changeset wel/niet is aangeroepen, en wat
        // task.answer daadwerkelijk bevat.
        if (task.conversationId) setConversationId(task.conversationId)
        setMessages(m => m.map(msg =>
          msg.id === assistantId
            ? { ...msg, content: task.answer ?? "", toolActivity: task.toolActivity ?? [] }
            : msg
        ))
      } else if (task.status === "failed") {
        finished = true
        throw new Error(task.error ?? "Taak mislukt")
      }
    }

    if (!finished) {
      setError("De taak duurt langer dan verwacht (2+ minuten). Probeer het later opnieuw of stel een kortere vraag.")
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
      padding: "env(safe-area-inset-top, 0px) 0 0",
      // Vangnet (live-test bugfix): voorkomt dat een toekomstig te-brede
      // knop/element ooit weer de HELE pagina horizontaal laat
      // verschuiven — dat veroorzaakte eerder de header-overlap met de
      // statusbalk en onbereikbare knoppen.
      // overflowY expliciet op "visible" — anders forceert de browser
      // 'm impliciet naar "auto" zodra overflowX iets anders is dan
      // "visible" (een bekende CSS-eigenaardigheid), wat de sticky
      // header hierbeneden breekt (die plakte dan aan het verkeerde
      // scroll-element vast, waardoor 'ie mee omhoog scrolde i.p.v. te
      // blijven staan).
      overflowX: "hidden",
      overflowY: "visible"
    }}>
      <style>{`
        @keyframes csTypingBounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-4px); opacity: 1; }
        }
        .cs-typing-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--muted, #888);
          display: inline-block;
          animation: csTypingBounce 1.2s infinite ease-in-out;
        }
      `}</style>
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
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 11, color: "var(--subtitle)", margin: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Claude chat -- alleen-lezen (Fase 2)
            </p>
            <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "var(--title)" }}>{project.name}</h1>
          </div>
          <button
            onClick={() => {
              setConversationId(null)
              setMessages([])
              setError("")
            }}
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              color: "var(--title)",
              borderRadius: 10,
              padding: "8px 12px",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              minHeight: 36,
              whiteSpace: "nowrap"
            }}
          >
            + Nieuw
          </button>
        </div>

        {/* Messages */}
        {/* paddingBottom verhoogd: de vaste onderbalk bevat nu ook de
            Normaal/GitHub Actions-schakelaar, die extra hoogte inneemt —
            110px was niet meer genoeg, waardoor het laatste bericht
            (incl. een eventuele wijzigingsvoorstel-kaart) er half achter
            wegviel. */}
        <div style={{ flex: 1, padding: "16px", display: "flex", flexDirection: "column", gap: 12, paddingBottom: 170 }}>
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
            <div
              key={msg.id}
              ref={el => {
                if (el) messageElRefs.current.set(msg.id, el)
                else messageElRefs.current.delete(msg.id)
              }}
              style={{ display: "flex", flexDirection: "column", alignItems: msg.role === "user" ? "flex-end" : "flex-start" }}
            >
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
                {msg.content ? msg.content : (
                  sending && msg.role === "assistant" ? (
                    <span style={{ display: "inline-flex", gap: 4, alignItems: "center", padding: "2px 0" }}>
                      <span className="cs-typing-dot" style={{ animationDelay: "0ms" }} />
                      <span className="cs-typing-dot" style={{ animationDelay: "150ms" }} />
                      <span className="cs-typing-dot" style={{ animationDelay: "300ms" }} />
                    </span>
                  ) : (
                    // Fallback: als het antwoord klaar is maar leeg bleef
                    // (bijv. Claude riep prepare_changeset aan zonder
                    // afsluitende tekst), toon iets zinnigs i.p.v. een
                    // volledig lege bubbel.
                    !sending && msg.role === "assistant" && msg.toolActivity?.some(a => a.tool === "prepare_changeset")
                      ? "Wijzigingsvoorstel klaargezet — zie hieronder."
                      : ""
                  )
                )}
              </div>
              {/* Kopieerknop — alleen bij afgeronde Claude-antwoorden
                  met daadwerkelijke inhoud, niet bij eigen berichten */}
              {msg.role === "assistant" && msg.content && !sending && (
                <button
                  onClick={() => copyMessage(msg)}
                  style={{
                    marginTop: 4,
                    background: "none",
                    border: "none",
                    padding: "2px 4px",
                    fontSize: 11,
                    color: "var(--muted)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 4
                  }}
                >
                  {copiedId === msg.id ? "✓ Gekopieerd" : "📋 Kopieer"}
                </button>
              )}
              {sending && msg.role === "assistant" && !msg.content && (
                <p style={{ fontSize: 11, color: "var(--muted)", margin: "4px 0 0", fontStyle: "italic" }}>
                  {executionMode === "actions" ? "Claude is aan het werk (via GitHub Actions, dit kan ~20-40s duren)…" : "Claude denkt na…"}
                </p>
              )}
              {/* Master Plan v1.3, Taak B: wijzigingsvoorstel-kaart —
                  linkt door naar het review-scherm met Goedkeuren/Afwijzen.
                  Claude committet hier NIETS zelf; dit is puur een
                  koppeling naar het al bestaande, aparte approval-scherm. */}
              {msg.changesetId && (
                <Link
                  href={`/projects/${slug}/changesets/${msg.changesetId}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginTop: 6,
                    padding: "10px 14px",
                    borderRadius: 12,
                    border: "1.5px solid #007aff",
                    background: "rgba(0,122,255,0.06)",
                    textDecoration: "none",
                    color: "#007aff",
                    fontSize: 13,
                    fontWeight: 600
                  }}
                >
                  📝 Wijzigingsvoorstel bekijken →
                </Link>
              )}
            </div>
          ))}
          <div ref={scrollRef} />
        </div>

        {/* Error — bottom omhoog van 76 naar 140 (bugfix, live-test):
            de onderbalk bevat nu ook de Normaal/Actions-knoppenrij en is
            daardoor hoger geworden; bij 76 overlapte de foutmelding met
            die knoppen en maakte ze onbereikbaar. */}
        {error && (
          <div style={{ position: "fixed", bottom: 140, left: 16, right: 16, maxWidth: 448, margin: "0 auto", background: "#fff5f5", border: "1px solid #fecaca", borderRadius: 10, padding: "10px 14px", zIndex: 60 }}>
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
          <div style={{ maxWidth: 480, margin: "0 auto" }}>
            {/* Master Plan v1.3, Taak A: expliciete keuze, geen
                automatische fallback tussen Vercel (snel) en GitHub
                Actions (traag maar betrouwbaar bij tool-vragen) */}
            <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
              {/* Bugfix (live-test): flex:1 alleen voorkomt geen
                  overflow als de tekst zelf breder is dan de beschikbare
                  ruimte — minWidth:0 is nodig zodat flex-items écht
                  mogen krimpen, anders duwt de lange knoptekst de HELE
                  pagina breder dan het scherm (met als zichtbaar gevolg:
                  header overlapt de statusbalk, knoppen deels onbereikbaar). */}
              <button
                onClick={() => setExecutionMode("normal")}
                disabled={sending}
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "6px 8px",
                  borderRadius: 8,
                  border: executionMode === "normal" ? "1.5px solid #007aff" : "1px solid var(--border)",
                  background: executionMode === "normal" ? "rgba(0,122,255,0.08)" : "var(--card)",
                  color: executionMode === "normal" ? "#007aff" : "var(--muted)",
                  cursor: sending ? "default" : "pointer",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis"
                }}
              >
                ⚡ Normaal
              </button>
              <button
                onClick={() => setExecutionMode("actions")}
                disabled={sending}
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "6px 8px",
                  borderRadius: 8,
                  border: executionMode === "actions" ? "1.5px solid #007aff" : "1px solid var(--border)",
                  background: executionMode === "actions" ? "rgba(0,122,255,0.08)" : "var(--card)",
                  color: executionMode === "actions" ? "#007aff" : "var(--muted)",
                  cursor: sending ? "default" : "pointer",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis"
                }}
              >
                🐢 Actions
              </button>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => {
                setInput(e.target.value)
                autoResizeTextarea()
              }}
              // Enter voegt nu gewoon een nieuwe regel toe (standaard
              // textarea-gedrag) — verzenden gaat alleen via de knop.
              // Bewust: op iPhone is een aparte verzendknop prettiger dan
              // Enter-om-te-verzenden bij een meerregelig invoerveld.
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
                maxHeight: 200,
                overflowY: "auto",
                boxSizing: "border-box",
                fontFamily: "'SF Pro Display', -apple-system, sans-serif",
                transition: "height 0.1s ease-out"
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
      </div>
    </main>
  )
}
