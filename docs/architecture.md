# CodeSync — Architectuur

## Systeem overzicht

```
Claude (ZIP output)
        ↓
Dropbox CodeSyncApp/
        ↓
CodeSync (PWA — Next.js 15.3.6 / Vercel)
        ↓
  lib/dropbox.ts        → Dropbox OAuth2 token management
  lib/github.ts         → GitHub API (incl. getLastCommit voor sortering)
  lib/snapshot.ts       → Snapshot engine
  lib/diff.ts           → Diff engine
  lib/projects.ts       → Project registry
  lib/push.ts           → Push notificaties
  lib/firebase-admin.ts → Firebase Admin SDK
  lib/theme.ts          → Theme utilities (gedeeld door alle pagina's)
        ↓
GitHub (source of truth)
Firebase Firestore (push subscription)
Dropbox (ZIP opslag + wachtrij)
Vercel (deployment + hosting)
```

---

## Dropbox Queue Flow

```
Claude geeft ZIP (codesync-feature.zip)
        ↓
Opslaan in Dropbox → CodeSyncApp/
        ↓
CodeSync → 📥 Importeer nieuwe ZIPs
        ↓
GET /api/dropbox/list
        ↓
ZIP naam herkend → project slug bepaald
Fix ZIPs → prioriteit hoog
        ↓
Wachtrij getoond per project
        ↓
Gebruiker tikt Verwerk
        ↓
GET /api/dropbox/download → ZIP geladen
        ↓
Diff → selectie → Push
        ↓
Push geslaagd → DELETE /api/dropbox/delete
Push mislukt  → ZIP blijft in wachtrij
```

---

## Dropbox OAuth2

```
Eenmalige setup:
1. Open /api/dropbox/auth
2. Dropbox toestemming → redirect naar /api/dropbox/callback
3. Refresh token opgeslagen in Vercel als DROPBOX_REFRESH_TOKEN

Bij elke API call:
lib/dropbox.ts → getDropboxToken()
  → refresh token nog geldig? → gebruik cached access token
  → verlopen? → nieuwe access token via refresh token
  → sla op in memory cache (1 uur)
```

---

## Auto-tagging logica

```
ZIP naam analyse:
  fix/hotfix/patch/docs/config/test → geen tag
  feature/update/refactor/release   → tag

Bestandsanalyse:
  5+ bestanden gewijzigd            → tag
  lib/* of app/api/* gewijzigd + 2+ bestanden → tag

Na tag aanmaken:
  Max 10 tags → oudste verwijderd via GitHub refs API
```

---

## Dark mode

```
layout.tsx → CSS variabelen op :root en [data-theme="dark"]
script in <head> → laadt theme uit localStorage voor render
Toggle → document.documentElement.setAttribute("data-theme", mode)
localStorage → persistent tussen sessies en pagina's
```

**Belangrijk:** alle pagina's moeten de gedeelde CSS-variabelen gebruiken
(`var(--bg)`, `var(--card)`, `var(--title)`, etc.) — nooit hardcoded hex-kleuren
voor tekst/achtergrond. Homepage had hier lange tijd een eigen, losstaande
theme-implementatie (lokale `THEME`-object + `mode`-state) die niet meeschakelde
met de rest van de app; dit is opgelost door de homepage ook op de gedeelde
variabelen te laten draaien. Losse componenten met hardcoded kleuren
(bijv. `#1c1c1e` voor tekst, `#f2f2f7` voor dividers) blijven een risico —
deze zijn niet thema-bewust en kunnen onleesbaar worden in het andere thema.

---

## Laatst-gebruikt sortering (homepage)

```
GET /api/health
  → per ACTIVE project: testConnection() + getFileCount() + getLastCommit()
  → lastCommitDate meegegeven in response
        ↓
Homepage haalt /api/health op bij mount
        ↓
ACTIVE projecten gesorteerd op lastCommitDate (meest recent eerst)
  → projecten zonder commit-datum (fetch mislukt) onderaan
```

`getLastCommit(repo, branch)` in `lib/github.ts` haalt de meest recente
commit op via `GET /repos/{repo}/commits?sha={branch}&per_page=1` en
retourneert `{ sha, date }` of `null` bij een fout.

---

## Deployment notificaties

```
Push naar GitHub (commitSha terug, eerste 7 tekens)
        ↓
pollDeployment(sha) na 15 sec
        ↓
GET /api/deployment?project={slug}&sha={sha}
        ↓
Vercel API → zoek deployment op SHA (eerste 7 tekens)
        ↓
state === "READY" → client roept /api/push/send aan
state === "ERROR" → client roept /api/push/send aan
        ↓
Firebase → subscription ophalen → web-push → iPhone
```

---

## Snapshot strategie

| Type | Gebruikt voor | Snelheid |
|------|--------------|----------|
| Structuur-only | File tree, kopieer overzicht (📋 Snapshot), delete | Snel |
| Volledig met content | Diff engine bij ZIP import | Langzamer |
| On-demand per bestand | Kopieer naar Claude selectie (✂ Selecteer) | Per bestand |

De 📋 Snapshot-knop op de detailpagina gebruikt uitsluitend **structuur-only**
data — geen bestandsinhoud, geen key files lijst. Voor volledige inhoud is
✂ Selecteer de aangewezen weg.

---

## Beperkingen

- In-memory snapshot cache reset bij Vercel redeploy
- Geen rename detectie in diff engine
- Push subscription verliest verbinding bij VAPID key rotatie
- Dropbox token cache reset bij serverless instance restart (automatisch vernieuwd)
- Bestanden >500KB worden overgeslagen in snapshot
- `getLastCommit()` voegt één extra GitHub API-call per ACTIVE project toe aan `/api/health` — bij veel actieve projecten kan dit de health-check iets vertragen
