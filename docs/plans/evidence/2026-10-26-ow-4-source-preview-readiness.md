# Ow-4 entity source preview — build receipt

Scope: local verification of D12, the read-only B27 preview. Hosted DEV acceptance belongs to the other drawdown lanes.

## Starting state and plan intake

- Clean `drawdown/ow-4` at `50b27b3d`; no remote. Application source matches the inspected `43783d39` baseline; intervening changes are planning documents only.
- `ce-plan` resume/confidence check: the existing implementation plan remains sufficient. `ce-doc-review` reused the complete five-lens evidence in `2026-10-26-ow-4-plan-review.json`: its plan SHA-256 still matches and relevant source is unchanged. No findings or settled-decision conflicts.
- The chief campaign plan and remote rehearsal refs are absent. The controller-provided campaign rules apply; no credentials or remotes were sought.
- U1: all twelve area dispositions and eleven Phase17 requirements remain in the plan; B01–B75 remain exactly once in the roadmap ledger. A03 resumes after verified API contracts. B27 modal/maximize/restore and overlay synchronization remain open.

## Delivered behavior

Developer Tree mode now offers `Detail | Entity source` in the right pane. It follows class, property and individual selection, shows exact direct-subject Turtle statements with one-based file/line comments, copies those snippets and opens the existing full-source editor. Detail remains mounted and inert while hidden, preserving unsaved fields. Source readiness distinguishes successful empty files from pending loads and follows the effective project, branch and ontology file, including anonymous proposals.

The implementation adds no write endpoint, serializer, migration, service, release or paid operation. B27 remains partial: modal/maximize/restore and overlay synchronization are outside this slice. B25's final cross-mode workspace remains open.

## Review and corrections

`lfg` reused the reviewed plan, implemented the bounded slice, ran five simplification lenses, then a full eight-lens code review and independent validation. Review run `ow4-20261026` initially returned **Ready with fixes**, with five confirmed P2 findings and no P0/P1 findings. Cross-model review is disabled in this checkout's configuration; local adversarial review ran. The campaign's Astra/Fable reviews remain controller-owned.

| Finding | Required correction | Regression evidence before correction |
|---|---|---|
| 1: merged Turtle boundaries | Reject unsupported lexical forms before attributing an excerpt; shared writers stay unchanged | Two exact-source fixtures incorrectly included a second subject |
| 2: revisiting a branch | Reset hover/demand request markers on each scope transition, including hidden preview | A→B→A with a silent failed preload made only one foreground request |
| 3: read-only viewer metadata | Pass known filename, scope and successful-load readiness through the viewer caller | Real viewer route copied a generic filename and remained loading for an empty file |
| 4: repeated full-file scans | Build a source-keyed index once with yielded work, then look up selected IRIs | Independent synthetic Node measurements: 48–68 ms per selection at 7.86 MB; 85–112 ms at 17.75 MB, 18,327 entities |
| 5: stale navigation index | Scope index state and async completions to the same source epoch | Proposal→base transition retained the proposal's entity line position |

All five findings were corrected in `9815250e`; the [review receipt](2026-10-26-ow-4-build-review.json) preserves the validation and resolution. A narrow read-only follow-up found no remaining defect in the corrected scope. The metadata repair is a mechanical completion of the explicit caller contract, independently reproduced by route tests and the validator; it changes no permission or public API. The functional pre-fix run had four intended failures and 72 passes across extractor, layout and hook tests; the caller run had two failures and 29 passes. A narrow follow-up review found compact numeric/boolean boundaries; new numeric cases first failed, then passed after the guard was tightened, alongside positive ordinary-literal fixtures. No existing test or behavioral assertion was removed. The new caller metadata tests now pass with the real page/hooks/providers and mocked HTTP/browser boundaries.

## Indexing measurement

The revised helper retains `iterateStatements` and shared writer semantics. A preview-only lexical guard rejects ambiguous boundaries; a source-keyed offset index is built in yielded chunks and reused for subsequent selections. Abort and source-identity checks discard stale results. A synthetic Node v22.22.1 run with **18,327 subjects / 7,858,426 bytes** built the index in **446.174 ms across 239 scheduled yields**, with a **6.880 ms** maximum observed continuation. Five lookups took **0.002–0.078 ms**; 10,000 lookups took **4.974 ms**. This is synthetic Node evidence, not FOLIO or browser acceptance. An exceptionally long individual statement still uses the shared iterator's synchronous boundary scan.

## Verification

Final application source: `9815250e` on `drawdown/ow-4`. Node v22.22.1, installed lockfile dependencies. No existing test, assertion or timeout was removed or weakened.

| Check | Actual result |
|---|---|
| `npm run test -- --run --maxWorkers=4` | **373 files / 5,589 tests passed**, 342.34 seconds |
| Extractor and preview focused tests | **53 passed**, including exact text, declarations, lexical boundaries, reuse, abort and stale completion |
| Source hook unit/integration tests | **48 passed**, including proposal→base and stale yielded-build completion |
| Layout and real viewer route integration tests | **43 passed**, including draft preservation, retry, copied filename and successful empty source |
| `npm run type-check` | Passed after correcting the Playwright project-union property guard |
| `npm run lint` | **0 errors / 21 existing warnings**; final helper/preview/test and Playwright-config checks also passed |
| `AUTH_MODE=disabled NEXT_PUBLIC_API_URL=http://127.0.0.1:38471 npm run build` | Passed; production compilation and all route generation completed |
| `npx playwright test --config=playwright.ui.config.ts --list` | One test discovered; this is not browser acceptance |
| `git diff --check`; roadmap ledger audit | Passed; B01–B75 retained exactly once, in order |

Before corrections, the full suite passed 5,556 tests. A later run overlapped newly added red fixtures; the next stable-file run had 5,587 passes and two UI wait timeouts (one in untouched normalization tests). The final four-worker run passed all tests without changing assertions or timeouts. Expected failure-path stderr from release-script tests is not a failed test result.

## Browser and hosted acceptance gate

`OW4_UI_CHROME=1 npx playwright test --config=playwright.ui.config.ts` started the actual app and reached Chrome, then failed at browser startup with `socket() failed: Permission denied (13)`. See [the sanitized attempt receipt](2026-10-26-ow-4-browser-attempt.txt). **No screenshot was captured.** This attempt preceded `9815250e` and stopped before any page assertion; the final UI has not run in a real browser here. The manager wrapper stopped its owned server. The sandbox restriction was not bypassed.

The committed scenario in `e2e/ui/entity-source-preview.spec.ts` is ready for an authorized browser runner. It uses synthetic API/session fixtures, real page/layout/Monaco surfaces and local installed Monaco assets. It covers class/property/individual selection, keyboard tabs, copy, Source→Tree buffer capture, narrow layout, dark mode and existing mode entry points. Its assertions have not executed in this sandbox; discovery is not acceptance.

Controller rerun:

```bash
npx playwright test --config=playwright.ui.config.ts
# For a runner with system Chrome instead of bundled Chromium:
OW4_UI_CHROME=1 npx playwright test --config=playwright.ui.config.ts
```

Expected screenshot destinations (not yet present):

- `docs/plans/evidence/2026-10-26-ow-4-entity-source-preview.png`
- `docs/plans/evidence/2026-10-26-ow-4-entity-source-preview-dark.png`

Inspect the images and complete the scenario before committing them as evidence. This closes presentation proof only. No paired API checkout or hosted login was available; full-stack source/suggestion regressions need the controller's compatible API runtime and provenance. Hosted BAIF rehearsal and persona acceptance remain with `ow-1` and `ow-2`.

## Delivery and next action

Local-only branch `drawdown/ow-4`; source corrections are committed in `9815250e`. Generated pre-compaction handoff files were restored to their intake absence after verifying their committed backup; repository instructions match intake. No remote added, no GitHub login sought, no push/PR/merge/deploy attempted. The controller scans, publishes to `dev`, and supplies the browser/full-stack and campaign review gates. No Damien-only decision or held schema/service change is required.

Do not mark D12 fully accepted until the screenshot/runtime gate closes. Then resume A03 only with verified API contracts; retain B24–B27's named remainders and all B01–B75 ledger entries.
