# ow-15 review repair

Plan: [shortcut regression review repair](../../2026-11-20-2043-fix-ow15-review-repair-plan.md).

**Acceptance is open.** This socket-denied lane cannot launch Chromium. Neither
complete browser suite has executed here, and there are no fresh ow-15 screenshots.
Discovery is not runtime proof. The controller must complete the host gate before
merging. The replacement PR supersedes **#89, #88 and #85**.

Proposed title: `fix: preserve shortcut-help regressions and verify phone access`.

## Repair and preservation

Starting branch: `drawdown/ow-15`, plan commit `441b489c`, carrying ow-14 ancestor
`caaa157060ccc457dacce7a6bf2dad8530577bd6`. Local #87 baseline:
`a12c78663bcf14b55740fe18077aa876cda3cab3`. Current upstream comparison remains a
controller duty; this clone has no remote or login.

- The editor page is byte-identical to #87. The ordinary opener remains outside
  the restricted toolbar. No browser failure supports restoring the duplicate.
- The complete “In sync” settings regression is unchanged, including nested
  filename, missing filename, and non-idle status cases.
- Anonymous optional/disabled tests retain permission filtering and Escape focus
  return, and now require exactly one ordinary opener. Before restoration these
  two cases failed because they found two controls; afterwards all 53 focused
  settings/editor cases passed.
- Anonymous browser coverage retains Shift+Slash and search-input behavior,
  390px phone and 767/768px breakpoint checks, permission filtering, dialog
  containment and focus return. Full viewport checks strengthen phone access.
- The authorized case moves intact into `e2e/ui/keyboard-shortcuts.spec.ts`, with
  explicit discovery. All four demo-polish and nine source-preview/shortcut cases
  remain discoverable. No test is deleted, skipped or weakened.
- Every source-preview screenshot writer accepts `OW4_UI_EVIDENCE_DIR`. Use fresh
  ignored paths for every attempt; the old overwrite-and-restore recipe is retired.

## Verified artifact cleanup

Before removal, all 14 files in [the inventory](removed-artifacts.tsv) were read
from ancestor `caaa1570` and compared byte-for-byte with their working copies.
Every comparison passed, and that ancestor remains reachable from this branch.
The inventory records the original repo-relative path and Git blob for recovery:

```sh
git show caaa1570:docs/plans/evidence/ow-13/README.md
```

Only the mandated ow-10/ow-13 plans, receipts and binaries were removed. Retained
ow-14 documents explicitly identify archived paths and link to this continuation.
Historical ow-5, ow-9 and ow-12 evidence remains unchanged.

## Verification

Source/test commit: `949117e3ed802abb8d773f6c03e2334b549855d2` (restoration in
`af891639`, capture routing and moved spec in `949117e3`). Date: 2026-11-20.
Runtime: Node 24.22.3, matching the repository's Node 24 CI line. Dependencies
were installed with `npm ci --ignore-scripts --no-audit --no-fund`; the lockfile
and dependency declarations are unchanged.

| Check | Result |
|---|---|
| Focused settings/editor regression | 2 files / 53 tests passed after the two expected pre-restoration failures |
| `npm test -- --run --maxWorkers=2` | 383 files / 5,748 tests passed |
| `npm run test:coverage -- --run --maxWorkers=2` | 383 files / 5,748 tests passed on final source |
| `npm run lint` | Passed: 0 errors, 21 existing warnings |
| `npm run type-check` | Passed |
| `npm run build` with local API/WS URLs and `AUTH_MODE=optional` | Passed |
| `npm run test:e2e:ownership` | 35 passed |
| `npm run test:e2e:profiles` | 61 passed |
| `npm run test:e2e:evidence` | 107 passed |
| `npm run test:e2e:identity` | 13 passed |
| `npm run test:e2e:hosted-unit` | 12 passed |
| `npm run test:ctt` | 68 passed; CTT source unchanged |
| Demo-polish discovery | 4 cases listed, no browser launched |
| Source-preview/shortcut discovery | 9 cases in 3 files listed, moved case exactly once |
| Complete Chromium suites / fresh screenshots | Pending controller host |
| Historical source/evidence and cleanup checks | Passed |

An initial type check caught an unsupported Testing Library `exact` option in
the revised test. Removing that unnecessary option preserved exact string-name
matching; the subsequent complete type check passed. No assertion was relaxed.
The complete coverage run executed after that correction against final source.
Coverage: 97.93% statements, 95.01% branches, 98.21% functions and 99.1% lines
within the configured library/component scope. Expected release-script error output comes from negative
unit cases, not failures of the final unit run.

Browser execution and captures remain pending regardless of local results.
No hosted acceptance, publication or deployment is claimed.

## Review and remaining gate

`ce-simplify-code` used a single combined review of the scoped changes. It found
no reuse, quality, efficiency or test-value issue. One optional comment deletion
was skipped to leave the proof-test file intact; no simplification edit was needed.

`ce-code-review` reviewed source/test head `949117e3` against #87 and the offered
documentation using correctness, project instructions and the explicit plan.
It found no source, test or documentation defect. It verified the byte-preserving
test move, unchanged settings regression, recoverable artifact inventory,
unchanged historical evidence, unchanged B01–B75 ledger and valid retained links.
The review snapshot preceded completion of coverage/build/harness checks; the
passing results above complete that local verification without changing source.

**Verdict: Not ready.** The remaining P1 is to execute both full Chromium suites
on final source and commit fresh inspected editor captures with hashes. This is
an acceptance gate, not a demonstrated opener defect. It cannot be applied in
this lane because the user explicitly prohibits browser launches in the sandbox.
`ce-test-browser` therefore stops at preflight; no route, screenshot or browser
version is reported as verified. No server or browser was started here.

Local review does not replace the controller's independent Astra/Fable reviews.
The local-only LFG handoff is stopped at browser acceptance; no DONE, push, PR,
merge or deployment is claimed. The controller owns the next executable step
below, with no new authorization or decision requested from Damien.

## Required controller host run

Use a clean, credential-free checkout of the final branch with Node 24 and an
installed Playwright Chromium on a host that permits browsers. Do not execute
these commands in the socket-denied lane. In a dedicated terminal start:

```sh
node e2e/ui/server.mjs 3105
```

The wrapper verifies ownership and an unused port, then uses `ontokit-web.sh`.
If that port is unavailable, select another unused port and update both URLs.
Wait for the server to be ready. In a second terminal create a new attempt:

```sh
set -e
mkdir -p test-results/ow-15
OW15_RUN=$(mktemp -d test-results/ow-15/run-XXXXXXXX)
git rev-parse HEAD > "$OW15_RUN/source-commit.txt"
DEMO_POLISH_BASE_URL=http://localhost:3105 DEMO_POLISH_EVIDENCE_DIR="$OW15_RUN/demo-polish" npm run test:ui:demo-polish -- --output="$OW15_RUN/demo-polish-results"
OW4_UI_BASE_URL=http://localhost:3105 OW4_UI_EVIDENCE_DIR="$OW15_RUN/source-preview" npx --no-install playwright test --config playwright.ui.config.ts --output="$OW15_RUN/source-preview-results"
```

Both **complete** suites must exit zero against final source (four and nine cases).
A failed first command must remain a failure even if the second passes. Record
both exit results and full suite counts. If source, tests or configuration change,
rerun both suites into a new attempt directory. Record Chromium/Playwright
versions, source commit and viewport sizes; distinguish screenshot dimensions
from browser viewports because full-page captures can be taller.

After both suites pass, visually inspect the four editor captures from
`demo-polish/` and copy them byte-for-byte to a **new** run directory under
`docs/plans/evidence/ow-15/`:

- `editor-desktop.png` and `editor-shortcuts.png`: 1440×900 viewport.
- `editor-mobile.png` and `editor-shortcuts-mobile.png`: 390×844 viewport.

Record matching source/destination SHA-256 hashes and commit the images plus
this updated receipt. Name each committed image as `SCREENSHOT: <path>` in the
handoff. Do not reuse an old run directory or relabel historical images as new.
Verify historical ow-5/ow-9/ow-12 image hashes remain unchanged. Stop the server
wrapper with Ctrl+C and close all owned browser pages, contexts and processes.

If the restored opener actually fails at phone width, retain the failing source
identity, viewport and output before the smallest demonstrated repair; then run
both complete suites again. A stale label or unavailable browser is not proof.

The controller also reconciles the chief campaign Goal Capsule and cited rules,
actual current `dev`, CI/Semgrep/release image checks and independent Astra/Fable
reviews before publishing the replacement PR. No new Damien decision is needed.
