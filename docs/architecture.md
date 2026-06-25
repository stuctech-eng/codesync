# CodeSync — Architectuur

## Systeem overzicht

```
Claude (ZIP output)
        ↓
CodeSync (web app — Next.js 15.3.6 / Vercel)
        ↓
  lib/github.ts         → GitHub API service
  lib/snapshot.ts       → Snapshot engine + cache
  lib/diff.ts           → Diff engine
  lib/projects.ts       → Project registry
  lib/push.ts           → Push notificaties
  lib/firebase-admin.ts → Firebase Admin SDK
        ↓
GitHub (source of truth)
Firebase Firestore (push subscription opslag)
```

---

## Lagen

### 1. Storage layer
- GitHub repositories — project state
- Firebase Firestore — push subscription

### 2. State layer
- Snapshots — huidige staat van een project
- Diff engine — vergelijkt ZIP vs GitHub
- In-memory cache — fallback bij GitHub uitval

### 3. Intelligence layer
- ZIP extractie
- Diff berekening
- Selectieve import
- AI context export
- Bestandsverwijdering

### 4. Notification layer
- Web Push via VAPID keys
- Service Worker voor push ontvangst
- Firebase Firestore voor persistente subscription

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
  stack?: string[]
  keyFiles?: { path: string; description: string }[]
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
→ bestanden zonder content (>1MB) overgeslagen
```

### Batch commit
```
1. GET /repos/{repo}/git/refs/heads/{branch}  → latestSha
2. GET /repos/{repo}/git/commits/{sha}         → baseTreeSha
3. POST /repos/{repo}/git/trees               → newTreeSha
4. POST /repos/{repo}/git/commits             → newCommitSha
5. PATCH /repos/{repo}/git/refs/heads/{branch} → update ref
```

### Bestandsverwijdering
```
Per bestand:
1. GET /repos/{repo}/contents/{path} → sha
2. DELETE /repos/{repo}/contents/{path} → verwijder
```

---

## Push notificaties

### Flow
```
1. Import pagina open → service worker registratie
2. Subscription aangemaakt met VAPID public key
3. Subscription opgeslagen in Firebase Firestore
4. Na push → Vercel pollt deployment status
5. Bij READY/ERROR → sendPushNotification via web-push
6. Service Worker ontvangt push → toont notificatie
```

### Environment variables
```
VAPID_PUBLIC_KEY    — browser subscription key
VAPID_PRIVATE_KEY   — server signing key
VAPID_SUBJECT       — mailto:stuctech@gmail.com
FIREBASE_SERVICE_ACCOUNT — JSON service account
```

---

## Deployment polling

```
Push naar GitHub
   ↓
Vercel start build (5-10 sec vertraging)
   ↓
CodeSync wacht 15 seconden
   ↓
Poll /api/deployment elke 3 seconden
   ↓
Filter op deployments na push timestamp
   ↓
Bij READY → ✅ in UI + push notificatie
Bij ERROR → ❌ in UI + push notificatie
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

## ZIP pad vereiste

Paden in de ZIP moeten overeenkomen met de repo root — geen prefix.

✅ Correct: `app/page.tsx`, `lib/github.ts`
❌ Fout: `codesync/app/page.tsx` → wordt als submap aangemaakt

### ZIP naam = commit message
```
ui-update.zip → "ui update — v1.0.104 — 25 jun 2026 14:22"
```

---

## Beperkingen

- In-memory snapshot cache reset bij redeploy
- Geen rename detectie in diff engine
- Geen commit history UI
- Push subscription verliest oude subscriptions bij VAPID key rotatie
