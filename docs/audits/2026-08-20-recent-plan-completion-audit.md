# Recent Plan Completion Audit — 2026-08-20

## Scope and method

This audit covers plan artifacts created or changed from 2026-07-30 through 2026-08-20, inclusive. It searched the current tree and every local or remote Git ref after refreshing `origin` and `catholicos`. It also reviewed the roundup master outline, UAT log, surviving handoffs, ALEA pull requests, CatholicOS issues, and the sibling `ontokit-api` history when a web-owned plan assigned units to that repo.

Seven formal plan artifacts were found. Five are visible on `feat/roundup-brainstorm`; two August 13 fix plans exist on the merged `origin/feat/pr-party` history. The root `PLAN-ontology-atomization*.md` documents were excluded because their latest plan history is 2026-03-10, outside the 21-day window.

Completion is derived from commits, merged PRs, tests, UAT evidence, deployed-state evidence, and current external state. Checkbox or prose claims alone do not count.

## Executive result

- **37 of 52 formal plan units are complete on shared integration history.** Two more formal units—the U7 audit tail and annotation serialization tail—are implemented and fully tested on the local `fix/plan-audit-web-residuals` branch, pending publication/integration. Roundup U13 Stage A and U14's initial map/drafts are also implemented locally but are not yet complete units.
- **13 formal units remain queued or gated.** Ten belong to the roundup plan, including strict U11/U12 acceptance gaps, and three belong to the trigger-gated Google federation plan.
- All five additional review/execution follow-ups are now implemented and tested on local isolated branches: web #359/#360 and API #208/#209/#212. Publication, upstream synthesis, and live acceptance remain separate gates.
- The current upstream delta is **277 commits**, not the stale “~690” estimate: 113 web commits and 164 API commits ahead of `catholicos/dev`.

## Formal plan ledger

### 1. OntoKit Roundup Execution

**Plan:** `docs/plans/2026-08-08-001-feat-ontokit-roundup-execution-plan.md`

| Unit | Result | Evidence or queue disposition |
|---|---|---|
| U1 F3 validation and 422 detail | Complete | DEV UAT log records successful mint/save/submit; API red-then-green evidence and gates green. |
| U2 default-branch reads | Complete | Symbolic-HEAD fix and curl parity recorded in the UAT log. |
| U3 public projects list | Complete | Web fix `3aacf5e9`; browser verification in the UAT log. |
| U4 browser UAT sweep | Complete | F7/F8 fixed and a clean happy-path sweep recorded. |
| U5 suggestion lifecycle UAT | Complete | Duplicate block, external parent, personal branch, PR, merge, and trust credit recorded live. |
| U6 retrospective alignment review | Complete | `docs/residual-review-findings/2026-08-08-retrospective-alignment-review.md` plus five lens reports; confirmed high findings were dispositioned. |
| U7 Zitadel persona pass | Complete | `DEV-UAT-LOG.md` “U7 TERMINAL”; four-persona sweep and author/committer split proven. |
| U8 dummy repositories and refresh | **Local refresh scaffold complete; activation gated** | API branch `feat/demo-refresh-scaffold` at `e894f20f` adds the exact two-route manifest, separate-token enforcement, default-branch-only force refresh, README receipt, serialized resync hook, inert cron example, and a real-Git proof that demo-authored branches survive. U9's database resync executable now exists on `feat/demo-project-isolation`; the two private repos, scoped tokens, manual receipt, host installation, and live cron remain. |
| U9 cloned-project demo mode | **Local implementation complete; live acceptance gated** | API branch `feat/demo-project-isolation` at `b5b13d8f` adds migrations, idempotent provisioning/resync, immutable source/destination identity, a single project-aware outbound-target authorizer, exact demo-repository response identity, and refusal tests. Web branch `feat/demo-project-ui` at `d7e490ec` adds home and source-project entry, server-truth badges/banner, exact resettable-repository naming, source return, unavailable/preparing states, and tests. Web has 210 files/3,298 tests green, type-check green, and lint at zero errors/19 existing warnings. Real repository creation, live writes, credential-scope proof, responsive/keyboard UAT, and deployment remain gated on U8 activation. |
| U10 auto-save preference | Complete | ALEA web PR #17 merged; store migration and browser behavior verified. |
| U11 fork CI | **Partially complete** | Both integration branches run their real suites and recorded green real-seam CI, but the source plan also requires an intentionally red draft proof and required status checks on the deploy branch. Both `feat/pr-party` branches are currently unprotected, so the workflows are not merge gates. |
| U12 DEV deploy and IaC | **Partially complete** | ALEA API PRs #17–#21 merged; forced-command deploy is installed and DEV deploys are approval-gated. Local commit `abff6256` fixes #211 by validating before mutation and reporting immutable running revisions. Strict completion still depends on U8/U11, deployment of the fix, U8 cron IaC, and live matched-revision/rollback/security proof. |
| U13 PROD promotion workflow | **Stage A implemented locally; Stage B gated** | API commits `2bc46f03` and `0a54857a` add an immutable matched-release manifest, successful-DEV-deploy proof, isolated write smoke, protected-environment contracts, and dormant automatic promotion. No AWS, GitHub configuration, secret, DEV write, PROD, or DNS mutation occurred. Parallel stand-up/UAT/cutover remains gated. |
| U14 upstream delivery map | **Local deliverable complete; send gated** | `docs/roundup-2026-08/UPSTREAM-DELIVERY-MAP.md` accounts for all 277 cutoff commits and the post-cutoff deltas. Complete T1 candidates are green: API `d2c31aea` passes 1,580 tests/Ruff/mypy; web `4986135c` passes 2,798 tests/type/lint/build while preserving optional no-Zitadel mode. A final base refresh/replay is intentionally deferred to the authorized issue-first batch; nothing has been sent. |
| U15 AWS PROD rebuild | **Blocked** | SSH to 54.224.195.12:22 remains closed/filtered on 2026-08-20. PROD itself returns HTTP 200. Requires Mike/AWS access and the rollout-mechanism decision. |
| U16 PR Party live E2E | **Local activation package complete; live gate blocked** | `docs/roundup-2026-08/pr-party/HELD-ACTIVATION-PACKAGE.md` now holds the unsent answerer issue/PR, org-owner checklist, reviewer outreach, integrity receipt, and both-flow-plus-Q&A runbook. Live execution still requires demo readiness, the reviewer-PAT encryption-rewrap disposition, PAT intake, org webhook, answerer workflow, shared generation token, and an authorized E2E window. |
| U17 ontokit.org picker | **Blocked** | DNS returns NXDOMAIN on 2026-08-20. The permitted availability preflight is complete; registration remains a human purchase. |
| U18 closeout | **Partially complete** | The real-seam learning and decision-sheet infrastructure exist. Final closeout still depends on U13/U14 and refreshed external-gate tracking. |

### 2. Multilingual Translation Annotations

**Plan:** `docs/plans/2026-08-09-001-feat-translations-annotation-plan.md`

**Result: all U1–U14 complete.** API commits implement the provenance store, configuration, engine, OWL axiom annotations, gated commits, jobs, backfill, coverage, review authorization, and real-seam lifecycle proof. Web commits implement U10–U13. ALEA API and web PR #12 merged into `feat/pr-party` on 2026-08-10. The real-Postgres/git integration module `tests/integration/test_translation_lifecycle.py` covers the plan’s AE1–AE5 lifecycle.

### 3. N-Day Auto-Accept Closure Audit

**Plan:** `docs/plans/2026-08-09-002-audit-intent2-auto-accept-closure.md`

**Result: complete as scoped.** The generic suggestion-session mechanism, admin configuration, and UI merged through the translation branches into `feat/pr-party`. The plan correctly excluded translation review. A dedicated live quiet-period UAT remains desirable operational evidence, but it is not missing product implementation from this closure audit.

### 4. Submission Audit Snapshot

**Plan:** `docs/plans/2026-08-09-003-feat-submission-audit-snapshot-plan.md`

**Result: all U1–U6 complete.** API commits `a859c205`, `b07c803c`, `208907e9`, `a2c8bc82`, and review fix `8b0541cc` implement storage through the real-seam proof. Web commits `6951dc43`, `486157c1`, `deed6eef`, and `7711470a` implement the client, cursor hook, audit section, and review fixes. ALEA PR #13 merged in both repos.

**Residual queue:** CatholicOS API #208 and web #348 contain non-blocking review hardening not required by the original Definition of Done. Web #348 is also the conditional U6 tail in the later U7 sweep-fix plan.

### 5. Google Federation via Zitadel

**Plan:** `docs/plans/2026-08-10-001-feat-google-federation-zitadel-plan.md`

**Result: all U1–U3 remain intentionally trigger-gated.** No evidence shows the activation condition—live user login friction—has fired. CatholicOS API #206 remains open as the backlog record. Execution also requires a Google OAuth client and its secret. This is queued conditional work, not a missed current commitment.

### 6. U7 Sweep Bugs

**Plan:** `docs/plans/2026-08-13-001-fix-u7-sweep-bugs-plan.md` at Git object `4cd3c0df`

| Unit | Result | Evidence or queue disposition |
|---|---|---|
| U1–U2 federated logout | Complete | Commit `cbe58a0b`, regression tests, ALEA web PR #18, deployed DEV proof. |
| U3–U5 suggester save | Complete | Commit `5826c7f5` covers class, property, and individual handlers; ALEA web PR #18, deployed DEV proof. |
| U6 audit residuals | **Implemented locally; integration pending** | Local commit `6f5ee59f` centralizes `formatTimeAgo`, adds erasure fallbacks, aligns the type contract, and removes the empty type-only test. Full web gates pass on `fix/plan-audit-web-residuals`; the branch is not pushed or merged. |

CatholicOS issues #344 and #345 remain open because the ALEA fixes have not been delivered upstream. That does not invalidate the plan’s ALEA PR and DEV Definition of Done, but it belongs to the upstream-delivery queue.

### 7. Annotation Data Loss

**Plan:** `docs/plans/2026-08-13-002-fix-annotation-data-loss-plan.md` at Git object `8040c149`

| Unit | Result | Evidence or queue disposition |
|---|---|---|
| U1 indexed label-property fix | Complete | API commit `8a6575d1`; ALEA API PR #22 merged. |
| U2 indexed/RDFLib parity proof | Complete for the scoped allowlist | API regression coverage merged; broader predicate parity became API #212. |
| U3 round-trip-safe class writer | Complete | Web commit `72ee0522`; ALEA web PR #19 merged; 13 multilingual altLabels preserved in live DEV UAT. |
| U4 serialization churn | **Implemented locally; integration pending** | Subject-form preservation was already present in the #361 fix. Local commit `1697e5e7` adds source-aware preservation for unchanged untagged labels and proves a comment edit changes only the comment. Full web gates pass; the branch is not pushed or merged. |

CatholicOS issue #361 remains open pending upstream delivery.

## Additional open work discovered by the audit

| Item | Authority | Disposition |
|---|---|---|
| Audit UI hardening | CatholicOS/ontokit-web#348 | Implemented locally in `6f5ee59f`; publication/integration remains. |
| Deterministic Node 25 test storage | CatholicOS/ontokit-web#359 | Implemented locally in `fea85b6b`; plain Node 25 suite passes. Publication/integration remains. |
| Server-side Zitadel issuer fail-fast | CatholicOS/ontokit-web#360 | Implemented locally in `5ef55edc`; preserves optional-without-Zitadel and removes the localhost fallback. Publication/integration remains. |
| Audit API integration hardening | CatholicOS/ontokit-api#208 | Implemented locally in `a31ebf78`; project-bound cursors reject cross-project replay. |
| Full annotation-path parity | CatholicOS/ontokit-api#212 | Implemented locally in `4a4db9c9`; cold and indexed paths share declaration-aware classification with real-PostgreSQL parity proof. |
| Pin `folio-python` and remove `owlready2` | CatholicOS/ontokit-api#209 | Implemented locally in `a990b231`; exact 0.4.0 pin, compatible lock, fallback tests, and no new dependency vulnerabilities. |
| Restore production-build validity | Local build evidence | Implemented locally in web `4a4dc5bf`; `AUTH_MODE=optional npm run build -- --webpack` succeeds with 24 static pages. |

## Current external-state receipts

- `origin/feat/pr-party` is 113 web commits ahead of refreshed `catholicos/dev`.
- `origin/feat/pr-party` is 164 API commits ahead of refreshed `catholicos/dev`.
- `https://ontokit.openlegalstandard.org/` returns HTTP 200.
- `https://ontokit.dev.openlegalstandard.org/health` returns `{"status":"healthy"}`.
- TCP 22 to 54.224.195.12 is closed or filtered from the home box.
- `ontokit.org` returns DNS NXDOMAIN.
- PyPI lists `folio-python` 0.4.0, released 2026-08-18; the tested local API branch pins it exactly and removes `owlready2`.

## 2026-08-20 autonomous execution receipt

The local `fix/plan-audit-web-residuals` branch contains five focused commits based on ALEA integration head `83b62b0b`: `6f5ee59f`, `fea85b6b`, `5ef55edc`, `1697e5e7`, and `4a4dc5bf`. Verification on the final tree: 208 test files and 3,298 tests pass; `npm run type-check` passes; `npm run lint` reports zero errors and 19 pre-existing warnings; the optional-auth production build succeeds with 24 static pages; `git diff --check` passes. The branch is local only—not pushed or merged.

The durable local API branch `fix/recent-plan-api-residuals` ends at `0a54857a` with six commits after ALEA integration: audit-cursor binding, annotation parity, FOLIO dependency replacement, truthful deploy status/preflight, dormant gated production promotion, and the immutable release pair. With a secure test secret, disposable Git path, real PostgreSQL, and Redis, the complete API suite passes 2,738 tests. Ruff, mypy across 182 source files, both deploy harnesses, lock validation, and diff checks pass. The branch is local only—not pushed or merged.

The child API branch `feat/demo-refresh-scaffold` adds commit `e894f20f`. Its six focused tests pass, including a real local Git refresh that updates only `main` and preserves an existing `demo-work` branch. Ruff, formatting, mypy, diff checks, and the no-token fail-closed invocation pass. Ambient Git credential helpers are disabled so the eventual destination push cannot silently use a broader stored credential. No demo repository, token, cron, host, or project was created.

The child API branch `feat/demo-project-isolation` ends at `b5b13d8f`. Its earlier final tree passed all 2,760 API tests against disposable PostgreSQL, plus Ruff and strict mypy; after the response-contract follow-up, all 86 project-service unit tests pass and the exact demo-repository response test is green. A repeat of the real provisioning test was environment-blocked because PostgreSQL was no longer listening, not by an assertion failure. The web branch `feat/demo-project-ui` ends at `d7e490ec`; all 210 test files and 3,298 tests pass, type-check passes, and lint reports zero errors with 19 existing warnings. A local browser pass verified the entry panel in light and dark themes; populated, unavailable, source-link, banner, and return states are covered deterministically. Both branches are local only. No repository, token, host, DEV write, or external state changed.
