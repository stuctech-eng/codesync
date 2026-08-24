"use client"

import { useState, useEffect, useRef, Suspense } from "react"
import { useParams, useSearchParams } from "next/navigation"
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

function ChatPageInner() {
  const params = useParams()
  const searchParams = useSearchParams()
  const slug = params.slug as string
  const project = PROJECTS.find(p => p.slug === slug)
  // Master Plan v1.5, Niveau 2: een specifiek gesprek kan direct geopend
  // worden vanuit de chat-lijst via ?conversationId=X
  const requestedConversationId = searchParams.get("conversationId")

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

  // Scroll-to-bottom-pijl (net als GPT). "<main>" heeft hier
  // overflowY:"visible" -- dus scrollt eigenlijk de hele pagina
  // (window), niet een los element. Daarom luisteren op window-scroll,
  // niet op een specifiek container-element.
  const [showScrollDown, setShowScrollDown] = useState(false)

  useEffect(() => {
    function handleWindowScroll() {
      const distanceFromBottom =
        document.documentElement.scrollHeight - window.scrollY - window.innerHeight
      setShowScrollDown(distanceFromBottom > 150)
    }
    window.addEventListener("scroll", handleWindowScroll, { passive: true })
    handleWindowScroll()
    return () => window.removeEventListener("scroll", handleWindowScroll)
  }, [])

  function scrollToBottom() {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  // Zijbalk (Master Plan v1.5-uitbreiding): Knowledge + Chats samen,
  // vanaf links inschuivend, zoals in het oorspronkelijke plan
  // beschreven ("KNOWLEDGE" en "CHATS" samen in één paneel).
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarLoading, setSidebarLoading] = useState(false)
  const [sidebarConversations, setSidebarConversations] = useState<
    { id: string; title: string; updatedAt: string; lastMessagePreview: string }[]
  >([])
  const [sidebarKnowledge, setSidebarKnowledge] = useState<{ path: string; content: string }[]>([])
  const [expandedKnowledgeDoc, setExpandedKnowledgeDoc] = useState<string | null>(null)
  const [deletingChatId, setDeletingChatId] = useState<string | null>(null)
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const [savingRename, setSavingRename] = useState(false)

  function startRename(id: string, currentTitle: string) {
    setRenamingId(id)
    setRenameValue(currentTitle)
  }

  async function saveRename(id: string) {
    const title = renameValue.trim()
    if (!title) { setRenamingId(null); return }
    setSavingRename(true)
    try {
      const res = await authFetch(`/api/conversations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title })
      })
      if (res.ok) {
        setSidebarConversations(prev => prev.map(c => c.id === id ? { ...c, title } : c))
      }
    } finally {
      setSavingRename(false)
      setRenamingId(null)
    }
  }

  async function openSidebar() {
    setSidebarOpen(true)
    setSidebarLoading(true)
    try {
      const [convRes, knowRes] = await Promise.all([
        authFetch(`/api/claude/chat?projectSlug=${slug}`),
        authFetch(`/api/projects/${slug}/knowledge`)
      ])
      const convData = await convRes.json()
      const knowData = await knowRes.json()
      setSidebarConversations(convData.conversations ?? [])
      setSidebarKnowledge(knowData.docs ?? [])
    } catch {
      // Stil falen — zijbalk blijft gewoon open, secties tonen dan leeg
    } finally {
      setSidebarLoading(false)
    }
  }

  async function selectSidebarConversation(id: string) {
    setSidebarOpen(false)
    setMessages([])
    setLoadingHistory(true)
    await loadConversation(id)
    setLoadingHistory(false)
  }

  async function startNewChatFromSidebar() {
    setSidebarOpen(false)
    await startNewChat()
  }

  async function handleSidebarDelete(id: string) {
    if (confirmingDeleteId !== id) {
      setConfirmingDeleteId(id)
      return
    }
    setDeletingChatId(id)
    try {
      const res = await authFetch(`/api/conversations/${id}`, { method: "DELETE" })
      if (res.ok) {
        setSidebarConversations(prev => prev.filter(c => c.id !== id))
        // Als het huidig geopende gesprek werd verwijderd: terug naar leeg
        if (id === conversationId) {
          setConversationId(null)
          setMessages([])
        }
      }
    } finally {
      setDeletingChatId(null)
      setConfirmingDeleteId(null)
    }
  }

  function relativeTime(iso: string): string {
    const diffMs = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diffMs / 60000)
    if (mins < 1) return "nu"
    if (mins < 60) return `${mins}m`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}u`
    const days = Math.floor(hours / 24)
    return `${days}d`
  }

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

  // Naar component-niveau getild (was eerst binnen de useEffect
  // genest) zodat de zijbalk 'm ook kan gebruiken bij het wisselen
  // tussen gesprekken (Master Plan v1.5-uitbreiding: echte zijbalk).
  async function loadConversation(id: string) {
    setConversationId(id)
    const detailRes = await authFetch(`/api/claude/chat?conversationId=${id}`)
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

  useEffect(() => {
    async function loadLatest() {
      if (hasLoadedRef.current) return
      hasLoadedRef.current = true

      try {
        // Master Plan v1.5, Niveau 2: een expliciet in de URL meegegeven
        // gesprek (vanuit de chat-lijst) heeft voorrang boven "laad
        // gewoon het meest recente" — dat blijft het gedrag als er geen
        // specifiek gesprek is aangevraagd.
        if (requestedConversationId) {
          await loadConversation(requestedConversationId)
        } else {
          const res = await authFetch(`/api/claude/chat?projectSlug=${slug}`)
          const data = await res.json()
          if (res.ok && data.conversations?.length > 0) {
            await loadConversation(data.conversations[0].id)
          }
        }
      } catch {
        // Stil falen -- begin gewoon met een leeg gesprek
      } finally {
        setLoadingHistory(false)
      }
    }
    loadLatest()
  }, [slug, requestedConversationId])

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

  // Master Plan v1.5, Niveau 2: '+ Nieuw' maakt nu DIRECT een leeg
  // gesprek aan (i.p.v. alleen client-side state te wissen), zodat het
  // meteen in de chat-lijst verschijnt, ook vóórdat er een bericht is
  // getypt.
  async function startNewChat() {
    setMessages([])
    setError("")
    try {
      const res = await authFetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectSlug: slug })
      })
      const data = await res.json()
      if (res.ok && data.conversationId) {
        setConversationId(data.conversationId)
      } else {
        setConversationId(null)
      }
    } catch {
      // Bij een fout: gewoon lokaal een leeg gesprek — wordt bij het
      // eerste bericht alsnog aangemaakt (bestaand vangnet-gedrag)
      setConversationId(null)
    }
  }

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
        @keyframes csFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes csSlideIn {
          from { transform: translateX(-100%); }
          to { transform: translateX(0); }
        }
      `}</style>
      <div style={{ maxWidth: 480, margin: "0 auto", width: "100%", display: "flex", flexDirection: "column", flex: 1 }}>

        {/* Header — bugfix: position:sticky bleek onbetrouwbaar in
            Safari/iOS binnen een flex-column-container (de header bleef
            niet staan tijdens scrollen, ondanks eerdere CSS-fixes).
            position:fixed is hetzelfde patroon als de al-werkende
            onderbalk — betrouwbaarder. De content krijgt paddingTop om
            de header te compenseren (fixed haalt 'm uit de normale flow). */}
        <div style={{
          position: "fixed",
          top: "env(safe-area-inset-top, 0px)",
          left: 0,
          right: 0,
          maxWidth: 480,
          margin: "0 auto",
          backgroundColor: "var(--header-bg)",
          borderBottom: "1px solid var(--border)",
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          zIndex: 20
        }}>
          <Link href={`/projects/${slug}`} style={{ fontSize: 15, color: "#007aff", textDecoration: "none", minHeight: 44, display: "flex", alignItems: "center" }}>←</Link>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 11, color: "var(--subtitle)", margin: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Claude chat
            </p>
            <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "var(--title)" }}>{project.name}</h1>
          </div>
          {/* Master Plan v1.5-uitbreiding: opent nu de echte zijbalk
              (Knowledge + Chats samen) i.p.v. door te linken naar een
              aparte pagina */}
          <button
            onClick={openSidebar}
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              color: "var(--title)",
              borderRadius: 10,
              padding: "8px 10px",
              fontSize: 15,
              minHeight: 36,
              display: "flex",
              alignItems: "center",
              cursor: "pointer"
            }}
          >
            ☰
          </button>
          <button
            onClick={startNewChat}
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
        {/* paddingTop toegevoegd: de header is nu position:fixed (uit de
            normale flow gehaald), dus de content moet zelf ruimte
            reserveren zodat het bovenste bericht er niet achter
            verdwijnt. ~68px header + wat marge. */}
        <div style={{ flex: 1, padding: "16px", paddingTop: 84, display: "flex", flexDirection: "column", gap: 12, paddingBottom: 170 }}>
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

        {/* Scroll-to-bottom-pijl */}
        {showScrollDown && (
          <button
            onClick={scrollToBottom}
            style={{
              position: "fixed",
              bottom: 200,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 15,
              width: 36,
              height: 36,
              borderRadius: "50%",
              border: "1px solid var(--border)",
              background: "var(--card)",
              color: "var(--title)",
              fontSize: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(0,0,0,0.15)"
            }}
          >
            ↓
          </button>
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

      {/* Zijbalk: Knowledge + Chats, vanaf links inschuivend (Master
          Plan v1.5-uitbreiding, "net als Claude") */}
      {sidebarOpen && (
        <>
          {/* Backdrop — tikken erop sluit de zijbalk */}
          <div
            onClick={() => setSidebarOpen(false)}
            style={{
              position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
              zIndex: 100, animation: "csFadeIn 0.15s ease-out"
            }}
          />
          <div
            style={{
              position: "fixed", top: 0, left: 0, bottom: 0, width: "85%", maxWidth: 340,
              background: "var(--bg)", zIndex: 101, boxShadow: "2px 0 16px rgba(0,0,0,0.2)",
              display: "flex", flexDirection: "column",
              paddingTop: "env(safe-area-inset-top, 0px)",
              animation: "csSlideIn 0.2s ease-out"
            }}
          >
            <div style={{ padding: "16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{project.name}</h2>
              <button
                onClick={() => setSidebarOpen(false)}
                style={{ background: "none", border: "none", fontSize: 20, color: "var(--muted)", cursor: "pointer", padding: 4 }}
              >
                ✕
              </button>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
              {sidebarLoading && <p style={{ fontSize: 13, color: "var(--muted)", textAlign: "center" }}>Laden...</p>}

              {/* Knowledge-sectie */}
              {!sidebarLoading && sidebarKnowledge.length > 0 && (
                <>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px" }}>
                    Knowledge
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 }}>
                    {sidebarKnowledge.map(doc => {
                      const knowledgeLabels: Record<string, string> = {
                        "STARTPROMPT.md": "📘 Startprompt",
                        "README.md": "📘 README",
                        "docs/architecture.md": "📐 Architecture",
                        "docs/changelog.md": "📝 Changelog",
                        "docs/roadmap.md": "🗺 Roadmap"
                      }
                      const isExpanded = expandedKnowledgeDoc === doc.path
                      return (
                        <div key={doc.path} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
                          <button
                            onClick={() => setExpandedKnowledgeDoc(isExpanded ? null : doc.path)}
                            style={{
                              width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
                              padding: "10px 12px", background: "transparent", border: "none", cursor: "pointer",
                              fontSize: 13, color: "var(--title)", textAlign: "left"
                            }}
                          >
                            <span>{knowledgeLabels[doc.path] ?? doc.path}</span>
                            <span style={{ fontSize: 11, color: "var(--muted)" }}>{isExpanded ? "▲" : "▼"}</span>
                          </button>
                          {isExpanded && (
                            <pre style={{
                              margin: 0, padding: "10px 12px", fontSize: 11, lineHeight: 1.5,
                              background: "var(--bg)", borderTop: "1px solid var(--border)",
                              overflow: "auto", maxHeight: 240, whiteSpace: "pre-wrap", wordBreak: "break-word"
                            }}>
                              {doc.content}
                            </pre>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </>
              )}

              {/* Mijn Plannen — link naar CodeSnap (definitief
                  architectuurbesluit: geen eigen plan-opslag in
                  CodeSync, CodeSnap blijft de planbibliotheek) */}
              <a
                href={`https://codesnap-mu.vercel.app/plannen?project=${encodeURIComponent(project.name)}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "10px 12px", marginBottom: 20,
                  borderRadius: 10, border: "1px solid var(--border)",
                  background: "var(--card)", textDecoration: "none",
                  color: "var(--title)", fontSize: 13, fontWeight: 600
                }}
              >
                📋 Mijn plannen
                <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--muted)" }}>↗</span>
              </a>

              {/* Chats-sectie */}
              {!sidebarLoading && (
                <>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px" }}>
                    Chats
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {sidebarConversations.map(c => (
                      <div
                        key={c.id}
                        style={{
                          display: "flex", alignItems: "stretch", gap: 0,
                          borderRadius: 10, border: "1px solid var(--border)",
                          background: c.id === conversationId ? "rgba(0,122,255,0.08)" : "var(--card)",
                          overflow: "hidden"
                        }}
                      >
                        {renamingId === c.id ? (
                          // Hernoem-modus: rij wordt een invoerveld met opslaan/annuleren
                          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, padding: "8px 10px" }}>
                            <input
                              autoFocus
                              value={renameValue}
                              onChange={e => setRenameValue(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === "Enter") saveRename(c.id)
                                if (e.key === "Escape") setRenamingId(null)
                              }}
                              maxLength={100}
                              style={{
                                flex: 1, minWidth: 0, fontSize: 13, padding: "6px 8px",
                                border: "1px solid #007aff", borderRadius: 6,
                                background: "var(--bg)", color: "var(--title)"
                              }}
                            />
                            <button
                              onClick={() => saveRename(c.id)}
                              disabled={savingRename}
                              style={{ border: "none", background: "#007aff", color: "#fff", borderRadius: 6, padding: "6px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}
                            >
                              ✓
                            </button>
                            <button
                              onClick={() => setRenamingId(null)}
                              style={{ border: "none", background: "transparent", color: "var(--muted)", fontSize: 14, cursor: "pointer", flexShrink: 0, padding: "6px 4px" }}
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              onClick={() => selectSidebarConversation(c.id)}
                              style={{
                                flex: 1, minWidth: 0, textAlign: "left", padding: "10px 12px",
                                background: "transparent", border: "none", cursor: "pointer", color: "var(--title)"
                              }}
                            >
                              <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                💬 {c.title || "Nieuw gesprek"}
                              </div>
                              <div style={{ fontSize: 11, color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {relativeTime(c.updatedAt)} · {c.lastMessagePreview}
                              </div>
                            </button>
                            <button
                              onClick={() => startRename(c.id, c.title)}
                              style={{
                                border: "none", borderLeft: "1px solid var(--border)",
                                background: "transparent", color: "var(--muted)",
                                padding: "0 10px", fontSize: 12, cursor: "pointer", flexShrink: 0
                              }}
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => handleSidebarDelete(c.id)}
                              disabled={deletingChatId === c.id}
                              style={{
                                border: "none", borderLeft: "1px solid var(--border)",
                                background: confirmingDeleteId === c.id ? "#fee2e2" : "transparent",
                                color: confirmingDeleteId === c.id ? "#dc2626" : "var(--muted)",
                                padding: "0 12px", fontSize: 11, fontWeight: confirmingDeleteId === c.id ? 700 : 400,
                                cursor: "pointer", flexShrink: 0
                              }}
                            >
                              {deletingChatId === c.id ? "..." : confirmingDeleteId === c.id ? "Zeker?" : "🗑"}
                            </button>
                          </>
                        )}
                      </div>
                    ))}
                    {sidebarConversations.length === 0 && (
                      <p style={{ fontSize: 12, color: "var(--muted)", textAlign: "center", padding: "12px 0" }}>Nog geen gesprekken</p>
                    )}
                  </div>
                </>
              )}
            </div>

            <div style={{ padding: 16, borderTop: "1px solid var(--border)" }}>
              <button
                onClick={startNewChatFromSidebar}
                style={{
                  width: "100%", padding: "12px", borderRadius: 10, border: "none",
                  background: "#007aff", color: "#ffffff", fontSize: 14, fontWeight: 700, cursor: "pointer"
                }}
              >
                + Nieuwe chat
              </button>
            </div>
          </div>
        </>
      )}
    </main>
  )
}

// Next.js vereist een Suspense-boundary rond componenten die
// useSearchParams() gebruiken.
export default function ChatPage() {
  return (
    <Suspense fallback={null}>
      <ChatPageInner />
    </Suspense>
  )
}
