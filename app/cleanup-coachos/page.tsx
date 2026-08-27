"use client"

import { useState } from "react"
import Link from "next/link"
import { authFetch } from "@/lib/access-key"

// TIJDELIJK opruimscherm -- niet permanent onderdeel van de app, mag na
// gebruik weer verwijderd worden. Gebruikt de bestaande authFetch() (leest
// de al-opgeslagen toegangssleutel uit localStorage) -- er staat dus geen
// geheime sleutel in dit bestand zelf, veilig om te committen.
export default function CleanupCoachOSPage() {
  const [result1, setResult1] = useState<{ changesetId: string } | null>(null)
  const [result2, setResult2] = useState<{ changesetId: string } | null>(null)
  const [loading, setLoading] = useState<1 | 2 | null>(null)
  const [error, setError] = useState("")

  async function runBatch(batch: 1 | 2) {
    setError("")
    setLoading(batch)
    try {
      const res = await authFetch("/api/cleanup-coachos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batch })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      if (batch === 1) setResult1(data)
      else setResult2(data)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(null)
    }
  }

  return (
    <main style={{
      minHeight: "100dvh", padding: "env(safe-area-inset-top, 0px) 16px 40px",
      backgroundColor: "var(--bg)", color: "var(--title)",
      fontFamily: "'SF Pro Display', -apple-system, sans-serif"
    }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginTop: 24 }}>Opruimen: CoachOS</h1>
      <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 24 }}>
        Verwijdert de per ongeluk in CoachOS beland map <code>coachos-connect-ios/</code> (27 bestanden, in 2 batches vanwege de 15-bestanden-limiet). Elke batch levert een changeset op die je apart moet goedkeuren.
      </p>

      {error && (
        <div style={{ background: "#fff5f5", border: "1px solid #fecaca", borderRadius: 10, padding: "10px 14px", marginBottom: 16 }}>
          <p style={{ fontSize: 13, color: "#dc2626", margin: 0 }}>{error}</p>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
          <p style={{ fontWeight: 600, marginBottom: 8 }}>Batch 1 (15 bestanden)</p>
          {result1 ? (
            <Link
              href={`/projects/coachos/changesets/${result1.changesetId}`}
              style={{ display: "inline-block", background: "#007aff", color: "#fff", padding: "10px 16px", borderRadius: 8, textDecoration: "none", fontSize: 14, fontWeight: 700 }}
            >
              Bekijk changeset →
            </Link>
          ) : (
            <button
              onClick={() => runBatch(1)}
              disabled={loading === 1}
              style={{ background: "#007aff", color: "#fff", border: "none", padding: "10px 16px", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: "pointer" }}
            >
              {loading === 1 ? "Bezig..." : "Batch 1 aanmaken"}
            </button>
          )}
        </div>

        <div style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 16, opacity: result1 ? 1 : 0.5 }}>
          <p style={{ fontWeight: 600, marginBottom: 8 }}>Batch 2 (12 bestanden)</p>
          <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>
            Pas aanmaken NADAT batch 1 is goedgekeurd — anders is de HEAD-check verouderd.
          </p>
          {result2 ? (
            <Link
              href={`/projects/coachos/changesets/${result2.changesetId}`}
              style={{ display: "inline-block", background: "#007aff", color: "#fff", padding: "10px 16px", borderRadius: 8, textDecoration: "none", fontSize: 14, fontWeight: 700 }}
            >
              Bekijk changeset →
            </Link>
          ) : (
            // Bugfix: de blokkade "alleen als batch 1 in DEZE
            // pagina-sessie is gelukt" was te streng -- na een
            // paginaherlaad vergeet React dat batch 1 al klaar was, ook
            // als dat server-side allang zo is. Knop nu altijd
            // beschikbaar.
            <button
              onClick={() => runBatch(2)}
              disabled={loading === 2}
              style={{ background: "#007aff", color: "#fff", border: "none", padding: "10px 16px", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: "pointer" }}
            >
              {loading === 2 ? "Bezig..." : "Batch 2 aanmaken"}
            </button>
          )}
        </div>
      </div>
    </main>
  )
}
