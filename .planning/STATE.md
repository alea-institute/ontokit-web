---
gsd_state_version: 1.0
milestone: v0.2
milestone_name: milestone
status: planning
stopped_at: Completed 08-02-PLAN.md
last_updated: "2026-04-03T16:23:01.929Z"
last_activity: "2026-04-03 — Completed quick task 260403-dth: Phase 7 Sync ALEA Forks"
progress:
  total_phases: 3
  completed_phases: 1
  total_plans: 2
  completed_plans: 2
  percent: 50
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-03)

**Core value:** Enable grassroots-level collaborative ontology editing in a modern, accessible web interface.
**Current focus:** Phase 8 — Optional Auth

## Current Position

Phase: 8 of 9 (Optional Auth)
Plan: — of — in current phase
Status: Ready to plan
Last activity: 2026-04-03 — Completed quick task 260403-dth: Phase 7 Sync ALEA Forks

Progress: [█████░░░░░] 50%

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
| Phase 08-optional-auth P01 | 4min | 2 tasks | 3 files |
| Phase 08-optional-auth P02 | 284 | 4 tasks | 9 files |

## Accumulated Context

### Decisions

- [v0.3.0]: CatholicOS main is long-term truth — Mike's folio-adapter was a deadline hack
- [v0.3.0]: Auth optional via `AUTH_DISABLED` env var — avoids maintaining two codebases
- [v0.3.0]: Bare metal deploy (no Docker) — server already set up this way, working fine
- [Phase 08-optional-auth]: AUTH_MODE=optional leaves RequiredUser 401ing — no code change needed for write protection
- [Phase 08-optional-auth]: ANONYMOUS_USER has roles=['viewer'] for least-privilege unauthenticated access
- [Phase 08-optional-auth]: AUTH_MODE env var gates Zitadel OIDC — optional/disabled modes enable anonymous browsing
- [Phase 08-optional-auth]: NEXT_PUBLIC_AUTH_MODE and NEXT_PUBLIC_ZITADEL_CONFIGURED expose auth mode to client via next.config.ts
- [Phase 08-optional-auth]: Sign-in UI completely hidden when Zitadel unconfigured — graceful degradation for FOLIO without auth

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

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260403-dth | Phase 7: Sync ALEA forks with CatholicOS main | 2026-04-03 | fbec037 | [260403-dth-phase-7-sync-alea-forks-with-catholicos-](./quick/260403-dth-phase-7-sync-alea-forks-with-catholicos-/) |

## Session Continuity

Last session: 2026-04-03T16:23:01.928Z
Stopped at: Completed 08-02-PLAN.md
Resume file: None
