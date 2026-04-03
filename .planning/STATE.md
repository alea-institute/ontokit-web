# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-03)

**Core value:** Enable grassroots-level collaborative ontology editing in a modern, accessible web interface.
**Current focus:** Phase 7 — Sync ALEA Forks

## Current Position

Phase: 7 of 9 (Sync ALEA Forks)
Plan: — of — in current phase
Status: Ready to plan
Last activity: 2026-04-03 — Roadmap created for v0.3.0 deployment milestone

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0 (this milestone)
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

*Updated after each plan completion*

## Accumulated Context

### Decisions

- [v0.3.0]: CatholicOS main is long-term truth — Mike's folio-adapter was a deadline hack
- [v0.3.0]: Auth optional via `AUTH_DISABLED` env var — avoids maintaining two codebases
- [v0.3.0]: Bare metal deploy (no Docker) — server already set up this way, working fine

### Key Facts

- ALEA forks have zero unique commits on main — clean fast-forward, no conflicts expected
- Production server: 54.224.195.12, Ubuntu 24.04 ARM64, Caddy + systemd, 8GB RAM, 53GB disk
- Currently running Mike's folio-adapter branches (stripped auth) — must switch to CatholicOS main
- Auth changes needed in: ontokit-web (auth.ts, env.ts) AND ontokit-api (auth middleware)
- Phase 7 is trivial (~2 min git ops); Phase 8 is code changes in two repos; Phase 9 is SSH ops work

### Pending Todos

None.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-04-03
Stopped at: Roadmap created, ready to plan Phase 7
Resume file: None
