export type ProjectFile = {
  path: string
  content: string
  sha?: string
  isBinary?: boolean
}

export type Snapshot = {
  projectSlug: string
  source: "github" | "zip" | "cache"
  files: ProjectFile[]
  createdAt: string
  isStale?: boolean
}

export type DiffResult = {
  newFiles: string[]
  modifiedFiles: string[]
  deletedFiles: string[]
  unchanged: string[]
}

export type ProjectStatus = "active" | "experimental" | "archive"

export type Project = {
  slug: string
  name: string
  githubRepo: string
  branch: string
  status: ProjectStatus
  stack?: string[]
  keyFiles?: { path: string; description: string }[]
  vercelProject?: string
}
