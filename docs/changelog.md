# CodeSync — Changelog

## v1.0.29 — 24 juni 2026

### AI Context Export verfijnd
- Stack per project toevoegbaar in `lib/projects.ts`
- Key files per project met beschrijving
- Clipboard formaat uitgebreid: projectnaam + stack + key files + structuur + inhoud

### Herstelpunten (Git Tags)
- "Maak herstelpunt" knop op project detail pagina
- GitHub tag aanmaken via Tags API (createTag + getTags)
- Laatste 5 tags zichtbaar per project met versienummer + commit SHA
- "Bekijk →" link per tag naar GitHub
- Versienummer automatisch op basis van commit count

### Vercel deployment link
- Na succesvolle push: "Bekijk deployment →" knop
- Opent direct in Vercel app

### Automatische versienaming
- ZIP bestandsnaam → commit beschrijving in Vercel
- Commit count → patch versienummer
- Format: `ui-update — v1.0.4 — 24 jun 2026 14:22`

---

## v1.0.26 — 24 juni 2026

### Herstelpunten (initieel)
- `/api/tags` route aangemaakt
- GET: tags ophalen per project
- POST: tag aanmaken via branch ref SHA

---

## v1.0.24 — 24 juni 2026

### ZIP Import — checkboxes
- Checkbox selectie per bestand
- Nieuwe bestanden standaard aangevinkt
- Gewijzigde bestanden standaard aangevinkt
- Verwijderde bestanden standaard uitgevinkt + rode waarschuwing
- "Alles aan/uit" per sectie
- Push knop toont aantal geselecteerde bestanden

---

## v1.0.22 — 24 juni 2026

### Kopieer naar Claude
- Knop op project detail pagina
- Snapshot laadt automatisch
- Checkbox selectie per map en bestand
- "Alles aan/uit" per map
- Clipboard formaat: projectnaam + structuur + bestandsinhoud

### UI — lichte mode
- Lichte mode als standaard
- Dag/nacht toggle op overzichtspagina
- Sticky headers
- Touch targets ≥ 44px

### File tree — lazy loading
- Tree laadt pas bij tik op "Bekijk bestanden"
- Relatieve paden per map
- Offline cache indicator

---

## v1.0.18 — 24 juni 2026

### Project detail pagina
- Status badge (ACTIVE / EXPERIMENTAL / ARCHIVE)
- Repository info
- ZIP Import knop (alleen ACTIVE)
- GitHub link

### Snapshot API
- `/api/snapshot` — GET per project slug
- Caching in memory

---

## v1.0.12 — 24 juni 2026

### Project overzicht
- Inklapbare categorieën (ACTIVE open, rest dicht)
- Status dot per categorie
- Projecten per categorie

### Project registry uitgebreid
- 15 projecten (5 active, 5 experimental, 5 archive)
- CodeSync beheert zichzelf (`stuctech-eng/codesync`)
- Status lifecycle: active / experimental / archive

---

## v1.0.8 — 24 juni 2026

### Documentatie
- README.md aangemaakt
- docs/architecture.md — data modellen, GitHub integratie, beperkingen
- docs/roadmap.md — V1 afgerond, V2 en V3 gepland
- docs/changelog.md — dit bestand

### ZIP pad vereiste gedocumenteerd
- Paden in ZIP moeten overeenkomen met repo root
- Verwijderingen via Working Copy

---

## v1.0.4 — 24 juni 2026

### Core infrastructuur (V1)
- Next.js 15.3.6 + TypeScript
- GitHub PAT authenticatie (server-side only)
- GitHub Git tree API: createTree → createCommit → updateRef
- In-memory snapshot cache met offline fallback
- Vercel deployment

### API Routes
- `/api/health` — GitHub connectie per project
- `/api/import` — ZIP extractie (macOS metadata gefilterd)
- `/api/diff` — diff engine (ZIP vs GitHub)
- `/api/sync` — batch commit naar GitHub
- `/api/snapshot` — snapshot ophalen

### Diff engine
- Whitespace normalisatie (CRLF → LF)
- Nieuw / gewijzigd / verwijderd / ongewijzigd
- Online mode (GitHub) + offline fallback (cache)

### ZIP Import flow
- ZIP upload via Files app
- Server-side extractie
- Diff berekening vs GitHub state
- Review scherm
- Batch commit
