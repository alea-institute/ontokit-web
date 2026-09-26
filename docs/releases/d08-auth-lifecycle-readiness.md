# D08 required authentication lifecycle readiness

Status: **TODO (orchestrator)**. This is a skeleton. No live acceptance is claimed until
every TODO below is replaced with evidence from a fresh run.
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
| Web branch / HEAD | `test/d08-auth-lifecycle-20260920` / TODO full SHA |
| API checkout / HEAD | TODO path; TODO full SHA (must contain D07 `13ad2f35d55196274c5fec313bfb254a7cc80226` or a reviewed descendant) |
| Copied-byte fingerprints | TODO `sources.web.sha256` / `sources.api.sha256`; identical across all four accepted runs |
| Package / browser versions | TODO Next, @auth/core, Playwright, Chromium |
| Pinned service images | TODO image IDs from the receipts (postgres, redis, minio, zitadel, login, api, worker) |

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

Each accepted receipt must show `acceptedRun: true`, `cleanup: "complete"`, the
expected `profile`, and `acceptance: {scope: "local-verification", hostedAcceptance: false}`.
Copy only sanitized receipts here, never raw Playwright JSON, logs, sessions or credentials.

| Gate | Evidence |
|---|---|
| Baseline fresh run 1 | TODO run ID, receipt file `d08-run-<id>.json`: 21 passed, 0 skipped/failed/flaky; neighbors unchanged |
| Baseline fresh run 2 | TODO run ID, receipt file: same fingerprints; neighbors unchanged |
| Lifecycle fresh run 1 | TODO run ID, receipt file: 4 passed; `tests.clockControlledCases` = [R4]; `tests.realElapsedCases` = [R2, R3]; neighbors unchanged |
| Lifecycle fresh run 2 | TODO run ID, receipt file: same fingerprints; neighbors unchanged |

### Lifecycle receipt fields to transcribe (per lifecycle run)

| Field | Run 1 | Run 2 |
|---|---|---|
| `lifecycle.lifetimes` (access / id / refresh idle / refresh absolute, s) | TODO | TODO |
| `lifecycle.graceSeconds` | TODO | TODO |
| `lifecycle.observedAccessTokenLifetimeSeconds` | TODO | TODO |
| `lifecycle.preflight.verifierToleranceSeconds` / `marginMs` | TODO | TODO |
| `lifecycle.preflight.workerShiftErrorMs` / `serviceClockSkewMs` | TODO | TODO |
| `lifecycle.preflight.beforeAccepted` / `afterRejected` / `cookiesCleared` / `restored` | TODO (all true) | TODO (all true) |
| R2 `renewedAfterExpirySeconds` (≤ grace) | TODO | TODO |
| R3 `waitedAfterIssueSeconds`, `providerSsoReused` | TODO | TODO |
| R4 `workerShiftErrorMs`, `toleranceWindowExercised`, `refreshErrorBeforeBoundary` | TODO | TODO |
| R1 `providerSessionChooser`, `postLogoutRedirected`, `nextLoginInteractive` | TODO | TODO |

## Failure and recovery (instrumented Next process running)

| Probe | Evidence |
|---|---|
| Setup failure (`--fail-at after-dependencies`) | TODO run ID: exit 1, cleanup complete, neighbors unchanged |
| Clock preflight failure (`--fail-at clock-preflight`, lifecycle) | TODO run ID: exit 1, clock restored/owned Next stopped, cleanup complete |
| Late workflow failure (`--fail-at after-workflow`) | TODO run ID: `acceptedRun: false`, cleanup complete |
| SIGINT / SIGTERM | TODO run IDs: exit 130, cleanup complete |
| Hard kill + manifest recovery | TODO run ID: zero browser/Next/Docker/runtime leftovers |

## Requirement evidence map

| Requirement | Evidence |
|---|---|
| R1–R4 | Lifecycle receipts above (per-case evidence and clock labels) |
| R5 | U2 auth callback repairs: web PR #51 (`8381d59f`); TODO confirm the targeted Vitest auth results |
| R6 | Both profiles' mandatory inventories; `scripts/e2e/evidence.test.mjs` negative cases (synthetic, not live acceptance) |
| R7 | Allowlisted receipts (`sanitizedEvidence`, receipt version 2); ownership/cleanup gates; TODO neighbor identity comparison |
| R8 | `clock` labels, `realElapsedCases` vs `clockControlledCases`, `acceptance.scope = local-verification`, `hostedAcceptance: false` |

## Local verification gates

| Gate | Result |
|---|---|
| `npm run test:e2e:evidence` | TODO |
| `npm run test:e2e:profiles` / `test:e2e:ownership` / `test:e2e:identity` | TODO |
| `npm run type-check` / `npm run lint` | TODO |
| Targeted Vitest auth tests | TODO |
| Independent review | TODO link |
| Publication | TODO PR link(s) and merge SHA; no deployment |

## Carried forward (not delivered by D08)

B11's optional/configured, optional/unconfigured and disabled auth-mode matrix remains
open. The contributor suggestion submit/review chain also remains open. B02/B03 hosted
persona acceptance, B12 WebSocket lifecycle and B13 cross-browser/CI coverage remain open.
Multi-tab refresh locking and broader background session polling were not added.
