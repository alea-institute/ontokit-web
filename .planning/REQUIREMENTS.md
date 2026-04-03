# Requirements: OntoKit Web — v0.3.0 Deployment

**Defined:** 2026-04-03
**Core Value:** Enable grassroots-level collaborative ontology editing in a modern, accessible web interface.

## v0.3.0 Requirements

### Sync

- [ ] **SYNC-01**: ALEA ontokit-web main is fast-forwarded to CatholicOS main
- [ ] **SYNC-02**: ALEA ontokit-api main is fast-forwarded to CatholicOS main

### Auth

- [x] **AUTH-01**: App runs without Zitadel when `AUTH_DISABLED=true` env var is set
- [ ] **AUTH-02**: Unauthenticated users can browse projects, classes, and ontology tree in read-only mode
- [ ] **AUTH-03**: Edit/commit/PR features are hidden when auth is disabled
- [x] **AUTH-04**: Existing Zitadel-based auth continues working when `AUTH_DISABLED` is unset or false
- [x] **AUTH-05**: API accepts requests without Bearer tokens when auth is disabled

### Deploy

- [ ] **DEPL-01**: PostgreSQL installed and running on production server
- [ ] **DEPL-02**: Production server runs CatholicOS main (not folio-adapter) for both repos
- [ ] **DEPL-03**: Ontology index is built and serving queries on production
- [ ] **DEPL-04**: ontokit.openlegalstandard.org serves the FOLIO ontology browser from CatholicOS main
- [ ] **DEPL-05**: Caddy, systemd services, and env vars are configured for the full stack

## Future Requirements

### Infrastructure

- **INFRA-01**: Redis installed for background jobs and caching
- **INFRA-02**: Zitadel deployed for multi-user auth on FOLIO
- **INFRA-03**: Docker-based deployment option

## Out of Scope

| Feature | Reason |
|---------|--------|
| Merging Mike's folio-adapter branches | Temporary hack, CatholicOS main is long-term path |
| MinIO object storage | Not required for read-only FOLIO browsing |
| Full Zitadel deployment on FOLIO server | FOLIO needs public access first, auth later |
| Docker compose deployment | Server already runs bare metal with systemd |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SYNC-01 | Phase 7 | Pending |
| SYNC-02 | Phase 7 | Pending |
| AUTH-01 | Phase 8 | Complete |
| AUTH-02 | Phase 8 | Pending |
| AUTH-03 | Phase 8 | Pending |
| AUTH-04 | Phase 8 | Complete |
| AUTH-05 | Phase 8 | Complete |
| DEPL-01 | Phase 9 | Pending |
| DEPL-02 | Phase 9 | Pending |
| DEPL-03 | Phase 9 | Pending |
| DEPL-04 | Phase 9 | Pending |
| DEPL-05 | Phase 9 | Pending |

**Coverage:**
- v0.3.0 requirements: 12 total
- Mapped to phases: 12
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-03*
*Last updated: 2026-04-03 — Roadmap created, traceability confirmed*
