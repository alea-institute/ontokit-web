# Requirements: OntoKit Web — v0.3.0 Deployment

**Defined:** 2026-04-03
**Core Value:** Enable grassroots-level collaborative ontology editing in a modern, accessible web interface.

## v0.3.0 Requirements

### Sync

- [ ] **SYNC-01**: ALEA ontokit-web main is fast-forwarded to CatholicOS main
- [ ] **SYNC-02**: ALEA ontokit-api main is fast-forwarded to CatholicOS main

### Auth

- [x] **AUTH-01**: App runs without Zitadel when `AUTH_DISABLED=true` env var is set
- [x] **AUTH-02**: Unauthenticated users can browse projects, classes, and ontology tree in read-only mode
- [x] **AUTH-03**: Edit/commit/PR features are hidden when auth is disabled
- [x] **AUTH-04**: Existing Zitadel-based auth continues working when `AUTH_DISABLED` is unset or false
- [x] **AUTH-05**: API accepts requests without Bearer tokens when auth is disabled

### Deploy

- [ ] **DEPL-01**: PostgreSQL installed and running on production server
- [ ] **DEPL-02**: Production server runs CatholicOS main (not folio-adapter) for both repos
- [ ] **DEPL-03**: Ontology index is built and serving queries on production
- [ ] **DEPL-04**: ontokit.openlegalstandard.org serves the FOLIO ontology browser from CatholicOS main
- [ ] **DEPL-05**: Caddy, systemd services, and env vars are configured for the full stack

### Anonymous Suggestions

- [ ] **ANON-01**: Anonymous visitor sees "Suggest Changes" button on ClassDetailPanel for public projects when AUTH_MODE != required
- [x] **ANON-02**: Anonymous visitor can enter suggestion edit mode, modify class data, and submit without signing in
- [x] **ANON-03**: After submitting, user is prompted "Want credit for your suggestions?" with optional name and email fields
- [x] **ANON-04**: Suggestion API accepts anonymous suggestion sessions (no Bearer token required when AUTH_MODE != required)
- [x] **ANON-05**: Suggestion review page shows submitter name/email if provided, or "Anonymous" if not
- [ ] **ANON-06**: Signed-in users with editor+ role bypass suggestion flow (existing "Edit Item" behavior unchanged)
- [ ] **ANON-07**: When Zitadel/OAuth is configured, "Sign in for full editing" link appears alongside the Suggest button

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
| AUTH-02 | Phase 8 | Complete |
| AUTH-03 | Phase 8 | Complete |
| AUTH-04 | Phase 8 | Complete |
| AUTH-05 | Phase 8 | Complete |
| DEPL-01 | Phase 9 | Pending |
| DEPL-02 | Phase 9 | Pending |
| DEPL-03 | Phase 9 | Pending |
| DEPL-04 | Phase 9 | Pending |
| DEPL-05 | Phase 9 | Pending |
| ANON-01 | Phase 10 | Pending |
| ANON-02 | Phase 10 | Complete |
| ANON-03 | Phase 10 | Complete |
| ANON-04 | Phase 10 | Complete |
| ANON-05 | Phase 10 | Complete |
| ANON-06 | Phase 10 | Pending |
| ANON-07 | Phase 10 | Pending |

**Coverage:**
- v0.3.0 requirements: 19 total
- Mapped to phases: 19
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-03*
*Last updated: 2026-04-03 — Roadmap created, traceability confirmed*
