# OW-8 baseline discovery — verification receipt

**Status: local discovery and regression verification passed; controller publication pending.** This receipt
covers the [ow-8 plan](../2026-11-08-1338-fix-ow8-baseline-discovery-plan.md).
It does not establish hosted DEV acceptance.

## Starting state and scope

- Execution began on clean `drawdown/ow-8` at `9cfe4a38`, the committed plan,
  over application source `09f68ff9`.
- That history contains `5b7f94532644579ab55d0ef59cd263914a77bbd6`, whose
  subject records ow-2 / PR #72. It already carries the hosted harness, the
  Chromium exclusion repair and its actual CLI discovery regression.
- The original `drawdown/ow-2` and `origin/drawdown/ow-2` refs are absent.
  The supplied descendant was preserved. Live PR status was not checked.
- The chief campaign document and named remote rehearsal refs remain absent.
  The supplied campaign rules and explicit build-stage instruction govern this
  bounded verification; the controller must reconcile the missing authority
  excerpt and publication provenance before publication.
- No production code, configuration, dependency, test or assertion changed.
  No frontend page changed, so screenshot evidence does not apply. CTT choices,
  API contracts, infrastructure and hosted data were untouched.
- This clone has no remote. No remote, login or credential was sought.

## Discovery proof

The inherited implementation puts `browser/hosted-personas.spec.ts` into
Chromium's own ignore list in `scripts/e2e/auth-modes.mjs`.
`playwright.config.ts` preserves that list when appending the synthetic UI
exclusion. The repair was already correct; no duplicate patch was necessary.

The existing tests were used unchanged:

| Check | Fresh result |
|---|---|
| `node --test --test-name-pattern='real Playwright' scripts/e2e/auth-modes.test.mjs scripts/e2e/hosted-suggestions.test.mjs` | 2 passed; both use the installed Playwright CLI and synthetic input |
| Baseline `playwright test --config playwright.config.ts --list --reporter=json` | 26 cases: 24 Chromium cases, one setup and one teardown; 11 files; zero discovery errors |
| Baseline isolation assertions | Hosted persona and all six foreign-profile specs excluded; all listed baseline specs belong to Chromium |
| Baseline coverage and dependencies | Project API and ontology workflow cases retained; setup dependency and existing exclusions retained; synthetic UI specs excluded |
| Hosted `playwright test --config playwright.hosted.config.ts --list` | Exactly 14 cases in two files, through the existing hosted discovery assertion |

The baseline inventory was `api/branches.spec.ts`, `api/errors.spec.ts`,
`api/ontology.spec.ts`, `api/projects.spec.ts`, `api/pull-requests.spec.ts`,
`api/search-lint.spec.ts`, `auth-foundation.spec.ts`,
`browser/editor-data-integrity.spec.ts`, `browser/ontology-workflow.spec.ts`,
`stack.setup.ts` and `stack.teardown.ts`, all relative to `e2e/`.
Discovery loads configuration and specs but executes no browser journey.

## Regression checks

Installed package versions: Playwright 1.63.0, Vitest 4.1.12, TypeScript 6.0.3
and Next.js 16.3.1. Initial commands used Node 22.22.1 / npm 9.2.0. The
profile rerun, coverage and production build use the available Node 24.13.0 /
npm 11.6.2, matching CI's Node 24 major.

| Command | Result |
|---|---|
| `npm run test:e2e:profiles` under Node 24 | 61 passed |
| `npm run test:e2e:hosted-unit` | 12 passed |
| `npm run test:e2e:ownership` | 35 passed |
| `npm run test:e2e:evidence` | 107 passed |
| `npm run test:e2e:identity` | 13 passed |
| `npm run test:ctt` | 68 passed |
| `npm test -- --run --maxWorkers=2` | 383 files / 5,743 tests passed |
| `npm run test:coverage -- --run --maxWorkers=2 --reporter=junit` with a temporary JUnit output file | 383 files / 5,743 tests passed; no failures, errors or skips |
| `npm run lint` | Passed: 0 errors, 21 existing warnings |
| `npm run type-check` | Passed |
| `npm run build` | Passed with `AUTH_MODE=optional`, loopback API/WebSocket URLs and telemetry disabled |

The first profile run under the shell's Node 22 failed six checks with
`ERR_UNKNOWN_FILE_EXTENSION` when importing existing TypeScript fixtures.
The unchanged suite passed under the installed CI-compatible Node 24.
This reproduces the toolchain limitation documented in the
[ow-2 receipt](2026-10-26-ow-2-hosted-uat.md); no dependency or test change
was used to conceal it.

Lint warnings predate this work. The successful build also reported two
existing Turbopack warnings about broad filesystem tracing in `lib/sitemap.ts`.
The two-worker limit changes concurrency only; no test selection or assertions
were reduced.

Coverage: statements 97.93% (12,642/12,908), branches 95.01% (9,258/9,744),
functions 98.21% (3,191/3,249), lines 99.1% (11,247/11,349).
All six harness suites passed, totaling 296 tests. These results cover the
unchanged executable source at `9cfe4a38`; the follow-up changes only this
receipt and the roadmap.

## Local review and browser scope

`ce-code-review` reviewed `78886803` against build-stage base `9cfe4a38`:
no actionable findings. The lite review ran inline, checking correctness,
the explicit plan, `AGENTS.md`, captured test results, links and artifact
safety. No independent reviewer or external peer ran in this sandbox;
campaign Astra/Fable reviews remain separate controller gates.

Simplification was skipped because the diff contains only documentation.
The plan and existing discovery regression already preserve the ignore-list
lesson, so no separate learning artifact was added. `ce-test-browser` scope
mapping found no changed product routes: zero pages exercised and no
screenshot required. The Playwright CLI discovery above is the relevant
runtime proof for this item.

## Remaining controller work

1. Reconcile the chief Goal Capsule and cited campaign rules with this receipt.
2. Verify PR #72's live disposition and original ow-2 provenance. Local history
   already records #72 and its repair; describe the new PR as the ow-8
   verification follow-up and link supersession only as appropriate to the
   actual PR state. Target `dev` and preserve the inherited work.
3. Run required CI, Semgrep and campaign Astra/Fable reviews on the candidate.
   Semgrep is not installed here. Docker/socket checks and hosted browser
   journeys were not run in this socket-restricted sandbox.
4. Keep genuine D08–D10 hosted UAT open under ow-2. Synthetic discovery is not
   proof of DEV sign-in, suggestion submission or review.

No migration, data rewrite, release, new service or Damien decision is needed
for this discovery repair. Publication and campaign-gate approval remain with
the controller.
