# CodeSync

AI-backed Git state engine voor iPhone development workflows.

**Live:** https://codesync-three-gamma.vercel.app
**Repo:** stuctech-eng/codesync

---

## Wat is CodeSync

CodeSync is een PWA (Progressive Web App) die ZIP-bestanden van Claude omzet in gestructureerde GitHub commits. Het is geen code editor — het is een **project state + AI context + Git sync layer** voor iPhone-first development.

### Drie problemen die CodeSync oplost

1. **AI context verlies** → project snapshots + selectieve context export naar Claude
2. **ZIP chaos** → Dropbox wachtrij + diff engine + selectieve file mapping
3. **iPhone dev beperking** → volledig GitHub sync layer zonder desktop

---

## Werkwijze

### Standaard workflow via Dropbox

```
1. Open Claude → nieuwe chat met project system prompt
2. Beschrijf wat je wil bouwen
3. Claude geeft ZIP output (bijv. codesync-feature.zip)
4. Sla ZIP op in Dropbox → CodeSyncApp/
5. Open CodeSync PWA
6. Tik 📥 Importeer nieuwe ZIPs
7. CodeSync herkent project automatisch op ZIP naam
8. Tik Verwerk → diff → selecteer bestanden → Push
9. Wacht op deployment notificatie
10. ZIP wordt automatisch verwijderd uit Dropbox
```

### Context naar Claude sturen

```
1. Ga naar project detail pagina
2. Tik ✂ Selecteer
3. Zoek en selecteer relevante bestanden
4. Tik "Kopieer X bestanden naar Claude"
5. Plak in nieuwe Claude chat
```

### Herstellen naar vorige versie

```
1. Ga naar project detail pagina
2. Laad file tree → open Herstelpunten
3. Tik "Herstel naar deze versie"
4. Bevestig tweemaal
5. CodeSync maakt nieuwe commit op main
```

---

## ZIP Regels (voor Claude system prompt)

```
ZIP NAAMREGEL:
ZIP naam begint altijd met de project slug, gevolgd door het type:

fix / hotfix / patch  → kleine correctie (geen auto-tag)
update / feature / refactor → grote wijziging (auto-tag)
docs / config → documentatie of configuratie (geen auto-tag)

Correct:   codesync-fix.zip → app/page.tsx
Fout:      update.zip → codesync/app/page.tsx

Paden beginnen bij repo root — geen project prefix.
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
| Push | Firebase Firestore + Web Push (VAPID) |
| Deploy | Vercel |

---

## Features

### Overzichtspagina
- 📥 Importeer nieuwe ZIPs — Dropbox wachtrij per project
- Fixes krijgen prioriteit binnen dezelfde repo
- ACTIVE / EXPERIMENTAL / ARCHIVE — inklapbare categorieën
- Verbindingsstatus + bestandsaantal per project
- ZIP knop direct naar import pagina
- Dag/nacht toggle (persistent via localStorage)

### Project detail pagina
- File tree — lazy loaded, gegroepeerd per map
- Commit history — relatieve datums
- Herstelpunten (Git tags) — inklapbaar, aanmaken + herstellen via CodeSync
- Bestandsverwijdering — zoekbalk + tags + sticky knop + dubbele bevestiging
- Kopieer naar Claude — zoekbalk + tags + sticky knop

### ZIP Import
- Dropbox auto-load via `?dropbox=` parameter
- Diff engine: ZIP vs GitHub
- Content diff per gewijzigd bestand
- Projectnaam beveiliging — waarschuwing bij verkeerde ZIP naam
- Intelligente auto-tagging — op basis van ZIP type en aantal bestanden
- Max 10 tags — oudste automatisch verwijderd
- Sticky Push knop
- Na succesvolle push → ZIP verwijderd uit Dropbox

### Deployment
- Polling na push (15 sec delay)
- SHA-based deployment matching
- Notificatie vanuit client — betrouwbaar
- Push notificatie met projectnaam op iPhone
- ✅/❌ in UI

### Kopieer naar Claude
- 📋 Structuur + key files in één tik
- ✂ Selecteer — zoekbalk + lege selectie als start
- Inhoud on-demand geladen
- Clipboard: naam + stack + key files + structuur + inhoud

---

## Dropbox Setup

### OAuth2 (permanent — verloopt nooit)

1. Ga naar dropbox.com/developers → maak app aan
2. Permissions: `files.metadata.read`, `files.content.read`, `files.content.write`
3. Redirect URI: `https://codesync-three-gamma.vercel.app/api/dropbox/callback`
4. Vercel: `DROPBOX_APP_KEY`, `DROPBOX_APP_SECRET`
5. Open `/api/dropbox/auth` → Dropbox vraagt toestemming
6. Kopieer `refresh_token` → Vercel: `DROPBOX_REFRESH_TOKEN`

### Map structuur

```
Dropbox/
└── CodeSyncApp/
    ├── codesync-fix.zip
    ├── coachos-feature.zip
    └── lottoapp-update.zip
```

ZIP naam prefix bepaalt het project automatisch.

---

## API Routes

| Route | Method | Functie |
|-------|--------|---------|
| `/api/health` | GET | Verbinding + bestandsaantal per project |
| `/api/import` | POST | ZIP extractie |
| `/api/diff` | POST | ZIP vs GitHub diff |
| `/api/sync` | POST | Batch commit + auto-tagging |
| `/api/snapshot` | GET | Structuur ophalen |
| `/api/contents` | POST | Bestandsinhoud on-demand |
| `/api/commits` | GET | Commit history |
| `/api/tags` | GET/POST/PUT | Herstelpunten + herstel |
| `/api/deployment` | GET | Vercel deployment status |
| `/api/push/subscribe` | GET/POST | Push subscription |
| `/api/push/send` | POST | Push notificatie sturen |
| `/api/push/test` | GET | Push testen |
| `/api/dropbox/list` | GET | ZIPs ophalen + routeren |
| `/api/dropbox/download` | POST | ZIP downloaden |
| `/api/dropbox/delete` | POST | ZIP verwijderen na push |
| `/api/dropbox/auth` | GET | OAuth2 flow starten |
| `/api/dropbox/callback` | GET | OAuth2 callback + refresh token |

---

## Environment Variables (Vercel)

```
GITHUB_PAT                # GitHub PAT (scope: repo)
VERCEL_TOKEN              # Vercel API token
VERCEL_PROJECT_ID         # Vercel project ID
VAPID_PUBLIC_KEY          # Web Push public key
VAPID_PRIVATE_KEY         # Web Push private key
VAPID_SUBJECT             # mailto:stuctech@gmail.com
FIREBASE_SERVICE_ACCOUNT  # Firebase Admin JSON als string
DROPBOX_APP_KEY           # Dropbox app key
DROPBOX_APP_SECRET        # Dropbox app secret
DROPBOX_REFRESH_TOKEN     # Dropbox OAuth2 refresh token (permanent)
```

---

## Projecten

### ACTIVE
- CodeSnap, CoachOS, LottoApp, Codelab, Code Cleaner, CodeSync

### EXPERIMENTAL
- Quizmaster App, Bassflow Pro, Party Game, Pitwall, Amutec

### ARCHIVE
- Solitaire Neeltje, Mahjong God, Getalgeheugen Pro, Reken Geheugen, Hudson Sharp

---

## Push Notificaties

Vereist: CodeSync als PWA geïnstalleerd via Safari.

Herstel na problemen:
1. Firebase → Mahjong God → Firestore → codesync → push-subscription → verwijder
2. Open import pagina in CodeSync PWA
3. Test via `/api/push/test`

---

## Documentatie

- [Architectuur](docs/architecture.md)
- [Changelog](docs/changelog.md)
- [Roadmap](docs/roadmap.md)
