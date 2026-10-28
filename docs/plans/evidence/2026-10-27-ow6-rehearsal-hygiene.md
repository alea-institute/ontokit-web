# OW-6 rehearsal and accessibility hygiene

Execution: 2026-10-28 UTC, against the 2026-10-27 [implementation plan](../2026-10-27-0933-test-ow6-rehearsal-hygiene-plan.md). This is local implementation and isolated UI evidence. **Genuine full-stack rehearsal and hosted DEV acceptance remain open.**

## Starting state and scope

The build resumed `drawdown/ow-6` at plan commit `3759ab87`, above integrated application base `43783d39`. The checkout already contained partial changes to the four planned accessibility surfaces, their tests, rehearsal spec and dependency manifests. Those files were preserved before completion. No unrelated work, remote, login or credential was added.

The chief campaign plan and named `origin/*` refs are absent from this clone. The supplied campaign rules and repository plan govern this bounded item; the controller still needs to reconcile the chief Goal Capsule and cited R-IDs. No CTT content or choices, API contract, schema, migration, service or deployment changed.

## Implemented behavior

- Search has an accessible name and returns focus to its trigger on explicit dismissal, without stealing entity-navigation focus.
- Primary label fields have associated labels distinguished by language and, where necessary, row. Comment fields also have names; the Save help button is named.
- Proposal failures announce an alert, preserve the summary and allow retry. Submit/resubmit return an explicit result through the real suggestion hook; the dialog adapter rejects failed results instead of treating a swallowed HTTP error as success. The existing API error formatter supplies plain error details. The controlled dialog restores focus to its opener through the existing Radix lifecycle.
- Review uses controlled Radix tabs with manual keyboard activation and associated panels. Focus movement alone does not request Files. Click activation, diff retry, proposal switching and stale-result protection remain covered. Review actions wrap at narrow widths.
- Language and Share button names include their visible text. Decorative language flags are hidden from assistive technology.
- Reproduced low-contrast text and actions on these routes use darker existing palette shades. This extends U2 only to failures actually found on the rehearsal path: save status/help, entity tabs, trust explanation, relationships and the editor suggestions link. No global theme or button primitive changed.
- All four original rehearsal cases and their persistence/CTT assertions remain. Additive checks exercise keyboard search, label naming, proposal dialog accessibility, manual Files activation and actual edited-label content in the diff. WCAG 2/2.1 A/AA scans run on settled `main` and open dialogs without rule exclusions. Screenshots go to private test output; raw axe node HTML is not logged by the committed helper.

## Verification

The first focused run exposed four review-tab regressions in the partial starting code. Three were click-only activation regressions; explicit trigger click handling restores those existing contracts. The fourth was a new test's incorrect assumption about Radix's tab-stop initialization; the test now enters the tab group with Tab and checks its real focus behavior. All 172 affected tests then passed.

Additional scan-driven naming regressions were observed red before repair: Save help, populated/empty comments, language values/context and Share labels. Existing test selectors were updated where accessible names changed, with all assertions retained. No test, skip gate, timeout, inventory or acceptance rule was removed or weakened.

Independent review found that the real submit/resubmit hook swallowed HTTP failures, although the dialog's mocked callback test passed. The existing editor integration cases were strengthened to require the same open dialog, retained summary and successful retry after HTTP403. They failed before the hook/adapter repair. Follow-up exact-message assertions also failed on raw JSON and now pass through `getApiErrorMessage`. All 238 tests in the five affected dialog/editor/hook/ownership suites pass, including credential-renewal and stale-session guards. Internal deferred-test types were updated to the hook's result type without dropping assertions.

| Check | Result |
|---|---|
| Focused initial surfaces | 172 tests pass; later scan-fix subset 174 tests pass |
| Language/Share and real consumer suites | 114 tests pass across 9 files; 6 new cases observed red before repair |
| Full Vitest coverage | 371 files / 5,537 tests pass, no skips or failures; 97.96% statements, 94.96% branches, 98.04% functions, 99.07% lines |
| Lint / TypeScript | Both pass; lint has 0 errors and 22 existing warnings |
| Production build | Final-source credential-free optional-mode production build passes on Node 24.13.0 |
| Ownership / diagnostics | 35 tests pass |
| Harness profiles | 60 tests pass on Node 24.13.0 |
| Exact evidence inventory / negative cases | 107 tests pass |
| Identity helpers | 13 tests pass |
| CTT / rehearsal source helpers | 23 tests pass |
| Dependency audits | Complete baseline/final full and production reports; see [audit receipt](2026-10-27-ow6-dependency-audit.md) |
| Genuine four-case rehearsal, two fresh runs | Not run: matching API checkout and permitted stack/cleanup prerequisites unavailable |
| Hosted DEV rehearsal | Not run; remains owned by `ow-1`/`ow-2` |

The first full coverage run, concurrent with a production build at default worker fanout, passed 5,527 tests and timed out two unchanged cases at their existing five-second limit. A later run exposed one remaining exact-name consumer selector after the LanguagePicker naming repair; that selector was updated and its 21 real-component tests passed. The final full run passes all 5,537 tests with two workers and unchanged time limits. This runner's Node 22.22.1 binary lacks compiled TypeScript support; both the ordinary profiles command and an explicit strip-types attempt failed six fixture-import cases. The installed Node 24.13.0 toolchain, matching CI's major, passes all 60 with no source changes.

Commands: `npm run lint`, `npm run type-check`, `npm run test:coverage -- --run --maxWorkers=2`, `npm run test:e2e:ownership`, `npm run test:e2e:profiles`, `npm run test:e2e:evidence`, `npm run test:e2e:identity`, `npm run test:ctt`. Build uses `AUTH_MODE=optional`, loopback API/WebSocket origins and `npm run build`. No local credential file was read. Next development startup appended generated instructions to `AGENTS.md`; that unrelated generated change was backed up and restored before delivery.

## Playwright visual and accessibility evidence

These screenshots render the actual application routes using **synthetic public HTTP fixtures in a local browser**, not a real API, identity provider or complete FOLIO/Catholic OS import. They establish the changed UI's rendering and interactions only. They do not replace either genuine rehearsal receipt required by U4. No production route, auth policy or API implementation was changed to capture them.

| Image | State |
|---|---|
| [Editor search and label](ow6/editor-search-label.png) | Desktop editor, explicitly named search and primary label |
| [Submit dialog](ow6/submit-dialog.png) | Desktop proposal summary and submit controls |
| [Failed submit with retained summary](ow6/submit-dialog-error.png) | Actual route/hook receives a synthetic HTTP403; plain error alert and unchanged summary remain before successful retry |
| [Mobile submit dialog](ow6/submit-dialog-mobile.png) | Dialog fits the 390px viewport |
| [Review Files](ow6/review-files.png) | Keyboard-activated Files panel with rendered proposed label |
| [Mobile review Files](ow6/review-files-mobile.png) | Wrapped review actions, all visible within the viewport |

All six images were visually inspected. The [capture fingerprints](ow6/capture-fingerprints.json) identify the exact rendered component/hook bytes and image files; each hash was checked against the final source. The isolated browser run reports one expected HTTP403 console response during deliberate failure, no unexpected console errors, no page errors and no unmatched fixture endpoints. Keyboard search open/dismiss/reopen, manual review activation, failed-submit draft retention and successful retry pass. Axe reports **zero violations** in desktop editor `main`, submit dialog, failed-submit dialog, review Summary and review Files with WCAG 2/2.1 A/AA tags and no exclusions. Dialog and review mobile geometry were checked separately; the desktop scan is not a mobile audit claim.

Unresolved manual-check items from axe: the editor's current-mode span has an ARIA label without a suitable role; two short-text contrast checks need inspection; dialog overlapping-element contrast checks are incomplete. Zero automated violations is not whole-product accessibility conformance.

The unchanged mobile editor layout remains a limitation: at 390px viewport width, document width is 896px and the selected label is offscreen. The desktop rehearsal and mobile dialog/review captures do not prove a usable mobile editor. Its multi-panel responsive layout needs a separate bounded repair; it was not hidden with an axe exclusion or represented as passing.

## Controller return conditions

1. Reconcile the missing chief campaign excerpt with this item.
2. On a permitted runner with matching API source and verified backup assurance for cleanup, run the unchanged canonical rehearsal command twice from the final source. Preserve both accepted local receipts, source fingerprints, input pins, cleanup and neighbor evidence, and inspected real-ontology captures. No live stack was allocated or cleaned here.
3. Keep hosted persona/DEV acceptance open under `ow-1`/`ow-2`; keep B13 recurring browser CI, Firefox, failure-trace policy and broader response contracts open.
4. Address the dependency audit residuals before claiming release readiness: 26 full-tree package entries remain, including one critical and 15 high; production remains 16. The Vitest patch removes three moderate entries. No findings are waived.
5. Run the campaign's Astra and Fable reviews and publication/merge gates. Local review does not establish those external gates.

These are controller/execution follow-ups, not a new Damien decision or credential request. No held migration, data rewrite, package release or outside service is included.

## Final close-out

Final-source build, lint, types, full coverage and all 238 hermetic harness tests pass. The simplification pass preserved every test and replaced duplicate-language array allocation with a short-circuit check. All screenshot source/image hashes match the delivered files. The owned local development server was stopped after its generated artifacts were backed up.

Independent local review covered correctness, adversarial behavior, repository standards, testing, maintainability and frontend races. It found the real submit/resubmit failure-propagation defect described above; the fix was independently validated, leaving no open code findings. This local review does not replace the controller's Astra/Fable gates.

Full-stack and hosted acceptance remain open despite green local checks. U4 and full-plan acceptance are not complete until the controller supplies the required genuine-run receipts. The branch is committed locally for that handoff; push, PR, merge and deployment remain controller actions.
