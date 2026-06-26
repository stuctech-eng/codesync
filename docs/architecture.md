# CodeSync — Architectuur

## Systeem overzicht

```
Claude (ZIP output)
        ↓
CodeSync (PWA — Next.js 15.3.6 / Vercel)
        ↓
  lib/github.ts         → GitHub API service
  lib/snapshot.ts       → Snapshot engine (structuur)
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
- GitHub repositories — project state en bestanden
- Firebase Firestore — push subscription

### 2. State layer
- Snapshot (structuur) — bestandspaden zonder content, snel
- Diff engine — vergelijkt ZIP vs GitHub met content
- In-memory cache — fallback bij GitHub uitval

### 3. Intelligence layer
- ZIP extractie en parsing
- Diff berekening (nieuw / gewijzigd / verwijderd)
- Content diff (oud vs nieuw per bestand)
- Selectieve import per bestand
- AI context export (structuur + geselecteerde inhoud)
- Bestandsverwijdering via Contents API

### 4. Notification layer
- Web Push via VAPID keys
- Service Worker (`public/sw.js`) voor push ontvangst
- Firebase Firestore voor persistente subscription opslag
- Vercel deployment polling

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
  content: string   // leeg bij structuur-only snapshot
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

## Snapshot strategie

### Structuur-only (snel)
- Gebruikt voor: file tree weergave, kopieer naar Claude overzicht
- Haalt alleen paden op — geen file content
- `getStructure()` in `lib/github.ts`

### Volledige snapshot (met content)
- Gebruikt voor: diff engine
- Haalt content op per bestand via GitHub contents API
- `getSnapshot()` in `lib/github.ts`

### Bestandsinhoud on-demand
- Gebruikt voor: kopieer naar Claude (geselecteerde bestanden)
- `getFileContents()` in `lib/github.ts`
- `POST /api/contents` met lijst van paden

---

## GitHub integratie

### Auth
- Personal Access Token (PAT)
- Server-side only — nooit naar client
- Scope: `repo`

### Structuur ophalen
```
GET /repos/{repo}/contents/{dir}?ref={branch}
→ recursief per map
→ binaire bestanden overgeslagen
→ content NIET geladen (structuur-only)
```

### Volledige snapshot
```
GET /repos/{repo}/contents/{dir}?ref={branch}
→ bestanden > 500KB overgeslagen
→ content geladen via item.url
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
2. DELETE /repos/{repo}/contents/{path} + sha → verwijder
```

### Commit history
```
GET /repos/{repo}/commits?sha={branch}&per_page=20
→ laatste 20 commits
→ sha, message, date, author
```

---

## Push notificaties

### Setup
- VAPID keys gegenereerd via `web-push` library
- Subscription aangemaakt in browser met VAPID public key
- Subscription opgeslagen in Firestore bij elke import pagina open

### Flow
```
1. Open ZIP import pagina
   → service worker registratie (/public/sw.js)
   → bestaande subscription verwijderd (voorkomt key mismatch)
   → nieuwe subscription aangemaakt
   → POST /api/push/subscribe → opgeslagen in Firestore

2. Na push naar GitHub
   → /api/deployment pollt Vercel API (eerste poll na 15 sec)
   → filter op deployments na push timestamp
   → bij READY → sendPushNotification() via web-push
   → bij ERROR → sendPushNotification() via web-push

3. Service Worker ontvangt push
   → toont notificatie met titel en body
   → tik → opent Vercel app
```

### Environment variables
```
VAPID_PUBLIC_KEY    — browser subscription key (65 bytes, URL-safe base64)
VAPID_PRIVATE_KEY   — server signing key
VAPID_SUBJECT       — mailto:stuctech@gmail.com
FIREBASE_SERVICE_ACCOUNT — JSON service account als string
```

---

## Deployment polling

```
Push naar GitHub (commitSha terug)
   ↓
useEffect detecteert step === "done"
   ↓
pollDeployment(sha) gestart
   ↓
Wacht 15 seconden (Vercel build start vertraging)
   ↓
GET /api/deployment?sha={sha}&after={timestamp}
   ↓
Filter: deployments aangemaakt na push timestamp
   ↓
State check elke 3 seconden:
  - NONE → nog geen nieuwe deployment → wacht
  - BUILDING/QUEUED → balk loopt → wacht
  - READY → ✅ + push notificatie
  - ERROR → ❌ + push notificatie
```

---

## Diff engine

- Vergelijkt ZIP bestanden vs volledige GitHub snapshot
- Whitespace normalisatie (CRLF → LF)
- Geen AST analyse (bewuste V1 keuze)
- Geen rename detectie (V3 backlog)
- Twee modi:
  - **Online** — ZIP vs GitHub (authoritative)
  - **Offline** — ZIP vs cache (stale, geflagd in UI)

### Content diff (per gewijzigd bestand)
- Simpele line-by-line vergelijking
- Groen `+` = toegevoegd, rood `-` = verwijderd
- Max 200 regels getoond
- Oude content: opgehaald via `/api/contents`
- Nieuwe content: uit ZIP extract

---

## Project registry

- Statische config in `lib/projects.ts`
- Geen database
- Per project: slug, naam, githubRepo, branch, status, stack, keyFiles
- CodeSync beheert zichzelf (`stuctech-eng/codesync`)

---

## iPhone-first principes

- Touch targets ≥ 44px
- Safe-area ondersteuning (`env(safe-area-inset-*)`)
- Sticky headers en sticky actie knoppen
- Lazy loading file trees
- PWA-compatibel (installeerbaar via Safari)
- Push notificaties via Web Push API

---

## ZIP pad vereiste

Paden in de ZIP moeten overeenkomen met de repo root — geen prefix.

✅ `app/page.tsx`, `lib/github.ts`, `docs/README.md`
❌ `projectnaam/app/page.tsx` → wordt als submap aangemaakt in repo

### ZIP naam = commit message
```
ui-update.zip → "ui update — v1.0.104 — 25 jun 2026 14:22"
```

---

## Beperkingen

- In-memory snapshot cache reset bij Vercel redeploy
- Geen rename detectie in diff engine
- Push subscription verliest verbinding bij VAPID key rotatie (herstel: Firestore document verwijderen + import pagina openen)
- Commit count voor versienummer kan vertragen bij grote repos (GitHub Link header parsing)
