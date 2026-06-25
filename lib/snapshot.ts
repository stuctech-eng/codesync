import { getStructure, getSnapshot, getFileContents } from "@/lib/github"
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

// Volledige snapshot met content — voor diff engine
export async function getGitHubSnapshotWithContent(project: Project): Promise<Snapshot> {
  try {
    const files = await getSnapshot(project.githubRepo, project.branch)

    const snapshot: Snapshot = {
      projectSlug: project.slug,
      source: "github",
      files,
      createdAt: new Date().toISOString()
    }

    return snapshot

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
