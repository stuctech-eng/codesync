# CodeSync — Changelog

## v1.0.170+ — 28 juni 2026

### Dropbox integratie (V3 Queue systeem)
- Centrale ZIP opslag in Dropbox → `CodeSyncApp/`
- Automatische project routing op ZIP naam prefix
- Wachtrij per project op overzichtspagina
- Fix ZIPs krijgen prioriteit binnen dezelfde repo
- Na succesvolle push → ZIP automatisch verwijderd uit Dropbox
- Bij mislukte push → ZIP blijft in wachtrij

### Dropbox OAuth2
- Permanente refresh token — verloopt nooit
- Automatische token vernieuwing bij elke API call
- `/api/dropbox/auth` — OAuth flow starten
- `/api/dropbox/callback` — refresh token ontvangen
- `lib/dropbox.ts` — token management met in-memory cache

### Deployment notificaties verbeterd
- Notificatie vanuit client — betrouwbaar over serverless instances
- SHA-based deployment matching — juiste deployment gevonden
- `/api/push/send` — apart endpoint voor push vanuit client

### Dark mode CSS variabelen
- `layout.tsx` — globale CSS variabelen (`--bg`, `--card`, `--border` etc.)
- Toggle in home zet `data-theme` op `<html>` → hele app donker
- Geen flicker bij laden — theme geladen voor eerste render
- Consistent over alle pagina's

### Lege selectie als standaard
- Selecteer modus start nu leeg
- "Alles aan" knop voor snelle selectie van alles

### Auto-tagging verfijnd
- ZIP type bepaalt of auto-tag aangemaakt wordt
- `fix/hotfix/patch/docs/config` → geen tag
- `feature/update/refactor/release` → wel tag
- 5+ bestanden of kern bestanden → wel tag
- Max 10 tags — oudste automatisch verwijderd

---

## v1.0.158 — 27 juni 2026

### Beveiliging & betrouwbaarheid
- Projectnaam waarschuwing bij ZIP import
- Dubbele bevestiging bij bestandsverwijdering
- Deployment notificaties via Firestore deduplicatie
- Projectnaam in push notificatie

### Delete modus
- Zoekbalk bovenaan
- Geselecteerde bestanden als rode tags
- Sticky verwijder knop
- Dubbele bevestiging

### Tag herstel
- "Herstel naar deze versie" per tag
- Nieuwe commit op main — geen force push
- Tweestaps bevestiging

### Tags inklapbaar
- Herstelpunten sectie inklapbaar
- Gesorteerd op versienummer — nieuwste bovenaan

### Snelkoppeling ZIP
- ZIP knop direct op overzichtspagina

### Bestandsaantal op overzicht
- Via GitHub tree API

### Commit history relatieve datums
- "Zojuist", "5 min geleden" etc.

---

## v1.0.140 — 26 juni 2026

### Zoekfunctie selecteer modus
- Realtime filtering
- Geselecteerde bestanden als tags (map/bestand.ts)
- Sticky kopieer knop

### Content diff
- Per gewijzigd bestand in ZIP import
- Groen/rood weergave

### Commit history
- Lazy loaded, laatste 20 commits

### Snapshot structuur-only
- Snel voor grote repos
- Inhoud on-demand

---

## v1.0.110 — 25 juni 2026

### Push notificaties
- Firebase Firestore subscription
- VAPID keys
- Notificatie bij READY/ERROR

### Deployment polling
- 15 sec delay, voortgangsbalk

### Bestandsverwijdering
- 🗑 knop + ZIP import

### Herstelpunten
- Git tags aanmaken

---

## v1.0.29 — 24 juni 2026

### Core
- ZIP Import + diff engine
- Checkbox selectie
- Kopieer naar Claude
- GitHub PAT auth
