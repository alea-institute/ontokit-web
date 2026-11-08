# ow-10 source-status regression evidence

Date: 2026-11-08. Branch: `drawdown/ow-10`.

Local regression coverage is complete. Full-plan acceptance remains open on
the pre-existing mobile browser failure and controller-owned gates below.

The source-status coverage is implemented in `1515cdd3`, from the clean planning
head `f9aaa92102e8e439ff71a0968a883668dcda2b59`. The supplied history includes
ow-5 commit `ad170cfd`; the original `drawdown/ow-5` refs are unavailable.
[Plan](../../2026-11-08-1441-fix-ow-10-source-status-plan.md).

The reported failing “In sync” assertion does not exist in this checkout. Its
untouched settings suite passed all 11 cases. This change adds characterization
coverage; it does not claim to repair a reproduced rendering defect.

## Change and preservation

- The real settings page, existing HTTP fixture and GitHub Integration section
  helper exercise idle status with `source.ttl` and with a null source path.
- The assertion selects the unique status paragraph by its success label, then
  checks its complete normalized text with anchored expectations. The filename
  comes from the nested span; a separate source-file summary cannot satisfy it.
- Syncing, conflict and error retain their messages and error-detail assertions,
  and now explicitly reject an idle success paragraph.
- All 11 existing cases and every existing expectation line remain. Two cases
  are added. No test is deleted, disabled or weakened; no configuration,
  production file, dependency or browser test changes.

## Discrimination checks

Three temporary mutations were applied only to the rendered idle paragraph in
`app/projects/[id]/settings/page.tsx`, keeping the fixture and source summary
unchanged. Each ran the focused file with `-t 'renders the idle status'
--maxWorkers=1`.

| Mutation | Observed result |
|---|---|
| Remove the nested filename | Filename case fails: received `In sync—`; no-path case passes |
| Replace the nested filename with `wrong.ttl` | Filename case fails: received `In sync— wrong.ttl`; no-path case passes |
| Replace `In sync` with `Up to date` | Both idle cases fail to locate the status paragraph |

The other 11 tests were excluded only by that temporary name filter. The page
was restored byte-for-byte before the final unfiltered focused and full runs.
Restored page SHA-256:
`750d07c3698db162d6f72c61810b93ce725c9616c2f31c3505cbdfb7a86f6480`.

## Runtime verification

The lockfile was installed with `npm ci --ignore-scripts --no-audit --no-fund`
using the supplied dependency cache. The initial 11-case focused baseline used
the supplied Node 22.22.1. Installation warned that jsdom requires at least
22.22.2; all subsequent checks used cached Node 22.22.2 without changing the
repository's dependencies or lockfile.

Vitest was limited to two workers to bound resource contention. The initial
full run overlapped the build and later browser work: 382 files passed, one
failed; 5,742 tests passed, one failed. The failure was the existing
`IndividualDetailPanel.coverage.test.tsx` case “edits Search individuals... target
other through the real search control”, which timed out finding `New target`
at line 201. All 19 cases passed in an isolated single-worker rerun without any
test or application change. Final full and coverage runs were sequential,
without a competing build or browser process.

| Command | Final result |
|---|---|
| `npm test -- --run __tests__/app/project-settings-github.integration.test.tsx --maxWorkers=2` | 13/13 pass |
| `npm test -- --run --maxWorkers=2` | 383 files / 5,745 tests pass; no skips |
| `npm run test:coverage -- --run --maxWorkers=2` | 383 files / 5,745 tests pass; no skips; statements 97.93%, branches 95.01%, functions 98.21%, lines 99.10% |
| `npm run lint` | Pass: 0 errors, 21 existing warnings |
| `npm run type-check` | Pass |
| `AUTH_MODE=optional NEXT_PUBLIC_API_URL=http://localhost:8000 NEXT_PUBLIC_WS_URL=ws://localhost:8000 NEXT_TELEMETRY_DISABLED=1 npm run build` | Pass |
| `npm run test:e2e:ownership` | 35/35 pass |
| `npm run test:e2e:profiles` | 61/61 pass |
| `npm run test:e2e:evidence` | 107/107 pass |
| `npm run test:e2e:identity` | 13/13 pass |
| `npm run test:e2e:hosted-unit` | 12/12 pass |
| `npm run test:ctt` | 68/68 pass |
| `git diff --check` | Pass |

Harness checks used `umask 077`. Their sources are unchanged. Existing CTT
tests ran without changing namespace or quotation choices.

## Browser gate remains open

`npm run test:ui:demo-polish` ran with the installed Playwright Chromium against
an unused local port, using the repository's `ontokit-web.sh` and optional auth
mode. This is synthetic local proof, not hosted DEV acceptance.

| Route / case | Result |
|---|---|
| `/` project loading, search recovery and focus | Pass |
| `/projects/demo-polish/editor` shortcuts and focus | Fail at the mobile portion |
| `/hydration-review` draft persistence and export | Pass |
| `/hydration-review` narrow dark viewport, RTL and long IRIs | Pass |

The unchanged editor test passes the desktop dialog/shortcut/focus checks, then
sets a 390 × 844 viewport. At `ui-tests/demo-polish.spec.ts:81`, clicking the
`Keyboard shortcuts` button times out because the current mobile editor no
longer exposes that button to the anonymous fixture. The enclosing toolbar at
`app/projects/[id]/editor/page.tsx:1518` uses `contents max-md:hidden` without
valid access, inherited from mobile change `65ae751c4`. The page snapshot shows
the mobile class-tree view.
This failure was observed before the ow-10 test edit, and the production and
browser-test files are identical in the final source. It is a pre-existing
browser gate outside this item's source-status scope; the suite is **3/4, not
green**. The controller must route its repair and rerun all four cases before
claiming full-plan acceptance.

No frontend page changed, so no new screenshot is required by this repair's
conditional screenshot requirement. All six historical ow-5 screenshots were
backed up before the suite and restored byte-for-byte afterward. The dev server
was stopped, and its generated `AGENTS.md` addition was also restored.

## Review and controller handoff

Simplification: one combined review of reuse, quality, efficiency and test value
found no changes needed. The proof test was preserved. Code review: lite
correctness, test-sufficiency and plan-completeness review
found no introduced code defect or test weakening. Overall acceptance remains
open because the required browser gate failed. No local review fix remains.
The campaign's independent Astra/Fable reviews have not run in this clone.

No remote is configured. Commits are local only; no push, PR, merge, deployment,
credential discovery or external review occurred. The controller owns:

1. Reconcile the chief campaign Goal Capsule and cited rules, which are absent
   from this clone, and confirm original ow-5 provenance.
2. Resolve the pre-existing mobile-shortcuts browser failure and obtain a green
   four-case browser run. Do not weaken its focus, shortcut or layout checks.
3. Run Semgrep, Docker image checks and the campaign's Astra/Fable reviews.
   Semgrep is not installed here; the Docker daemon probe failed because Unix
   socket access is denied. Neither gate is claimed as passed.
4. Inspect the live state of #74. Publish this branch against `dev` as its
   superseding PR, or explicitly describe it as a follow-up if #74 already
   merged. This checkout's inherited #74 commit does not establish live status.

The November 3–6 expansion freeze has ended. No migration, data rewrite, package
release, new service, billing change or Damien-only decision is introduced.
Other roadmap obligations retain their existing dispositions.
