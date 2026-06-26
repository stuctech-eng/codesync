# CodeSync

AI-backed Git state engine voor iPhone development workflows.

**Live:** https://codesync-three-gamma.vercel.app

---

## Wat is CodeSync

CodeSync is een project management systeem dat ZIP-bestanden van Claude omzet in gestructureerde projecten en synchroniseert via GitHub.

Het is geen code editor — het is een **project state + AI context + Git sync layer**.

### Drie problemen die CodeSync oplost

1. **AI context verlies** → project snapshots + context export naar Claude
2. **ZIP chaos** → diff engine + selectieve file mapping
3. **iPhone dev beperking** → GitHub sync layer zonder desktop

---

## Architectuur

```
Claude (ZIP output)
        ↓
CodeSync (PWA — Next.js 15.3.6 / Vercel)
        ↓
  - ZIP extractie
  - diff engine (ZIP vs GitHub)
  - snapshot (structuur)
  - selectieve push
  - content diff
  - commit history
  - push notificaties
        ↓
GitHub (source of truth)
Firebase Firestore (push subscription)
        ↓
Working Copy (optioneel)
```

---

## Stack

| Laag | Technologie |
|------|-------------|
| Frontend | Next.js 15.3.6, TypeScript |
| Backend | Next.js API Routes (serverless) |
| Auth | GitHub PAT (server-side only) |
| Storage | GitHub Repositories |
| Push | Firebase Firestore + Web Push |
| Deploy | Vercel |

---

## Project lifecycle

| Status | Betekenis |
|--------|-----------|
| `active` | Volledig AI-managed — ZIP import, diff, sync, context export |
| `experimental` | Light tracking — alleen bekijken |
| `archive` | Read-only referentie |

---

## Features

### Project overzicht
- ACTIVE / EXPERIMENTAL / ARCHIVE — inklapbare categorieën
- ACTIVE standaard open, rest dicht
- GitHub verbindingsstatus per project
- Dag/nacht toggle

### Project detail pagina
- File tree — lazy loaded, gegroepeerd per map
- Commit history — laatste 20 commits met datum en SHA
- Herstelpunten (Git tags) — aanmaken en bekijken
- Bestandsverwijdering via 🗑 knop + bevestigingsscherm

### ZIP Import
- ZIP upload via Files app
- Diff engine: ZIP vs GitHub state
- Nieuw / gewijzigd / verwijderd per bestand
- Content diff — oud vs nieuw bij gewijzigde bestanden
- Checkbox selectie — verwijderde bestanden standaard uitgevinkt
- Sticky Push knop — altijd zichtbaar
- Batch commit naar GitHub
- Automatische versienaming: `ui-update — v1.0.4 — 25 jun 2026 14:22`

### Deployment
- Deployment status polling na push
- Voortgangsbalk tijdens Vercel build
- ✅ Geslaagd / ❌ Mislukt in UI
- Push notificatie op iPhone via Web Push
- "Bekijk deployment →" knop naar Vercel app

### Kopieer naar Claude
- 📋 Kopieer alles — structuur + key files inhoud in één tik
- ✂ Selecteer — kies bestanden via checkboxes
- Zoekfunctie in selecteer modus
- Geselecteerde bestanden als tags (tik om te deselecteren)
- Sticky kopieer knop — altijd zichtbaar
- Clipboard formaat: projectnaam + stack + key files + structuur + bestandsinhoud

---

## API Routes

| Route | Method | Functie |
|-------|--------|---------|
| `/api/health` | GET | GitHub connectie testen per project |
| `/api/import` | POST | ZIP extractie |
| `/api/diff` | POST | ZIP vs GitHub diff |
| `/api/sync` | POST | Batch commit + bestandsverwijdering |
| `/api/snapshot` | GET | Structuur ophalen per project |
| `/api/contents` | POST | Bestandsinhoud ophalen per pad |
| `/api/commits` | GET | Commit history per project |
| `/api/tags` | GET/POST | Herstelpunten ophalen/aanmaken |
| `/api/deployment` | GET | Vercel deployment status |
| `/api/push/subscribe` | GET/POST | Push subscription beheren |
| `/api/push/test` | GET | Push notificatie testen |

---

## ZIP Import Flow

```
Claude ZIP
   ↓
/api/import        → extractie (macOS metadata gefilterd)
   ↓
/api/diff          → ZIP vs GitHub vergelijken
   ↓
review             → content diff per gewijzigd bestand
                  → checkbox selectie per bestand
   ↓
/api/sync          → batch commit + push
   ↓
/api/deployment    → Vercel status polling (15 sec delay)
   ↓
push notificatie   → iPhone melding bij READY/ERROR
```

### ZIP pad vereiste

Paden in de ZIP moeten overeenkomen met de repo root — **geen prefix**.

✅ Correct: `app/page.tsx`, `lib/github.ts`
❌ Fout: `projectnaam/app/page.tsx` → wordt als submap aangemaakt

### ZIP bestandsnaam = commit message

```
ui-update.zip → "ui update — v1.0.104 — 25 jun 2026 14:22"
```

Geef ZIPs een beschrijvende naam — dat wordt de commit message in Vercel.

---

## Kopieer naar Claude Flow

```
Project detail pagina
   ↓
📋 Kopieer alles
   → structuur laden
   → key files inhoud ophalen
   → clipboard

✂ Selecteer
   → structuur laden
   → zoeken en bestanden selecteren
   → inhoud ophalen van geselecteerde bestanden
   → clipboard
   ↓
Plakken in Claude chat → Claude heeft direct projectcontext
```

---

## Bestandsverwijdering

Via 🗑 knop op project detail pagina:
1. Laad file tree
2. Tik 🗑 → checkboxes verschijnen
3. Selecteer bestanden (rood gemarkeerd)
4. Tik "Verwijder X bestanden"
5. Bevestigingsscherm — definitieve verwijdering
6. GitHub Contents API verwijdert per bestand

Via ZIP import — verwijderde bestanden in diff:
1. Vink aan in "Verwijderde bestanden" sectie
2. Standaard uitgevinkt + rode waarschuwing
3. Push verwijdert de bestanden

---

## Push notificaties

Vereist: CodeSync geïnstalleerd als PWA via Safari → "Voeg toe aan beginscherm"

Flow:
1. Open ZIP import pagina → toestemming gevraagd
2. Subscription opgeslagen in Firebase Firestore
3. Na elke push → Vercel deployment polling
4. Bij READY of ERROR → push notificatie op iPhone

---

## Herstelpunten

Via 🔖 knop op project detail pagina (na file tree laden):
- Maakt een Git tag aan op de huidige commit
- Versienummer automatisch op basis van commit count
- Laatste 5 tags zichtbaar met SHA en GitHub link
- Terugzetten via Working Copy → checkout tag

---

## Environment variables

```bash
GITHUB_PAT              # GitHub Personal Access Token (scope: repo)
VERCEL_TOKEN            # Vercel API token (voor deployment polling)
VERCEL_PROJECT_ID       # Vercel project ID
VAPID_PUBLIC_KEY        # Web Push public key
VAPID_PRIVATE_KEY       # Web Push private key
VAPID_SUBJECT           # mailto:jouw@email.com
FIREBASE_SERVICE_ACCOUNT # Firebase Admin JSON (als string)
```

---

## Setup

```bash
npm install
cp .env.example .env.local
# Vul alle environment variables in
npm run dev
```

Test verbinding: `/api/health`
Test push: `/api/push/test`

---

## Roadmap

Zie [docs/roadmap.md](docs/roadmap.md)

## Changelog

Zie [docs/changelog.md](docs/changelog.md)

## Architectuur details

Zie [docs/architecture.md](docs/architecture.md)
