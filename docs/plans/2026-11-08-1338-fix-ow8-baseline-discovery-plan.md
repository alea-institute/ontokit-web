---
title: OW-8 Baseline Discovery Repair - Plan
type: fix
date: 2026-11-08
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-plan-bootstrap
execution: code
item: ow-8
kind: planned
---

# OW-8 Baseline Discovery Repair - Plan

## Goal Capsule

- **Objective:** Maintainers can run baseline checks without accidentally selecting hosted persona journeys.
- **Means:** Preserve the existing project-level exclusion and verify it through actual Playwright discovery (KTD1–KTD2).
- **Authority:** The controller's ow-8 mandate and supplied campaign rules govern this item, followed by `AGENTS.md` and the delivery roadmap. The chief repository's `docs/plans/2026-10-26-0705-feat-codex-drawdown-campaign-plan.md` is unavailable in this clone; its Goal Capsule and campaign R11, R15–R20 still require controller reconciliation. They were not independently read.
- **Execution profile:** One item on the supplied `drawdown/ow-8` branch. This stage commits planning documents only. The build stage invokes `lfg` on this plan; the controller scans, pushes and opens the PR against `dev`, and the campaign gate reviews and merges under campaign R15/R17/R19. No remote or GitHub login is added or sought.
- **Stop conditions:** Campaign R11 prohibits spend, credential/security changes, sends, force-push and deletion without verified backup. Never read credential files, `.env*`, `*.pem`, `*.key`, `twin-secrets/` or the prohibited secret store. No schema migration, data rewrite, package release or new outside service is needed.

## Product Contract

### Summary

Verify the repair already carried by this checkout and publish fresh discovery and regression evidence. Make a code change only for a reproduced failure within ow-8.

### Problem Frame

Astra's P1 identified hosted cases leaking into baseline runs because Chromium's project-level `testIgnore` replaces the top-level setting. Those cases require hosted fixtures and therefore break baseline execution. The mandate predates a repair now present in local history, so repeating the patch would not establish current correctness.

### Re-verified starting state

Read-only inspection on November 8 started at clean HEAD `09f68ff9b9fbdaf8b754a92ebd64dd9623f1b5aa` on `drawdown/ow-8`. No tests, builds, discovery commands or runtime probes ran during planning.

| Evidence | Finding |
|---|---|
| Local refs and ancestry | No remote, `drawdown/ow-2` or `origin/drawdown/ow-2` ref exists. The supplied HEAD descends from `5b7f94532644579ab55d0ef59cd263914a77bbd6`, whose subject records ow-2 / PR #72. Preserve this descendant; do not reset or recreate its history. |
| Ow-2 commit contents | `5b7f9453` includes the hosted harness and the later repair titled `fix(e2e): exclude hosted personas from baseline Playwright discovery`. Its historical passing checks are not fresh acceptance. |
| `scripts/e2e/auth-modes.mjs` | `HOSTED_ONLY_SPECS` contains `browser/hosted-personas.spec.ts`; `playwrightProjects('baseline')` includes it alongside foreign-profile specs in Chromium's own ignore list. |
| `playwright.config.ts` | The later project mapping preserves each project's ignore list and appends the synthetic UI exclusion. The original P1 is not apparent in current source. |
| `scripts/e2e/auth-modes.test.mjs` | Existing tests cover registry patterns and real baseline `playwright test --list`, requiring nonempty Chromium discovery and excluding hosted/foreign specs. |
| `scripts/e2e/hosted-suggestions.test.mjs` | An existing synthetic discovery test exercises `playwright.hosted.config.ts` and expects 14 tests in two files without contacting DEV. |
| Historical handoffs | `docs/handoffs/2026-10-03-d10-dev-uat.md` and `docs/handoffs/2026-10-20-sweep-cloud-ontokit-web.md` are present. The named rehearsal/handoff remote refs are absent. Their broader hosted acceptance remains open. |

### Requirements

**Discovery and preservation**

- R1. Actual baseline discovery excludes `browser/hosted-personas.spec.ts` and the specs owned by other profiles while retaining baseline coverage.
- R2. Hosted discovery still selects its persona and suggestion journeys through the dedicated configuration.
- R3. Retain the inherited ow-2 work and every existing test/assertion; any necessary repair receives additive regression coverage.

**Acceptance and delivery**

- R4. The repo's full regression suite and required checks pass on the final candidate; environmental failures or unrun checks remain explicit acceptance gaps.
- R5. Commit public-safe evidence under `docs/plans/evidence/`, update the roadmap, and give the controller a branch that closes the ow-8 repair request with accurate PR #72 provenance.

### Scope Boundaries

Only the discovery defect and its verification belong to this item. Product UI, authentication policy, API contracts, CTT namespace/quotation choices and ALEA AWS provisioning are unchanged. No dependency upgrade or broader harness redesign is planned.

A second ignore-list abstraction or duplicate discovery test is not justified: the registry and regression already exist. Reconsider only if a failing discovery result exposes a missing case. No frontend page changes are planned, so screenshot evidence is not applicable to this repair. Any proposed frontend change falls outside this plan and must retain the campaign's screenshot requirement.

#### Deferred to Follow-Up Work

Genuine D08–D10 hosted UAT remains ow-2's acceptance obligation. FOLIO/Catholic rehearsal, socket hardening, other repair items and broader B02/B03/B11/B13 work retain their existing owners and dispositions.

## Planning Contract

### Key Technical Decisions

- KTD1. **Keep the exclusion where Chromium obtains its effective list.** `scripts/e2e/auth-modes.mjs` owns profile exclusions; `playwright.config.ts` must preserve them when composing projects. The current implementation satisfies this design on inspection. Governs R1, R3.
- KTD2. **Verify through the installed Playwright CLI.** Reuse the existing baseline and hosted discovery regressions, which exercise config loading and project selection. Registry-only assertions cannot prove the effective configuration; discovery cannot prove a real browser journey. Governs R1–R2.
- KTD3. **Preserve the supplied descendant and report the stale repair premise.** Local history already records the repair within PR #72. The controller reconciles original-ref provenance and live PR disposition; no history rewrite or duplicate production patch is warranted. Governs R3, R5.

### Assumptions and dependencies

- **Execution assumption:** the supplied descendant is the controller's intended starting snapshot. Its ow-2 ancestry is verified locally; the original branch tip and live GitHub status are unavailable. The requested PR #72 supersession remains a controller publication obligation, with the merged-history discrepancy disclosed.
- **Execution assumption:** existing discovery regressions can establish the repair without new production code. Their current runtime result is unknown until the build stage.
- The campaign authority excerpt is a controller-owned source gap, not a request for credentials or a Damien taste decision. Reconcile the Goal Capsule and cited R-IDs before build/publication; use the supplied rules for this bounded plan.
- `package.json` pins Playwright 1.63.0 and requires Node at least 22.13.0. The current shell reports Node 22.22.1; the ow-2 receipt records TypeScript-import problems with a prior Node 22 build. Verify the actual available toolchain during execution without changing dependencies to hide failures.
- No API change or hosted account is needed for synthetic discovery. Browser/Docker execution unavailable in this sandbox must run in the controller's existing suitable environment, with results attached to the final candidate.
- Campaign model allocation stays as supplied: local work on Astra, cloud build on its default model, and Astra/Fable gate reviews. Expansion approval/freeze and exhausted-backlog decisions remain settled; this planned repair does not reopen them.

## Implementation Units

### U1. Verify and preserve effective profile isolation

**Goal:** Establish current discovery behavior and repair only a demonstrated ow-8 gap.
**Requirements:** R1–R3; KTD1–KTD3.
**Dependencies:** Controller reconciliation of the missing campaign excerpt; no DEV login dependency.
**Files:** Inspect `playwright.config.ts`, `playwright.hosted.config.ts` and `scripts/e2e/auth-modes.mjs`; use `scripts/e2e/auth-modes.test.mjs` and `scripts/e2e/hosted-suggestions.test.mjs` for proof. Modify only a file required by a reproduced discovery defect.
**Approach:** Start with the existing tests against the current checkout. Preserve the registry-owned hosted exclusion and the config's merge of project exclusions. Extend existing regressions only if the current tests leave a demonstrated gap.
**Patterns to follow:** The existing synthetic run configuration and actual CLI discovery tests. This seam catches test selection/configuration failures, not hosted sign-in or application behavior.
**Execution note:** Capture the current discovery result before editing; an already passing repair should remain intact.

**Test scenarios:**

1. A synthetic baseline run lists nonempty Chromium specs, including normal baseline coverage, with no hosted-persona or foreign-profile cases.
2. Chromium retains its setup dependency and existing exclusions after the configuration adds its UI ignore pattern.
3. A synthetic hosted run discovers the existing 14-case persona/suggestion inventory through the dedicated config without contacting a target.
4. Other profile ownership assertions still pass; any new repair has a regression that fails for the observed defect without weakening existing assertions.

**Verification:** Fresh baseline and hosted discovery succeed using the repository's configuration files. Record whether source changes were necessary.

### U2. Record final verification and hand off publication

**Goal:** Give the controller auditable completion evidence for the inherited repair.
**Requirements:** R3–R5.
**Dependencies:** U1.
**Files:** Create `docs/plans/evidence/2026-11-08-ow-8-baseline-discovery.md`; update `docs/plans/2026-09-20-0649-requirements-delivery-roadmap.md`. Reference the existing ow-2 receipt without rewriting its historical outcomes.
**Approach:** Run the verification contract on the final candidate and record revision, tool versions, exact check results and remaining gaps. Identify `5b7f9453` as the inherited repair. The controller verifies PR #72's actual disposition and links this item's new PR as its repair/verification follow-up, accurately explaining any supersession instead of claiming an already merged PR is still open.
**Patterns to follow:** `docs/plans/evidence/2026-10-26-ow-2-hosted-uat.md` distinguishes synthetic proof from real DEV acceptance.
**Test expectation:** No new behavior in this documentation unit; completion depends on the verification results below.
**Verification:** Evidence contains only safe summaries and repository-relative paths, the roadmap points to the receipt, and controller-owned publication/CI gaps remain visible.

## Verification Contract

These are build-stage gates, not results from planning. Use only generated synthetic inputs for discovery; never open real target, auth-state or credential files.

| Gate | Required evidence |
|---|---|
| Baseline and hosted discovery | Existing CLI-list assertions in `scripts/e2e/auth-modes.test.mjs` and `scripts/e2e/hosted-suggestions.test.mjs`; baseline excludes hosted cases and the hosted inventory remains complete. |
| Harness regression | `test:e2e:profiles`, `test:e2e:hosted-unit`, `test:e2e:ownership`, `test:e2e:evidence`, `test:e2e:identity` and `test:ctt` package scripts all pass. |
| Full application regression | `npm test -- --run` passes; the coverage gate uses the existing `test:coverage` script in run mode as defined by `.github/workflows/release.yml`. Record actual counts. |
| Static checks | `npm run lint` and `npm run type-check` pass; identify pre-existing warnings separately. |
| Production build | `npm run build` passes under the workflow's optional/providerless configuration without reading environment files or using real credentials. |
| Required CI | Controller runs existing workflow and Semgrep checks, including container checks where required, without bypassing protections. Unavailable local Docker/socket checks are not reported as passed. |
| Review and artifact safety | Build simplification/review and campaign Astra/Fable reviews complete; no test deletions, weakened assertions, unrelated changes, private inputs or machine-local paths enter commits. |

Full-stack/hosted journeys remain separate acceptance evidence. The discovery result must not be labeled a successful DEV UAT run. No `release:validate` script exists here and no release is requested.

## Definition of Done

- U1 establishes R1–R3 with current actual discovery results, retaining the already landed repair or correcting only a reproduced gap.
- U2 records R4–R5 against the final candidate and updates the roadmap without closing broader hosted acceptance.
- The diff contains only ow-8 work, no abandoned experimental code and no weakened existing tests.
- The controller reconciles the unavailable chief excerpt, original branch provenance and PR #72's live status, then publishes the reviewed follow-up through the campaign gate.
- This planning stage ends with committed planning documents only; implementation and acceptance are not claimed.
