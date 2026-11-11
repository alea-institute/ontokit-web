# Project viewer and editor source-preview evidence

Captured 2026-11-08 for [the evidence repair plan](../../2026-11-08-1407-fix-ow9-page-evidence-plan.md).

**Status: capture coverage implemented; full acceptance remains blocked.** Both
changed routes have current desktop light/dark screenshots. The new viewer case
passes, including keyboard preview activation, snippet-copy fidelity, rejected
full-source editing, unchanged source contents, route preservation and zero API
writes. The complete browser suite still fails its existing 768px page-overflow
assertion. The mobile screenshot also shows clipping; it is diagnostic evidence,
not a responsive-layout acceptance claim.

## Source and capture provenance

- Starting head: `9ad5f0ab` (committed repair plan), retaining application source
  `09f68ff9` and the integrated `ow-4` commit `0f74cea6` (PR #73).
- Final application/test tree: `659fff65b9c930495e268ee63d99b78b2830a424`.
  Screenshots were produced from the working tree committed as this revision;
  subsequent changes are evidence/documentation only. No product code changed.
- Runner: Linux; final capture used Node `24.15.0`, Playwright `1.63.0`, bundled
  Chromium `153.0.8010.12`, Next.js `16.3.1`. No hosted target or login was used.
- Real Next.js routes render through `playwright.ui.config.ts` and the existing
  server manager with its ownership safeguards. Each case gets a fresh browser
  context. The fixture sets Developer mode and light theme; desktop cases switch
  to dark theme for the second image. Screenshots disable animations.
- API/session data are synthetic: project
  `11111111-1111-4111-8111-111111111111`, ontology namespace
  `https://example.org/ow4/`, source file `ontologies/demo.ttl`.
- The fixture rejects API writes and reports unmapped reads. The viewer exposed
  a missing `GET /api/v1/projects` demo-workspace lookup. Its explicit response
  now matches only the public demo query for this project with skip 0/limit 1;
  it returns an empty list. No blanket success fallback was added. Installed
  Monaco assets continue to be served through the existing intercepted CDN URL.

These captures prove local rendering and navigation, not hosted authentication,
API permissions, DEV compatibility, submission/review/merge or a BAIF rehearsal.
The existing `ow-4` images and dated receipts remain unchanged.

## Image inventory

All paths below are relative to this directory. Every PNG was opened for visual
inspection and validated as a nonempty PNG. Desktop previews show the real source
filename, selected entity, Turtle statement and copy/full-source controls.
[SHA-256 checksums](SHA256SUMS) bind this inventory to the captured files.

| Route | Theme and viewport | Selected entity | Image |
|---|---|---|---|
| `/projects/{id}/editor` | Light, 1440×900 | `hasGuide`, line 8 | [Editor desktop](editor-entity-source-preview-desktop.png) |
| `/projects/{id}/editor` | Dark, 1440×900 | `hasGuide`, line 8 | [Editor desktop dark](editor-entity-source-preview-desktop-dark.png) |
| `/projects/{id}/editor` | Light, 390×844 | `hasGuide`, line 8; clipped | [Editor mobile diagnostic](editor-entity-source-preview-mobile.png) |
| `/projects/{id}/editor` | Light, 1440×1000; full-page image 1440×1008 | `alice`, line 13 | [Editor acceptance capture](editor-entity-source-preview-acceptance.png) |
| `/projects/{id}/editor` | Dark, 1440×1000; full-page image 1440×1008 | `alice`, line 13 | [Editor acceptance capture dark](editor-entity-source-preview-acceptance-dark.png) |
| `/projects/{id}` | Light, 1440×900 | `hasGuide`, line 8 | [Project viewer desktop](project-viewer-entity-source-preview-desktop.png) |
| `/projects/{id}` | Dark, 1440×900 | `hasGuide`, line 8 | [Project viewer desktop dark](project-viewer-entity-source-preview-desktop-dark.png) |

The acceptance-case images are taken before that case's failing narrow-width
check. Their filenames do not imply that the complete acceptance case passed.

## Browser verification

```sh
npx playwright test --config=playwright.ui.config.ts --list
npx playwright test --config=playwright.ui.config.ts
```

Discovery finds four tests in two files. The full final run reports **3 passed,
1 failed (14.4 seconds)**. [Final browser output](browser-final.txt) records the
failure, with machine-local paths removed. Both desktop routes and the mobile
capture case pass; the pre-existing behavioral acceptance case fails at
`e2e/ui/entity-source-preview.spec.ts:52`:

```ts
expect(await page.evaluate(() =>
  document.documentElement.scrollWidth <= window.innerWidth
)).toBe(true);
```

The same assertion failed in the [baseline run](browser-baseline.txt), performed
after redirecting screenshot destinations but before adding viewer coverage or
changing fixtures: **2 passed, 1 failed (13.1 seconds)**. The panel's own bounding
box assertion passes first, but the page is wider than its 768px viewport. Later
Graph/Standard-mode assertions in this case do not execute. No assertion was
removed, skipped or weakened to obtain these results.

During development, the new viewer test first exposed Monaco's native input DOM
(its IME textarea is always read-only, so that attribute cannot prove editor
permissions), then native clipboard CRLF line endings and the unmapped demo
lookup. The final test drives the visible editor, observes its read-only rejection,
and compares copied full-source text with only clipboard line endings normalized.
Snippet copying retains exact byte-for-byte comparison to the preview text.

## Full regression and static verification

The final application and test files match `659fff65`; documentation-only edits
followed. All commands below completed successfully unless explicitly marked
failed. The full Vitest run uses two workers to reduce resource contention; no
case, assertion or coverage setting was excluded or changed.

| Command | Result |
|---|---|
| `npm run test:coverage -- --run --maxWorkers=2` | **383 files / 5,743 tests passed**, exit 0, 386.70 seconds; Node 24.15.0 |
| `npm run test:e2e:ownership` | 35 passed |
| `npm run test:e2e:profiles` | 61 passed; Node 24.15.0 |
| `npm run test:e2e:evidence` | 107 passed |
| `npm run test:e2e:identity` | 13 passed |
| `npm run test:ctt` | 68 passed |
| `npm run test:e2e:hosted-unit` | 12 passed |
| `npm run type-check` | Exit 0 |
| `npm run lint` | Exit 0; 0 errors, 21 existing warnings |
| `AUTH_MODE=optional NEXT_PUBLIC_API_URL=http://localhost:8000 NEXT_PUBLIC_WS_URL=ws://localhost:8000 NEXT_TELEMETRY_DISABLED=1 npm run build` | Exit 0; Node 24.15.0, child process limited to two available CPUs |
| `npx playwright test --config=playwright.ui.config.ts --list` | Four cases discovered, including the new viewer case |
| `npx playwright test --config=playwright.ui.config.ts` | **3 passed / 1 failed**, exit 1; inherited page-overflow assertion described above |
| `git diff --check` | Pass |

Coverage: statements **97.93%** (12,642/12,908), branches **95.01%**
(9,258/9,744), functions **98.21%** (3,191/3,249), lines **99.1%**
(11,247/11,349). Harness results total **296 passed**, with zero skips. Except
for the profile suite, the successful harness/static runs used the shell's
Node 22.22.1; the profile, coverage, final browser and build runs used Node 24.15.0.

Earlier attempts are not acceptance evidence: the default Node 22 build lacks
native TypeScript support and the profiles initially failed 6/61 cases; switching
to the CI major version resolved them. Initial four-worker coverage attempts were
interrupted, including a run with timeouts under heavy system load. A build printed
its completion output but its process returned a termination signal, so it was
rerun with bounded CPU affinity and exited 0. The final lower-concurrency full
coverage run and final build are the accepted results above. No source fix or test
weakening was used to clear those runtime issues.

The implementation-stage `ce-simplify-code` pass used one combined reviewer
(test/fixture-only scope: zero non-test code lines, cutoff 30), covering reuse,
quality, efficiency, test value and comments. It reported no actionable findings;
no code changed. Proof tests and their helpers remain intact. Type-check, lint
and full regression results above cover that unchanged revision. The LFG finishing
code-review/publication tail did not run because implementation verification still
has the required browser failure. Controller-owned Astra/Fable reviews remain
required; this local simplification pass does not substitute for them.

## Remaining gate and controller continuation

The complete browser gate is open. The plan explicitly excludes unrelated layout
repairs, so this branch preserves the inherited overflow failure and its evidence.
The controller should arrange the bounded layout repair, rerun the full source-
preview suite without weakening its assertions, and refresh affected captures.
The mobile image must not be described as proof of a usable narrow layout.

The chief campaign Goal Capsule/cited requirements, original `ow-4` refs and live
GitHub state are unavailable in this isolated clone. The controller reconciles
those sources, completes required campaign reviews/checks and handles publication
against `dev`. If PR #73 is already merged, describe this as its evidence follow-up;
otherwise record the corrective PR's supersession. This worker added no remote,
sought no credentials and created no PR. No Damien-only decision is needed.

D12/B27 acceptance, the modal/maximize/restore and overlay remainder, compatible
API verification and hosted acceptance remain open in their existing lanes.
