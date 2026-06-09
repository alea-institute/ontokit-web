---
title: OntoKit Dev Environment & Rollout Roadmap
type: roadmap
status: active
date: 2026-06-09
---

# 🗺️ OntoKit Dev Environment & Rollout Roadmap

Master index for the OntoKit work portfolio: a reusable Hetzner dev environment, then
the rollout of already-built-but-unmerged work (LLM node-expansion, entity-graph port),
the next planned feature (Phase 17), and a future architecture milestone.

Each initiative below has its own Compound Engineering plan in `docs/plans/`. This file is
the **index + sequencing + cross-cutting decisions**. It is the place to start.

> **Context:** OntoKit Web is the Next.js frontend (this repo); OntoKit API is the FastAPI
> backend (`../ontokit-api`). Several initiatives span both repos. Target upstream for PRs is
> the **CatholicOS** org (`catholicos` remote), reviewed by Fr. John D'Orazio. **Never
> self-merge CatholicOS PRs** — peer review required.

## Portfolio

| Plan | Initiative | Status | Spans | File |
|------|-----------|--------|-------|------|
| **P0** | Hetzner DEV environment (foundation) | Ready to plan | web + api + infra | [002-feat-hetzner-dev-environment-plan](2026-06-09-002-feat-hetzner-dev-environment-plan.md) |
| **P2** | Entity-graph port → PR (pipe-cleaner) | Ready, needs verify | web (+ api BFS) | [003-feat-entity-graph-port-pr-plan](2026-06-09-003-feat-entity-graph-port-pr-plan.md) |
| **P1** | LLM node-expansion rollout (6–8 PRs) | Built, unmerged | web + api | [004-feat-llm-node-expansion-rollout-plan](2026-06-09-004-feat-llm-node-expansion-rollout-plan.md) |
| **P3** | Phase 17 — Graph as entity-scoped tab | Planned, not built | web + api | [005-feat-phase-17-graph-entity-tab-plan](2026-06-09-005-feat-phase-17-graph-entity-tab-plan.md) |
| **P4** | Ontology atomization (future milestone) | Awaiting review | web + api + DB | [006-feat-ontology-atomization-milestone-plan](2026-06-09-006-feat-ontology-atomization-milestone-plan.md) |
| **H** | Branch housekeeping (small) | Anytime | web | [007-chore-branch-housekeeping-plan](2026-06-09-007-chore-branch-housekeeping-plan.md) |

## Dependency map & recommended order

```
        ┌─────────────────────────────────────────────┐
        │  P0 · Hetzner DEV environment  (FOUNDATION)  │ ← do first; unblocks all testing
        └───────────────┬─────────────────────────────┘
                        │
        ┌───────────────┼───────────────────────────┐
        ▼               ▼                           ▼
┌──────────────┐ ┌──────────────────┐     ┌───────────────────┐
│ P2 · Entity- │ │ P1 · llm-helper  │     │ P3 · Phase 17     │
│ graph port   │→│ rollout (6–8 PRs)│ ───▶│ (graph-as-tab)    │
│ (pipe-cleaner)│ │ web + api        │     │ build new         │
└──────────────┘ └──────────────────┘     └───────────────────┘
   P2 graph engine is ALSO PR-0 of P1, and the base Phase 17 builds on
                        │
        ┌───────────────┘
        ▼
┌────────────────────────────────────┐   ┌──────────────────────────┐
│ P4 · Ontology atomization          │   │ H · Housekeeping (small) │
│ (future milestone, awaiting review)│   │ ff dev, prune gone refs  │
└────────────────────────────────────┘   └──────────────────────────┘
```

**Sequence:** **P0 → P2 (pipe-cleaner) → P1 → P3**, with **P4** on a separate future track
and **H** anytime. P2 goes before P1 deliberately: it is small, low-risk, and the graph-engine
refactor it contains is a *prerequisite* for llm-helper's editor PRs — so it both validates the
new dev pipeline and unblocks P1.

## Cross-cutting decisions (resolve during P0 discuss-phase)

These inputs shape P0 and ripple into P1/P2. Current recommendations:

1. **Auth on the dev box** — recommend `AUTH_MODE=optional` (tests anonymous + sign-in flows;
   drops the 3 heaviest services — Zitadel + login + mailpit — unless flipped on). Full Zitadel
   only if OIDC flow testing is required.
2. **LLM provider for testing** — recommend a real Anthropic/OpenAI key entered **per project**
   (keys are stored Fernet-encrypted per project in the DB, never in env), or a local **Ollama**
   for zero API spend (`base_url`, no key).
3. **Compose base** — recommend hardening the api `compose.yaml` (already has api + worker +
   pgvector) over extending `compose.prod.yaml` (omits api/worker, lacks pgvector).
4. **Dev domain** — a subdomain like `dev.ontokit.openlegalstandard.org` (zone already owned)
   for clean TLS.

## Current state snapshot (2026-06-09)

- **`main` == `catholicos/main` == `origin/main`** at `fab3d28` (releasing 0.3.0). Clean; cut PRs directly off it.
- **Feature branches staged locally:** `feat/llm-node-expansion` (→ `origin/llm-helper`),
  `feat/entity-graph-port` (→ `origin/entity-graph-migration`), `feat/phase-17-graph-entity-tab`
  (off `chore/plan-phase-17`).
- **API counterpart branches** (`../ontokit-api`): `deploy/llm-helper` (use `origin/deploy/llm-helper`),
  `feat/phase-11-llm-abstraction`, `feat/phase-13-validation-suggestion-gen`.
- **At-risk local work backed up to `origin` (alea fork):** `feat/bcp47-language-picker`,
  `fix/back-to-project-preserves-selection`, `backup/nullable-index-fields-local`,
  `backup/entity-graph-{clean,merged}`, `backup/review-pr-88`. Stash tagged `stash-backup-llm-phase12`.
- **r-hart80 remote** = Fr. John D'Orazio's fork (active fix/feat branches worth reviewing later).

## How to use this roadmap

1. Start with **P0** — run `/gsd:discuss-phase` (or `/ce:plan` refinement) to lock the four
   cross-cutting decisions, then build the dev box.
2. Use the dev box to run **P2** as the pipe-cleaner, then **P1** and **P3**.
3. Revisit **P4** only after colleague review of the atomization plan.
4. Each plan file carries its own acceptance criteria, risks, and step list. Update `status:`
   frontmatter (`active` → `in-progress` → `done`) as work proceeds.
