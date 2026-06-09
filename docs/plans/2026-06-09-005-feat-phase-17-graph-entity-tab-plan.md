---
title: Phase 17 — Graph as entity-scoped tab in detail pane
type: feat
status: active
date: 2026-06-09
---

# 📑 Phase 17 — Graph as entity-scoped tab in detail pane

Part of the [OntoKit Dev & Rollout Roadmap](2026-06-09-001-ontokit-dev-rollout-roadmap.md) — **P3, next planned feature**.

## Overview

Build the already-**planned and approved** Phase 17: move the ontology graph into an
**entity-scoped tab in the detail pane**, and migrate the Source view to the right pane. Targets
release v0.5.0. Plans are complete (GSD); this is the only fully-planned, not-yet-started phase.

## Problem Statement / Motivation

Per the approved GSD spec, the graph today is a separate view/modal; Phase 17 makes it a per-entity
tab alongside the detail panel (tab strip: Detail / Graph / …), with the Source editor relocated.
This tightens the "select entity → see its neighborhood" loop.

## Proposed Solution

Execute the existing Phase 17 plans. The branch `feat/phase-17-graph-entity-tab` already exists
(off `chore/plan-phase-17`) carrying the full planning set: `17-SPEC`, `17-UI-SPEC`, `17-RESEARCH`,
`17-PATTERNS`, `17-VALIDATION`, three PLAN files, and four HTML sketches.

## Technical Considerations

- **Cross-repo:** `17-01` is an **ontokit-api** change; `17-02`/`17-03` are ontokit-web.
- **Depends on the graph engine** (server-side BFS) being in `catholicos/dev` — i.e. **P2/P1's PR-0 must land first**.
- **UI contract:** tab strip in detail pane, modal round-trip, edge palette (from `17-UI-SPEC`).

## System-Wide Impact

- **API surface parity:** detail-pane tab interacts with the graph endpoint and entity selection (URL `classIri`).
- **Integration scenarios:** switching entities updates the graph tab; Source-pane relocation must preserve Monaco state and save flow.

## Acceptance Criteria

- [ ] Graph appears as an entity-scoped tab in the detail pane per `17-UI-SPEC`.
- [ ] Source view migrated to the right pane without regressing save/lint.
- [ ] `17-01` api change implemented and deployed.
- [ ] Validated against `17-VALIDATION` criteria; tested on the Hetzner dev box.
- [ ] PR(s) to CatholicOS, `.planning/` stripped, linked issue; no self-merge.

## Success Metrics

- Phase 17 acceptance/validation items pass; v0.5.0 candidate.

## Dependencies & Risks

- **Depends on:** [P0 dev env](2026-06-09-002-feat-hetzner-dev-environment-plan.md) and the graph engine from
  [P2](2026-06-09-003-feat-entity-graph-port-pr-plan.md) / [P1](2026-06-09-004-feat-llm-node-expansion-rollout-plan.md) PR-0.
- **Risk:** plans were authored on an older `dev` base — re-validate against current `catholicos/dev` before executing.
- **How to run:** plans exist → go straight to `/gsd:execute-phase` (with a re-validation pass first).

## Sources & References

- Branch: `feat/phase-17-graph-entity-tab` (off `chore/plan-phase-17`, ef46639).
- Plans: `.planning/phases/17-graph-as-entity-scoped-tab-in-detail-pane/` (SPEC/UI-SPEC/RESEARCH/PATTERNS/VALIDATION/3×PLAN), `.planning/sketches/` (4 HTML).
- GSD STATE: `stopped_at: "Phase 17 plans approved"`, resume file `17-03-PLAN.md`.
