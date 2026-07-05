# CodeSync

AI-backed Git state engine voor iPhone development workflows.

**Live:** https://codesync-three-gamma.vercel.app
**Repo:** stuctech-eng/codesync

---

## Wat is CodeSync

CodeSync is een PWA die ZIP-bestanden van Claude omzet in gestructureerde GitHub commits. Het is geen code editor — het is een **project state + AI context + Git sync layer** voor iPhone-first development.

---

## Werkwijze

### Standaard workflow via Dropbox

```
1. Claude geeft ZIP (bijv. codesync-feature.zip)
2. Sla ZIP op in Dropbox → CodeSyncApp/
3. Open CodeSync → tik 📥 Importeer nieuwe ZIPs
4. CodeSync herkent project automatisch op ZIP naam
5. Tik Verwerk → diff → selecteer → Push
6. Wacht op deployment notificatie
7. ZIP automatisch verwijderd uit Dropbox
```

### ZIP Naamregel

```
fix / hotfix / patch  → kleine correctie (geen auto-tag)
update / feature / refactor → grote wijziging (auto-tag)
docs / config → documentatie (geen auto-tag)

Correct:   codesync-fix.zip → app/page.tsx
Fout:      update.zip → codesync/app/page.tsx
```

---

## Stack

| Laag | Technologie |
|------|-------------|
| Frontend | Next.js 15.3.6, TypeScript |
| Backend | Next.js API Routes (serverless) |
| Auth | GitHub PAT (server-side only) |
| Storage | GitHub Repositories |
| Queue | Dropbox API (OAuth2 refresh token) |
| Push | Firebase Firestore + Web Push |
| Deploy | Vercel |

---

## Features

### Overzichtspagina
- 📥 Importeer nieuwe ZIPs — Dropbox wachtrij per project
- Fix ZIPs krijgen prioriteit binnen dezelfde repo
- ACTIVE / EXPERIMENTAL / ARCHIVE — inklapbaar
- Verbindingsstatus + bestandsaantal per project
- ZIP knop direct naar import pagina
- Dag/nacht toggle (persistent)

### Project detail pagina
- File tree — alle bestanden inclusief binaire (PNG 🖼 read-only)
- Commit history — relatieve datums
- Herstelpunten — inklapbaar, aanmaken + herstellen
- Bestandsverwijdering — zoekbalk + tags + sticky + dubbele bevestiging
- Kopieer naar Claude — zoekbalk + lege selectie + sticky

### ZIP Import
- Dropbox auto-load via wachtrij
- Diff engine: ZIP vs GitHub
- Content diff per gewijzigd bestand
- Projectnaam beveiliging
- Intelligente auto-tagging (max 10 tags)
- Na push → ZIP verwijderd uit Dropbox
- Bij geen wijzigingen → ZIP ook verwijderd
- "Bekijk deployment →" gaat naar juiste Vercel project

### Deployment
- Polling na push (30 sec delay)
- SHA-based deployment matching
- Push notificatie met projectnaam
- ✅/❌ in UI

### Kopieer naar Claude
- 📋 Structuur + key files
- ✂ Selecteer — zoekbalk + lege selectie + sticky
- Binaire bestanden niet selecteerbaar

---

## API Routes

| Route | Functie |
|-------|---------|
| `/api/health` | Verbinding + bestandsaantal |
| `/api/import` | ZIP extractie |
| `/api/diff` | ZIP vs GitHub diff |
| `/api/sync` | Batch commit + auto-tagging |
| `/api/snapshot` | Structuur ophalen |
| `/api/contents` | Bestandsinhoud on-demand |
| `/api/commits` | Commit history |
| `/api/tags` GET/POST/PUT | Herstelpunten + herstel |
| `/api/deployment` | Vercel deployment status |
| `/api/push/subscribe` | Push subscription |
| `/api/push/send` | Push notificatie sturen |
| `/api/push/test` | Push testen |
| `/api/dropbox/list` | ZIPs ophalen + routeren |
| `/api/dropbox/download` | ZIP downloaden |
| `/api/dropbox/delete` | ZIP verwijderen na push |
| `/api/dropbox/auth` | OAuth2 flow starten |
| `/api/dropbox/callback` | OAuth2 callback |
| `/api/vercel/webhook` | Webhook endpoint (Pro plan) |

---

## Environment Variables (Vercel)

```
GITHUB_PAT
VERCEL_TOKEN
VERCEL_PROJECT_ID
VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
VAPID_SUBJECT            = mailto:stuctech@gmail.com
FIREBASE_SERVICE_ACCOUNT
DROPBOX_APP_KEY          = cpwakxhqusxbppr
DROPBOX_APP_SECRET
DROPBOX_REFRESH_TOKEN
VERCEL_WEBHOOK_SECRET    (klaar voor Pro plan)
```

---

## Dropbox Setup

### OAuth2 (permanent)
1. dropbox.com/developers → app aanmaken
2. Permissions: `files.metadata.read`, `files.content.read`, `files.content.write`
3. Redirect URI: `https://codesync-three-gamma.vercel.app/api/dropbox/callback`
4. Vercel: `DROPBOX_APP_KEY`, `DROPBOX_APP_SECRET`
5. Open `/api/dropbox/auth` → toestemming → refresh token
6. Vercel: `DROPBOX_REFRESH_TOKEN`

### Map
```
Dropbox/CodeSyncApp/
├── codesync-fix.zip
├── coachos-feature.zip
└── lottoapp-update.zip
```

---

## Projecten

### ACTIVE
| Project | Repo | Vercel |
|---------|------|--------|
| CodeSnap | stuctech-eng/codesnap | codesnap |
| CoachOS | stuctech-eng/coachOS | coach-os |
| LottoApp | stuctech-eng/LottoApp | lotto-app |
| Codelab | stuctech-eng/codelab | codelab |
| Code Cleaner | stuctech-eng/Code-cleaner | — |
| Polder | stuctech-eng/polder | polder |
| CodeSync | stuctech-eng/codesync | codesync |

### EXPERIMENTAL
Quizmaster App, Bassflow Pro, Party Game, Pitwall, Amutec

### ARCHIVE
Solitaire Neeltje, Mahjong God, Getalgeheugen Pro, Reken Geheugen, Hudson Sharp

---

## Push Notificaties herstel
1. Firebase → Mahjong God → Firestore → codesync → push-subscription → verwijder
2. Open import pagina in CodeSync PWA
3. Test via `/api/push/test`

---

## Docs
- [Architectuur](docs/architecture.md)
- [Changelog](docs/changelog.md)
- [Roadmap](docs/roadmap.md)
