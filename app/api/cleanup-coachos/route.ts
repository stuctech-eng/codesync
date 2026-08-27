import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { PROJECTS } from "@/lib/projects"
import { getBranchHeadSha } from "@/lib/github"
import { createChangeset } from "@/lib/changesets"

// EENMALIGE opruimroute (niet permanent onderdeel van de architectuur):
// verwijdert de per ongeluk in de CoachOS-repo beland map
// coachos-connect-ios/ (27 bestanden, veroorzaakt door de prefix-
// matching-bug in de Dropbox ZIP-routing, inmiddels apart gefixt).
// Gesplitst in 2 changesets vanwege de bestaande MAX_CHANGESET_FILES=15
// veiligheidslimiet. Maakt GEEN directe wijziging -- alleen voorstellen,
// net als altijd, jij keurt ze apart goed via het bestaande review-scherm.
const BATCH_1 = [
  "coachos-connect-ios/App/CoachOSConnectApp.swift",
  "coachos-connect-ios/App/Info-template.plist",
  "coachos-connect-ios/App/RootView.swift",
  "coachos-connect-ios/Package.swift",
  "coachos-connect-ios/README.md",
  "coachos-connect-ios/Sources/CoachOSConnectCore/Errors/CoachOSConnectError.swift",
  "coachos-connect-ios/Sources/CoachOSConnectCore/Models/DeviceCapability.swift",
  "coachos-connect-ios/Sources/CoachOSConnectCore/Models/DeviceState.swift",
  "coachos-connect-ios/Sources/CoachOSConnectCore/Models/LiveMetrics.swift",
  "coachos-connect-ios/Sources/CoachOSConnectCore/Models/UniversalWorkout.swift",
  "coachos-connect-ios/Sources/CoachOSConnectCore/Protocols/DeviceAdapterProtocol.swift",
  "coachos-connect-ios/Sources/CoachOSConnectCore/Protocols/RepositoryProtocols.swift",
  "coachos-connect-ios/Sources/CoachOSConnectCore/UseCases/UseCases.swift",
  "coachos-connect-ios/Sources/CoachOSConnectDI/AppAssembly.swift",
  "coachos-connect-ios/Sources/CoachOSConnectDI/DIContainer.swift"
]

const BATCH_2 = [
  "coachos-connect-ios/Sources/CoachOSConnectData/Network/APIClient.swift",
  "coachos-connect-ios/Sources/CoachOSConnectData/Network/APIEndpoint.swift",
  "coachos-connect-ios/Sources/CoachOSConnectData/Persistence/LocalStorage.swift",
  "coachos-connect-ios/Sources/CoachOSConnectData/Persistence/WorkoutCache.swift",
  "coachos-connect-ios/Sources/CoachOSConnectData/Repositories/DeviceRepository.swift",
  "coachos-connect-ios/Sources/CoachOSConnectData/Repositories/RemoteWorkoutRepository.swift",
  "coachos-connect-ios/Sources/CoachOSConnectData/Repositories/SyncAndAuthRepositories.swift",
  "coachos-connect-ios/Sources/CoachOSConnectDeviceLayer/Adapters/README.md",
  "coachos-connect-ios/Sources/CoachOSConnectDeviceLayer/DeviceAdapterRegistry.swift",
  "coachos-connect-ios/Sources/CoachOSConnectDeviceLayer/DeviceLayer.swift",
  "coachos-connect-ios/Tests/CoachOSConnectCoreTests/UniversalWorkoutTests.swift",
  "coachos-connect-ios/docs/changelog.md"
]

export async function POST(req: NextRequest) {
  const authError = requireAuth(req)
  if (authError) return authError

  let body: { batch?: number }
  try {
    body = await req.json()
  } catch {
    body = {}
  }
  const batch = body.batch === 2 ? 2 : 1

  const project = PROJECTS.find(p => p.slug === "coachos")
  if (!project) {
    return NextResponse.json({ error: "coachos-project niet gevonden" }, { status: 404 })
  }

  // Verse HEAD-check bij ELKE aanroep -- belangrijk: batch 2 moet pas
  // opgevraagd worden NADAT batch 1 is goedgekeurd, anders is de
  // baseCommitSha van batch 2 al verouderd tegen de tijd dat je 'm
  // goedkeurt (concurrency-bescherming zou 'm dan terecht als "stale"
  // weigeren).
  const baseCommitSha = await getBranchHeadSha(project.githubRepo, project.branch)

  const files = batch === 1 ? BATCH_1 : BATCH_2
  const changeset = await createChangeset({
    projectSlug: "coachos",
    files: files.map(path => ({ path, action: "delete" as const })),
    explanation: `Opruiming (${batch}/2): verwijdert (een deel van) de per ongeluk in CoachOS beland map coachos-connect-ios/ (hoort in de losse coachos-connect-ios-repo, niet hier).`,
    baseCommitSha
  })

  return NextResponse.json({ changesetId: changeset.id, batch })
}
