"use client"

import { useState, useEffect, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"

type DiffResult = {
  newFiles: string[]
  modifiedFiles: string[]
  deletedFiles: string[]
  unchanged: string[]
}

type Step = "upload" | "review" | "syncing" | "done" | "error"

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
        color: checked ? "#1c1c1e" : "#8e8e93",
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

  const [step, setStep] = useState<Step>("upload")
  const [diff, setDiff] = useState<DiffResult | null>(null)
  const [allFiles, setAllFiles] = useState<{ path: string; content: string }[]>([])
  const [errorMsg, setErrorMsg] = useState("")
  const [commitSha, setCommitSha] = useState("")
  const [isStale, setIsStale] = useState(false)
  const [loading, setLoading] = useState(false)
  const [zipName, setZipName] = useState("claude-import")
  const [deployState, setDeployState] = useState<"idle" | "building" | "ready" | "error">("idle")
  const [deployMessage, setDeployMessage] = useState("")
  const [deployProgress, setDeployProgress] = useState(0)

  // Checkbox state per file — deleted standaard UIT
  const [selected, setSelected] = useState<Record<string, boolean>>({})

  // Start polling wanneer step naar done gaat
  useEffect(() => {
    if (step === "done") {
      setDeployState("building")
      setDeployProgress(10)
      pollDeployment()
    }
  }, [step])

  async function handleZipUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setZipName(file.name)
    setLoading(true)
    setErrorMsg("")

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

      // Standaard selectie: new + modified AAN, deleted UIT
      const initial: Record<string, boolean> = {}
      d.newFiles.forEach(f => { initial[f] = true })
      d.modifiedFiles.forEach(f => { initial[f] = true })
      d.deletedFiles.forEach(f => { initial[f] = false })
      setSelected(initial)

      setStep("review")
    } catch (e) {
      setErrorMsg(String(e))
      setStep("error")
    } finally {
      setLoading(false)
    }
  }

  function toggleAll(fileList: string[], value: boolean) {
    setSelected(s => {
      const next = { ...s }
      fileList.forEach(f => { next[f] = value })
      return next
    })
  }

  async function pollDeployment() {
    let attempts = 0
    const maxAttempts = 20
    setDeployProgress(10)

    const poll = async () => {
      try {
        const res = await fetch("/api/deployment")
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
          return
        }

        if (state === "ERROR" || state === "CANCELED") {
          setDeployProgress(100)
          setDeployState("error")
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

    poll()
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

      setCommitSha(syncData.commitSha)
      setStep("done")
    } catch (e) {
      setErrorMsg(String(e))
      setStep("error")
    }
  }

  const selectedCount = Object.values(selected).filter(Boolean).length
  const hasSelection = selectedCount > 0

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
          <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "#1c1c1e" }}>
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
              background: "#ffffff",
              border: "2px dashed #d1d1d6",
              borderRadius: 16,
              padding: "48px 24px",
              cursor: "pointer",
              minHeight: 200
            }}>
              <span style={{ fontSize: 40, marginBottom: 16 }}>📦</span>
              <p style={{ fontSize: 17, fontWeight: 600, margin: "0 0 6px", color: "#1c1c1e" }}>
                {loading ? "Verwerken..." : "Tik om ZIP te uploaden"}
              </p>
              <p style={{ fontSize: 13, color: "#8e8e93", margin: 0 }}>
                Alleen .zip bestanden
              </p>
              <input type="file" accept=".zip" onChange={handleZipUpload} disabled={loading} style={{ display: "none" }} />
            </label>
          )}

          {/* REVIEW */}
          {step === "review" && diff && (
            <div>
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
                    background: "#ffffff",
                    border: "1px solid #e5e5ea",
                    borderRadius: 10,
                    padding: "12px 8px",
                    textAlign: "center"
                  }}>
                    <p style={{ fontSize: 22, fontWeight: 700, color, margin: "0 0 2px" }}>{count}</p>
                    <p style={{ fontSize: 11, color: "#8e8e93", margin: 0 }}>{label}</p>
                  </div>
                ))}
              </div>

              {/* Selected count */}
              <p style={{ fontSize: 13, color: "#8e8e93", margin: "0 0 12px" }}>
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
                  <div style={{ background: "#ffffff", border: "1px solid #e5e5ea", borderRadius: 12, overflow: "hidden" }}>
                    {diff.newFiles.map((f, i) => (
                      <div key={f} style={{ borderTop: i > 0 ? "1px solid #f2f2f7" : "none" }}>
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
                  <div style={{ background: "#ffffff", border: "1px solid #e5e5ea", borderRadius: 12, overflow: "hidden" }}>
                    {diff.modifiedFiles.map((f, i) => (
                      <div key={f} style={{ borderTop: i > 0 ? "1px solid #f2f2f7" : "none" }}>
                        <FileCheckbox
                          path={f}
                          checked={selected[f] ?? true}
                          color="#d97706"
                          onChange={v => setSelected(s => ({ ...s, [f]: v }))}
                        />
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
                <div style={{ background: "#ffffff", border: "1px solid #e5e5ea", borderRadius: 12, padding: 24, textAlign: "center" }}>
                  <p style={{ fontSize: 15, color: "#8e8e93", margin: 0 }}>Geen wijzigingen gevonden</p>
                </div>
              )}

              {/* Acties */}
              <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                <button
                  onClick={() => setStep("upload")}
                  style={{
                    flex: 1,
                    background: "#ffffff",
                    border: "1px solid #e5e5ea",
                    color: "#1c1c1e",
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
                    background: hasSelection ? "#007aff" : "#e5e5ea",
                    border: "none",
                    color: hasSelection ? "#ffffff" : "#8e8e93",
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
            </div>
          )}

          {/* SYNCING */}
          {step === "syncing" && (
            <div style={{ textAlign: "center", paddingTop: 64 }}>
              <p style={{ fontSize: 40, marginBottom: 16 }}>⏳</p>
              <p style={{ fontSize: 15, color: "#8e8e93" }}>Pushen naar GitHub...</p>
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

              <p style={{ fontSize: 20, fontWeight: 700, margin: "0 0 8px", color: "#1c1c1e" }}>
                Gepusht naar GitHub
              </p>
              {commitSha && (
                <p style={{ fontSize: 13, color: "#8e8e93", fontFamily: "monospace", margin: "0 0 20px" }}>
                  {commitSha.slice(0, 7)}
                </p>
              )}

              {/* Deployment status */}
              <div style={{
                background: deployState === "ready" ? "#f0fdf4" : deployState === "error" ? "#fff5f5" : "#ffffff",
                border: `1px solid ${deployState === "ready" ? "#86efac" : deployState === "error" ? "#fecaca" : "#e5e5ea"}`,
                borderRadius: 12, padding: "14px 16px", marginBottom: 24, textAlign: "left"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: deployState === "building" ? 12 : 0 }}>
                  <span style={{ fontSize: 18 }}>
                    {deployState === "ready" ? "✅" : deployState === "error" ? "❌" : "⏳"}
                  </span>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: "#1c1c1e", margin: 0 }}>
                      {deployState === "ready" ? "Deployment geslaagd" : deployState === "error" ? "Deployment mislukt" : "Vercel aan het bouwen..."}
                    </p>
                    {deployMessage && (
                      <p style={{ fontSize: 12, color: "#8e8e93", margin: "2px 0 0" }}>{deployMessage}</p>
                    )}
                  </div>
                </div>
                {/* Progress bar */}
                {deployState === "building" && (
                  <div style={{ background: "#e5e5ea", borderRadius: 4, height: 4, overflow: "hidden" }}>
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
                <a href="https://vercel.com/stuctech-83adc60b/codesync" target="_blank" rel="noopener noreferrer" style={{
                  width: "100%", background: "#ffffff", border: "1px solid #e5e5ea", color: "#1c1c1e",
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
                <p style={{ fontSize: 14, color: "#dc2626", margin: "0 0 6px", fontWeight: 600 }}>Fout opgetreden</p>
                <p style={{ fontSize: 12, color: "#991b1b", margin: 0, fontFamily: "monospace" }}>{errorMsg}</p>
              </div>
              <button
                onClick={() => { setStep("upload"); setErrorMsg("") }}
                style={{
                  width: "100%",
                  background: "#ffffff",
                  border: "1px solid #e5e5ea",
                  color: "#1c1c1e",
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
