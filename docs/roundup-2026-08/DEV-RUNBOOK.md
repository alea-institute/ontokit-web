# OntoKit DEV Operations Runbook

## Zitadel stack

This is the public-safe operations record for the U7 DEV standup and the source input
for R13/U12 infrastructure-as-code capture. It intentionally contains no credential
values. Credential material lives only in the mode-600 `/opt/ontokit/.env`; use the key
names below when operating the stack.

### Topology

- DEV runs on CPX41 `ontokit-dev` (`178.156.208.239`). The live compose file is
  `/opt/ontokit/compose.yaml`; its pre-U7 backup is
  `/opt/ontokit/compose.yaml.bak-u7-20260809`.
- The Coolify Traefik proxy on `hetzner-dev` fronts wildcard DNS for
  `*.dev.openlegalstandard.org`. Its DEV file-provider configuration is
  `/data/coolify/proxy/dynamic/ontokit-dev.yaml`; the U7 backup is
  `/data/coolify/proxy/dynamic/.ontokit-dev.yaml.bak-u7`.
- Zitadel has one external domain: `ontokit-auth.dev.openlegalstandard.org`. Login V2
  uses Zitadel's standard path split at `/ui/v2/login`. Let's Encrypt certificate
  issuance is automatic.

### Zitadel services

- `mailpit` is internal-only with no published ports. Zitadel SMTP targets
  `mailpit:1025`; inspect its UI only through `docker exec` or an SSH tunnel.
- `zitadel` runs `ghcr.io/zitadel/zitadel:latest` (v4.16.3 at standup) with
  `start-from-init --masterkey "${ZITADEL_MASTERKEY}" --tlsMode external`. It uses the
  shared postgres with database/user `zitadel` and `${ZITADEL_DB_PASSWORD}`. External
  HTTPS terminates at Traefik. Compose sets `ZITADEL_EXTERNALDOMAIN` to the auth host,
  `ZITADEL_EXTERNALPORT=443`, `ZITADEL_EXTERNALSECURE=true`, and
  `ZITADEL_TLS_ENABLED=false`; the container publishes `8080:8080` for API/console and
  `8081:3000` for Login V2. Both ports are firewalled. The admin organization is
  `OntoKit`, the human is `admin`, log level is `info`, and generated PAT expiries are
  `2026-09-15T00:00:00Z`.
- `login` runs `ghcr.io/zitadel/zitadel-login:latest` with
  `network_mode: service:zitadel`. `ZITADEL_API_URL` is the public auth URL because
  server-side requests egress CPX41 and return through the ungated internal router.
  The image no longer honors `ZITADEL_SERVICE_USER_TOKEN_FILE`; the live entrypoint
  reads `/zitadel-data/login-client.pat`, exports `ZITADEL_SERVICE_USER_TOKEN`, and then
  executes `/app/entrypoint.sh node apps/login/server.js`.
- Login health must be checked with `http.request` and the Host header
  `ontokit-auth.dev.openlegalstandard.org`. A `fetch`-based healthcheck is invalid here:
  undici drops Host overrides, while Login V2 derives service configuration from the
  request headers.
- The web image now requires build args for `AUTH_MODE`, `ZITADEL_ISSUER`, and
  `ZITADEL_CLIENT_ID`; these are baked into the Next.js client flags. Never pass the
  client secret as a build arg. This standup record's original SHAs were web
  `cfa91623` and api `20cb6aa7`; the 2026-08-15 verified deployment superseded them
  with web `83b62b0b` and api `435dc393`.

### Secrets & env contract

`/opt/ontokit/.env` is mode 600. Do not copy values into source, logs, tickets, or this
runbook. The Zitadel/OIDC contract consists of these key names:

- `ZITADEL_MASTERKEY`
- `ZITADEL_ADMIN_PASSWORD`
- `ZITADEL_DB_PASSWORD`
- `ZITADEL_CLIENT_ID`
- `ZITADEL_CLIENT_SECRET`
- `ZITADEL_SERVICE_TOKEN`
- `ZITADEL_ISSUER`
- `SUPERADMIN_USER_IDS`
- `NEXT_PUBLIC_ZITADEL_CLIENT_ID`

The same env already contains `AUTH_SECRET`, `SECRET_KEY`, and
`GITHUB_TOKEN_ENCRYPTION_KEY`. Both api (`settings.zitadel_issuer`, with optional
`zitadel_internal_url`) and web (`lib/env.ts` and `auth.ts`) consume the issuer contract.
The terminal DEV mode is now `AUTH_MODE=optional` for api and web. The api's pydantic
enum is `required | optional | disabled`; `optional`, not the planning shorthand
`enabled`, is the state in which anonymous users can browse and suggest while
authenticated roles receive their additional capabilities.

When re-initializing Zitadel against the existing postgres volume, first align the
pre-existing `zitadel` role's login password with `ZITADEL_DB_PASSWORD` from the env.
The api repo's `scripts/init-db.sh` may already have created the role and database;
Zitadel init otherwise skips password creation and crash-loops on SASL authentication.

### Traefik routes

The file-provider config was rewritten from a validated dictionary, preserving every
pre-existing router and middleware. Relevant routes are:

| Router | Match / priority | Middleware | Upstream |
| --- | --- | --- | --- |
| `ontokit-auth-internal` | Auth Host + `ClientIP(178.156.208.239)`, 50000 | None | CPX41 `:8080` |
| `ontokit-auth-login` | Auth Host + `PathPrefix(/ui/v2/login)`, 45000 | None | CPX41 `:8081` |
| `ontokit-auth-zitadel` | Auth Host, 40000 | None | CPX41 `:8080` |
| `ontokit-auth-http` | Auth Host on HTTP entrypoint | HTTPS redirect | HTTPS auth host |

The internal router is intentionally ungated so Login V2 and, after the flip, the api
can validate tokens without basic auth. It relies on Traefik v3.6's `ClientIP` matcher.
The preserved routes include web priority 10000, api priority 20000, and the
`ontokit-api-dev-gate` dead-end priority 30000. Per Damien's q1 decision, the
`ontokit-dev-auth` basic-auth middleware has been deleted from the middlewares block
and removed from all five routers that used it: `ontokit-dev-web`, `ontokit-dev-api`,
`ontokit-api-dev-gate`, `ontokit-auth-login`, and `ontokit-auth-zitadel`. The
`ClientIP` internal router remains. The pre-flip proxy backup is
`.ontokit-dev.yaml.bak-preflip`; gate-credential rotation is moot because nothing uses
that credential.

### Firewall

`/usr/local/sbin/ontokit-firewall.sh` is the idempotent source of live host rules for
ports `3000`, `8000`, `8080`, and `8081`. `ontokit-firewall.service` is an enabled
systemd oneshot ordered `After=docker.service`.

- IPv4 uses `DOCKER-USER` and original-destination matching: traffic to
  `178.156.208.239` is dropped unless its source is the proxy `204.168.246.227`.
- IPv6 INPUT drops non-loopback traffic to all four published ports.
- Do not replace this with whole-table `iptables-restore`; saved tables can replay stale
  Docker chain state.

The old `/etc/iptables/rules.v4` and `rules.v6` files did not provide persistence by
themselves: no persistent package or restore unit was installed. Verify the systemd
unit is enabled after host maintenance. From an off-box host, direct requests to raw
`:8080` and `:8081` must time out; proxied discovery, Login V2, and console paths must
continue to work.

### Setup script

The parameterized script is `/opt/ontokit/setup-zitadel-dev.sh`, copied from
`scripts/setup-zitadel.sh` on api branch `feat/u7-zitadel-standup` at commit
`504ba5d6` (source worktree `~/worktrees/ontokit-api-u7`). It was run with the auth and
web public URLs, data volume, admin username, both env-file targets, and env update
supplied through the script's named parameters; consult the invocation history or
script without copying credential values. The run created the `OntoKit` project and
`OntoKit Web` OIDC app with callback
`https://ontokit.dev.openlegalstandard.org/api/auth/callback/zitadel` and updated
`/opt/ontokit/.env`. `jq` was installed on the box because the first run lacked it; the
first "Failed to create project" message was a parse failure after the project had in
fact been created.

### Auth-on flip checklist — EXECUTED 2026-08-10

The flip and terminal sweep are complete. `/opt/ontokit/compose.yaml` has
`AUTH_MODE: optional` for api and web, with backup
`compose.yaml.bak-preflip-20260810`. The first attempt used the plan's shorthand
`enabled`; the api rejected that invalid literal at startup, demonstrating the
configuration's fail-fast behavior. Correcting it to the api enum's `optional` value
established the intended terminal DEV behavior.

The web client flags are build-time values. Commit `cfa91623` on
`feat/u7-web-auth-buildargs` adds the required Dockerfile `ARG`/`ENV` declarations for
`AUTH_MODE`, `ZITADEL_ISSUER`, and `ZITADEL_CLIENT_ID`; the client secret is
deliberately excluded. The live compose supplies those build args, and the web was
rebuilt with `docker compose build --no-cache web`. The F6 stale-chunk check was clean,
and the sign-in UI and notification bell appeared. Current deployed SHAs are api
`20cb6aa7` (`feat/u7-zitadel-standup`) and web `cfa91623`
(`feat/u7-web-auth-buildargs`).

After anonymous write enforcement was verified, the basic-auth gate was removed as
recorded in the Traefik section. The four-persona sweep and auth-enabled R4 happy-path
sweep passed; KD1's contributor-author versus admin-committer split was proven. U7 is
DoD complete, and U12 infrastructure-as-code capture and U14 upstream mapping are
unblocked. If the OIDC client secret should rotate after UAT, consider rerunning
`/opt/ontokit/setup-zitadel-dev.sh` with `--force-secrets`.

### UAT personas

Three named DEV users remain in Zitadel for future UAT:

- `uat-suggester` — project role `suggester`.
- `uat-editor` — project role `editor`.
- `uat-admin` — superadmin through `SUPERADMIN_USER_IDS` in `/opt/ontokit/.env`.

The suggester and editor project memberships were added through the application's own
members API while acting as `uat-admin`. Their passwords are throwaway DEV
credentials; do not record them here. Reset them in the Zitadel console at
`/ui/console` when needed.

### Known residuals

- **U12 capture is complete.** The repository compose, Traefik template, firewall
  script/unit, env contract, and runbook live under `ontokit-api/deploy/`. External
  images, including Zitadel and Login V2, are digest-pinned. The Login V2 wrapper and
  Host-aware healthcheck are captured there. U12's stricter matched-pair/rollback
  proof and U8 cron capture remain plan-audit follow-ups rather than missing live IaC.
- The setup script emits a benign `jq` null-iteration line during existing-app search.
- The setup script's closing message displays its default admin password when
  `ZITADEL_ADMIN_PASSWORD` is absent from the script process env. This is display-only;
  the effective password remains the value in `/opt/ontokit/.env`. Fix the message
  before wider reuse, and never capture its output in public logs.
- A diagnostic `localhost` trusted-domain entry remains in Zitadel. It is harmless and
  ineffective for `localhost:8080` because the port cannot be matched.
- Generated PATs expire `2026-09-15T00:00:00Z`; re-initialize Zitadel or re-mint them
  before then.
- **F-c closed 2026-08-13:** ALEA web PR #18 derives the public issuer through the
  build contract, removes the localhost client fallback, and was verified against the
  live bundle and Zitadel end-session URL. CatholicOS web #344 stays open only until
  the fix reaches upstream.
- **F-d closed 2026-08-13:** ALEA web PR #18 fixes the stale-session-id closure in all
  three suggestion handlers. Live verification observed session POST followed by save
  PUT and a real commit. CatholicOS web #345 stays open only until upstream delivery.
- The analogous server-side fallback in `auth.ts` remains CatholicOS web #360; it is
  latent on correctly configured DEV and belongs to the residual engineering queue.
