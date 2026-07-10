import { createHash } from "crypto"
import type { ProjectFile, DiffResult } from "@/types"

// Berekent de git blob SHA-1 van een bestand — exact dezelfde hash die
// GitHub zelf gebruikt om bestandsinhoud te identificeren. Hiermee kunnen
// we lokaal (uit de ZIP) bepalen of een bestand is gewijzigd, zonder de
// inhoud van GitHub te hoeven downloaden.
export function computeGitBlobSha(content: string): string {
  const buffer = Buffer.from(content, "utf-8")
  const header = `blob ${buffer.length}\0`
  const hash = createHash("sha1")
  hash.update(header)
  hash.update(buffer)
  return hash.digest("hex")
}

export function calculateDiff(
  githubTree: { path: string; sha: string }[],
  zipFiles: ProjectFile[]
): DiffResult {
  const githubMap = new Map(githubTree.map(f => [f.path, f.sha]))

  const newFiles: string[] = []
  const modifiedFiles: string[] = []
  const deletedFiles: string[] = []
  const unchanged: string[] = []

  const zipPaths = new Set<string>()

  for (const file of zipFiles) {
    zipPaths.add(file.path)
    const githubSha = githubMap.get(file.path)

    if (githubSha === undefined) {
      newFiles.push(file.path)
    } else {
      const localSha = computeGitBlobSha(file.content)
      if (githubSha !== localSha) {
        modifiedFiles.push(file.path)
      } else {
        unchanged.push(file.path)
      }
    }
  }

  for (const path of githubMap.keys()) {
    if (!zipPaths.has(path)) {
      deletedFiles.push(path)
    }
  }

  return { newFiles, modifiedFiles, deletedFiles, unchanged }
}
