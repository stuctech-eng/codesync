# CodeSync — Changelog

## v1.0.140+ — 26 juni 2026

### Beveiliging & betrouwbaarheid
- Projectnaam waarschuwing bij ZIP import — detecteert verkeerde ZIP naam
- Dubbele bevestiging bij bestandsverwijdering
- Deployment notificaties via Firestore — geen dubbele meldingen meer over serverless instances
- Projectnaam in push notificatie (`✅ codesync deployment geslaagd`)

### Delete modus verbeterd
- Zoekbalk bovenaan in delete modus
- Geselecteerde bestanden als rode tags (tik om te deselecteren)
- Sticky verwijder knop — altijd zichtbaar
- Dubbele bevestiging — eerste "Ja, verwijder" → tweede "Definitief verwijderen"

### Tag herstel via CodeSync
- "Herstel naar deze versie" knop per tag
- Maakt nieuwe commit op main met bestanden van die tag
- Geen Working Copy nodig
- Tweestaps bevestiging

### Tags inklapbaar
- Herstelpunten sectie inklapbaar via tik
- Toont aantal tags in header

### Snelkoppeling ZIP Import
- ZIP knop direct op overzichtspagina per ACTIVE project
- Één tik naar import pagina

### Bestandsaantal op overzicht
- Via GitHub tree API — snel, geen volledige snapshot
- Toont `● 29 bestanden` per project

### Commit history — relatieve datums
- "Zojuist", "5 min geleden", "2 uur geleden", "3 dagen geleden"
- Ouder dan 7 dagen → volledige datum

### Zoekfunctie in selecteer modus
- Realtime filtering op bestandsnaam
- Count: "X van Y gevonden"
- ✕ knop om te wissen

### Geselecteerde bestanden als tags
- Toon laatste twee padsegmenten (`sync/route.ts`)
- Tik op tag om te deselecteren

### Sticky knoppen
- Sticky "Kopieer naar Claude" in selecteer modus
- Sticky "Push" op import pagina
- Sticky "Verwijder" in delete modus

### Content diff
- "diff" knop per gewijzigd bestand in ZIP import
- Groen `+` toegevoegd, rood `-` verwijderd
- Max 200 regels

### Commit history
- "📋 Commit history" knop — lazy loaded
- Laatste 20 commits met SHA en datum

### Snapshot structuur-only
- Snel voor grote repos (224+ bestanden)
- Inhoud on-demand via `/api/contents`

---

## v1.0.110 — 25 juni 2026

### Push notificaties
- Firebase Firestore voor persistente subscription
- VAPID keys correct geconfigureerd
- Notificatie bij READY en ERROR

### Deployment polling
- 15 seconden delay voor eerste poll
- `after` timestamp filter
- Voortgangsbalk

### Bestandsverwijdering via CodeSync
- 🗑 knop op project detail pagina
- Ook via ZIP import diff

### Kopieer naar Claude
- 📋 structuur + key files
- ✂ selecteer modus

### Herstelpunten
- Git tags aanmaken
- Laatste 5 tags per project

---

## v1.0.29 — 24 juni 2026

### Core features
- ZIP Import + diff engine
- Checkpoint selectie per bestand
- Kopieer naar Claude
- GitHub PAT authenticatie
- Dag/nacht toggle
- Lazy loading file tree
