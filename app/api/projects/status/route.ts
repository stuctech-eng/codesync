import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/firebase-admin"

const VALID_STATUSES = ["active", "experimental", "archive"]

// Haal alle handmatige status-overrides op (bijv. na het slepen van een kaart)
export async function GET() {
  try {
    const db = getDb()
    const snapshot = await db.collection("project-status-overrides").get()
    const overrides: Record<string, string> = {}
    snapshot.forEach(doc => {
      const data = doc.data()
      if (data?.status) overrides[doc.id] = data.status
    })
    return NextResponse.json({ overrides })
  } catch (error) {
    // Stil falen — zonder overrides valt de UI terug op de standaard status uit lib/projects.ts
    return NextResponse.json({ overrides: {} })
  }
}

// Sla een nieuwe status op voor een project (na het slepen naar een andere sectie)
export async function POST(req: NextRequest) {
  try {
    const { slug, status } = await req.json()

    if (!slug || !status) {
      return NextResponse.json({ error: "slug and status are required" }, { status: 400 })
    }
    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: `status must be one of: ${VALID_STATUSES.join(", ")}` }, { status: 400 })
    }

    const db = getDb()
    await db.collection("project-status-overrides").doc(slug).set({
      status,
      updatedAt: new Date().toISOString()
    })

    return NextResponse.json({ success: true, slug, status })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
