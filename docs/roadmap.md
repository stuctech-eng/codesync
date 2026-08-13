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

### Fase 1 — Fundament (✅ Geïmplementeerd + gevalideerd, wacht op productiecheck vóór push)
- [x] Dropbox-tokenlekken gedicht
- [x] Auth op alle API-routes (`X-CodeSync-Key` + `AccessGate`)
- [x] Atomic `batchCommit` (`sha: null` voor deletes) + concurrency-check
- [x] Binary-import rapportage
- [x] TypeScript-check + 22 gesimuleerde runtime-checks — alle geslaagd
- [ ] Productiecheck door gebruiker (8 stappen, zie plan-document)
- [ ] Commit/push

### Fase 2 — Claude-laag core (Gepland, nog niet gestart)
- [ ] Anthropic API-route met streaming + tool-use-loop
- [ ] Chat-UI per project
- [ ] Conversation persistence (Firestore)
- [ ] Tools: `get_project_structure`, `get_file_contents` — **geen** schrijftoegang

### Fase 3 — Changesets + approval (Gepland, na Fase 2)
- [ ] `prepare_changeset`-tool
- [ ] Approval-flow (atomaire Firestore-claim + concurrency-check)
- [ ] Protected files-blokkade
- [ ] Hergebruik van de bestaande review-UI voor changeset-diffs
