---
title: Repair the ow-6 Semgrep backtracking finding - Plan
type: fix
date: 2026-11-08
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-plan-bootstrap
execution: code
item: ow-11
mandate_kind: hygiene
delivery_kind: planned
---

# Repair the ow-6 Semgrep backtracking finding - Plan

## Goal Capsule

- **Objective:** Maintainers can deliver the ow-6 rehearsal and accessibility work with its reported security-scan blocker resolved and current regression evidence.
- **Means:** Identify the reported expression, replace its backtracking mechanism without changing its contract, and verify the repaired source under the original detecting rule (KTD1–KTD3).
- **Authority:** The controller's `ow-11` mandate and supplied campaign rules govern this repair. `AGENTS.md` and `docs/plans/2026-09-20-0649-requirements-delivery-roadmap.md` govern repository work. The chief repository's `docs/plans/2026-10-26-0705-feat-codex-drawdown-campaign-plan.md` remains campaign authority; its Goal Capsule and cited R11/R15–R20 are absent from this clone. The controller must supply or reconcile only those sections before implementation.
- **Execution profile:** This stage commits this plan and its roadmap pointer only. The build stage uses `lfg` on `drawdown/ow-11` for implementation, simplification, review and local commits. One controller-owned PR targets `dev`; the controller scans, pushes and publishes, and the campaign gate merges under Campaign R15/R17/R19. No remote or login is added here.
- **Stop conditions:** R6 applies throughout. Missing scan provenance blocks a finding-specific repair claim; failed or unavailable checks leave their acceptance criteria open. The controller owns the execution prerequisites listed below.

## Product Contract

### Summary

Repair the catastrophic-backtracking finding attributed to PR #75 while retaining its delivered work. Add regression proof at the affected helper, run the repository's complete verification gates, and give the controller evidence that distinguishes the original finding from unrelated or unexecuted checks.

### Problem Frame

The mandate identifies a blocking Semgrep finding on ow-6, but the supplied checkout has advanced: `drawdown/ow-11` already descends from the commit labeled PR #75 and several later changes. Neither the original ow-6 branch ref nor the scan report is available. Historical passing receipts cannot prove this checkout passes, and a green diff scan can overlook an issue already present in the baseline.

### Requirements

**Repair and preservation**

- R1. Preserve the inherited ow-6 implementation, tests and evidence, together with subsequent integrated changes. Trace: `ow-11` starting-branch requirement and Campaign R17.
- R2. Resolve the exact backtracking finding reported by PR #75's `scan` job while preserving the affected operation's accepted inputs, output and failure behavior. Match the rule and source location before selecting the production edit.
- R3. Add behavioral and adversarial regressions for the repair without deleting, weakening, skipping or relaxing any existing test or acceptance gate. Trace: `ow-11` and Campaign R15/R16.

**Acceptance and delivery**

- R4. Require the repository's full suite and the controller's `semgrep ci` policy scan to pass with no blocking finding. Confirm the original rule analyzes the repaired file without baseline filtering; record actual failures and unavailable checks separately.
- R5. Commit sanitized repair evidence under `docs/plans/evidence/`. Any frontend change requires a fresh, inspected Playwright screenshot for each changed page and a build-stage `SCREENSHOT: <path>` line; inherited screenshots remain historical evidence. Trace: Campaign R16.
- R6. Follow the supplied campaign boundaries: no credential-file reads or credential discovery, new remote/login, spend, security-setting change, sends in Damien's voice, force-push, or deletion without verified backup. Leave CTT namespace/quotation choices and ALEA AWS provisioning untouched. No schema migration, data rewrite, package release or outside service belongs to this repair. Trace: Campaign R11/R15–R20.

### Key Decisions

- **Keep the assigned hygiene repair bounded.** Governs R1–R3. (session-settled: user-directed — chosen over speculative features: the campaign directs durable hygiene after assigned delivery work.)
- **Use the controller's delivery gates.** Governs R4–R6. (session-settled: user-directed — chosen over holding routine guarded changes for personal review: publication and merge belong to the campaign controller and gate.)

### Scope Boundaries

This item repairs the reported regex defect and adds its proof. It does not reopen ow-6's accessibility scope, upgrade dependencies, alter scan policy or exclusions, or waive existing findings. A general Turtle parser replacement and a new regex engine are considered unnecessary: the candidate is a bounded source-preparation helper. Reconsider only if the confirmed finding cannot be repaired at its current owner while preserving R2.

#### Deferred to Follow-Up Work

Hosted DEV persona/rehearsal acceptance remains with `ow-1`/`ow-2`. The previous ow-6 receipt's genuine-rehearsal, dependency-audit and B13 residuals stay open; this repair does not close them or update CTT decisions.

## Planning Contract

### Re-verified Starting State

Read-only inspection on 2026-11-08 found a clean `drawdown/ow-11` at `09f68ff9b9fbdaf8b754a92ebd64dd9623f1b5aa`, with no remote. No test, scan, installation, build or browser execution ran during planning.

| Surface | Observed evidence | Planning consequence |
|---|---|---|
| ow-6 ancestry | `4e0ed6a62fa95769813703097fa68c24dc8a878b`, titled `ow-6: BAIF rehearsal coverage and accessibility hygiene - Plan (#75)`, is an ancestor of HEAD. | Retain the supplied descendant; do not reset to an unavailable older branch or replay its work. |
| Named refs and campaign source | No `drawdown/ow-6`, `origin/drawdown/ow-6`, or named rehearsal `origin/*` ref exists. Only this repository is supplied. | Use integrated files and the 2026-10-20 handoff for context; reconcile missing campaign sections through the controller. |
| Finding provenance | No saved scan report, rule ID or finding location was found. `semgrep` is absent from PATH. | The first build task establishes the exact target; source suspicion is not proof of the reported finding. |
| Candidate helper | `scripts/ctt/turtle.mjs` contains `mergeTurtle`, whose prefix matcher has overlapping whitespace repetitions around an optional period. Both document suffixes use a trailing-whitespace regex. | Inspect this candidate first, but change it only on U1's evidence. It predates ow-6, entering with `f3228d7b` (PR #68). |
| Existing behavior and callers | `scripts/ctt/ctt.test.mjs` covers prefix conflicts and SPARQL/comment forms. `scripts/ctt/import.mjs` calls the merge, and `scripts/rehearsal/sources.mjs` rebuilds it to verify cached output bytes. | Preserve namespace conflict detection and exact merged bytes; a parser rewrite cannot silently invalidate caches. |
| Scan and tests | `.github/workflows/semgrep.yml` selects policy-based CI when configured and an explicit-ruleset fallback otherwise. `vitest.config.ts` includes only `__tests__`; the helper tests run through `test:ctt`. CI uses Node 24. | Preserve scan configuration and run both Vitest and all hermetic harness suites. |

Historical context: `docs/handoffs/2026-10-20-sweep-cloud-ontokit-web.md`, `docs/plans/2026-10-27-0933-test-ow6-rehearsal-hygiene-plan.md`, and `docs/plans/evidence/2026-10-27-ow6-rehearsal-hygiene.md`. Their results are not fresh acceptance evidence.

### Key Technical Decisions

- KTD1. **Establish finding identity before repair.** Obtain a sanitized rule ID, affected path/location, source revision, engine/rule version and scan scope from the controller's report, or an equivalent branch reproduction. If the named finding is already absent, document the verified resolution instead of inventing a code change. If it targets another owner, revise U2's paths and scenarios before editing. This implements R2 without treating the candidate as confirmed.
- KTD2. **Use deterministic string operations at the confirmed owner.** For the candidate merge helper, prefer a small forward-only scanner with unambiguous delimiter and whitespace consumption. Preserve its current declaration recognition, last-binding behavior and error contract; do not expand the accepted Turtle language. End-only trimming may use `trimEnd()` with the existing newline joining. That equivalence follows from ECMAScript's definitions of regex whitespace and string trimming; byte-level tests must confirm the complete operation. Sources: [ECMAScript character classes](https://tc39.es/ecma262/multipage/text-processing.html#sec-runtime-semantics-compiletocharset), [trimEnd](https://tc39.es/ecma262/multipage/text-processing.html#sec-string.prototype.trimend).
- KTD3. **Separate regression, complexity and scan evidence.** Review forward progress across the whole input, including failed candidate starts. Exercise long near-misses in an owned child Node process with an independent parent deadline, bounded output and hard termination on timeout. Treat spawn failure, timeout and nonzero exit as failures. An ordinary test timeout cannot interrupt synchronous work on its own thread. Runtime timing is a regression guard, not a proof of linear complexity. Sources: [Node ReDoS guidance](https://nodejs.org/en/learn/asynchronous-work/dont-block-the-event-loop#blocking-the-event-loop-redos), [Node 24 test timeouts](https://nodejs.org/download/release/v24.13.0/docs/api/test.html#testname-options-fn), [child processes](https://nodejs.org/download/release/v24.13.0/docs/api/child_process.html#child_processexecfilefile-args-options-callback).
- KTD4. **Verify both the detecting rule and current policy.** R4 needs an exact-rule or full scan without baseline filtering as well as the controller's normal CI gate. Record analyzed targets, rule identity, errors and skipped files; no suppression or exclusion can establish repair. A local Community Edition scan is auxiliary, with failure-on-findings enabled. Current documentation marks `ci --config` unsupported, so check the actual runner version before using the repository's fallback; this is not authorization to edit the workflow. Sources: [Semgrep scan scope](https://docs.semgrep.dev/semgrep-code/glossary), [CLI reference](https://docs.semgrep.dev/cli-reference), [CE scanning](https://docs.semgrep.dev/deployment/oss-deployment).
- KTD5. **Preserve the campaign's model allocation.** Local work uses Astra rather than a Sol-first ladder; cloud build stages use default Sol, with Astra and Fable PR reviews owned by the controller. (session-settled: user-directed — chosen over a uniform model ladder: the campaign assigns models by execution setting.) This plan claims none of those later reviews has run.

### Assumptions and Execution Prerequisites

- The candidate helper is a research lead, not an identified finding. U1 must settle the affected owner before U2 can begin; inability to obtain or reproduce the finding leaves that dependency blocked.
- The controller can provide the missing chief Goal Capsule and cited R11/R15–R20 excerpt without sharing the whole plan or credentials. Reconcile it before implementation and report any material conflict.
- A helper-only repair should not change frontend files or API contracts. If the confirmed finding reaches a frontend path, R5 applies and the plan's test paths must be updated before that edit.
- The available history records PR #75's integration, while the mandate asks for a superseding PR. Preserve history; the controller verifies live PR state and labels the delivery as a follow-up to #75 if already merged. It must not claim an open PR was replaced without evidence.
- Unix sockets are denied here. Any child-process, browser, Docker or policy-scan prerequisite that fails remains an explicit controller verification task. No new Damien decision is presently identified.

## Implementation Units

### U1. Establish the reported finding and preserved baseline

**Goal:** Identify the defect this repair must resolve.

**Requirements:** R1, R2, R4, R6. **Dependencies:** controller campaign excerpt and scan provenance, or an equivalent detecting-rule reproduction.

**Files:** new `docs/plans/evidence/ow-11-semgrep-repair.md`; read-only inspection of the confirmed owner and its tests, initially `scripts/ctt/turtle.mjs` and `scripts/ctt/ctt.test.mjs`.

**Approach:** Apply KTD1/KTD4. Record the starting revision, relevant ancestry, detected rule/location and baseline checks. Distinguish a completed scan with zero findings from unavailable rules, an excluded target, scan failure or baseline filtering. Keep raw reports private and export only public-safe fields.

**Test expectation:** No new behavior in this unit. The original rule's detection on the affected source and the existing suites establish the baseline.

**Verification:** The receipt names the exact finding or establishes that it was already resolved. A missing target is a visible prerequisite, never permission to repair an unrelated regex.

### U2. Remove backtracking and prove compatibility

**Goal:** Preserve the confirmed operation while eliminating the reported costly matching path.

**Requirements:** R1–R3, R6. **Dependencies:** U1's confirmed target.

**Files:** expected `scripts/ctt/turtle.mjs`; additive cases in `scripts/ctt/ctt.test.mjs` and `scripts/rehearsal/rehearsal.test.mjs`. These tests cover merge semantics and source-cache integration; they do not establish hosted or browser acceptance. Amend this unit first if U1 identifies a different owner.

**Approach:** Apply KTD2/KTD3 at the smallest affected helper. Keep new test cases within the existing `test:ctt` entry point. Reuse the synthetic CTT fixtures and rehearsal cache tests; do not fetch live ontology data or change source pins.

**Execution note:** Characterize accepted input and exact output before changing the matcher. Establish the adversarial regression with a killable child so the old expression cannot hang the suite.

**Test scenarios for the candidate:**

1. Compatible host/module bindings still append successfully; default and named prefix conflicts still produce the existing error. Retain all current case-insensitive, SPARQL-style and commented-prefix assertions.
2. Tabs, LF, CRLF, standalone CR, NBSP, BOM and Unicode line/paragraph separators preserve existing recognition, including whitespace spanning physical lines. Cover optional periods, comments and existing duplicate-binding behavior.
3. Empty and whitespace-only documents, documents with no trailing whitespace, and documents with large internal whitespace preserve leading/interior bytes and the exact current separator and terminal newline output.
4. Long whitespace followed by an invalid suffix, missing closing delimiters, and repeated malformed directive starts complete under the independent safety deadline with the characterized result. Include long valid inputs so the repair cannot pass by rejecting everything.
5. Synthetic source preparation and subsequent `verifySources` recomputation agree on the merged bytes and hashes; existing tamper and namespace-conflict failures remain enforced.

**Patterns to follow:** Existing merge tests, CTT fixtures, and `prepareSources`/`verifySources` round trips. Keep the scanner local rather than creating a shared parser abstraction.

**Verification:** New and existing cases pass, the progress argument accounts for near-misses across the whole buffer, and the confirmed Semgrep rule no longer reports the defect on an included target.

### U3. Close verification and controller handoff

**Goal:** Make the repair and all remaining acceptance work independently reviewable.

**Requirements:** R1, R3–R6. **Dependencies:** U1/U2 or U1's verified already-resolved result.

**Files:** `docs/plans/evidence/ow-11-semgrep-repair.md`; `docs/plans/2026-09-20-0649-requirements-delivery-roadmap.md`; fresh PNGs under `docs/plans/evidence/ow11/` only if R5 applies.

**Approach:** Record final source identity, actual commands and outcomes, test counts, matching-rule scan provenance, policy-scan status and residual prerequisites. Preserve inherited screenshot and audit artifacts. Reconcile #75's live status in the controller handoff and apply KTD5's reviews before publication.

**Test expectation:** No synthetic tests for documentation. Use the verification gates below and inspect any required screenshot against the changed source.

**Verification:** The receipt and roadmap distinguish completed work from pending controller checks; local readiness never implies hosted acceptance or successful publication.

## Verification Contract

All commands below are build-stage gates, not results of this plan stage. Use Node 24 as established by `.github/actions/setup-node/action.yml`; preserve coverage, test inventory and timeout settings.

| Gate | Existing command or mechanism | Required evidence |
|---|---|---|
| Focused repair and integration | `npm run test:ctt` | All existing CTT/rehearsal/disposition/hosted-helper cases and the additive regressions pass. |
| Full Vitest suite | `npm test -- --run`; `npm run test:coverage -- --run` | The coverage invocation may supply the full-suite receipt; no failing or skipped case is concealed. |
| Lint and types | `npm run lint`; `npm run type-check` | No errors or new suppression. |
| Hermetic harness | `npm run test:e2e:ownership`; `npm run test:e2e:profiles`; `npm run test:e2e:evidence`; `npm run test:e2e:identity`; `npm run test:e2e:hosted-unit` | Every suite passes, including source fingerprint, discovery and acceptance-inventory checks. |
| Production build | `npm run build` with the credential-free optional-mode configuration in `.github/workflows/release.yml` | Successful build without reading credential files. |
| Detecting-rule scan | KTD4's full or exact-rule scan | Original finding reproduced or independently reconciled, then absent on the repaired included target; no timeout or analysis failure. |
| Required policy scan | Controller-owned `semgrep ci --no-suppress-errors` | Successful completed scan with no blocking findings under the configured policy. |
| Existing CI/runtime gates | `.github/workflows/release.yml`, including Docker build/auth smoke | Controller completes gates the socket-restricted worker cannot run; failures remain failures. |
| Conditional frontend evidence | R5 | Fresh committed Playwright PNG for each changed page, visually inspected and tied to source. |

Keep ow-6's previously unverified full-stack/hosted outcomes distinct from this repair's regression scope. No fixture deletion or automatic cleanup is authorized without the campaign's verified-backup prerequisite.

## Definition of Done

- R1–R3 are satisfied by the confirmed repair and additive regression proof, or the controller accepts U1's evidenced already-resolved disposition.
- R4's full-suite, exact-rule and policy-scan evidence matches the delivered source; all unavailable gates remain open until the controller completes them.
- R5/R6 hold, the roadmap links the evidence, and the diff contains only this item's intended changes with no abandoned experimental code.
- The controller receives `drawdown/ow-11`, this plan, review results and the evidence path for one PR targeting `dev`. The PR explicitly references and supersedes #75's repair scope, or accurately records a follow-up when #75 is already merged.
- Genuine user-only blockers, if any arise, follow Campaign R20's `Needs your decision` format. Missing controller artifacts, runner access and policy execution are controller return conditions rather than requests for new credentials from Damien.
