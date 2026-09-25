# D06 full-stack readiness

Status: U1–U6 locally verified; full review and both recovery repairs are complete.
Two final fresh full-stack passes and current failure/recovery proof are complete.
Web PR49 merged into dev as `83eaf957` after all eight verification checks passed; three conditional jobs skipped. No deployment occurred.
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
| Fresh complete run 1 | [`86bbc69d…`](d06-run-86bbc69dea452ba371f10cbe4a27e684.json): 21 passed, zero skipped/failed; accepted receipt, complete cleanup and unchanged neighbors |
| Fresh complete run 2 | [`a1b6d164…`](d06-run-a1b6d164d289a2e630b5be6ebc565baa.json): 21 passed; new identity/storage/build state; identical source pair and fingerprints; complete cleanup and unchanged neighbors |
| Setup failure | `b5d71420…`: injected after dependencies; exit1; cleanup and neighbors passed |
| Workflow failure | `76e0dce7…`: injected after 21 passing workflow checks, exit1/acceptedRun=false; private publication, cleanup and neighbors passed; earlier real preload failure repaired as `9e559bdd` |
| SIGINT and SIGTERM | `550d29dc…`/`e78a89c0…`: dependencies migrated, exit130, cleanup and neighbors passed |
| Hard-kill recovery | `87b576c6…`: SIGKILL after owned Chromium observed; exact manifest recovery; zero browser/Next/Docker/runtime leftovers; neighbors unchanged |
| Missing prerequisites | Missing explicit API source: exit1 with actionable message and no new allocation |
| Web verification | Lint: 0 errors / 19 existing warnings; type-check pass; 5,223 tests / 365 files pass; both fresh production builds pass |
| Independent review | [Full web review](d06-web-review.json) completed; two P2 findings repaired in `59004edd` and [closure verified](d06-recovery-fix-closure.json); [API review](d06-api-review.json) complete |
| Publication | Web [PR49](https://github.com/alea-institute/ontokit-web/pull/49) merged as `83eaf957`; API [PR50](https://github.com/alea-institute/ontokit-api/pull/50) merged as `d9272cc8`, six verification checks passed; no deployment |

B11 (broader auth/editor/suggestions), B12 (collaboration/WebSocket), B13
(browser CI/Firefox/schema/retention) remain unfinished. D03–D05 are already shipped;
D02 remains blocked on hosted identity authority. No DEV activation or acceptance is
claimed by this local harness. Keep all 75 backlog IDs in the roadmap.

[U6 verification](d06-u6-verification.json) records full lifecycle run IDs and source snapshots.
The pre-review pair used API `f5f036b9`, snapshot `c5dbe6f8d0e7c91267349020b1870a589d69a9a3ca3e3e4fc608992e025d83df`, and web `9e559bdd` plus staged U6 files, snapshot `5d09b80f1e940b36058093b8c21b5e1fb05837984fcf44091cd5c953aef4668e`. Actual migration head: `i7j8k9l0m1n2`; both receipts contain exact observed image references and IDs. Later evidence-only documentation updates are outside those snapshots.

The final post-repair pair used API `f5f036b9`, snapshot `c5dbe6f8d0e7c91267349020b1870a589d69a9a3ca3e3e4fc608992e025d83df`, and web `59004edd` plus the reviewed inspect consolidation and staged evidence, snapshot `959610352e217462173357559b874448d14276cb62f4dc327f6f7902bc749bd4`. Both runs accepted all 21 mandatory tests with complete cleanup and unchanged neighbors. Final evidence-only documentation updates follow those snapshots.

[Recovery verification](d06-recovery-repair.json) records 34 focused tests, 5,223 unit tests, lint/type-check, real obsolete-PID Docker cleanup and current interruption probes. [Browser verification](d06-browser-verification.md) distinguishes host Browser entry-page checks from the fully authenticated authored workflow. The original review remains intact; both findings were resolved through bounded U1 work and same-reviewer closure, without relabeling confidence or corroboration.

The final CI repair `15d19eda` replaces the browser URL assertion's dynamic regex with literal project-path matching and a fixed numeric suffix. [Repair evidence](d06-ci-regexp-repair.json) records nine boundary checks and two further fresh full-stack passes (`958b9538…`, `b0892d17…`), each 21 passed with identical source fingerprints, complete cleanup and preserved neighbors. This pair supersedes the pre-CI pair for final source acceptance. [Merged evidence](d06-merged-readiness.json) records the publication outcome.
