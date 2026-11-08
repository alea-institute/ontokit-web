---
title: Restore ow-10 source-status regression proof - Plan
type: fix
date: 2026-11-08
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-plan-bootstrap
execution: code
item: ow-10
kind: expansion
---

# Restore ow-10 source-status regression proof - Plan

## Goal Capsule

- **Objective:** Maintainers can trust the regression evidence for the ow-5 demo polish and its source-sync status display.
- **Means:** Reproduce the reported assertion failure on the supplied history, preserve the displayed status contract, and supply precise regression coverage (KTD1–KTD3).
- **Authority:** The controller's ow-10 mandate, the chief campaign's `docs/plans/2026-10-26-0705-feat-codex-drawdown-campaign-plan.md` Goal Capsule and campaign R11, R15–R20, then `AGENTS.md` and the repository roadmap. The chief file and `ops/drawdown/mandates/_common.md` are unavailable in this clone; their wording is not independently verified. The controller must reconcile those excerpts before publication.
- **Execution profile:** One expansion on `drawdown/ow-10`, with one controller-owned PR targeting `dev`. This stage commits planning documents only. Build, review and publication are later work under R6.
- **Stop conditions:** R7 governs the hard stops. Keep independent work moving and report an unmet runtime or publication prerequisite without claiming it passed.

## Product Contract

### Summary

Repair the reported “In sync” test failure while retaining the ow-5 work and every existing test obligation. Record fresh verification against the actual branch, including whether the reported failure still exists.

### Problem Frame

The mandate reports that PR #74 fails because a source-status assertion no longer matches rendered markup. The supplied checkout has moved: it includes a commit named for #74, later demo fixes, and no source-status test containing that assertion. Historical pass counts cannot establish the current result. The build must distinguish a stale report from a reproducible defect before changing behavior.

### Requirements

These R-IDs belong to this plan; **campaign** prefixes identify the controller's rules.

**Repair and preservation**

- R1. Retain the inherited ow-5 work and later changes while addressing only ow-10.
- R2. The GitHub Integration status must continue to show “In sync” for idle, with the source filename when present, and distinct syncing, conflict and error messages.
- R3. Add precise regression proof for the reported status contract; do not delete, skip or weaken any existing test or its assertions.

**Verification and delivery**

- R4. `npm test` and the repository's full suite pass on the final source, with fresh results and any unavailable gate explicitly recorded.
- R5. Any frontend change has a real Playwright screenshot of each changed page committed under `docs/plans/evidence/`, identified as `SCREENSHOT: <path>` in the build handoff (campaign R15–R16).
- R6. Keep local commits on `drawdown/ow-10`; the controller scans, performs the Astra/Fable reviews, pushes and opens the PR that supersedes #74, and the campaign gate merges (campaign R15, R17, R19). Preserve the 2026-11-03 through 2026-11-06 expansion freeze (campaign R18).
- R7. Respect the supplied campaign hard stops and public-safe writing rule (campaign R11, R20): no remote or credential discovery, forbidden-file reads, spend, security changes, messages in the user's voice, unbacked deletion or force-push. CTT choices, ALEA provisioning, migrations, data rewrites, package releases and new services are outside this item.

### Key Decisions

- **Guarded expansion delivery.** Governs R5–R6. (session-settled: user-directed — chosen over holding expansions for personal review: the campaign gate handles verified expansions.)
- **Continue without waiting on the user.** Governs R6–R7. (session-settled: user-directed — chosen over waiting for availability: campaign work proceeds autonomously.)
- **Keep the assigned scope.** Governs R1. (session-settled: user-directed — chosen over speculative features after planned work runs out: later work becomes durable hygiene.)

### Scope Boundaries

The repair concerns source-status assertions and any demonstrated rendering defect they expose. The existing demo polish, including its webhook race repair and six screenshots, stays intact. A settings-page redesign, generic status component, test-library upgrade and webhook rewrite are not warranted by this report; reconsider only if reproduction identifies a directly relevant defect.

Other drawdown items, hosted persona acceptance, broader B34 work and dependency audits remain with their assigned lanes. This repair does not close those roadmap obligations.

## Planning Contract

### Verified Starting State

Static inspection on 2026-11-08 started with a clean `drawdown/ow-10` at `09f68ff9b9fbdaf8b754a92ebd64dd9623f1b5aa`. No tests, application build, server or browser ran during planning.

| Surface | Verified evidence | Consequence |
|---|---|---|
| Branch ancestry | `ad170cfd` is an ancestor of HEAD and is titled `ow-5: First-visit demo polish for ow-5 - Plan (#74)` | Preserve the controller-provided branch; no reset or duplicate cherry-pick |
| Missing refs | Neither `drawdown/ow-5` nor `origin/drawdown/ow-5` exists; no remote is configured | The requested original branch tip cannot be compared locally; controller reconciliation remains explicit |
| Rehearsal context | `f3228d7b` and `43783d39` are in inherited history; `docs/handoffs/2026-10-20-sweep-cloud-ontokit-web.md` records the rehearsal and keep-both decision | Remote rehearsal refs are absent; no rehearsal or CTT edits belong here |
| Visible idle state | `app/projects/[id]/settings/page.tsx` renders “In sync” in a paragraph, with an optional nested filename span | Matching the complete status needs to account for nested text |
| Existing status coverage | `__tests__/app/project-settings-github.integration.test.tsx` covers syncing, conflict and error, but its status table has no idle row | Add idle coverage without replacing the other rows |
| Reported assertion | Searches of the current tests found no source-status “In sync” assertion; `RemoteSyncIndicator` tests instead check the separate “In sync with remote” accessible label | Treat the reported failing line as unlocated, not as a reproduced defect |
| Inherited changes | The GitHub settings test and settings page have no diff between `ad170cfd` and HEAD | Do not invent a later rendering change as the cause |
| Browser evidence | `playwright.demo-polish.config.ts`, `ui-tests/demo-polish.spec.ts` and `docs/plans/evidence/ow-5/README.md` exist | Reuse the local suite; its historical results are not current proof |

The governing roadmap is `docs/plans/2026-09-20-0649-requirements-delivery-roadmap.md`. The prior implementation scope is in `docs/plans/2026-10-26-1426-feat-ow-5-demo-polish-plan.md`. Both retain their existing dispositions.

### Assumptions and Deferred Checks

- The supplied descendant branch is the controller's intended continuation of ow-5. Its ancestry preserves integrated work, but does not prove equivalence to an unavailable original branch tip.
- A test-only repair is likely sufficient. Fresh execution determines whether any production rendering change is needed.
- This checkout's #74 commit suggests the publication request may be stale. The controller must inspect the live PR state and document supersession, or an explicit repair follow-up if #74 is already merged. No live PR status has been checked here.
- Unix-socket restrictions may prevent browser or container checks. Such a failure leaves the affected acceptance gate open for a capable controller runner; old screenshots or unit tests do not replace it.

### Key Technical Decisions

- KTD1. **Use current behavior as the starting evidence.** Reproduce before modifying anything. If the original failure is absent, retain passing code and add the missing idle-status characterization rather than reconstructing a defect from the mandate. Reconcile a materially different controller-supplied failing test before changing it.
- KTD2. **Assert the complete visible status in its own section.** Follow the existing `section()` helper and real settings-page integration harness. Select the status element within GitHub Integration and verify its normalized text, including the nested filename. Do not replace exact obligations with a broad page-wide substring, a first-match selector or an existence-only assertion.
- KTD3. **Keep the repair local.** Prefer test changes in `__tests__/app/project-settings-github.integration.test.tsx`. Change `app/projects/[id]/settings/page.tsx` only for a demonstrated visible-status defect under R2. Keep API payloads, permissions, query timing and the inherited webhook effect unchanged.
- KTD4. **Keep browser evidence separate from hosted acceptance.** If KTD3 needs a page change, extend the existing local Playwright suite with an isolated settings case and synthetic HTTP/session responses. Its current fixture is anonymous and cannot exercise manager settings without that test-only setup. Reject unexpected requests and mutations, and add no application auth bypass. This proves the page's rendering, not real OIDC or DEV acceptance.
- KTD5. **Retain campaign execution choices.** Local work uses Astra; cloud build stages use the Codex Cloud default Sol and retain Astra/Fable reviews. (session-settled: user-directed — chosen over the Sol-first local ladder and cloud model overrides: the campaign settled these choices.)

No backend change or new dependency is needed. Existing scoped settings queries and exact text-content assertions in the repository provide the local patterns for this repair; external framework research would not resolve the missing runtime failure.

## Implementation Units

### U1. Reconcile and cover the source-status assertion

**Goal:** Give the idle source status precise regression proof while preserving R1–R3.

**Dependencies:** None. Follow KTD1–KTD3 and KTD5.

**Files:** Extend `__tests__/app/project-settings-github.integration.test.tsx`; conditionally repair `app/projects/[id]/settings/page.tsx`. Use the existing fixture and `section()` helper in the test file.

**Approach:** Record the untouched focused and full test results before editing. Locate any reported failure in that output and compare its intended contract with the actual status element. Preserve the existing connection-payload, authentication-header, retry and other status checks. Add the idle cases below and repair only a confirmed mismatch. If baseline execution passes, record that fact and deliver additive characterization; do not claim a reproduced bug was fixed.

**Execution note:** Characterize the status and reproduce the reported failure before changing its assertion or markup.

**Test scenarios:**

1. An idle connected repository with `ontology_file_path: source.ttl` shows one status paragraph containing both “In sync” and “— source.ttl”, even though the filename is nested.
2. An idle connection without a source filename shows exactly “In sync”, with no dangling separator or missing-value placeholder. Extend the local fixture options to represent this case.
3. Syncing, conflict and error retain their current messages and error-detail assertions, and show no idle success status.
4. The repaired idle assertion still fails for a missing/wrong filename or missing success label; verify the assertion targets the status rather than the separate source-file summary. A controlled local mutation check may supply this proof, with the original tracked content restored before final verification.

**Test seam:** The real page plus mocked HTTP responses catches status selection and nested DOM text; it does not prove remote GitHub synchronization or browser layout.

**Verification:** The focused suite and final full regression pass without skips or reduced assertions. A before/after comparison accounts for every pre-existing test case.

### U2. Record fresh verification and controller delivery evidence

**Goal:** Make R4–R7 reviewable for the final source.

**Dependencies:** U1. Follow KTD4–KTD5.

**Files:** Create `docs/plans/evidence/ow-10/README.md`; update only the ow-10 entry in `docs/plans/2026-09-20-0649-requirements-delivery-roadmap.md`. If a page changes, extend `ui-tests/demo-polish.spec.ts` and its local fixtures as needed and add `docs/plans/evidence/ow-10/settings-source-status.png`. Preserve the ow-5 screenshots and their dated receipt.

**Approach:** Record the source revision, exact commands, result counts, reproduction outcome, test-preservation review and remaining gates. Use the existing verification commands below. Keep any browser-only owner fixture isolated from the existing anonymous cases. Use an owned, unused local port and `ontokit-web.sh`; its noninteractive force behavior must not kill a neighboring server.

**Test scenarios:**

1. The existing four demo-polish browser cases still pass against final source, covering project recovery, editor help and hydration review persistence/export.
2. If production markup changes, the real settings page displays the synthetic idle status and source path before a Playwright capture. Inspect the image and commit its repo-relative path in the receipt and build handoff.
3. A socket or container restriction is recorded as an unrun/failed environment gate, never a passing suite; the controller runs that gate on the same final source before acceptance.

**Verification:** The evidence distinguishes tests run locally, historical evidence and controller-owned work. Controller publication identifies #74 explicitly and resolves the live-state discrepancy described above.

## Verification Contract

These gates belong to the build stage. Use the lockfile and supplied dependency cache; no package upgrade is in scope.

| Gate | Existing command or proof | Required outcome |
|---|---|---|
| Baseline and final Vitest | `npm test -- --run` | Record current results; final suite passes with no removed/skipped tests |
| Focused status regression | `npm test -- --run __tests__/app/project-settings-github.integration.test.tsx` | U1 scenarios pass, with the wrong/missing status checks demonstrably discriminating |
| CI coverage suite | `npm run test:coverage -- --run` | Full existing coverage run passes; preserve thresholds/configuration |
| Static checks | `npm run lint`; `npm run type-check` | No introduced errors |
| Production build | `npm run build` in the existing credential-free optional mode from `.github/workflows/release.yml` | Build succeeds without reading environment or credential files |
| Harness unit checks | `npm run test:e2e:ownership`, `npm run test:e2e:profiles`, `npm run test:e2e:evidence`, `npm run test:e2e:identity`, `npm run test:ctt`, `npm run test:e2e:hosted-unit` | Existing suites pass; use the documented restrictive umask for harness checks |
| Local browser proof | `npm run test:ui:demo-polish` against an owned local server | Existing four cases pass; any added settings case and R5 screenshot pass |
| Campaign/CI gates | Existing Semgrep, Docker image checks and Astra/Fable review | Controller runs unavailable gates without changing protections or finding credentials in this clone |
| Diff and receipt | `git diff --check`, test-case comparison and image inspection when applicable | Only ow-10 changes, truthful public-safe evidence, R1/R3/R7 preserved |

The build receipt must record any worker concurrency limit and why it was used. Resource tuning cannot hide a failed test. Hosted rehearsals remain separate lane obligations. There is no `release:validate` script or package release in scope.

## Definition of Done

- U1 satisfies R1–R3, with the reported failure either reproduced and repaired or truthfully recorded as absent with additive regression proof.
- U2 supplies fresh final-source evidence for R4–R5. A blocked browser or CI gate remains open until the controller supplies its result.
- The local commits preserve unrelated work and contain no abandoned experiments, test weakening, new service or forbidden change.
- The roadmap links this plan and actual evidence without marking unrelated B-IDs complete.
- R6 is complete only after controller publication and documented #74 disposition. This planning commit alone does not satisfy implementation or publication acceptance.
- No Damien-only decision is currently identified. Any newly discovered essential decision uses the mandate's `## Needs your decision` fields; missing chief excerpts, refs and runtime capacity are controller work.
