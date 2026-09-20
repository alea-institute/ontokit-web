# Disposable lifecycle (U1)

Linux and a local Unix Docker endpoint with Compose v2 are required, plus 8 GiB free under `/tmp`.
The API checkout is mandatory:

```
npm run test:e2e:ownership
npm run test:e2e:lifecycle -- --api-source /absolute/path/to/ontokit-api
```

This probe builds the selected API source, provisions pinned PostgreSQL 17/pgvector,
Redis and MinIO, applies migrations once, verifies the database's revision set against
all repository heads, and starts API/worker with automatic migrations disabled. It
proves lifecycle infrastructure only; it does not claim authenticated readiness or
full-stack acceptance. Identity/Login and the Next production server are U2 work.

Use `--fail-at after-dependencies` to exercise setup failure, `--fail-at after-workflow`
to exercise late failure, or `--hold` to send INT/TERM after migration. Each run prints
its ID and recovery manifest path. Cleanup always runs and must succeed for exit zero.
Docker connection discovery reads the selected context endpoint; only local Unix
endpoints are accepted. Application environment is never inherited.

Nonsecret manifests live in ignored, mode-0700 `.e2e-runs/<id>/manifest.json` and survive
ordinary `/tmp` cleanup/reboot as long as the checkout is retained. Credentials, source
copies and logs live only in mode-0700 `/tmp/ontokit-e2e-<uid>/<id>` and are deleted by
default. After an uncatchable interruption, use the exact printed manifest path:

```
node scripts/e2e/cleanup.mjs /absolute/checkout/.e2e-runs/<id>/manifest.json
```

Do not delete the checkout or its recovery manifest until cleanup succeeds. Recovery
requires this harness at its original checkout path. Recovery never deletes resources
unless both Compose project and run labels agree, verifies host supervisors with run
markers plus PID/start time/boot identity, and fails closed when ownership is ambiguous.
A missing manifest is not permission to adopt or delete Docker resources.

U2 imports `run({apiSource, workflow})`; `workflow(ctx)` runs after migration/API startup.
`ctx.dir` is the private runtime directory, `ctx.manifestDir` stores only recovery metadata,
`ctx.manifest.ports` contains api/identity/login/web ports, and `ctx.values` holds generated
Compose variables. `compose(ctx, ...args)` and `ownedCommand(ctx, command, args, options)`
keep child groups owned across command failure. Options include `cwd`, `env`, and a bounded
`timeout`. Supply only explicit environment values and place all auth/browser state under
`ctx.dir`. All owned commands cooperate with `ctx.signal`; workflow waits must also abort.
Do not place secrets into the manifest. Compose is copied into `ctx.dir` before execution;
new service declarations must preserve labels and private networks.

Owned commands propagate `ONTOKIT_E2E_RUN` to descendants. Cleanup checks the run marker
and process identity even when a descendant creates a new session/process group. Commands
must preserve this marker in child environments; unmarked independently launched processes
are not adopted. The supervisor exits if IPC disconnects before its first work message;
work is sent only after the recovery manifest records the supervisor identity.

For explicit failure investigation only, add `--retain-diagnostics`. On failure the
last 8 MiB of `private.log` is copied to `/tmp/ontokit-e2e-diagnostics-<uid>/<id>/`
(outside Git), with mode 0700 directories and 0600 files. A nonsecret `metadata.json`
records run ID, phase, truncation and a one-hour expiry. Every later launcher invocation
removes expired entries before prerequisites; there is no background deletion timer.
Delete the run's diagnostic directory immediately after diagnosis. Logs can contain
credentials and must never be printed, uploaded, copied into the repository or committed.
The default retains no diagnostics, and resource/runtime cleanup remains mandatory even
when diagnostic retention is requested.

Each source manifest entry contains `{revision, sha256}`: Git HEAD plus a deterministic
SHA-256 over sorted copied relative paths and their actual bytes. This records modified
tracked files without storing their contents or diffs. Untracked files are intentionally
excluded; stage new harness/application source before a snapshot that needs to include it.
Credential files, caches and unsafe source symlinks remain excluded/rejected as documented.
