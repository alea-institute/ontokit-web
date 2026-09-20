# D06 full-stack readiness

Status: U1–U6 locally verified. Two fresh full-stack passes and current failure/recovery
proof are complete. Independent final web review and publication remain required.
[Plan](../plans/2026-09-20-1357-feat-isolated-full-stack-tests-plan.md) ·
[Contributor invocation](../../e2e/README.md)

## Source and prior proof

Canonical API checkout: `.worktrees/api-d06-pr-response`, HEAD `f5f036b9`, including
image repair `4d17d949` and the three-field PR response serializer repair. API checks
reported by the delivery owner: 3,261 tests, 90% coverage; Ruff/mypy/pyright pass.
Web U5 baseline: `48db779c`. U5 live run `34fb576c7bbe9f397b033e94d462dafe`:
21 passed, zero skipped/failed; cleanup and neighboring resources verified by the
parent. This predates the U6 mandatory inventory and durable receipt implementation.

U6 replaces the four-test count floor with all 21 mandatory file/title/project checks,
rejecting skips, flaky outcomes, retries, expected failures and runner errors. Receipts
are allowlisted, written after attempted cleanup, and record its actual outcome.
The launcher reads actual database heads after migration equality verification and
actual image IDs/references before cleanup removes run resources.

## B10 obligation-to-test map

| Obligation | Mandatory test file and assertions |
|---|---|
| Real ordinary OIDC authentication | `stack.setup.ts`; `auth-foundation.spec.ts`: owner/unrelated sessions, anonymous rejection |
| Project CRUD | `api/projects.spec.ts`: create/list/read/update/delete persist through HTTP |
| Ontology import, entity reads, source persistence | `api/ontology.spec.ts`: branch/class/property labels; immutable saved revision |
| Branch isolation and stale writes | `api/branches.spec.ts`: independent branch edits; stale revision rejects without mutation |
| PR diff and persisted merge | `api/pull-requests.spec.ts`: ordinary owner reviews and merges target content |
| Search and real worker lint | `api/search-lint.spec.ts`: revision-correct lexical search; fresh completed persisted lint runs |
| 401/403/404/422 and no mutation | `api/errors.spec.ts`: anonymous/unrelated/invalid Turtle/schema writes; absent project; invalid project create; malformed Turtle/multipart import |
| Real Chromium workflow | `browser/ontology-workflow.spec.ts`: fresh UI sign-in, import, edit, review, merge, target reload |
| Private browser state teardown | `stack.teardown.ts`: remove private browser credentials; outer launcher owns resource cleanup |
| Repeatability and lifecycle | Two fresh complete runs plus failure/signal/recovery/neighbor evidence below; pure gate regressions in `scripts/e2e/evidence.test.mjs` |

The exact 21 fixed test titles are in `scripts/e2e/evidence.mjs` and each successful
sanitized receipt. Pure receipt/gate tests inspect synthetic reports, not live behavior.
They first reproduced the previous foundation-only green acceptance and then passed
with the strengthened gate. No synthetic test is counted as live B10 acceptance.

## Final local evidence and delivery gates

| Gate | Evidence slot |
|---|---|
| Fresh complete run 1 | [`ecc14e55…`](d06-run-ecc14e55bdb8135416e568ee36e3f35a.json): 21 passed, zero skipped/failed; accepted receipt, complete cleanup and unchanged neighbors |
| Fresh complete run 2 | [`ce831e07…`](d06-run-ce831e0704737a0dc8297a2810d9bfd9.json): 21 passed; new identity/storage/build state; identical source pair and fingerprints; complete cleanup and unchanged neighbors |
| Setup failure | `b5ee508a…`: injected after dependencies; exit1; cleanup and neighbors passed |
| Workflow failure | `cfc0970c…`: real browser failure, exit1,20passed/1failed; cleanup and neighbors passed; preload race repaired as `9e559bdd` |
| SIGINT and SIGTERM | `bffb9314…`/`acb9fd3d…`: dependencies migrated, exit130, cleanup and neighbors passed |
| Hard-kill recovery | `c1c978b0…`: SIGKILL after owned Chromium observed; exact manifest recovery; zero browser/Next/Docker/runtime leftovers; neighbors unchanged |
| Missing prerequisites | Missing explicit API source: exit1 with actionable message and no new allocation |
| Web verification | Lint0errors/19existingwarnings; type-check pass;5223tests/365files pass; both fresh production builds pass |
| Independent review | Final web review pending; [API review](d06-api-review.json) complete,0actionable findings |
| Publication | Web local only; API [PR50](https://github.com/alea-institute/ontokit-api/pull/50) pushed,CI pending; no deployment |

B11 (broader auth/editor/suggestions), B12 (collaboration/WebSocket), B13
(browser CI/Firefox/schema/retention) remain unfinished. D03–D05 are already shipped;
D02 remains blocked on hosted identity authority. No DEV activation or acceptance is
claimed by this local harness. Keep all 75 backlog IDs in the roadmap.

[U6 verification](d06-u6-verification.json) records full lifecycle run IDs and source snapshots.
The final pair used API `f5f036b9`, snapshot `c5dbe6f8d0e7c91267349020b1870a589d69a9a3ca3e3e4fc608992e025d83df`, and web `9e559bdd` plus staged U6 files, snapshot `5d09b80f1e940b36058093b8c21b5e1fb05837984fcf44091cd5c953aef4668e`. Actual migration head: `i7j8k9l0m1n2`; both receipts contain exact observed image references and IDs. Later evidence-only documentation updates are outside those snapshots.
