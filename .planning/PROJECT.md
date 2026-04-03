# OntoKit Web

## What This Is

A Next.js frontend for collaborative OWL ontology editing. Connects to a FastAPI backend (ontokit-api) for ontology operations. Used by both CatholicOS (Catholic Semantic Canon) and ALEA (FOLIO — Free Open Legal Information Ontology).

## Core Value

Enable grassroots-level collaborative ontology editing in a modern, accessible web interface.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. Phases 1-6 from prior work. -->

- ✓ Two-mode editor (standard + developer) — v0.2.0
- ✓ Auto-save with draft system — v0.2.0
- ✓ Form-based class editing with Turtle source save — v0.2.0
- ✓ Suggestion workflow for non-editors — v0.2.0
- ✓ Graph visualization (ReactFlow + ELK) — v0.2.0
- ✓ Keyboard shortcuts and accessibility — v0.2.0
- ✓ PostgreSQL ontology index frontend — v0.3.0-dev
- ✓ Upstream source tracking with loop prevention — v0.3.0-dev
- ✓ Projects landing page with tabs — v0.3.0-dev

### Active

<!-- Current scope — Milestone v0.3.0 deployment. -->

- [ ] Sync ALEA forks with CatholicOS upstream
- [ ] Make authentication optional for public read-only browsing
- [ ] Deploy CatholicOS main to production (ontokit.openlegalstandard.org)

### Out of Scope

- Full Zitadel deployment on FOLIO server — FOLIO needs read-only public access, not multi-user auth (yet)
- Docker-based deployment — production server runs bare metal with systemd, working well
- Mike's folio-adapter branches — temporary hack, CatholicOS main is the long-term path

## Context

- Production server: AWS Ubuntu 24.04 ARM64 at 54.224.195.12
- Currently running Mike's `feature/folio-adapter` branches (stripped auth, lightweight FOLIO adapter)
- CatholicOS upstream has ~30 commits ahead of ALEA (all v0.3.0 PRs we just merged)
- Server has Caddy + systemd, no Docker, no Postgres/Redis/Zitadel
- CatholicOS main requires Postgres (ontology index) and optionally Redis/Zitadel
- Two repos to sync: ontokit-web (alea-institute → CatholicOS) and ontokit-api (same)

## Constraints

- **Infrastructure**: Server is bare metal, no Docker — install services directly
- **Auth**: FOLIO needs public read-only access without Zitadel — auth must be optional
- **Backwards compat**: CatholicOS deployments with Zitadel must continue working
- **Downtime**: Minimize production downtime during switchover
- **Two repos**: Both ontokit-web and ontokit-api must be synced and deployed together

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| CatholicOS main is long-term truth | Mike's folio-adapter was a deadline hack | — Pending |
| Make auth optional via env var | Avoids maintaining two codebases | — Pending |
| Bare metal deploy (no Docker) | Server already set up this way, working fine | — Pending |

---
*Last updated: 2026-04-03 after milestone v0.3.0 deployment start*
