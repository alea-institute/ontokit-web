---
title: PR Party as an OntoKit Feature - Plan
type: feat
date: 2026-07-26
topic: pr-party-ontokit-native
artifact_contract: ce-unified-plan/v1
artifact_readiness: requirements-only
product_contract_source: ce-brainstorm
execution: code
---

# PR Party as an OntoKit Feature - Plan

**Status: requirements-only. `ce-plan` must enrich this before implementation** — the Implementation Units depend on research this document could not do (the exact shape of ontokit-api's existing GitHub integration, the Zitadel role model, and the ontology-app conventions the UI must match).

**Repos:** UI in `ontokit-web` (Next.js 15 / React 19 / TypeScript), pipeline and endpoints in `ontokit-api` (Python / FastAPI). Work happens on the FOLIO fork (`origin` = `alea-institute/*`); CatholicOS is reached only by PR to `catholicos/dev` with a linked issue.

## Goal Capsule

- **Objective:** Deliver the PR Party review experience as a first-class OntoKit product feature — async PR briefs, verdicts that post real GitHub reviews, AI Q&A, and reconciliation — replacing the Cockpit-hosted prototype.
- **Product authority:** The Product Contract of `docs/plans/2026-07-26-010-feat-pr-party-review-dashboard-plan.md` (R1–R22, KD1–KD13, actors, flows, acceptance examples) carries forward **unchanged except where this document names a reversal**. GitHub remains the system of record.
- **Open blockers:** none for planning. Research gaps are listed under Outstanding Questions and are `ce-plan`'s first job.
- **Prototype:** the Cockpit implementation on `feat/pr-party-dashboard` (Cockpit repo, 10 commits) is the working reference. Do not delete it; it is the source of both the transferable code and the 33 review findings below.

---

## Product Contract

### Summary

PR review becomes an authenticated OntoKit surface rather than personal dashboard tooling: OntoKit ingests PR events for the CatholicOS repos, generates a brief per PR, and presents each reviewer a queue where a verdict posts a real GitHub review under their own identity. One application serves both reviewers by role, replacing the twin single-tenant boards.

### Problem Frame

The Cockpit prototype proved the product design and surfaced its failure modes, but it delivered the feature as personal infrastructure: two single-tenant static boards, a file-based ask store, a 15-minute shell cycle, and a second deployment stack existing only to keep one reviewer away from the other's litigation documents. That shape is why several of the review's hardest findings exist — state scattered across a ledger, receipt files and ask files with no transaction; a poller that silently erased what other modules wrote; a whole isolation subsystem guarding a problem OntoKit does not have. OntoKit already has authenticated multi-user access, a database, and a GitHub webhook receiver. Building the feature there removes the class of defect rather than fixing instances of it.

### Key Decisions

These **reverse** decisions in plan 010. Each names what it replaces.

- KD14. **PR review is an OntoKit product surface, not Cockpit tooling.** (session-settled: user-directed — reverses KD4's twin Cockpit boards under damienriehl.com, and supersedes its recorded rationale that dev-tooling should stay out of the public product.) Governs R1–R22 delivery.
- KD15. **One multi-tenant application, roles not deployments.** Both reviewers use the same OntoKit instance under their own accounts; per-reviewer views come from identity and role. (session-settled: user-approved — makes KTD6's separate frjohn stack, docroot, Access app and publish-guard unnecessary. The litigation-isolation problem was an artifact of sharing Damien's Cockpit docroot and does not exist here.)
- KD16. **Authentication is OntoKit's existing OIDC**, not Cloudflare Access email pinning. (session-settled: user-approved — reverses KTD2/KTD7's Access-principal identity binding; the reviewer identity now comes from the session.)
- KD17. **Event-driven intake replaces polling** where ontokit-api's existing webhook receiver can carry it. (session-settled: user-approved — reverses KTD3's poll-first choice, which existed *only* because the Cockpit had no event infrastructure. Retain a low-frequency reconciliation sweep as the webhook-miss backstop, per the original external research.)
- KD18. **State lives in the database**, not in ask files, ledger JSON, receipt files and park state. (session-settled: user-approved — replaces KTD8's file schema. A verdict, its GitHub review id and its head SHA become one row, which is what makes B3, C1, C2 and C8 below structurally impossible rather than individually fixed.)
- KD19. **Credentials are stored per user by the application**, not as mode-600 files on one box. (session-settled: user-approved — replaces KTD2's `~/.secrets/` model. The read-only/write privilege split of KTD5 **survives and remains mandatory**.)

### Requirements

Carry forward R1–R22 from plan 010 unchanged in intent. These are the deltas this shape forces:

**Retained without change** — R1 (org-wide intake), R2 (LLM brief from diff/commits/CE artifacts), R3 (observe AI review + reviewer re-trigger), R4 (CI/mergeability with a computing state), R5 (deep links), R6 (regenerate on push, stale warning), R7 (three verdicts with plain-language descriptions), R8 (real GitHub review under the reviewer's identity), R9 (discuss-live parks; agenda is the parked set), R11 (merge with per-reviewer default), R12 (degraded mode without a stored credential), R13 (Q&A via PR comments), R14 (deliberation capture), R17 (readiness gating with timeout and override), R18 (own-PR read-only), R19 (third-party and bot routing), R20 (reconciler), R21 (untrusted PR content), R22 (ready notification).

**Restated for the new surface**

- R23. Reviewer identity comes from the authenticated OntoKit session; a request may not name a reviewer other than the caller. (Replaces R15/R16's board-specific wording and KTD2's Access-principal binding.)
- R24. Each reviewer sees a queue scoped to them by role and authorship; both reviewers may hold independent state on the same PR. (Replaces the twin-board split; subsumes R19's third-party dual-card behavior without duplicate stems.)
- R25. A verdict, its GitHub review id, and the head SHA it was cast against are recorded atomically; a card's retirement is derived from that record, never from file presence.
- R26. Server-side readiness gating: the verdict endpoint re-checks brief and check status rather than trusting a client-supplied override. (Closes the prototype's client-only gate — see C12 below.)

### Scope Boundaries

**In scope:** the reviewer experience end to end, for the two principals, on the CatholicOS repos.

**Deferred**

- Public/multi-tenant availability beyond the two principals — the feature is authenticated OntoKit surface, but this plan does not make it a general product offering.
- Migrating the Cockpit prototype's data. There is none worth keeping: the prototype never ran against live PRs.

**Outside this product's identity**

- Merge without a human tap; replacing GitHub as the record; repos outside the catholicos org. (Unchanged from plan 010.)

---

## Migration Inventory

What actually happens to the ~11.7k lines on `feat/pr-party-dashboard`.

### Transfers to `ontokit-api` (logic is sound; storage and identity change)

| Prototype file | Becomes | Notes |
|---|---|---|
| `tools/pr-party/github_client.py` (~640) | GitHub client service | Stdlib `urllib` today; ontokit-api already uses `httpx`. Keep the mode split (generation = read-only, actuation = write) — it is a KTD5 invariant, not an implementation detail. Keep `TokenExpiredError`, `StaleCardError`, `SelfApprovalError`, the non-PENDING assertion, and the `sha`-on-merge rule; each encodes a real GitHub behavior found in research. |
| `tools/pr-party/collect.py` (~557) | PR ingestion + status refresh | Poll loop → webhook handler + reconciliation sweep. The `(pr_node_id, head_sha)` idempotency key survives as a uniqueness constraint. |
| `tools/pr-party/brief.py` | Brief generation service | **Must land with the A1 fix** (tool-denied subprocess) — see Carried Findings. Per-cycle budget becomes a queue/worker concern. |
| `tools/pr-party/qa.py` | Q&A service | Answer-binding logic transfers; apply the C4 fix. |
| `tools/pr-party/reconcile.py` (~600) | Reconciliation job | Divergence cases transfer directly; most become cheaper against a database. |
| `tools/answers-back/service/github_actions.py` (~950) | Verdict endpoint | Pre-flight, idempotency and receipt semantics transfer; the file-claim mechanism becomes a transaction. |

### Rebuilt in `ontokit-web` (React, not portable)

`tools/pr-party/render.py` (1237 lines) — card sheets, verdict controls, brewing/stale/degraded states, Q&A thread, agenda. The **HTML is discarded; the interaction design is the specification.** Its escaping discipline becomes React's default behavior, but the untrusted-content rule (R21) still governs anything rendered as markup.

### Discarded (Cockpit-only)

`tools/gen-board.py` extensions, `tools/answers-back/` service plumbing, `tools/deploy/*` (compose, nginx, sync-cockpit.sh), `tools/pr-party/publish_frjohn.py` and its isolation tests, the `briefs/` file conventions, `briefs/repos-extra.json`. The frjohn onboarding runbook survives only as the credential-intake disclosure language (see below).

### Survives as knowledge, not code

- `tools/pr-party/README.md` — the credential runbook: org-owner status (Damien is a **member**; Fr. John `jmurquidi` is an **owner** and approves), the exact fine-grained PAT permission set, the 366-day rotation reality, the one-time-secret intake channel and disclosure language, and `damienriehlfc` as the E2E authoring identity.
- The external research in plan 010's Sources: GitHub Apps badge the avatar (so PATs are required for honest attribution), `GITHUB_TOKEN` cannot approve, self-approval 422s, `mergeable` is null until computed, CodeRabbit has no findings API and rate-limits at ~4/hour, and PAT-authored comments trigger Actions workflows while `GITHUB_TOKEN`-authored ones do not.
- **~195 tests.** The assertions transfer as behavior specifications even though the code does not.

---

## Carried Findings

The 33 findings from the prototype review (`Coding Projects/docs/residual-review-findings/2026-07-26-pr-party-dashboard-review.md`) split three ways. **`ce-plan` must fold the first group into Implementation Units — they are pre-paid bug reports.**

### Still apply — fix in the new build

| From | Finding | Why it survives the move |
|---|---|---|
| A1 (P0) | Untrusted PR text reaches an LLM subprocess with full tool access | Architecture-independent. Any brief generator invoking a tool-enabled model needs a denied-tools boundary. **Highest-priority carry.** |
| A2 | Answer workflow over-scoped (`pull-requests: write`, `id-token: write`) | The `@claude` workflow is unchanged by the move. |
| A4 | Verdict request never binds the card's identity to the PR it approves | R23/R25 address it structurally; verify. |
| B4 | Brief generation can overrun its own budget | Becomes a worker timeout instead of a cycle overrun. |
| C1 | A verdict cast at an old head SHA must not settle a new revision | R25 makes it a constraint; keep the test. |
| C2 | A wedged in-flight claim blocks that verdict permanently | Transactions remove the file-corruption path, but the reaper/timeout question remains. |
| C3 | Credential slot vs GitHub login mismatch | Same class of bug wherever an internal user id is compared to a GitHub login. |
| C4 | Any bot comment binds as "the answer" | Pure logic; carries as-is. |
| C5 | Card reports success when a merge was skipped or failed | Carries to the React UI. |
| C6 | Merge omitted from the idempotency key, so a failed merge cannot be retried | Carries. |
| C7 | Merged bot PRs never leave the queue | Carries. |
| C12 | **The readiness gate is client-side only** | Now R26. |
| E | No CI workflow — the highest-leverage gap | Both target repos have CI; use it. |

### Resolved by the new architecture — do not re-implement

B1 (CSRF header) and B2 (kit source path) are prototype-specific. B3 (poller erasing folded state), C8 (nag written to one store, read from another), C9 and C11 dissolve with KD18's single record. The entire D group (a 1237-line file, PR logic accreted into a 5.5k-line generator, a five-way duplicated path block with a hardcoded personal path) is prototype debt that should not be recreated. KTD6's isolation subsystem and its tests are moot under KD15.

### Newly relevant

- The prototype never ran against a live PR. **Nothing in the product design has been validated against real GitHub behavior** — only against fakes. First live E2E is the highest-value verification in the new build.
- No UI has ever been visually verified (the box's chrome-devtools MCP config lacks `--headless` and there is no X server). In ontokit-web this becomes ordinary frontend review — but fix the MCP config, since the standing convention requires screenshot verification.

---

## Outstanding Questions

**Resolve before planning** — none block `ce-plan` from starting; all are research it must do first.

**`ce-plan` must research and answer**

1. **What does ontokit-api's existing GitHub integration already provide?** `routes/pull_requests.py::handle_github_pr_webhook`, `services/github_sync.py`, and the `GitHubIntegration` model with `github_hook_id` / webhook-secret / webhook-setup routes were found during the original research but never read in depth. How much of R1/R4 is already built, and does the webhook cover org-level or only per-repo events?
2. **What does `ontokit-web` already model?** `lib/api/pullRequests.ts` carries `PullRequest`, `Review`, `github_review_id`, `github_comment_id`, and `prSettingsApi`. Which of R7/R8/R11 has a home already, and how does `components/pr/PRActions.tsx`'s role gating relate to R23/R24?
3. **Identity and roles:** how does the Zitadel session map to a GitHub login, and where does a per-user GitHub credential live (KD19)? This is the single largest unknown.
4. **Does the CatholicOS org PR flow fit OntoKit's project model at all?** OntoKit's PRs are ontology-change PRs scoped to a project; PR Party reviews *code* PRs across 35 repos. Is this a new top-level surface, or does it attach to an existing project concept? **This may be the question that most changes the plan.**
5. Where does brief generation run — an ontokit-api worker, a queue, or a scheduled job — and what LLM access does that environment have?

---

## Sources & Research

- Prototype and its full review: branch `feat/pr-party-dashboard` in the Cockpit repo (`damienriehl/coding-projects`, pushed); findings at `docs/residual-review-findings/2026-07-26-pr-party-dashboard-review.md` there, also carried on the branch.
- Originating Product Contract, actors, flows, acceptance examples, and external GitHub/CodeRabbit research: `docs/plans/2026-07-26-010-feat-pr-party-review-dashboard-plan.md` (this repo).
- ontokit-web surfaces to read first: `lib/api/pullRequests.ts` (PR/Review types, GitHub mirror fields, `githubIntegrationApi`, `prSettingsApi`), `components/pr/PRActions.tsx` (role gating).
- ontokit-api surfaces to read first: `routes/pull_requests.py` (`handle_github_pr_webhook`), `services/github_sync.py`, `services/mirror_credential.py` (`GITHUB_MIRROR_TOKEN` — an existing machine-account credential pattern, distinct from per-reviewer identity).
- Contribution route: FOLIO fork (`origin` = `alea-institute/*`, default `main`) → PR to `catholicos/dev` with a linked issue. Never push to a `catholicos` remote.
