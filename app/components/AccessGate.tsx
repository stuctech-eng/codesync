"use client"

import { useState, useEffect } from "react"
import { getAccessKey, setAccessKey, authFetch } from "@/lib/access-key"

export default function AccessGate({ children }: { children: React.ReactNode }) {
  const [checking, setChecking] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const [input, setInput] = useState("")
  const [error, setError] = useState("")
  const [verifying, setVerifying] = useState(false)

  useEffect(() => {
    const key = getAccessKey()
    if (!key) {
      setChecking(false)
      return
    }
    // Bestaande sleutel valideren tegen een lichte, altijd-beschikbare route
    authFetch("/api/health")
      .then(res => {
        setAuthorized(res.ok)
        setChecking(false)
      })
      .catch(() => setChecking(false))
  }, [])

  async function handleSubmit() {
    if (!input.trim() || verifying) return
    setVerifying(true)
    setError("")
    setAccessKey(input.trim())
    try {
      const res = await authFetch("/api/health")
      if (res.ok) {
        setAuthorized(true)
      } else {
        setError("Ongeldige sleutel")
      }
    } catch {
      setError("Kon niet verbinden — check je netwerk")
    } finally {
      setVerifying(false)
    }
  }

  if (checking) return null

  if (!authorized) {
    return (
      <div style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        backgroundColor: "var(--bg)",
        fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
      }}>
        <p style={{ fontSize: 20, fontWeight: 700, marginBottom: 6, color: "var(--title)" }}>
          CodeSync
        </p>
        <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 20, textAlign: "center" }}>
          Voer je toegangssleutel in
        </p>
        <input
          type="password"
          inputMode="text"
          autoCapitalize="none"
          autoCorrect="off"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") handleSubmit() }}
          placeholder="Toegangssleutel"
          style={{
            width: "100%",
            maxWidth: 320,
            padding: "14px 16px",
            fontSize: 15,
            border: "1px solid var(--border)",
            borderRadius: 12,
            marginBottom: 12,
            background: "var(--card)",
            color: "var(--title)",
            boxSizing: "border-box"
          }}
        />
        {error && (
          <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</p>
        )}
        <button
          onClick={handleSubmit}
          disabled={verifying || !input.trim()}
          style={{
            width: "100%",
            maxWidth: 320,
            padding: "14px",
            background: verifying || !input.trim() ? "var(--border)" : "#1c1c1e",
            color: verifying || !input.trim() ? "var(--muted)" : "#ffffff",
            border: "none",
            borderRadius: 12,
            fontSize: 15,
            fontWeight: 600,
            cursor: verifying || !input.trim() ? "default" : "pointer",
            minHeight: 48
          }}
        >
          {verifying ? "Controleren..." : "Ontgrendel"}
        </button>
      </div>
    )
  }

  return <>{children}</>
}
