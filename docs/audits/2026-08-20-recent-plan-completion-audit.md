# Recent Plan Completion Audit — 2026-08-20

## Scope and method

This audit covers plan artifacts created or changed from 2026-07-30 through 2026-08-20, inclusive. It searched the current tree and every local or remote Git ref after refreshing `origin` and `catholicos`. It also reviewed the roundup master outline, UAT log, surviving handoffs, ALEA pull requests, CatholicOS issues, and the sibling `ontokit-api` history when a web-owned plan assigned units to that repo.

Seven formal plan artifacts were found. Five are visible on `feat/roundup-brainstorm`; two August 13 fix plans exist on the merged `origin/feat/pr-party` history. The root `PLAN-ontology-atomization*.md` documents were excluded because their latest plan history is 2026-03-10, outside the 21-day window.

Completion is derived from commits, merged PRs, tests, UAT evidence, deployed-state evidence, and current external state. Checkbox or prose claims alone do not count.

## Executive result

### Decision implementation closeout — 2026-08-29

This section supersedes the D7–D10 decision-pending and implementation-queue rows
below while preserving the earlier execution history.

- D7 atomic demo-generation publication is merged by
  [API PR #35](https://github.com/alea-institute/ontokit-api/pull/35) as
  `d84b52831e9cd77bdc608018d0c288d342475258`. The design stages a complete
  generation, serializes attempts across hosts, fences stale attempts, and switches
  visibility only after the generation is coherent. API #25 is closed.
- D9 sticky, space-reserving demo notice and D10 conflict-preserving editor behavior
  are merged by [web PR #35](https://github.com/alea-institute/ontokit-web/pull/35)
  as `dcc6326fc2564f1abc353fd4bff590943e32cc49`. Web #24 and #26 are closed.
- D10's final discard-confirmation residual is merged by
  [web PR #37](https://github.com/alea-institute/ontokit-web/pull/37) as
  `bbf8ec3250d86a324f171d667e2d527f5f641411`. It adds explicit cancel,
  confirm, duplicate-submit, success, and failed-reload states; web #36 is closed.
- D10 API compare-and-set, immutable revision/content pairing, atomic Git ref update,
  guarded compensation, and typed conflict contract are merged by
  [API PR #34](https://github.com/alea-institute/ontokit-api/pull/34) as
  `5b355bbca6d9afcd1c43d7bc0c2643dd846071ea`. API #33 is closed.
- API PR #34 passed its full remote matrix after one mypy-only naming correction;
  API PR #35 passed all 2,995 tests plus lint, Pyright, build, Docker preflight, and
  static analysis after its route fixture was updated for the new fail-closed demo
  mutability lookup. Web PR #35 passed 219 files/3,388 tests, type-check, zero-error
  lint, and the production webpack build. Each PR then remained review-clean,
  current-base mergeable, and unchanged through its five-minute babysit window.
- Web PR #37 passed the full remote matrix, remained current-base clean and
  review-backlog-free, and was unchanged for 322 seconds before merge.
- All earlier decisions D1–D10 are settled. Final review discovered two judgment
  calls: D11 retired-demo URL behavior, durably queued in
  [web #34](https://github.com/alea-institute/ontokit-web/issues/34) with
  redirect-to-current recommended; and D12 named activation-queue stewardship,
  queued in [web #38](https://github.com/alea-institute/ontokit-web/issues/38) with
  Damien-as-umbrella-steward recommended.

| Remaining queue after implementation closeout | Durable ALEA authority |
|---|---|
| Execute the already-merged reviewer-PAT ciphertext rewrap after release gates | [API #30](https://github.com/alea-institute/ontokit-api/issues/30) |
| Activate the already-bounded PR Party answerer after demo-readiness, private credential, installation-approval, and outreach gates | [API #26](https://github.com/alea-institute/ontokit-api/issues/26) |
| Create/seed demo repositories and activate atomic refresh after credential, scan, cron, and live-write gates | [API #31](https://github.com/alea-institute/ontokit-api/issues/31) |
| Bound retired demo-generation storage with a D11-compatible, rollback-safe retention policy | [API #32](https://github.com/alea-institute/ontokit-api/issues/32) |
| Choose stable retired-demo URL behavior (D11) | [web #34](https://github.com/alea-institute/ontokit-web/issues/34) |
| Assign a named steward to the recurring activation queue (D12) | [web #38](https://github.com/alea-institute/ontokit-web/issues/38) |
| Authenticated DEV acceptance and live auto-accept proof | [web #27](https://github.com/alea-institute/ontokit-web/issues/27) |
| `ontokit.org` picker and domain gate | [web #28](https://github.com/alea-institute/ontokit-web/issues/28) |
| Held CatholicOS delivery | [web #30](https://github.com/alea-institute/ontokit-web/issues/30) |
| Parallel PROD rehearsal | [API #27](https://github.com/alea-institute/ontokit-api/issues/27) |
| Domain-triggered Google federation | [API #28](https://github.com/alea-institute/ontokit-api/issues/28) |
| First verified safe `folio-python` release at or above 0.4.0 | [API #29](https://github.com/alea-institute/ontokit-api/issues/29) |

No CatholicOS, AWS, DNS, DEV, PROD, demo repository, credential store, OAuth console,
cron, or other live service was mutated during this closeout. Optional mode without
Zitadel remains supported.

### Final ALEA closeout refresh — 2026-08-28

This section supersedes every older local-only or publication-pending statement below; the older receipts remain as execution history.

- All seven in-window plans and all 52 formal units remain accounted for exactly once.
- The autonomous ALEA implementation is merged: [web PR #25](https://github.com/alea-institute/ontokit-web/pull/25) and [API PR #24](https://github.com/alea-institute/ontokit-api/pull/24). Their implementation trackers, web #23 and API #23, are closed.
- Final web evidence: 217 files/3,365 tests, type-check, zero-error lint, optional-without-Zitadel release-fidelity build, and no actionable structured-review findings.
- Final API evidence: 2,932 tests passed with 32 external-fixture skips; Ruff, formatting, Pyright 0/0, one Alembic head `g5h6i7j8k9l0`, remote CI, and all 12 validated final-review findings applied.
- Every uncompleted operational, trigger-gated, cross-organization, or judgment-dependent unit now has one ALEA issue with an explicit activation condition. No plan task remains only in chat or an untracked local branch.

| Remaining queue | Formal units covered | Durable ALEA authority |
|---|---|---|
| Demo banner placement | U9 browser polish | Completed by [web PR #35](https://github.com/alea-institute/ontokit-web/pull/35); web #24 closed. |
| Whole-document concurrency boundary | Cross-tab/editor integrity residual | Completed by [API PR #34](https://github.com/alea-institute/ontokit-api/pull/34) and [web PR #35](https://github.com/alea-institute/ontokit-web/pull/35); API #33/web #26 closed. |
| Authenticated DEV acceptance and live auto-accept proof | Roundup U7; acceptance tails for U9/U12 | [web #27](https://github.com/alea-institute/ontokit-web/issues/27) |
| `ontokit.org` picker and domain gate | Roundup U17 | [web #28](https://github.com/alea-institute/ontokit-web/issues/28) |
| Held upstream delivery | Roundup U11/U14 and CatholicOS delivery tails | [web #30](https://github.com/alea-institute/ontokit-web/issues/30) |
| Demo refresh atomicity, repositories, credentials, and live activation | Roundup U8/U9 | Atomicity completed by [API PR #35](https://github.com/alea-institute/ontokit-api/pull/35); live activation moved to [API #31](https://github.com/alea-institute/ontokit-api/issues/31). |
| PR Party answerer context and external activation | Roundup U16 | [API #26](https://github.com/alea-institute/ontokit-api/issues/26) |
| Parallel PROD rehearsal | Roundup U10/U12/U13/U15 | [API #27](https://github.com/alea-institute/ontokit-api/issues/27) |
| Domain-triggered Google federation | Google federation U1–U3 | [API #28](https://github.com/alea-institute/ontokit-api/issues/28) |
| First verified safe `folio-python` release at or above 0.4.0 | Completion-plan U15 / API #209 tail | [API #29](https://github.com/alea-institute/ontokit-api/issues/29) |
| Ledger, Decision Sheet, and durable handoff publication | Roundup U18 / completion-plan U16 | Completed through the merged documentation series; [web #22](https://github.com/alea-institute/ontokit-web/issues/22) is closed. |

D7–D10 were the four remaining judgment/taste questions at this 2026-08-28
checkpoint; all were settled on 2026-08-29 and D7/D9/D10 are merged. D11 and D12
are the only current judgment calls. All other current rows are activation or retention gates.
Optional mode without Zitadel remains supported. No CatholicOS, AWS, DNS, DEV, PROD,
credential, or external-organization mutation occurred during this final ALEA closeout.

### Execution refresh — 2026-08-24

This refresh supersedes the local-only publication statements below while preserving their historical test receipts. T4 through T8 are now synthesized on isolated current-upstream branches and pushed to ALEA. T9 documentation is dispositioned in `docs/roundup-2026-08/T9-DOCUMENTATION-DISPOSITION.md`. No CatholicOS repository, deployment, AWS resource, DNS record, PROD system, or external organization asset was changed.

| Tranche | Web ALEA head | API ALEA head | Current disposition |
|---|---|---|---|
| T4/T5 foundation | `6890216b` | `1029cd26` | Reviewed archival branches pushed. |
| T5 PR Party | `4083e906` | `07ccdc39` | Synthesized and pushed; live activation remains gated. |
| T6 translations | `bafce3da` | `334df1b1` | Synthesized, corrected, verified, and pushed. |
| T7 editor/annotations | `a8140836`, `ab9988db` | `355c66e3` | Synthesized, verified, and pushed; authenticated UI/live acceptance remains gated. |
| T8 residuals | `93f0c62a` | `d26e63cd` | Audit, deterministic storage, page-module build repair, annotation parity, and audit-API hardening synthesized, verified, and pushed. |

The earlier PyPI premise was wrong: the official `folio-python` project currently lists 0.3.6 as its latest release. The 0.4.0 dependency commit is therefore not deliverable and remains queued behind the exact activation condition “PyPI publishes a verified `folio-python` 0.4.0 release.”

- **37 of 52 formal plan units are complete on shared integration history.** Two more formal units—the U7 audit tail and annotation serialization tail—are implemented and fully tested on the local `fix/plan-audit-web-residuals` branch, pending publication/integration. Roundup U13 Stage A and U14's initial map/drafts are also implemented locally but are not yet complete units.
- **13 formal units remain queued or gated.** Ten belong to the roundup plan, including strict U11/U12 acceptance gaps, and three belong to the trigger-gated Google federation plan.
- All enumerated review/execution residuals are now implemented and tested on local isolated branches, including web #348/#359/#360 and API #208/#209/#211/#212. The paired T3 seam is synthesized onto the current CatholicOS cutoffs at API `1b8bde28` and web `2c6a7813`; remaining tranche synthesis, publication, and live acceptance are separate gates.
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
| U14 upstream delivery map | **Local deliverable complete; send gated** | `docs/roundup-2026-08/UPSTREAM-DELIVERY-MAP.md` accounts for all 277 cutoff commits and the post-cutoff deltas. Complete T1 candidates are green: API `d2c31aea` passes 1,580 tests/Ruff/mypy; web `4986135c` passes 2,798 tests/type/lint/build while preserving optional no-Zitadel mode. `tranche-drafts/FINAL-BATCH-MANIFEST.md` now supplies the held issue-first linkage and scope briefs for T2–T10. A final base refresh/replay is intentionally deferred to the authorized batch; nothing has been sent. |
| U15 AWS PROD rebuild | **Blocked** | SSH to 54.224.195.12:22 remains closed/filtered on 2026-08-20. PROD itself returns HTTP 200. Requires Mike/AWS access and the rollout-mechanism decision. |
| U16 PR Party live E2E | **Local activation package complete; live gate blocked** | `docs/roundup-2026-08/pr-party/HELD-ACTIVATION-PACKAGE.md` holds the unsent answerer issue/PR, org-owner checklist, reviewer outreach, integrity receipt, and both-flow-plus-Q&A runbook. D5 is no longer an undecided disposition: the operator-safe ciphertext rewrap is reviewed and green locally at API `f3c4251d`. Live execution still requires demo readiness, controlled deployment/key-rotation handling, reviewer PAT intake, org webhook, answerer workflow, shared generation token, and an authorized E2E window. |
| U17 ontokit.org picker | **Blocked** | Registration was selected, but public RDAP returns not found and authoritative NS/A lookups return no records as of 2026-08-21. Picker work remains held until registration and DNS control are externally observable. |
| U18 closeout | **Partially complete** | The real-seam learning, decision sheet, durable handoff, and held final-batch manifest exist. Final closeout still depends on gated activation/live acceptance and the authorized upstream batch. |

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

**Result: all U1–U3 remain intentionally trigger-gated.** The user replaced the earlier login-friction-only trigger with resolution of the CatholicOS-side and ALEA-side domain-name questions. That condition has not cleared. CatholicOS API #206 remains the backlog record, and execution also requires a Google OAuth client and its secret. This is queued conditional work, not a missed current commitment.

### 6. U7 Sweep Bugs

**Plan:** `docs/plans/2026-08-13-001-fix-u7-sweep-bugs-plan.md` at Git object `4cd3c0df`

| Unit | Result | Evidence or queue disposition |
|---|---|---|
| U1–U2 federated logout | Complete | Commit `cbe58a0b`, regression tests, ALEA web PR #18, deployed DEV proof. |
| U3–U5 suggester save | Complete | Commit `5826c7f5` covers class, property, and individual handlers; ALEA web PR #18, deployed DEV proof. |
| U6 audit residuals | **Complete on ALEA; CatholicOS delivery queued** | Source commit `6f5ee59f` is included in merged ALEA web PR #25. Focused tests, type-check, zero-error lint, and the optional-without-Zitadel production build pass. CatholicOS delivery is tracked in web #30. |

CatholicOS issues #344 and #345 remain open because the ALEA fixes have not been delivered upstream. That does not invalidate the plan’s ALEA PR and DEV Definition of Done, but it belongs to the upstream-delivery queue.

### 7. Annotation Data Loss

**Plan:** `docs/plans/2026-08-13-002-fix-annotation-data-loss-plan.md` at Git object `8040c149`

| Unit | Result | Evidence or queue disposition |
|---|---|---|
| U1 indexed label-property fix | Complete | API commit `8a6575d1`; ALEA API PR #22 merged. |
| U2 indexed/RDFLib parity proof | Complete for the scoped allowlist | API regression coverage merged; broader predicate parity became API #212. |
| U3 round-trip-safe class writer | Complete | Web commit `72ee0522`; ALEA web PR #19 merged; 13 multilingual altLabels preserved in live DEV UAT. |
| U4 serialization churn | **Complete on ALEA; CatholicOS delivery queued** | Source commit `1697e5e7` is included in merged ALEA web PR #25; 127 focused Turtle/detail-panel tests, type-check, and zero-error lint pass. CatholicOS delivery is tracked in web #30. |

CatholicOS issue #361 remains open pending upstream delivery.

## Additional open work discovered by the audit

| Item | Authority | Disposition |
|---|---|---|
| Audit UI hardening | CatholicOS/ontokit-web#348 | Synthesized in pushed ALEA web T8 head `93f0c62a`; CatholicOS delivery remains. |
| Deterministic Node 25 test storage | CatholicOS/ontokit-web#359 | Synthesized in pushed ALEA web T8 head `93f0c62a`; plain Node 25 tests pass without caller flags. |
| Server-side Zitadel issuer fail-fast | CatholicOS/ontokit-web#360 | Synthesized from `5ef55edc` into the pushed ALEA T5–T8 web chain; optional-without-Zitadel remains supported and configured/required OIDC fails coherently without a localhost fallback. |
| Audit API integration hardening | CatholicOS/ontokit-api#208 | Synthesized in pushed ALEA API T8 head `d26e63cd`; project-bound cursors reject cross-project replay and the focused audit suite passes 216 tests with 12 expected real-database skips. |
| Full annotation-path parity | CatholicOS/ontokit-api#212 | Synthesized in pushed ALEA API T7 head `355c66e3`; cold and indexed paths share declaration-aware classification. |
| Pin `folio-python` and remove `owlready2` | CatholicOS/ontokit-api#209 | **Queued, not deliverable.** PyPI still tops out at 0.3.6, so source commit `a990b231` was deliberately excluded. Activate only after a verified 0.4.0 release and fresh compatibility/security proof. |
| Restore production-build validity | Local build evidence | Synthesized in pushed ALEA web T8 head `93f0c62a`; the production build succeeds with no Zitadel configuration and a required disposable NextAuth signing secret. |
| T3 provider-network hardening | Final-batch T3 security ledger | Implemented locally in API `a4be506b`: exact-origin private-provider authorization, resolve-once DNS-answer pinning, metadata/redirect refusal, and safe outbound failure reporting. Publication/integration remains. |
| T3 project-analysis serialization | Final-batch T3 security ledger | Implemented locally in API `5a67885f`: one active job per project, deterministic queue identity, atomic lease lifecycle, cancellation-safe retry behavior, and ambiguous-enqueue reconciliation. Publication/integration remains. |
| T3 structured conflict UX | Final-batch T3 web acceptance | Implemented locally in web `a272c8dc`: raw structured errors remain available to existing consumers while project-analysis conflicts show safe, actionable messages. Publication/integration remains. |
| T3 paid-call reservation and audit | Final-batch T3 security ledger | Implemented locally in API `35a25c56` and `f89b8222`: paid embeddings, provider connection tests, and ordinary generation reserve conservative spend atomically before provider actuation; successful calls reconcile to actual usage, while failure/cancellation receipts and finalization-outage alerts remain budget-visible. |
| T3 provider-key KDF | Final-batch T3 security ledger | Implemented locally in API `a48e534b`: LLM and embedding provider keys share a domain-separated HKDF-SHA256 derivation, while legacy ciphertext remains decryptable for in-place migration. |
| T3 limiter expiry recovery | Final-batch T3 security ledger | Implemented locally in API `92c7e2b8`: trust and PR Party counters use non-extending `EXPIRE NX`, so a crash between increment and expiry cannot create a permanent block. |
| T3 embedding and vector-index integrity | Final-batch T3 security ledger | Implemented locally in API `d7477474` and `738f20a6`: paid-provider transitions validate before mutation; full refreshes build a private retry-safe snapshot and atomically activate it only if the source revision is unchanged; incremental writes use conflict-safe upserts; persisted dimensions are enforced; and valid dimension-specific HNSW indexes back known provider sizes. |
| T3 degraded-gate alerting | Final-batch T3 security ledger | Implemented locally in API `367145b2`: validation/dedup fail-soft paths emit stable structured alert events and exclude raw tenant labels and exception detail. |

## Current external-state receipts

- `origin/feat/pr-party` is 113 web commits ahead of refreshed `catholicos/dev`.
- `origin/feat/pr-party` is 164 API commits ahead of refreshed `catholicos/dev`.
- `https://ontokit.openlegalstandard.org/` returns HTTP 200.
- `https://ontokit.dev.openlegalstandard.org/health` returns `{"status":"healthy"}`.
- TCP 22 to 54.224.195.12 is closed or filtered from the home box.
- Public RDAP returns not found for `ontokit.org`, and authoritative NS/A lookups return no records as of 2026-08-21.
- PyPI lists `folio-python` 0.3.6 as the latest release as of 2026-08-24. No 0.4.0 distribution is available, so the dependency change remains parked.

## 2026-08-20 autonomous execution receipt

The local `fix/plan-audit-web-residuals` branch contains five focused commits based on ALEA integration head `83b62b0b`: `6f5ee59f`, `fea85b6b`, `5ef55edc`, `1697e5e7`, and `4a4dc5bf`. Verification on the final tree: 208 test files and 3,298 tests pass; `npm run type-check` passes; `npm run lint` reports zero errors and 19 pre-existing warnings; the optional-auth production build succeeds with 24 static pages; `git diff --check` passes. The branch is local only—not pushed or merged.

The durable local API branch `fix/recent-plan-api-residuals` ends at `0a54857a` with six commits after ALEA integration: audit-cursor binding, annotation parity, FOLIO dependency replacement, truthful deploy status/preflight, dormant gated production promotion, and the immutable release pair. With a secure test secret, disposable Git path, real PostgreSQL, and Redis, the complete API suite passes 2,738 tests. Ruff, mypy across 182 source files, both deploy harnesses, lock validation, and diff checks pass. The branch is local only—not pushed or merged.

The child API branch `feat/demo-refresh-scaffold` adds commit `e894f20f`. Its six focused tests pass, including a real local Git refresh that updates only `main` and preserves an existing `demo-work` branch. Ruff, formatting, mypy, diff checks, and the no-token fail-closed invocation pass. Ambient Git credential helpers are disabled so the eventual destination push cannot silently use a broader stored credential. No demo repository, token, cron, host, or project was created.

The child API branch `feat/demo-project-isolation` ends at `b5b13d8f`. Its earlier final tree passed all 2,760 API tests against disposable PostgreSQL, plus Ruff and strict mypy; after the response-contract follow-up, all 86 project-service unit tests pass and the exact demo-repository response test is green. A repeat of the real provisioning test was environment-blocked because PostgreSQL was no longer listening, not by an assertion failure. The web branch `feat/demo-project-ui` ends at `d7e490ec`; all 210 test files and 3,298 tests pass, type-check passes, and lint reports zero errors with 19 existing warnings. A local browser pass verified the entry panel in light and dark themes; populated, unavailable, source-link, banner, and return states are covered deterministically. Both branches are local only. No repository, token, host, DEV write, or external state changed.

The API branch `fix/pr-party-credential-rewrap` adds local commit `f3c4251d`. It implements the selected D5 operator control with dry-run default, exact apply confirmation at CLI and worker boundaries, stable mode-specific job IDs, all-row transactional `MultiFernet` rotation, SQL-parameter redaction, and counts/UUID-only receipts. Seventy-eight focused unit tests and two disposable real-Postgres integration tests pass; Ruff, authoritative mypy, advisory Pyright, and diff checks are green. The branch is local only. No stored credential was read, changed, pushed, deployed, or rotated.

The held T3 branches now contain nine API commits from `a4be506b` through `738f20a6` on `fix/t3-security-api`, plus web commit `a272c8dc` on `fix/t3-security-web`. The final two API commits are `f89b8222` (ordinary-generation reservation) and `738f20a6` (atomic vector snapshots and dimension-safe ANN). The generation slice passes 54 focused tests; the final vector-adjacent slice passes 137 unit tests; and five disposable real-PostgreSQL tests prove concurrent spend serialization, migration/index validity, distinct snapshot row IDs, and duplicate-detection behavior. Ruff, strict mypy, advisory Pyright, and diff checks pass. The web full suite passes 208 files/3,295 tests; type-check, changed-file ESLint, and diff checks pass. Inline reuse, quality, and efficiency review tightened the final vector unit; the dedicated multi-agent code-review path was unavailable under the session's no-subagent constraint. The API's broad synchronous `TestClient` route harness still stalls on its first anonymous-route case in this environment, so it is not claimed as passing. Both branches are local only—not pushed or merged—and no external or runtime state changed.

The API T3 delivery seam is now synthesized on `upstream-queue/t3-api-synthesis` at `1b8bde28`, based on the green T1 synthesis head `d2c31aea`. The synthesis preserves the 22-commit T3 feature foundation and applies the reviewed hardening as one file-seam checkpoint. Its empty-database Alembic upgrade reaches the single `c2d3e4f5g6h7` head; 154 focused non-`TestClient` unit tests, four directly invoked route-hardening tests, and two disposable real-PostgreSQL vector-integrity tests pass. Ruff, formatting, and diff checks pass. A normal targeted mypy run clears the T3 sources and reports only the pre-existing FOLIO import-annotation mismatch in `structural_similarity_service.py`; the synchronous `TestClient` collection still stalls and is not claimed green. The branch is local only—not pushed or merged.

The web T3 delivery seam is synthesized on `upstream-queue/t3-web-synthesis` at `2c6a7813`, based on T1 synthesis `4986135c`. Conflict resolution preserves T1 anonymous proposal behavior while adding T3 LLM configuration, suggestions, metering UX, safe-error handling, retry opt-out, and editor integration. It also retains the reviewed Next.js page-module extraction and excludes the historical mixed `.claude` artifact. All 175 test files and 2,891 tests pass; type-check passes; lint reports zero errors and 18 warnings; and the optional/no-Zitadel production build succeeds with 22 static pages. A read-only fetch confirmed CatholicOS `dev` remains web `c714c74b` and API `a21b7d5c`, so both T3 candidates descend from the current upstream heads. Both synthesis branches are local only—not pushed or merged.

T2 is synthesized as a local pair on API `upstream-queue/t2-api-synthesis` at `56800cda` and web `upstream-queue/t2-web-synthesis` at `256d2344`, each based on its green T1 candidate. The API seam includes the complete DEV IaC/CI foundation, current pinned Actions with least-privilege checkout, truthful deploy preflight/status, immutable release manifest, isolated write smoke, and a visibly dormant fail-closed PROD promotion workflow; historical scratch reports are excluded. The deploy harness passes 8/8 cases, the promotion harness 6/6, all six manifest unit tests pass, workflow YAML and shell syntax parse, Ruff/format/diff checks pass, and Compose validates without resolving the intentionally absent runtime env file. The web workflow YAML parses and makes Codecov uploads best-effort. Both branches are local only—not pushed or merged—and no environment, credential, AWS, GitHub setting, DEV, or PROD state changed.

The held publication choreography now includes `docs/roundup-2026-08/tranche-drafts/FINAL-BATCH-MANIFEST.md`. It defines issue-first ordering, one-owner link semantics, dependent-PR stacking/retarget rules, proposed titles/scopes for T2–T10, security and UX closure gates, a crash-safe correlation journal, exact stop conditions, and the final no-self-merge checklist. A seven-persona local document review corrected duplicate tranche ownership, accidental picker/demo coupling, unsafe publication-resume behavior, incomplete credential/deploy gates, and acceptance-contract drift. The independent cross-model pass was not retried because its earlier external-export authorization was denied. The manifest grants no CatholicOS, GitHub-configuration, credential, AWS, DNS, DEV, or PROD mutation authority.

## 2026-09-06 march-through addendum

Post-march state verified by the orchestrator on 2026-09-06 under `docs/plans/2026-09-05-1153-chore-recent-plan-march-through-plan.md`; the earlier entries above remain historical receipts.

**U19 — Complete.** The gate register was filed on 2026-09-05. Decision Sheet batches are on the Cockpit under `ontokit-web-2026-09-05-1719-march-dev-hard-blocks` (B11, B1, B13), `ontokit-web-2026-09-05-1720-march-repo-hard-blocks` (B12, B2), `ontokit-web-2026-09-05-1722-march-judgment` (B3=D11, B4=D12, B5, B6, B9), and `ontokit-web-2026-09-05-1723-march-tasks` (B7, B8). As of 2026-09-06 none has a submitted answer; B6 carries provisional mark `mark-20260905T173214-f70e1b` (recommendation: yes, `dev` is the line; freeze `feat/pr-party`).

**U1 — Complete (2026-09-05).** Nine held branches scanned clean and were pushed to ALEA at their tips. T3 API tip `6692f0f4` is on `upstream-queue/t3-api-synthesis`; the manifest-cited `1b8bde28` is its ancestor.

**U7 — Complete (2026-09-05; re-done 2026-09-06 after each merge).** Local web `dev` carries four `.planning` auto-save commits rebased onto `origin/dev`; local API `dev` fast-forwards cleanly. Both canonical checkouts are on `dev` at or ahead of `origin/dev`.

**U2 — Complete.** ALEA web #42 merged `b83c50c1` on 2026-09-05. With the API Dependabot cooldown in API #36 (merged `3201775d`), push-event Semgrep on `dev` is green on both forks (R5) and stayed green after every later merge.

**U3 — Complete.** API #36 merged `3201775d` on 2026-09-05: `folio-python` 0.4.0, `owlready2` removed, OSV clean, install and regression run green. ALEA API #29 closed with the receipt.

**U4 web — Complete.** ALEA web #43 merged `4cbe4d4c` on 2026-09-06. Ledger `docs/audits/2026-09-05-pr-party-dev-parity-ledger.md` on `dev`: 191 rows and 15 removed exports, 17 carry / 154 dev supersedes / 20 drop; 17 paths carried (accepted-suggestion provenance bridge, PROV-O emission, missing-issuer logout guard, server-issued beacon token, public issuer, regression tests). Findings F1 (auth-disabled capability routing) and F2 (provider Docker build args) stay `dev supersedes` pending review. Review: ce-code-review run `20260906-101232-439dc65a`, independent Codex adversarial pass, four findings applied (`f9d0e7fe`).

**U4 API — Complete.** ALEA API #37 merged `df3d2f79` on 2026-09-06. Ledger on `dev`: 240 rows and 14 removed-symbol candidates, 13 carry / 200 dev supersedes / 17 superseded by U5 / 10 drop; Alembic lineage of all 41 frozen revisions recorded (35 identical, 5 same id different content, 1 superseded; `dev` head `h6i7j8k9l0m1`), status-constraint values equal set for set. Headline carry: `dev` called a nonexistent `git_service.commit_to_branch` at all three suggestion-save sites (hidden by a type-ignore and test mocks); saves now call `commit_changes`. Three policy findings (VALID-04 namespace policy, editor review authorization, entity kinds in mint gates) stay `dev supersedes` pending review. Review: run `20260906-103407-cbc7d2dd`, seven findings applied (`cce04250`); two pre-existing findings recorded in the PR (prod compose default Zitadel masterkey/admin password; submit-path budget errors unmapped).

**U5 — Complete.** ALEA API #38 merged `aab70cbb` on 2026-09-06: T2 deploy seam (`56800cda`) replayed byte-identical with modes, manifest pinned to API `435dc393` / web `83b62b0b`, push trigger still `feat/pr-party`, no `Deploy DEV` run started. One inherited defect was fixed: the promotion job's `runner.temp` job-level env moved to a resolve-paths step; actionlint clean. The live write-path `smoke-release.sh` run is deferred to U9's deploy receipt.

**U20 — Complete.** ALEA API #39 merged `503e90d4` on 2026-09-06: `deploy-dev.yml` now triggers on pushes to `dev` restricted to `deploy/release-manifest.json`; `workflow_dispatch` consumes no inputs. No run started (the merge did not change the manifest). B6 provisional mark `mark-20260905T173214-f70e1b` was recorded before the merge.

**U8 — Complete.** `docs/roundup-2026-08/DEV-UAT-RUNBOOK-web27.md` committed on this branch (`920a9cda`). Finding for U10: the quiet-period floor is one day, so the auto-accept proof needs a multi-day observation window; a single sitting cannot prove it.

| Unit | Disposition | Evidence |
|---|---|---|
| U19 | Complete | Four Cockpit batches filed 2026-09-05; stems and B6 provisional mark recorded above. |
| U1 | Complete | Nine clean-scanned branches published to ALEA; T3 API tip `6692f0f4`, ancestor `1b8bde28`. |
| U2 | Complete | ALEA web #42 `b83c50c1`; API #36 `3201775d`; push-event Semgrep green on both forks after every merge. |
| U3 | Complete | API #36 `3201775d`; clean OSV, install, and regression receipts; ALEA API #29 closed. |
| U4 | Complete | Web #43 `4cbe4d4c`, API #37 `df3d2f79`; parity ledgers and review receipts above. |
| U5 | Complete | API #38 `aab70cbb`; byte-identical T2 seam with modes, pinned pair, actionlint clean; live smoke deferred to U9. |
| U6 | Complete | This addendum, Decision Sheet status, T3 manifest update, and `docs/handoffs/2026-09-06-march-through-handoff.md`; two superseded handoffs retired. Cockpit on-deck queue remains orchestrator-owned. |
| U7 | Complete | Both canonical `dev` checkouts reconciled after each merge; four web auto-save commits preserved by rebase. |
| U8 | Complete | UAT runbook `920a9cda`; multi-day auto-accept observation requirement recorded. |
| U20 | Complete | API #39 `503e90d4`; manifest-restricted `dev` trigger, no dispatch inputs, no run started; B6 provisionally marked. |
| U9 | Queued on B11, B12, B1 | DEV reset and deploy await the named gates. |
| U10 | Queued on U8, U9, B5 | U8 complete; authenticated acceptance and multi-day auto-accept proof await U9 and B5. |
| U11 | Queued on B2 | CatholicOS T1 replay and issue-first send await renewed authority. |
| U12 | Queued on U9, B8 | Demo repositories and atomic refresh await deploy and provisioning. |
| U13 | Queued on U9, B13 | Reviewer-PAT ciphertext rewrap awaits deploy and the authorized operator window. |
| U14 | Queued on B3/D11 | Retired demo URL behavior and retention await the recorded choice. |
| U15 | Queued on B4/D12 | Activation-queue stewardship awaits the recorded choice. |
| U16 | Queued on B7 | Picker activation awaits the registration task. |
| U17 | Queued on U5, B9 | U5 complete; parallel PROD rehearsal awaits B9. |
| U18 | Queued on U12, E1-E3 | PR Party external activation awaits demo readiness and external receipts. |
