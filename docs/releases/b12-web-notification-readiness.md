# B12 web notification hardening — local readiness

Date: 2026-10-09. Lane: `feat/drain-b12-sockets`; base: `dev`, starting at
`origin/dev` / `3192447b4863fafed81f39ba31a4f72b3daca901`.
[Plan](../plans/2026-10-09-b12-notification-sockets-plan.md).

Damien's **Harden what exists** decision narrows this deliverable to three real
notification clients. **Presence, collaboration acknowledgments, editing sync and
multi-client editing are not built.** The fake collaboration badge advertising
`/api/v1/collab/ws` is removed. The surviving badge reports the actual lint socket.
The historical collaboration assumptions in `docs/plans/e2e-testing.md` do not
establish implemented functionality or current acceptance scope.

## Delivered behavior and evidence

| Client | Authentication and recovery proof |
| --- | --- |
| Lint `/api/v1/projects/{id}/lint/ws` | Factory encodes token on connect; HealthCheckPanel reconnects after simulated server restart and fetches authenticated status/issues on open. A 15-second background refresh recovers missed updates even while connected. |
| Index `/api/v1/projects/{id}/ontology/index-ws` | Manager keeps one connection, resets retries on open and refreshes authoritative query data. Settings clears stale rebuild state from the recovered status. A 15-second query refresh recovers missed notifications. |
| Quality `/api/v1/projects/{id}/quality/ws` | HealthCheckPanel reconnects with the current token and reloads branch-scoped cached findings after reopen. Existing job-ID polling now runs for connected jobs too, so losing a terminal event after triggering consistency or duplicate detection cannot strand the UI. Progress notifications still give fast updates. |

Shared reconnect lifecycle: retries at 1/2/4/8/16 seconds (maximum five until a
successful open), one pending timer, no duplicate CONNECTING socket, no retry
after disposal or policy refusal (1008), and no messages/open events from retired
connections. Normal server close (1000) remains terminal. Credentials are replaced
by disposing/recreating the owning connection, rather than retaining an old token.
Independent manager instances remain isolated.

Factories log static diagnostics only: no raw Event/socket, payload type, parse
exception or token-bearing URL is sent to console. The lint status hook no longer
logs arbitrary message types. Tests use synthetic fixture tokens only.

## Verification

All commands bounded by `timeout`; no live stack, credentials, network, push or
GitHub calls. Tests stub only transport boundaries where integration is claimed;
production URL construction, decoding, managers, UI effects and API calls execute.

- `timeout 90s npm run test -- --run` with API suites `notificationSockets`,
  `lint`, `indexStatus`, `quality`; HealthCheckPanel unit/integration/branch suites;
  settings-index integration; hooks `useIndexStatus` and both
  `useCollaborationStatus` suites: **11 files, 252 passed, 0 failed**.
- `timeout 60s npm run test -- --run` with editor-page/editor-actions integration
  and useProjectViewer: **3 files, 212 passed, 0 failed**.
- Strengthened raw-console-argument check rerun with
  `notificationSockets.test.ts`: **1 file, 7 passed, 0 failed** (included in the
  focused suite count, not additional unique tests).
- `timeout 120s npm run lint`: **0 errors, 21 warnings**.
- `timeout 120s npm run type-check`: **passed, 0 diagnostics**.
- `git diff --check`: passed.

Initial proof-first factory/manager run: **5 failed**, exposing sensitive logging,
duplicate lint connections and missing open-recovery callbacks. Intermediate
failures were resolved: legacy diagnostic assertions updated for redaction;
WS-only timeout tests now exercise bounded pending-job polling; integration mocks
no longer deliver completion from retired sockets; a fake-clock reset in a test
was removed; pending-response fixtures gained their required job IDs.

Self-review covered socket ownership, duplicate error/close retry scheduling,
retry-budget reset, token changes, scope cleanup, branch filtering and HTTP races.
A delayed reconnect cache response could overwrite a just-completed quality job;
completion now invalidates older requests. No unresolved finding remains in scope.

## Remaining boundaries and next action

Client-side tests prove token transmission, not backend authentication enforcement
or server restart behavior on a deployed stack. The separate API lane owns those
contracts. No hosted acceptance, presence or sync is claimed. B12's original
catalog remains preserved with this narrowed scope recorded in the roadmap.

The orchestrator must review this local branch and publish a PR targeting **dev**;
`.github/workflows/pr-target-guard.yml` reserves main PRs for dev promotion. No
publication/deployment occurred in this worker. BLOCKERS: none. NEEDS-DAMIEN: none.
