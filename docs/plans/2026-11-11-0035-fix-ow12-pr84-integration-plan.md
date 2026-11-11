---
title: Ow12 PR84 integration on current dev - Plan
type: fix
date: 2026-11-11
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-plan-bootstrap
execution: code
---

# Ow12 PR84 integration on current dev - Plan

## Goal Capsule

**Objective:** Reviewers can accept the entity-source preview on both project pages with passing regression checks and inspectable browser evidence on current `dev`.

**Means:** Integrate PR #84's supplied commit range, preserve the shipped preview, and close the remaining browser gate (KTD1–KTD3).

**Authority:** The controller's `ow-12` mandate governs this item. Repository `AGENTS.md` and `docs/plans/2026-09-20-0649-requirements-delivery-roadmap.md` govern its execution. Campaign authority remains the chief repository's `docs/plans/2026-10-26-0705-feat-codex-drawdown-campaign-plan.md`, Goal Capsule and Campaign R11/R15/R16/R17/R18/R19/R20. That document and `ops/drawdown/mandates/_common.md` are absent from this clone; their contents have not been verified. The controller must reconcile those excerpts before build dispatch. This plan uses the campaign rules supplied with the mandate.

**Execution profile:** One planned item on `drawdown/ow-12`, one controller-published PR targeting `dev`. This stage commits planning documentation only. The later build runs `lfg` on this plan for implementation, simplification, review, verification and local commits. The controller scans, pushes and opens the replacement PR; the campaign gate owns merging. The replacement PR supersedes #84 and #73.

**Stop conditions:** If `2ffc92d2e46c60d821774349f1e83d1769f88cfe` becomes unavailable, stop and report the missing commit rather than delivering a plan-only replacement. R7 governs all safety boundaries. A failing or unavailable required check prevents acceptance.

---

## Product Contract

### Summary

Carry PR #84's viewer coverage and screenshots onto the current base without losing newer work. Resolve reproduced source-preview failures, retain every existing assertion, and provide fresh evidence for both real page routes.

### Problem Frame

The supplied PR head contains genuine editor and viewer captures, but its receipt records a failing 768px page-overflow assertion. Three passing capture cases do not establish full browser acceptance. The original `ow-4` production implementation is already integrated in the supplied base, while PR #84's additional test and fixture changes are not. Replacing the current tree with the PR tree would discard newer `ow-11` documentation.

### Requirements

**Integration and preservation**

- R1. Integrate the complete merge-base-to-`2ffc92d2e46c60d821774349f1e83d1769f88cfe` commit range onto `drawdown/ow-12`, preserving current `dev` plus PR #84's intent. Trace: `ow-12`, Campaign R17.
- R2. Retain the PR's executable test/fixture changes and inherited production preview, together with all existing tests and assertions. The final change must contain executable changes, not only planning or receipt files. Trace: `ow-12`, Campaign R15/R16.

**Browser behavior and evidence**

- R3. Pass the complete source-preview browser suite on the resulting revision, including its existing 768px document-width assertion and subsequent navigation checks. Correct demonstrated defects necessary to that gate without weakening tests.
- R4. Preserve all seven PR #84 PNGs and their historical provenance, and commit fresh Playwright captures for each changed page under `docs/plans/evidence/`. Report committed images as `SCREENSHOT: <path>` in the build-stage final response. Trace: `ow-12`, Campaign R16.
- R5. Pass the full repository regression and verification gates defined below on the final application/test revision. Neither old results nor socket-denied runs count as passes.

**Delivery and boundaries**

- R6. Update the relevant roadmap entries and provide the controller a reviewable local branch whose replacement PR explicitly supersedes #84 and #73. Trace: `ow-12`, Campaign R19/R20.
- R7. Follow the supplied campaign hard stops: no remote or credential discovery, credential-file reads, spend, credential/security-setting changes, sends, unbacked deletion or force-push. CTT namespace/quotation decisions and ALEA AWS provisioning remain untouched. No schema migration, data rewrite, package release or outside service is required. Trace: Campaign R11/R15–R20.

### Scope Boundaries

This item integrates the named PR and repairs only failures needed to satisfy R2–R5. In particular, the earlier `ow-9` plan's exclusion of layout repair cannot waive `ow-12`'s full-suite gate. A reproduced preview-layout defect is in scope; a broader mobile redesign is not.

#### Deferred to Follow-Up Work

Hosted DEV rehearsal, D08–D10 persona acceptance and backend socket work retain their existing lane owners. B24–B27 graph/overlay work, full-source modal/maximize/restore, and unrelated roadmap items remain open. This item does not reselect the next roadmap area or claim hosted API acceptance.

#### Considered and Not Built

A new screenshot framework, browser CI workflow or dependency upgrade is unnecessary for the existing capture harness. Revisit only if a demonstrated blocker prevents that harness from meeting R3–R5. Global overflow hiding that conceals inaccessible content is not an acceptable layout repair.

---

## Planning Contract

### Re-verified Starting State

Read-only inspection on 2026-11-11 established the following; no tests, browser launch, build or cherry-pick ran during planning.

| Evidence | Verified finding | Consequence |
|---|---|---|
| Current checkout | Clean `drawdown/ow-12` at `6dff05a0e01a37e24c57e8f22716d2af7a32bcd7`; no remotes | Preserve this supplied current-`dev` snapshot; do not add remote access. |
| Supplied PR object | `2ffc92d2e46c60d821774349f1e83d1769f88cfe` exists as a commit | The missing-object stop condition does not apply now. |
| Merge base | `09f68ff9b9fbdaf8b754a92ebd64dd9623f1b5aa` | Four commits remain to integrate: `9ad5f0ab`, `659fff65`, `f99ed9e9`, `2ffc92d2`, in that order. |
| PR delta | Two browser specs, `e2e/ui/ow4-fixtures.ts`, roadmap, prior plan and evidence; seven PNGs | The PR's new source is executable test/fixture code. It has no additional production-source delta. |
| Shipped preview | `0f74cea6` (PR #73) is already in the current base | Preserve production source by ancestry and content; do not manufacture unrelated application edits to create a production diff. |
| Newer base changes | Since the merge base, current HEAD changes only `ow-11` documentation/evidence and the roadmap | Reconcile overlapping roadmap text, preserving both histories and this plan's pointer. Do not copy the entire PR tree. |
| PR receipt | `docs/plans/evidence/ow-9/README.md` at `2ffc92d2` records 5,743 Vitest and 296 harness passes, but browser 3 passed / 1 failed | Historical counts orient the rerun; the browser gate remains open. |
| Named historical refs | No local `dev`, PR branch or named rehearsal `origin/*` refs; chief campaign source absent | Compare against the captured base locally; the controller must verify against its actual current `dev` before publication. |

The 2026-10-20 sweep handoff is available at `docs/handoffs/2026-10-20-sweep-cloud-ontokit-web.md`; the integrated rehearsal work remains intact. The PR's source plan is `docs/plans/2026-11-08-1407-fix-ow9-page-evidence-plan.md` at the supplied head. Its existing evidence remains dated evidence rather than current acceptance.

### Key Technical Decisions

- KTD1. **Use the mandated cherry-pick range.** R1 is implemented with the user's merge-base-to-head cherry-pick operation, retaining all four commits and resolving conflicts by combining current-base content with PR intent. Verify the three executable files against the PR delta, and distinguish already-integrated source from newly applied changes. A whole-tree checkout would erase newer documentation.
- KTD2. **Diagnose before selecting a layout fix.** Under R3, reproduce the unchanged 768px failure and inspect the overflowing elements. Candidate owners are the shared Developer layout, preview container and the two page wrappers. Static inspection identifies breakpoint and intrinsic-width risks, not a proven cause. Add browser coverage around the demonstrated repair; preserve viewer read-only inputs and editor unsaved-state behavior.
- KTD3. **Separate old captures from fresh captures.** Under R4, keep `docs/plans/evidence/ow-9/` unchanged and redirect every screenshot writer in both preview specs to `docs/plans/evidence/ow-12/` before any browser rerun. Fresh provenance binds screenshots to the tested application/test tree, not merely the later documentation commit.
- KTD4. **Reuse the synthetic browser boundary.** Keep `playwright.ui.config.ts`, `e2e/ui/server.mjs`, the repository server manager, explicit GET fixtures and rejected API writes. Real browser rendering proves geometry and Monaco behavior; it does not prove real authentication or API authorization. No API contract change is planned.
- KTD5. **Retain campaign delivery and model allocation.** R6 uses controller publication and campaign reviews. Local work stays on Astra, while cloud build stages use the default Sol model and still require Astra/Fable PR reviews. (session-settled: user-directed — chosen over the Sol-first local ladder and a uniform build model: the campaign assigns models by execution setting.) No later campaign review is claimed by this plan.

### Assumptions and Dependencies

The supplied HEAD is the controller's intended current-`dev` snapshot; no local ref or remote can independently establish live `dev`. A later base update requires rechecking the integration delta and affected verification.

Browser capability remains an execution-time dependency. This sandbox denies Unix sockets; `Failed to create stream fd` is a possible runner failure, not evidence of a product defect or test pass. If local browser execution is unavailable, the controller must run the final revision on its existing browser-capable runner and commit the resulting evidence before acceptance. Do not change security settings to enable it.

The precise overflow owner and any failures beyond the currently failing assertion require runtime observation. Keep those decisions within KTD2 rather than prescribing CSS from static guesses. No Damien-only decision is presently needed; campaign excerpts, base reconciliation and runner access are controller responsibilities.

### Impact and Existing Patterns

`components/editor/developer/DeveloperEditorLayout.tsx` is shared by the editor and viewer. Its fixed initial tree width and horizontal layout warrant inspection at narrow widths. Both route wrappers use `max-md` behavior, making exactly 768px a relevant boundary. `components/editor/EntitySourcePreview.tsx` intentionally scrolls long Turtle lines inside its own body; preserve that behavior and exact copied text.

The viewer's `canEdit={false}` / `canSuggest={false}` inputs and full-source read-only behavior must survive any shared layout fix. Existing component integration tests cover state, copy and loading, while Playwright supplies actual geometry and keyboard/Monaco proof. No new architectural mechanism or external research is needed for this integration.

---

## Implementation Units

### U1. Integrate the complete PR while retaining current-base work

**Goal:** The branch contains PR #84's executable changes and all evidence on top of the supplied current base.

**Requirements:** R1, R2, R4, R6, R7; KTD1, KTD5. **Dependencies:** controller reconciliation of the cited campaign excerpts before build dispatch.

**Files:** `e2e/ui/entity-source-preview-evidence.spec.ts`, `e2e/ui/entity-source-preview.spec.ts`, `e2e/ui/ow4-fixtures.ts`, `docs/plans/2026-11-08-1407-fix-ow9-page-evidence-plan.md`, `docs/plans/evidence/ow-9/`, and `docs/plans/2026-09-20-0649-requirements-delivery-roadmap.md`. Preserve current `ow-11` plan/evidence and the inherited application paths named in U2.

**Approach:**

1. Recheck the branch, clean state, target object, base and four-commit inventory before applying KTD1.
2. Resolve roadmap conflicts by retaining newer entries and incorporating the PR's D12/B27 evidence updates without claiming acceptance.
3. Compare the resulting executable delta and PNG inventory with the supplied head. An unexpectedly empty executable delta requires reconciliation with the controller, not a documentation-only replacement.

**Test scenarios:**

1. The imported viewer case directly visits `/projects/{id}`, displays `hasGuide` from `ontologies/demo.ttl` line 8, copies the exact snippet, rejects full-source editing, and returns to the same route with unchanged source.
2. The explicit public-demo lookup fixture handles only its intended query; unmapped reads and all attempted writes still fail the request-accounting checks.
3. All pre-existing editor cases and assertions remain, including selection changes, keyboard tabs, unsaved source, 768px geometry, Graph/Standard navigation and zero writes.

**Verification:** The PR's two specs and fixture changes are present, all seven PNGs match their recorded checksums, and current-base source and `ow-11` documentation remain intact. U2 owns fresh browser execution; no new test is needed solely for cherry-pick mechanics.

### U2. Close the complete browser gate with a bounded repair

**Goal:** Both source-preview routes remain usable and the existing acceptance case passes through its final assertions.

**Requirements:** R2–R5, R7; KTD2–KTD4. **Dependencies:** U1 and a browser-capable runner for runtime diagnosis.

**Files:** Both `e2e/ui/entity-source-preview*.spec.ts` files and `e2e/ui/ow4-fixtures.ts`; only demonstrated repair owners among `components/editor/developer/DeveloperEditorLayout.tsx`, `components/editor/EntitySourcePreview.tsx`, `app/projects/[id]/editor/page.tsx`, and `app/projects/[id]/page.tsx`. Functional regression seams are `__tests__/components/editor/DeveloperEditorLayout.integration.test.tsx`, `__tests__/components/editor/EntitySourcePreview.test.tsx`, and `__tests__/app/project-viewer.integration.test.tsx`.

**Approach:** Redirect both specs' capture destinations per KTD3, then establish the current full browser result. Measure the failing boundary and change only the owning layout constraint needed to satisfy R3. Retain internal snippet scrolling rather than clipping the page. If the inherited failure no longer reproduces, record the passing result and avoid speculative production changes.

**Execution note:** Preserve the existing failing assertion as the starting regression. Add meaningful coverage for the demonstrated repair before changing the responsible behavior. Do not skip later assertions, loosen geometry limits or use a smaller test subset as completion proof.

**Test scenarios:**

1. At 768px, the existing editor panel-bound and document-width assertions pass after unsaved source navigation. Source, Graph, Standard mode and final request accounting all execute and pass afterward.
2. At the repaired narrow boundary, the preview has usable bounds and Copy snippet/Open full source remain reachable by keyboard and pointer on the affected routes. If the repair reaches the 390px layout, add containment/reachability assertions there; visibility alone did not detect the historical clipping.
3. Long Turtle lines scroll inside the preview, without widening the document or changing exact clipboard contents.
4. The viewer still rejects typing and retains the original full-source content; the editor preserves unsaved text when returning to Entity source. Neither navigation path issues API writes.
5. Existing loading, empty-source, failure/retry and selection-scope tests remain green when their shared component changes. Add a functional regression only where the repair changes behavior; jsdom assertions do not establish layout geometry.

**Verification:** The complete source-preview suite passes, both routes retain their roles, and any newly repaired boundary has additive browser proof. A runner failure or remaining case failure leaves this unit incomplete.

### U3. Record final verification and hand off the replacement

**Goal:** The controller receives passing results, current page captures and an accurate replacement-PR handoff.

**Requirements:** R4–R7; KTD3–KTD5. **Dependencies:** U1 and U2.

**Files:** `docs/plans/evidence/ow-12/README.md`, `docs/plans/evidence/ow-12/SHA256SUMS`, sanitized verification output as needed, the images below, and `docs/plans/2026-09-20-0649-requirements-delivery-roadmap.md`.

**Approach:** Run the Verification Contract on the final application/test revision, inspect all fresh images, and record revision/tree identity, commands, exit status, counts, runtime/browser versions and fixture limitations. Keep prior failures distinguishable from the final pass. Update the `ow-12`/D12/B27 pointers without closing unrelated overlay or hosted obligations.

| Route/state | Preserved PR #84 image under `docs/plans/evidence/ow-9/` | Fresh output under `docs/plans/evidence/ow-12/` |
|---|---|---|
| Editor desktop light | `editor-entity-source-preview-desktop.png` | Same basename |
| Editor desktop dark | `editor-entity-source-preview-desktop-dark.png` | Same basename |
| Editor mobile light | `editor-entity-source-preview-mobile.png` | Same basename; retain diagnostic labeling if clipping remains |
| Editor acceptance light | `editor-entity-source-preview-acceptance.png` | Same basename |
| Editor acceptance dark | `editor-entity-source-preview-acceptance-dark.png` | Same basename |
| Viewer desktop light | `project-viewer-entity-source-preview-desktop.png` | Same basename |
| Viewer desktop dark | `project-viewer-entity-source-preview-desktop-dark.png` | Same basename |

**Test expectation:** No unit test for documentation or PNG bytes. Verify every image is nonempty, readable, tracked, mapped to its actual route/state, and free of private data. An image captured before a later failing assertion does not establish that case's acceptance.

**Verification:** R4–R5 are satisfied on the recorded source, the roadmap points to the actual results, and the final handoff says the replacement PR supersedes #84 and #73. Report any controller-only verification still outstanding without declaring the item complete.

---

## Verification Contract

These checks belong to the build stage. Use the lockfile and existing dependency caches. CI's `.github/actions/setup-node/action.yml` selects Node 24; the PR receipt documents failures under older Node, so use that CI major consistently. Do not inspect environment or credential files to configure verification.

| Gate | Entry point or evidence | Required result |
|---|---|---|
| Full Vitest suite and coverage | `npm run test:coverage -- --run --maxWorkers=2` | Full suite behind `npm test` passes with existing thresholds and no added skips. Worker count may be tuned without excluding tests. |
| Hermetic harness suites | `npm run test:e2e:ownership`, `npm run test:e2e:profiles`, `npm run test:e2e:evidence`, `npm run test:e2e:identity`, `npm run test:ctt`, `npm run test:e2e:hosted-unit` | All pass; record fresh counts rather than copying the historical 296. |
| Static checks | `npm run type-check`; `npm run lint` | No errors; disclose existing warnings. |
| Production build | `npm run build` using the public optional-auth/loopback values in `.github/workflows/release.yml` | Successful exit on the final source, without private configuration. |
| Browser discovery | `npx playwright test --config=playwright.ui.config.ts --list` | All four inherited cases plus additive cases appear; listing is not execution. A fixed public `OW4_UI_PORT` can avoid config-time ephemeral-port probing for discovery only. |
| Source-preview browser suite | `npx playwright test --config=playwright.ui.config.ts` | Every case passes through its end; final screenshots for both routes are inspected. |
| Shared-layout regression | `npm run test:ui:demo-polish` if its shared page/layout surfaces change | Existing relevant standalone UI behavior remains green. |
| Preservation | Against-base executable diff, supplied PR delta, PNG checksums, `git diff --check` | No existing test weakened; all original PNG bytes retained; no unrelated newer work lost. |
| Controller merge gate | Actual current-`dev` comparison, required CI/security checks and Astra/Fable reviews | Controller completes publication gates; local verification does not substitute for campaign review. |

The screenshot server must retain `e2e/ui/server.mjs`'s process-ownership safeguards around `ontokit-web.sh`. Do not use a forced restart that can kill another process. A genuine socket or runner restriction requires a sanitized failure record and controller rerun on the same final revision. Missing browser evidence prevents completion, even when the unit/harness suite passes.

Existing full-stack and hosted obligations remain with their lanes; synthetic evidence cannot close them. Any unrelated newly discovered failure must be reported with its command and outcome, without waiving R5 or expanding this branch into another mandate item.

---

## Definition of Done

- U1 preserves the supplied PR and current-base work, with executable test/fixture changes in the against-base diff and inherited production source accounted for.
- U2 passes the complete browser gate without deleting, weakening or skipping any assertion.
- U3 commits genuine screenshots for both changed pages and a truthful receipt on the final tested revision.
- R5's required checks pass, and no abandoned experimental code remains in the final diff; retain historical evidence and respect R7 when cleaning up.
- The roadmap preserves deferred/superseded distinctions and names the next controller action.
- The controller's replacement PR targets `dev` and supersedes #84 and #73; no publication occurs from this clone.
- The build-stage final response lists each committed capture as `SCREENSHOT: <repo-relative path>` and ends with `BRANCH: drawdown/ow-12`, this document's `PLAN:` path and `KIND: planned`. Any true user-only blocker follows Campaign R20's `Needs your decision` format.
