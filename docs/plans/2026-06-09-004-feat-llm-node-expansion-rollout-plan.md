---
title: LLM node-expansion rollout (split into reviewable PRs)
type: feat
status: active
date: 2026-06-09
---

# ✨ LLM node-expansion rollout

Part of the [OntoKit Dev & Rollout Roadmap](2026-06-09-001-ontokit-dev-rollout-roadmap.md) — **P1, the headline**.

## Overview

Take the large, built-and-tested **LLM-assisted ontology suggestion** feature (web
`feat/llm-node-expansion` → `origin/llm-helper`; api `deploy/llm-helper`), test it end-to-end on the
Hetzner dev box, then **carve it into 6–8 dependency-ordered PRs** for Fr. John to review and merge
into `catholicos/dev`. It is the biggest body of "done but unshipped" work.

## Problem Statement

The feature is complete and tested but lives only on the `llm-helper` branches — not merged to
CatholicOS. The web branch is a ~209-commit / +10.4k-line mixed payload (93 files vs `catholicos/dev`),
far too large for a single reviewable PR, and it also contains **non-LLM work** (a graph refactor and an
auth-mode subsystem) that should ship separately.

## Proposed Solution

1. Rebase web + api branches onto current `catholicos/dev`.
2. Deploy to the Hetzner dev box; run the v0.4.0 Human-UAT checklist (16 items = phases 10–16) as the test protocol.
3. Split into the PR stack below and submit in order, each with a linked issue, `.planning/` stripped.

## Technical Approach

### What the feature does

"Suggest Improvements" on an entity returns AI-generated, reviewable suggestions for **children,
siblings, parents, annotations (labels/definitions/synonyms), and relationship edges** — each with
confidence, provenance (llm-proposed / user-edited), inline validation, and duplicate detection;
accept/reject/edit per suggestion. Plus multi-provider LLM config (13 providers), role-based cost
controls, BYO-API-key, anonymous-user credits, shard-preview batch submit, and reviewer enhancements.

### Backend (already built, `../ontokit-api` `origin/deploy/llm-helper`)

Endpoints confirmed: `POST /projects/{id}/llm/generate-suggestions`, `/llm/{config,test-connection,status,usage,providers,known-models}`,
`/suggestions/sessions/*` (save/submit/discard/beacon/pending/approve/reject/request-changes/resubmit),
`anonymous_suggestions`, `validate-entity`. LLM keys stored per-project, Fernet-encrypted.

### Proposed PR sequence (rebase onto `catholicos/dev` first; `.planning/` excluded)

| # | PR | Delivers | Backend needed |
|---|-----|----------|----------------|
| 0 | **Graph engine: server-side BFS** | = P2; editor layouts import `lib/graph/utils.ts`, so it lands first | BFS endpoint |
| 1 | **Shared foundation** | `lib/api/generation.ts` types + client base; no UI | none (inert) |
| 2 | **Optional/anonymous auth mode** | `AUTH_MODE=required\|optional\|disabled`; runs without Zitadel | none |
| 3 | **Multi-provider LLM config + BYOK** | settings UI (13 providers, tiers), test-connection, BYO-key | `/llm/config`, `/llm/test-connection`, `/llm/usage` |
| 4 | **Cost controls & role gating** | role-based daily limits, budget banner/badge, structural self-merge toggle | `/llm/status` |
| 5 | **Core suggestion generation** ⭐ | the headline: SuggestImprovements → children/siblings/parents/synonyms/edges, accept/reject/edit, auto-suggest-on-navigate | `/llm/generate-suggestions` |
| 6 | **Shard-preview + reviewer tools** | cluster-into-shards batch submit, provenance badges, duplicate comparison, similar-entities | `/suggestions/cluster`*, batch-submit |
| 7 | **Anonymous suggestions** *(optional)* | credit-based suggesting for logged-out users | anonymous session endpoints |

\* clustering lives in the api `quality`/`duplicate_check` routes, not a literal `/suggestions/cluster` route.

**Merge order:** 0 → 1 → 2 → 3 → 4 → 5 → 6 → (7).

## System-Wide Impact

- **Tricky shared files** (sequential edits across PRs, in order):
  - `components/editor/ClassDetailPanel.tsx` (+320/−6) — owned by **PR-5**; PR-7 appends only anonymous-mode props.
  - `app/projects/[id]/editor/page.tsx` (+338/−20) — PR-5 suggestion wiring, PR-6 shard modal, PR-7 CreditModal.
  - `lib/api/suggestions.ts` (+297) — type additions in PR-1, method bodies in PR-6.
  - `lib/api/client.ts` `export { llmApi }` must travel with `lib/api/llm.ts` (**PR-3**).
- **Graph prerequisite** — `StandardEditorLayout`/`DeveloperEditorLayout` import `lib/graph/utils.ts`, so **PR-0 (P2) must merge before PR-5**.

## Acceptance Criteria

### Functional (end-to-end on dev box)
- [ ] Per-project LLM config saves; test-connection succeeds for a real provider (or Ollama).
- [ ] "Suggest Improvements" returns children/siblings/parents/annotations(synonyms)/edges with confidence + provenance.
- [ ] Accept pushes a suggested child into the tree; reject/edit work; duplicate detection flags overlaps.
- [ ] Cost gating enforces role limits; budget banner shows when exhausted.
- [ ] BYO-key path works (`X-BYO-API-Key`).
- [ ] (If enabled) anonymous suggestion credits + submission work at `AUTH_MODE=optional`.
- [ ] Shard-preview batch submit + reviewer screen function.

### Quality Gates
- [ ] Each PR rebased onto `catholicos/dev`, `.planning/` stripped, linked issue, focused diff.
- [ ] Backend `/llm/*` + `/suggestions/*` confirmed deployed for any PR that needs them.
- [ ] v0.4.0 Human-UAT checklist (16 items) passes.
- [ ] No self-merge — Fr. John reviews each PR.

## Success Metrics

- All PRs reviewable in isolation; full feature works on dev; merged in order without breakage.

## Dependencies & Risks

- **Depends on:** [P0 dev env](2026-06-09-002-feat-hetzner-dev-environment-plan.md) and
  [P2 graph engine](2026-06-09-003-feat-entity-graph-port-pr-plan.md) (PR-0).
- **Backend coupling** — PRs 3/5/6/7 are inert without their api endpoints; sequence after/with the api side.
- **Rebase scope** — 209 commits incl. a sync-merge of `catholicos/dev`; rebase carefully so each PR's diff is branch-only.
- **Provider spend** — real keys cost money; prefer a capped key or Ollama for testing.
- **CatholicOS rules** — every push needs a PR + linked issue; never self-merge.

## Sources & References

- Web branch: `feat/llm-node-expansion` → `origin/llm-helper` (b1a8af7); merge-base with `catholicos/dev` = `795c973`.
- API branch: `../ontokit-api` `origin/deploy/llm-helper` (+ `feat/phase-11-llm-abstraction`, `feat/phase-13-validation-suggestion-gen`).
- Key files: `lib/api/generation.ts`, `lib/api/llm.ts`, `lib/hooks/{useSuggestions,useLLMGate,useLLMConfig}.ts`,
  `lib/stores/{suggestionStore,byoKeyStore,anonymousCreditStore,shardPreviewStore}.ts`,
  `components/editor/suggestions/*`, `components/suggestions/{ShardPreview*,ProvenanceBadge,CreditModal}.tsx`,
  `components/projects/{LLMSettingsSection,LLMUsageSection,BYOKeyPopover}.tsx`.
- Test protocol: `HUMAN-UAT-CHECKLIST.md` (v0.4.0, 16 items). PR-strip tool: `gsd-pr-branch`.
