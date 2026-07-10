import { getStructure, getTreeWithShas, getFileContents } from "@/lib/github"
import type { Snapshot, Project, ProjectFile } from "@/types"

// In-memory cache (V1 — stateless server resets on redeploy)
const snapshotCache = new Map<string, Snapshot>()

// Structuur only — snel, geen file content
export async function getGitHubSnapshot(project: Project): Promise<Snapshot> {
  try {
    const files = await getStructure(project.githubRepo, project.branch)

    const snapshot: Snapshot = {
      projectSlug: project.slug,
      source: "github",
      files,
      createdAt: new Date().toISOString()
    }

    snapshotCache.set(project.slug, snapshot)
    return snapshot

  } catch (error) {
    const cached = snapshotCache.get(project.slug)

    if (cached) {
      return { ...cached, source: "cache", isStale: true }
    }

    throw new Error(
      `GitHub unreachable and no cache for "${project.slug}": ${String(error)}`
    )
  }
}

// Boomstructuur met git blob SHA's — voor de diff engine.
// Vervangt de oude getGitHubSnapshotWithContent: haalt geen bestandsinhoud
// meer op (1 API-call i.p.v. honderden), de diff engine vergelijkt lokaal
// berekende SHA's van de ZIP-bestanden tegen deze GitHub SHA's.
export async function getGitHubTree(project: Project): Promise<{ path: string; sha: string }[]> {
  try {
    return await getTreeWithShas(project.githubRepo, project.branch)
  } catch (error) {
    throw new Error(
      `GitHub unreachable for "${project.slug}": ${String(error)}`
    )
  }
}

// Haal inhoud op van specifieke bestanden voor Claude context
export async function getFileContentsForProject(
  project: Project,
  paths: string[]
): Promise<ProjectFile[]> {
  return getFileContents(project.githubRepo, project.branch, paths)
}

export function buildZipSnapshot(
  projectSlug: string,
  files: ProjectFile[]
): Snapshot {
  return {
    projectSlug,
    source: "zip",
    files,
    createdAt: new Date().toISOString()
  }
}

export function getCachedSnapshot(projectSlug: string): Snapshot | null {
  return snapshotCache.get(projectSlug) ?? null
}
