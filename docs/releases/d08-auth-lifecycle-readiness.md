# D08 required authentication lifecycle readiness

Status: **Locally verified; merged through [PR #53](https://github.com/alea-institute/ontokit-web/pull/53) as `cc64c02bed8394a0d4c511648055abe766c77dd3` and deployed to DEV (web `cc64c02b`, API `13ad2f35`, no revision drift) on 2026-09-25. Hosted persona acceptance is not claimed.**
Two fresh baseline runs and two fresh lifecycle runs were accepted from identical source
fingerprints. Failure, interruption and hard-kill recovery probes ran with the instrumented
Next process running. Neighboring Docker resources were unchanged.
[Plan](../plans/2026-09-21-0727-test-required-auth-lifecycle-plan.md) ·
[Plan review](../audits/2026-09-21-d08-auth-lifecycle-plan-review.md) ·
[Research](../audits/2026-09-21-d08-auth-lifecycle-research.md) ·
[Contributor invocation](../../e2e/README.md) ·
[Harness maintainer guide](../../scripts/e2e/README.md)

This receipt records **local verification only**. Hosted acceptance (B02/B03 personas
on DEV) is a separate gate, and nothing here claims it (R8).

## Source

| Item | Value |
|---|---|
| Web branch / HEAD | `test/d08-auth-lifecycle-20260920` / `93ea222d31324ac47bc1d7e96fb5a20e4b0aadec` |
| API checkout / HEAD | Isolated D08 API source worktree / `a2d483624e472883151c01ea2d4862a5860ed31b`, a descendant of D07 `13ad2f35d55196274c5fec313bfb254a7cc80226` |
| Copied-byte fingerprints | web `325f3b7abab34938993fb349f3e5458e7ff388a41881369165e1121394b63153` / api `1078ada9dc380989741f8c928dc1e42dad7ba754cac40f05ddead873ee10651f`; identical across all four accepted runs and every probe below |
| Package / browser versions | Next 16.3.1, next-auth 5.0.0-beta.32, @auth/core 0.41.3, @playwright/test 1.63.0, Chromium 153.0.8010.12 (Playwright revision 1243), all from the copied lockfile |
| Pinned service images | postgres `pgvector/pgvector@sha256:7ae6051efd0e60444282c27c7e141af07f322ce033300e727a49c3dd11075e38`; redis `redis@sha256:e7723ff73d963f5cc6d9c4643ea3d989527a402a319239054e9472a7fb9219a2`; minio `minio/minio@sha256:14cea493d9a34af32f524e538b8346cf79f3321eff8e708c1e2960462bd8936e`; zitadel `ghcr.io/zitadel/zitadel@sha256:f3738fd984131d3f02e386d37fa480d1a30e42b7d4202e2b322f12f7cf556b64`; login `ghcr.io/zitadel/zitadel-login@sha256:7c210b79ae78ae74d76092154fa664601852ce79675a747a1085c2656b195648`. API/worker/migrate share one image built fresh per run from the fingerprinted API source, so its image ID differs per run (recorded in each receipt) |
| Migration head | `i7j8k9l0m1n2` in every run that migrated |

## Profile inventories (R6)

Both profiles run on separate fresh stacks (KTD1), and each has a fixed inventory in
`scripts/e2e/evidence.mjs`. Neither profile's receipt can satisfy the other.

- **Baseline:** the unchanged 21 D06 mandatory tests (`REQUIRED_TESTS`).
- **Lifecycle:** exactly four tests in `browser/auth-lifecycle.spec.ts`, project `lifecycle`:

| Requirement | Test | Proof kind | Evidence case labels |
|---|---|---|---|
| R1 | UI sign-out ends the application and provider sessions and the next sign-in requires provider interaction | `real` | `r1-logout-observed`, `r1-logout` |
| R2 | real elapsed access-token expiry renews through the provider on reload without interactive login | `real-elapsed` provider expiry | `r2-renewal` |
| R3 | real elapsed refresh-token idle expiry reauthenticates through SessionGuard back to the original URL | `real-elapsed` provider expiry | `r3-refresh-recovery` |
| R4 | controlled Next clock expires the genuine application cookie and explicit sign-in recovers at normal time | `controlled-next-process` application expiry | `r4-cookie-expiry` |

## Accepted runs

Each accepted receipt shows `acceptedRun: true`, `cleanup: "complete"`, the expected
`profile`, and `acceptance: {scope: "local-verification", hostedAcceptance: false}`.
Only sanitized receipts are copied here, never raw Playwright JSON, logs, sessions or
credentials. Before copying, every receipt was pattern-checked (counts only) for home
paths, `/tmp` paths, email addresses, passwords, secrets, JWT prefixes, bearer or
authorization values and opaque token-like strings; all counts were zero. Remaining
keyword matches are allowlisted evidence field names and test titles.

| Gate | Evidence |
|---|---|
| Baseline fresh run 1 | `b526dc204864ef7a2d858191ed1045f1`, [`d08-run-b526dc20…`](d08-run-b526dc204864ef7a2d858191ed1045f1.json): 21 passed, 0 skipped/failed/flaky; cleanup complete; neighbors unchanged |
| Baseline fresh run 2 | `f8773accd22d54abc10b2a3f4cf3f08d`, [`d08-run-f8773acc…`](d08-run-f8773accd22d54abc10b2a3f4cf3f08d.json): 21 passed, 0 skipped/failed/flaky; same fingerprints; cleanup complete; neighbors unchanged |
| Lifecycle fresh run 1 | `96ea4745e00da54fc23d85ce5c3ee285`, [`d08-run-96ea4745…`](d08-run-96ea4745e00da54fc23d85ce5c3ee285.json): 4 passed, 0 skipped/failed/flaky; `tests.clockControlledCases` = [R4]; `tests.realElapsedCases` = [R2, R3]; cleanup complete; neighbors unchanged |
| Lifecycle fresh run 2 | `96f4e3d63e703c122fff0988d51f07f2`, [`d08-run-96f4e3d6…`](d08-run-96f4e3d63e703c122fff0988d51f07f2.json): 4 passed; same case split; same fingerprints; cleanup complete; neighbors unchanged |

### Lifecycle receipt fields (per lifecycle run)

| Field | Run 1 (`96ea4745`) | Run 2 (`96f4e3d6`) |
|---|---|---|
| `lifecycle.lifetimes` (access / id / refresh idle / refresh absolute, s) | 60 / 60 / 180 / 360 | 60 / 60 / 180 / 360 |
| `lifecycle.graceSeconds` | 20 | 20 |
| `lifecycle.observedAccessTokenLifetimeSeconds` | 60 | 60 |
| `lifecycle.preflight.verifierToleranceSeconds` / `marginMs` | 15 / 5000 | 15 / 5000 |
| `lifecycle.preflight.workerShiftErrorMs` / `serviceClockSkewMs` | 11 / 713 | 11 / 713 |
| `lifecycle.preflight.beforeAccepted` / `afterRejected` / `cookiesCleared` / `restored` | true / true / true / true | true / true / true / true |
| R2 `renewedAfterExpirySeconds` (≤ grace) | 5 (grace 20; credential changed, same subject, no interactive login) | 5 (same) |
| R3 `waitedAfterIssueSeconds`, `providerSsoReused` | 200 (idle 180 + grace 20), true | 200, true |
| R4 `workerShiftErrorMs`, `toleranceWindowExercised`, `refreshErrorBeforeBoundary` | 7, true, false | 8, true, false |
| R1 `providerSessionChooser`, `postLogoutRedirected`, `nextLoginInteractive` | false, true, true (`endSessionClientId` and `endSessionIdTokenHint` true) | false, true, true (same) |

## Failure and recovery (instrumented Next process running)

All probes used `--profile lifecycle` from the same source pair. `--lifecycle-probe`
rejects this profile, so every probe ran the full lifecycle launcher. After each probe
the check found zero `io.ontokit.e2e.run`-labelled containers, networks, volumes and
images, no `ontokit-e2e` containers, an empty `/tmp/ontokit-e2e-<uid>` runtime root
(so the run's private clock control was gone), no processes carrying the run marker
(owned Next, Playwright and Chromium stopped), and no leftover recovery manifest.

| Probe | Evidence |
|---|---|
| Setup failure (`--fail-at after-dependencies`) | `dd6094d7ba5d7c74019aa35d4f6fa1ad`, [receipt](d08-run-dd6094d7ba5d7c74019aa35d4f6fa1ad.json): exit 1, failed during `starting-dependencies`; this point precedes Next, so no clock control existed; cleanup complete, zero leftovers |
| Clock preflight failure (`--fail-at clock-preflight`) | `3a81d2abd6df2b8f1cc010ef9fc43bc4`, [receipt](d08-run-3a81d2abd6df2b8f1cc010ef9fc43bc4.json): setup failure with the instrumented Next running; exit 1, clock restored, owned Next stopped, cleanup complete |
| Late workflow failure (`--fail-at after-workflow`) | `0241353789a6a1c7b5bfcd7696aa6978`, [receipt](d08-run-0241353789a6a1c7b5bfcd7696aa6978.json): all 4 lifecycle tests passed first, Next still running at the injected failure; exit 1, `workflowPassed: false`, `acceptedRun: false`, cleanup complete |
| SIGINT | `ade4f6a515ab9f27a2955074974dbd8f`, [receipt](d08-run-ade4f6a515ab9f27a2955074974dbd8f.json): sent 20 s into `testing-lifecycle` (clock offset 0, one owned `next-server` and Chromium observed); exit 130, cleanup complete. An earlier SIGINT at the same point, `1d0bf079af81466b6947d689e4b21ae9` ([receipt](d08-run-1d0bf079af81466b6947d689e4b21ae9.json)), also exited 130 with cleanup complete; it was repeated only because its process check did not match Next's retitled `next-server` process |
| SIGTERM (clock shifted) | `25e6277318c9c6b35a6cf79a97f5737c`, [receipt](d08-run-25e6277318c9c6b35a6cf79a97f5737c.json): sent during R4 while the Next clock control held +2,592,009,445 ms (about 30 days); exit 130, owned Next stopped and control removed with the runtime directory, cleanup complete |
| SIGTERM (after workflow) | `cf0ac77906262ae77e786b7479eab5d4`, [receipt](d08-run-cf0ac77906262ae77e786b7479eab5d4.json): landed just after the 4 tests passed, with Next still running; exit 130, `workflowPassed: false`, `acceptedRun: false`, so an interrupted run cannot be accepted even after passing tests; cleanup complete |
| Hard kill + manifest recovery | `cf9419d9c853bbf447f84d43f9a64cce`: SIGKILL of the launcher during R4 while the clock held +2,592,009,388 ms; exit 137. Before recovery, 9 containers, 2 networks, 5 volumes, 1 image, the runtime directory and 18 marked processes (including the owned `next-server`) remained. `node scripts/e2e/cleanup.mjs <exact printed manifest>` exited 0 and left zero browser/Next/Docker/runtime leftovers; a repeated recovery was a no-op, exit 0. A killed launcher writes no receipt. An earlier hard kill, `f66df8f7b0c9b68dfd49c2b375cf1af2`, recovered the same way |

Neighboring Docker resources (22 containers by ID/name/image/state, 11 networks,
26 volumes, excluding `ontokit-e2e`) were snapshotted before the first probe and after
the last; the two snapshots are identical. Unrelated host `next-server` processes were
not signaled.

## Requirement evidence map

| Requirement | Evidence |
|---|---|
| R1–R4 | Lifecycle receipts above (per-case evidence and clock labels) |
| R5 | Application defects D08 demonstrated and repaired with regression coverage: (1) a stale `RefreshAccessTokenError` survived a successful retry; (2) an expired grant with no refresh credential was not flagged as unrenewable; (3) logout sent an empty `client_id` because the public client ID was not compiled in. These three are fixed in web PR #51 (`8381d59f`), and PR #52 (`7f92fa79`) guards compiled-versus-runtime client-ID parity. (4) Auth.js logs leaked tokens and were redacted; (5) logout reached the provider's session chooser without `id_token_hint` and now sends the hint (both in `00320750`). (6) Logout and refresh requests had no bound and now time out (`93ea222d`). The full Vitest suite, including the auth regression tests, passes (below) |
| R6 | Both profiles' mandatory inventories; `scripts/e2e/evidence.test.mjs` negative cases (synthetic, not live acceptance) |
| R7 | Allowlisted receipts (`sanitizedEvidence`, receipt version 2); ownership/cleanup gates; neighbor identity comparison unchanged across the acceptance batch and the probe batch |
| R8 | `clock` labels, `realElapsedCases` vs `clockControlledCases`, `acceptance.scope = local-verification`, `hostedAcceptance: false` |

## Local verification gates

| Gate | Result |
|---|---|
| `npm run test:e2e:evidence` | 70 passed |
| `npm run test:e2e:profiles` / `test:e2e:ownership` / `test:e2e:identity` | 25 / 34 / 9 passed |
| `npm run type-check` / `npm run lint` | Clean |
| Vitest (includes targeted auth tests) | 365 files / 5,249 tests passed |
| Independent review | ce-code-review at full depth: six local reviewers plus an independent Codex adversarial pass (independence verified). Fixed: logout and refresh timeouts, the debug-logger test and shared lifecycle helpers. Deferred by plan: the multi-tab refresh-rotation race |
| Publication | [PR #53](https://github.com/alea-institute/ontokit-web/pull/53); merged as `cc64c02b` after all CI checks passed (one rerun for the unrelated flaky editor test, issue #54); deployed to DEV 2026-09-25. Earlier today #51 (U2 callback fixes, logout client ID) and #52 (client-ID parity guard) were merged and deployed to DEV at web `7f92fa79`. D08's app repairs (log redaction, hinted logout, timeouts) deploy after #53 merges |

## Carried forward (not delivered by D08)

B11's optional/configured, optional/unconfigured and disabled auth-mode matrix remains
open. The contributor suggestion submit/review chain also remains open. B02/B03 hosted
persona acceptance, B12 WebSocket lifecycle and B13 cross-browser/CI coverage remain open.
Multi-tab refresh locking (the deferred refresh-rotation race) and broader background
session polling were not added.
