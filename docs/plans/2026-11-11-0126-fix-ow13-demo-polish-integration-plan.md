---
title: Restore ow-13 demo polish on dev - Plan
type: fix
date: 2026-11-11
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-plan-bootstrap
execution: code
item: ow-13
kind: expansion
---

# Restore ow-13 demo polish on dev - Plan

## Goal Capsule

- **Objective:** Visitors can use the existing demo polish on desktop and phones, and maintainers have current regression evidence for its source-sync status.
- **Means:** Import PR #85's remaining commits onto the supplied dev baseline and close its recorded mobile-help failure (KTD1–KTD3).
- **Authority:** The controller's ow-13 mandate; the chief campaign's `docs/plans/2026-10-26-0705-feat-codex-drawdown-campaign-plan.md` Goal Capsule and campaign R11, R15–R20; then `AGENTS.md` and the repository roadmap. The chief file and `ops/drawdown/mandates/_common.md` are absent from the accessible clone. Their original wording remains unverified; the supplied standing rules govern this plan, and the controller reconciles the excerpts before publication.
- **Execution profile:** One expansion on `drawdown/ow-13`, one controller-published PR targeting `dev`, superseding #85 and #74. This stage changes planning documents only; R6 governs delivery after implementation.
- **Stop conditions:** R7 governs hard stops. A missing required commit blocks implementation. An unavailable browser or policy gate remains open, with its owner and next action recorded; it cannot be reported as passed.

## Product Contract

### Summary

Preserve PR #85's complete “In sync” regression coverage on current dev and repair the inherited mobile shortcut-help failure. Supply fresh test results and screenshots without changing existing permission rules or weakening tests.

### Problem Frame

The requested PR head exists, but most ow-5 production changes already belong to the supplied baseline. Its remaining three commits add regression coverage and documentation. The PR's own evidence reports a 3/4 browser result: anonymous visitors cannot open shortcut help on phones after a later mobile layout change. Importing those commits alone would leave that acceptance failure unresolved and produce no production-source diff.

### Requirements

These R-IDs belong to this plan; **campaign** identifies the controller's separate rules.

**Integration and behavior**

- R1. Retain current dev and import every commit in the mandate's merge-base-to-`d942379c649eab888e0446062afdded5d40f7626` range, resolving overlaps to preserve both current work and PR intent.
- R2. Preserve the PR's idle-status regression: “In sync” with its nested source filename when present, “In sync” alone without a path, and no idle-success paragraph during syncing, conflict or error.
- R3. Close failures that prevent the inherited demo-polish suite from passing, retaining its loading, recovery, shortcut, focus, hydration persistence, export and narrow-layout obligations.

**Proof and delivery**

- R4. Add tests for the repair and preserve every existing test and assertion without deletion, weakening, skipping or reduced coverage (campaign R15–R16).
- R5. The final branch has a substantive source-and-test diff against dev, a passing full suite, and real Playwright screenshots of every changed page committed under `docs/plans/evidence/`; each screenshot is named as `SCREENSHOT: <path>` in the build handoff.
- R6. Keep commits local on `drawdown/ow-13`; the controller scans, runs the independent Astra/Fable reviews, pushes and opens the PR that supersedes #85 and #74, and the campaign gate merges (campaign R15, R17–R19). The November 3–6 expansion freeze has elapsed.
- R7. Observe the supplied hard stops and public-safe writing rule (campaign R11, R20): no remote or credential discovery, forbidden-file reads, spend, credential/security changes, sends in Damien's voice, unbacked deletion or force-push.

### Key Decisions

- **Verified expansions go through the campaign gate.** Governs R5–R6. (session-settled: user-directed — chosen over holding expansions for Damien's personal review: guardrails govern their delivery.)
- **Preserve the campaign execution policy.** Governs R6. (session-settled: user-directed — chosen over a Sol-first local ladder: local work uses Astra; cloud build stages use Codex Cloud's default Sol, with Astra/Fable reviews still required.)
- **Keep the assigned scope.** Governs R1, R3. (session-settled: user-directed — chosen over speculative features after planned work runs out: remaining work becomes durable hygiene.)

### Scope Boundaries

Only ow-13 is active. The mobile-help repair is included because it blocks the existing ow-5 browser contract carried by #85. A settings redesign, generic toolbar abstraction and unrelated dependency changes are not needed. Do not alter CTT namespace/quotation choices, ALEA AWS provisioning, billing, API contracts, authentication policy, migrations, stored data formats, package releases or outside services.

Hosted rehearsal, D08–D10 persona acceptance, broader B34 feeders and the remaining roadmap areas keep their existing owners and dispositions. Synthetic local browser proof does not close those obligations.

## Planning Contract

### Verified Starting State

Static inspection on 2026-11-11 began with a clean `drawdown/ow-13` at `6dff05a0e01a37e24c57e8f22716d2af7a32bcd7`. No tests, build, server or browser ran during planning.

| Surface | Local evidence | Planning consequence |
|---|---|---|
| Required object | `d942379c649eab888e0446062afdded5d40f7626` is a commit; merge base with initial HEAD is `09f68ff9b9fbdaf8b754a92ebd64dd9623f1b5aa` | The requested import can start locally |
| Ordered import | `f9aaa921` plan, `1515cdd3` regression tests, `d942379c` evidence | Import all three; a receipt-only branch cannot satisfy R5 |
| Current baseline | Only ow-11 documentation differs between the merge base and initial HEAD | Preserve those documents and both roadmap entries during conflict resolution |
| Existing polish | `ad170cfd` (#74), rehearsal `f3228d7b` (#68) and handoff `43783d39` (#69) are inherited | Do not replay the original ow-5 or rehearsal implementation |
| Status gap | Current `__tests__/app/project-settings-github.integration.test.tsx` lacks the PR's two idle cases; the settings page is unchanged between baseline and PR head | Keep `1515cdd3` intact; do not fabricate a settings rendering defect |
| Mobile mismatch | `app/projects/[id]/editor/page.tsx` places the help button inside an anonymous `max-md:hidden` group; `ui-tests/demo-polish.spec.ts` clicks it at 390 × 844 | Reproduce the recorded failure before repairing it |
| Existing restriction | `__tests__/app/editor-page.integration.test.tsx` explicitly preserves the hidden anonymous toolbar group and the signed-in tools | Keep these assertions; add mobile help without exposing the whole group |
| Evidence | Six PNGs and `README.md` already exist under `docs/plans/evidence/ow-5/` | Retain historical proof and capture new final-source evidence |
| Local refs | No remote, local `dev`, original drawdown source branch or named remote rehearsal refs exist | Initial HEAD is the controller-supplied dev baseline, not proof of live dev or PR status |

Research also used `docs/plans/2026-09-20-0649-requirements-delivery-roadmap.md`, `docs/handoffs/2026-10-20-sweep-cloud-ontokit-web.md`, and the ow-10 plan and receipt stored in the required PR head. No matching institutional-learning files or configured research packs were present. Local source and history settle the approach; no external research is needed.

### Key Technical Decisions

- KTD1. **Use the requested commit range, not a tree replacement.** This preserves current dev's ow-11 evidence and avoids reintroducing old versions of already integrated source. Inspect the final diff against the captured baseline and let the controller reconcile subsequent dev movement (R1, R5).
- KTD2. **Keep the complete status assertions.** The PR scopes the idle paragraph, normalizes its full text and checks the nested filename; a separate filename elsewhere in settings cannot satisfy it. Preserve the absent-path case and negative checks for other statuses (R2, R4).
- KTD3. **Add compact mobile access to the existing help dialog.** Retain the original desktop control and anonymous hidden toolbar group. Add a phone-only help opener outside that group for visitors without valid access, reusing the same dialog state and permission-filtered shortcut list. Its distinct descriptive accessible name should retain “Keyboard shortcuts” so the existing browser locator finds one visible opener at either breakpoint; existing exact-name integration queries remain unambiguous (R3–R4).
- KTD4. **Record fresh evidence separately.** Preserve the six ow-5 PNGs and write new captures under `docs/plans/evidence/ow-13/`. The current browser helper writes ow-5 paths, so add an evidence-directory override with the existing default preserved. This changes artifact routing only; all four cases and assertions remain (R4–R5).

### High-Level Technical Design

The help dialog, shortcut guards and permission calculation stay shared. Only its opener placement changes (KTD3).

| Visitor | Desktop help | Phone help | Other toolbar tools |
|---|---|---|---|
| No valid access | Existing opener | New compact opener | Existing phone restrictions remain |
| Valid access | Existing opener | Existing opener | Existing availability remains |

### Assumptions and Execution Unknowns

The supplied initial HEAD represents the controller's intended dev base; this clone cannot verify live GitHub state. Repairing the documented mobile-help failure is the smallest source change needed to close R3 and R5. These are explicit planning assumptions, not fresh runtime results.

The build stage must recheck branch/object identity and reproduce the browser failure. If source has moved and the failure no longer exists, reconcile the source-diff requirement with the controller instead of manufacturing a cosmetic change. The settings regression remains required. Unix sockets are denied by the supplied sandbox contract; browser and Docker availability have not been probed here. A sandbox denial leaves acceptance open for a capable controller runner.

## Implementation Units

### U1. Integrate PR #85 and preserve its status regression

**Requirements:** R1–R2, R4. **Dependencies:** none.

**Files:** `__tests__/app/project-settings-github.integration.test.tsx`; `docs/plans/2026-11-08-1441-fix-ow-10-source-status-plan.md`; `docs/plans/evidence/ow-10/README.md`; `docs/plans/2026-09-20-0649-requirements-delivery-roadmap.md`.

**Approach:** Import the ordered range in the starting-state table using KTD1–KTD2. Resolve roadmap conflicts additively, preserving ow-11 and this plan's entry. Retain historical claims as dated evidence; the ow-13 receipt will own new results. Compare inherited production files and screenshots against the baseline to establish that original polish remains present.

**Tests:**

1. Idle integration with `source.ttl` shows the complete success paragraph, including that filename.
2. Idle integration with no source path shows exactly the success label, with no separator or filename.
3. Syncing, conflict and error show their existing messages and error details without an idle-success paragraph.

The settings integration seam exercises the real page through the existing HTTP fixture; it does not prove a live GitHub sync. **Verification:** Imported assertions and all prior settings cases pass without deletion or weakening; all three source commits have preserved effects.

### U2. Restore phone access to shortcut help

**Requirements:** R3–R4. **Dependencies:** U1.

**Files:** `app/projects/[id]/editor/page.tsx`; `__tests__/app/editor-page.integration.test.tsx`; `ui-tests/demo-polish.spec.ts`; `ui-tests/fixtures/demo-polish.ts` only if additive fixture coverage is necessary.

**Approach:** Apply KTD3 in the existing Button/Keyboard/dialog style. Keep shortcut handlers, permission calculations, the original toolbar group and its tests intact. Add regression coverage for the additional opener. The synthetic fixture must continue rejecting unexpected requests and all API mutations.

**Execution note:** First reproduce the existing narrow-viewport failure, then add the new opener's integration coverage before changing the page.

**Tests:**

1. At 390 × 844, an anonymous visitor opens help, sees the dialog within the viewport, closes it with Escape and regains opener focus.
2. At desktop size, the existing physical Shift+Slash, Close/Escape focus return and editable-field question-mark checks still pass.
3. Anonymous help omits privileged shortcuts; authorized help retains its current shortcuts and phone tools.
4. The original anonymous toolbar-hide and signed-in toolbar-availability assertions remain unchanged and pass; the new opener does not expose branch/history/health/PR tools on anonymous phones.
5. Viewport changes leave one visible help opener, no horizontal page overflow and no unexpected API request.

The integration file proves state, permissions and dialog wiring; Playwright proves actual responsive visibility and focus. **Verification:** All existing demo-polish cases pass with additive mobile coverage and a substantive source diff.

### U3. Capture final proof and prepare the controller handoff

**Requirements:** R4–R7. **Dependencies:** U1–U2.

**Files:** `ui-tests/demo-polish.spec.ts`; `docs/plans/evidence/ow-13/README.md`; new PNGs in `docs/plans/evidence/ow-13/`; `docs/plans/2026-09-20-0649-requirements-delivery-roadmap.md`.

**Approach:** Apply KTD4, capture the repaired editor at desktop and phone widths, and run the full verification contract after simplification and review. Record source revision, commands/results, screenshot route/viewport, inherited evidence provenance, unresolved gates and controller actions. Update only this item's roadmap status.

**Test scenarios:** The existing four-case browser suite still executes all assertions with the new evidence destination; desktop and phone editor captures show the real final page. No new business behavior belongs to this unit.

**Verification:** Historical screenshots remain committed, new images are visually inspected, and R5 has fresh evidence. The build handoff identifies both superseded PRs and separates completed local work from controller publication gates.

## Verification Contract

Use the repository toolchain and lockfile from the supplied cache. No application checks execute during this planning stage.

| Gate | Required build-stage evidence |
|---|---|
| Import and diff | Ordered PR commits preserved; current dev documents retained; final source and regression-test changes visible against the captured baseline and controller's current dev |
| Focused regression | Settings and editor integration suites plus existing `KeyboardShortcutDialog` and `useKeyboardShortcuts` suites pass; all prior cases/assertions remain |
| Full unit suite | `npm test` in single-run mode and `npm run test:coverage` in single-run mode pass without removed/skipped tests; bounded workers may avoid resource contention |
| Static and production | `npm run lint`, `npm run type-check` and `npm run build` pass; use the existing credential-free optional-auth build configuration from `.github/workflows/release.yml` |
| Hermetic harness | `test:e2e:ownership`, `test:e2e:profiles`, `test:e2e:evidence`, `test:e2e:identity`, `test:e2e:hosted-unit` and `test:ctt` pass via their npm scripts; CTT source remains untouched |
| Browser and screenshots | `npm run test:ui:demo-polish` passes every existing case; new editor desktop/phone PNGs are committed, inspected and named in the final handoff; no stale screenshot establishes current acceptance |
| Controller gates | Required CI, Semgrep, Docker/image checks and independent Astra/Fable reviews pass before merge; authenticate or run these only in the controller's authorized environment |

Use `ontokit-web.sh` on an unused owned port for browser verification; avoid its conflict-killing path. Keep fixtures synthetic and loopback-only. Do not read environment or credential files. No screenshot mock, disabled assertion, authenticated fixture substitution or sandbox-denied run counts as browser success.

## Definition of Done

- U1 preserves the requested import and complete source-status regression; U2 repairs the existing browser contract without weakening tests; U3 supplies fresh verification and screenshot evidence.
- The branch satisfies R1–R7, contains source and tests, and leaves no abandoned implementation attempts or unrelated changes. Any cleanup honors verified-backup requirements.
- The roadmap points to the plan and final receipt while preserving all B01–B75 dispositions.
- The controller reconciles missing campaign excerpts and live dev, publishes the PR as superseding #85 and #74, and completes the merge gate. A planning commit, historical green result or incomplete browser gate does not establish item completion.
- No migration, data rewrite, package release, new service or Damien-only decision is expected. Any newly essential decision is reported using the mandate's `## Needs your decision` fields; controller-owned runtime capacity and publication checks are not requests for Damien's credentials.
