---
title: Entity-graph port — verify & PR
type: feat
status: active
date: 2026-06-09
---

# 🕸️ Entity-graph port — verify & PR

Part of the [OntoKit Dev & Rollout Roadmap](2026-06-09-001-ontokit-dev-rollout-roadmap.md) — **P2, the pipe-cleaner**.

## Overview

Take the **code-complete** entity-graph port (server-side BFS graph endpoint + frontend graph),
visually verify it on the new dev box, and open a clean PR to CatholicOS. This is the **first real
run through the P0 dev pipeline** — small, low-risk, and high-value because the graph-engine refactor
it carries is a **prerequisite for the llm-helper editor PRs** (P1's editor layouts import
`lib/graph/utils.ts`).

## Problem Statement / Motivation

- The work is done (`feat/entity-graph-port` → `origin/entity-graph-migration`, all tests passing per
  prior verification) but **never visually verified and never PR'd**. It tracks issue CatholicOS/ontokit-web#81.
- It must land in `catholicos/dev` before the llm-helper editor-layout PRs, or those carry a dangling import.

## Proposed Solution

Deploy the branch to the Hetzner dev box, run a Chrome-DevTools visual verification of the graph
(per the project's "Chrome DevTools only" rule), rebase onto current `catholicos/dev`, then open the PR.

## Technical Considerations

- **Frontend:** `lib/graph/` — replaces client-side `buildGraphData.ts`/`elkLayout.ts` with
  `useELKLayout.ts` + `lib/api/graph.ts` (server BFS); rewrites `useGraphData.ts`, `OntologyGraph.tsx`,
  `EntityGraphModal.tsx`, `OntologyNode/Edge.tsx`, `lib/graph/types.ts`, plus `extractTreeLabelMap` in `utils.ts`.
- **Backend:** requires the entity-graph **BFS endpoint** in `ontokit-api` (confirm it is on the api branch deployed to dev).
- **Overlap with P1:** this is the same refactor as P1's "PR-0 graph engine". Landing P2 *is* PR-0.

## System-Wide Impact

- **API surface parity:** editor layouts (`StandardEditorLayout.tsx`, `DeveloperEditorLayout.tsx`) import
  `lib/graph/utils.ts` — so this must merge before P1's PR-3 (core generation).
- **Integration scenarios:** large ontology → graph render performance; node expansion via server BFS; empty-data clears graph.

## Acceptance Criteria

- [ ] Branch deploys to the Hetzner dev box (web + api with BFS endpoint).
- [ ] Chrome-DevTools visual check: graph renders for a focus entity, expansion works, edges/markers correct, layout stable.
- [ ] Rebased cleanly onto `catholicos/dev`.
- [ ] PR opened to CatholicOS with a linked issue (#81), `.planning/` stripped (use `gsd-pr-branch` flow).
- [ ] No self-merge — awaits Fr. John's review.

## Success Metrics

- Graph feature works end-to-end on dev; PR is reviewable (focused diff, no `.planning/` noise).

## Dependencies & Risks

- **Depends on:** [P0 Hetzner dev env](2026-06-09-002-feat-hetzner-dev-environment-plan.md).
- **Risk:** the BFS endpoint may live on a specific api branch — confirm which api branch carries it before deploy.
- **Risk:** rebase onto `catholicos/dev` may conflict if upstream graph code moved — resolve before PR.

## Sources & References

- Branch: `feat/entity-graph-port` → `origin/entity-graph-migration` (1866d04).
- Backups: `origin/backup/entity-graph-{clean,merged}`, `origin/backup/review-pr-88` (superseded rebases).
- Issue: CatholicOS/ontokit-web#81. Project memory: entity-graph port "code-complete, needs visual verify + PR".
