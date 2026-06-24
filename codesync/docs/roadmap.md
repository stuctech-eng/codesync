# CodeSync — Roadmap

## V1 — Core (✅ Afgerond — 24 juni 2026)

### Project management
- [x] Project registry (active / experimental / archive)
- [x] Project overzicht met inklapbare categorieën
- [x] Dag/nacht toggle
- [x] Project detail pagina

### File tree
- [x] Lazy loading file tree
- [x] Gegroepeerd per map
- [x] Relatieve paden

### ZIP Import
- [x] ZIP upload + extractie
- [x] Diff engine (ZIP vs GitHub)
- [x] Checkbox selectie per bestand
- [x] Verwijderde bestanden standaard uitgevinkt
- [x] Batch commit naar GitHub

### AI Context
- [x] Kopieer naar Claude — checkbox selectie
- [x] Clipboard formaat: projectnaam + structuur + inhoud

### Infrastructuur
- [x] GitHub PAT authenticatie
- [x] Health check endpoint
- [x] Offline cache fallback
- [x] Next.js 15.3.6 (security patched)
- [x] Vercel deployment

---

## V2 — Context (Gepland)

### History timeline
- [ ] Commit history per project
- [ ] Tijdlijn: datum → actie → aantal bestanden
- [ ] Zichtbaar in project detail pagina

### AI context verfijning
- [ ] Stack informatie toevoegen aan clipboard
- [ ] Key files markeren
- [ ] Context template per project

### Selectieve import
- [ ] Per-bestand diff preview
- [ ] Bestand-voor-bestand review mode

### Offline
- [ ] Persistente cache (localStorage of Supabase)
- [ ] Stale state indicator in overzicht

---

## V3 — Advanced (Toekomst)

### Working Copy integratie
- [ ] Direct openen in Working Copy
- [ ] Commit preview UI

### Geavanceerde diff
- [ ] Rename detectie
- [ ] Bestandsverwijdering via GitHub API
- [ ] Content diff weergave (oud vs nieuw)

### Multi-user
- [ ] GitHub OAuth
- [ ] Team support
