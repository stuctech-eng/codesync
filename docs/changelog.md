# CodeSync — Changelog

## v1.0.110 — 25 juni 2026

### Push notificaties
- Service Worker (`public/sw.js`) aangemaakt
- Web Push via `web-push` library
- VAPID keys gegenereerd en geconfigureerd
- Firebase Firestore voor persistente subscription opslag
- Subscription wordt bij elke import pagina open opnieuw aangemaakt
- Notificatie bij deployment geslaagd of mislukt

### Deployment status polling
- `/api/deployment` route — pollt Vercel API na push
- Voortgangsbalk tijdens bouwen
- ✅ Deployment geslaagd / ❌ Deployment mislukt in UI
- Eerste poll na 15 seconden delay — wacht op nieuwe Vercel build
- `after` timestamp filter — pikt geen oude deployments op
- Push notificatie via Firebase bij READY of ERROR

### Firebase integratie
- `lib/firebase-admin.ts` — Firebase Admin SDK
- `lib/push.ts` — push subscription opslag in Firestore
- `app/api/push/subscribe/route.ts` — subscription opslaan/ophalen
- `app/api/push/test/route.ts` — test endpoint

### Bestandsverwijdering via CodeSync
- 🗑 knop op project detail pagina
- Checkbox selectie per bestand in file tree
- Bevestigingsscherm voor definitieve verwijdering
- Verwijdering via GitHub Contents API (per bestand)
- Working Copy niet meer nodig voor verwijderingen

### Kopieer naar Claude — verbeterd
- 📋 knop — kopieert alles in één tik zonder selectie
- ✂ Selecteer knop — checkbox selectie per bestand
- Stack + key files in clipboard formaat

### Herstelpunten (Git Tags)
- 🔖 Maak herstelpunt knop op project detail pagina
- GitHub tag aanmaken via Tags API
- Laatste 5 tags zichtbaar per project
- Versienummer automatisch op basis van commit count

### Automatische versienaming
- ZIP bestandsnaam → commit beschrijving in Vercel
- Commit count → patch versienummer
- Format: `ui-update — v1.0.4 — 25 jun 2026 14:22`

### Vercel deployment link
- "Bekijk deployment →" knop na succesvolle push
- Opent direct in Vercel app

---

## v1.0.29 — 24 juni 2026

### AI Context Export verfijnd
- Stack per project toevoegbaar in `lib/projects.ts`
- Key files per project met beschrijving
- Clipboard formaat: projectnaam + stack + key files + structuur + inhoud

---

## v1.0.24 — 24 juni 2026

### ZIP Import — checkboxes
- Checkbox selectie per bestand
- Nieuwe bestanden standaard aangevinkt
- Gewijzigde bestanden standaard uitgevinkt bij verwijderd + rode waarschuwing
- "Alles aan/uit" per sectie
- Push knop toont aantal geselecteerde bestanden

---

## v1.0.22 — 24 juni 2026

### Kopieer naar Claude
- Knop op project detail pagina
- Snapshot laadt automatisch
- Checkbox selectie per map en bestand
- Clipboard formaat: projectnaam + structuur + bestandsinhoud

### UI — lichte mode
- Lichte mode als standaard
- Dag/nacht toggle op overzichtspagina
- Sticky headers
- Touch targets ≥ 44px

### File tree — lazy loading
- Tree laadt pas bij tik
- Relatieve paden per map
- Offline cache indicator

---

## v1.0.12 — 24 juni 2026

### Project overzicht
- Inklapbare categorieën (ACTIVE open, rest dicht)
- 15 projecten (5 active, 5 experimental, 5 archive)
- CodeSync beheert zichzelf

---

## v1.0.4 — 24 juni 2026

### Core infrastructuur (V1)
- Next.js 15.3.6 + TypeScript
- GitHub PAT authenticatie (server-side only)
- GitHub Git tree API: createTree → createCommit → updateRef
- In-memory snapshot cache met offline fallback
- Vercel deployment
- ZIP Import flow
- Diff engine
