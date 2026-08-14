# CodeSync — Roadmap

## V1 — Core (✅ Afgerond — 24 juni 2026)
- [x] ZIP Import + diff engine
- [x] Batch commit naar GitHub
- [x] GitHub PAT auth

## V2 — Context & Control (✅ Afgerond — 25-26 juni 2026)
- [x] Snapshot structuur-only
- [x] Kopieer naar Claude — selectief + zoekbalk + sticky
- [x] Herstelpunten + herstel via CodeSync
- [x] Commit history
- [x] Content diff
- [x] Bestandsverwijdering
- [x] Deployment polling + push notificaties
- [x] Intelligente auto-tagging (max 10)
- [x] Projectnaam beveiliging
- [x] Dark mode CSS variabelen

## V3 — Queue systeem (✅ Afgerond — 28 juni 2026)
- [x] Dropbox OAuth2 integratie
- [x] Wachtrij per project
- [x] Auto-verwijdering na push
- [x] Binaire bestanden zichtbaar in file tree
- [x] Lege selectie als standaard

## V3.1 — UX polish & dark mode consistentie (✅ Afgerond — 5 juli 2026)
- [x] Snapshot-copy knop verplaatst naast "Bekijk bestanden"
- [x] Snapshot-copy vereenvoudigd tot pure boomstructuur (geen inhoud)
- [x] Commit history copy-knop (sha + bericht + datum, 1 tik, auto-laadt)
- [x] Laatst gebruikte repo bovenaan in ACTIVE (o.b.v. laatste commit)
- [x] Homepage dark mode bug gefixt — gedeelde CSS-variabelen i.p.v. losse theme-implementatie
- [x] Dark mode leesbaarheidsfixes — herstelpunt-knop, selectie-tekst, disabled knoppen, dividers
- [x] Dode `loadQueues` duplicaat verwijderd uit homepage

## V4 — Dashboard (Gepland)
- [ ] Home dashboard: ACTIE VEREIST / WACHTRIJ / OK
- [ ] Deployment status per project op overzicht
- [ ] Fout workflow — logs + rollback + stuur naar Claude
- [ ] Vercel webhook (Pro plan vereist)
- [ ] Rename detectie in diff engine
- [ ] Persistente snapshot cache
- [ ] Audit van resterende hardcoded kleuren (buiten detailpagina) op dark-mode consistentie

## V5 — Claude-geïntegreerde ontwikkelomgeving (In uitvoering)

Volledig plan, audit-geschiedenis en teststappen:
[docs/claude-integration-plan.md](claude-integration-plan.md)

### Fase 1 — Fundament (✅ Volledig afgerond, gecommit en gepusht — 13 augustus 2026)
- [x] Dropbox-tokenlekken gedicht
- [x] Auth op alle API-routes (`X-CodeSync-Key` + `AccessGate`)
- [x] Atomic `batchCommit` (`sha: null` voor deletes) + concurrency-check
- [x] Binary-import rapportage
- [x] TypeScript-check + 22 gesimuleerde runtime-checks — alle geslaagd
- [x] Productiecheck door gebruiker — geslaagd (AccessGate, add/modify, delete, binary)
- [x] Commit/push (`5090d9a` + fixes t/m `49d0a19`)

### Fase 2 — Claude-laag core (✅ Geïmplementeerd en gepusht — 14 augustus 2026, betrouwbaarheid nog beperkt)
- [x] Anthropic API-route met streaming + tool-use-loop
- [x] Chat-UI per project (`/projects/[slug]/chat`)
- [x] Conversation persistence (Firestore)
- [x] Tools: `get_project_structure`, `get_file_contents` — **geen** schrijftoegang
- [x] Bugfix: vervolgvragen beantwoordden het verkeerde onderwerp (tekst-buffering per tool-ronde)
- [ ] ⚠️ Bekende beperking: Vercel Hobby's 10s-limiet zorgt nog regelmatig voor afgebroken antwoorden — zie sectie 5.3 van het plan-document

### Fase 3 — Changesets + approval (Gepland, nog niet gestart)
- [ ] `prepare_changeset`-tool
- [ ] Approval-flow (atomaire Firestore-claim + concurrency-check)
- [ ] Protected files-blokkade
- [ ] Hergebruik van de bestaande review-UI voor changeset-diffs

## V6 — Master Plan v1.2: GitHub Actions als execution-laag (In uitvoering)

Aanleiding: Vercel Hobby's tijdslimiet bleek niet met code/prompts op te
lossen (zie V5 Fase 2 hierboven). Harde regel: GitHub Actions voert alleen
uit, repository-mutaties blijven via het changeset+approval-model van V5
Fase 3 lopen — nooit een directe commit vanuit Actions.

### Fase 1 — Task-infrastructuur (✅ Afgerond en gepusht — 14 augustus 2026)
- [x] `lib/tasks.ts` — Firestore task-model (`queued/running/completed/failed/cancelled`)
- [x] `POST/GET /api/tasks`, `GET /api/tasks/:id`
- [x] 8 gesimuleerde runtime-checks — alle geslaagd
- [x] Nog géén GitHub Actions-aanroep, géén `write_files`, géén `run_command`

### Fase 2 — GitHub Actions koppelen (Wacht op apart akkoord)
- [ ] `workflow_dispatch` vanuit CodeSync
- [ ] Eerste simpele commando's testen (`node --version`, `npm --version`)

### Fase 3 — Codebewerking (Wacht op apart akkoord, valt samen met V5 Fase 3)
### Fase 4 — Iteratieve AI-loop met `MAX_ITERATIONS`-limiet (Wacht op apart akkoord)
### Fase 5 — UI voor taakstatus (Wacht op apart akkoord)
