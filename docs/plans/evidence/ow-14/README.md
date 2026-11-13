# ow-14 integration verification

Date: 2026-11-13. Plan: [PR #88 integration](../../2026-11-11-0723-fix-ow14-pr88-integration-plan.md).

The PR #88 source and tests are integrated onto supplied dev baseline
`a12c78663bcf14b55740fe18077aa876cda3cab3` (#87). This branch is intended for a
replacement PR that supersedes **#88, #85 and #74**. Publication, current upstream
comparison and campaign merge gates belong to the controller. No remote was added
and no push, PR, merge or deployment ran in this lane.

**Acceptance remains open:** this sandbox prohibits Chromium launches. No fresh
ow-14 screenshot or runtime browser pass is claimed. Historical screenshots are
retained with their original provenance; they do not prove this combined tree.

## Integration and preservation

The build resumed with all six imported commits already present and the planned
breakpoint regression uncommitted. The regression was preserved, checked and
committed as `afdf43dd`. The plan itself remains unchanged.

| Original PR commit | Integrated commit | Effect |
|---|---|---|
| `078d8bb8` | `8cc528ea` | ow-13 integration plan and roadmap entry |
| `bb66cadc` | `25b5d9e4` | ow-10 source-status plan |
| `2063268a` | `d2d01b7f` | Complete idle-status regression |
| `a440e2ba` | `1974f2d5` | ow-10 receipt and roadmap update |
| `43b541a5` | `25a589db` | Mobile help and additive integration/browser tests |
| `08f7916c` | `0fefd820` | Nine historical screenshots, manifest and ow-13 receipt |

`git range-diff 6dff05a0..08f7916c 7773c4b0..0fefd820` confirms the six-commit
mapping. Conflict resolution keeps both histories' roadmap entries and #87's
header containment. The ordinary help opener stays outside the restricted
toolbar; anonymous visitors see it from 768px upward and the compact opener
below 768px. Authorized editors retain the ordinary opener at every width.
Both controls use the existing dialog state and permission-filtered shortcuts.

The source-status test matches the incoming PR exactly: idle status includes the
nested filename when present, is exactly `In sync` without a path, and is absent
during syncing, conflict and error. Existing tests were not deleted, weakened or
skipped. Project viewer and Developer layout match the supplied baseline; all
eight existing source-preview browser cases remain unchanged. The new browser
loop checks 767px, 768px,
767px and 1440px for one correctly named visible opener, viewport containment,
filtered help, Escape dismissal and focus return.

Review added an authorized-editor browser case in `06d6a4f7`, using the existing
synthetic session fixture. At 1440px, 390px, 767px, 768px and back to 1440px it
checks one ordinary opener fully inside the viewport, no page overflow, keyboard
activation with Enter, privileged shortcut content and Escape focus return.

## Verification

Runtime: Node 24.22.3, existing dependency lockfile and installed dependencies.
No dependency or product configuration was changed.

| Check | Result |
|---|---|
| Focused settings/editor, shortcut, preview and layout tests | 8 files / 187 tests passed |
| `npm test -- --run --maxWorkers=2` | 383 files / 5,748 tests passed |
| `npm run test:coverage -- --run --maxWorkers=2` | 383 files / 5,748 tests passed |
| `npm run lint` | Passed: 0 errors, 21 existing warnings |
| `npm run type-check` | Passed |
| Credential-free production build | Passed with `AUTH_MODE=optional`, local API/WS URLs |
| `test:e2e:ownership` | 35 passed |
| `test:e2e:profiles` | 61 passed |
| `test:e2e:evidence` | 107 passed |
| `test:e2e:identity` | 13 passed |
| `test:e2e:hosted-unit` | 12 passed |
| `test:ctt` | 68 passed; CTT source unchanged |
| Demo-polish Playwright discovery | 4 cases listed; no browser launched |
| Source-preview Playwright discovery | 9 cases listed; no browser launched |
| Browser runtime and fresh screenshots | Pending controller host run |
| Simplification | Single combined review: no findings or edits |
| Code review | Correctness, testing and project standards: no code findings; acceptance not ready |

The initial `npm test -- --run` overlapped the production build and failed
11 cases in 8 files on timeouts or asynchronous UI assertions (5,737 passed).
The passing full rerun uses `--maxWorkers=2` with no competing build and preserves all
timeouts, assertions and test cases. This scheduling change is local to the
verification command, not a repository configuration change.

Coverage reports 97.93% statements, 95.01% branches, 98.21% functions and 99.1%
lines across the repository's configured library/component coverage scope.

[The review receipt](review.json) covers source/test revision `06d6a4f7`. Its
`Not ready` verdict retains the missing browser execution, fresh screenshots and
controller gates. The local review does not replace the campaign's independent
Astra/Fable reviews. The documentation draft and then-running coverage check
were outside that review snapshot; this receipt records the final local results.

## Screenshot provenance

All nine `docs/plans/evidence/ow-13/*.png` files match both their original manifest
SHA-256 values and required PR head `08f7916c`. The ow-5, ow-9 and ow-12 evidence
trees are unchanged from the supplied baseline. `manifest.json` records the
current source hashes and labels inherited evidence separately.

The editor is the only product page changed against the supplied baseline. Its
inherited captures are:

- `docs/plans/evidence/ow-13/editor-desktop.png`
- `docs/plans/evidence/ow-13/editor-mobile.png`
- `docs/plans/evidence/ow-13/editor-shortcuts.png`
- `docs/plans/evidence/ow-13/editor-shortcuts-mobile.png`

Fresh counterparts must land under `docs/plans/evidence/ow-14/`. Retain all other
fresh demo-polish and source-preview captures, inspect them visually, and update
the manifest with route, viewport, source revision and image hashes.

## Controller host continuation

Use Node 24 and a clean, credential-free checkout of this branch on a host where
Chromium is permitted. The following commands have **not** run browser tests in
this lane. Do not count `--list` or historical images as acceptance.

In a dedicated terminal, start the repository's ownership-checking server wrapper:

```sh
node e2e/ui/server.mjs 3105
```

It probes the port and delegates to `ontokit-web.sh` with a TTY, refusing an
existing PID or conflicting port rather than killing an unrelated process.
Use the same verified unused port in all commands if 3105 is unavailable. Wait
for the local server to be ready, then run:

```sh
DEMO_POLISH_BASE_URL=http://localhost:3105 DEMO_POLISH_EVIDENCE_DIR=docs/plans/evidence/ow-14 npm run test:ui:demo-polish
```

The source-preview suite writes fixed historical ow-12 paths. Back up and verify
those bytes before running it, then copy fresh captures into ow-14 and restore
the historical files even if the suite fails:

```python
import hashlib
import os
from pathlib import Path
import shutil
import subprocess
import tempfile

historical = Path("docs/plans/evidence/ow-12")
destination = Path("docs/plans/evidence/ow-14")
backup = Path(tempfile.mkdtemp(prefix="ow14-source-preview-backup-"))
images = sorted(historical.glob("*.png"))
assert images, "Expected committed historical screenshots"
for path in images:
    saved = backup / path.name
    shutil.copy2(path, saved)
    assert saved.read_bytes() == path.read_bytes()

try:
    env = dict(os.environ, OW4_UI_BASE_URL="http://localhost:3105")
    result = subprocess.run([
        "npx", "--no-install", "playwright", "test", "--config", "playwright.ui.config.ts"
    ], env=env)
    if result.returncode == 0:
        destination.mkdir(parents=True, exist_ok=True)
        for path in images:
            shutil.copy2(path, destination / path.name)
finally:
    for path in images:
        shutil.copy2(backup / path.name, path)
        assert hashlib.sha256(path.read_bytes()).digest() == hashlib.sha256(
            (backup / path.name).read_bytes()
        ).digest()
result.check_returncode()
```

Stop the wrapper with Ctrl+C after both suites; close every opened browser,
context and page. Commit inspected final-source screenshots and their updated
manifest before marking R5/U2 complete. The backup above is retained for recovery.

The controller also reconciles the unavailable chief campaign Goal Capsule and
cited R-IDs, checks actual current `dev`, runs required CI/Semgrep/Docker and
independent Astra/Fable reviews, then publishes the superseding PR. No schema,
data, package release, outside service, spend or Damien-only decision is needed.
Hosted DEV rehearsal, persona UAT and all other roadmap dispositions remain open
as recorded in their own lanes.
