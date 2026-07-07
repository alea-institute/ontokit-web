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
| ontokit-web | Entity-graph frontend (server BFS) | [alea #3](https://github.com/alea-institute/ontokit-web/pull/3) | `upstream-queue/entity-graph` (dc2e12a) | no | `QUEUED` | Consumer of the api endpoint. **Isolated** the graph-port commit `1866d04` from the 36-commit llm-helper stack; cherry-picked onto `origin/dev` (Tailwind v3→v4 conflicts resolved; `useGraphData` tests rewritten for the server-BFS contract). Contract: `GET /api/v1/projects/{id}/ontology/graph/{class_iri}?branch&ancestors_depth&descendants_depth&max_nodes&include_see_also` → `EntityGraphResponse{focus_iri,focus_label,nodes[],edges[],truncated,total_concept_count}`. This is **PR-0** of the 8-PR drain (graph engine). Supersedes stale April CatholicOS #88. **Session-3 (2026-07-07, dc2e12a):** resolved the `/ce:review` **MEDIUM** — the ported graph client dropped the `Authorization` header the pre-port code sent (private-project graphs would 401/403); token now threaded `graphApi→useGraphData→OntologyGraph/EntityGraphModal→both editor layouts` (optional → public reads still work), + new `graph.test.ts` regression. Also reconciled **8 port-orphaned tests** that were shipping failing (dev-origin `OntologyGraph.test.tsx`/`OntologyEdge.test.tsx` still asserted the old client-side component). **Full suite 2752 passed; tsc + eslint clean.** **Pending L4.4:** on-box *authed* graph screenshot — empirically blocked on OIDC config (`ZITADEL_CLIENT_ID` empty on api), no Coolify API token located on box, no Zitadel service token, no test user, no seeded project (FOLIO DEV web live + healthy, "No projects available", Sign-in present but login non-functional). |

---

## A2.2 — LLM node-expansion 8-PR drain (P1)

Web `feat/llm-node-expansion` → `origin/llm-helper` (~209 commits); api `deploy/llm-helper`
(+ `feat/phase-11-llm-abstraction`, `feat/phase-13-validation-suggestion-gen`). Carved into
dependency-ordered PRs; batch 1–2 at a time; each: slice → rebase onto fresh `catholicos/dev`
→ dev-box verify → `/ce:review` → stage → **ask Damien** → send.

| # | PR | Spans | Backend needed | On FOLIO PROD? | Status | Upstream PR |
|---|-----|-------|----------------|----------------|--------|-------------|
| 0 | Graph engine: server-side BFS | web (+api) | BFS endpoint | no | see A2.1 (= #88 / #37) | #88 / #37 |
| 1 | Shared foundation (`lib/api/generation.ts` types) | web | none (inert) | no | `QUEUED` | [alea web#4](https://github.com/alea-institute/ontokit-web/pull/4) `upstream-queue/shared-foundation` (af63b6e). Single clean cherry-pick of `a90ec39` onto fresh `origin/dev`; pure additions (+199, generation.ts + test). Inert (nothing imports it yet). Auth correct (required Bearer token + conditional X-BYO-API-Key). **suggestions.ts type slice DEFERRED to PR-6** (its commit `1e17916` interleaves types with method bodies — carving = untraceable messy slice). tsc/eslint 0, generation test 4/4, full suite 2753. |
| 2 | Optional/anonymous auth mode | web (+api) | none | no | `QUEUED` | web [alea #5](https://github.com/alea-institute/ontokit-web/pull/5) `upstream-queue/optional-auth` + api [alea #5](https://github.com/alea-institute/ontokit-api/pull/5) `upstream-queue/optional-auth`. Phase 08-optional-auth. **web** = commits `600725e`+`235ee8f`+`8e57aa5` (`lib/auth-mode.ts` new, `lib/env.ts` Zitadel-optional, `auth.ts` conditional provider, `next.config.ts` NEXT_PUBLIC flags, header/user-menu hide auth UI) → 6 files +76. **api** = commits `0bd679b`+`f98f3e0` (`config.py` auth_mode field, `auth.py` ANONYMOUS_USER + 3-mode guard, 11 tests) → 3 files +150. Default `required` ⇒ backward compatible. **Editor "Sign in to edit" affordance (`9e29651`) DEFERRED to PR-5** (touches PR-5-owned ClassDetailPanel/editor-page/layouts). Verified: **live unauthed surface screenshotted** (`AUTH_MODE=disabled` → anonymous header, no sign-in UI/UserMenu/NotificationBell) + boots clean (root 200, `/api/auth/session` 200). **`/ce:review` (kieran-typescript + kieran-python) applied:** web reviewer caught a **BLOCKER** — the hardcoded `NEXTAUTH_SECRET` fallback covered `optional`+Zitadel-configured (real sessions) → forgeable session JWTs; **FIXED** (`ca55c65`): fallback only when Zitadel unconfigured + randomized (`crypto.randomBytes`), `env.ts` hard-requires a real secret whenever Zitadel configured; also fixed 2 HIGH (client/server `ZITADEL_CONFIGURED` predicate drift; unsafe `as ServerEnv` cast) + unified `isAuthActive()` gating + extracted shared `shouldShowAuthUI()` + added auth-mode/env/component tests. api reviewer: no BLOCKER/HIGH (disabled early-return correct, no priv-esc) → applied `Literal` auth_mode + disabled-ignores-credentials test (`c4a4a36`); **WS-auth parity deferred + noted** (new work beyond the phase-08 slice). **Final: web tsc/eslint 0 + full suite 2768 green; api ruff/mypy 0 + 43 auth tests.** Findings + resolutions posted as PR comments on both. |
| 3 | Multi-provider LLM config + BYOK | web + api | `/llm/config,test-connection,usage` | no | `QUEUED` | web [alea #6](https://github.com/alea-institute/ontokit-web/pull/6) + api [alea #6](https://github.com/alea-institute/ontokit-api/pull/6), both `upstream-queue/llm-config`. **web** = phase-11 config commits (`04a7975`,`cb9682c`,`3004539`,`6b6709b`,`2b250b3`) onto fresh `origin/dev` (settings-page conflict resolved: AI/LLM section coexists with Lint); 13-provider settings UI + test-connection + BYOK popover + usage dashboard, 9 files +1353. **api** = commits `462bc77`(models/schemas/migration)+`dded39c`(provider registry/crypto/ssrf/pricing) + carved `routes/llm.py` from mixed `9d1d7ca` (kept config/test-connection/usage + public providers/known-models; **dropped `/llm/status` + member-flags PATCH → PR-4**) + shared `audit.py` from `119e501`; 23 files +2533. **Deferred to PR-4** (not pulled early): web `useLLMGate.ts`/`LLMBudgetBanner`/`LLMRoleBadge`; api budget/rate_limiter/role_gates + `LLMStatusResponse` (inert) + `can_self_merge_structural` column (inert). **Secrets handling:** server key Fernet-encrypted at rest, never returned (`api_key_set` bool); BYO key ephemeral via `X-BYO-API-Key`, never stored server-side; error redaction; audit metadata-only. **Hardening (this PR):** api `crypto` now hard-fails in any deployed env when `SECRET_KEY` is the shipped default (would encrypt user keys under a public constant — the session-4 finding class); web BYO keys moved **localStorage→sessionStorage** (cleared on tab close). **`/ce:review` (kieran-typescript + kieran-python), no BLOCKER — all HIGH/MEDIUM fixed** (web `cc1970e`: pending-key validation, BYO autofill/name, double-submit, budget wiring, store-on-success; api `2b9ba9c`: secret-key guard covers staging, SSRF re-validate at test-connection + IPv6 metadata, usage-agg UTC `date_trunc`, base_url-update provider fallback). Verified: web tsc/eslint 0 + suite **2753** + clean `next build`; api ruff/mypy 0 + suite **1547** + public catalogue endpoints exercised via TestClient. Findings + resolutions summarized in PR bodies; PRs cross-linked. **Pending authed E2E:** the settings UI is authed-only (shares L4.4's OIDC/seed gate). |
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
