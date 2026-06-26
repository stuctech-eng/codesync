# CodeSync — Changelog

## v1.0.120+ — 26 juni 2026

### Zoekfunctie in selecteer modus
- Zoekbalk bovenaan bij "✂ Selecteer"
- Realtime filtering op bestandsnaam
- Count: "X van Y gevonden" tijdens zoeken
- ✕ knop om zoekopdracht te wissen

### Geselecteerde bestanden als tags
- Geselecteerde bestanden zichtbaar als tags boven de lijst
- Tags tonen laatste twee padsegmenten (bijv. `sync/route.ts`)
- Tik op tag om bestand te deselecteren

### Sticky knoppen
- Sticky "Kopieer naar Claude" knop in selecteer modus
- Sticky "Push" en "Annuleer" knoppen op import pagina
- Altijd zichtbaar ongeacht scrollpositie

### Content diff
- "diff" knop bij elk gewijzigd bestand in ZIP import
- Tik om diff te tonen: groen `+` toegevoegd, rood `-` verwijderd
- Oude content van GitHub, nieuwe content uit ZIP
- Max 200 regels getoond

### Commit history
- "📋 Commit history" knop op project detail pagina
- Lazy loaded — laatste 20 commits
- Datum, beschrijving en SHA per commit

### Snapshot structuur-only
- Snapshot laadt alleen bestandspaden, geen content
- Veel sneller voor grote repos (bijv. 224 bestanden)
- Inhoud wordt apart geladen via `/api/contents` bij selectie

### GitHub status op overzicht
- Verbindingsstatus per project op overzichtspagina
- Groen "● verbonden" / rood "● niet bereikbaar"

---

## v1.0.110 — 25 juni 2026

### Push notificaties
- Service Worker (`public/sw.js`) aangemaakt
- Web Push via `web-push` library
- VAPID keys geconfigureerd
- Firebase Firestore voor persistente subscription opslag
- Notificatie bij deployment geslaagd of mislukt
- Subscription vernieuwd bij elke import pagina open

### Deployment status polling
- `/api/deployment` route — pollt Vercel API na push
- Voortgangsbalk tijdens bouwen
- Eerste poll na 15 seconden delay
- `after` timestamp filter voorkomt oude deployments
- Push notificatie via Firebase bij READY of ERROR

### Firebase integratie
- `lib/firebase-admin.ts` — Firebase Admin SDK
- `lib/push.ts` — push subscription opslag in Firestore
- Mahjong God Firebase project hergebruikt

### Bestandsverwijdering via CodeSync
- 🗑 knop op project detail pagina
- Checkbox selectie in file tree
- Bevestigingsscherm voor definitieve verwijdering
- GitHub Contents API per bestand
- Working Copy niet meer nodig voor verwijderingen
- Ook via ZIP import — verwijderde bestanden aanzetten in diff

### Kopieer naar Claude verfijnd
- 📋 knop — structuur + key files inhoud in één tik
- ✂ Selecteer — inhoud van geselecteerde bestanden apart geladen
- `/api/contents` route voor on-demand bestandsinhoud

### Herstelpunten (Git Tags)
- 🔖 Maak herstelpunt knop
- Laatste 5 tags per project zichtbaar
- Versienummer automatisch op basis van commit count

### Automatische versienaming
- ZIP naam → commit beschrijving
- Commit count → patch versienummer
- Format: `ui-update — v1.0.104 — 25 jun 2026 14:22`

---

## v1.0.29 — 24 juni 2026

### AI Context Export
- Stack + key files per project in `lib/projects.ts`
- Clipboard formaat: naam + stack + key files + structuur + inhoud

### UI verbeteringen
- Lichte mode als standaard
- Dag/nacht toggle
- Inklapbare categorieën (ACTIVE open, rest dicht)
- Lazy loading file tree met relatieve paden

### ZIP Import — checkboxes
- Selectie per bestand
- Verwijderde bestanden standaard uitgevinkt
- "Alles aan/uit" per sectie

---

## v1.0.4 — 24 juni 2026

### Core infrastructuur
- Next.js 15.3.6 + TypeScript
- GitHub PAT authenticatie (server-side)
- GitHub Git tree API: createTree → createCommit → updateRef
- In-memory snapshot cache met offline fallback
- Vercel deployment
- ZIP Import + diff engine
- Batch commit naar GitHub
- Health check endpoint
