// Dropbox token management — refresh token flow

let cachedToken: string | null = null
let tokenExpiry: number = 0

export async function getDropboxToken(): Promise<string> {
  // Gebruik gecachte token als nog geldig
  if (cachedToken && Date.now() < tokenExpiry - 60000) {
    return cachedToken
  }

  const refreshToken = process.env.DROPBOX_REFRESH_TOKEN
  const appKey = process.env.DROPBOX_APP_KEY!
  const appSecret = process.env.DROPBOX_APP_SECRET!

  // Fallback naar static token als geen refresh token
  if (!refreshToken) {
    return process.env.DROPBOX_ACCESS_TOKEN!
  }

  // Vernieuw access token via refresh token
  const res = await fetch("https://api.dropboxapi.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: appKey,
      client_secret: appSecret
    })
  })

  if (!res.ok) throw new Error("Dropbox token refresh mislukt")

  const data = await res.json()
  cachedToken = data.access_token
  tokenExpiry = Date.now() + (data.expires_in * 1000)

  return cachedToken!
}
