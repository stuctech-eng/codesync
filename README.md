# CodeSync

AI-backed Git state engine voor iPhone development workflows.

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
| Frontend | Next.js 15, TypeScript |
| Backend | Next.js API Routes |
| Auth | GitHub PAT (server-side only) |
| Storage | GitHub Repositories |
| Deploy | Vercel |

---

## Projecten

| Slug | Naam | Repo |
|------|------|------|
| codesnap | CodeSnap | stuctech-eng/codesnap |
| coachos | CoachOS | stuctech-eng/coachos |
| lotto | Lotto | stuctech-eng/lotto |
| debug-academy | Debug Academy | stuctech-eng/debug-academy |

---

## API Routes

| Route | Method | Functie |
|-------|--------|---------|
| `/api/health` | GET | GitHub connectie testen |
| `/api/import` | POST | ZIP extractie |
| `/api/diff` | POST | ZIP vs GitHub diff |
| `/api/sync` | POST | Batch commit naar GitHub |

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
review             → new / modified / deleted
   ↓
/api/sync          → batch commit + push
```

---

## Diff Engine

Twee modi:

- **Online** — ZIP vs GitHub state (authoritative)
- **Offline** — ZIP vs lokale cache (stale, geflagd in UI)

---

## Environment

```bash
# .env.local
GITHUB_PAT=ghp_xxxxxxxxxxxxxxxxxxxx
```

Scopes vereist: `repo` (full control of private repositories)
Aanmaken via: https://github.com/settings/tokens

---

## Setup

```bash
npm install
cp .env.example .env.local
# Vul GITHUB_PAT in
npm run dev
```

Vercel deploy: voeg `GITHUB_PAT` toe als environment variable.

Verbinding testen: `/api/health`

---

## Roadmap

**V1 — Core**
- [x] Project registry
- [x] File tree via GitHub API
- [x] ZIP import engine
- [x] Diff engine (GitHub als baseline)
- [x] Batch commit naar GitHub
- [x] Health check endpoint

**V2 — Context**
- [ ] History timeline per project
- [ ] AI context export ("Copy AI Context")
- [ ] Selective import (per file)
- [ ] Offline cache UI

**V3 — Advanced**
- [ ] Working Copy integration
- [ ] Commit preview UI
- [ ] Advanced diff control

---

## Licentie

Privé project — stuctech-eng
