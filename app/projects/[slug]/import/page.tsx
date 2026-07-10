"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { PROJECTS } from "@/lib/projects"
import Link from "next/link"

type DiffResult = {
  newFiles: string[]
  modifiedFiles: string[]
  deletedFiles: string[]
  unchanged: string[]
}

type Step = "upload" | "review" | "syncing" | "done" | "error"

function isLikelyNetworkError(err: unknown): boolean {
  const msg = String(err).toLowerCase()
  return (
    msg.includes("fetch") ||
    msg.includes("network") ||
    msg.includes("load failed") ||
    msg.includes("failed to fetch") ||
    msg.includes("the string did not match the expected pattern") ||
    msg.includes("unexpected token") ||
    msg.includes("is not valid json") ||
    msg.includes("rate limit") ||
    msg.includes("bad gateway")
  )
}

function FileCheckbox({
  path,
  checked,
  color,
  onChange
}: {
  path: string
  checked: boolean
  color: string
  onChange: (checked: boolean) => void
}) {
  return (
    <div
      onClick={() => onChange(!checked)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px",
        cursor: "pointer",
        minHeight: 44
      }}
    >
      {/* Checkbox */}
      <div style={{
        width: 22,
        height: 22,
        borderRadius: 6,
        border: checked ? "none" : "2px solid #d1d1d6",
        backgroundColor: checked ? color : "transparent",
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "all 0.15s"
      }}>
        {checked && (
          <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
            <path d="M1 5L4.5 8.5L11 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </div>
      {/* Path */}
      <p style={{
        fontSize: 13,
        color: checked ? "var(--title)" : "var(--muted)",
        margin: 0,
        fontFamily: "'SF Mono', 'Fira Code', monospace",
        flex: 1,
        wordBreak: "break-all"
      }}>
        {path}
      </p>
    </div>
  )
}

export default function ImportPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string
  const searchParams = useSearchParams()
  const dropboxPath = searchParams.get("dropbox")
  const project = PROJECTS.find(p => p.slug === slug)
  const vercelUrl = project?.vercelProject
    ? `https://vercel.com/stuctech-83adc60b/${project.vercelProject}`
    : "https://vercel.com/stuctech-83adc60b/codesync"

  const [step, setStep] = useState<Step>("upload")
  const [diff, setDiff] = useState<DiffResult | null>(null)
  const [allFiles, setAllFiles] = useState<{ path: string; content: string }[]>([])
  const [errorMsg, setErrorMsg] = useState("")
  const [isNetworkError, setIsNetworkError] = useState(false)
  const [commitSha, setCommitSha] = useState("")
  const [isStale, setIsStale] = useState(false)
  const [loading, setLoading] = useState(false)
  const [zipName, setZipName] = useState("claude-import")
  const [autoTag, setAutoTag] = useState<string | null>(null)
  const [deployState, setDeployState] = useState<"idle" | "building" | "ready" | "error">("idle")
  const [wrongProjectWarning, setWrongProjectWarning] = useState(false)
  const [deployMessage, setDeployMessage] = useState("")
  const [deployProgress, setDeployProgress] = useState(0)

  // Voor auto-retry na app-wisseling
  const [lastZipFile, setLastZipFile] = useState<File | null>(null)
  const [retryAttempted, setRetryAttempted] = useState(false)

  // Checkbox state per file — deleted standaard UIT
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [expandedDiff, setExpandedDiff] = useState<string | null>(null)
  const [diffContent, setDiffContent] = useState<Record<string, { old: string; new: string }>>({})

  // Kernlogica voor het verwerken van een ZIP (File object) — herbruikbaar
  // voor zowel handmatige upload als retry na een netwerkonderbreking.
  async function processZipFile(file: File) {
    setZipName(file.name)
    setLoading(true)
    setErrorMsg("")
    setIsNetworkError(false)
    setWrongProjectWarning(false)

    // Controleer of ZIP naam overeenkomt met project slug
    const zipLower = file.name.toLowerCase().replace(/[-_]/g, "")
    const slugLower = slug.toLowerCase().replace(/[-_]/g, "")
    if (!zipLower.includes(slugLower)) {
      setWrongProjectWarning(true)
    }

    try {
      const formData = new FormData()
      formData.append("zip", file)

      const importRes = await fetch("/api/import", { method: "POST", body: formData })
      const importData = await importRes.json()
      if (!importRes.ok) throw new Error(importData.error)

      setAllFiles(importData.files)

      const diffRes = await fetch("/api/diff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectSlug: slug, files: importData.files })
      })
      const diffData = await diffRes.json()
      if (!diffRes.ok) throw new Error(diffData.error)

      const d: DiffResult = diffData.diff
      setDiff(d)
      setIsStale(diffData.isStale)

      // Geen wijzigingen → ZIP verwijderen uit Dropbox
      if (d.newFiles.length === 0 && d.modifiedFiles.length === 0 && d.deletedFiles.length === 0) {
        const pathToDelete = dropboxPath ?? `/codesyncapp/${file.name}`
        fetch("/api/dropbox/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: pathToDelete })
        }).catch(() => {})
      }

      // Standaard selectie: new + modified AAN, deleted UIT
      const initial: Record<string, boolean> = {}
      d.newFiles.forEach(f => { initial[f] = true })
      d.modifiedFiles.forEach(f => { initial[f] = true })
      d.deletedFiles.forEach(f => { initial[f] = false })
      setSelected(initial)

      setStep("review")
      setLastZipFile(null)
      setRetryAttempted(false)
    } catch (e) {
      setErrorMsg(String(e))
      setIsNetworkError(isLikelyNetworkError(e))
      setLastZipFile(file)
      setStep("error")
    } finally {
      setLoading(false)
    }
  }

  async function loadFromDropbox() {
    if (!dropboxPath) return
    setLoading(true)
    setErrorMsg("")
    setIsNetworkError(false)
    try {
      const res = await fetch("/api/dropbox/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: dropboxPath })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      // Zet base64 om naar File object
      const binary = atob(data.data)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      const blob = new Blob([bytes], { type: "application/zip" })
      const fileName = (dropboxPath ?? "").split("/").pop() ?? "dropbox.zip"
      const file = new File([blob], fileName, { type: "application/zip" })

      await processZipFile(file)
    } catch (e) {
      setErrorMsg(String(e))
      setIsNetworkError(isLikelyNetworkError(e))
      setStep("error")
    } finally {
      setLoading(false)
    }
  }

  // Auto-load ZIP van Dropbox als dropboxPath aanwezig
  useEffect(() => {
    if (!dropboxPath) return
    loadFromDropbox()
  }, [dropboxPath])

  // Auto-retry wanneer de app weer zichtbaar wordt na een netwerkfout
  // (bijv. na het wisselen naar een andere app tijdens het uitpakken)
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState !== "visible") return
      if (step !== "error" || !isNetworkError || retryAttempted) return

      setRetryAttempted(true)
      if (lastZipFile) {
        processZipFile(lastZipFile)
      } else if (dropboxPath) {
        loadFromDropbox()
      }
    }
    document.addEventListener("visibilitychange", handleVisibility)
    return () => document.removeEventListener("visibilitychange", handleVisibility)
  }, [step, isNetworkError, retryAttempted, lastZipFile, dropboxPath])

  // Registreer service worker en stuur subscription bij elke pagina open
  useEffect(() => {
    async function registerPush() {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) return
      try {
        const reg = await navigator.serviceWorker.register("/sw.js")
        await navigator.serviceWorker.ready

        const permission = await Notification.requestPermission()
        if (permission !== "granted") return

        const VAPID_PUBLIC_KEY = "BLUV8W7ScVb9b5UU3DRRfpen0oFcD1q8a95_vnM4_6EckjIu-lGmaX-dDoljID7M5d7hpJvU5PO5-gsd1z3m7YI"

        // Verwijder altijd oude subscription zodat de juiste key gebruikt wordt
        const existing = await reg.pushManager.getSubscription()
        if (existing) await existing.unsubscribe()

        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: VAPID_PUBLIC_KEY
        })

        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sub.toJSON())
        })
      } catch (e) {
        console.log("Push registration failed:", e)
      }
    }
    registerPush()
  }, [])

  // Start polling wanneer step naar done gaat
  useEffect(() => {
    if (step === "done") {
      setDeployState("building")
      setDeployProgress(10)
      pollDeployment(commitSha || undefined)
    }
  }, [step])

  async function loadFileDiff(path: string) {
    if (expandedDiff === path) {
      setExpandedDiff(null)
      return
    }
    setExpandedDiff(path)

    if (diffContent[path]) return // al geladen

    // Zoek nieuwe content uit ZIP
    const newFile = allFiles.find(f => f.path === path)
    if (!newFile) return

    // Haal oude content op van GitHub
    try {
      const res = await fetch("/api/contents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectSlug: slug, paths: [path] })
      })
      const data = await res.json()
      const oldContent = data.files?.[0]?.content ?? ""

      setDiffContent(prev => ({
        ...prev,
        [path]: { old: oldContent, new: newFile.content }
      }))
    } catch {
      setDiffContent(prev => ({
        ...prev,
        [path]: { old: "", new: newFile.content }
      }))
    }
  }

  function renderDiff(oldText: string, newText: string) {
    const oldLines = oldText.split("\n")
    const newLines = newText.split("\n")
    const result: { type: "added" | "removed" | "unchanged"; text: string }[] = []

    // Simple line-by-line diff
    let oi = 0, ni = 0

    while (oi < oldLines.length || ni < newLines.length) {
      const oldLine = oldLines[oi]
      const newLine = newLines[ni]

      if (oi >= oldLines.length) {
        result.push({ type: "added", text: newLine })
        ni++
      } else if (ni >= newLines.length) {
        result.push({ type: "removed", text: oldLine })
        oi++
      } else if (oldLine === newLine) {
        result.push({ type: "unchanged", text: oldLine })
        oi++
        ni++
      } else {
        result.push({ type: "removed", text: oldLine })
        result.push({ type: "added", text: newLine })
        oi++
        ni++
      }
    }

    // Toon max 200 regels
    return result.slice(0, 200)
  }

  async function handleZipUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    await processZipFile(file)
  }

  function toggleAll(fileList: string[], value: boolean) {
    setSelected(s => {
      const next = { ...s }
      fileList.forEach(f => { next[f] = value })
      return next
    })
  }

  async function pollDeployment(sha?: string) {
    let attempts = 0
    const maxAttempts = 20
    setDeployProgress(10)

    const poll = async () => {
      try {
        const res = await fetch(`/api/deployment?project=${encodeURIComponent(slug)}${sha ? `&sha=${sha}` : ""}`)
        const data = await res.json()

        if (!data || !data.state) {
          if (attempts < maxAttempts) { attempts++; setTimeout(poll, 3000) }
          return
        }

        const state = String(data.state)
        setDeployMessage(data.message ?? "")
        setDeployProgress(p => Math.min(p + 5, 90))

        if (state === "READY") {
          setDeployProgress(100)
          setDeployState("ready")
          // Stuur notificatie vanuit client — betrouwbaarder dan server
          await fetch("/api/push/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: `✅ ${slug} deployment geslaagd`,
              body: data.message ?? `${slug} is live`
            })
          }).catch(() => {})
          return
        }

        if (state === "ERROR" || state === "CANCELED") {
          setDeployProgress(100)
          setDeployState("error")
          await fetch("/api/push/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: `❌ ${slug} deployment mislukt`,
              body: data.message ?? "Check Vercel voor details"
            })
          }).catch(() => {})
          return
        }

        if (attempts < maxAttempts) {
          attempts++
          setTimeout(poll, 3000)
        }
      } catch {
        if (attempts < maxAttempts) { attempts++; setTimeout(poll, 3000) }
      }
    }

    // Wacht 30 seconden voor Vercel de nieuwe build start
    setTimeout(poll, 30000)
  }

  async function handleSync() {
    if (!diff) return
    setStep("syncing")

    // Geselecteerde nieuwe + gewijzigde bestanden
    const selectedFiles = allFiles.filter(f => selected[f.path])
    const filesToPush = selectedFiles.filter(f => !diff.deletedFiles.includes(f.path))

    // Geselecteerde verwijderde bestanden
    const filesToDelete = diff.deletedFiles.filter(f => selected[f])

    try {
      const syncRes = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectSlug: slug,
          files: filesToPush,
          filesToDelete,
          zipName
        })
      })
      const syncData = await syncRes.json()
      if (!syncRes.ok) throw new Error(syncData.error)

      setCommitSha(syncData.commitSha?.slice(0, 7) ?? "")
      if (syncData.autoTag) {
        setAutoTag(syncData.autoTag)
      }

      // Verwijder ZIP uit Dropbox na succesvolle push
      // Werkt zowel via wachtrij als handmatige upload
      const dropboxPathToDelete = dropboxPath ?? `/codesyncapp/${zipName}`
      await fetch("/api/dropbox/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: dropboxPathToDelete })
      }).catch(() => {}) // stil falen — niet kritiek

      setStep("done")
    } catch (e) {
      setErrorMsg(String(e))
      setIsNetworkError(isLikelyNetworkError(e))
      setStep("error")
    }
  }

  const selectedCount = Object.values(selected).filter(Boolean).length
  const hasSelection = selectedCount > 0

  return (
    <main style={{
      minHeight: "100dvh",
      backgroundColor: "var(--bg)",
      color: "var(--title)",
      fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
      padding: "env(safe-area-inset-top, 0px) 0 env(safe-area-inset-bottom, 40px)"
    }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>

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
          <Link href={`/projects/${slug}`} style={{
            fontSize: 15,
            color: "#007aff",
            textDecoration: "none",
            minHeight: 44,
            display: "flex",
            alignItems: "center"
          }}>
            ←
          </Link>
          <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "var(--title)" }}>
            ZIP Import
          </h1>
        </div>

        <div style={{ padding: "16px" }}>

          {/* UPLOAD */}
          {step === "upload" && (
            <label style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              background: "var(--card)",
              border: "2px dashed #d1d1d6",
              borderRadius: 16,
              padding: "48px 24px",
              cursor: "pointer",
              minHeight: 200
            }}>
              <span style={{ fontSize: 40, marginBottom: 16 }}>📦</span>
              <p style={{ fontSize: 17, fontWeight: 600, margin: "0 0 6px", color: "var(--title)" }}>
                {loading ? "Verwerken..." : "Tik om ZIP te uploaden"}
              </p>
              <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>
                Alleen .zip bestanden
              </p>
              <p style={{ fontSize: 11, color: "var(--muted)", margin: "8px 0 0", textAlign: "center" }}>
                Blijf in de app tot het overzicht verschijnt — anders kan iOS de verbinding onderbreken
              </p>
              <input type="file" accept=".zip" onChange={handleZipUpload} disabled={loading} style={{ display: "none" }} />
            </label>
          )}

          {/* REVIEW */}
          {step === "review" && diff && (
            <div>
              {/* Verkeerd project waarschuwing */}
              {wrongProjectWarning && (
                <div style={{
                  background: "#fffbeb",
                  border: "2px solid #f59e0b",
                  borderRadius: 12,
                  padding: "14px 16px",
                  marginBottom: 12
                }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "#92400e", margin: "0 0 4px" }}>
                    ⚠ Mogelijk verkeerd project
                  </p>
                  <p style={{ fontSize: 13, color: "#92400e", margin: 0 }}>
                    ZIP naam bevat niet <strong>{slug}</strong>. Controleer of je de juiste ZIP importeert.
                  </p>
                </div>
              )}

              {isStale && (
                <div style={{
                  background: "#fffbeb",
                  border: "1px solid #fde68a",
                  borderRadius: 10,
                  padding: "10px 14px",
                  marginBottom: 12
                }}>
                  <p style={{ fontSize: 12, color: "#92400e", margin: 0 }}>
                    ⚠ Cache — GitHub niet bereikbaar
                  </p>
                </div>
              )}

              {/* Summary */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: 8,
                marginBottom: 16
              }}>
                {[
                  { label: "Nieuw", count: diff.newFiles.length, color: "#16a34a" },
                  { label: "Gewijzigd", count: diff.modifiedFiles.length, color: "#d97706" },
                  { label: "Verwijderd", count: diff.deletedFiles.length, color: "#dc2626" }
                ].map(({ label, count, color }) => (
                  <div key={label} style={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    padding: "12px 8px",
                    textAlign: "center"
                  }}>
                    <p style={{ fontSize: 22, fontWeight: 700, color, margin: "0 0 2px" }}>{count}</p>
                    <p style={{ fontSize: 11, color: "var(--muted)", margin: 0 }}>{label}</p>
                  </div>
                ))}
              </div>

              {/* Selected count */}
              <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 12px" }}>
                {selectedCount} bestand{selectedCount !== 1 ? "en" : ""} geselecteerd
              </p>

              {/* NEW FILES */}
              {diff.newFiles.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <p style={{ fontSize: 12, color: "#16a34a", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", margin: 0 }}>
                      Nieuwe bestanden
                    </p>
                    <button onClick={() => toggleAll(diff.newFiles, !diff.newFiles.every(f => selected[f]))}
                      style={{ fontSize: 12, color: "#007aff", background: "none", border: "none", cursor: "pointer", padding: "4px 0" }}>
                      {diff.newFiles.every(f => selected[f]) ? "Alles uit" : "Alles aan"}
                    </button>
                  </div>
                  <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
                    {diff.newFiles.map((f, i) => (
                      <div key={f} style={{ borderTop: i > 0 ? "1px solid var(--divider)" : "none" }}>
                        <FileCheckbox
                          path={f}
                          checked={selected[f] ?? true}
                          color="#16a34a"
                          onChange={v => setSelected(s => ({ ...s, [f]: v }))}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* MODIFIED FILES */}
              {diff.modifiedFiles.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <p style={{ fontSize: 12, color: "#d97706", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", margin: 0 }}>
                      Gewijzigde bestanden
                    </p>
                    <button onClick={() => toggleAll(diff.modifiedFiles, !diff.modifiedFiles.every(f => selected[f]))}
                      style={{ fontSize: 12, color: "#007aff", background: "none", border: "none", cursor: "pointer", padding: "4px 0" }}>
                      {diff.modifiedFiles.every(f => selected[f]) ? "Alles uit" : "Alles aan"}
                    </button>
                  </div>
                  <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
                    {diff.modifiedFiles.map((f, i) => (
                      <div key={f} style={{ borderTop: i > 0 ? "1px solid var(--divider)" : "none" }}>
                        <div style={{ display: "flex", alignItems: "center" }}>
                          <div style={{ flex: 1 }}>
                            <FileCheckbox
                              path={f}
                              checked={selected[f] ?? true}
                              color="#d97706"
                              onChange={v => setSelected(s => ({ ...s, [f]: v }))}
                            />
                          </div>
                          <button
                            onClick={() => loadFileDiff(f)}
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              padding: "12px 14px",
                              fontSize: 13,
                              color: expandedDiff === f ? "#007aff" : "var(--muted)",
                              minHeight: 44
                            }}
                          >
                            {expandedDiff === f ? "▲" : "diff"}
                          </button>
                        </div>

                        {/* Diff weergave */}
                        {expandedDiff === f && (
                          <div style={{
                            borderTop: "1px solid var(--divider)",
                            backgroundColor: "#0d1117",
                            overflowX: "auto",
                            maxHeight: 300,
                            overflowY: "auto"
                          }}>
                            {diffContent[f] ? (
                              renderDiff(diffContent[f].old, diffContent[f].new).map((line, idx) => (
                                <div key={idx} style={{
                                  padding: "1px 12px",
                                  backgroundColor: line.type === "added" ? "#1a3a1a" : line.type === "removed" ? "#3a1a1a" : "transparent",
                                  display: "flex",
                                  gap: 8,
                                  minWidth: "max-content"
                                }}>
                                  <span style={{
                                    fontSize: 12,
                                    color: line.type === "added" ? "#4ade80" : line.type === "removed" ? "#f87171" : "#6b7280",
                                    fontFamily: "monospace",
                                    flexShrink: 0,
                                    userSelect: "none"
                                  }}>
                                    {line.type === "added" ? "+" : line.type === "removed" ? "-" : " "}
                                  </span>
                                  <span style={{
                                    fontSize: 12,
                                    color: line.type === "added" ? "#4ade80" : line.type === "removed" ? "#f87171" : "#8b949e",
                                    fontFamily: "monospace",
                                    whiteSpace: "pre"
                                  }}>
                                    {line.text}
                                  </span>
                                </div>
                              ))
                            ) : (
                              <p style={{ fontSize: 12, color: "#8b949e", padding: 12, margin: 0 }}>Laden...</p>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* DELETED FILES — standaard UIT */}
              {diff.deletedFiles.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <p style={{ fontSize: 12, color: "#dc2626", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", margin: 0 }}>
                      Verwijderde bestanden
                    </p>
                    <button onClick={() => toggleAll(diff.deletedFiles, !diff.deletedFiles.every(f => selected[f]))}
                      style={{ fontSize: 12, color: "#007aff", background: "none", border: "none", cursor: "pointer", padding: "4px 0" }}>
                      {diff.deletedFiles.every(f => selected[f]) ? "Alles uit" : "Alles aan"}
                    </button>
                  </div>
                  <div style={{
                    background: "#fff5f5",
                    border: "1px solid #fecaca",
                    borderRadius: 12,
                    overflow: "hidden"
                  }}>
                    <div style={{ padding: "8px 14px", borderBottom: "1px solid #fecaca" }}>
                      <p style={{ fontSize: 11, color: "#dc2626", margin: 0 }}>
                        ⚠ Standaard uitgevinkt — bewust aanzetten om te verwijderen
                      </p>
                    </div>
                    {diff.deletedFiles.map((f, i) => (
                      <div key={f} style={{ borderTop: i > 0 ? "1px solid #fee2e2" : "none" }}>
                        <FileCheckbox
                          path={f}
                          checked={selected[f] ?? false}
                          color="#dc2626"
                          onChange={v => setSelected(s => ({ ...s, [f]: v }))}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Geen wijzigingen */}
              {diff.newFiles.length === 0 && diff.modifiedFiles.length === 0 && diff.deletedFiles.length === 0 && (
                <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: 24, textAlign: "center" }}>
                  <p style={{ fontSize: 15, color: "var(--muted)", margin: 0 }}>Geen wijzigingen gevonden</p>
                </div>
              )}

              {/* Spacer voor sticky knop */}
              <div style={{ height: 80 }} />
            </div>
          )}

          {/* Sticky actie balk — review mode */}
          {step === "review" && (
            <div style={{
              position: "fixed",
              bottom: 0,
              left: 0,
              right: 0,
              padding: "12px 16px 24px",
              backgroundColor: "var(--bg)",
              borderTop: "1px solid var(--border)",
              zIndex: 50,
              display: "flex",
              gap: 10
            }}>
              <button
                onClick={() => setStep("upload")}
                style={{
                  flex: 1,
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  color: "var(--title)",
                  borderRadius: 12,
                  padding: "14px",
                  fontSize: 15,
                  fontWeight: 600,
                  minHeight: 44,
                  cursor: "pointer"
                }}
              >
                Annuleer
              </button>
              <button
                onClick={handleSync}
                disabled={!hasSelection}
                style={{
                  flex: 2,
                  background: hasSelection ? "#007aff" : "var(--border)",
                  border: "none",
                  color: hasSelection ? "#ffffff" : "var(--muted)",
                  borderRadius: 12,
                  padding: "14px",
                  fontSize: 15,
                  fontWeight: 700,
                  minHeight: 44,
                  cursor: hasSelection ? "pointer" : "default"
                }}
              >
                Push {selectedCount} bestand{selectedCount !== 1 ? "en" : ""}
              </button>
            </div>
          )}

          {/* SYNCING */}
          {step === "syncing" && (
            <div style={{ textAlign: "center", paddingTop: 64 }}>
              <p style={{ fontSize: 40, marginBottom: 16 }}>⏳</p>
              <p style={{ fontSize: 15, color: "var(--muted)" }}>Pushen naar GitHub...</p>
            </div>
          )}

          {/* DONE */}
          {step === "done" && (
            <div style={{ textAlign: "center", paddingTop: 48 }}>
              <div style={{
                width: 72, height: 72, borderRadius: "50%",
                background: "#f0fdf4", border: "2px solid #86efac",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 20px", fontSize: 32
              }}>✓</div>

              <p style={{ fontSize: 20, fontWeight: 700, margin: "0 0 8px", color: "var(--title)" }}>
                Gepusht naar GitHub
              </p>
              {commitSha && (
                <p style={{ fontSize: 13, color: "var(--muted)", fontFamily: "monospace", margin: "0 0 4px" }}>
                  {commitSha.slice(0, 7)}
                </p>
              )}
              {autoTag && (
                <p style={{ fontSize: 12, color: "#16a34a", margin: "0 0 20px" }}>
                  🔖 Auto-herstelpunt {autoTag}
                </p>
              )}
              {!autoTag && <div style={{ marginBottom: 20 }} />}

              {/* Deployment status */}
              <div style={{
                background: deployState === "ready" ? "#f0fdf4" : deployState === "error" ? "#fff5f5" : "var(--card)",
                border: `1px solid ${deployState === "ready" ? "#86efac" : deployState === "error" ? "#fecaca" : "var(--border)"}`,
                borderRadius: 12, padding: "14px 16px", marginBottom: 24, textAlign: "left"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: deployState === "building" ? 12 : 0 }}>
                  <span style={{ fontSize: 18 }}>
                    {deployState === "ready" ? "✅" : deployState === "error" ? "❌" : "⏳"}
                  </span>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: "var(--title)", margin: 0 }}>
                      {deployState === "ready" ? "Deployment geslaagd" : deployState === "error" ? "Deployment mislukt" : "Vercel aan het bouwen..."}
                    </p>
                    {deployMessage && (
                      <p style={{ fontSize: 12, color: "var(--muted)", margin: "2px 0 0" }}>{deployMessage}</p>
                    )}
                  </div>
                </div>
                {/* Progress bar */}
                {deployState === "building" && (
                  <div style={{ background: "var(--border)", borderRadius: 4, height: 4, overflow: "hidden" }}>
                    <div style={{
                      height: "100%",
                      width: `${deployProgress}%`,
                      background: "#007aff",
                      borderRadius: 4,
                      transition: "width 0.5s ease"
                    }} />
                  </div>
                )}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <button onClick={() => router.push(`/projects/${slug}`)} style={{
                  width: "100%", background: "#007aff", border: "none", color: "#ffffff",
                  borderRadius: 12, padding: "14px", fontSize: 15, fontWeight: 600,
                  minHeight: 44, cursor: "pointer"
                }}>Terug naar project</button>
                <a href={vercelUrl} target="_blank" rel="noopener noreferrer" style={{
                  width: "100%", background: "var(--card)", border: "1px solid var(--border)", color: "var(--title)",
                  borderRadius: 12, padding: "14px", fontSize: 15, fontWeight: 600, minHeight: 44,
                  textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center",
                  boxSizing: "border-box"
                }}>Bekijk deployment →</a>
              </div>
            </div>
          )}

          {/* ERROR */}
          {step === "error" && (
            <div>
              <div style={{
                background: "#fff5f5",
                border: "1px solid #fecaca",
                borderRadius: 12,
                padding: 16,
                marginBottom: 16
              }}>
                <p style={{ fontSize: 14, color: "#dc2626", margin: "0 0 6px", fontWeight: 600 }}>
                  {isNetworkError ? "Verbinding onderbroken" : "Fout opgetreden"}
                </p>
                {isNetworkError ? (
                  <p style={{ fontSize: 13, color: "#991b1b", margin: 0 }}>
                    Waarschijnlijk doordat je naar een andere app wisselde tijdens het verwerken.
                    {(lastZipFile || dropboxPath) ? " CodeSync probeert het automatisch opnieuw zodra je terugkomt." : " Probeer het opnieuw."}
                  </p>
                ) : (
                  <p style={{ fontSize: 12, color: "#991b1b", margin: 0, fontFamily: "monospace" }}>{errorMsg}</p>
                )}
              </div>
              <button
                onClick={() => {
                  setRetryAttempted(false)
                  if (lastZipFile) {
                    processZipFile(lastZipFile)
                  } else if (dropboxPath) {
                    loadFromDropbox()
                  } else {
                    setStep("upload")
                    setErrorMsg("")
                    setIsNetworkError(false)
                  }
                }}
                style={{
                  width: "100%",
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  color: "var(--title)",
                  borderRadius: 12,
                  padding: "14px",
                  fontSize: 15,
                  fontWeight: 600,
                  minHeight: 44,
                  cursor: "pointer"
                }}
              >
                Opnieuw proberen
              </button>
            </div>
          )}

        </div>
      </div>
    </main>
  )
}
