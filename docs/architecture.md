# CodeSync — Architectuur

## Systeem overzicht

```
Claude (ZIP output)
        ↓
CodeSync (web app — Next.js 15 / Vercel)
        ↓
  lib/github.ts      → GitHub API service
  lib/snapshot.ts    → Snapshot engine + cache
  lib/diff.ts        → Diff engine
  lib/projects.ts    → Project registry
        ↓
GitHub (source of truth)
```

---

## Lagen

### 1. Storage layer
- GitHub repositories
- Alle projecten zijn GitHub-backed
- Geen CodeSync database

### 2. State layer
- Snapshots — huidige staat van een project
- Diff engine — vergelijkt ZIP vs GitHub
- In-memory cache — fallback bij GitHub uitval

### 3. Intelligence layer
- ZIP extractie
- Diff berekening
- Selectieve import
- AI context export

---

## Data modellen

```typescript
type ProjectStatus = "active" | "experimental" | "archive"

type Project = {
  slug: string
  name: string
  githubRepo: string
  branch: string
  status: ProjectStatus
}

type ProjectFile = {
  path: string
  content: string
  sha?: string
}

type Snapshot = {
  projectSlug: string
  source: "github" | "zip" | "cache"
  files: ProjectFile[]
  createdAt: string
  isStale?: boolean
}

type DiffResult = {
  newFiles: string[]
  modifiedFiles: string[]
  deletedFiles: string[]
  unchanged: string[]
}
```

---

## GitHub integratie

### Auth
- Personal Access Token (PAT)
- Server-side only — nooit naar client
- Scope: `repo`

### Snapshot ophalen
```
GET /repos/{repo}/contents/{dir}?ref={branch}
→ recursief per map
→ bestanden > 500KB overgeslagen
→ binaire bestanden overgeslagen
```

### Batch commit
```
1. GET /repos/{repo}/git/refs/heads/{branch}  → latestSha
2. GET /repos/{repo}/git/commits/{sha}         → baseTreeSha
3. POST /repos/{repo}/git/trees               → newTreeSha
4. POST /repos/{repo}/git/commits             → newCommitSha
5. PATCH /repos/{repo}/git/refs/heads/{branch} → update ref
```

---

## Diff engine

- Vergelijkt ZIP bestanden vs GitHub snapshot
- Whitespace normalisatie (CRLF → LF)
- Geen AST analyse (V1 bewuste keuze)
- Twee modi:
  - **Online** — ZIP vs GitHub (authoritative)
  - **Offline** — ZIP vs cache (stale, geflagd)

---

## Snapshot cache

- In-memory (`Map<string, Snapshot>`)
- Wordt gevuld bij elke succesvolle GitHub fetch
- Fallback bij GitHub uitval
- Reset bij Vercel redeploy

---

## Project registry

- Statische config in `lib/projects.ts`
- Geen database
- Status per project: active / experimental / archive
- CodeSync beheert zichzelf (`stuctech-eng/codesync`)

---

## iPhone-first principes

- Touch targets ≥ 44px
- Safe-area ondersteuning
- Sticky headers
- Lazy loading file trees
- Geen desktop-only features
- PWA-compatibel

---

## Beperkingen V1

- In-memory cache reset bij redeploy
- Geen bestandsverwijdering via GitHub tree API
- Geen rename detectie in diff engine
- Geen commit history UI
