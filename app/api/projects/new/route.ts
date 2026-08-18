import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { PROJECTS } from "@/lib/projects"
import { getFileContentsForProject } from "@/lib/snapshot"
import { getBranchHeadSha } from "@/lib/github"
import { createChangeset } from "@/lib/changesets"

// POST /api/projects/new — voegt een nieuw project toe aan lib/projects.ts
// via het bestaande changeset-mechanisme (geen nieuwe opslaglaag, geen
// Claude/Anthropic-aanroep nodig — puur deterministische tekstmanipulatie).
//
// Belangrijk: dit endpoint COMMIT NIETS zelf. Het maakt alleen een
// changeset-voorstel aan (status "proposed"), exact zoals wanneer Claude
// prepare_changeset zou aanroepen. De gebruiker keurt het daarna goed
// via het bestaande review-scherm — zelfde beveiligingsgrens als altijd.

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/

export async function POST(req: NextRequest) {
  const authError = requireAuth(req)
  if (authError) return authError

  let body: {
    slug?: string
    name?: string
    githubRepo?: string
    branch?: string
    status?: string
    stack?: string
    vercelProject?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const slug = body.slug?.trim().toLowerCase() ?? ""
  const name = body.name?.trim() ?? ""
  const githubRepo = body.githubRepo?.trim() ?? ""
  const branch = body.branch?.trim() || "main"
  const status = body.status?.trim() || "active"
  const vercelProject = body.vercelProject?.trim()
  const stackArray = body.stack
    ? body.stack.split(",").map(s => s.trim()).filter(Boolean)
    : []

  // Validatie
  if (!slug || !SLUG_PATTERN.test(slug)) {
    return NextResponse.json(
      { error: "Ongeldige slug — alleen kleine letters, cijfers en koppeltekens, geen spaties" },
      { status: 400 }
    )
  }
  if (!name) return NextResponse.json({ error: "name is verplicht" }, { status: 400 })
  if (!githubRepo || !githubRepo.includes("/")) {
    return NextResponse.json({ error: "githubRepo moet het formaat 'eigenaar/repo' hebben" }, { status: 400 })
  }
  if (!["active", "experimental", "archive"].includes(status)) {
    return NextResponse.json({ error: "status moet active, experimental of archive zijn" }, { status: 400 })
  }
  if (PROJECTS.some(p => p.slug === slug)) {
    return NextResponse.json({ error: `Een project met slug "${slug}" bestaat al` }, { status: 409 })
  }

  // Bestaande CodeSync-project-infrastructuur hergebruikt om zijn eigen
  // lib/projects.ts op te halen — CodeSync staat zelf ook in PROJECTS.
  const codesyncProject = PROJECTS.find(p => p.slug === "codesync")
  if (!codesyncProject) {
    return NextResponse.json({ error: "Kon het codesync-project zelf niet vinden" }, { status: 500 })
  }

  const files = await getFileContentsForProject(codesyncProject, ["lib/projects.ts"])
  const currentFile = files.find(f => f.path === "lib/projects.ts")
  if (!currentFile) {
    return NextResponse.json({ error: "Kon lib/projects.ts niet ophalen" }, { status: 500 })
  }

  // Nieuw project-object als TypeScript-tekst opbouwen. JSON.stringify
  // voor elke string-waarde -- garandeert geldige, correct-escapete
  // TS-string-literals, ongeacht speciale tekens in de invoer.
  const lines: string[] = []
  lines.push(`  {`)
  lines.push(`    slug: ${JSON.stringify(slug)},`)
  if (vercelProject) lines.push(`    vercelProject: ${JSON.stringify(vercelProject)},`)
  lines.push(`    name: ${JSON.stringify(name)},`)
  lines.push(`    githubRepo: ${JSON.stringify(githubRepo)},`)
  lines.push(`    branch: ${JSON.stringify(branch)},`)
  lines.push(`    status: ${JSON.stringify(status)}`)
  if (stackArray.length > 0) {
    lines[lines.length - 1] += ","
    lines.push(`    stack: [${stackArray.map(s => JSON.stringify(s)).join(", ")}]`)
  }
  lines.push(`  }`)
  const newEntryText = lines.join("\n")

  // Invoegen vlak vóór de sluitende "]" van de PROJECTS-array. We zoeken
  // de LAATSTE "\n]" in het bestand -- bij lib/projects.ts is dat
  // betrouwbaar de afsluiting van de array (geen andere top-level array
  // in dit bestand).
  const closingIndex = currentFile.content.lastIndexOf("\n]")
  if (closingIndex === -1) {
    return NextResponse.json({ error: "Kon de PROJECTS-array niet vinden in lib/projects.ts" }, { status: 500 })
  }

  const newContent =
    currentFile.content.slice(0, closingIndex) +
    ",\n" + newEntryText +
    currentFile.content.slice(closingIndex)

  const baseCommitSha = await getBranchHeadSha(codesyncProject.githubRepo, codesyncProject.branch)

  const changeset = await createChangeset({
    projectSlug: "codesync",
    files: [{ path: "lib/projects.ts", action: "modify", content: newContent }],
    explanation: `Nieuw project "${name}" (${slug}) toegevoegd aan de projectenlijst.`,
    baseCommitSha
  })

  return NextResponse.json({ changesetId: changeset.id })
}
