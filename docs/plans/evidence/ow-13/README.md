# Ow-13 demo polish integration evidence

The local branch preserves PR #85's complete source-status regression and restores shortcut help for anonymous phone viewers. The controller's new PR should supersede **#85 and #74** and target `dev`.

## Scope and provenance

- [Implementation plan](../../2026-11-11-0126-fix-ow13-demo-polish-integration-plan.md); branch `drawdown/ow-13`.
- Supplied dev baseline: `6dff05a0e01a37e24c57e8f22716d2af7a32bcd7`; initial plan commit: `078d8bb8`.
- Required head `d942379c649eab888e0446062afdded5d40f7626` was present. The complete merge-base range imported as `f9aaa921` → `bb66cadc`, `1515cdd3` → `2063268a`, and `d942379c` → `a440e2ba`. Roadmap conflicts were resolved additively, retaining current ow-11 and ow-13 entries.
- Final source/test repair: `43b541a53f682290bdd281ad0ab50ead11387355`. [Manifest](manifest.json) binds the tested files and screenshot bytes to that source. Later changes are evidence and roadmap documents only.
- Original demo polish is inherited from `ad170cfd`. The six historical [ow-5 screenshots](../ow-5/README.md) remain byte-for-byte unchanged. [Ow-10 evidence](../ow-10/README.md) remains dated historical evidence; this receipt closes its local mobile browser failure.

The only production change is a compact, phone-only help opener outside the anonymous hidden toolbar group. It shares the existing dialog state and permission-filtered shortcuts. The desktop opener, signed-in toolbar, shortcut handlers and existing toolbar restriction assertions remain intact. No dependency, API, authentication policy, migration, stored format, external service or CTT source changed.

## Regression proof

Before implementation, the unchanged editor browser case timed out clicking help after resizing to 390 × 844. Two additive integration cases also failed because the mobile opener was absent, while 38 other editor cases passed. After implementation, all 40 editor cases pass. The new cases cover optional/disabled anonymous modes, permission-filtered help, Escape focus return and avoiding a duplicate opener for authorized editors.

The imported settings file is identical to PR #85's version. Its 13 cases include complete `In sync — source.ttl` paragraph text, `In sync` without a path, and no idle paragraph during syncing/conflict/error. Existing assertions remain; no test was deleted, skipped or weakened.

Playwright retains all four existing cases and adds one-visible-opener checks at desktop, phone and desktop-again widths, accessible-name checks, overflow checks and mobile screenshots. The fixture still rejects every unexpected API request and all mutations. `DEMO_POLISH_EVIDENCE_DIR` routes new images separately while preserving the ow-5 default.

## Fresh verification — 2026-11-11

| Check | Command | Result |
|---|---|---|
| Focused settings/editor/dialog/keyboard | `npm test -- --run --maxWorkers=2` with the two app integration files, `KeyboardShortcutDialog.test.tsx`, and both `useKeyboardShortcuts` test files | 5 files, 104 tests pass |
| Full unit suite | `npm test -- --run --maxWorkers=2` | 383 files, 5,748 tests pass; no skips |
| Full coverage | `npm run test:coverage -- --run --maxWorkers=2` | 383 files, 5,748 tests pass; statements 97.93%, branches 95.01%, functions 98.21%, lines 99.10% |
| Lint | `npm run lint` | 0 errors; 21 existing warnings |
| Types | `npm run type-check` | Pass |
| Production build | `AUTH_MODE=optional NEXT_PUBLIC_API_URL=http://localhost:8000 NEXT_PUBLIC_WS_URL=ws://localhost:8000 npm run build` | Pass |
| Ownership/diagnostics | `npm run test:e2e:ownership` | 35 pass |
| Profiles | `npm run test:e2e:profiles` | 61 pass |
| Evidence | `npm run test:e2e:evidence` | 107 pass |
| Identity | `npm run test:e2e:identity` | 13 pass |
| Hosted runner units | `npm run test:e2e:hosted-unit` | 12 pass |
| CTT/rehearsal units | `npm run test:ctt` | 68 pass; CTT source untouched |
| Browser | `DEMO_POLISH_EVIDENCE_DIR=docs/plans/evidence/ow-13 npm run test:ui:demo-polish` | 4/4 pass in Chromium; real pages with synthetic public reads |

Dependency installation used the existing lockfile. The offline attempt lacked cached tarballs; ordinary installation completed without changing the lockfile. The system Node 22.22.1 build lacks TypeScript stripping, so its profile run failed with `ERR_UNKNOWN_FILE_EXTENSION`. Official Node 24.15.0, matching CI's major version, passes all 61 profile checks and the full coverage suite. The earlier unit/build/browser checks pass under system Node. No assertion or harness was changed for that environment difference.

The first post-fix browser attempt found the dev server had exited after its shell session ended. Keeping script startup and the browser suite in the same command session produced the passing run. The owned server used free port 3105 and was stopped through `ontokit-web.sh`. No sandbox denial is claimed: real Chromium ran here. Framework-generated instructions and the baseline screenshot overwritten during failure reproduction were backed up, verified and restored; neither enters the branch diff.

## Browser routes and screenshots

All nine images were captured from the final source and visually inspected. Full-page captures may be taller than their viewport. The local Next development indicator is visible; no hosted persona, real ontology content or credential appears.

| Route | Viewport | Screenshot | Result |
|---|---|---|---|
| `/projects/demo-polish/editor` | 1440 × 900 | [editor-desktop.png](editor-desktop.png) | Desktop toolbar and loaded tree |
| `/projects/demo-polish/editor` | 1440 × 900 | [editor-shortcuts.png](editor-shortcuts.png) | Existing help and filtered shortcuts |
| `/projects/demo-polish/editor` | 390 × 844 | [editor-mobile.png](editor-mobile.png) | Compact help opener; other tools remain hidden |
| `/projects/demo-polish/editor` | 390 × 844 | [editor-shortcuts-mobile.png](editor-shortcuts-mobile.png) | Dialog fits phone; Escape returns focus |
| `/` | 1440 × 900 | [projects-loading.png](projects-loading.png) | Loading announcement and skeletons |
| `/` | 1440 × 900 | [projects-no-results.png](projects-no-results.png) | Search recovery and keyboard focus |
| `/hydration-review` | 1440 × 900 | [hydration-entry.png](hydration-entry.png) | Keyboard-accessible bundle picker |
| `/hydration-review` | 1440 × 900 | [hydration-review-desktop.png](hydration-review-desktop.png) | Saved correction; reload/export assertions pass |
| `/hydration-review` | 390 × 844, dark | [hydration-review-narrow-dark.png](hydration-review-narrow-dark.png) | RTL and long IRIs; controls fit and table scrolls |

## Review and controller handoff

Combined simplification review found no changes needed across reuse, quality, efficiency and test value. Independent local correctness, project-standards and testing reviews returned zero findings. No eligible review fix or unapplied finding remains. The controller's separate Astra/Fable reviews remain required.

The local checks above do not establish hosted DEV acceptance. The clone has no remote, named dev ref or GitHub login. No push, PR creation, merge or deployment ran. The controller must reconcile the unavailable chief campaign excerpts and any live dev movement, run required CI/Semgrep/Docker and campaign review gates, then publish the replacement PR targeting `dev`. Existing hosted rehearsal, persona UAT and other roadmap areas retain their owners and dispositions.

No held change or Damien-only decision is required.
