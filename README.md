# CodeSync

AI-backed Git state engine voor iPhone development workflows.

**Live:** https://codesync-three-gamma.vercel.app
**Repo:** stuctech-eng/codesync
**Laatste update:** 2025-06-09

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

Twee opties, afhankelijk van wat je nodig hebt:

**Snel overzicht (structuur, geen inhoud):**
```
1. Ga naar project detail pagina
2. Tik 📋 naast "Bekijk bestanden"
3. Boomstructuur staat op het klembord
4. Plak in Claude — ideaal om Claude snel te laten zien welke bestanden bestaan
```

**Volledige bestandsinhoud (gericht):**
```
1. Ga naar project detail pagina
2. Tik ✂ Selecteer
3. Zoek en selecteer relevante bestanden
4. Tik "Kopieer X bestanden naar Claude"
5. Plak in nieuwe Claude chat
```

**Commit history naar Claude:**
```
1. Tik 📋 naast "Commit history"
2. Laadt automatisch (indien nodig) en kopieert sha + bericht + datum van elke commit
3. Plak in Claude — handig om Claude snel bij te praten over recente wijzigingen
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

**Deze regel geldt voor élk project en élk type bestand** — ook illustraties,
afbeeldingen en andere assets. Er bestaat geen apart "assets"-type; die vallen
gewoon onder `update` of `feature`, afhankelijk van de impact:

```
Voorbeelden voor assets/illustraties:
  coachos-update.zip   → paar nieuwe illustraties toevoegen aan public/
  coachos-feature.zip  → grote hoeveelheid nieuwe assets als onderdeel van een feature
  polder-update.zip    → afbeeldingen bijwerken in polder

Fout: illustraties-webp-compressed.zip
  → geen project-slug als prefix, matcht geen enkel project,
     komt in de "niet herkend" wachtrij terecht.
```

Checklist voor elke ZIP, ongeacht inhoud:
- Naam begint met de **exacte** project-slug (zie `lib/projects.ts`) — dus
  `coachos`, niet `coach-os` of `CoachOS`
- Paden in de ZIP beginnen bij de repo root, bijv. `public/illustraties/naam.png`
  — niet `coachos/public/illustraties/naam.png`
- Geen spaties of hoofdletters in de bestandsnaam

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
- **Laatst gebruikte repo bovenaan** binnen ACTIVE (gesorteerd op laatste commit-datum via `/api/health`)
- ACTIVE / EXPERIMENTAL / ARCHIVE — inklapbare categorieën
- Verbindingsstatus + bestandsaantal per project
- ZIP knop direct naar import pagina
- Dag/nacht toggle (persistent via localStorage) — homepage en detailpagina's delen nu hetzelfde CSS-variabelen thema-systeem (geen light/dark inconsistenties meer tussen pagina's)

### Project detail pagina
- File tree — lazy loaded, gegroepeerd per map
- Commit history — relatieve datums, **📋 copy-knop** (kopieert sha + bericht + datum van alle commits in één tik, laadt automatisch indien nodig)
- Herstelpunten (Git tags) — inklapbaar, aanmaken + herstellen via CodeSync
- Bestandsverwijdering — zoekbalk + tags + sticky knop + dubbele bevestiging
- Kopieer naar Claude — zoekbalk + tags + sticky knop
- Dark mode — volledig consistent, geen hardcoded kleuren meer die onleesbaar worden in donker thema

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
- **📋 Snapshot** (naast "Bekijk bestanden") — pure boomstructuur, geen inhoud, voor een snel overzicht van de projectopbouw
- **📋 Commit history copy** — sha + bericht + datum + auteur van alle commits, 1 tik
- **✂ Selecteer** (zwarte knop) — zoekbalk + tags + sticky knop — volledige inhoud van handmatig gekozen bestanden
- Inhoud on-demand geladen (alleen bij Selecteer)
- Clipboard bij Selecteer: naam + stack + key files + structuur + volledige inhoud

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
| `/api/health` | GET | Verbinding + bestandsaantal + laatste commit-datum per project |
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
- CodeSnap, CoachOS, LottoApp, Codelab, Code Cleaner, Polder, CodeSync

### EXPERIMENTAL
- Quizmaster App, Bassflow Pro, Orbit, Pitwall, Amutec

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
- [**Claude-integratie: plan, voortgang & teststappen**](docs/claude-integration-plan.md) — permanent dossier van het traject naar een volledig Claude-geïntegreerde ontwikkelomgeving. Huidige status: v1.1 Fase 1+2 live (chat werkt, betrouwbaarheid op Vercel Hobby nog beperkt), Master Plan v1.2 Fase 1 (task-infrastructuur) live.
