---
title: Ow15 shortcut regression review repair - Plan
type: fix
date: 2026-11-20
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-plan-bootstrap
execution: code
---

# Ow15 shortcut regression review repair - Plan

## Goal Capsule

- **Objective:** Anonymous phone visitors and authorized editors can reach shortcut help, with regression evidence that lets the controller accept the repaired PR.
- **Means:** Retain the existing opener and additive regression coverage, then execute both browser suites against the final source (KTD1–KTD3).
- **Authority:** The controller's `ow-15` mandate, repository `AGENTS.md`, and `docs/plans/2026-09-20-0649-requirements-delivery-roadmap.md`. Campaign authority is the chief repository's `docs/plans/2026-10-26-0705-feat-codex-drawdown-campaign-plan.md`, limited to its Goal Capsule and cited R11/R15/R16/R17/R18/R19/R20. That document and `ops/drawdown/mandates/_common.md` are absent from this clone; the controller must reconcile those excerpts before build dispatch.
- **Execution profile:** One planned item on `drawdown/ow-15`, continuing the supplied `ow-14` work. This stage commits only this plan. The build stage uses `lfg` for implementation, simplification, review and local commits; the controller scans, pushes and opens one replacement PR targeting `dev`, and the campaign gate merges it.
- **Stop conditions:** Apply R8. A sandbox that denies Chromium cannot provide browser acceptance; the controller must finish that gate on a capable host.

## Product Contract

### Summary

Repair PR #89 by preserving the source-status and shortcut-help regressions while restoring the editor opener already shipped in #87. Put authorized-editor shortcut coverage in its own spec, remove unnecessary inherited artifacts, and supply fresh browser evidence for the final source. The replacement PR supersedes #89, #88 and #85.

### Problem Frame

PR #89 hides #87's ordinary opener on anonymous phones and adds a second control without final-source browser proof. Its test location and inherited plans, receipts and images also make the review harder to assess. Discovery-only results and older screenshots cannot establish that the repaired branch works.

### Requirements

The R-IDs below belong to this plan; references to **campaign R-IDs** identify the separate campaign rules.

**Regression scope**

- R1. Preserve the `ow-14` starting history on `drawdown/ow-15` and retain the additive “In sync” settings regression, including the source-path and missing-path cases.
- R2. Remove the production delta in `app/projects/[id]/editor/page.tsx` relative to #87. A production repair is permitted only after a Playwright run on this branch, using the restored opener at phone width, demonstrates that it is unreachable and records the failure.
- R3. Preserve existing tests and their behavioral guarantees while proving anonymous phone access to shortcut help. Move the authorized-editor case from `e2e/ui/entity-source-preview-evidence.spec.ts` to a spec named for shortcut help, and ensure it remains discoverable.

**Evidence and artifact scope**

- R4. Drop the unnecessary ow-10 and ow-13 plans, receipts and binaries after verifying their recoverable Git backup. Preserve unrelated work and existing historical screenshot bytes; no historical evidence path may be overwritten.
- R5. Execute the complete `ui-tests/` and `e2e/ui/` suites on a Chromium host against the final source, with all cases passing. Listings, filtered subsets and previous runs do not satisfy this requirement.
- R6. Commit fresh editor screenshots at desktop and phone widths under `docs/plans/evidence/ow-15/`, with source identity and actual run results. The build-stage final response names every committed capture as `SCREENSHOT: <path>`.

**Delivery and constraints**

- R7. Pass `npm test` and the repository's full verification suite, update the relevant roadmap entry, and hand the controller a reviewed local branch. The proposed PR title has no `- Plan` suffix, and the final build report explicitly says the new PR supersedes #89, #88 and #85.
- R8. Follow the supplied campaign R11/R15–R20 guardrails: no remote or credential discovery, forbidden-file reads, spend, credential/security-setting changes, messages in Damien's voice, unbacked deletion or force-push. CTT namespace/quotations, ALEA AWS provisioning, dependencies, migrations, data rewrites, package releases, new services and other mandate items remain outside this repair.

### Key Decisions

- **Use the campaign delivery and model allocation.** Governs R7–R8. (session-settled: user-directed — chosen over the Sol-first local ladder and holding expansions for personal review: local work uses Astra, cloud builds use the default Sol, and controller publication retains independent Astra/Fable reviews.) This item is planned; the November 3–6 expansion freeze has elapsed.

### Scope Boundaries

Only the regression tests, their discovery/capture support, mandated artifact cleanup and current evidence are active work. A second help control is not retained speculatively; R2 owns the exception. Hosted persona UAT, rehearsal acceptance, dependency audit and broader roadmap delivery stay with their existing lanes. API behavior and the paired API deployment are unchanged.

## Planning Contract

### Re-verified starting state

These observations are from Git and file inspection on 2026-11-20. No test, build, server or browser ran during planning.

| Evidence | Observation | Consequence |
|---|---|---|
| Supplied branch | Clean `drawdown/ow-15` at `caaa157060ccc457dacce7a6bf2dad8530577bd6`, the ow-14 integration receipt commit | Continue this lineage; do not recreate or cherry-pick the existing work |
| Baseline | Ancestor `a12c78663bcf14b55740fe18077aa876cda3cab3` is the local #87 snapshot | Use it for the repair comparison; the controller verifies actual current `dev` |
| Available refs | No remote, local `dev`, `drawdown/ow-14`, or named rehearsal `origin/*` refs | The supplied history establishes local provenance, not live PR or deployment state |
| Editor delta | One existing button gains anonymous mobile hiding; a second anonymous mobile button is added | #87's ordinary opener already sits outside the mobile-hidden toolbar group |
| Settings tests | `__tests__/app/project-settings-github.integration.test.tsx` checks complete idle text with and without `ontology_file_path`, plus absence during syncing/conflict/error | Preserve this delta and its fixture extension |
| Editor integration tests | `__tests__/app/editor-page.integration.test.tsx` adds anonymous optional/disabled cases and authorized uniqueness coverage | Retarget implementation-specific labels without removing their behavior checks |
| Browser coverage | `ui-tests/demo-polish.spec.ts` has four top-level cases; the two source-preview specs have nine, including the authorized shortcut case | Keep every case when moving the shortcut test |
| Discovery and captures | `playwright.ui.config.ts` explicitly names two spec files; both hardcode `docs/plans/evidence/ow-12` screenshot paths | Extend discovery and redirect both writers before any execution |
| Historical proof | `docs/plans/evidence/ow-14/README.md` reports 5,748 Vitest tests and 296 harness checks, but no final-source browser execution | Treat counts as historical context, not a new pass |

The roadmap's “Resume here” and `docs/handoffs/2026-10-20-sweep-cloud-ontokit-web.md` were inspected. Their wider BAIF/hosted obligations do not expand ow-15. No matching local solutions store or configured Compound Pack supplies additional guidance.

### Key Technical Decisions

- KTD1. **Restore the existing opener before judging its reachability.** Implements R2. Remove only the ow-14 opener delta, preserving #87's containment and toolbar restrictions. The exception needs an actual failed phone interaction with the common `Keyboard shortcuts` control; a stale-label assertion or unavailable browser is not evidence of a product defect.
- KTD2. **Keep behavioral coverage independent of the rejected duplicate.** Implements R1/R3. Preserve all test cases, permissions checks, focus assertions and breakpoint checks. Replace expectations for `Keyboard shortcuts for mobile viewers` with the ordinary accessible name and one-opener assertions. JSDOM proves dialog behavior; Playwright proves visibility, geometry and interaction at a phone width.
- KTD3. **Separate shortcut ownership and preserve capture history.** Implements R3–R6. Move the authorized case intact to `e2e/ui/keyboard-shortcuts.spec.ts` and add it to the explicit `testMatch` list. Use the existing `DEMO_POLISH_EVIDENCE_DIR` override and a matching `OW4_UI_EVIDENCE_DIR` override for every screenshot in both source-preview specs. Give each execution a fresh ignored output directory; publish only the relevant inspected editor images under a fresh ow-15 run directory. Do not run the inherited overwrite-and-restore recipe.
- KTD4. **Prune only verified inherited artifacts.** Implements R4/R7. Verify the named files are recoverable from `caaa1570` and record their Git object identities before removal. Keep that ancestry reachable and preserve any differing working copy. Resolve links in surviving documents to retained evidence or explicit historical Git provenance, without relabeling old runs as current proof.

### Assumptions and execution prerequisites

The controller supplied `caaa1570` as the ow-14 starting tree even though the named ref is absent. No fetch, credential search or branch reset is needed. The controller resolves chief-source and current-dev provenance before build dispatch.

This lane denies Unix sockets, so Chromium and server acceptance must run on a capable controller host. Do not attempt browser launches in this sandbox. On a suitable host, use a credential-free synthetic-data server managed by `e2e/ui/server.mjs` and `ontokit-web.sh`, on a verified unused port. The wrapper refuses an existing PID and avoids the manager's noninteractive force-kill behavior. Close owned browsers, contexts, pages and server after the run.

Phone reachability after restoration is an execution-time finding. If R2's exception is proven, retain the failure's source hash, viewport and output, implement the smallest demonstrated repair, then rerun both complete suites against that final source. No Damien-only decision is known.

## Implementation Units

### U1. Restore the shipped opener and preserve regression intent

**Goal:** Retain the useful tests with the ordinary editor control. **Requirements:** R1–R3, R8. **Dependencies:** starting-tree and authority reconciliation above.

**Files:** `app/projects/[id]/editor/page.tsx`; `__tests__/app/editor-page.integration.test.tsx`; `__tests__/app/project-settings-github.integration.test.tsx`; `ui-tests/demo-polish.spec.ts`.

**Approach:** Apply KTD1 and KTD2. Keep the settings regression unchanged. Adjust only implementation-specific names and descriptions in the editor tests, retaining their cases and strengthening the single-opener assertion where necessary. Preserve unrelated demo-polish and source-preview behavior.

**Execution note:** Establish browser proof of the restored opener before considering a production repair. Prepare U2's capture redirection before running any screenshot-producing case.

**Patterns:** The #87 ordinary opener, existing `Keyboard Shortcuts` dialog, permission-filtered entries and synthetic fixture boundary.

**Test scenarios:**

1. Idle source status renders the full `In sync — source.ttl` text; a missing source path renders exactly `In sync`.
2. Syncing, conflict and error retain their existing status/error expectations and do not render idle status.
3. Anonymous optional and disabled sessions can open help, see general shortcuts, omit add-entity/review actions, dismiss with Escape and regain opener focus.
4. An anonymous 390×844 visitor reaches one ordinary opener, opens a contained dialog and regains focus after dismissal; 767/768px transitions preserve the existing no-overflow, permissions and focus checks.
5. Desktop Shift+Slash opens help, while the same key in the search input types `?` without opening the dialog.

**Verification:** Focused Vitest coverage passes, all inherited assertions retain their behavioral guarantees, and the final production diff is empty unless R2's recorded exception applies. Integration tests miss CSS reachability; U3 supplies that proof.

### U2. Give shortcut tests their own discovery and safe capture paths

**Goal:** Execute the moved case and collect fresh evidence without overwriting history. **Requirements:** R3, R5–R6, R8. **Dependencies:** U1's chosen opener behavior; complete capture routing before runtime checks.

**Files:** `e2e/ui/keyboard-shortcuts.spec.ts` (new); `e2e/ui/entity-source-preview.spec.ts`; `e2e/ui/entity-source-preview-evidence.spec.ts`; `playwright.ui.config.ts`; `ui-tests/demo-polish.spec.ts` (existing capture override).

**Approach:** Apply KTD3. Reuse `e2e/ui/ow4-fixtures.ts` for the authorized session and existing `writes`/`unexpected` assertions. Preserve all source-preview cases and both existing test-match entries. Route every directory creation and screenshot call in both source-preview specs through the override before the first browser run. Direct both suites to distinct fresh paths under `test-results/ow-15/` using the evidence overrides.

**Test scenarios:**

1. The moved authorized test retains 1440, 390, 767, 768 and return-to-1440 widths, exactly one accessible opener, full viewport containment, no overflow, Enter activation, privileged help content, Escape and focus return.
2. Both suites retain zero-write fixture enforcement; authorized reads remain explicitly mocked.
3. Discovery contains the moved test exactly once alongside every original case; the subsequent complete runtime run executes it.
4. The before/after Git identities of historical screenshot directories are unchanged by capture execution.

**Verification:** Type-check and lint cover the moved spec; discovery is a preliminary check only. Browser execution and inspected final-source images are required by U3. These fixtures prove real page behavior with synthetic data, not hosted authentication or API acceptance.

### U3. Trim inherited artifacts and deliver final-source proof

**Goal:** Produce the narrow reviewed change and a truthful acceptance receipt. **Requirements:** R4–R8. **Dependencies:** U1 and U2.

**Files:** Remove `docs/plans/2026-11-08-1441-fix-ow-10-source-status-plan.md`, `docs/plans/2026-11-11-0126-fix-ow13-demo-polish-integration-plan.md`, `docs/plans/evidence/ow-10/README.md`, and the unneeded `docs/plans/evidence/ow-13/` artifacts per KTD4. Update `docs/plans/2026-09-20-0649-requirements-delivery-roadmap.md` and affected references in retained ow-14 planning/evidence documents. Create `docs/plans/evidence/ow-15/README.md` and the relevant captures in its unique run directory.

**Approach:** Verify backups before pruning. Preserve the roadmap's B01–B75 dispositions and unrelated entries, replacing only this repair chain's obsolete continuation text and broken links. Run Verification Contract checks sequentially where CPU contention could create false failures. Record the final source/test commit, commands, exit results, suite counts, browser version, viewports and screenshot hashes in the receipt. Review and simplify only the scoped diff.

**Test expectation:** No additional product tests for documentation cleanup. U1/U2 scenarios and the full gates below establish acceptance; check remaining links and unchanged historical image hashes after execution.

**Verification:** Local checks have final-source passing evidence and the allowed cleanup is backed up before branch handoff. The controller receives the R7 replacement-PR description and any pending host checks. PR-triggered CI, release-workflow checks and independent reviews belong to the controller's pre-merge gate; handing off the branch does not complete the item. Use the proposed title `fix: preserve shortcut-help regressions and verify phone access`. Missing host verification leaves item acceptance open; it is not a reason to request credentials or publish a success receipt.

## Verification Contract

No commands below were executed during this plan stage. Historical counts are not targets to achieve by removing cases, adding skips or relaxing assertions.

| Gate | Build-stage invocation or target | Passing evidence |
|---|---|---|
| Focused regressions | `npm test -- --run __tests__/app/project-settings-github.integration.test.tsx __tests__/app/editor-page.integration.test.tsx` | All retained settings and editor cases pass |
| Full unit suite | `npm test -- --run --maxWorkers=2` | Entire suite passes without overlapping the build |
| Coverage | `npm run test:coverage -- --run --maxWorkers=2` | Existing thresholds and tests pass |
| Static checks | `npm run lint`; `npm run type-check` | No introduced lint errors; types pass |
| Production build | `npm run build` in the repository's credential-free local auth configuration | Successful build without reading credential files |
| Hermetic harness | `test:e2e:ownership`, `test:e2e:profiles`, `test:e2e:evidence`, `test:e2e:identity`, `test:e2e:hosted-unit`, `test:ctt` package scripts | All suites pass; CTT code/content stays unchanged |
| Complete demo-polish UI | `DEMO_POLISH_BASE_URL=http://localhost:3105 DEMO_POLISH_EVIDENCE_DIR=test-results/ow-15/RUN_ID/demo-polish npm run test:ui:demo-polish` | All four existing cases execute and pass on final source |
| Complete source-preview and shortcut UI | `OW4_UI_BASE_URL=http://localhost:3105 OW4_UI_EVIDENCE_DIR=test-results/ow-15/RUN_ID/source-preview npx --no-install playwright test --config playwright.ui.config.ts` | All nine existing cases, including the moved case, execute and pass |
| Committed screenshots | Inspected Playwright editor captures copied byte-for-byte into `docs/plans/evidence/ow-15/RUN_ID/` | `editor-desktop.png` at 1440×900, `editor-mobile.png` at 390×844, plus their open-dialog captures; recorded SHA-256 hashes match originals |
| Review and controller gates | Scoped simplification/review, required CI/Semgrep and release-workflow image checks, independent Astra/Fable reviews | Findings resolved and controller evidence recorded before merge |

`RUN_ID` denotes a new directory for each attempt. The browser commands use the existing server wrapper started with `node e2e/ui/server.mjs 3105` on an unused port; change both base URLs if a different port is necessary. Use no hosted targets or personas. Do not execute these browser commands in the socket-denied lane.

The full browser suites must pass after the last source/test/configuration edit. Keep failure evidence separate from accepted captures. Preserve ow-5, ow-9 and ow-12 evidence bytes; remove ow-13 only through R4's verified backup rule. Do not infer a pass from `--list`, screenshots alone or inherited receipts.

## Definition of Done

- U1–U3 satisfy R1–R8, with the ordinary #87 opener preserved unless the documented R2 exception is proven.
- Both full Chromium suites execute successfully on the final source, and fresh inspected editor images are committed under ow-15.
- Full repository checks pass, review findings are resolved, and abandoned experiments are absent from the diff.
- The roadmap links the current plan and receipt with accurate remaining controller actions; no unrelated delivery claim changes.
- The controller receives the local branch for a PR targeting `dev`, titled without `- Plan`, explicitly superseding #89, #88 and #85.
- The build report names each committed image with `SCREENSHOT:`, then provides `BRANCH: drawdown/ow-15`, this plan's `PLAN:` path and `KIND: planned`. Any genuine Damien-only blocker uses the mandate's `Needs your decision` fields; controller runner/provenance duties are not new Damien decisions.
