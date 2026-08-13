// Client-side toegangssleutel-beheer (Master Plan v1.1, sectie 4).
// De sleutel wordt NOOIT in de build-bundle gebakken — alleen opgeslagen
// in localStorage van het device nadat de gebruiker 'm zelf heeft ingevoerd.

const STORAGE_KEY = "codesync-access-key"

export function getAccessKey(): string | null {
  if (typeof window === "undefined") return null
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function setAccessKey(key: string): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(STORAGE_KEY, key)
  } catch {}
}

export function clearAccessKey(): void {
  if (typeof window === "undefined") return
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {}
}

// Drop-in vervanging voor fetch() — voegt automatisch de X-CodeSync-Key
// header toe uit localStorage. Gebruik dit voor ALLE aanroepen naar eigen
// CodeSync API-routes.
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const key = getAccessKey()
  const headers = new Headers(options.headers)
  if (key) headers.set("X-CodeSync-Key", key)
  return fetch(url, { ...options, headers })
}
