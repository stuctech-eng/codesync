# CodeSync — Changelog

## Fase 2 + v1.2 Fase 1 — 14 augustus 2026

Onderdeel van het traject naar een Claude-geïntegreerde ontwikkelomgeving.
Zie [docs/claude-integration-plan.md](claude-integration-plan.md) voor het
volledige plan, de volledige buggeschiedenis, en de teststappen.

### Claude-chat (v1.1 Fase 2)
- Nieuwe chat-UI per project (`/projects/[slug]/chat`) met streaming, tool-activiteit-indicatoren, en conversation persistence in Firestore
- Twee read-only tools: `get_project_structure`, `get_file_contents` — géén schrijftoegang, géén commando-uitvoering
- Padvalidatie + protected-files-blokkade (`.env`, service-account-JSON, etc.) op code-niveau
- **Bugfix:** vervolgvragen beantwoordden soms het verkeerde (vorige) onderwerp — root cause: voorlopige Claude-tekst uit een tussenronde van de tool-loop werd als eindantwoord getoond. Tekst wordt nu per ronde gebufferd, pas getoond als de ronde bevestigd de laatste is
- **Bekende beperking:** Vercel Hobby's ~10s-functielimiet zorgt nog regelmatig voor afgebroken antwoorden bij vervolgvragen, ondanks meerdere optimalisaties (kortere antwoorden, minder herhaald bestanden ophalen, tijdsbudget). Dit is een infrastructuurlimiet, geen bug — vervolgstap is Vercel Pro of de v1.2-route hieronder

### Task-infrastructuur (Master Plan v1.2, Fase 1)
- Nieuw: `lib/tasks.ts`, `POST/GET /api/tasks`, `GET /api/tasks/:id`
- Voorbereiding op GitHub Actions als execution-laag (tegen de Vercel-tijdslimiet), met een expliciete, harde scheiding tussen "code uitvoeren" (GitHub Actions) en "repository wijzigen" (blijft via het bestaande changeset+approval-model — nog niet gebouwd)
- Fase 1 voert nog niets uit — puur het task-datamodel en de API

---

## Fase 1 (klaar, wacht op productiecheck vóór push) — 13 augustus 2026

Onderdeel van het traject naar een Claude-geïntegreerde ontwikkelomgeving.
Zie [docs/claude-integration-plan.md](claude-integration-plan.md) voor het
volledige plan, de audit-geschiedenis en de teststappen.

### Security
- Dropbox refresh/access token niet meer in HTTP-responses of logs — nu opgeslagen in Firestore
- Tokenfragment uit foutmelding van `/api/dropbox/list` verwijderd
- `X-CodeSync-Key`-authenticatie op alle API-routes (fail-closed), met een nieuw eenmalig-invoerscherm (`AccessGate`) dat de sleutel in `localStorage` bewaart — nooit in de build-bundle

### GitHub sync
- `batchCommit()` is nu atomic: nieuwe/gewijzigde/verwijderde bestanden in één tree + één commit, i.p.v. verwijderen los van committen
- Verwijderingen gebruiken correct `sha: null` in de Git tree (niet simpelweg weglaten — dat verwijdert niets bij gebruik van `base_tree`)
- Concurrency-bescherming: een push wordt geweigerd (HTTP 409) als GitHub is gewijzigd sinds de laatste diff

### Import
- Binaire/onleesbare bestanden bij ZIP-import worden nu expliciet gerapporteerd i.p.v. stilzwijgend overgeslagen

---

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
