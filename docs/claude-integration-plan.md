# CodeSync → Claude-geïntegreerde ontwikkelomgeving

**Dit document is het permanente dossier van het traject om CodeSync uit te
bouwen van een ZIP→GitHub sync-tool naar een eigen, veilige, project-aware
Claude-ontwikkelomgeving.** Alles staat hier vast: het plan, de audits, wat
al gebouwd is, hoe je het test, en wat er nog moet gebeuren — zodat we hier
altijd op terug kunnen kijken, ook in een nieuwe chat.

---

## 0. Status — laatste update: 16 augustus 2026

| Fase | Status |
|---|---|
| Architectuur-audit (bestaande CodeSync) | ✅ Afgerond |
| Technisch voorstel Claude-laag | ✅ Afgerond |
| Master Plan v1.0 | ✅ Afgerond |
| Laatste technische audit (8 correcties gevonden) | ✅ Afgerond |
| Master Plan v1.1 (correcties verwerkt) | ✅ Afgerond |
| **v1.1 Fase 1 — Fundament** | ✅ **Volledig afgerond** |
| **v1.1 Fase 2 — Claude-chat** | ✅ **Geïmplementeerd — zie v1.3 voor de definitieve architectuur (dubbel-pad)** |
| v1.1 Fase 3 — Changesets + approval + veilige GitHub-flow | 🟡 **In uitvoering (Taak B van v1.3), zie sectie 8** |
| **Master Plan v1.2 — GitHub Actions execution-laag** | ✅ **Fase 1+2 afgerond; blijft bestaan als handmatig gekozen pad (zie v1.3), Fase 3+ (codebewerking/iteratie/UI) wacht op Fase 3-oplevering** |
| **Master Plan v1.3 — Dubbel-pad chat + Fase 3-uitrol** | 🟡 **Taak A (uitvoeringskeuze) afgerond en getest; Taak B (changesets) in uitvoering** |

**v1.1 Fase 1 commits op `main`:**
- `5090d9a` (v1.0.194) — de Fase 1-code (auth, atomic commit, binary-rapportage, concurrency-check)
- `8041f4f`, `9ffee81`, `49d0a19` (v1.0.195–197) — kleine fixes tijdens productievalidatie

**v1.1 Fase 2 — status in detail:** zie sectie 4.4 voor de volledige bug-geschiedenis van de oorspronkelijke, Vercel-gebaseerde streaming-chat, en sectie 6 voor waarom en hoe dit vervangen is door GitHub Actions als uitvoeringslaag (v1.2 Fase 2). De chat draait nu betrouwbaar zonder de 10s-Vercel-limiet, ten koste van live woord-voor-woord streaming.

**Master Plan v1.2 — status:** Fase 1 (task-infrastructuur: `lib/tasks.ts` + 3 API-routes) is gebouwd, getest en gepusht. Dit is puur een leeg skelet — er wordt nog **niets** uitgevoerd via GitHub Actions. Fase 2 (GitHub Actions daadwerkelijk koppelen) wacht op een apart, expliciet akkoord.

**Volgende concrete actie:** de gebruiker test de huidige chat-versie nogmaals; afhankelijk van het resultaat wordt gekozen tussen (a) doorgaan met v1.2 Fase 2, of (b) alsnog Vercel Pro.

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

## 5. v1.1 Fase 2 — wat er is gebouwd, en de volledige buggeschiedenis

### 5.1 Wat er is gebouwd

**7 nieuwe bestanden:**
- `lib/path-validation.ts` — padvalidatie (geen `../`, geen absolute paden)
- `lib/protected-files.ts` — blocklist (`.env`, service-account-JSON, secrets, `.git/`)
- `lib/conversations.ts` — Firestore CRUD voor gesprekken/berichten
- `lib/claude-tools.ts` — de twee toegestane tools: `get_project_structure`, `get_file_contents`
- `lib/claude.ts` — Anthropic SDK-integratie, system prompt, tool-use-loop, streaming
- `app/api/claude/chat/route.ts` — hoofdroute, SSE-streaming, auth, project-scope server-side gekoppeld
- `app/projects/[slug]/chat/page.tsx` — chat-UI

**Bevestigd via 39 gesimuleerde runtime-checks** (padvalidatie, protected-files, tool-executie, auth-enforcement, project-scope-validatie) — zie `codesync-fase2-report.md`.

### 5.2 Buggeschiedenis — vervolgvragen beantwoordden het VERKEERDE onderwerp

Na livegebruik bleek: bij een tweede vraag in hetzelfde gesprek (bijv. eerst "wat doet app/page.tsx?", dan "en wat doet lib/github.ts?") bleef Claude **consequent** over het eerste onderwerp antwoorden, ook al toonde de tool-activiteit dat het juiste bestand wél was opgehaald.

**Wat er geprobeerd is, in volgorde:**
1. Firestore-index-fix in `listConversations` (loste een apart "lege chat na herladen"-probleem op, niet dit probleem)
2. ID-gebaseerde message-targeting in de client i.p.v. array-positie (goede robuustheid-verbetering, loste dit probleem niet op)
3. Systeeminstructie aangescherpt ("beantwoord de meest recente vraag") — hielp niet
4. Een "+ Nieuw gesprek"-knop toegevoegd (nodig om schone tests te kunnen doen)
5. **Doorslaggevende diagnostische test:** de gebruiker vroeg expliciet "negeer alles wat eerder besproken is, antwoord uitsluitend over lib/github.ts" — dit werkte wél correct. Dat bewees dat de data die naar Claude ging niet corrupt was, en ontkrachtte de hypothese van een message/tool-state-bug.
6. **Root cause gevonden via een Vercel-functielog:** een `Execution Duration: 10.29s / 10s` bij een fout-antwoord. De echte oorzaak: Claude schrijft soms een tekstuele samenvatting/redenering vóórdat het tools aanroept in een tussenronde van de tool-loop. De code stuurde **elke** tekst-chunk uit **elke** ronde direct door naar de client — dus als de échte, laatste ronde (met het juiste antwoord) werd afgekapt door de Vercel-tijdslimiet, zag de gebruiker alleen die misleidende tussentekst.

**De uiteindelijke fix (structureel, niet prompt-based):** tekst wordt nu per ronde gebufferd in `lib/claude.ts`, en pas naar de client gestuurd zodra bevestigd is dat die ronde de laatste is (`stop_reason !== "tool_use"`). Tekst uit een tussenronde wordt nooit meer getoond.

**Aanvullende maatregelen tegen de Vercel Hobby-tijdslimiet zelf:**
- `alreadySeenPaths` — al eerder opgehaalde bestanden worden in de system prompt vermeld, zodat Claude ze niet onnodig opnieuw opvraagt
- `max_tokens` verlaagd van 4096 naar 1024
- Expliciete instructie om beknopt te antwoorden
- Tijdsbudget (`MAX_TOTAL_MS`) verlaagd naar 6s als extra marge
- Client toont nu een duidelijke "niet volledig afgerond"-melding als de stream eindigt zonder `done`-event, i.p.v. een stille lege bubbel

### 5.3 Resultaat: logica correct, betrouwbaarheid nog niet goed genoeg

Ook ná al deze maatregelen bleef een timeout optreden, zelfs bij een simpele eerste vraag. **Conclusie: dit is geen bug meer, maar een harde Vercel Hobby-infrastructuurlimiet (~10s).** Verdere prompt-tweaks hebben weinig zin — de volgende stappen zijn ofwel Vercel Pro (60s-limiet), ofwel de v1.2-route (GitHub Actions als execution-laag, zie sectie 7).

### 5.4 Zijstapje: Dropbox-bestandsnamen met een punt

Tijdens het testen van v1.2 Fase 1 bleek dat een ZIP-bestandsnaam met een extra punt erin (`codesync-fase1.2.zip`, bedoeld als versienummer) via de iOS-deelfunctie naar Dropbox zijn `.zip`-extensie verloor (werd opgeslagen als `codesync-fase1.2` zonder extensie). CodeSync's wachtrij filtert strikt op `.zip`, dus het bestand werd terecht genegeerd — geen bug in de app. **Vanaf nu: geen extra punten in ZIP-bestandsnamen**, alleen de punt vóór `.zip` zelf.

---

## 6. Master Plan v1.2 — GitHub Actions als execution-laag

**Aanleiding:** de Vercel Hobby-tijdslimiet (sectie 5.3) bleek na uitputtend proberen niet met code/prompt-aanpassingen op te lossen. Een extern voorstel (via GPT) stelde GitHub Actions voor als execution-laag — maar vermengde ongemerkt twee losse problemen: uitvoeringstijd én schrijftoegang (`write_files`, `run_command`, een automatische wijzig-test-fix-loop zonder duidelijk goedkeuringsmoment). Dat werd expliciet gecorrigeerd vóórdat er iets gebouwd werd.

**De harde scheiding (niet-onderhandelbaar, zoals bij elke eerdere fase):**

```
Claude → CodeSync → Task aanmaken → GitHub Actions →
tijdelijke/geïsoleerde omgeving → testen/uitvoeren → resultaat →
jij beoordeelt → jij keurt goed → changeset → commit naar echte repo
```

**Nooit:** `Claude → GitHub Actions → direct commit naar repo`. GitHub Actions is uitsluitend een execution worker — repository-mutaties blijven altijd via het bestaande (nog te bouwen) changeset+approval-model van v1.1 Fase 3 lopen.

**v1.2 Fase 1 — task-infrastructuur (✅ gebouwd en gepusht):**
- `lib/tasks.ts` — Firestore-model: `queued → running → completed/failed/cancelled`
- `POST /api/tasks`, `GET /api/tasks`, `GET /api/tasks/:id`
- Geeft **direct** een task ID terug, wacht nergens op — Vercel-requests blijven kort
- Er wordt in Fase 1 nog **niets** uitgevoerd — geen GitHub Actions-aanroep, geen `write_files`, geen `run_command`
- Bevestigd via 8 gesimuleerde runtime-checks (auth-enforcement + validatielogica op alle 3 routes, plus een Firestore-grensbevestiging)

**v1.2 Fase 2 — GitHub Actions daadwerkelijk koppelen (✅ Gebouwd en gepusht — 14 augustus 2026):**
- `lib/tasks.ts` uitgebreid met task-type `"chat"`
- `scripts/run-chat-task.ts` — standalone script, hergebruikt `lib/claude.ts`/`lib/claude-tools.ts` ongewijzigd
- `.github/workflows/claude-chat-task.yml` — `workflow_dispatch`-workflow, `permissions: contents: read` (geen schrijftoegang), 5 minuten timeout
- `POST /api/tasks` triggert de workflow bij `type: "chat"`
- Chat-UI omgebouwd van SSE-streaming naar polling (`GET /api/tasks/:id` elke 2s, max. 2 minuten)
- **Trade-off, bewust geaccepteerd:** geen live woord-voor-woord streaming meer — "Claude is aan het werk…" totdat het volledige antwoord binnen is. In ruil: geen Vercel-tijdslimiet meer relevant (GitHub Actions: 5 minuten marge i.p.v. 10 seconden)
- **Technisch geverifieerd vóór implementatie:** de volledige importketen (`runClaudeTurn`, `executeClaudeTool`, en alle onderliggende `@/lib/...`-aliassen) is met een echte `tsx`-uitvoering getest buiten Next.js om — bevestigd dat alles correct resolvet en uitvoerbaar is in een kale Node-omgeving zoals GitHub Actions

**Operationele lessen tijdens het uitrollen van Fase 2:**
- **Dot-mappen (`.github/`, en vermoedelijk andere) worden niet betrouwbaar meegenomen door de ZIP→Dropbox→Working Copy-keten.** Zulke bestanden (bijv. workflow-YAML's) moeten voorlopig handmatig aangemaakt en geplakt worden — niet via de normale ZIP-import.
- **Firestore-bug gevonden en gefixt:** `toolActivity` werd bij afwezigheid op `undefined` gezet i.p.v. weggelaten — Firestore's Admin SDK weigert `undefined`-waarden. Trad specifiek op bij chatvragen zonder tool-gebruik (bijv. een meta-vraag over het gesprek zelf). Gefixt met een conditionele spread i.p.v. een ternary-naar-undefined, op beide plekken waar dit patroon voorkwam.

**v1.2 Fase 3 t/m 5 — nog niet gestart, elk wacht op een apart, expliciet akkoord:**
3. Codebewerking door Claude binnen de execution-omgeving (valt samen met v1.1 Fase 3 — changeset+approval)
4. Iteratieve AI-loop (wijzig → test → fix → hertest), met een vaste `MAX_ITERATIONS`-limiet
5. UI voor taakstatus (Queued/Running/Completed met deelresultaten)

**Wat GitHub Actions, ook in latere fases, nooit mag:** rechtstreeks committen/pushen/mergen, het changeset+approval-model omzeilen, onbeperkte `run_command` (altijd een vaste whitelist), secrets in taakresultaten/logs.

---

## 8. Master Plan v1.3 — Dubbel-pad chat + definitieve Fase 3-uitrol

### 8.1 Aanleiding

Na v1.2 Fase 2 (chat volledig via GitHub Actions) bleek uit gebruikersfeedback dat elke vraag 20-40s kostte, ook simpele. Een reeks metingen en overwogen architecturen volgde:

1. **Self-hosted GitHub Actions runner** — zou de ~20-25s provisioning-overhead wegnemen, maar **afgewezen**: vereist een permanent te beheren apparaat (beveiliging, onderhoud, uptime) — past niet bij hoe deze gebruiker werkt (iPhone-first, geen serverbeheer).
2. **Hybride Vercel→Actions-fallback** ("probeer eerst snel, val na X seconden automatisch terug") — **afgewezen**: onnodige complexiteit, risico op race conditions/dubbele uitvoering.
3. **Chat terug naar directe Vercel-streaming** — gekozen als eerste stap, met Vercel Hobby's 10s-limiet als geaccepteerd risico.

### 8.2 Definitief bewijs: Anthropic's eigen generatietijd is de bottleneck, niet GitHub

Na de revert naar Vercel bleken 3 van de 3 identieke tool-vragen te mislukken (niet "soms", structureel). Gerichte timing-instrumentatie in `lib/claude.ts`/`app/api/claude/chat/route.ts` (console-logs, zichtbaar via Vercel → Logs) leverde het definitieve antwoord:

```
Auth + Firestore-setup:  1.201-1.635ms
Ronde 1 (tools):         ~1.595-1.640ms
Ronde 2 (Anthropic genereert het antwoord): ≥6.308-6.749ms — NIET afgerond, Vercel killt hier
```

**Conclusie:** de bottleneck is Anthropic's eigen antwoordgeneratie in de laatste ronde — niet GitHub-tool-tijd (dus een "CodeSync Mirror"/cache-laag zou hier niet geholpen hebben), en niet "Claude heeft een tussenstop nodig" (dus automatische "Continu"-detectie was ook niet de oplossing — dat is sowieso een Claude.ai-**interface**-verschijnsel, niet iets dat op kale Anthropic-API-niveau bestaat).

**Wel uitgevoerd: Firestore-optimalisatie.** `appendMessage()` deed 3 sequentiële round-trips (add → get → update) voor het opslaan van één bericht; de tussenliggende `get()` was overbodig (de aanroeper weet al of het 't eerste bericht is). Nu: 1 parallelle operatie. Route ook aangepast: `getConversation`+`getMessages` parallel bij een bestaand gesprek. Resultaat: auth+Firestore-tijd daalde van 1.635ms naar 1.201ms (~27%) — een echte, meetbare winst, maar raakt niet aan de eigenlijke bottleneck (Anthropic zelf).

### 8.3 Definitieve architectuurbeslissing: dubbel-pad, gebruiker kiest

Geen automatische fallback (bewust, zie 8.1 punt 2). In plaats daarvan: **twee bestaande, elk-apart-geteste paden, met een zichtbare keuze in de UI.**

```
CodeSync Chat
     │
     ├── ⚡ Normaal (standaard) → Vercel-streaming, snel, kan bij
     │                              zware tool-vragen falen (Hobby-limiet)
     │
     └── 🐢 GitHub Actions       → task+poll, 20-40s, betrouwbaar
                                     ook bij zware tool-vragen
```

**Bij Vercel Pro (toekomstig, nog niet aangeschaft):** "Normaal" wordt de facto altijd betrouwbaar genoeg (60s-marge), GitHub Actions blijft daarna gereserveerd voor écht langdurige taken (tests/builds/lint), niet meer als workaround voor de huidige limiet.

### 8.4 Taak A — Uitvoeringskeuze (✅ Geïmplementeerd, getest, bevestigd werkend)

- `app/projects/[slug]/chat/page.tsx`: `sendMessage()` opgesplitst in `sendViaVercel()` (bestaand streaming-pad) en `sendViaActions()` (bestaand task/poll-pad, hergebruikt ongewijzigd) — een keuzeschakelaar (⚡ Normaal / 🐢 GitHub Actions) bepaalt welke wordt aangeroepen. Geen nieuwe backend-logica — puur de twee al-geteste paden weer expliciet naast elkaar beschikbaar gemaakt.
- **Bugfix tijdens het testen:** bij "Normaal" kon de client oneindig blijven hangen als de Vercel-verbinding vastliep zonder netjes te sluiten (geen `done`-event, maar ook geen `reader.read()`-afronding) — de foutmelding verscheen dan nooit. Opgelost met een `AbortController`-watchdog: bij 15s zonder enig teken van leven breekt de client zelf actief af.
- **UX-verbetering:** geanimeerde "typende stippen"-indicator + duidelijke tekstregel ("Claude denkt na…" / bij Actions: uitleg dat het langer duurt) i.p.v. een onduidelijk, statisch bolletje.
- **Productiebevestiging (16 augustus 2026):** "Normaal" — binnen 5s, geen fout. "GitHub Actions" — ~20s, volledig correct antwoord. Beide paden werken zoals bedoeld.

### 8.5 Taak B — Fase 3: Changesets + Approval (in uitvoering)

Zie sectie 2 (Deel B) van het oorspronkelijke v1.3-ontwerp voor het volledige plan: `prepare_changeset`-tool, changeset-datamodel, approval-routes met server-side re-validatie, atomaire Firestore-claim, hergebruik van `batchCommit()` en de bestaande review-UI. De 6 security-audit-bevindingen (atomaire transactie, path/protected-files-validatie op alle 3 acties, server-side re-validatie bij approval, idempotentie, groottelimiet, mens blijft inhoudscontrole) zijn vastgesteld en worden tijdens implementatie verwerkt.

**Pre-build check (16 augustus 2026, vóór implementatie):** bevestigd dat alle herbruikbare onderdelen (Claude-tools-structuur, `batchCommit()` met `deletePaths`/`expectedBaseSha`, tasks-infrastructuur) intact en zoals verwacht aanwezig zijn. Geen changeset-logica bestaat nog — volledig nieuw te bouwen, zoals gepland.

---

## 9. Waarom dit document bestaat

Dit bestand is het permanente geheugen van dit traject — los van welke Claude-chat je opent. Bij een nieuwe sessie: dit document delen (via "Kopieer naar Claude" of gewoon dit bestand tonen) geeft direct de volledige context: het plan, wat al gebouwd en getest is, en wat de volgende afgebakende stap is.
