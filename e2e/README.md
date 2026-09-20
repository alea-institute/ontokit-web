# Isolated full-stack tests (B10 / D06)

Run from the web checkout on Linux with Node >=22.13, Git, local Unix-socket Docker,
Compose v2, Chromium system dependencies and at least 8 GiB free under `/tmp`.
Package, browser and container registries must be reachable. Stage new source files
before running: snapshots include Git-listed paths and their current working bytes,
not untracked files. Every invocation creates fresh services and ordinary identities.

```sh
npm run test:e2e:evidence
npm run test:e2e -- --api-source /absolute/path/to/ontokit-api
```

Select the API checkout explicitly. D06's current source is
`../api-d06-pr-response` (relative to this web worktree), HEAD `f5f036b9`, containing
the non-root image and PR response repairs. Do not use the stale original API checkout.
The receipt records full Git revisions **and actual copied-byte SHA-256 fingerprints**;
HEAD alone does not describe staged or modified source. No developer `.env` is copied.

The launcher installs the copied lockfile and Chromium, builds Next in the private
copy, applies and verifies all API migration heads, authenticates through real OIDC,
and runs API contracts plus the Chromium import/edit/PR/merge/reload journey.
All 21 named mandatory tests must pass once, with zero skips, failures, retries or
flaky tests. Missing spec/category, wrong project, expected failure and global runner
errors fail the gate. Test names and their files are enumerated in
[`scripts/e2e/evidence.mjs`](../scripts/e2e/evidence.mjs). Update that inventory
intentionally when changing acceptance coverage. Do not invoke Playwright directly.

Cleanup must succeed before exit zero. The launcher prints a sanitized receipt path:
`.e2e-runs/receipts/<run-id>.json`. This ignored file survives successful runtime cleanup
and ordinary `/tmp` cleanup, but not deletion of the checkout. It contains only source
fingerprints, actual container image IDs and image references, observed database heads,
fixed mandatory test names/counts, timestamps, workflow outcome and cleanup outcome.
`acceptedRun` requires both workflow and cleanup success plus complete metadata. It
proves that single run only; neighbor integrity and repeatability require separate
observations. Copy reviewed receipts into release evidence when closing D06. Never
copy raw Playwright JSON, sessions, logs, credentials or private source contents there.
Failure before prerequisites allocate a run has no receipt and returns nonzero.

## Lifecycle and recovery

For full ownership, confinement and opt-in private diagnostic details see
[the lifecycle maintainer guide](../scripts/e2e/README.md). Available probes:

```sh
npm run test:e2e:lifecycle -- --api-source /absolute/path/to/api --fail-at after-dependencies
npm run test:e2e -- --api-source /absolute/path/to/api --fail-at after-workflow
npm run test:e2e:lifecycle -- --api-source /absolute/path/to/api --hold
```

Send SIGINT (Ctrl+C for a foreground run) or SIGTERM to the launcher while held; expect nonzero
and complete cleanup. Identity setup probes `identity-pat`, `identity-issuer` and
`identity-callback` are also available through `--fail-at`. Hard interruption cannot
run finalizers or issue a completed receipt. Recover using the **exact printed path**:

```sh
node scripts/e2e/cleanup.mjs /absolute/web/checkout/.e2e-runs/<run-id>/manifest.json
```

Keep the checkout and recovery manifest until recovery succeeds. Recovery checks both
Docker ownership labels and host process identities, including browser/Next descendants.
Never use global prune, port-based process killing, or another run's manifest.
Opt-in `--retain-diagnostics` keeps private failure logs for one hour (expiry is enforced
on a later launch, not by a timer); delete them after diagnosis and never commit them.

For final acceptance, run the canonical command twice from fresh state with the same
source bytes. Save both sanitized receipts. Record neighbor container/network/volume
identities before and after each run and prove they are unchanged. Repeat current
setup failure, workflow failure, INT/TERM and explicit hard-kill recovery probes;
the hard-kill probe must reach `testing` so browser/Next descendants are exercised.
Missing prerequisites must fail, not skip. Parent-owned live evidence is recorded in
[the readiness receipt](../docs/releases/d06-full-stack-readiness.md).

## Scope

B10 maps to project CRUD, import/entity reads/source persistence, branches/PR diff and
merge, lexical search, real worker lint, rejected writes without mutation and the real
browser workflow. B11 broader auth/editor/suggestion scenarios, B12 collaboration and
WebSocket contracts, and B13 browser CI/Firefox/schema/retention work remain separate.
Local test success does not activate hosted DEV or complete D02/B02–B03.
