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
full-stack acceptance. The full U2 workflow below adds identity/Login and the Next production server.

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

## Genuine identity foundation (U2)

```
npm run test:e2e:identity
npm run test:e2e -- --api-source /absolute/path/to/ontokit-api
```

The full entry point adds pinned disposable Zitadel/Login, two new ordinary humans,
an exact localhost OIDC callback, a production Next build/server and matching Chromium.
It installs the copied lockfile and Chromium into the private run directory; allow
network access to public package/browser registries and sufficient build space. Host
Chromium system libraries must already be installed. Missing libraries or failed
bootstrap/build/login fail the run; there is no skip or existing-browser fallback.
Do not invoke Playwright directly or use `--no-deps`: the private run config and
ownership marker are required, and genuine login is the setup project dependency.

API and host discovery retain one canonical issuer. Login shares Zitadel's network
namespace; both listeners use their allocated loopback-published ports. The API's
internal transport uses the Zitadel bridge address while its expected issuer remains
canonical. The API receives the generated web client ID for audience validation.
Bootstrap asserts required authentication and an empty superadmin allowlist in the
actual API container. Browser sessions and API tokens are issued by the real provider.
Bootstrap administration is never used as a test persona.

Bootstrap uses the pinned server's V2 organization search, project/application Connect
APIs and `POST /v2/users/new`. Request schemas are from Zitadel commit
`beffd5e32e98a1518e5f6dc17acda93f7786cc1e`:
[Project API](https://zitadel.com/docs/reference/api/project/zitadel.project.v2.ProjectService.CreateProject),
[Application API](https://zitadel.com/docs/reference/api/application/zitadel.application.v2.ApplicationService.CreateApplication),
[User API](https://zitadel.com/docs/reference/api/user/zitadel.user.v2.UserService.CreateUser).
PAT expiry is generated one day after each run starts. Read-only organization discovery
retries transient startup failures for up to 120 seconds; rejected credentials fail
immediately and create operations are single-shot. The OIDC client includes profile
claims in the ID token, matching the existing setup script and Auth.js configuration.

Browser setup signs in separately as owner and unrelated user and obtains each API
credential from the completed NextAuth session. The application session retains the
verified Zitadel account subject so frontend membership checks use the backend identity.
Independent request contexts send
those genuine tokens; the anonymous context receives neither tokens nor browser state.
Auth state, passwords, session responses, npm/browser caches, runner reports and build
logs remain under `ctx.dir`. Traces/screenshots/video are off because they can retain
credentials. Setup and test diagnostics are private; outer cleanup removes everything,
including if the Playwright teardown project does not run. Opt-in failure retention also
captures bounded JavaScript errors, Login UI state and the last 80 lines from owned
services. These may contain credentials; the same private permissions, expiry and
cleanup rules above apply.

Negative setup probes: `--fail-at identity-pat` uses an intentionally invalid generated
bootstrap credential, `--fail-at identity-issuer` rejects discovery, and
`--fail-at identity-callback` registers an intentionally incorrect callback so real
browser authentication fails. All must return nonzero and complete owned cleanup.
The normal command has no injected failure. U2 establishes authentication only; later
units add B10 domain and editor workflows, so this alone does not complete B10.
