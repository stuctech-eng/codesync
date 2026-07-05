# CodeSync — Changelog

## v1.0.177 (eerstvolgende push) — dark mode leesbaarheidsfixes

### Project detailpagina — contrastfixes in dark mode
- "🔖 Maak herstelpunt" tekst was onzichtbaar (hardcoded donkere tekstkleur) → nu `var(--title)`
- Geselecteerde bestandsnaam in ✂ Selecteer-scherm was onzichtbaar → nu `var(--title)`
- Disabled sticky knoppen (kopieer/verwijder) hadden hardcoded lichte achtergrond → nu `var(--border)` + `var(--muted)`
- 8x hardcoded lichte divider-lijnen (`#f2f2f7`) tussen rijen → vervangen door `var(--divider)`

---

## v1.0.173–176 — 5 juli 2026

### Project detailpagina — copy & UX
- Snapshot-copy knop (📋) verplaatst van naast "✂ Selecteer" naar naast "Bekijk bestanden"
- Snapshot-copy vereenvoudigd: kopieert nu **alleen de boomstructuur** (geen bestandsinhoud, geen stack-regel, geen key files lijst meer)
- Commit history: nieuwe copy-knop — laadt commits automatisch (indien nog niet geladen) en kopieert sha + bericht + datum + auteur van elke commit naar het klembord
- ✂ Selecteer blijft ongewijzigd: volledige bestandsinhoud van handmatig gekozen bestanden

### Homepage
- **Bugfix:** dark mode werd gereset bij navigatie — homepage had een eigen, losstaande theme-implementatie i.p.v. de gedeelde CSS-variabelen; nu geharmoniseerd met de rest van de app
- Laatst gebruikte repo (o.b.v. laatste commit-datum) staat nu bovenaan binnen ACTIVE
- Dode, dubbele `loadQueues()` functie verwijderd (technische schuld)

### API
- `/api/health` geeft nu ook `lastCommitDate` per project terug
- `lib/github.ts`: nieuwe `getLastCommit()` functie

---

## v1.0.180+ — 29 juni 2026

### Binaire bestanden zichtbaar in file tree
- PNG, JPG en andere binaire bestanden nu zichtbaar in structuur
- 🖼 icoon + "(binair)" label in selecteer modus
- Niet selecteerbaar voor "Kopieer naar Claude"
- `public/exercises/` en andere asset mappen nu volledig zichtbaar

### Polder project toegevoegd
- `stuctech-eng/polder` toegevoegd als ACTIVE project

### Dropbox auto-delete bij geen wijzigingen
- Als diff geen wijzigingen toont → ZIP automatisch verwijderd uit Dropbox
- Melding: "✓ ZIP verwijderd uit Dropbox"

### Deployment polling delay verhoogd
- 15 seconden → 30 seconden
- Betrouwbaarder — Vercel heeft meer tijd om nieuwe build te starten

### Vercel webhook endpoint
- `/api/vercel/webhook` aangemaakt (voor toekomstig gebruik)
- Vereist Vercel Pro plan voor activatie

---

## v1.0.170 — 28 juni 2026

### Dropbox integratie (V3 Queue systeem)
- Centrale ZIP opslag in Dropbox → `CodeSyncApp/`
- Automatische project routing op ZIP naam prefix
- Wachtrij per project op overzichtspagina
- Fix ZIPs krijgen prioriteit
- Na succesvolle push → ZIP automatisch verwijderd
- Bij mislukte push → ZIP blijft in wachtrij

### Dropbox OAuth2
- Permanente refresh token — verloopt nooit
- Automatische token vernieuwing
- `/api/dropbox/auth` + `/api/dropbox/callback`

### Dark mode CSS variabelen
- Globale CSS variabelen via layout.tsx
- Persistent via localStorage
- Geen flicker bij laden

### Lege selectie als standaard
- Selecteer modus start leeg

---

## v1.0.158 — 27 juni 2026

### Beveiliging
- Projectnaam waarschuwing bij ZIP import
- Dubbele bevestiging bij verwijderen
- Tag herstel via CodeSync

### UI verbeteringen
- Zoekbalk + tags + sticky knoppen overal
- Commit history relatieve datums
- Tags inklapbaar + gesorteerd

---

## v1.0.110 — 25 juni 2026

### Push notificaties
- Firebase Firestore subscription
- Notificatie bij READY/ERROR

### Deployment polling
- Voortgangsbalk
- SHA-based matching

### Bestandsverwijdering + Herstelpunten
- 🗑 knop + Git tags

---

## v1.0.29 — 24 juni 2026

### Core
- ZIP Import + diff engine
- Kopieer naar Claude
- GitHub PAT auth
