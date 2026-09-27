# D09 authentication mode matrix readiness

Status: **Locally verified; merged through [Web PR57](https://github.com/alea-institute/ontokit-web/pull/57) as `9df6bea9` and [API PR56](https://github.com/alea-institute/ontokit-api/pull/56) as `35e5bf8f`, and deployed to DEV (EU) on 2026-09-27. Runtime matches checkout for api, worker and web (no revision drift). Hosted acceptance of disabled or optional-anonymous modes is not claimed.**
Each new profile passed twice; baseline and lifecycle also passed. Every run completed
cleanup, and neighboring Docker containers, networks and volumes were unchanged.
[Plan](../plans/2026-09-25-2130-test-auth-mode-matrix-plan.md)

This receipt records **local verification plus DEV deployment of a non-disabled
configuration**. DEV runs `AUTH_MODE=optional` with the Zitadel provider. B02/B03 hosted
persona acceptance and B13 recurring CI enforcement remain separate gates.

## Source

| Item | Value |
|---|---|
| Web HEAD at local acceptance | `3746c9680e6209c664aec052d3ed183436bd8997` (branch HEAD before squash) |
| API HEAD at local acceptance | `be120c405625696207a3dfcacf28416f4182f888` (API PR56 rebased on the SQLAlchemy fix) |
| Local acceptance conditions | 2026-09-27; clean tree; standard umask |
| Merged / deployed pair | Web `9df6bea9` / API `35e5bf8f` |
| API startup prerequisite | [API PR57](https://github.com/alea-institute/ontokit-api/pull/57), merged into API dev as `09a3e147` |

## Product decision and trust boundary

Damien's 2026-09-27 answer to Cockpit ask
`ontokit-web-2026-09-26-0221-d09-disabled-mode-meaning`, qid `disabled-mode-meaning`,
is **“Read and suggest only.”** It replaces the provisional single-user workspace
choice. The plan's “Decision update — 2026-09-27” re-scopes R9, U4 and U5 case 10.

Anonymous visitors can browse public projects and submit anonymous proposals; the
API refuses direct writes from the anonymous identity. Projects created by that
identity while the provisional workspace existed remain browsable but are no longer
editable in disabled mode. The web never writes without a bearer in disabled mode,
and anonymous roles never grant edit or manage rights, including on the settings page.

In disabled mode, `RequiredUser` and `RequiredUserWithToken` refuse the anonymous
identity with 403 for any method other than GET/HEAD/OPTIONS. The dependency fails
closed before body validation. Normalization refresh is refused too; an exhaustive
mounted-write inventory test retains a reasoned allowlist.

## Profile inventories

D09 adds `optional-configured`, `optional-anonymous` and `disabled`, with a web/API
mode-agreement gate, per-profile service sets and version 3 receipts. U3 repairs
provider-less sign-in affordances and adds a sign-in inventory test.

| Profile | Local acceptance |
|---|---|
| Optional configured | 5/5 twice |
| Optional anonymous | 2/2 twice |
| Disabled | 3/3 twice |
| Baseline | 21/21 |
| Lifecycle | 4/4 |

## Accepted runs

The following sanitized receipts are committed alongside this receipt. Every run
completed cleanup; neighboring Docker containers, networks and volumes were unchanged
before versus after the acceptance batch.

| Gate | Evidence |
|---|---|
| Optional configured run 1 | `5f340bdb58cd3534eda458b1420946e3`, [`d09-run-5f340bdb…`](d09-run-5f340bdb58cd3534eda458b1420946e3.json): 5/5; cleanup complete |
| Optional configured run 2 | `a893d14b9a0e1af6159c42c110d78a80`, [`d09-run-a893d14b…`](d09-run-a893d14b9a0e1af6159c42c110d78a80.json): 5/5; cleanup complete |
| Optional anonymous run 1 | `d783dec74ed836136d3cb118eb34fcd4`, [`d09-run-d783dec7…`](d09-run-d783dec74ed836136d3cb118eb34fcd4.json): 2/2; cleanup complete |
| Optional anonymous run 2 | `6c8a3433e5abf4da6a76e19e36f8dcb8`, [`d09-run-6c8a3433…`](d09-run-6c8a3433e5abf4da6a76e19e36f8dcb8.json): 2/2; cleanup complete |
| Disabled run 1 | `2f40e1efb278611bb958890898e28e3b`, [`d09-run-2f40e1ef…`](d09-run-2f40e1efb278611bb958890898e28e3b.json): 3/3; cleanup complete |
| Disabled run 2 | `fe54de0a0cb3db6236ac7d2ec6c0efd6`, [`d09-run-fe54de0a…`](d09-run-fe54de0a0cb3db6236ac7d2ec6c0efd6.json): 3/3; cleanup complete |
| Baseline | `10aac74a4688e2f051d10800a3630809`, [`d09-run-10aac74a…`](d09-run-10aac74a4688e2f051d10800a3630809.json): 21/21; cleanup complete |
| Lifecycle | `7f65e3fdb30a45c87d0612558367b301`, [`d09-run-7f65e3fd…`](d09-run-7f65e3fdb30a45c87d0612558367b301.json): 4/4; cleanup complete |

Disabled case 10 records `project-create-disabled`, `project-import-disabled` and
`source-save-disabled` as API-tier 403 without Authorization. The spec also asserts
the gate's own 403 detail and that source content and revision are unchanged.

## Failure and recovery

The first acceptance batch failed during `migrating`: SQLAlchemy 2.1.1 made greenlet
an optional `asyncio` extra, and the API Dockerfile installs with `pip install .`
instead of `uv.lock`, so fresh images crashed at startup with “No module named greenlet”.
[API PR57](https://github.com/alea-institute/ontokit-api/pull/57) fixes the dependency
as `sqlalchemy[asyncio]>=2.0.52,<2.1`. The accepted rerun above uses the fixed API.

Each web-mode-mismatch probe stopped at `checking-auth-mode`, ran no browser cases
and completed cleanup.

| Probe | Evidence |
|---|---|
| Optional configured web-mode mismatch | `1a6b353b0c3d6fdece69fe778564c993`, [receipt](d09-run-1a6b353b0c3d6fdece69fe778564c993.json) |
| Optional anonymous web-mode mismatch | `870b94f0ffbd50ed7e6bffd600c2fc4f`, [receipt](d09-run-870b94f0ffbd50ed7e6bffd600c2fc4f.json) |
| Disabled web-mode mismatch | `e1f1947e6db0dc80b80e7160a231271f`, [receipt](d09-run-e1f1947e6db0dc80b80e7160a231271f.json) |

## Requirement evidence map

| Requirement | Evidence |
|---|---|
| B11 auth-mode matrix | Three new profiles accepted twice, baseline and lifecycle accepted; web/API agreement probes; per-profile service sets and receipts v3; provider-less sign-in repairs and inventory test |
| B14 auth-disabled routing seam | Revised R9/U4/U5 case 10; API anonymous-write dependency gate, normalization refresh refusal and mounted-write inventory; web bearer and anonymous-role guards, including settings |

## Local verification gates

| Gate | Result |
|---|---|
| Web `npx vitest run` | 367 files / 5,382 tests passed, also under coverage |
| Web type-check / lint | Passed |
| Harness evidence / profiles / ownership / identity suites | Passed |
| API full pytest | Passed (3,633 on the first commit) |
| API ruff / mypy | Passed; mypy used a 3.13 proxy |
| API independent review | ce-code-review full depth plus independent Codex cross-model pass (independence verified); run `20260927-143304-799ee7d3`: Ready with fixes; finding #1, normalization refresh bypassing the gate, fixed |
| Web independent review | ce-code-review full depth plus independent Codex cross-model pass (independence verified); run `20260927-144703-4dc1b74a`: Ready with fixes; #2, settings manager rights from role alone, and #3, source-save probe not discriminating the gate, fixed. Earlier D09 rounds are in Web PR57's history |
| Publication | [Web PR57](https://github.com/alea-institute/ontokit-web/pull/57), merged `9df6bea9`; [API PR56](https://github.com/alea-institute/ontokit-api/pull/56), merged `35e5bf8f` |

## DEV deployment

API `35e5bf8f` and web `9df6bea9` deployed to DEV (EU) on 2026-09-27. Status reports
runtime = checkout for api, worker and web. DEV uses optional mode with Zitadel.

| Smoke check | Result |
|---|---|
| Web | 200 |
| Anonymous project list | 200 |
| Anonymous project create | 401 |
| Providers list | Contains `zitadel` |

DEV currently lists zero public projects. This is data state; the read path is unchanged.
These checks do not establish hosted acceptance of disabled or optional-anonymous modes,
or recurring CI enforcement.

## Carried forward (not delivered by D09)

B11's suggestion submit/review chain and multi-tab refresh locking remain open.
B02/B03 hosted persona acceptance, B12 WebSocket lifecycle and B13 recurring CI
enforcement of these profiles remain open. A runtime warning when disabled mode binds
a non-loopback address is a possible follow-up. Remaining B14 seams are
namespace/untyped policy, historical branches, review/self-merge and deployment drift.

- [Web #54](https://github.com/alea-institute/ontokit-web/issues/54): flaky editor-actions waitFor test; also flaked once in CI and once locally during D09.
- [Web #56](https://github.com/alea-institute/ontokit-web/issues/56): class delete targets a DELETE route the API does not serve.
- [Web #58](https://github.com/alea-institute/ontokit-web/issues/58): harness diagnostics test depends on process umask.
- [API #55](https://github.com/alea-institute/ontokit-api/issues/55): legacy unauthenticated `/ontologies`, `/classes` and `/properties` routers.
- Follow-up idea: build API images from `uv.lock`.
