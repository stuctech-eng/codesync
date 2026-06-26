# CodeSync

AI-backed Git state engine voor iPhone development workflows.

**Live:** https://codesync-three-gamma.vercel.app
**Repo:** stuctech-eng/codesync

---

## Wat is CodeSync

CodeSync is een PWA (Progressive Web App) die ZIP-bestanden van Claude omzet in gestructureerde GitHub commits. Het is geen code editor — het is een **project state + AI context + Git sync layer** voor iPhone-first development.

### Drie problemen die CodeSync oplost

1. **AI context verlies** → project snapshots + selectieve context export naar Claude
2. **ZIP chaos** → diff engine + content diff + selectieve file mapping
3. **iPhone dev beperking** → volledig GitHub sync layer zonder desktop of Working Copy

---

## Werkwijze

### Standaard workflow per project

```
1. Open Claude → nieuwe chat met project system prompt
2. Beschrijf wat je wil bouwen
3. Claude geeft ZIP output (bijv. codesync-fix.zip)
4. Open CodeSync PWA op iPhone
5. Ga naar project → ZIP Import
6. Upload ZIP → bekijk diff → check content diff per bestand
7. Selecteer bestanden → Push
8. Wacht op deployment notificatie op iPhone
9. Klaar — GitHub is bijgewerkt, Vercel is live
```

### Context naar Claude sturen

```
1. Ga naar project detail pagina
2. Tik ✂ Selecteer
3. Zoek en selecteer relevante bestanden
4. Tik "Kopieer X bestanden naar Claude"
5. Plak in nieuwe Claude chat
6. Claude heeft direct volledige projectcontext
```

### Herstelpunt aanmaken

```
1. Ga naar project detail pagina
2. Laad file tree (tik "Bekijk bestanden")
3. Tik 🔖 Maak herstelpunt
4. Tag wordt aangemaakt op huidige commit
```

### Herstellen naar vorige versie

```
1. Ga naar project detail pagina
2. Laad file tree → tik "Herstelpunten" om te openen
3. Tik "Herstel naar deze versie" bij gewenste tag
4. Bevestig → bevestig nogmaals
5. CodeSync maakt nieuwe commit op main met die versie
```

### Bestanden verwijderen

```
Via 🗑 knop:
1. Laad file tree
2. Tik 🗑
3. Zoek en selecteer bestanden
4. Sticky "Verwijder" knop → dubbele bevestiging
5. Bestanden verwijderd van GitHub

Via ZIP import:
1. Verwijderde bestanden verschijnen in diff
2. Standaard uitgevinkt — bewust aanzetten
3. Push verwijdert ze
```

---

## ZIP Regels (voor Claude system prompt)

```
ZIP OUTPUT REGEL:
- Paden beginnen bij repo root — geen project prefix
- ZIP naam begint altijd met de project slug
- Volledige bestanden, geen gedeeltelijke implementaties

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
| Push | Firebase Firestore + Web Push (VAPID) |
| Deploy | Vercel |

---

## Features

### Overzichtspagina
- ACTIVE / EXPERIMENTAL / ARCHIVE — inklapbare categorieën
- ACTIVE standaard open
- Verbindingsstatus + bestandsaantal per project
- ZIP knop direct naar import pagina
- Dag/nacht toggle

### Project detail pagina
- File tree — lazy loaded, gegroepeerd per map
- Commit history — relatieve datums ("2 uur geleden")
- Herstelpunten (Git tags) — inklapbaar, aanmaken + herstellen
- Bestandsverwijdering — zoekbalk + tags + sticky knop + dubbele bevestiging
- Kopieer naar Claude — zoekbalk + tags + sticky knop

### ZIP Import
- Diff engine: ZIP vs GitHub (nieuw / gewijzigd / verwijderd)
- Content diff per gewijzigd bestand (groen/rood)
- Projectnaam beveiliging — waarschuwing bij verkeerde ZIP naam
- Checkbox selectie — verwijderd standaard uitgevinkt
- Sticky Push knop
- Automatische versienaming: `codesync-fix — v1.0.139 — 26 jun 2026 20:20`

### Deployment
- Polling start na 15 seconden
- `after` timestamp filter — geen oude deployments
- Notificaties opgeslagen in Firestore — geen dubbele meldingen
- Voortgangsbalk tijdens bouwen
- ✅/❌ in UI + push notificatie met projectnaam
- "Bekijk deployment →" naar Vercel

### Kopieer naar Claude
- 📋 Kopieer alles — structuur + key files inhoud
- ✂ Selecteer — zoekbalk + tags + sticky knop
- Inhoud on-demand geladen (niet bij snapshot)
- Clipboard: projectnaam + stack + key files + structuur + bestandsinhoud

---

## API Routes

| Route | Method | Functie |
|-------|--------|---------|
| `/api/health` | GET | Verbinding + bestandsaantal per project |
| `/api/import` | POST | ZIP extractie |
| `/api/diff` | POST | ZIP vs GitHub diff (met content) |
| `/api/sync` | POST | Batch commit + bestandsverwijdering |
| `/api/snapshot` | GET | Structuur ophalen (geen content) |
| `/api/contents` | POST | Bestandsinhoud on-demand |
| `/api/commits` | GET | Commit history per project |
| `/api/tags` | GET | Herstelpunten ophalen |
| `/api/tags` | POST | Herstelpunt aanmaken |
| `/api/tags` | PUT | Herstellen naar tag |
| `/api/deployment` | GET | Vercel deployment status |
| `/api/push/subscribe` | GET/POST | Push subscription |
| `/api/push/test` | GET | Push notificatie testen |

---

## Environment Variables (Vercel)

```
GITHUB_PAT                # GitHub PAT (scope: repo)
VERCEL_TOKEN              # Vercel API token
VERCEL_PROJECT_ID         # Vercel project ID
VAPID_PUBLIC_KEY          # Web Push public key (65 bytes)
VAPID_PRIVATE_KEY         # Web Push private key
VAPID_SUBJECT             # mailto:stuctech@gmail.com
FIREBASE_SERVICE_ACCOUNT  # Firebase Admin JSON als string
```

---

## Projecten

### ACTIVE (volledig AI-managed)
- CodeSnap — `stuctech-eng/codesnap`
- CoachOS — `stuctech-eng/coachOS`
- LottoApp — `stuctech-eng/LottoApp`
- Codelab — `stuctech-eng/codelab`
- Code Cleaner — `stuctech-eng/Code-cleaner`
- CodeSync — `stuctech-eng/codesync` (beheert zichzelf)

### EXPERIMENTAL
- Quizmaster App, Bassflow Pro, Party Game, Pitwall, Amutec

### ARCHIVE
- Solitaire Neeltje, Mahjong God, Getalgeheugen Pro, Reken Geheugen, Hudson Sharp

---

## Push Notificaties

Vereist: CodeSync als PWA geïnstalleerd via Safari → "Voeg toe aan beginscherm"

Herstel na VAPID key rotatie:
1. Firebase → Mahjong God → Firestore → codesync → push-subscription → verwijder
2. Open import pagina in CodeSync PWA
3. Test via `/api/push/test`

---

## Documentatie

- [Architectuur](docs/architecture.md)
- [Changelog](docs/changelog.md)
- [Roadmap](docs/roadmap.md)
