"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { authFetch } from "@/lib/access-key"

// Nieuw project toevoegen (Master Plan v1.5-uitbreiding). Maakt GEEN
// directe wijziging -- stuurt aan op een changeset-voorstel voor
// lib/projects.ts, dat de gebruiker net als elke andere codewijziging
// moet goedkeuren vóór het daadwerkelijk naar GitHub gaat.
export default function NewProjectPage() {
  const router = useRouter()

  const [slug, setSlug] = useState("")
  const [name, setName] = useState("")
  const [githubRepo, setGithubRepo] = useState("")
  const [branch, setBranch] = useState("main")
  const [status, setStatus] = useState<"active" | "experimental" | "archive">("active")
  const [stack, setStack] = useState("")
  const [vercelProject, setVercelProject] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit() {
    setError("")
    setSubmitting(true)
    try {
      const res = await authFetch("/api/projects/new", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, name, githubRepo, branch, status, stack, vercelProject })
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`)
      }
      // Doorsturen naar het bestaande review-scherm -- zelfde
      // Goedkeuren/Afwijzen-flow als elke andere changeset.
      router.push(`/projects/codesync/changesets/${data.changesetId}`)
    } catch (e) {
      setError(String(e))
    } finally {
      setSubmitting(false)
    }
  }

  const canSubmit = slug.trim() && name.trim() && githubRepo.trim() && !submitting

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
          position: "fixed", top: "env(safe-area-inset-top, 0px)", left: 0, right: 0,
          maxWidth: 480, margin: "0 auto", backgroundColor: "var(--header-bg)",
          borderBottom: "1px solid var(--border)", padding: "12px 16px",
          display: "flex", alignItems: "center", gap: 12, zIndex: 20
        }}>
          <Link href="/" style={{ fontSize: 15, color: "#007aff", textDecoration: "none", minHeight: 44, display: "flex", alignItems: "center" }}>←</Link>
          <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>+ Nieuw project</h1>
        </div>

        <div style={{ padding: 16, paddingTop: 84 }}>
          <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 20px" }}>
            Dit maakt een wijzigingsvoorstel aan (net als bij codewijzigingen) — je keurt het daarna goed in het vertrouwde review-scherm, vóór het echt aan de projectenlijst wordt toegevoegd.
          </p>

          {error && (
            <div style={{ background: "#fff5f5", border: "1px solid #fecaca", borderRadius: 10, padding: "10px 14px", marginBottom: 16 }}>
              <p style={{ fontSize: 13, color: "#dc2626", margin: 0 }}>{error}</p>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Field label="Slug (uniek, kleine letters/koppeltekens)" value={slug} onChange={setSlug} placeholder="bijv. mijn-app" />
            <Field label="Naam" value={name} onChange={setName} placeholder="Mijn App" />
            <Field label="GitHub-repo (eigenaar/repo)" value={githubRepo} onChange={setGithubRepo} placeholder="stuctech-eng/mijn-app" />
            <Field label="Branch" value={branch} onChange={setBranch} placeholder="main" />

            <div>
              <label style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 6 }}>Status</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as any)}
                style={{
                  width: "100%", padding: "12px 14px", fontSize: 16, borderRadius: 10,
                  border: "1px solid var(--border)", background: "var(--card)", color: "var(--title)"
                }}
              >
                <option value="active">Active</option>
                <option value="experimental">Experimental</option>
                <option value="archive">Archive</option>
              </select>
            </div>

            <Field label="Stack (komma-gescheiden, optioneel)" value={stack} onChange={setStack} placeholder="Next.js 15, TypeScript, Firebase" />
            <Field label="Vercel-projectnaam (optioneel)" value={vercelProject} onChange={setVercelProject} placeholder="mijn-app" />
          </div>

          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            style={{
              width: "100%", marginTop: 24, padding: "14px", borderRadius: 12, border: "none",
              background: canSubmit ? "#007aff" : "var(--border)",
              color: canSubmit ? "#ffffff" : "var(--muted)",
              fontSize: 15, fontWeight: 700, cursor: canSubmit ? "pointer" : "default"
            }}
          >
            {submitting ? "Bezig..." : "Voorstel klaarzetten →"}
          </button>
        </div>
      </div>
    </main>
  )
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div>
      <label style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 6 }}>{label}</label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: "100%", padding: "12px 14px", fontSize: 16, borderRadius: 10,
          border: "1px solid var(--border)", background: "var(--card)", color: "var(--title)",
          boxSizing: "border-box"
        }}
      />
    </div>
  )
}
