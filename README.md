# CodeSync

AI-backed Git state engine voor iPhone development workflows.

**Live:** https://codesync-three-gamma.vercel.app

---

## Wat is CodeSync

CodeSync is een project management systeem dat ZIP-bestanden van Claude omzet in gestructureerde projecten en synchroniseert via GitHub.

Het is geen code editor — het is een **project state + AI context + Git sync layer**.

### Drie problemen die CodeSync oplost

1. **AI context verlies** → project snapshots + context export
2. **ZIP chaos** → diff engine + file mapping
3. **iPhone dev beperking** → GitHub sync layer

---

## Architectuur

```
Claude (ZIP output)
        ↓
CodeSync (web app)
        ↓
  - ZIP extraction
  - project mapping
  - diff engine
  - snapshot cache
        ↓
GitHub (source of truth)
        ↓
Working Copy (optioneel)
```

GitHub = database van project state
CodeSync = intelligence + control layer
Working Copy = optionele Git client

---

## Stack

| Laag | Technologie |
|------|-------------|
| Frontend | Next.js 15.3.6, TypeScript |
| Backend | Next.js API Routes |
| Auth | GitHub PAT (server-side only) |
| Storage | GitHub Repositories |
| Deploy | Vercel |

---

## Project lifecycle

Elk project heeft een status:

| Status | Betekenis |
|--------|-----------|
| `active` | Volledig AI-managed — ZIP import, diff, sync, context export |
| `experimental` | Light tracking — alleen bekijken |
| `archive` | Read-only referentie |

---

## Features (V1)

- **Project overzicht** — ACTIVE / EXPERIMENTAL / ARCHIVE, inklapbaar
- **File tree** — lazy loaded per project
- **ZIP Import** — upload Claude ZIP, diff vs GitHub, selectieve push
- **Checkbox selectie** — verwijderde bestanden standaard uitgevinkt
- **Kopieer naar Claude** — selecteer bestanden, kopieer inhoud naar clipboard
- **GitHub sync** — batch commit via Git tree API
- **Health check** — `/api/health` toont status per project
- **Dag/nacht toggle** — op project overzicht

---

## API Routes

| Route | Method | Functie |
|-------|--------|---------|
| `/api/health` | GET | GitHub connectie testen |
| `/api/import` | POST | ZIP extractie |
| `/api/diff` | POST | ZIP vs GitHub diff |
| `/api/sync` | POST | Batch commit naar GitHub |
| `/api/snapshot` | GET | Snapshot ophalen per project |

---

## ZIP Import Flow

```
Claude ZIP
   ↓
/api/import        → extractie
   ↓
GitHub pull        → latest state ophalen
   ↓
/api/diff          → ZIP vs GitHub vergelijken
   ↓
review             → checkbox selectie per bestand
   ↓
/api/sync          → batch commit + push
```

### ZIP pad vereiste

Paden in de ZIP moeten overeenkomen met de repo root — **geen prefix**.

✅ Correct: `app/page.tsx`, `lib/github.ts`, `docs/README.md`
❌ Fout: `codesync/app/page.tsx` → wordt als submap aangemaakt

### ZIP bestandsnaam = commit message

```
ui-update.zip → "ui update — v1.0.4 — 24 jun 2026 14:22"
```

Geef ZIPs een beschrijvende naam.

### Bestanden verwijderen

CodeSync kan geen bestanden verwijderen. Gebruik **Working Copy**:
1. Verwijder het bestand in Working Copy
2. Commit + Push

---

## Kopieer naar Claude Flow

```
Project detail pagina
   ↓
"Kopieer naar Claude"
   ↓
Snapshot laden
   ↓
Bestanden selecteren via checkboxes
   ↓
Clipboard: projectnaam + structuur + bestandsinhoud
   ↓
Plakken in Claude chat
```

---

## Environment

```bash
# .env.local
GITHUB_PAT=ghp_xxxxxxxxxxxxxxxxxxxx
```

Scopes: `repo` (full control)
Aanmaken: https://github.com/settings/tokens

---

## Setup

```bash
npm install
cp .env.example .env.local
# Vul GITHUB_PAT in
npm run dev
```

Vercel: voeg `GITHUB_PAT` toe als environment variable.
Test: `/api/health`

---

## Roadmap

Zie [docs/roadmap.md](docs/roadmap.md)

---

## Changelog

Zie [docs/changelog.md](docs/changelog.md)
