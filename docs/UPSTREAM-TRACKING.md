---
title: Upstream Divergence Tracking (FOLIO ⇄ CatholicOS)
type: ledger
status: active
owner: Damien Riehl
updated: 2026-07-07
---

> **⚠ POLICY UPDATE (TODAY-2026-07-07):** Today upstream PRs are staged **INSIDE the
> alea-institute fork** (`origin`), base `dev`, **UNMERGED**, title-prefixed
> `[upstream-queue]`. `dev`/`main` stay pure upstream mirrors (ff-sync only). **NO CatholicOS
> org pushes or PRs today** — retargeting these queue PRs to `CatholicOS` (Fr. John's review)
> is decided with Damien after today. The `SENT`/CatholicOS rows below (#37/#88) are the
> *stale April* PRs; the live consolidated work is the `[upstream-queue]` rows.

# 📒 Upstream Divergence Ledger

**Purpose (Portfolio Plan A1 "Divergence ledger"):** every feature shipped to **FOLIO
PROD ahead of upstream acceptance** is listed here with its upstream PR status. **A rejected
PR must never silently become permanent divergence** — if a PR is closed-unmerged, its row
here flips to `DIVERGENT` and gets a disposition (revert on FOLIO PROD, re-slice, or
re-negotiate with Fr. John).

Upstream = **CatholicOS** org (`catholicos` remote), base branch **`dev`**, reviewed/merged by
**Fr. John D'Orazio**. We fork from `alea-institute` (`origin`). Never self-merge CatholicOS PRs.

## Promotion pipeline

```
FOLIO DEV (Hetzner/Coolify)   ontokit.dev.openlegalstandard.org  (+ ontokit-api.dev.…)
   │  autonomous deploys; all UAT campaigns run here
   ▼  [UAT evidence pack + Damien approval]
FOLIO PROD                    ontokit.openlegalstandard.org
   +  CatholicOS PR (feature branch) — staged, ask-gated send; each PR gets a preview env
   ▼  [Fr. John review/merge]
CatholicOS DEV → PROD         ontokit.catholicdigitalcommons.org
```

**Status legend:** `PLANNED` · `STAGED` (branch+PR body ready, not sent) · `QUEUED`
(`[upstream-queue]` PR **open in the alea fork, base `dev`, unmerged** — awaiting later
retarget to CatholicOS) · `SENT` (PR open upstream) · `IN-REVIEW` · `MERGED` · `DIVERGENT`
(on FOLIO ahead of upstream, or PR rejected — needs disposition).

> **Current baseline (2026-07-06):** FOLIO PROD is still the **stripped AWS box** (no
> Postgres/Zitadel) and carries **none** of the features below — so nothing is yet
> "divergent on PROD." FOLIO DEV is being stood up on Coolify now (A1). This ledger is
> therefore **forward-looking**: it tracks each feature from PLANNED → its upstream landing,
> and will show real PROD-ahead divergence once features promote to FOLIO PROD before Fr.
> John merges them.

---

## A2.1 — Entity-graph (pipe-cleaner) · tracks CatholicOS/ontokit-web#81

Server-side BFS graph endpoint (api) + graph frontend (web). **Consolidated + rebased onto
fresh `dev`; `[upstream-queue]` PRs OPEN in the alea fork (2026-07-07, unmerged).**

| Repo | Feature | Queue PR (alea, unmerged) | Head branch | On FOLIO PROD? | Status | Notes |
|------|---------|---------------------------|-------------|----------------|--------|-------|
| ontokit-api | Server-side BFS entity-graph endpoint | [alea #3](https://github.com/alea-institute/ontokit-api/pull/3) | `upstream-queue/entity-graph` (f19cb85) | no | `QUEUED` | **Consolidated (2026-07-07):** the three lineages (`entity-graph-endpoint` +21 / `fix/pr-37-blockers` / `review-pr-37`) verified patch-equivalent (`git cherry`) → `entity-graph-endpoint` is the clean **superset**; rebased onto `origin/dev` (25cc4de), **0 conflicts**. 8 files, +1596/−32. `pytest` graph modules → **72 passed**. Supersedes the stale April CatholicOS #37 (untouched today). |
| ontokit-web | Entity-graph frontend (server BFS) | [alea #3](https://github.com/alea-institute/ontokit-web/pull/3) | `upstream-queue/entity-graph` (2 commits) | no | `QUEUED` | Consumer of the api endpoint. **Isolated** the graph-port commit `1866d04` from the 36-commit llm-helper stack; cherry-picked onto `origin/dev` (Tailwind v3→v4 conflicts resolved; `useGraphData` tests rewritten for the server-BFS contract). `tsc` clean, `vitest` 7/7, eslint 0 errors. Contract: `GET /api/v1/projects/{id}/ontology/graph/{class_iri}?branch&ancestors_depth&descendants_depth&max_nodes&include_see_also` → `EntityGraphResponse{focus_iri,focus_label,nodes[],edges[],truncated,total_concept_count}`. This is **PR-0** of the 8-PR drain (graph engine). Supersedes stale April CatholicOS #88. **Pending:** on-box authed graph screenshot (blocked on OIDC + seed + disk headroom). |

---

## A2.2 — LLM node-expansion 8-PR drain (P1)

Web `feat/llm-node-expansion` → `origin/llm-helper` (~209 commits); api `deploy/llm-helper`
(+ `feat/phase-11-llm-abstraction`, `feat/phase-13-validation-suggestion-gen`). Carved into
dependency-ordered PRs; batch 1–2 at a time; each: slice → rebase onto fresh `catholicos/dev`
→ dev-box verify → `/ce:review` → stage → **ask Damien** → send.

| # | PR | Spans | Backend needed | On FOLIO PROD? | Status | Upstream PR |
|---|-----|-------|----------------|----------------|--------|-------------|
| 0 | Graph engine: server-side BFS | web (+api) | BFS endpoint | no | see A2.1 (= #88 / #37) | #88 / #37 |
| 1 | Shared foundation (`lib/api/generation.ts` types) | web | none (inert) | no | `PLANNED` | — |
| 2 | Optional/anonymous auth mode | web (+api) | none | no | `PLANNED` | — |
| 3 | Multi-provider LLM config + BYOK | web + api | `/llm/config,test-connection,usage` | no | `PLANNED` | — |
| 4 | Cost controls & role gating | web + api | `/llm/status` | no | `PLANNED` | — |
| 5 | ⭐ Core suggestion generation | web + api | `/llm/generate-suggestions` | no | `PLANNED` (eval-gated: rubric + folio-python checks + FOLIO-MCP semantic judgment) | — |
| 6 | Shard-preview + reviewer tools | web + api | quality/duplicate_check routes | no | `PLANNED` | — |
| 7 | Anonymous suggestions *(optional)* | web + api | anonymous session endpoints | no | `PLANNED` | — |

**Merge order:** 0 → 1 → 2 → 3 → 4 → 5 → 6 → (7). PR-0 must merge before PR-5 (editor
layouts import `lib/graph/utils.ts`).

---

## H — Housekeeping PRs (fold-ins)

| Repo | Feature | Source branch | Status | Notes |
|------|---------|---------------|--------|-------|
| ontokit-api | Startup async-safety (no hang on unreachable MinIO/DB) | `fix/startup-async-safety` (ahead 1 of `catholicos/main`) | `PLANNED` | Fold into an early PR (needed for reliable dev-box + preview-env startup). |
| ontokit-api | Lint hardening (empty-rules, role gating, XOR validation) | `fix/pr-94-blockers` | `PLANNED` | Standalone lint-hardening PR. Related: `review-pr-94`. |
| ontokit-api | **Worker Redis-auth bug** — `get_redis_settings()` drops the DSN password → arq worker can't auth to a password-protected Redis | _found during FOLIO DEV deploy 2026-07-06; runtime-patched on box_ | `PLANNED` (bug) | Real bug (repo's own compose uses password-less Redis, hiding it). Fix `password=parsed.password`. Fold into an early api PR. |
| ontokit-web | **Lockfile fix** — dependabot drift made `npm ci` fail (node:22-alpine/npm10) | pushed to alea `origin/dev` `ac67d1f` (package-lock.json only) | `PLANNED` | Diverges alea fork's `dev` from `catholicos/dev` by 1 commit → next fork-sync needs a rebase; same fix should land upstream. |

> **Alea-fork `dev` divergence (2026-07-06):** `alea-institute/ontokit-web` `dev` = `ac67d1f` = `catholicos/dev` (`b5aa5e3`) + the lockfile commit. `alea-institute/ontokit-api` `dev` = `25cc4de` (== catholicos/dev, clean). Reconcile the web lockfile commit upstream to keep the mirror ff-only.

---

## Disposition log (rejected / diverged PRs)

_None yet._ When a PR is closed-unmerged, add a row: date · repo · PR# · reason · disposition
(revert on FOLIO PROD / re-slice / re-negotiate) · resolved-date.
