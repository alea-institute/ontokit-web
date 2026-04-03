## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-04-03 — Milestone v0.3.0 deployment started

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-03)

**Core value:** Enable grassroots-level collaborative ontology editing in a modern, accessible web interface.
**Current focus:** Deploy CatholicOS main to ALEA production

## Accumulated Context

- ALEA forks have zero unique commits on main — clean fast-forward
- Production server at 54.224.195.12 running Mike's folio-adapter (stripped auth)
- Server: Caddy + systemd, 8GB RAM, 53GB free disk, ARM64
- CatholicOS main requires Postgres for ontology index
- Auth changes needed in both ontokit-web (auth.ts, env.ts) and ontokit-api (auth middleware)
