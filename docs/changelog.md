# CodeSync — Changelog

## V1.0.0 — 24 juni 2026

### Initiële release

#### Architectuur
- Next.js 15.3.6 + TypeScript
- GitHub PAT authenticatie (server-side)
- GitHub Git tree API voor batch commits
- In-memory snapshot cache met offline fallback
- Vercel deployment

#### Project management
- Project registry met status lifecycle: active / experimental / archive
- 15 projecten geconfigureerd (5 active, 5 experimental, 5 archive)
- CodeSync beheert zichzelf (`stuctech-eng/codesync`)
- Inklapbare categorieën — ACTIVE standaard open
- Dag/nacht toggle

#### File tree
- Lazy loading — tree laadt pas bij tik
- Gegroepeerd per top-level map
- Relatieve paden per map
- Offline cache indicator

#### ZIP Import engine
- ZIP upload via Files app
- Server-side extractie (macOS metadata gefilterd)
- Diff engine: ZIP vs GitHub state
- Whitespace normalisatie (CRLF → LF)
- Checkbox selectie per bestand
- Verwijderde bestanden standaard uitgevinkt + rode waarschuwing
- "Alles aan/uit" per sectie
- Batch commit: createTree → createCommit → updateRef
- Commit SHA bevestiging

#### AI Context Export
- "Kopieer naar Claude" knop per project
- Snapshot laadt automatisch bij activatie
- Checkbox selectie per map en bestand
- Clipboard formaat:
  - Projectnaam + repository
  - Bestandsstructuur (tree)
  - Volledige bestandsinhoud per geselecteerd bestand

#### API Routes
- `GET /api/health` — GitHub connectie per project
- `POST /api/import` — ZIP extractie
- `POST /api/diff` — diff berekening
- `POST /api/sync` — batch commit
- `GET /api/snapshot` — snapshot ophalen

#### Documentatie
- README.md
- docs/architecture.md
- docs/roadmap.md
- docs/changelog.md
