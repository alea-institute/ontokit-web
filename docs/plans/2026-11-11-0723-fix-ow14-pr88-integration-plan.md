---
title: Integrate ow-14 demo polish on dev - Plan
type: fix
date: 2026-11-11
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-plan-bootstrap
execution: code
item: ow-14
kind: expansion
---

# Integrate ow-14 demo polish on dev - Plan

## Goal Capsule

- **Objective:** Visitors can reach editor shortcut help on phones and desktops while the existing demo workflows remain usable.
- **Means:** Integrate PR #88 onto the supplied dev baseline, reconcile its mobile help with #87's layout, and obtain fresh regression evidence (KTD1–KTD4).
- **Authority:** The controller's ow-14 mandate and supplied campaign rules, then `AGENTS.md` and `docs/plans/2026-09-20-0649-requirements-delivery-roadmap.md`. Campaign authority remains the chief repository's `docs/plans/2026-10-26-0705-feat-codex-drawdown-campaign-plan.md`, Goal Capsule and campaign R11/R15/R16/R17/R18/R19/R20 only. That file and `ops/drawdown/mandates/_common.md` are absent from this clone; their wording has not been independently verified. The controller reconciles those excerpts before build dispatch.
- **Execution profile:** One expansion on `drawdown/ow-14`, followed by one controller-published PR targeting `dev` and superseding #88, #85 and #74. This stage commits planning documents only. The build stage uses the required LFG workflow; the controller owns scans, publication and the campaign merge gate (R7).
- **Stop conditions:** A missing required commit blocks implementation. R8 governs hard stops. An unavailable runtime or review gate remains open and cannot be reported as passed.

## Product Contract

### Summary

Carry PR #88's source and tests onto current dev, preserve the complete source-status regression, and reconcile shortcut visibility without undoing #87's layout repairs. Commit current Playwright evidence for every page changed by the final integration.

### Problem Frame

The controller reports that PR #88 conflicts after #87 merged. Both branches change the editor's help controls: #87 makes the ordinary opener reachable outside the phone-hidden toolbar, while #88 adds a separate phone opener. Keeping both without reconciling visibility would expose duplicate controls. Selecting one side wholesale would discard either current layout work or the incoming regression coverage.

### Requirements

These R-IDs are local to this plan; **campaign** identifies the separate campaign rules.

**Integration and behavior**

- R1. Import the complete merge-base-to-`08f7916c1312a5a12350c92aa05c360f26bbd75b` commit range onto the supplied dev baseline, preserving current dev plus the PR's intent.
- R2. Retain the PR's complete idle-status regression: `In sync` with the nested source filename when present, exactly `In sync` without a source path, and no idle-success paragraph during syncing, conflict or error.
- R3. Preserve #87's editor/viewer layout and source-preview behavior while keeping exactly one visible, keyboard-accessible help opener at each supported viewport for anonymous and authorized visitors.

**Proof and delivery**

- R4. Preserve every existing test and assertion from both histories, with no deletion, weakening or skips; add regression coverage for the integration repair (campaign R15–R16).
- R5. Retain the inherited screenshots and commit fresh, visually inspected Playwright screenshots for every changed page under `docs/plans/evidence/`, naming each current capture in the build handoff as `SCREENSHOT: <path>`.
- R6. The final branch must contain source and test changes against dev and pass the full suite in the Verification Contract; a plan, receipt or historical pass alone is insufficient.
- R7. Keep work local on `drawdown/ow-14`. The controller reconciles current dev, scans, obtains independent Astra/Fable reviews, pushes and opens the replacement PR superseding #88, #85 and #74; the campaign gate merges (campaign R15/R17/R19).
- R8. Follow campaign R11/R20 and the supplied hard stops: no remote or credential discovery, forbidden-file reads, spend, credential/security-setting changes, sends in Damien's voice, unbacked deletion or force-push. Repository artifacts contain only public-safe content and repo-relative paths.

### Key Decisions

- **Expansions merge through the campaign guardrails.** Governs R4–R7. (session-settled: user-directed — chosen over holding expansions for personal review: the required evidence and reviews govern merge.) The campaign R18 freeze of November 3–6 has elapsed.
- **Preserve the campaign's model policy.** Governs R7. (session-settled: user-directed — chosen over the Sol-first local ladder: local work uses Astra; cloud builds use Codex Cloud's default Sol and still receive Astra/Fable reviews.)
- **Finish the assigned integration without speculative additions.** Governs R1, R6–R8. (session-settled: user-directed — chosen over speculative features once the backlog runs out: subsequent work becomes durable hygiene.) Routine technical choices do not wait for Damien.

### Scope Boundaries

Only ow-14 is active. Do not change CTT namespace or quotation choices, ALEA AWS provisioning, billing, API contracts, authentication policy, schema, stored data, package releases or outside services. A new toolbar abstraction or settings redesign is unnecessary for this integration; reconsider only if a concrete acceptance failure requires it.

Hosted rehearsal, D08–D10 persona UAT, the B27 overlay remainder and broader B34 import/feeders retain their roadmap dispositions and owners. Local synthetic browser proof does not establish hosted DEV acceptance.

## Planning Contract

### Verified Starting State

Static inspection on 2026-11-11 found a clean `drawdown/ow-14` at `a12c78663bcf14b55740fe18077aa876cda3cab3`, whose commit records the #87 integration. No cherry-pick, application test, build, server or browser ran during planning.

The required PR head exists as a commit. Its merge base with the supplied initial HEAD is `6dff05a0e01a37e24c57e8f22716d2af7a32bcd7`. The requested import contains these six commits in order:

| Commit | Intent |
|---|---|
| `078d8bb8` | ow-13 integration plan and roadmap entry |
| `bb66cadc` | ow-10 source-status repair plan |
| `2063268a` | Complete idle source-status regression |
| `a440e2ba` | ow-10 verification receipt and roadmap update |
| `43b541a5` | Mobile help source fix, integration tests and browser assertions |
| `08f7916c` | ow-13 receipt, nine screenshots, manifest and roadmap update |

The current branch and incoming range overlap in `app/projects/[id]/editor/page.tsx`, `__tests__/app/editor-page.integration.test.tsx` and the delivery roadmap. Their observed differences are:

- Current dev wraps the editor header at all widths, preserves minimum-width containment, and places the ordinary `Keyboard shortcuts` opener outside the restricted toolbar group. Its integration tests explicitly assert that separation while retaining History/Health/PR restrictions.
- PR #88 adds an anonymous-only, phone-only opener named `Keyboard shortcuts for mobile viewers`. Its tests cover optional/disabled anonymous modes, filtered shortcuts, Escape focus return and no compact opener for authorized editors.
- PR #88's browser case requires one visible opener, the distinct phone accessible name, no horizontal overflow and desktop-to-phone-to-desktop recovery. The current browser case already uses a name pattern that can match either opener.
- `__tests__/app/project-settings-github.integration.test.tsx` on current dev lacks the incoming two idle cases and negative idle assertions. The incoming fixture adds a nullable source path and checks the whole status paragraph, including the nested filename.
- `ui-tests/demo-polish.spec.ts` receives `DEMO_POLISH_EVIDENCE_DIR` with its existing ow-5 default retained. The incoming nine PNGs and manifest live under `docs/plans/evidence/ow-13/`; current ow-12 and ow-9 evidence is already committed.

Current dev also contains `app/projects/[id]/page.tsx` and `components/editor/developer/DeveloperEditorLayout.tsx` containment repairs plus eight source-preview browser cases. Preserve those files and cases; they are not replacements for the incoming source-status tests.

The clone has no remote, local dev ref or named remote rehearsal refs. The supplied initial HEAD is the available integration baseline, not proof of live GitHub state. The 2026-10-20 sweep handoff is present at `docs/handoffs/2026-10-20-sweep-cloud-ontokit-web.md`; its rehearsal and CTT questions remain outside this item. Historical ow-13 verification in the required head is useful provenance, not a result for the combined branch.

### Key Technical Decisions

- KTD1. **Replay the requested range and resolve overlaps by intent.** Preserve all six commits' effects and both sets of roadmap entries under R1. A tree replacement would roll back #87. Record the old-to-new commit mapping in the build receipt and compare the final source/test diff against the captured baseline.
- KTD2. **Keep both opener variants with complementary visibility.** Under R3, retain current dev's ordinary opener outside the restricted toolbar and retain the incoming compact opener. For visitors without valid access, show the compact opener below the existing `md` breakpoint and the ordinary opener from `md` upward. For authorized visitors, retain only the ordinary opener at all widths. Both use the existing dialog state and permission-filtered content. This preserves both histories' exact-name tests without exposing the hidden toolbar or producing two visible controls.
- KTD3. **Merge tests additively.** Keep #87's toolbar-separation assertions and #88's complete settings and mobile-help cases under R2/R4. Extend the existing browser visibility checks to the breakpoint boundary; do not relax names, counts, overflow limits or focus assertions to accommodate an incorrect merge.
- KTD4. **Keep historical evidence separate from new acceptance.** Route demo-polish captures to `docs/plans/evidence/ow-14/` using the incoming override. The source-preview suite currently writes fixed ow-12 paths: verify a backup before running it, retain fresh captures separately under ow-14, and restore the historical bytes from that backup. This avoids unrelated test-harness changes and preserves R5's provenance.

### High-Level Technical Design

KTD2's visibility matrix applies without changing `hasValidAccess` or shortcut permissions:

| Access | Viewport | Visible help opener | Restricted toolbar |
|---|---|---|---|
| Anonymous, optional mode | Below `md` | Compact mobile opener | Existing phone-hidden state |
| Anonymous, disabled mode | Below `md` | Compact mobile opener | Existing phone-hidden state |
| Anonymous | At or above `md` | Ordinary opener | Existing desktop state |
| Authorized | Below `md` | Ordinary opener | Existing authorized controls |
| Authorized | At or above `md` | Ordinary opener | Existing authorized controls |

### Assumptions and Execution Unknowns

The supplied initial HEAD represents the controller's intended dev base. Actual conflict hunks, runtime failures and current upstream movement remain build-stage checks. The visibility repair is bounded to the existing controls; no new API or persistence behavior is expected.

The sandbox contract denies Unix sockets. Browser, Docker and authenticated policy availability were not probed. The build must attempt the required checks in its provided environment and record any denial; a capable controller runner must complete unavailable gates before item completion. No Damien-only decision is known. The controller also owns reconciliation of the absent campaign excerpts before build dispatch.

## Implementation Units

### U1. Integrate PR #88 and reconcile editor help

**Goal:** Preserve the incoming source/status tests and current dev's layout in one combined implementation. **Requirements:** R1–R4, R8. **Dependencies:** required commit and controller-reconciled campaign excerpts.

**Files:** `app/projects/[id]/editor/page.tsx`; `__tests__/app/editor-page.integration.test.tsx`; `__tests__/app/project-settings-github.integration.test.tsx`; `ui-tests/demo-polish.spec.ts`; `docs/plans/2026-11-08-1441-fix-ow-10-source-status-plan.md`; `docs/plans/2026-11-11-0126-fix-ow13-demo-polish-integration-plan.md`; `docs/plans/evidence/ow-10/README.md`; `docs/plans/evidence/ow-13/`; delivery roadmap.

**Approach:**

1. Recheck initial branch/object identity and import the ordered range under KTD1, retaining all existing source-preview/layout changes.
2. Resolve the editor overlap using KTD2 and union both integration-test changes under KTD3.
3. Resolve roadmap conflicts additively, retaining this plan's entry and the ow-12/ow-11 and incoming ow-13/ow-10 history. Keep dated receipts as historical evidence.

**Patterns:** Existing Button/Keyboard/dialog wiring and responsive classes in the editor; HTTP fixtures in the settings integration test. The settings seam proves page rendering, not live GitHub synchronization; jsdom cannot prove CSS visibility.

**Test scenarios:**

1. Idle sync with `source.ttl` renders the complete `In sync — source.ttl` paragraph; a null path renders exactly `In sync`.
2. Syncing, conflict and error retain their existing messages/details with no idle paragraph.
3. Optional/disabled anonymous visitors can open compact help, see no privileged actions, close with Escape and regain opener focus.
4. Authorized editors retain the ordinary opener and privileged shortcuts without a compact duplicate; both current toolbar-group assertions remain intact.

**Verification:** The settings/editor suites pass with the union of existing cases. The final source and test diff carries PR #88's intent without reverting #87's header, viewer or Developer-layout fixes.

### U2. Prove responsive integration and capture the final pages

**Goal:** Establish the combined layout's behavior in a real browser. **Requirements:** R3–R5. **Dependencies:** U1.

**Files:** `ui-tests/demo-polish.spec.ts`; existing `ui-tests/fixtures/demo-polish.ts` and `e2e/ui/entity-source-preview*.spec.ts` as verification seams; new PNGs and `docs/plans/evidence/ow-14/README.md`.

**Approach:** Extend the existing visibility scenario under KTD3, keeping all four demo-polish cases and all eight source-preview cases. Apply KTD4 to evidence output. Use synthetic local fixtures that continue rejecting unexpected API requests and mutations.

**Execution note:** Characterize the combined editor's one-opener behavior before the final visibility adjustment; retain the regression that would catch a duplicate after conflict resolution.

**Test scenarios:**

1. At 390px and 767px, exactly one mobile-named help opener is visible; at 768px and 1440px, exactly one ordinary opener is visible. Resize back and confirm visibility and no page overflow.
2. Click each visible opener, confirm filtered dialog content and viewport containment, then close with Escape and verify focus return. Existing physical Shift+Slash and editable-field guards still pass.
3. All source-preview cases retain copy fidelity, read-only viewer source, route preservation, unsaved editor navigation and long-line containment at 390px and 768px.
4. Existing project loading/search recovery and hydration persistence/export cases pass with no unexpected requests or writes.

Playwright proves actual responsive visibility and focus that the component tests cannot. Capture and inspect `editor-desktop.png`, `editor-mobile.png`, `editor-shortcuts.png` and `editor-shortcuts-mobile.png` under ow-14. Retain the other fresh demo-polish captures and source-preview captures with route/viewport metadata. If conflict resolution changes another page, add a fresh capture for it as required by R5.

**Verification:** Both browser suites pass completely on the final source; historical PNGs remain unchanged and current captures show the merged layout.

### U3. Verify the branch and prepare controller publication

**Goal:** Supply reviewable proof for the replacement PR. **Requirements:** R1, R4–R8. **Dependencies:** U1–U2.

**Files:** `docs/plans/evidence/ow-14/README.md`; `docs/plans/evidence/ow-14/manifest.json` or equivalent source/image hash record; `docs/plans/2026-09-20-0649-requirements-delivery-roadmap.md`.

**Approach:** Record import mapping, final source revision, actual check results, screenshot routes/viewports and unresolved controller gates. Update only this item's roadmap state and preserve every B01–B75 disposition. Complete simplification and code review, then verify the final source against the contract below.

**Test expectation:** No additional behavior belongs to this documentation unit; its evidence must reference the completed U1/U2 checks and full suite.

**Verification:** The controller can inspect source, tests and current screenshots, distinguish historical from new results, and publish under R7. No held change is expected; report any essential new decision using the mandate's setting, estimated minutes and unblocked outcome fields.

## Verification Contract

No application verification runs in the plan stage. Build-stage checks use the existing lockfile and a runtime compatible with `.github/actions/setup-node/action.yml` (Node 24). The historical ow-13 receipt records a system Node TypeScript-stripping limitation; resolve the runtime rather than changing its tests.

| Gate | Required result |
|---|---|
| Import/current base | All six commit effects preserved; combined diff contains editor source and both regression-test changes; controller checks clean applicability to actual current dev |
| Focused tests | Settings/editor integration, `KeyboardShortcutDialog`, both `useKeyboardShortcuts` suites, `EntitySourcePreview` and Developer-layout tests pass |
| Full unit/coverage | `npm test` and `npm run test:coverage` in single-run mode pass with every existing test retained |
| Static/build | `npm run lint`, `npm run type-check` and `npm run build` pass; build uses the credential-free optional-auth configuration in `.github/workflows/release.yml` |
| Hermetic harness | `test:e2e:ownership`, `test:e2e:profiles`, `test:e2e:evidence`, `test:e2e:identity`, `test:e2e:hosted-unit` and `test:ctt` pass via the existing npm scripts; CTT source is untouched |
| Browser | `npm run test:ui:demo-polish` and the complete suite selected by `playwright.ui.config.ts` pass, with U2's added breakpoint assertions |
| Screenshot provenance | Existing ow-5/ow-9/ow-12/ow-13 evidence retained; final captures committed and inspected, bound to final source and named in the build handoff |
| Controller | Required CI, Semgrep, Docker/image checks and independent Astra/Fable reviews complete before publication/merge as the campaign requires |

Use `ontokit-web.sh` on a verified unused owned port for managed background servers, avoiding its conflict-killing path. Do not read environment or credential files. Synthetic fixture results prove local UI behavior only. A sandbox-denied check or stale screenshot does not establish acceptance.

## Definition of Done

- U1 imports PR #88's work and reconciles its source/tests with current dev; U2 proves the final behavior and supplies current screenshots; U3 records the full verification results.
- R1–R8 hold, including a substantive source/test diff and complete passing checks. The diff contains no unrelated changes or abandoned implementation attempts; cleanup observes verified-backup requirements.
- The roadmap links the plan and final evidence without closing other lanes or converting historical results into new acceptance.
- The controller verifies clean applicability to current dev, publishes the replacement PR as superseding #88, #85 and #74, and completes the campaign merge gate. This planning commit alone does not complete ow-14.
