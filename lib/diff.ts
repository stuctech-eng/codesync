import type { ProjectFile, DiffResult } from "@/types"

export function calculateDiff(
  githubFiles: ProjectFile[],
  zipFiles: ProjectFile[]
): DiffResult {
  const githubMap = new Map(
    githubFiles.map(f => [f.path, normalize(f.content)])
  )
  const zipMap = new Map(
    zipFiles.map(f => [f.path, normalize(f.content)])
  )

  const newFiles: string[] = []
  const modifiedFiles: string[] = []
  const deletedFiles: string[] = []
  const unchanged: string[] = []

  for (const [path, content] of zipMap) {
    if (!githubMap.has(path)) {
      newFiles.push(path)
    } else if (githubMap.get(path) !== content) {
      modifiedFiles.push(path)
    } else {
      unchanged.push(path)
    }
  }

  for (const path of githubMap.keys()) {
    if (!zipMap.has(path)) {
      deletedFiles.push(path)
    }
  }

  return { newFiles, modifiedFiles, deletedFiles, unchanged }
}

// V1: whitespace normalization only (no AST, no rename detection)
function normalize(content: string): string {
  return content
    .replace(/\r\n/g, "\n")
    .trimEnd()
}
