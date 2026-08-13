import { NextRequest, NextResponse } from "next/server"

// Basis auth-header op alle API-routes (Master Plan v1.1, sectie 4).
// Fail-closed: als CODESYNC_ACCESS_KEY niet is geconfigureerd, wordt
// toegang geweigerd i.p.v. stilzwijgend toegestaan.
export function requireAuth(req: NextRequest): NextResponse | null {
  const expected = process.env.CODESYNC_ACCESS_KEY

  if (!expected) {
    return NextResponse.json(
      { error: "Server misconfigured: CODESYNC_ACCESS_KEY is not set" },
      { status: 500 }
    )
  }

  const provided = req.headers.get("x-codesync-key")

  if (!provided || provided !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  return null
}
