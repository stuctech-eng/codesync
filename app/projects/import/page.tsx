"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"

type DiffResult = {
  newFiles: string[]
  modifiedFiles: string[]
  deletedFiles: string[]
  unchanged: string[]
}

type Step = "upload" | "review" | "syncing" | "done" | "error"

export default function ImportPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string

  const [step, setStep] = useState<Step>("upload")
  const [diff, setDiff] = useState<DiffResult | null>(null)
  const [files, setFiles] = useState<{ path: string; content: string }[]>([])
  const [errorMsg, setErrorMsg] = useState("")
  const [commitSha, setCommitSha] = useState("")
  const [isStale, setIsStale] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleZipUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    setErrorMsg("")

    try {
      // 1. Extract ZIP
      const formData = new FormData()
      formData.append("zip", file)

      const importRes = await fetch("/api/import", {
        method: "POST",
        body: formData
      })
      const importData = await importRes.json()
      if (!importRes.ok) throw new Error(importData.error)

      setFiles(importData.files)

      // 2. Calculate diff
      const diffRes = await fetch("/api/diff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectSlug: slug, files: importData.files })
      })
      const diffData = await diffRes.json()
      if (!diffRes.ok) throw new Error(diffData.error)

      setDiff(diffData.diff)
      setIsStale(diffData.isStale)
      setStep("review")

    } catch (e) {
      setErrorMsg(String(e))
      setStep("error")
    } finally {
      setLoading(false)
    }
  }

  async function handleSync() {
    setStep("syncing")

    try {
      const syncRes = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectSlug: slug,
          files,
          message: `Claude import — ${new Date().toISOString()}`
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
        <Link href={`/projects/${slug}`} style={{
          fontSize: 15,
          color: "#5a5a7a",
          textDecoration: "none",
          display: "inline-block",
          marginBottom: 24
        }}>
          ← Terug
        </Link>

        <h1 style={{
          fontSize: 24,
          fontWeight: 700,
          letterSpacing: "-0.02em",
          margin: "0 0 8px"
        }}>
          ZIP Import
        </h1>
        <p style={{ fontSize: 13, color: "#5a5a7a", margin: "0 0 32px" }}>
          Upload een Claude ZIP om te vergelijken met GitHub
        </p>

        {/* STEP: UPLOAD */}
        {step === "upload" && (
          <div>
            <label style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              background: "#12121a",
              border: "2px dashed #2a2a3a",
              borderRadius: 16,
              padding: "48px 24px",
              cursor: "pointer",
              minHeight: 160
            }}>
              <span style={{ fontSize: 32, marginBottom: 12 }}>📦</span>
              <p style={{ fontSize: 15, fontWeight: 600, margin: "0 0 4px" }}>
                {loading ? "Verwerken..." : "Tik om ZIP te uploaden"}
              </p>
              <p style={{ fontSize: 12, color: "#4a4a6a", margin: 0 }}>
                .zip bestanden alleen
              </p>
              <input
                type="file"
                accept=".zip"
                onChange={handleZipUpload}
                disabled={loading}
                style={{ display: "none" }}
              />
            </label>
          </div>
        )}

        {/* STEP: REVIEW */}
        {step === "review" && diff && (
          <div>
            {isStale && (
              <div style={{
                background: "#1a1a0a",
                border: "1px solid #3a3a1a",
                borderRadius: 10,
                padding: "10px 14px",
                marginBottom: 16
              }}>
                <p style={{ fontSize: 12, color: "#facc15", margin: 0 }}>
                  ⚠ Vergelijking op basis van cache — GitHub niet bereikbaar
                </p>
              </div>
            )}

            {/* Diff summary */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 8,
              marginBottom: 24
            }}>
              {[
                { label: "Nieuw", count: diff.newFiles.length, color: "#4ade80" },
                { label: "Gewijzigd", count: diff.modifiedFiles.length, color: "#facc15" },
                { label: "Verwijderd", count: diff.deletedFiles.length, color: "#f87171" }
              ].map(({ label, count, color }) => (
                <div key={label} style={{
                  background: "#12121a",
                  border: "1px solid #1e1e2e",
                  borderRadius: 10,
                  padding: "14px 12px",
                  textAlign: "center"
                }}>
                  <p style={{ fontSize: 24, fontWeight: 700, color, margin: "0 0 4px" }}>
                    {count}
                  </p>
                  <p style={{ fontSize: 11, color: "#4a4a6a", margin: 0 }}>
                    {label}
                  </p>
                </div>
              ))}
            </div>

            {/* File lists */}
            {[
              { files: diff.newFiles, label: "Nieuwe bestanden", color: "#4ade80" },
              { files: diff.modifiedFiles, label: "Gewijzigde bestanden", color: "#facc15" },
              { files: diff.deletedFiles, label: "Verwijderde bestanden", color: "#f87171" }
            ].filter(g => g.files.length > 0).map(group => (
              <div key={group.label} style={{ marginBottom: 16 }}>
                <p style={{
                  fontSize: 11,
                  color: group.color,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  margin: "0 0 8px",
                  fontWeight: 600
                }}>
                  {group.label}
                </p>
                <div style={{
                  background: "#12121a",
                  border: "1px solid #1e1e2e",
                  borderRadius: 10,
                  overflow: "hidden"
                }}>
                  {group.files.map((f, i) => (
                    <div key={f} style={{
                      padding: "10px 14px",
                      borderBottom: i < group.files.length - 1 ? "1px solid #1a1a2a" : "none"
                    }}>
                      <p style={{
                        fontSize: 12,
                        color: "#6a6a8a",
                        margin: 0,
                        fontFamily: "'SF Mono', 'Fira Code', monospace"
                      }}>
                        {f}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* No changes */}
            {diff.newFiles.length === 0 && diff.modifiedFiles.length === 0 && diff.deletedFiles.length === 0 && (
              <div style={{
                background: "#12121a",
                border: "1px solid #1e1e2e",
                borderRadius: 10,
                padding: 24,
                textAlign: "center",
                marginBottom: 24
              }}>
                <p style={{ fontSize: 15, color: "#4a4a6a", margin: 0 }}>
                  Geen wijzigingen gevonden
                </p>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
              <button
                onClick={() => setStep("upload")}
                style={{
                  flex: 1,
                  background: "#12121a",
                  border: "1px solid #1e1e2e",
                  color: "#e8e8f0",
                  borderRadius: 10,
                  padding: "14px",
                  fontSize: 14,
                  fontWeight: 600,
                  minHeight: 44,
                  cursor: "pointer"
                }}
              >
                Annuleer
              </button>
              <button
                onClick={handleSync}
                disabled={diff.newFiles.length === 0 && diff.modifiedFiles.length === 0 && diff.deletedFiles.length === 0}
                style={{
                  flex: 2,
                  background: "#4ade80",
                  border: "none",
                  color: "#0a0a0f",
                  borderRadius: 10,
                  padding: "14px",
                  fontSize: 14,
                  fontWeight: 700,
                  minHeight: 44,
                  cursor: "pointer",
                  opacity: (diff.newFiles.length === 0 && diff.modifiedFiles.length === 0 && diff.deletedFiles.length === 0) ? 0.4 : 1
                }}
              >
                Push naar GitHub
              </button>
            </div>
          </div>
        )}

        {/* STEP: SYNCING */}
        {step === "syncing" && (
          <div style={{ textAlign: "center", paddingTop: 48 }}>
            <p style={{ fontSize: 32, marginBottom: 16 }}>⏳</p>
            <p style={{ fontSize: 15, color: "#7878aa" }}>Pushen naar GitHub...</p>
          </div>
        )}

        {/* STEP: DONE */}
        {step === "done" && (
          <div style={{ textAlign: "center", paddingTop: 32 }}>
            <p style={{ fontSize: 48, marginBottom: 16 }}>✓</p>
            <p style={{ fontSize: 18, fontWeight: 700, margin: "0 0 8px" }}>
              Gepusht naar GitHub
            </p>
            {commitSha && (
              <p style={{
                fontSize: 12,
                color: "#4a4a6a",
                fontFamily: "monospace",
                margin: "0 0 32px"
              }}>
                {commitSha.slice(0, 7)}
              </p>
            )}
            <button
              onClick={() => router.push(`/projects/${slug}`)}
              style={{
                background: "#12121a",
                border: "1px solid #1e1e2e",
                color: "#e8e8f0",
                borderRadius: 10,
                padding: "14px 28px",
                fontSize: 14,
                fontWeight: 600,
                minHeight: 44,
                cursor: "pointer"
              }}
            >
              Terug naar project
            </button>
          </div>
        )}

        {/* STEP: ERROR */}
        {step === "error" && (
          <div>
            <div style={{
              background: "#1a0a0a",
              border: "1px solid #3a1a1a",
              borderRadius: 10,
              padding: 16,
              marginBottom: 24
            }}>
              <p style={{ fontSize: 13, color: "#f87171", margin: "0 0 8px", fontWeight: 600 }}>
                Fout opgetreden
              </p>
              <p style={{ fontSize: 12, color: "#5a3a3a", margin: 0, fontFamily: "monospace" }}>
                {errorMsg}
              </p>
            </div>
            <button
              onClick={() => { setStep("upload"); setErrorMsg("") }}
              style={{
                width: "100%",
                background: "#12121a",
                border: "1px solid #1e1e2e",
                color: "#e8e8f0",
                borderRadius: 10,
                padding: "14px",
                fontSize: 14,
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
    </main>
  )
}
