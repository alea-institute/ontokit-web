# U6 Retrospective Alignment Review — Lens 5: Security Posture

Date reviewed: 2026-08-08  
Scope: artifacts built outside the CE harness on 2026-08-08, with primary emphasis on the FOLIO DEV standup/deploy configuration and secondary review of the API/web LLM fix rounds.  
Method limits: evidence-only, no network or host access. Secret values were intentionally withheld. “Closed” below therefore means supported by the supplied contemporaneous live-check record, not independently re-tested by this reviewer.

## Findings

### [P1] The GitHub machine credential has no proven least-privilege target guard

**Threat.** Any caller admitted through the shared basic-auth gate, any application-layer authorization bypass while `AUTH_MODE=disabled`, or an API/worker compromise can exercise a server-held GitHub write credential. The evidence does not establish repository allowlisting or a fine-grained token limited to the intended DEV target. A stolen or over-broad token therefore turns an app compromise into writes across every repository/org resource granted to that credential.

**Evidence.** Live UAT proves that an auth-disabled suggestion submit opened PR #3 (`docs/roundup-2026-08/DEV-UAT-LOG.md:171-175`). The fix-round continues resolving contributor commit identity before git writes (`.worker-reports/u6-evidence/api-fixround-code.diff:1419-1426,1577-1587`), but the supplied diff contains neither `mirror_credential.py` nor token selection/scope. More decisively, the governing plan says the project-aware target-authorizer “does not exist yet” and enumerates bypass-prone writers: `resolve_mirror_credential`, `_get_github_token`, PR Party, sync, bare pushes, and webhook registration (`docs/plans/2026-08-08-001-feat-ontokit-roundup-execution-plan.md:101-106,240-247`). The earlier residual review likewise identifies multiple GitHub mutation paths and failures after remote-side mutation (`docs/residual-review-findings/2026-08-08-llm-subsystem-review.md`, P0-2/P0-4 and PR-submit idempotency).

**Remediation.** Before further public/shared UAT, replace any classic/broad PAT with a fine-grained GitHub App installation token or fine-grained PAT limited to the single DEV repository and only the permissions actually used (normally Contents read/write and Pull requests read/write; Metadata read). Implement one deny-by-default, project-aware `(credential, owner/repo allowlist)` resolver and require every outbound GitHub mutation—including webhook registration and PR Party—to pass it. Separate live, demo-destination, and source-read credentials. Add negative tests proving writes to an unlisted repo fail before any HTTP/git mutation, and rotate the current token after migration.

Needs live check:

```bash
docker inspect ontokit-api-1 ontokit-worker-1 --format '{{range .Config.Env}}{{println .}}{{end}}' | sed -n '/^GITHUB_/s/=.*$/=<redacted>/p'
```

Then inspect the credential in GitHub’s token/App settings and record exact repository selection, expiry, and permissions; do not print the token. Also audit outbound call sites on the deployed API SHA:

```bash
rg -n 'Github\(|AsyncGithub|create_pull_request|merge_pull_request|create_hook|update_hook|git push|push\(' ontokit
```

### [P1] Default database and MinIO credentials make a single-container compromise a full data compromise

**Threat.** The bridge network keeps these services off the host’s published-port list, but it is not a security boundary against a compromised API, worker, web container, or another container attached to `ontokit`. The literal `postgres` and `minio123` passwords are guessable and repository-disclosable. MinIO uses the root account for the app, so compromise grants administrative access to every bucket/object; the app database credential is also the username repeated as password. Redis has no authentication at all. This enables ontology/object theft or deletion, queue injection, job tampering, and persistence after one workload compromise.

**Evidence.** Compose hard-codes Postgres superuser password `postgres`, app DSN `ontokit:ontokit`, MinIO root password `minio123`, and shares the MinIO root credential with API and worker (`.worker-reports/u6-evidence/dev-infra-compose-and-env.txt:2-18,31-44,46-62,80-107`). Redis has no password/ACL configuration (`...dev-infra-compose-and-env.txt:20-29,57,89`). All services share one bridge network (`...dev-infra-compose-and-env.txt:18,29,44,75,103,125-128`).

**Remediation.** Generate unique high-entropy values outside compose; use Docker secrets or root-owned `0600` env files until a secret manager exists. Create a non-superuser DB role limited to the OntoKit database/schema. Create a non-root MinIO service account restricted to the `ontokit` bucket and remove root keys from API/worker. Enable Redis ACL/password, bind it only to the internal network, and restrict commands if feasible. Split frontend and stateful services into networks so `web` cannot directly reach Postgres/Redis/MinIO. Rotate all four current defaults and assume they are public because they are present in an artifact that may enter a public repo.

Needs live check:

```bash
docker exec ontokit-postgres-1 psql -U postgres -d postgres -c '\du+'
docker exec ontokit-redis-1 redis-cli ACL LIST
docker exec ontokit-minio-1 mc admin user list local
docker network inspect ontokit_ontokit
```

### [P1] The DEV ingress controls are live hotfixes with fail-open rebuild/drift risk

**Threat.** The basic-auth middleware and DOCKER-USER rules are the only controls compensating for application auth being disabled. Neither is shown in versioned, reproducible infrastructure. A proxy reconfiguration, compose rebuild, host replacement, Docker network/port change, or rules restore failure can silently recreate the already-demonstrated full-access public principal.

**Evidence.** Compose still publishes API/web on all IPv4 and IPv6 interfaces (`.worker-reports/u6-evidence/dev-infra-compose-and-env.txt:67,124,139-141`). The UAT log records the live DOCKER-USER fix and persistence in `/etc/iptables/rules.v4`, but explicitly defers IaC to U12 (`docs/roundup-2026-08/DEV-UAT-LOG.md:150-169`). The basic-auth fix is likewise described as a live proxy change pending IaC (`...DEV-UAT-LOG.md:69-77`). The plan states `AUTH_MODE=disabled` is safe only while the network-level gate is continuously present (`docs/plans/2026-08-08-001-feat-ontokit-roundup-execution-plan.md:101-103`).

**Remediation.** Prefer eliminating public host publication: bind `3000`/`8000` to a WireGuard/private proxy address or use an overlay network between proxy and CPX41. If public publication remains, manage DOCKER-USER rules and Traefik dynamic config as reviewed IaC, test rules restoration during boot, and make deployment fail closed unless off-box raw-IP probes fail while authenticated proxy probes succeed. Add an `AUTH_MODE=disabled` startup/deploy assertion requiring the external gate. Remove `AUTH_MODE=disabled` at the terminal UAT state.

Needs live check:

```bash
iptables -C DOCKER-USER -p tcp --dport 3000 -m conntrack --ctorigdst 178.156.208.239 ! -s 204.168.246.227 -j DROP
iptables -C DOCKER-USER -p tcp --dport 8000 -m conntrack --ctorigdst 178.156.208.239 ! -s 204.168.246.227 -j DROP
systemctl is-enabled netfilter-persistent
iptables-restore --test /etc/iptables/rules.v4
```

The orchestrator must additionally probe `178.156.208.239:3000` and `:8000` from a non-proxy off-box host after every reboot/deploy; localhost or hostname checks do not establish isolation.

### [P2] Stopped Coolify workloads remain a reversible credential-bearing shadow deployment

**Threat.** An operator action, Coolify reconciliation, or mistaken `docker start` can restore the month-old ungated web/API/worker and its live secrets. Stopping containers closes execution and routing now, but retained app records, container configuration, volumes, and encrypted/plain environment retain credentials and a rapid rollback path to the vulnerable topology.

**Evidence.** The log records all three stale containers as stopped with restart disabled, confirms unauthenticated `/` changed from 200 to 401, and explicitly says the action is reversible and the Coolify app records remain (`docs/roundup-2026-08/DEV-UAT-LOG.md:187-196`). This verifies F6’s public route is closed at the recorded time, but not decommissioned.

**Remediation.** At the phase gate, either fully remove the Coolify application, containers, networks, routes, and obsolete secret records after backup/approval, or bring it under the same gate and IaC with a named owner and purpose. Rotate every credential that existed in the stale container environment (`ZITADEL_SERVICE_TOKEN`, `GITHUB_TOKEN_ENCRYPTION_KEY`, DB and MinIO credentials) because its retention history and access are not demonstrated. Add a duplicate-hostname deployment check to CI/operations.

Needs live check:

```bash
docker ps -a --filter name=ue6k --filter name=hlcjgyv9z --filter name=ontokit-worker --format '{{.ID}} {{.Names}} {{.Status}} {{.Ports}}'
docker inspect ue6k0jr11r3t6pj3n9v15xkv --format '{{.HostConfig.RestartPolicy.Name}} {{.State.Running}}'
rg -n 'ontokit(-api)?\.dev\.openlegalstandard\.org' /data/coolify/proxy/dynamic /data/coolify/applications 2>/dev/null
```

### [P2] Secret-at-rest protections and rotation state are not evidenced

**Threat.** `.env` values are injected into both API and worker and are visible to host root/Docker API readers through container inspection. The encryption key protects GitHub tokens only if its own value remains secret; theft of both database ciphertext and `GITHUB_TOKEN_ENCRYPTION_KEY` yields the PAT. `SECRET_KEY`/`AUTH_SECRET` theft enables token/session forgery depending on their deployed uses. A long-lived Traefik basic-auth verifier can be cracked offline if the password is weak or the hash scheme is obsolete.

**Evidence.** The evidence exposes only key names—`SECRET_KEY`, `AUTH_SECRET`, `GITHUB_TOKEN_ENCRYPTION_KEY`—not values, generation method, age, permissions, or rotation (`.worker-reports/u6-evidence/dev-infra-compose-and-env.txt:50,84,134-137`). The Traefik hash is redacted, so algorithm and work factor cannot be assessed (`.worker-reports/u6-evidence/dev-infra-traefik-route.txt:22-26`). The UAT log says a `uatbot` credential is local and mode 600, with removal/rotation deferred (`docs/roundup-2026-08/DEV-UAT-LOG.md:194-196`). It also documents live `ZITADEL_*` secrets on the stale deployment (`...DEV-UAT-LOG.md:98-106`).

**Remediation.** Inventory owner, consumer, storage, creation date, and rotation trigger for each secret. Require randomly generated values (at least 256 bits for app/encryption/session secrets), root-owned `0600` files or a secret manager, no values in compose/repo/logs, and documented key-ring rotation for encrypted PATs (decrypt/re-encrypt before retiring the old key). Use bcrypt for Traefik basic auth with a high work factor and a random password; rotate/remove both `ontokit` and `uatbot` at U7 terminal. Restrict Docker socket/group membership and audit backups because volumes/config backups can join ciphertext with keys.

Needs live check:

```bash
stat -c '%a %U:%G %n' .env /data/coolify/proxy/dynamic/*ontokit* 2>/dev/null
docker inspect ontokit-api-1 ontokit-worker-1 --format '{{range .Config.Env}}{{println .}}{{end}}' | sed -E 's/(=.*)/=<redacted>/'
getent group docker
```

Inspect the unredacted basic-auth prefix locally (`$2y$`/`$2b$` expected for bcrypt) without copying the hash into the report. Confirm encrypted GitHub credential rows contain key/version metadata and perform a documented rotation drill.

### [P2] The evidence does not establish a complete listener inventory on either box

**Threat.** An unenumerated published port, host service, IPv6 listener, or old Docker proxy route can bypass the hostname gate exactly as F9 did. The MinIO console is explicitly configured on `:9001`; although it is not shown published, the supplied `docker ps` format is not a substitute for host-level socket and NAT enumeration. The proxy host may also have unrelated Coolify-published ports or routes.

**Evidence.** CPX41 evidence lists only the six OntoKit containers and reports host publication solely for `3000` and `8000`; Postgres `5432`, Redis `6379`, MinIO `9000`, and worker `8000` appear container-only (`.worker-reports/u6-evidence/dev-infra-compose-and-env.txt:138-144`). MinIO is commanded to listen on console port `9001`, but that port is absent from the captured `docker ps` line (`...dev-infra-compose-and-env.txt:31-44,144`). No `ss`, full `docker ps`, `iptables-save`, IPv6 rules, or proxy-box container/listener inventory is supplied. F9 proves that assumed firewall behavior was previously wrong (`docs/roundup-2026-08/DEV-UAT-LOG.md:150-169`).

**Remediation.** Capture and review complete IPv4/IPv6 listeners and Docker NAT/filter rules on both CPX41 and hetzner-dev. Ensure `5432`, `6379`, `9000`, and `9001` have no host publication; restrict SSH/admin ports by source; enumerate every Traefik router and backend. Repeat from an unrelated off-box scanner. Treat any listener not in the exposure map below as deny-by-default.

Needs live check (run on **each** box):

```bash
ss -lntup
docker ps --no-trunc --format '{{.ID}} {{.Names}} {{.Ports}}'
iptables-save
ip6tables-save
docker network ls
```

On CPX41 also run:

```bash
docker port ontokit-minio-1
docker inspect ontokit-minio-1 --format '{{json .HostConfig.PortBindings}} {{json .NetworkSettings.Ports}}'
```

### [P2] HTTP security headers and WebSocket origin/auth behavior are unproven

**Threat.** CORS is not an authentication control and does not protect non-browser clients. A missing/weak CSP increases the consequence of XSS because browser-held bearer/session tokens and suggestion actions can reach the write path. WebSockets require explicit origin and per-connection authorization; a broad proxy prefix merely forwards them. Public `/health` or OpenAPI can leak deployment/schema detail if the middleware is lost.

**Evidence.** API CORS is restricted to the DEV origin (`.worker-reports/u6-evidence/dev-infra-compose-and-env.txt:63-66`), which is appropriate but does not demonstrate middleware behavior or credential settings. Traefik applies basic auth to both the catch-all web router and API router, including `/ws`, `/health`, and `/openapi.json` (`.worker-reports/u6-evidence/dev-infra-traefik-route.txt:3-16,22-26`); live evidence confirms unauthenticated `/health` 401 and authenticated 200 after F9 (`docs/roundup-2026-08/DEV-UAT-LOG.md:164-165`). However, no response-header capture, CSP configuration, WebSocket handshake/origin test, or endpoint-level auth evidence is supplied. The explicit `/ws` prefix is broader than the observed client paths under `/api/v1/.../ws` and has no written need in the evidence.

**Remediation.** Keep `/health` and `/openapi.json` behind the DEV gate (or expose only a content-free liveness endpoint if monitoring requires it). Remove the standalone `/ws` route unless a concrete endpoint requires it. Enforce application authorization on every WebSocket handshake even behind basic auth, validate `Origin` against the DEV origin, cap message sizes/rates, and avoid query-string bearer tokens. Add CSP (`default-src 'self'`, narrow `connect-src` for HTTPS/WSS, nonce/hash-based scripts), HSTS, `frame-ancestors 'none'`, `nosniff`, and a restrictive referrer policy at one documented layer.

Needs live check:

```bash
# Run from an authorized test client; do not place credentials in shell history.
curl -sSIk https://ontokit.dev.openlegalstandard.org/ | sed -n '/^content-security-policy:/Ip;/^strict-transport-security:/Ip;/^x-content-type-options:/Ip;/^referrer-policy:/Ip'
```

Use a WebSocket client to test the deployed lint/collaboration endpoints with (1) no basic auth, (2) basic auth but no app token, and (3) a hostile `Origin`; all three must fail unless explicitly intended.

### [P2] The entire DEV standup is scope-to-record

**Threat.** Infrastructure created without a written requirement/owner/lifecycle tends to persist as shadow production: stale routes, retained secrets, unowned firewall rules, and ambiguous teardown. F6 is a direct example of that failure mode.

**Evidence.** The reviewed DEV compose, proxy routes, credentials, firewall rules, CPX41 deployment, and live data were built before their retrospective capture; the UAT log repeatedly defers formal IaC to U12 (`docs/roundup-2026-08/DEV-UAT-LOG.md:69-77,98-114,150-169,187-196`). The later plan describes the running server-side compose as existing today and says U12 will capture it later (`docs/plans/2026-08-08-001-feat-ontokit-roundup-execution-plan.md:101-103`). Under the binding anti-ratification rule, this is not implicitly endorsed merely because it worked.

**Remediation.** Record the DEV standup as explicit scope with owner, purpose, data classification, approved hostnames/IPs/ports, auth modes, allowed GitHub targets, secret owners, backup/retention, teardown date, and rollback. U12 must import the observed live state into reviewed IaC and reconcile drift; it must not merely describe a desired replacement while leaving hotfix state unmanaged.

## 1. Exposure map

### CPX41 `ontokit-dev` (`178.156.208.239`)

| Surface | Binding shown by evidence | Intended/current gate | Status from evidence |
|---|---|---|---|
| Web `3000/tcp` | `0.0.0.0:3000` and `[::]:3000` -> container | DOCKER-USER permits proxy `204.168.246.227`, drops other externally addressed traffic; Traefik basic auth in front | **Closed at recorded time**, based on external refusal plus proxy 401/200 verification (`dev-infra-compose-and-env.txt:124,139-141`; `DEV-UAT-LOG.md:150-169`). Drift/IaC risk remains. |
| API `8000/tcp` | `0.0.0.0:8000` and `[::]:8000` -> container | Same DOCKER-USER source gate; Traefik basic auth | **Closed at recorded time**, including raw external refusal and authenticated `/health` 200 (`DEV-UAT-LOG.md:150-169`). IPv6 rule parity is not evidenced. |
| Worker `8000/tcp` | Container port only; no host mapping shown | Docker bridge only | **Not host-published in supplied snapshot** (`dev-infra-compose-and-env.txt:139`). Full host/NAT inventory still needed. |
| Postgres `5432/tcp` | Container port only; no host mapping shown | Docker bridge only; weak/default credentials | **Not host-published in supplied snapshot** (`dev-infra-compose-and-env.txt:2-18,143`). No DB TLS; internal trust is weak. |
| Redis `6379/tcp` | Container port only; no host mapping shown | Docker bridge only; no ACL/password evidenced | **Not host-published in supplied snapshot** (`dev-infra-compose-and-env.txt:20-29,142`). Internal compromise path remains. |
| MinIO API `9000/tcp` | Container port only; no host mapping shown | Docker bridge only; root credential used by app; internal plaintext | **Not host-published in supplied snapshot** (`dev-infra-compose-and-env.txt:31-44,58-62,144`). |
| MinIO console `9001/tcp` | Service command listens on `:9001`; no published mapping shown | Docker bridge presumed | **Not proven host-exposed, but under-evidenced** (`dev-infra-compose-and-env.txt:31-44,144`). Requires `ss`/`docker inspect` live check above. |
| Docker bridge `ontokit` | All six services attached | Docker network membership | **Internal only by design**, but flat network means any workload can reach stateful services (`dev-infra-compose-and-env.txt:18,29,44,75,103,125-128`). |
| Host SSH/admin/other listeners | Not enumerated | Unknown | **Unknown**; needs full `ss`/firewall inventory. |

### hetzner-dev proxy/Coolify box (`204.168.246.227`)

| Surface | Binding/routing shown by evidence | Intended/current gate | Status from evidence |
|---|---|---|---|
| HTTP `80/tcp` for `ontokit.dev...` | Traefik `http` entrypoint | Permanent HTTPS redirect | **Configured** (`dev-infra-traefik-route.txt:17-21,27-30`); listener/firewall not independently inventoried. |
| HTTPS `443/tcp` web catch-all | TLS router to CPX41 `:3000` | `ontokit-dev-auth` basic auth | **Closed to unauthenticated users at recorded time** (`dev-infra-traefik-route.txt:3-9,22-26,31-35`; `DEV-UAT-LOG.md:187-196`). |
| HTTPS API `/api/v1`, `/ws`, `/health`, `/openapi.json` | TLS router to CPX41 `:8000` | Same basic auth | **Closed to unauthenticated users at recorded time** (`dev-infra-traefik-route.txt:10-16,22-26,36-39`; `DEV-UAT-LOG.md:164-165`). Endpoint-level WebSocket/auth behavior unproven. |
| Stale `ontokit.dev...` web (`hlcjgyv9z…`) | Former Coolify router/container | Stopped; restart set `no` | **Closed at recorded time, reversible** (`DEV-UAT-LOG.md:187-196`). App record remains. |
| Stale `ontokit-api.dev...` API (`ue6k…`) | Former public Coolify route | Stopped; restart set `no` | **Closed at recorded time, reversible** (`DEV-UAT-LOG.md:98-107,187-196`). Retained credentials require rotation/decommission decision. |
| Stale `ontokit-worker` | Container, no public route described | Stopped; restart set `no` | **Stopped at recorded time** (`DEV-UAT-LOG.md:187-193`). |
| Coolify admin, Docker-published ports, SSH, other wildcard routers | Not enumerated | Unknown | **Unknown**; needs full box listener/router inventory. |

No remaining **proven** public exposure of Postgres, Redis, MinIO API, or MinIO console appears in the supplied snapshot. That is a bounded statement: the evidence is not a complete listener/NAT inventory, so it cannot certify absence.

## 2. Secrets register

| Secret/credential | Storage/consumers evidenced | Weakness / likely leak if repo or config becomes public | Rotation need |
|---|---|---|---|
| Postgres superuser `POSTGRES_PASSWORD=postgres` | Literal compose environment; Postgres | Public/default; full cluster control from reachable container/network | **Immediate**; replace and stop using superuser from app/init after provisioning. |
| App DB `ontokit:ontokit` | Literal API/worker DSNs | Public/default; application DB read/write; exact privilege unknown | **Immediate**; unique generated password and least-privilege role. |
| MinIO root `minio` / `minio123` | Literal MinIO, API, worker environments | Public/default; root/admin object-store access; leaks directly with compose | **Immediate**; rotate root and issue bucket-scoped service credential. |
| Redis credential | None evidenced | No authentication/ACL; any `ontokit` network peer can access queue/cache | **Immediate configuration change**; create ACL/password and update API/worker. |
| `SECRET_KEY` | `.env` -> API/worker; value withheld | Plain container env; strength/age unknown; may derive crypto/signing behavior | **Verify now**, rotate if default/short/reused or exposed; document impact and overlap window. |
| `AUTH_SECRET` | `.env` -> API/worker/web via shared env file; value withheld | Plain container env; scope may be broader than necessary; session/token forgery if stolen | **Verify now**; generate 256-bit unique secret and rotate sessions if exposure suspected. |
| `GITHUB_TOKEN_ENCRYPTION_KEY` | `.env` -> API/worker; also existed in stale API env | Key co-resides with application that reads encrypted PATs; stale copy expands exposure; rotation/versioning unproven | **Rotate after stale-app disposition**, re-encrypt stored PATs, retain old key only for bounded migration. |
| GitHub mirror/PAT credential(s) | Apparently encrypted in DB and decrypted/selected by API paths; actual value/scope withheld | Blast radius unknown; no common target authorizer yet; may leak if DB + encryption key or host/container env are obtained | **Immediate scope audit**, then rotate to fine-grained/App credential after authorizer deployment. |
| Traefik `ontokit` basic-auth password/hash | Hash in server-side dynamic config; hash redacted | Repo/config publication leaks offline verifier; algorithm/cost/password entropy unknown | **Verify algorithm/strength now**; rotate at auth-mode transition and on any config exposure. |
| Traefik `uatbot` basic-auth credential | Local dev-box file, reportedly mode 600 | Temporary shared automation credential; expiry not enforced by evidence | **Remove or rotate at U7 terminal** as already recorded; give a named expiry now. |
| `ZITADEL_SERVICE_TOKEN` and other `ZITADEL_*` secrets | Stale Coolify API container env; current DEV values not shown | Retained in stopped container/app records; service-token permissions/expiry unknown | **Rotate/revoke stale values now**; create short-lived DEV-specific credentials during auth-enabled standup. |
| `DATABASE_URL`, `MINIO_SECRET_KEY` in stale Coolify app | Stopped container/app environment | Secrets remain recoverable through Docker/Coolify records and backups | **Rotate if shared with any surviving service**; otherwise revoke/delete during decommission. |
| TLS private key / ACME state | Traefik/Let's Encrypt implied; storage not supplied | Host/root compromise permits site impersonation; backup/permissions unknown | **Needs inventory**, normal automated renewal; revoke if proxy compromise is found. |

The `.env` key list is incomplete evidence of actual runtime values. No value is assumed safe merely because it is withheld from this review.

## 3. GitHub write-path blast radius

### Observed path

1. Under `AUTH_MODE=disabled`, the application supplies a full-access DEV principal (`dev-infra-compose-and-env.txt:63,120`; `DEV-UAT-LOG.md:3-8`). Before the two network fixes, any internet user could become that principal; those specific ingress paths are recorded closed.
2. Suggestion save resolves a contributor-facing commit identity (`api-fixround-code.diff:1419-1426,1577-1587`). This is attribution, not authentication to GitHub and not a restriction on remote targets.
3. Submit creates a PR; the live Phase A test proves PR #3 was opened (`DEV-UAT-LOG.md:171-175`). Thus the deployed API has a functional outbound GitHub credential.
4. Review/approve calls `PullRequestService.merge_pull_request(..., suggestion_review_authorized=True)` after `SuggestionService` authorization (`api-fixround-code.diff:990-1017,1506-1528`). This repaired a correctness failure, but intentionally bypasses the PR service’s owner/admin role check. The safety of that privileged internal flag therefore rests entirely on every caller and on the GitHub credential’s external scope.
5. Credential acquisition is fragmented. The plan identifies mirror resolution, `_get_github_token`, PR Party, sync, bare push, and webhook PAT decryption as separate mutation seams and states the common target-authorizer is future work (`docs/plans/2026-08-08-001-feat-ontokit-roundup-execution-plan.md:101-106,240-247`).

### Blast-radius assessment

| Compromise/caller | Present effective capability evidenced | Upper bound not established |
|---|---|---|
| Anonymous internet user | **Currently blocked at recorded time** by Traefik basic auth and raw-port source filtering | Controls can drift; application itself remains full-access while auth is disabled. |
| Holder of shared basic-auth credential | Can reach all web/API routes forwarded by the proxy; app treats auth-disabled requests as DEV principal | Which projects/repos that principal can mutate; no per-human attribution at ingress. |
| API/worker RCE or Docker/env read | Can obtain encryption key and potentially decrypt stored GitHub PATs; can access flat-network state services | GitHub token repo/org scope, admin/webhook/workflow permissions, expiry. |
| Suggestion reviewer/auto-accept path | Can invoke the privileged merge call after SuggestionService authorization | No evidence that the resulting GitHub client is constrained to the project’s configured repository. |
| Misconfigured demo/live project or malicious DB row | Current fragmented writers may trust project/integration target data | Deny-by-default target allowlist does not yet exist. |

The separation between `commit_identity` and `mirror_credential` is conceptually sound: author attribution must never select or widen the credential. The supplied evidence, however, only proves the identity call sites and a successful PR; it does not prove bot-committer metadata, token type/scope, target validation, webhook credential handling, or per-path convergence. Those are security gates, not documentation niceties.

## Verdict

**Not acceptable as a durable or unattended public DEV posture; conditionally tolerable only as a short-lived, actively monitored UAT environment while the recorded gates remain verified.** The original auth-disabled hostname exposure, Docker raw-port bypass (F9), and stale ungated Coolify route (F6) are supported as closed at the end of the supplied log: unauthenticated hostname requests return 401, off-box raw `:3000`/`:8000` requests are refused, authenticated health succeeds, and the stale triad is stopped with restart disabled. I do not re-report those closed incidents as new vulnerabilities. The remaining posture is still high risk because the compensating ingress controls are unversioned hotfixes, service credentials are default-weak, stopped workloads retain live secrets, and the GitHub write token’s scope/target enforcement is unproven while the plan explicitly says the common authorizer does not yet exist. Keep `AUTH_MODE=disabled` only behind continuously tested network gates, rotate/default-harden secrets immediately, constrain the GitHub credential before further shared UAT, complete the two-box listener inventory, and record the entire DEV standup as owned IaC with an explicit teardown/terminal auth-enabled state.
