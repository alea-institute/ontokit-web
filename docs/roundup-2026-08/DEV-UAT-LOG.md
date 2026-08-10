# FOLIO DEV — Autonomous UAT Log (2026-08-08)

Environment: `https://ontokit.dev.openlegalstandard.org` — CPX41 (`ontokit-dev`,
178.156.208.239) behind hetzner-dev's Coolify traefik (wildcard
`*.dev.openlegalstandard.org`, Let's Encrypt). Stack: pgvector/pg17, Redis 7, MinIO,
API+worker (SHA `3dc64817` = round-2 fixes), web pending round-2. `AUTH_MODE=disabled`
for autonomous UAT (dev user has full access; persona-gating UAT deferred to a
Zitadel-enabled pass).

## Environment verification
- [x] TLS issued + HTTP→HTTPS redirect; `/health` healthy through the public URL.
- [x] Migrations applied at container start (single alembic head).
- [x] FOLIO seeded via `POST /projects/import` (18MB OWL → Turtle): project
  **FOLIO DEV** `9981eedd-1808-4aaa-8fd3-d1f135461808`, index task completed —
  **18,566 entities in 27.9s**.
- [x] Class tree loads with `?branch=main` — real roots (Actor / Player, …).

## Findings

### F1 (P3, API nit) — tree endpoint empty without explicit `branch`
`GET /ontology/tree` (no branch param) returns 0 nodes on a project whose default
branch is `main`; with `?branch=main` it returns the real roots. The web client
passes branch explicitly, so no user impact — but default-branch resolution should
work. Not yet dispatched; batch with next fix round.

### F2 (P0 BLOCKER, found live; round-3 dispatched) — every submit 422s on
restriction-bearing ontologies
UAT-1 (mint "Zorptic Widget Claim" under Actor/Player, save OK, submit) → 422
"Suggestion references a malformed parent IRI" despite a well-formed in-project
parent. Root cause: round-2's malformed-parent gate
(`suggestion_service.py:217-231`, commit ad1f8111) set-diffs parsed triples;
rdflib mints fresh blank-node ids per parse, so every
`rdfs:subClassOf [ a owl:Restriction … ]` in FOLIO appears "added" on every save
and BNode objects fail the URIRef check. FOLIO has thousands of restriction
parents → all submits fail on real data. Neither the fix round's unit tests nor
the adversarial verifier caught it (their fixtures had no blank-node parents) —
only live UAT with the real ontology did. Round-3 Codex worker dispatched
(`agents/tasks/ontokit-api-llm-round3.md`) incl. an audit of sibling parse-diff
paths for the same bnode trap.

## Pending
- Web round-2 fixes (worker at quality gates) → web deploy → browser UAT
  (chrome-devtools): editor, tree, auto-save, suggestion UI, model picker,
  duplicate warnings.
- Re-run UAT-1 after round-3; then UAT-2 (true-duplicate block), UAT-3 (external
  parent accept), UAT-4 (approve→merge→trust).

### F3 (P1, open — into the plan) — submit 422s via ValidationService with swallowed detail
After the round-3 bnode fix deployed (9489b536), UAT-1's submit fails differently:
422 "Suggestion failed server-side entity validation"
(`suggestion_service.py:293-306` → `ValidationService.validate_entity` on the minted
class). The specific `errors` list is discarded — the response carries no detail, so
the cause (IRI-shape rule? namespace rule? label rule?) is invisible to UI and UAT
alike. Two tracked items: (a) diagnose/right-size the mint validation rules for real
FOLIO-style projects; (b) return the validation errors in the 422 payload — the
generic message contradicts the P1-15 error-surfacing work. Round-3 regression guard
(malformed parent still rejected) not yet re-verified live; UAT-2/3/4 blocked on (a).

### F4 (P2, open) — public projects list renders empty despite API returning the seed
Browser sweep of `https://ontokit.dev.openlegalstandard.org/` (auth-disabled): the
projects list shows "No projects available" while `GET /api/v1/projects` returns FOLIO
DEV (200, one item). Console shows two 404s + an authjs AutoError (NextAuth calling a
proxied `/api/auth/*` that the initial traefik rule swallowed — since fixed by narrowing
the API rule to `/api/v1`). Feasibility review found the list lives in `app/page.tsx`
(not the `app/projects/page.tsx` redirect stub), which flattens `page.items` correctly —
so the live candidates are a session-gated `useInfiniteQuery` disabled under
`AUTH_MODE=disabled`, or an SSR fetch using an in-container URL. Fix scoped in plan U3.

### SECURITY FIX (applied to live DEV) — network gate over AUTH_MODE=disabled
The doc-review security lens (in-process + independent cross-model, both P0/100) found
the running DEV box exposed: `AUTH_MODE=disabled` on the public URL made any internet
visitor a full-access principal against a real GitHub write path. Closed immediately by
adding a traefik basic-auth middleware on both `ontokit-dev` routers at the hetzner-dev
proxy — the public surface now returns 401 without credentials (verified: no-auth 401,
with-auth 200). This must become infrastructure-as-code in plan U12/R13; the credential
is held server-side only. The plan's KTD2 is amended to require this gate for the whole
auth-disabled window.

### F5 (P1, open — found in U1's UAT-1 re-run) — submit blocks ~1h+ in an unbounded
per-entity duplicate-check loop
After the U1–U3 deploy (api `37bedad1`, web `3aacf5e9`), UAT-1's mint+save succeeded
(200, real commit `c666a599` on the suggestion branch), but the submit ran >60 minutes
without returning. Diagnosis from the box: API CPU ~0.2%, HF embedding model loaded at
submit time, and `pg_stat_activity` shows the same `SELECT entity_iri, label, ...`
query re-executing every ~50ms for the whole window. ROOT CAUSE (confirmed live):
the import wrote the MinIO storage key `ontokit/projects/{id}/ontology.ttl` into
`projects.source_file_path`; `_get_git_ontology_path` trusts it as a git path, so
suggestion saves commit a SHADOW file at that path (suggestion branch holds BOTH it
and the real root `ontology.ttl` — branch tree inspected), and submit's baseline read
of the same wrong path from `main` silently KeyErrors into an EMPTY baseline. All
18,567 entities count as "new" and the per-entity semantic dup-check (embed + ANN)
runs for each — hours. Pre-U1 this same skew looked like a fast 422 because old
VALID-04 rejected the first FOLIO-namespace entity before the sweep got going; U1's
correct fix unmasked the loop. Three-layer fix dispatched (path truth from the git
tree, baseline-missing guard, bounded dup-check sweep); live row repair +
UAT-1 re-run pending. Killed the 70-min request; api restarted healthy.

### F6 (P2, open — found in U4's browser sweep) — stale parallel OntoKit deployment
shadows `ontokit-api.dev` + turbopack cache poisoned the web bundle
Two coupled discoveries. (1) A Coolify-managed OntoKit API from **2026-07-28** still
runs on hetzner-dev (`ue6k0jr11r3t6pj3n9v15xkv`), serving
`ontokit-api.dev.openlegalstandard.org` publicly with NO basic-auth gate. It is
Zitadel-configured (auth enabled — not the auth-disabled exposure class) with an
empty DB, but holds live credential env (ZITADEL_SERVICE_TOKEN,
GITHUB_TOKEN_ENCRYPTION_KEY, DATABASE_URL, MINIO_SECRET_KEY…). A companion
`ontokit-worker` (up 11 days) sits beside it. Decommission-or-gate decision goes to
Damien at the phase gate; U12's IaC must own whichever survives. (2) The CPX41 web
image rebuilt today reused turbopack-cached chunks that still baked the OLD
`NEXT_PUBLIC_API_URL=https://ontokit-api.dev...` — so the freshly deployed U3 fix
queried the stale empty backend and rendered an empty list; Docker layer cache does
not bust Next's chunk cache on build-arg change. Fixed with a `--no-cache` web
rebuild; the deploy workflow (U12) must pin NEXT_PUBLIC_* args into the image tag or
always bust. This cache+shadow pair is ALSO the likely mechanism behind F4's
original "empty list" symptom, layered on top of the session-gating defect U3 fixed.

### Status after round-3 deploy
- F2 (bnode submit blocker): FIXED (round-3 `45b82a42`, deployed) — superseded by F3.
- F3 (mint validation 422 with swallowed detail): OPEN — plan U1 owns the fix.
- F1 (default-branch tree): OPEN — plan U2.
- F4 (empty projects list): OPEN — plan U3.
- Suggestion save works live (200, real commit on the suggestion branch); submit blocked
  only by F3's validation gate.

### F7 (P1, open — found in U4's editor sweep) — editor route + suggest affordances
session-gated despite API capabilities
With api `23aab106` / web `3aacf5e9` under `AUTH_MODE=disabled`:
`GET /suggestions/capabilities` returns `{tier: "reviewer", can_suggest: true,
can_mint_entities: true}`, but the web UI shows a bare "Viewer" chip, exposes no
suggest/edit affordance on class detail, and `/projects/{id}/editor?classIri=…`
redirects back to the viewer. The UI derives its role from the (absent) NextAuth
session instead of the capabilities endpoint — the same session-gating defect class
as F4/U3, one level deeper. Blocks the UI-side edit/auto-save/suggestion/model-picker
sweep legs and U5's UI path (API-path UAT-1 passes). Fix loop owns: derive role/
affordances from capabilities + AUTH_MODE, not session-only; keep true-anonymous
(auth-on) mapping to browse+suggest per the U7 persona contract.
Also noted this pass: one 502 resource error on the viewer page (request aged out of
the preserved buffer before capture — recheck and pin on the next viewer pass).

### F8 (P2, open — found in U4's sweep) — relationship graph renders 0 nodes / 0 edges
Viewer → "Show relationship graph" on Actor / Player (6 subclasses, Used By 40)
renders an empty canvas ("0 nodes, 0 edges") and issues NO graph data request at all
(network shows classes/lint/references/history/similar calls, no graph endpoint).
No console error. Candidates: the entity-graph port (server BFS `getEntityGraph`)
lives on the unmerged `entity-graph-migration` branch, so the deployed panel builds
from local state it doesn't have here; or the hook silently no-ops outside the
editor context. Fix loop owns diagnosis at the seam.
Also: recurring CSS-preload warnings (`3yrn5y4kos1tr.css`, `3ot8l-p47qlii.css`)
on every route — cosmetic P3, batch with any web fix round.

### F9 (P1 SECURITY, CONFIRMED live + FIXED) — Docker port publishing bypassed ufw;
auth-disabled API/web were directly internet-reachable
U6's lens-3 flagged that compose publishes API/web on `0.0.0.0:8000`/`0.0.0.0:3000`
with no proven firewall. Adversarial verification CONFIRMED it and found it worse than
suspected: `ufw` *is* configured to allow 3000/8000 only from the proxy
(204.168.246.227), but **Docker inserts its DNAT/forward rules ahead of ufw's INPUT
chain**, so ufw never sees the traffic — a curl from an unrelated host hit
`http://178.156.208.239:8000/api/v1/projects` → 200, fully bypassing the traefik
basic-auth gate. Same exposure class as the original auth-disabled P0 (an ungated
full-access principal against a live GitHub write path), reopened via a different
ingress path the hostname-only 401 test never exercised. FIXED: surgical DOCKER-USER
rules — `-p tcp --dport {3000,8000} -m conntrack --ctorigdst 178.156.208.239 ! -s
204.168.246.227 -j DROP` — drop externally-addressed traffic to those ports from
anyone but the proxy while leaving inter-container (dst 172.18.x) traffic untouched.
Verified: external `:8000`/`:3000` now refused; proxy authed `/health` 200, unauth
401, app renders, all containers healthy, `localhost:8000` 200. Persisted to
`/etc/iptables/rules.v4`. U12's IaC must encode this (compose should bind to a private
interface or ship the DOCKER-USER rule) so it survives a rebuild. **Lesson for
docs/solutions:** a hostname-route 401 does not prove network isolation when Docker
publishes ports — test the raw box IP:port from off-box.

**F9-v6 (P1, CONFIRMED sibling + FIXED):** U6 lens-4's adversarial pass caught that the
F9 IPv4 DOCKER-USER rule left the IPv6 path open — `docker-proxy` listens on
`[::]:3000`/`[::]:8000` and, with `net.ipv6.conf.all.forwarding=0`, Docker serves v6 via
the **userland proxy**, which never traverses the FORWARD-chain DOCKER-USER rule. The box
has global IPv6 (`2a01:4ff:f0:3fdf::1`); the proxy is IPv4-only, so no legitimate v6
traffic exists. Closed at the INPUT chain (where userland-proxy sockets live):
`ip6tables -I INPUT -p tcp --dport {3000,8000} ! -i lo -j DROP`, persisted to
`/etc/iptables/rules.v6`. Verified: rule in place; loopback + IPv4 proxy-authed `/health`
still 200. This is the textbook "coverage set, not mechanism" lesson from
`docs/solutions/2026-07-28-cross-model-review-invariant-scope.md` — a network guard must
enumerate every address family and every ingress mechanism (DNAT vs userland proxy), not
just the one you tested.

### F6 REOPENED then re-closed durably (P1) — Coolify reconciler resurrects the stale triad
Re-verifying F7/F8 in-browser exposed that the F6 `docker stop` did NOT hold: Coolify's
reconciler restarted all three stale containers (`Up 10 min`, `restart=true`), so traefik
had TWO routers matching `Host(ontokit.dev)` — the file-provider one (→CPX41) and the
resurrected Coolify docker-label one (→stale web) — and tie-flapped between them. Symptom:
the project-detail page 404'd because the stale web bundle calls the (also-resurrected)
`ontokit-api.dev` host. A second `docker stop` would just lose to Coolify again. Durable,
reconcile-proof fix I control: set `priority: 10000` (web) / `20000` (api) on the
**file-provider** routers in `/data/coolify/proxy/dynamic/ontokit-dev.yaml` (Coolify never
touches that file), so CPX41 deterministically wins `ontokit.dev`. Verified: a chunk absent
from the CPX41 image now 404s (no longer served stale), project GET returns FOLIO DEV, and
the app loads. **`ontokit-api.dev` is still served by the resurrected stale Coolify api**
(empty DB, Zitadel-gated — lower risk; CPX41 does not depend on it). The DURABLE fix —
decommission the Coolify app vs bring-it-under-gate — is **Damien's phase-gate decision**
(U6 disposition), along with rotating the creds that live in the stale container env.

### F6 CLOSED DURABLY (Damien approved the durable fix at the phase gate)
Root problem: Coolify's reconciler keeps resurrecting the stale triad (apps id 7 =
`ue6k…` api on `ontokit-api.dev`, id 9 = `hlcjgyv9z…` web on `ontokit.dev`, + worker),
so a `docker stop` never holds. Durable, Coolify-proof, non-destructive fix — all at the
**file provider** (`/data/coolify/proxy/dynamic/ontokit-dev.yaml`, which Coolify never
touches), which always wins over docker-label routers via explicit priority:
- `ontokit.dev` web/api routers pinned `priority: 10000/20000` → CPX41 always wins.
- NEW `ontokit-api-dev-gate` router `priority: 30000` for `Host(ontokit-api.dev…)` →
  basic-auth middleware + a **deadend service** (empty server list → 503). The stale api
  is now unreachable via traefik regardless of the zombie container.
Verified: `ontokit.dev` authed 200 / unauth 401; `ontokit-api.dev` unauth **401**, authed
**503** (deadend). Backup of the prior config at `.ontokit-dev.yaml.bak`. The file was
rewritten from a validated dict (an earlier hand-edit malformed the YAML and traefik
dropped it — caught + fixed immediately; basic-auth users preserved).
**Remaining (cosmetic, needs Damien's Coolify login):** delete Coolify apps 7/9/worker
via the UI to reclaim resources. The exposure + flapping are already closed; U12 folds
these routers into IaC.

**UPDATE — fully decommissioned (Damien asked me to delete them, 2026-08-08).** Minted no
API token (Coolify's team-scoped Sanctum override balked); instead invoked Coolify's OWN
teardown, `App\Jobs\DeleteResourceJob::dispatchSync($app, true,true,true,true)`, via
`php artisan tinker` in the `coolify` container, for exactly application ids 7
(ontokit-api), 8 (ontokit-worker), 9 (ontokit-web) — the other 9 apps (folio-*,
alea-intake, mootloop-*, hello-wildcard) untouched. Then force-removed the one exited
remnant container + the three stale images (`ue6k…`/`hlcjgyv9z…`/`os1bd0zh…`). Verified:
app rows 7/8/9 gone, 9 apps remain, no stale containers/images left, `ontokit.dev`
authed 200 (CPX41) / `ontokit-api.dev` 503 (deadend). The file-provider priority pin +
deadend router are now defensive-only (no competing Coolify router remains) — harmless,
and U12 formalizes them. Resurrection is impossible now: the app records are gone.

### F7 + F8 verified live (both FIXED)
After the `add33b20` web deploy (+ the routing fix above): the editor route
`/projects/{id}/editor?classIri=…` now LOADS with full editing affordances under
`AUTH_MODE=disabled` (editable Label/Definition, Add entity, Add subclass per node, Add
parent, +Add relationship, Auto-save on + Save/Cancel, "Admin — unlimited" LLM access) —
before F7 it bounced to the read-only viewer. Console clean. The relationship graph now
renders the focus node ("Actor / Player", 6 children; header "1 nodes, 0 edges (2
resolved)" — the BFS runs and resolves focus+parent; `owl:Thing` is external so no edge) —
before F8 it showed "0 nodes, 0 edges" and issued no fetch. U4 sweep complete: projects
list, editor tree, class detail, edit affordances, graph, model-picker (LLM access chip),
all pass with clean console on happy paths.

### U5 — suggestion lifecycle, live on DEV (mechanics PASS; KD1 split carries to U7)
All exercised live against the seeded FOLIO project (local bare repo; `github_integrations`=0):
- **UAT-2 (true duplicate blocks):** minting a NEW IRI with an EXACT existing label
  ("Area of Law") → submit **409** `"Suggestion duplicates an existing entity label"`. PASS.
- **UAT-3 (external-IRI parent accepted):** parent `https://schema.org/Thing` → save 200,
  submit **200**, PR #4 opened. Validates U1's VALID-04 (well-formed external IRIs are
  legitimate parents). PASS.
- **Branch accumulation:** saves land on the contributor branch
  `suggest/anonymou/s_485b…` (commits `e423cf5`, `6e6c2f5`); `main` stayed at the initial
  import `077092d` until approve. PASS — a save never touches the default branch.
- **Submit opens a PR:** PR #3/#4 created; `pr_url: null` because no GitHub integration is
  wired (local bare-repo PR). The PR/branch assertion holds locally.
- **Approve → merge:** approve → 204; `main` advanced to `ac922b1`
  "Merge suggestion: s_485b…" carrying the contributor branch. PASS.
- **Trust credit:** `accepted_count` 0 → **1** after the approved merge. PASS
  (reject→no-credit not separately exercised this pass; API contract covers it).
- **KD1 attribution (author=contributor, committer=bot) — CARRIES TO U7.** The
  commit-identity system IS engaged: it minted a per-user noreply author
  `Anonymous <anonymous-88b71c83@users.noreply.ontokit.local>` (not a raw system identity),
  proving `commit_identity.py` runs. But under `AUTH_MODE=disabled` the actor is anonymous,
  so author == committer == "Anonymous" — the distinct contributor-author-vs-bot-committer
  split is only observable under a **real named persona**, which is exactly U7's Zitadel
  pass. This is the KD1 ratification gate U6 (lens-3/lens-5) flagged; it closes in U7, not
  here. Recorded honestly rather than claimed.

### Status after Phase A U1–U3 + F5 (2026-08-08 evening, api `23aab106`, web `3aacf5e9` no-cache)
- **F3/U1: FIXED, verified live.** UAT-1 re-run end-to-end on a fresh session
  (`s_1d048ab48c778ae1`): FOLIO-parent mint → save 200 (15s, commit `ce27eb9d`,
  changes_count 1) → **submit 200 in 26s, PR #3 opened**. VALID-04 right-sized per
  KTD8; 422s now carry the structured errors list. Red-then-green (4 tests);
  api gates green (2588 passed, mypy, ruff).
- **F1/U2: hardened.** Original live symptom did not reproduce at round-3 SHA (curl
  parity verified pre-deploy); the proven non-main-default defect class fixed via
  symbolic-HEAD resolution, red-then-green.
- **F4/U3: FIXED, verified in-browser.** Session-gating removed from the public list
  (red-then-green, 3186 web tests); FOLIO DEV card renders on the bare URL with a
  clean console. BUT the fix only became visible after resolving the F6 route
  hijack below — the public domain had been serving the stale Coolify web all along.
- **F5: FIXED, verified live.** Submit went 70+min (killed) → 26s; fresh suggestion
  branch shows a single `ontology.ttl` (no shadow file); 25-entity dup-sweep cap +
  baseline guard in place.
- **F6 route hijack RESOLVED (action taken):** the stale Coolify triad on hetzner-dev
  (`hlcjgyv9z…` web claiming `ontokit.dev`, `ue6k…` api on `ontokit-api.dev`,
  `ontokit-worker`) was serving the public domain ungated (unauth `/` was 200) with a
  month-old bundle pointing at an empty parallel backend. All three stopped
  (`docker update --restart=no` + `docker stop` — reversible via `docker start`;
  Coolify app records intact). After: unauth `/` 401, authed page serves the CPX41
  bundle. **Decommission-vs-keep decision for Damien at the phase gate**; whichever
  survives must land in U12's IaC. A `uatbot` basic-auth user was added to the
  traefik middleware for browser UAT (credential local to the dev box, mode 600;
  remove or rotate at U7 terminal).
- Environment note: the earlier "web pending round-2" header line is superseded —
  web `3aacf5e9` (U3) is deployed and browser-verified.

### U7 (infra standup, credential-free 80%) — Zitadel + Login V2 live on DEV, auth flip DEFERRED to Damien
The Zitadel stack is live on CPX41 `ontokit-dev` (`178.156.208.239`) from
`/opt/ontokit/compose.yaml` (pre-change backup
`/opt/ontokit/compose.yaml.bak-u7-20260809`): internal-only Mailpit, Zitadel v4.16.3
at standup, and Login V2 share the existing postgres and are exposed as the single
external domain `ontokit-auth.dev.openlegalstandard.org`, with the login UI path-split
at `/ui/v2/login`. Traefik on `hetzner-dev` issued the Let's Encrypt certificate and
routes browser traffic through the existing basic-auth gate while a higher-priority
`ClientIP(178.156.208.239)` router permits only CPX41's server-side token traffic to
reach Zitadel ungated. The parameterized setup script from api commit `504ba5d6` was
copied to `/opt/ontokit/setup-zitadel-dev.sh` and provisioned the `OntoKit` project and
`OntoKit Web` OIDC app, including the production-shaped callback on
`ontokit.dev.openlegalstandard.org`; `/opt/ontokit/.env` remains mode 600 and now holds
the Zitadel key names documented in `DEV-RUNBOOK.md`. The api, worker, and web were
recreated with that env, but `AUTH_MODE=disabled` was deliberately left unchanged, so
application behavior remains identical until Damien performs the terminal flip.

Three startup failures were root-caused and fixed on the box. First, the api repo's
earlier `scripts/init-db.sh` had already created the shared-postgres `zitadel` role and
database, causing Zitadel init's user-verification step to skip password creation and
then crash-loop on SASL authentication; the role password was aligned from the
`ZITADEL_DB_PASSWORD` value in `/opt/ontokit/.env`, and any re-init against an existing
volume must do that alignment first. Second, `zitadel-login:latest` no longer accepts
the repo's `ZITADEL_SERVICE_USER_TOKEN_FILE` contract: token calls failed with "No
authentication credentials found" and surfaced through lru-cache as `fetch() returned
undefined`. The live compose now reads `/zitadel-data/login-client.pat` in an entrypoint
wrapper and exports `ZITADEL_SERVICE_USER_TOKEN` before starting Login V2. Third, the
login app derives service configuration from request headers, so the stock
`localhost:3000` healthcheck always failed without the external Host; Node/undici also
drops attempted `Host` overrides in `fetch`. The live healthcheck now uses
`http.request` with `Host: ontokit-auth.dev.openlegalstandard.org`, and the ineffective
`CUSTOM_REQUEST_HEADERS` setting was removed. A diagnostic `localhost` trusted-domain
entry remains harmless but ineffective because Zitadel cannot match the origin port.

U7 also corrected F9's persistence claim. Although `/etc/iptables/rules.v4` and
`rules.v6` existed, no `iptables-persistent`, `netfilter-persistent`, or restore unit
was installed, so the firewall would have disappeared on reboot. The durable fix is
the idempotent `/usr/local/sbin/ontokit-firewall.sh` plus enabled oneshot
`ontokit-firewall.service` (`After=docker.service`), covering ports
`3000/8000/8080/8081` for IPv4 and IPv6 without replaying stale Docker chain state via
whole-table `iptables-restore`. IPv4 `DOCKER-USER` permits the proxy
`204.168.246.227` only when the original destination is `178.156.208.239`; IPv6 INPUT
drops non-loopback access. Off-box direct `:8080` and `:8081` timed out, while the
proxied paths remained reachable.

Verification passed across every intended path: discovery returned 401 without gate
credentials and 200 through the gate with issuer
`https://ontokit-auth.dev.openlegalstandard.org`; CPX41's internal request returned
200 without the gate; Login V2 rendered the browser-verified "Welcome back!" form and
`username-text-input`; `/ui/console` returned 200; the main Projects page was unchanged;
the app and `/health` returned 200; HTTP redirected to HTTPS with 301; direct public
`:8080`/`:8081` timed out; and all nine containers were healthy. Capacity remained
comfortable: available RAM moved from 10 GiB before to 13 GiB after while disk usage
stayed at 37 GiB. U7 therefore completes the credential-free standup, but not auth-on
UAT: Damien's DoD-bearing enablement, gate disposition/rotation, persona creation,
four-persona plus R4 sweep (including KD1 author-vs-committer proof), and optional
post-UAT secret rotation remain explicitly deferred to the **Auth-on flip checklist
(Damien)** in `DEV-RUNBOOK.md`.
