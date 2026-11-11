# ow-12: PR #84 integration and source-preview acceptance

The supplied PR is integrated on the controller's current-base snapshot. Both
project routes now contain their source preview at phone and tablet widths.
The replacement PR targets `dev` and **supersedes #84 and #73**.

## Provenance

- Starting base: `6dff05a0e01a37e24c57e8f22716d2af7a32bcd7`.
- Plan checkpoint: `b2dec8a9`; [implementation plan](../../2026-11-11-0035-fix-ow12-pr84-integration-plan.md).
- Supplied PR head: `2ffc92d2e46c60d821774349f1e83d1769f88cfe`.
- Applied the entire merge-base-to-head range with the mandated cherry-pick.
  `9ad5f0ab`, `659fff65`, `f99ed9e9`, `2ffc92d2` became `0568794b`,
  `e8a0ecf0`, `cdea24a0`, `0d55e385`. Only roadmap conflicts required resolution.
- Current-base ow-11 documentation remains byte-for-byte intact. The ow-9
  plan and entire evidence directory match the supplied PR head. All seven
  original PNG checksums pass. They retain their historical failing-run labels.
- The original preview production code was already integrated through `0f74cea6`.
  This branch adds the supplied executable viewer tests and fixture, plus the
  narrow-layout repair and additive checks; it is not a documentation-only PR.
- Final production code is in `066d1a6b`; its tree is
  `82199e3cb886cbfed2505728eb13c910c14272d7`. Later changes correct test-only
  query typing and add evidence. Full coverage, types, lint and build verify `361731c6` (tree
  `9d41953deeaf3ab00edaa0b386d4f22888134689`); later commits contain evidence only.

## What failed and changed

The preserved acceptance case reproduced the old failure: three cases passed,
one failed at the existing 768px document-width assertion. Runtime measurement
showed a 1,198px document at that viewport: the editor header's controls did not
wrap. At 390px the shared Developer layout had a 638px intrinsic width. New
long-line checks failed on both routes at both widths, with panels extending to
roughly 7,782px at 768px.

Project headers now wrap their controls. The Developer wrappers can shrink, and
phones stack the bounded tree above the detail/preview pane. Long Turtle lines
scroll inside the preview body. Source and Graph keep a usable phone height;
view buttons retain accessible names when their visible labels disappear.

The unchanged demo-polish suite also reproduced missing anonymous mobile help.
Shortcuts now sits outside the hidden desktop-tools group. Existing unit tests
still assert that group is shown for signed-in editors and hidden for anonymous
phone users; they now locate it through History and additionally check Health,
PRs and the separation of Shortcuts. No test or existing assertion was deleted,
relaxed or skipped. The viewer's explicit mobile wrapping class is retained.

New keyboard checks follow Radix's existing focus order: Entity source tab,
tab panel, Copy snippet, Open full source. Capture preparation resets scroll
positions only after the geometry, scrolling, focus and clipboard assertions.

## Verification

All local gates pass. Commands and exit results are recorded in
[verification.txt](verification.txt). Campaign publication gates remain with the
controller.

| Check | Result |
|---|---|
| Source-preview Playwright suite | 8/8 pass, including every assertion in the four inherited cases |
| Shared-page demo-polish Playwright suite | 4/4 pass; unchanged test file |
| Targeted editor/viewer/layout regression | 57/57 pass before test-only query typing cleanup |
| Hermetic ownership/diagnostics | 35/35 pass on isolated rerun |
| Hermetic profiles | 61/61 pass |
| Hermetic evidence | 107/107 pass |
| Hermetic identity | 13/13 pass |
| Existing CTT/rehearsal tests | 68/68 pass; no CTT implementation changes |
| Hosted-runner unit tests | 12/12 pass; no hosted execution |
| Full Vitest coverage | 383 files / 5,743 tests pass; statements 97.93%, branches 95.01%, functions 98.21%, lines 99.10% |
| Type-check | Pass |
| ESLint | Pass; 0 errors and 21 existing warnings |
| Production build | Pass with public optional-auth/loopback configuration; existing dynamic sitemap tracing warnings |
| Browser discovery | All 8 cases listed |
| Preservation | Original PNGs, ow-9 evidence and ow-11 files match their source revisions |

Runtime: Node 24.22.2, npm 11.6.2, Next.js 16.3.1, Playwright 1.63.0,
Chromium headless shell 153.0.8010.12 (revision 1243). The initial Node 24.13.0
was below jsdom's supported patch level; verification used the newer Node 24.
The lockfile and dependency manifest are unchanged.

An initial concurrent ownership run missed a 250ms child-start readiness window;
the unchanged suite passed on rerun. Interim checks found a mobile-class assertion
and an editor tools-group locator tied to the old markup; the fixes above preserve
the contracts. Type-check also caught a Playwright-only `exact` query option in
the added Testing Library checks; removing that ignored option preserves exact
string-name matching. Superseded/incomplete runs are not acceptance evidence.

## Browser evidence

All images were visually inspected. `SHA256SUMS` records their bytes. The eleven
source-preview captures are from production/test source `066d1a6b`. The help
capture is from `451333a5`, with the same final editor implementation. The later
viewer-class and test-only changes do not affect that help page.

| Image | Route and state |
|---|---|
| `editor-entity-source-preview-desktop.png` | `/projects/11111111-1111-4111-8111-111111111111/editor`, 1440×900, light, hasGuide |
| `editor-entity-source-preview-desktop-dark.png` | Same route and viewport, dark |
| `editor-entity-source-preview-mobile.png` | Same route, 390×844, light, contained preview |
| `editor-entity-source-preview-acceptance.png` | Same route, 1440×1000, light, alice selection |
| `editor-entity-source-preview-acceptance-dark.png` | Same route and selection, dark |
| `project-viewer-entity-source-preview-desktop.png` | `/projects/11111111-1111-4111-8111-111111111111`, 1440×900, light, hasGuide |
| `project-viewer-entity-source-preview-desktop-dark.png` | Same route and viewport, dark |
| `editor-entity-source-preview-390.png` | Editor, 390px, long source line and keyboard focus on full-source action |
| `editor-entity-source-preview-768.png` | Editor, 768px, same long-line/focus state |
| `viewer-entity-source-preview-390.png` | Viewer, 390px, same long-line/focus state |
| `viewer-entity-source-preview-768.png` | Viewer, 768px, same long-line/focus state |
| `editor-keyboard-shortcuts.png` | `/projects/demo-polish/editor`, 1440×900, anonymous shortcut dialog |

The suite verifies exact snippet copying, read-only viewer full source, unsaved
editor source retention, selection changes, Graph/Standard navigation, keyboard
and pointer reachability, internal horizontal scrolling and zero API writes.

The browser used `playwright.ui.config.ts`, real Next pages and locally supplied
Monaco assets, with explicit synthetic GET/session fixtures and rejected writes.
The owned server used `e2e/ui/server.mjs` and the repository manager's existing
process-ownership safeguards. No forced restart or security change was needed.
These are local presentation/interaction results, not hosted DEV authentication,
API authorization, real FOLIO data or BAIF rehearsal acceptance.

## Local workflow and review

The `lfg` build completed U1–U3. Simplification found no warranted code changes.
The final test-locator/query corrections retain all assertions and add no new
abstraction. Full-depth `ce-code-review` of `728a731f` completed correctness,
project-standards and testing passes with no findings; see [review.json](review.json).
The review made no source changes. Later changes only archive this result.

The browser acceptance covers the two affected project routes through eight
preview cases and four shared-page demo-polish cases, with no skips or manual
verification. Browser console diagnostics were not separately audited by these
suites; the result covers their explicit assertions and inspected images.
`ce-compound` documentation was skipped: the demonstrated overflow, focus-order
and tools-group failures already have durable regression assertions in the
existing suites. No duplicate lesson document is needed.

An automatic compaction hook briefly committed two unrelated GSD pause files.
Their bytes remain backed up in `309ad6a0`; the next commit removed only those
hook-generated files. They are absent from the final against-base diff.

## Controller handoff

The clone has no remote; all changes are local. Controller publication must
compare this branch with actual current `dev`, reconcile the chief campaign Goal
Capsule/cited requirements unavailable in this clone, run policy/security checks
and Astra/Fable reviews, then open the replacement PR superseding #84 and #73.
No controller review, push, merge or deployment is claimed here.

The source-preview slice passes its local acceptance gates and is ready for
controller review and publication.
B27's full-source modal/maximize/restore and overlay synchronization, the broader
B24–B27 work, and hosted rehearsal/persona acceptance keep their existing owners.
No migration, data rewrite, package release, outside service, spend or Damien-only
decision is required.
