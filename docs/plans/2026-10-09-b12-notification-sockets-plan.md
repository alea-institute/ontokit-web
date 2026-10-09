# B12 web notification socket hardening

Scope decision: Damien selected **Harden what exists**. Presence, collaboration
acknowledgments, editing sync and multi-client editing are **not built**; do not
implement them. API authentication enforcement and protocol tests belong to the
separate API lane. This lane proves production web client behavior using mocked
WebSocket/fetch boundaries and unit/component tests; no live stack acceptance.

Baseline: clean `feat/drain-b12-sockets`, HEAD/origin/dev `3192447b`.
PR base: `dev` (the main target guard permits only dev-to-main promotion).
No network/publication in this worker. Native inline execution, caller owns shipping.

1. Characterize and harden lint/index reconnect lifecycle: one live connection,
   bounded backoff, retry budget reset on open, cancellation on disposal,
   stale-event suppression and authoritative HTTP refresh on connection open.
   Wire recovery into HealthCheckPanel and project settings.
2. Reconnect quality progress and recover missed terminal updates from existing
   authenticated job-result polling, including loss after starting a connected job.
   Preserve branch/project/token boundaries and progress message handling.
3. Remove the fake collaboration badge advertising `/api/v1/collab/ws`.
   Suppress raw socket event/payload/parse-exception logging, which can contain
   token-bearing URLs. Prove encoded authentication on every connection and
   no sensitive log output for all three production factories.
4. Run focused API/component suites, bounded lint and type-check; inspect the
   final diff. Record evidence and narrower B12 disposition in roadmap and the
   required `.codex-out/lane-result.md`. Commit each coherent unit locally.

Acceptance: reconnect after simulated server restart, missed-update recovery,
connect-time tokens, cleanup/token replacement, and log-redaction tests pass
through production clients. Explicitly retain absence of presence/sync and limits
of mocked transports; orchestrator reviews and publishes to dev.
