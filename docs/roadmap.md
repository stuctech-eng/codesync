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
