# CodeSync — Architectuur

## Systeem overzicht

```
Claude (ZIP output)
        ↓
CodeSync (PWA — Next.js 15.3.6 / Vercel)
        ↓
  lib/github.ts         → GitHub API (snapshot, commit, delete, tags, restore)
  lib/snapshot.ts       → Snapshot engine (structuur-only + volledige)
  lib/diff.ts           → Diff engine (ZIP vs GitHub)
  lib/projects.ts       → Project registry
  lib/push.ts           → Push notificaties (web-push + Firestore)
  lib/firebase-admin.ts → Firebase Admin SDK
        ↓
GitHub (source of truth)
Firebase Firestore (push subscription + notificatie deduplicatie)
Vercel (deployment + hosting)
```

---

## Snapshot strategie

### Structuur-only (standaard)
- Gebruikt voor: file tree, kopieer overzicht, delete modus
- Haalt alleen paden op — geen content
- `getStructure()` in `lib/github.ts`
- Snel ook voor grote repos (224+ bestanden)

### Volledige snapshot (met content)
- Gebruikt voor: diff engine bij ZIP import
- `getSnapshot()` in `lib/github.ts`
- Bestanden >500KB en binaire bestanden overgeslagen

### Content on-demand
- Gebruikt voor: kopieer naar Claude (geselecteerde bestanden)
- `getFileContents()` in `lib/github.ts`
- `POST /api/contents` met lijst van paden

---

## ZIP Import Flow

```
Claude ZIP (codesync-fix.zip)
   ↓
Projectnaam check — ZIP naam vs project slug → waarschuwing indien mismatch
   ↓
/api/import → extractie (macOS metadata gefilterd)
   ↓
/api/diff → volledige snapshot van GitHub + diff berekening
   ↓
Review — content diff per gewijzigd bestand
       → checkbox selectie
       → sticky Push knop
   ↓
/api/sync → batch commit (GitHub tree API) + bestandsverwijdering
   ↓
Deployment polling (15 sec delay, after timestamp filter)
   ↓
Push notificatie via Firebase → iPhone
```

---

## GitHub API calls

### Batch commit
```
1. GET /repos/{repo}/git/refs/heads/{branch}  → latestSha
2. GET /repos/{repo}/git/commits/{sha}         → baseTreeSha
3. POST /repos/{repo}/git/trees               → newTreeSha
4. POST /repos/{repo}/git/commits             → newCommitSha
5. PATCH /repos/{repo}/git/refs/heads/{branch} → update ref
```

### Tag herstel
```
1. GET /repos/{repo}/git/refs/tags/{tag}      → tagSha
2. GET /repos/{repo}/git/tags/{sha}           → commitSha (annotated tags)
3. GET /repos/{repo}/git/commits/{sha}        → treeSha
4. GET /repos/{repo}/git/refs/heads/{branch}  → latestSha
5. POST /repos/{repo}/git/commits             → newCommit (met tag tree + latest parent)
6. PATCH /repos/{repo}/git/refs/heads/{branch} → update ref
```

### Bestandsverwijdering
```
Per bestand:
1. GET /repos/{repo}/contents/{path}   → sha
2. DELETE /repos/{repo}/contents/{path} → verwijder
```

---

## Push notificaties

### Subscription flow
```
Import pagina open
   ↓
Service worker registratie (/public/sw.js)
   ↓
Bestaande subscription verwijderen (voorkomt VAPID key mismatch)
   ↓
Nieuwe subscription aanmaken met VAPID public key
   ↓
POST /api/push/subscribe → opslaan in Firestore
```

### Deployment notificatie flow
```
Push naar GitHub
   ↓
pollDeployment(sha) start (na 15 sec)
   ↓
GET /api/deployment?project={slug}&sha={sha}&after={timestamp}
   ↓
Filter: deployments na push timestamp
   ↓
State READY/ERROR → check Firestore of al genotificeerd
   ↓
Zo niet → markNotified in Firestore → sendPushNotification
   ↓
Service Worker toont notificatie op iPhone
```

### Firestore collectie: codesync
- `push-subscription` — Web Push subscription object
- `notified-{deploymentId}` — deduplicatie per deployment

---

## Beveiliging

### Projectnaam check
- ZIP naam wordt vergeleken met project slug
- Mismatch → oranje waarschuwing in review scherm
- Gebruiker kan nog steeds doorgaan

### Verwijder bevestiging
- Stap 1: "Ja, verwijder" 
- Stap 2: "Definitief verwijderen"
- Twee aparte tikken vereist

### Tag herstel bevestiging
- Stap 1: "Herstel naar deze versie"
- Stap 2: "✓ Herstel naar {tag}"
- Maakt nieuwe commit — geen force push

---

## Diff engine

- Vergelijkt ZIP vs volledige GitHub snapshot
- Whitespace normalisatie (CRLF → LF)
- Geen AST analyse (bewuste keuze)
- Geen rename detectie (V3)

### Content diff
- Line-by-line vergelijking
- Groen `+` toegevoegd, rood `-` verwijderd
- Oude content: GitHub via `/api/contents`
- Nieuwe content: uit ZIP extract
- Max 200 regels getoond

---

## Versienaming

```
ZIP naam:     codesync-fix.zip
Commit count: 139
Datum:        26 jun 2026 20:20

Commit message: codesync fix — v1.0.139 — 26 jun 2026, 20:20
```

---

## Beperkingen

- In-memory snapshot cache reset bij Vercel redeploy
- Geen rename detectie in diff engine
- Push subscription verliest verbinding bij VAPID key rotatie
- Notificaties werken alleen als CodeSync als PWA is geïnstalleerd
- Bestanden >500KB worden overgeslagen in snapshot
