# Handoff — OntoKit U7 Zitadel standup (credential-free 80%, flip deferred)

**Date:** 2026-08-08 · **Repo:** ontokit-web (+ ontokit-api) · **For:** a fresh session executing U7's infra standup while Damien is away.

## Situation
Phase A U1–U6 + U5 are done and verified live (see `docs/roundup-2026-08/DEV-UAT-LOG.md` and `docs/residual-review-findings/2026-08-08-retrospective-alignment-review.md`). The Phase A gate was answered (ask `ontokit-web-2026-08-08-phase-a-gate`, retired). Damien's ruling on U7: **build the credential-free ~80% now, keep DEV auth-disabled, defer the terminal auth-on flip.** He is at dinner and cannot rotate the DEV auth-gate credential for a few hours.

## Do (autonomous, credential-free)
Per KTD9 (plan `docs/plans/2026-08-08-001-feat-ontokit-roundup-execution-plan.md`, U7):
1. Add the api repo's `zitadel` + `login` services to the **running server-side DEV compose** at `/opt/ontokit/compose.yaml` on the CPX41 box (SSH: `root@178.156.208.239` via `~/.ssh/hetzner_dev`). U7 edits the live compose; U12 later captures it into `deploy/compose.dev.yaml` — **U7 does NOT create that file.**
2. Override the imported dev defaults hardcoded to localhost: `ZITADEL_EXTERNALDOMAIN`, `EXTERNALSECURE`, `EXTERNALPORT`, and the four LoginV2/OIDC base URIs → the DEV hostname over TLS. Pick the login-UI route (own subdomain vs path prefix) **before** running `setup-zitadel.sh`.
3. Add a traefik route for the login UI in the **file provider** `/data/coolify/proxy/dynamic/ontokit-dev.yaml` (that file is the source of truth now — it carries the priority-pinned routers + the `ontokit-api-dev-gate` deadend; keep them). Rewrite it from a validated dict, never a hand-edit (a hand-edit malformed the YAML earlier — see the F6 log entry).
4. Parameterize `scripts/setup-zitadel.sh` (defaults to localhost + a sibling-checkout `.env`); harden the imported dev defaults — generated masterkey + admin password, shortened PAT expiries, suppressed secret echo.
5. Wire the web `ZITADEL_*` / `NEXTAUTH_*` from the server-side `.env`.
6. Run the standup; verify Zitadel + login come up healthy behind the existing basic-auth gate. Add a runbook section (feeds R13/U12).

## Do NOT (waits for Damien)
- Do **not** flip `AUTH_MODE` to enabled — DEV stays auth-disabled so his UAT isn't disrupted. The terminal auth-on flip + the final 4-persona sweep + the auth-on R4 sweep are the DoD-bearing steps and wait for his return.
- Do **not** rotate the DEV auth-gate credential — that's his action (he'll paste it).
- Do **not** delete the Coolify apps (id 7/9/worker) — that needs his Coolify UI login; the exposure is already closed at the file provider.

## Environment facts (verified 2026-08-08)
- CPX41 `ontokit-dev` 178.156.208.239: stack `/opt/ontokit/compose.yaml`, both fork clones at `/opt/ontokit/{ontokit-api,ontokit-web}` (detached at deployed SHAs). Deploy = push fork → box `git fetch`+`checkout` → `docker compose build`+`up -d`. **Web rebuilds MUST be `--no-cache` AND you must confirm no stale `ontokit-api.dev` chunks remain** (turbopack cache baked the old host once — F6). Grep the running image `.next/static` to confirm.
- Traefik on hetzner-dev (`root@178.156.208.239` for the CPX41 box; the proxy config lives on the hetzner-dev proxy box, editable as shown in the F6 log). Basic-auth users `ontokit` + `uatbot` in the file-provider middleware; `uatbot` credential is local at `~/.config/ontokit-dev/uat-basic-auth` (mode 600) — remove/rotate at the auth-on terminal.
- Firewall: F9 (IPv4 DOCKER-USER) + F9-v6 (ip6tables INPUT) rules persisted; do not remove them. U12 encodes them as IaC.
- Local API test infra: pg `127.0.0.1:5433`, redis `127.0.0.1:6380` (throwaway).
- Worker route: `agents/tier.json` `worker_route: codex` — Codex workers implement; orchestrator verifies. **Codex has no network / can't reach the box**, so the box edits are orchestrator (Claude) work; Codex handles repo-local code (compose-as-code, script parameterization, tests).

## Retire this handoff when
The Zitadel infra is up on DEV (auth-disabled, gated), the runbook section exists, and Damien has returned to do the auth-on flip + persona sweep (or explicitly redirected). The KD1 attribution proof (contributor-author vs bot-committer) completes in that persona sweep, closing the U5→U7 carry.
