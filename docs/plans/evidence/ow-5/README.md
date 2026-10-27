# ow-5 local UI evidence

Captured on 2026-10-27 for [the ow-5 plan](../../2026-10-26-1426-feat-ow-5-demo-polish-plan.md), branch `drawdown/ow-5`. Starting revision: `aafc6c78`. UI implementation: `053a8425`, `de532d6c`, `6a9551b9`; the evidence commit adds the browser suite and a test-query typing correction.

## Scope

These are real Chromium captures of the local Next.js pages. `ui-tests/fixtures/demo-polish.ts` supplies synthetic public project reads at the HTTP boundary and rejects unexpected API requests and mutations. The app uses its existing optional, providerless mode. Session handling, pages, QueryClient, shortcuts, IndexedDB and file download remain real. No privileged session is fabricated and no production bypass is added.

The hydration bundle comes from `__tests__/fixtures/hydrationBundle.ts`. Browser assertions verify draft/note preservation through filtering, a saved correction after reload and reopening the exact file, and an export whose schema and SHA-256 match that file. The narrow case includes Hebrew and a long synthetic IRI.

This proves local UI behavior only. It does not establish DEV, OIDC, hosted persona UAT, live API compatibility acceptance, or full-stack rehearsal completion. Those remain with their assigned lanes. The existing rehearsal harness and profile registry are unchanged.

## Verification

| Check | Result |
|---|---|
| Starting full Vitest run | 371 files: 5,520 passed, 2 timing failures under default concurrency |
| Starting failure isolation | Both unchanged files passed serially: 34/34 (`suggestion-review.integration`, `OntologyGraph.integration`) |
| U1 test-first | 6 expected failures before implementation; home and existing HTTP-listing suites then 32/32 passed |
| U2 test-first | 7 expected failures before implementation; hook/dialog/editor and unchanged suggestion-focus coverage then 232/232 passed |
| U3 test-first | 6 expected failures before implementation; separately characterized empty-exclusions prescreen counts; final hydration suites 48/48 passed |
| Integrated focused check | 311/311 passed before the final prescreen-count addition; its component suite then 24/24 passed |
| Browser suite | `npm run test:ui:demo-polish`: 4/4 passed; six real PNGs inspected |
| Final full regression | `npm run test -- --run --maxWorkers=2`: 371 files, 5,558/5,558 passed; concurrency bounded to avoid the baseline timing failures |
| Lint | `npm run lint`: 0 errors, 21 pre-existing warnings |
| Types | `npm run type-check`: passed after replacing two unsupported test-query options with anchored names |
| Production build | `AUTH_MODE=optional NEXT_PUBLIC_API_URL=http://127.0.0.1:3105 npm run build`: passed, with no configured provider |

No existing tests were deleted, weakened or skipped. Browser development iterations corrected the local hostname and two test locators to match the real controls; no application permission or security configuration was changed to make the suite pass.

## Reproduce the browser evidence

Install the lockfile dependencies and Playwright Chromium. Select an unused local port before starting the repository's server script: its noninteractive mode may terminate a process on an occupied port. Use a credential-free process with no environment files, no configured OIDC provider, and matching optional auth settings:

```sh
AUTH_MODE=optional NEXT_PUBLIC_API_URL=http://127.0.0.1:3105 PORT=3105 ./ontokit-web.sh start
DEMO_POLISH_BASE_URL=http://localhost:3105 npm run test:ui:demo-polish
PORT=3105 ./ontokit-web.sh stop
```

`localhost` matches the dev server's default allowed host. The suite is separate from `playwright.config.ts`, uses only loopback targets, and does not start or stop servers itself. The browser suite fails on unexpected API calls. Browser artifacts outside the six deliberate captures remain in ignored `test-results/demo-polish`.

## Screenshots

Desktop viewport: 1440 × 900, light theme. Narrow viewport: 390 × 844, dark theme. Reduced motion is enabled. Full-page captures may be taller than their viewport; hydration tables scroll within their own container. The Next.js development indicator is visible because these captures use the local development server.

- [Project loading](projects-loading.png)
- [Project search with no results](projects-no-results.png)
- [Editor shortcut help](editor-shortcuts.png)
- [Hydration entry with keyboard focus](hydration-entry.png)
- [Hydration review, desktop](hydration-review-desktop.png)
- [Hydration review, narrow and dark](hydration-review-narrow-dark.png)

## Controller handoff

Publication remains local-only in this clone. Before opening the PR against `dev`, the controller must reconcile the unavailable chief campaign Goal Capsule and cited R-IDs, run its Astra/Fable review gate, and honor the 2026-11-03 through 2026-11-06 expansion merge freeze. No migration, data rewrite, package release, new service, or Damien-only decision is required by this item. B34's broader work and the other drawdown items retain their existing dispositions.
