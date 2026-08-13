# CodeSync → Claude-geïntegreerde ontwikkelomgeving

**Dit document is het permanente dossier van het traject om CodeSync uit te
bouwen van een ZIP→GitHub sync-tool naar een eigen, veilige, project-aware
Claude-ontwikkelomgeving.** Alles staat hier vast: het plan, de audits, wat
al gebouwd is, hoe je het test, en wat er nog moet gebeuren — zodat we hier
altijd op terug kunnen kijken, ook in een nieuwe chat.

---

## 0. Status — laatste update: 13 augustus 2026

| Fase | Status |
|---|---|
| Architectuur-audit (bestaande CodeSync) | ✅ Afgerond |
| Technisch voorstel Claude-laag | ✅ Afgerond |
| Master Plan v1.0 | ✅ Afgerond |
| Laatste technische audit (8 correcties gevonden) | ✅ Afgerond |
| Master Plan v1.1 (correcties verwerkt) | ✅ Afgerond — **dit is het geldende plan** |
| **Fase 1 — Fundament (security, atomic commit, concurrency, binary-rapportage)** | ✅ Geïmplementeerd, ✅ TypeScript-check, ✅ 22/22 gesimuleerde runtime-checks, ⏳ **productievalidatie door gebruiker nog te doen** |
| Fase 1 — commit/push naar GitHub | ⏳ Wacht op productievalidatie |
| Fase 2 — Anthropic API + chat + conversation persistence | ⬜ Nog niet gestart |
| Fase 3 — Changesets + approval + veilige GitHub-flow | ⬜ Nog niet gestart |

**Volgende concrete actie:** de 7-stappen productiecheck hieronder (sectie 4) uitvoeren. Daarna pas commit/push van Fase 1.

---

## 1. Hoe we hier kwamen — chronologisch

1. **Volledige repository-audit** — alle 39 bestanden van CodeSync opgehaald en doorgelicht. Bevindingen: 2 tokenlekken (P0), sync niet atomic (P1), geen concurrency-bescherming (P1), binaire bestanden stil overgeslagen bij import (P1), geen auth op API-routes (P1), Vercel-webhook-verificatie waarschijnlijk kapot (P2).
2. **Technisch architectuurvoorstel voor de Claude-laag** — hoe de Claude-integratie architecturaal zou moeten werken: tool-gebaseerde context-ophaling, changeset+approval-model, Claude krijgt structureel geen schrijftoegang tot GitHub.
3. **Master Plan v1.0** — alles samengevoegd tot één document met architectuur, security model, tools, changesets, Firestore-schema, V1-fasering.
4. **Laatste technische audit tegen v1.0** — kritische zelfcontrole vond 8 concrete, oplosbare problemen (o.a. een technisch **onjuiste** beschrijving van hoe GitHub-bestanden verwijderd moeten worden, en een auth-sleutel-ontwerp dat zonder nadere uitwerking geen echte bescherming zou bieden).
5. **Master Plan v1.1** — alle 8 correcties verwerkt. Dit is het plan waarop nu gebouwd wordt.
6. **Fase 1 geïmplementeerd** — zie sectie 3.
7. **Fase 1 gevalideerd met gesimuleerde runtime-tests** — 22/22 checks geslaagd, inclusief de twee kritieke punten uit de laatste audit.

---

## 2. Het geldende plan — Master Plan v1.1 (volledig)

### 2.0 Doel in één zin

CodeSync wordt een eigen, veilige, project-aware Claude-ontwikkelomgeving waarin conversatie behouden blijft, Claude gecontroleerd toegang heeft tot actuele projectbestanden, wijzigingen kan analyseren en voorstellen, maar nooit zelf naar GitHub schrijft — dat blijft altijd een expliciete, menselijke handeling.

### 2.1 Kernarchitectuur

```
                              ┌──────────────┐
                              │    iPhone    │
                              └──────┬───────┘
                                     │
                                     ▼
                        ┌────────────────────────┐
                        │   CodeSync (Next.js)    │
                        │                         │
                        │  Chat UI (Fase 2)       │
                        │  Review-UI (bestaand,   │
                        │    hergebruikt voor      │
                        │    changesets, Fase 3)   │
                        │  Project Manager        │  ← bestaand, ongewijzigd
                        └────────┬───────┬────────┘
                                 │       │
                    /api/claude/chat   /api/sync (Fase 1: atomic + concurrency)
                                 │       │
                                 ▼       │
                        ┌───────────────┐│
                        │  Anthropic    ││
                        │  API + tools  ││
                        └───────┬───────┘│
                                 │       │
                get_project_structure    │
                get_file_contents        │
                prepare_changeset (Fase 3)│
                                 │       │
                                 ▼       ▼
                        ┌─────────────────────┐
                        │   lib/github.ts      │  ← bestaande service-laag,
                        │   (Fase 1: atomic +  │     centraal, geen fetch()
                        │    concurrency-check)│     buiten deze laag
                        └──────────┬──────────┘
                                   │
                                   ▼
                               GitHub  ← source of truth

                        ┌─────────────────────┐
                        │      Firestore       │
                        │  conversations       │  ← Fase 2
                        │  changesets          │  ← Fase 3
                        │  status-overrides    │  ← bestaand (drag&drop)
                        │  tag-notes           │  ← bestaand
                        │  dropbox-oauth-setup  │  ← Fase 1 (tijdelijke opslag)
                        │  push-subscription    │  ← bestaand
                        └─────────────────────┘
```

### 2.2 Harde architectuurprincipes (niet-onderhandelbaar)

1. **GitHub is en blijft de source of truth.**
2. **Changeset + approval-gate is de centrale veiligheidslaag.** Geen enkele wijziging bereikt GitHub zonder expliciete menselijke goedkeuring.
3. **Conversation persistence in Firestore.**
4. **Projectcontext wordt server-side gekoppeld** aan de conversatie — nooit vertrouwd als los, door Claude aan te leveren argument.
5. **Bestanden zijn data, geen instructies.**
6. **Secrets blijven uitsluitend server-side.**
7. **Commits zijn atomic + concurrency-beschermd.**
8. **Context wordt gecontroleerd opgehaald wanneer nodig — niet standaard alles vooraf.**

### 2.3 Wat Claude wel en absoluut niet mag doen

| Claude MAG | Claude MAG NIET |
|---|---|
| Projectstructuur opvragen (`get_project_structure`) | Rechtstreeks committen naar GitHub |
| Bestandsinhoud opvragen, binnen het gekoppelde project (`get_file_contents`) | Bestanden verwijderen op GitHub |
| Een wijzigingsvoorstel voorbereiden (`prepare_changeset`, Fase 3) | Branches/refs wijzigen |
| Eerdere conversatie in hetzelfde project kennen | Naar een ander project dan het gekoppelde project |
| Uitleggen wat een voorgestelde wijziging doet en waarom | Secrets/tokens uitlezen of teruggeven |
| — | `.env`, service-account-bestanden, of andere protected files lezen |
| — | Willekeurige serverfuncties aanroepen buiten de expliciete toolset |
| — | Instructies uit repository-inhoud als systeeminstructie behandelen |

Dit is een **structurele** garantie: muterende GitHub-functies worden simpelweg niet als tool aangeboden aan Claude.

### 2.4 Security model

**Secrets:**

| Secret | Waar gebruikt | Status |
|---|---|---|
| `GITHUB_PAT` | `lib/github.ts` | Server-only |
| `ANTHROPIC_API_KEY` | Fase 2: `lib/claude.ts` | Nog niet toegevoegd |
| `DROPBOX_REFRESH_TOKEN` | `lib/dropbox.ts` | Server-only, Fase 1 tokenlekken gedicht |
| `FIREBASE_SERVICE_ACCOUNT` | `lib/firebase-admin.ts` | Server-only |
| `VAPID_PRIVATE_KEY` | `lib/push.ts` | Server-only |
| `CODESYNC_ACCESS_KEY` | Fase 1: `lib/auth.ts` | **Nieuw — moet in Vercel worden ingesteld** |

**Route-authenticatie:** alle API-routes vereisen de `X-CodeSync-Key`-header, gevalideerd tegen `CODESYNC_ACCESS_KEY`. Consistent op alle routes, ook GET. De sleutel wordt **niet** in de client-bundle gebakken — de gebruiker voert 'm eenmalig in via een schermpje (`AccessGate`), waarna die in `localStorage` van het device blijft staan.

Uitzonderingen (gedocumenteerd in de code zelf): `dropbox/auth` en `dropbox/callback` (browser-redirect, geen custom-header-fetch mogelijk), en `vercel/webhook` (externe caller, eigen mechanisme).

**Protected files (Fase 3):** blocklist afgedwongen in de `get_file_contents`-tool-implementatie zelf.

**Prompt injection (Fase 2/3):** bestandsinhoud altijd als `tool_result`, nooit in de system-prompt-string geplakt.

### 2.5 Claude-laag (Fase 2)

`app/api/claude/chat/route.ts` — streaming response, tool-use-loop (max. 10 rondes + tijdsbudget per ronde), conversatie geladen/opgeslagen in Firestore.

**Tools:**
```
get_project_structure()
get_file_contents(paths: string[])       — max. 10 paden, padvalidatie, weigert protected files
prepare_changeset(...)                    — Fase 3, nog niet in Fase 2
```

Bewust **geen** `create_commit`, `delete_file`, `create_tag`, `restore_version`.

### 2.6 Conversation model (Fase 2, Firestore)

```
conversations/{id}
  ├── projectSlug, title, createdAt, updatedAt, lastMessagePreview
conversations/{id}/messages/{messageId}
  ├── role, content, toolCalls?, toolResults?, createdAt
```

Bulk-tool-resultaten (bestandsinhoud) worden **niet** permanent bewaard — alleen een referentie welke paden zijn opgevraagd.

### 2.7 Changeset + approval (Fase 3)

```
changesets/{id}
  ├── projectSlug, conversationId, baseCommitSha
  ├── status: proposed | approved | applied | rejected | stale | failed
  ├── files, diffSummary, explanation
  └── appliedCommitSha?, appliedAt?
```

Approval-flow gebruikt een Firestore-transactie (atomaire claim tegen dubbele-commit-race) en embedt het changesetId in de commit-message (idempotentie bij gedeeltelijk falen).

### 2.8 V1-fasering

**Fase 1 — Fundament** ✅ geïmplementeerd (zie sectie 3)
**Fase 2 — Claude-laag core** ⬜ Anthropic API, chat-UI, conversation persistence, alleen `get_project_structure` + `get_file_contents`
**Fase 3 — Changeset + approval** ⬜ `prepare_changeset`, approval-route, protected files

**V1.5 / later:** automatische conversatie-samenvatting, volwaardige sessie-auth, rate limiting, Firestore-retentiebeleid, Vercel webhook HMAC-fix, token/kosten-indicator.

---

## 3. Fase 1 — wat er is gebouwd

**3 nieuwe bestanden:**
- `lib/auth.ts` — server-side `X-CodeSync-Key`-check, fail-closed
- `lib/access-key.ts` — client-side sleutelopslag (`localStorage`) + `authFetch()`
- `app/components/AccessGate.tsx` — eenmalig-sleutel-invoerscherm

**23 gewijzigde bestanden**, samengevat:
- Dropbox-tokenlekken gedicht (`dropbox/callback`, `dropbox/list`) — token wordt nu in Firestore opgeslagen, **nooit** meer gelogd of in een response geplaatst
- `lib/github.ts` — `batchCommit()` nu atomic: één tree, één commit; verwijderingen via **`sha: null`** (niet weglaten — dat was de gecorrigeerde P0 uit de laatste audit); nieuwe `ConcurrencyConflictError` + `getBranchHeadSha()`
- `app/api/sync/route.ts` — gebruikt de atomic commit, vangt concurrency-conflicten af als HTTP 409
- `app/api/diff/route.ts` — geeft `baseSha` mee als concurrency-anker
- `app/api/import/route.ts` — binaire/onleesbare bestanden expliciet gerapporteerd (`skipped[]`) i.p.v. stil genegeerd
- Auth-check toegevoegd aan alle 16 overige API-routes
- Client-pagina's gebruiken nu `authFetch()` i.p.v. kale `fetch()`, plus UI voor skipped-bestanden en concurrency-conflicten

**Bewust ongewijzigd:** `lib/diff.ts`, `lib/projects.ts`, `lib/theme.ts`, `lib/firebase-admin.ts`, `lib/dropbox.ts`, `lib/push.ts`, `lib/snapshot.ts`, `app/api/vercel/webhook/route.ts`.

---

## 4. Fase 1 — teststappen

### 4.1 Al gedaan (geautomatiseerd, door Claude, vóór commit/push)

- **TypeScript-compilatie:** volledig schoon, geen type-fouten (geverifieerd dat de check ook echt fouten oppikt door bewust een testfout in te bouwen)
- **22 gesimuleerde runtime-checks**, met echte functie-aanroepen en gemockte netwerkresponses:
  - `requireAuth()` — fail-closed zonder sleutel, 401 bij verkeerde/geen sleutel, doorlaat bij juiste sleutel
  - `batchCommit()` — 1 tree-aanroep voor add+delete samen, **`sha: null` correct voor deletes**, `base_tree` bij bestaande repo, geen `base_tree`/`parents` bij een lege repo, ref via `POST` i.p.v. `PATCH` bij een lege repo
  - Concurrency-conflict — `ConcurrencyConflictError` correct gegooid, **geen enkele schrijfactie** vóór de conflict-detectie
  - `/api/import` — een echte ZIP met een echt PNG-achtig binair bestand: tekstbestanden geïmporteerd, binair bestand **niet** in `files[]` maar wel in `skipped[]`
  - Auth end-to-end op een echte route-aanroep (niet alleen de losse functie)
  - `authFetch()` — voegt de header toe uit `localStorage`, stuurt niks mee zonder opgeslagen sleutel
  - Dropbox-token — nergens in `console.log`/`console.error`-output
  - `/api/diff` — `baseSha` correct aanwezig in de response

**Resultaat: 22/22 geslaagd, 0 gefaald.** Volledig rapport: zie de eerder gedeelde `codesync-fase1-runtime-validation.md`.

### 4.2 Nog te doen — productiecheck (alleen jij kunt dit, vereist je eigen Vercel/GitHub/Dropbox)

Voer in deze volgorde uit, **vóór** commit/push:

1. **`CODESYNC_ACCESS_KEY` instellen in Vercel** — verzin een lange, willekeurige waarde (env var toevoegen aan het CodeSync-project)
2. **Deploy uitvoeren** en laten slagen
3. **AccessGate testen op iPhone:**
   - Verkeerde sleutel invoeren → moet een foutmelding geven, geen toegang
   - Juiste sleutel invoeren → CodeSync moet gewoon werken zoals voorheen
4. **Normale ZIP-push testen** (add/modify) → controleer op GitHub dat de commit er correct uitziet
5. **Delete testen** — een ZIP waarbij een bestaand bestand bewust wordt verwijderd → controleer op GitHub dat het bestand **daadwerkelijk weg is** (dit is de belangrijkste test, precies het gecorrigeerde P0-scenario)
6. **Binary-bestand testen** — een ZIP met een afbeelding erin → moet zichtbaar als "overgeslagen" worden gemeld in de review-stap, niet stil verdwijnen
7. **Concurrency-conflict testen** (als laatste, meest ingewikkeld):
   - Diff maken in CodeSync (niet meteen pushen)
   - Ondertussen, rechtstreeks op GitHub.com, een bestand in dezelfde repo wijzigen
   - Daarna in CodeSync op "Push" tikken
   - Verwacht resultaat: een duidelijke "GitHub is gewijzigd"-melding (HTTP 409), **geen overschrijving**
8. **Dropbox OAuth eenmalig controleren** — token moet in Firestore terechtkomen (`codesync/dropbox-oauth-setup`), nergens in de response of Vercel-logs zichtbaar zijn; na het overnemen naar Vercel het Firestore-document weer verwijderen

**Als alle 8 stappen slagen → Fase 1 definitief GO → commit → push.**

---

## 5. Wat NA Fase 1 komt (nog niet starten)

**Fase 2 — strikt afgebakend:** Anthropic API + chat-UI + conversation persistence + uitsluitend de tools `get_project_structure` en `get_file_contents`. **Geen** `prepare_changeset`, **geen** approval-flow, **geen** enkele vorm van GitHub-schrijftoegang vanuit Claude. Dat komt pas in Fase 3.

**Fase 3 — pas na een succesvolle, geteste Fase 2:** changesets, approval-gate, de daadwerkelijke veilige GitHub-schrijfflow vanuit een goedgekeurd voorstel.

---

## 6. Waarom dit document bestaat

Dit bestand is het permanente geheugen van dit traject — los van welke Claude-chat je opent. Bij een nieuwe sessie: dit document delen (via "Kopieer naar Claude" of gewoon dit bestand tonen) geeft direct de volledige context: het plan, wat al gebouwd en getest is, en wat de volgende afgebakende stap is.
