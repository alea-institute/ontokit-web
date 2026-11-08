---
title: Ow9 editor and project page evidence - Plan
type: fix
date: 2026-11-08
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-plan-bootstrap
execution: code
---

# Ow9 editor and project page evidence - Plan

## Goal Capsule

**Objective:** Reviewers can verify the entity-source preview on both pages changed by `ow-4`, with current browser evidence and passing regression checks.

**Means:** Extend the existing synthetic Playwright evidence harness and capture both real page routes (KTD2).

**Authority:** The controller's `ow-9` mandate, repository `AGENTS.md`, and `docs/plans/2026-09-20-0649-requirements-delivery-roadmap.md` govern this repair. The chief-repo source is `docs/plans/2026-10-26-0705-feat-codex-drawdown-campaign-plan.md`, Goal Capsule and campaign R11/R15/R16/R17/R18/R19/R20. That file and `ops/drawdown/mandates/_common.md` are unavailable in this isolated clone. Their contents have not been inspected; the supplied campaign instructions apply, and the controller must compare the cited excerpts before build dispatch.

**Execution profile:** One planned item, one branch `drawdown/ow-9`, one corrective PR targeting `dev`. This stage commits planning documentation only. The later build uses `lfg` on this plan and commits locally. The controller owns scanning, publication, PR #73 supersession bookkeeping, and campaign review/merge gates. No remote or GitHub login is to be added or sought.

**Stop conditions:** Campaign R11 prohibits credential-file reads, spend, credential/security-setting changes, sends in Damien's voice, unbacked deletion, and force-push. No schema migration, data rewrite, package release, or outside service is needed. CTT namespace/quotation choices and ALEA AWS provisioning remain untouched. A blocked browser run is incomplete evidence.

## Product Contract

### Summary

Complete the missing project-viewer evidence and refresh editor evidence on the preserved `ow-4` implementation. Keep existing behavior and tests, and record exactly which checks passed on the capture revision.

### Problem Frame

The repair mandate identifies missing screenshots for the editor and project pages changed by PR #73. The supplied checkout is newer: it already contains that PR's implementation and three editor captures. The existing capture spec visits only the editor route, leaving the changed viewer caller without browser evidence. Historical receipts also describe an earlier source revision and a narrow-layout failure; they cannot establish current acceptance.

### Requirements

**Preservation and scope**

- R1. Preserve all `ow-4` work and subsequent integrated changes on `drawdown/ow-9`; verify ancestry and the changed-page inventory before building (campaign R17).
- R2. Keep every existing test and behavioral assertion, including keyboard focus, copy fidelity, unsaved source navigation, narrow-layout bounds, and zero-write checks; add browser coverage for the viewer route (campaign R15/R16).

**Evidence and verification**

- R3. Commit genuine Playwright PNG captures of `/projects/{id}/editor` and `/projects/{id}` under `docs/plans/evidence/`, with the selected entity's loaded source preview visible on each page.
- R4. Record capture provenance, commands, results, screenshot paths, and fixture limitations; evidence must describe the final tested application/test revision and distinguish local synthetic rendering from hosted DEV acceptance.
- R5. Pass the full repository unit/harness suite, static checks, production build, and the complete existing source-preview Playwright suite plus new viewer coverage. A failure or unavailable runner remains an open gate, never a waiver or claimed pass.

**Delivery**

- R6. Update only the relevant roadmap/readiness entries and hand the committed result to the controller for a corrective PR identifying `ow-9` as the resolution of PR #73's evidence requirement (campaign R19/R20).

### Scope Boundaries

This repair covers evidence, additive browser assertions, and narrowly necessary synthetic-fixture corrections. It does not reopen `ow-4`'s area selection or add product features. Preserve the earlier screenshots and receipts as dated evidence.

#### Deferred to Follow-Up Work

Hosted rehearsal and persona acceptance remain with `ow-1`/`ow-2`; socket hardening and other repair mandates retain their owners. B27 modal/maximize/restore and overlay synchronization, B24/B25/B26, and the broader B01–B75 queue remain open. Unrelated layout defects or baseline test failures must be recorded for the controller without weakening this item's completion gate.

#### Considered and Not Built

A new screenshot framework, visual-baseline update system, browser CI workflow, or hosted-auth setup would add maintenance without closing a gap in the existing capture harness. Revisit only if build evidence shows that harness cannot capture the two routes.

## Planning Contract

### Re-verified Starting State

Static inspection on 2026-11-08 found a clean `drawdown/ow-9` at `09f68ff9b9fbdaf8b754a92ebd64dd9623f1b5aa`, with no remotes. Neither `drawdown/ow-4` nor `origin/drawdown/ow-4` exists locally. Commit `0f74cea6cda94853f76ef161df87d9204bf40908`, labeled `ow-4: Ow4 entity source preview - Plan (#73)`, is an ancestor and contains the implementation, regression tests, and added capture harness. Preserve this supplied descendant rather than recreating the old branch. Live GitHub status was not queried.

- The changed routes are `app/projects/[id]/editor/page.tsx` and `app/projects/[id]/page.tsx`. Both pass source filename, scope, and readiness into `components/editor/developer/DeveloperEditorLayout.tsx`; the viewer explicitly passes `canEdit={false}` and `canSuggest={false}`.
- `e2e/ui/entity-source-preview-evidence.spec.ts` captures only `/projects/{id}/editor`: desktop light/dark and mobile light. Its three PNGs already exist under `docs/plans/evidence/ow-4/`.
- `docs/plans/evidence/ow-4/README.md` records two passing capture cases on 2026-10-30 at application source `241befa2`, and a separate 768px full-page overflow assertion that still failed then. Later mobile fixes are present; their effect on this suite is untested in this stage.
- `e2e/ui/entity-source-preview.spec.ts` already asserts class/property/individual selection, copy, unsaved Monaco content, keyboard tabs, narrow layout, and existing mode entry points. `__tests__/app/project-viewer.integration.test.tsx` separately covers the viewer's real filename and successful empty-source state.
- `e2e/ui/ow4-fixtures.ts` supplies synthetic session/project/source data, rejects non-GET API calls, flags unmapped reads, and serves installed Monaco assets through the CDN request boundary. `playwright.ui.config.ts` explicitly discovers both preview specs. `e2e/ui/server.mjs` uses the repository server manager with ownership checks.
- The roadmap, `docs/handoffs/2026-10-20-sweep-cloud-ontokit-web.md`, and existing `ow-4` plan/evidence were inspected. The named remote rehearsal refs are absent. No tests, browser launches, builds, or application changes occurred during planning.

### Key Technical Decisions

- KTD1. **Continue from the verified descendant.** R1 is satisfied by retaining the integrated `ow-4` work at the supplied head; resetting to an unavailable older ref risks losing later fixes. The controller should confirm source provenance against its original ref before publication.
- KTD2. **Extend the existing evidence spec.** Add route-specific cases in `e2e/ui/entity-source-preview-evidence.spec.ts` using `e2e/ui/ow4-fixtures.ts`. Render the real Next.js pages and shared preview, preserving the explicit request accounting. No new dependency, config, or API contract is planned.
- KTD3. **Capture a readable loaded state.** Before each new route capture, assert the exact route, selected property, `ontologies/demo.ttl` line 8, Turtle statement, preview region, and its copy/full-source controls. Use settled transitions and existing viewport/theme conventions. Put every rerun output under `docs/plans/evidence/ow-9/`, including the existing mobile and acceptance-case captures, so the dated `ow-4` images remain unchanged. Retain each existing case's state and assertions.
- KTD4. **Retain the full behavioral gate.** Run the complete `playwright.ui.config.ts` suite, not only its screenshot subset. Keep the 768px no-horizontal-scroll assertion and all existing write/unexpected-request guards. If a current fixture lacks a read needed by the viewer, supply its explicit synthetic response without a blanket success fallback.
- KTD5. **Keep publication with the controller.** Follow R6 and campaign R19 on the existing branch. Local history indicates #73 was integrated, so the controller must describe the corrective PR as a follow-up satisfying its evidence requirement if GitHub confirms it is already merged; do not claim an open PR was replaced without checking.

### Assumptions and Execution-Time Limits

The planned capture matrix is a technical default: fresh desktop light/dark evidence for each changed route, plus retained existing mobile checks. It introduces no new user-facing layout requirement.

The sandbox denies Unix sockets, and the earlier `ow-4` run failed before page assertions. Browser availability on the build runner remains unverified. If startup is denied, retain the prepared tests and a sanitized failure receipt, then have the controller run the same final revision on its authorized browser-capable runner and commit the resulting captures before acceptance. No security-setting change or new login is needed.

The existing synthetic contracts should support both routes; any additional current viewer requests must be established during build. Screenshots cannot establish real API permissions, authentication, save/submit/review/merge, or DEV compatibility. Those acceptance claims remain with the owning lanes.

Local patterns fully establish this evidence repair; external research and a new harness are unnecessary. Missing chief-repo excerpts, original refs, and browser capability are controller prerequisites, not Damien-only judgment calls.

## Implementation Units

### U1. Add viewer capture coverage without weakening editor checks

**Goal:** Both changed page routes have reproducible, asserted capture cases.

**Requirements:** R1–R3; KTD1–KTD4. **Dependencies:** preserved starting history and existing harness.

**Files:** `e2e/ui/entity-source-preview-evidence.spec.ts`; `e2e/ui/entity-source-preview.spec.ts` for screenshot destinations only; `e2e/ui/ow4-fixtures.ts` only for demonstrated missing synthetic reads. Reference `playwright.ui.config.ts` and `__tests__/app/project-viewer.integration.test.tsx` without removing their coverage.

**Approach:** Add the viewer case beside the existing editor cases, using route-distinct output filenames and the existing fixture/helper boundaries. Redirect the existing editor, mobile, and acceptance-case outputs to KTD3's new directory without changing their assertions; keep historical captures at their old paths. The browser seam proves real route/layout rendering with synthetic HTTP/session data; it does not prove backend authorization.

**Execution note:** Redirect screenshot destinations first, preserving every existing assertion and behavior. Establish the baseline suite result with those output-only changes before adding viewer cases or correcting fixtures. Extend coverage around any demonstrated fixture gap, and retain existing assertions throughout.

**Test scenarios:**

1. Open the editor in Developer mode, select `hasGuide`, activate Entity source by keyboard, and assert KTD3's loaded state before light/dark captures.
2. Open the viewer route directly in a fresh context, repeat the selection/preview flow, and assert it stays on `/projects/{id}` while showing the real filename and snippet before light/dark captures.
3. On the viewer, Copy snippet reproduces the displayed text and Open full source opens read-only Monaco. Preview navigation issues no write request, and every API read has an explicit fixture.
4. Rerun the existing editor acceptance and mobile capture cases with all R2 assertions intact; an editor-only capture run cannot satisfy R5.

**Verification:** Both routes pass their assertions, the intended new cases are discovered by the existing UI config, and no fixture silently permits writes or unmapped reads.

### U2. Commit current page evidence and reconcile the receipt

**Goal:** The controller receives inspectable images and an accurate verification record for this repair.

**Requirements:** R3–R6; KTD3–KTD5. **Dependencies:** U1 and a browser-capable runner for completion.

**Files:** `docs/plans/evidence/ow-9/README.md`, `docs/plans/2026-09-20-0649-requirements-delivery-roadmap.md`, and these captures:

- `docs/plans/evidence/ow-9/editor-entity-source-preview-desktop.png`
- `docs/plans/evidence/ow-9/editor-entity-source-preview-desktop-dark.png`
- `docs/plans/evidence/ow-9/editor-entity-source-preview-mobile.png`
- `docs/plans/evidence/ow-9/editor-entity-source-preview-acceptance.png`
- `docs/plans/evidence/ow-9/editor-entity-source-preview-acceptance-dark.png`
- `docs/plans/evidence/ow-9/project-viewer-entity-source-preview-desktop.png`
- `docs/plans/evidence/ow-9/project-viewer-entity-source-preview-desktop-dark.png`

**Approach:** Capture and visually inspect U1's images on the final application/test revision. The README records that revision, browser/Playwright versions, actual commands and results, viewport/theme, route-to-file mapping, and synthetic-data limits. Record earlier failures alongside the accepted rerun. Update the roadmap's `ow-9`/D12 evidence pointers without closing the broader B27 or hosted gates.

**Test expectation:** No new unit test for documentation or PNGs; U1 supplies behavioral coverage, and the Verification Contract supplies the regression gate. Check that each listed image is nonempty, viewable, tracked, correctly mapped to its route, and free of private data.

**Verification:** R5 passes on the recorded revision, both routes have committed readable captures, and the receipt provides a controller-owned continuation for any incomplete gate. No abandoned attempt artifacts remain in the final diff; retain any necessary failure evidence deliberately.

## Verification Contract

These are build-stage checks; none ran during planning. Use the installed lockfile/toolchain and existing caches. Do not read private environment or credential files to configure a run.

| Check | Existing entry point | Passing evidence |
|---|---|---|
| Complete unit suite and coverage | `npm run test:coverage -- --run --maxWorkers=4` | All Vitest cases pass; preserve coverage thresholds and report counts. This runs the full suite behind `npm test`. |
| Harness unit suites | `npm run test:e2e:ownership`, `npm run test:e2e:profiles`, `npm run test:e2e:evidence`, `npm run test:e2e:identity`, `npm run test:ctt`, `npm run test:e2e:hosted-unit` | All existing hermetic suites pass, without test deletions or new skips. |
| Static checks | `npm run type-check`; `npm run lint` | No type or lint errors; disclose warnings. |
| Production build | `npm run build` | Pass with the credential-free optional-auth/public loopback configuration already defined in `.github/workflows/release.yml`. |
| Discovery | `npx playwright test --config=playwright.ui.config.ts --list` | Existing editor cases and added viewer cases appear. Listing alone is not browser proof. |
| Browser behavior and captures | `npx playwright test --config=playwright.ui.config.ts` | Entire suite passes, including acceptance, mobile, and viewer cases; capture images exist and have been inspected. |
| Change integrity | `git diff --check` and focused review | Only this repair's tests/evidence/documentation changed; existing assertions and `ow-4` implementation remain. |
| Campaign gate | Controller's required CI and Astra/Fable reviews | Required checks and campaign reviews pass before merge; local results do not substitute for them. |

A baseline failure must be reproduced and named. Correct only defects necessary to this evidence repair; report unrelated failures to the controller with the exact command and outcome. Neither a historical pass nor a runner restriction satisfies R5. The server manager must retain its existing process-ownership safeguards.

## Definition of Done

- U1 adds viewer proof and preserves existing coverage under R1–R2.
- U2 supplies committed current captures and provenance for both changed routes under R3–R4.
- Every required check in R5 is green on the recorded revision; unresolved runtime or regression gates prevent completion.
- The roadmap links the resulting evidence and preserves the remaining B27/hosted obligations.
- Local commits stay on `drawdown/ow-9`; the controller completes R6's corrective-PR/supersession bookkeeping against `dev`.
- The build handoff reports each committed image as `SCREENSHOT: <repo-relative path>` and ends with `BRANCH: drawdown/ow-9`, this plan's `PLAN:` path, and `KIND: planned`. No screenshot is claimed during the plan stage.
