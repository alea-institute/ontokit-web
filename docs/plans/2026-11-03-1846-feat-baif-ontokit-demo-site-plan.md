---
title: BAIF OntoKit demo site (Catholic Semantic Canon + FOLIO) - Plan
type: feat
date: 2026-11-03
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-brainstorm
execution: code
deadline: 2026-11-04 evening (demo Thursday 2026-11-05, Rome)
---

# BAIF OntoKit demo site (Catholic Semantic Canon + FOLIO)

## Goal Capsule

- **Objective:** By Wednesday evening, 2026-11-04, Damien can open a public demo URL at the Builder's AI Forum and show OntoKit end to end on the Catholic Semantic Canon and FOLIO: browse and search, suggest, review, then a commit on GitHub, plus LLM assist. Attendees reach the same site by QR code, browse read-only, and leave draft input he can review later.
- **Means:** Reuse the healthy Hetzner EU DEV stack. Serve it through a Cloudflare Tunnel at `damienriehl.com` subdomains, bypassing the saturated proxy box (KTD1), and push each ontology to a clearly labeled fork under `alea-institute` (KTD4).
- **Product authority:** Damien (product decisions below came from him on 2026-11-03). Technical choices follow the Planning Contract.
- **Stop conditions:** Stop the affected unit and report instead of improvising when any of these happens: a step would delete or reset DEV data without a verified backup; a credential not listed under Dependencies is needed; or FOLIO import fails twice at the memory ceiling in U7 (fall back to the Canon-only GitHub story and keep FOLIO read-only).
- **Execution profile:** Ship as several PRs on the alea-institute forks. Host operations run through SSH and the deploy forced command. The orchestrator runs every verification itself (Damien's 2026-09-30 call).
- **Open blockers (diagnosed 2026-11-03):**
  - **Proxy saturated.** `riehl-dev` (`204.168.246.227`, cx33) holds 250–390% CPU over the last 3 hours (Hetzner metrics API). SSH stalls at the banner exchange, and proxied HTTPS times out. It carries DEV's public ingress.
  - **SSH allowlist stale.** The EU box's firewall `ontokit-eu-migration` allows port 22 only from `174.20.225.162/32`, but the home box now egresses from `97.116.191.189`. The EU box itself is healthy at about 20% CPU.
  - **Two credentials needed from Damien** (see Dependencies).

## Product Contract

### Summary

Turn OntoKit DEV into a public demo, an "as it will work in production" replica. It hosts two GitHub-synced projects: the Catholic Semantic Canon and FOLIO. Damien drives the on-stage demo, and the site stays up afterward as the CDCF funding pitch site. A recorded walkthrough covers a network or server failure.

### Problem Frame

Production OntoKit for CDCF still needs funding, a domain, and hosting. Damien must show investors and builders at BAIF how the finished system works now. The existing public DEV name sits on `openlegalstandard.org`, whose DNS lives in Mike Bommarito's AWS account. Damien wants to avoid that dependency.

### Actors

- **A1 Damien (presenter, owner):** signed in. He reviews and approves suggestions, which commit to GitHub under his own identity. He is the only user who can call LLM features.
- **A2 Attendee (visitor):** anonymous. Arrives by QR code, browses read-only, and may submit draft input with an optional name and email.
- **A3 GitHub demo forks:** `alea-institute/semantic-canon-ontokit-demo` and `alea-institute/folio-ontokit-demo`. They receive approved changes.

### Key Decisions

- **Reuse EU DEV and spend nothing new.** (session-settled: user-directed — chosen over a dedicated Hetzner demo box at about €10–30 a month and over a laptop-local stack: no new cost and the fastest path.) Governs R10, R11.
- **Host at a `damienriehl.com` subdomain.** (session-settled: user-directed — chosen over openlegalstandard.org via Mike and over buying a CDCF domain: no Mike dependency, no spend, and it can move later.) Governs R11.
- **Visitors stay anonymous and drafts are optional.** (session-settled: user-directed — chosen over a shared guest login, Zitadel self-signup, and Google sign-in: lowest friction, and self-signup email is broken today.) Governs R3, R4, R5.
- **Sync both ontologies to GitHub.** (session-settled: user-directed — chosen over a read-only FOLIO import and over a FOLIO subset: FOLIO should show the same live flow as the Canon.) Governs R7, R8.
- **Use demo forks under alea-institute, named `*-ontokit-demo`.** (session-settled: user-directed — chosen over syncing to the real CatholicOS repo: keeps demo edits out of production suggestions.) Governs R7, R8.
- **Commits use Damien's identity through OntoKit's per-user token.** (session-settled: user-approved — chosen over a dedicated bot account: matches how production will work.) Governs R9.
- **Only Damien uses LLM features.** (session-settled: user-directed — LLM calls cost money; attendees get free manual features only.) Governs R6.
- **Keep the site up after BAIF as the pitch site.** (session-settled: user-approved — chosen over freezing it or tearing it down.) Governs R13.
- **The fallback is a recorded walkthrough video.** (session-settled: user-approved — chosen over a laptop-local stack and over hotspot-only.) Governs R14.

### Requirements

**Content**

- R1. The demo hosts two projects: the Catholic Semantic Canon, seeded from current `CatholicOS/ontology-semantic-canon`, and the full current FOLIO, both loaded completely and browsable.
- R2. Each project shows browse, search (including semantic search), the lineage graph, entity detail, quality and health checks, analytics, and the Turtle source view working on its real data.

**Visitor access**

- R3. Anonymous visitors can browse every demo project read-only without signing in.
- R4. A visitor can submit draft input on a class, meaning a proposed edit with a free-text note, without an account. Name and email are optional fields.
- R5. Visitor drafts never change an ontology or reach GitHub by themselves. They wait in a queue Damien can review, promote into a real suggestion, or discard. Abuse controls keep the queue usable during and after the conference.
- R6. Only Damien's account can invoke LLM features, under a monthly budget cap. Visitors never see LLM controls they cannot use.

**Live GitHub flow**

- R7. Each project pushes to its demo fork. When Damien approves a suggestion, its commit appears on the fork's `main` within about five minutes.
- R8. Each demo fork's README opens with a banner stating that it is an OntoKit demo, not the production ontology, and that its contents are not real Canon or FOLIO suggestions.
- R9. Commits on the demo forks show Damien as the approver and push with a GitHub token Damien himself issued, scoped to the two forks only.

**Hosting**

- R10. The demo runs on the existing Hetzner EU DEV stack and deploys from the alea-institute `dev` branches of ontokit-web and ontokit-api, which carry the LLM features.
- R11. The demo serves over HTTPS at a `damienriehl.com` subdomain, such as `ontokit-demo.damienriehl.com`, with working sign-in and sign-out for Damien on that hostname.
- R12. A printed or on-screen QR code opens the demo landing page, which names both projects and labels the site as a demo.
- R13. The site stays live after BAIF as the CDCF pitch site, and visitor drafts keep accumulating.

**Stage readiness**

- R14. A recorded screencast of the full demo script exists before Damien travels to the session and plays offline.
- R15. The demo script leads with the Canon: suggest, review, approve, then show the commit on the demo fork. It continues with LLM assist, the graph and search, quality and analytics, and closes with FOLIO's scale and the same GitHub flow.
- R16. The agent rehearses the whole R15 script against the hosted site in a real browser by Wednesday evening and records the evidence. Damien does not have to test it himself.

### Key Flows

- **F1 On-stage demo** (Covers R15, R7, R9, R6). Damien signs in, then opens a Canon entity. He makes a suggestion, approves it in review, and opens the demo fork to show the new commit. Next he shows LLM assist on an entity, then the graph and search, then quality and analytics. He switches to FOLIO, browses its scale, and repeats a short suggest, approve, and GitHub cycle.
- **F2 Attendee via QR** (Covers R12, R3, R4, R5). An attendee scans the QR code, lands on the demo page, and picks a project. They browse read-only, open an entity, and submit a draft with an optional name. They see a confirmation, and the draft enters Damien's review queue.
- **F3 Post-conference review** (Covers R5, R13). Damien opens the visitor-draft queue. He promotes useful drafts into suggestions, which then follow F1's review-to-GitHub path, or discards them.

### Acceptance Examples

- AE1 (Covers R3, R6). An anonymous visitor opens a Canon entity. The detail panel renders with no edit controls and no LLM buttons.
- AE2 (Covers R4, R5). A visitor submits "add a definition for X" with no name. The Canon on GitHub stays unchanged, and the draft appears in Damien's queue labeled "anonymous".
- AE3 (Covers R7, R9). Damien approves a suggestion on stage. Within five minutes (or right away, after a manual sync), the demo fork shows the commit.
- AE5 (Covers R5). Thirty attendees behind one conference NAT each submit a proposal within an hour, and none is rate-limited.
- AE4 (Covers R6). A non-owner account calls an LLM endpoint and gets a refusal with no provider spend.

### Scope Boundaries

- **Out of scope:** changes to the real `CatholicOS/ontology-semantic-canon` or the real FOLIO repo; production CDCF hosting; the openlegalstandard.org DNS fix; new spend; a laptop-local stack.
- **Deferred:** self-signup and social login for attendees; moving the demo to a CDCF domain once one exists; pulling GitHub-side changes back into OntoKit (the code only pushes outbound); comment-only drafts with no edit attached; proposing edits on properties and individuals; and repairing `riehl-dev`'s CPU saturation, which hosts other services and gets its own investigation.
- **Accepted risk:** DEV doubles as Damien's UAT box. Freeze routine deploys from now until after BAIF.

### Outstanding Questions

- **Resolve Before Planning:** none.
- **Deferred to Planning:** resolved below. Execution-time unknowns are listed under Open Questions in the Planning Contract.

### Sources

- DEV host, deploy command, and traps: memory `reference-dev-server`, and ontokit-web `docs/releases/eu-hosting-migration-receipt.md` (landed in #50, not on this branch).
- FOLIO import acceptance status (BLOCKED, no evidence): ontokit-api `docs/releases/oa-2-u9-acceptance.md`.
- LLM gating: ontokit-api `origin/dev:ontokit/api/routes/llm.py` (owner/admin configuration, member flags, budgets, rate limits).
- GitHub sync: ontokit-api `origin/dev:ontokit/api/routes/remote_sync.py` and `pr_party*.py`.
- API research dossier (read-only, origin/dev `7c0a1a05`): anonymous suggestions (`ontokit/api/routes/anonymous_suggestions.py`), GitHub push sync (`ontokit/api/routes/remote_sync.py`, one system `GITHUB_MIRROR_TOKEN`), LLM role gate (`ontokit/api/routes/llm.py`), the existing nightly-reset demo pipeline (`deploy/demo-mirrors.json`, `ontokit/core/demo_targets.py`, `ontokit/services/demo_target_authorizer.py`), and the graph endpoint present only on `origin/entity-graph-endpoint`.
- Web research dossier (origin/dev `4e0ed6a6`): anonymous proposal mode (`components/suggestions/CreditModal.tsx`, `lib/hooks/useAnonymousSuggestion.ts`, `lib/api/suggestions.ts`), LLM UI gate (`lib/hooks/useLLMGate.ts`), build-time auth args (`Dockerfile`, `next.config.ts`, `lib/env.ts`), and the #344 logout fix (`auth.ts` federated logout).
- Hetzner API readback on 2026-11-03: servers `riehl-dev` (cx33) and `ontokit-dev-eu` (cpx32), firewall `ontokit-eu-migration`, and both servers' CPU metrics.

## Planning Contract

### Key Technical Decisions

- KTD1. **Serve the demo through a Cloudflare Tunnel that starts on the EU box.** Run a `cloudflared` container inside the Compose network, routing `ontokit-demo.damienriehl.com` to the web and API services and `ontokit-demo-auth.damienriehl.com` to Zitadel and Login. This removes the saturated `riehl-dev` proxy from the path, opens no new inbound port, and Cloudflare handles TLS. `damienriehl.com` already uses Cloudflare nameservers, and a DNS token and tunnel credentials live in their established owner-only locations. Governs R11.
- KTD2. **Give the existing Zitadel instance a second domain instead of standing up a new identity stack.** Use the System API procedure the EU receipt already proved (a temporary IAM_OWNER system principal, removed afterward) to add the demo auth host as an instance domain. Register the demo web callback and post-logout URIs on the web application. Fallback if the domain will not resolve: create a fresh Zitadel instance in a new database for the demo, since only Damien needs to sign in. Governs R11, R6.
- KTD3. **Build drafts on the existing anonymous proposal flow, not a new table.** The API already stores anonymous sessions with an optional name, email, and client IP, and the review queue already renders them. The web only needs to show the note and offer an entry point from the viewer. Comment-only drafts are deferred. Governs R4, R5.
- KTD4. **Create ordinary public projects from the demo forks, and leave the existing `is_demo` mirror pipeline off.** That pipeline force-resets its repos nightly, blocks LLM configuration, and reserves `alea-institute/ontokit-demo-*`. Damien's `*-ontokit-demo` names fall outside its exact-pair list, so ordinary projects may target them. Never create a project from an upstream URL, because the push job would target CatholicOS or FOLIO. Governs R7, R8.
- KTD5. **Use one system `GITHUB_MIRROR_TOKEN`: a fine-grained PAT Damien mints, scoped to the two forks with contents read/write.** Per-user tokens can no longer be created (`user_settings.py`). Set `COMMIT_NOREPLY_DOMAIN` before the first approval, because it becomes permanent public history. Governs R9.
- KTD6. **Commit FOLIO to its fork as Turtle.** GitHub import requires `turtle_file_path`, and upstream ships `FOLIO.owl` (18.3 MB, RDF/XML). Convert it with rdflib and commit `FOLIO.ttl` to the fork's `main` alongside the banner. Governs R1, R7.
- KTD7. **Limit LLM to Damien by membership, not code.** The API and web already deny anonymous users and non-members. Damien stays the only owner, nobody else is added as owner, admin, editor, or suggester, and Zitadel self-registration is turned off. Each project gets Damien's provider key through `PUT llm/config` and a monthly budget cap. Governs R6.
- KTD8. **Restore per-visitor rate limiting.** Behind a tunnel, every request arrives from `cloudflared`, so per-IP limits would collapse into one global bucket. Trust Cloudflare's `CF-Connecting-IP` from the tunnel container, and raise the anonymous-session limit to fit a conference NAT (AE5). Require authentication on `POST /normalization/refresh`. Governs R5.
- KTD9. **Merge `origin/entity-graph-endpoint` into ontokit-api `dev` after its tests pass.** The lineage graph is a must-show feature, and its endpoint exists only on that branch. Governs R2.
- KTD10. **Freeze routine DEV deploys until after BAIF, and take a fresh backup before the first state change.** DEV doubles as Damien's UAT box, and this work changes Zitadel and the projects. Governs R10, R13.

### Assumptions

- The EU host's interactive root key is the existing `hetzner_dev` identity. If it is not, use Hetzner rescue or console access through the API token.
- The local embedding model downloads from Hugging Face on first use. If it does not, semantic search works only after Damien signs in, which is acceptable because he presents signed in.

### Open Questions (execution-time)

- FOLIO's memory use at import and per branch read, against the 2 GB API and 3 GB worker caps on an 8 GB CPX32. U7 measures it and may raise the caps.
- Whether the Zitadel instance-domain addition works on the pinned version (KTD2 has a fallback).

### Dependencies (Damien)

- D1. **GitHub fine-grained PAT** scoped to `alea-institute/semantic-canon-ontokit-demo` and `alea-institute/folio-ontokit-demo`, with contents read/write. Damien mints it and pastes it into a prompting command that writes it owner-only to `~/.config/ontokit-dev/github-mirror-token`. Never paste it into chat.
- D2. **Approval to use the LLM provider key** stored in `~/.config/anthropic/` as the demo projects' LLM key, under a monthly cap.

## Implementation Units

### Group A: host access and ingress (host operations, no PR)

- U1. **Restore operator access and back up DEV.**
  - Goal: SSH into the EU host again and take a fresh, verified backup before any change.
  - Requirements: R10.
  - Approach: Replace the stale `/32` on firewall `ontokit-eu-migration` port 22 with the current operator IP through the Hetzner API; this keeps the migration's "operator /32 only" policy. Run the forced-command `status`. Then take logical dumps of both databases plus the git-repos and MinIO volumes, encrypt them with the existing age identity, copy them home, and verify checksums.
  - Verification: `status` exits 0 with no revision drift, the backup checksums match, and the firewall readback shows exactly one SSH source.
- U2. **Run the Cloudflare Tunnel and demo DNS.**
  - Goal: both demo hostnames serve over TLS straight from the EU box.
  - Requirements: R11.
  - Approach: Create a named tunnel using the Cloudflare API token. Add a `cloudflared` service to `/opt/ontokit/compose.yaml` with ingress rules for the web (including its `/api` routing, which mirrors the Traefik file), the API, Zitadel, and Login. Create CNAMEs to the tunnel.
  - Verification: from the home box, curl both hostnames for the web root, API `/health`, and OIDC discovery, each returning 200 through Cloudflare.
- U3. **Re-point Zitadel and the stack at the demo hostnames.**
  - Goal: Damien can sign in and sign out on the demo hostname.
  - Requirements: R11, R6.
  - Approach: Per KTD2, add the instance domain, register the callback `https://ontokit-demo.damienriehl.com/api/auth/callback/zitadel` and the post-logout origin, and turn off self-registration. Update compose's CORS, `FRONTEND_URL`, `AUTH_URL`, `ZITADEL_ISSUER`, Login URLs, and the Login healthcheck Host header. Then rebuild the web with the matching build args (`Dockerfile`, `lib/env.ts` mismatch guard). Set `AUTH_TRUST_HOST=true`.
  - Verification: a real browser signs in as Damien, loads a project, signs out, and lands on the demo origin, not localhost.

### Group B: API changes (PR to alea-institute/ontokit-api `dev`)

Waits on: nothing. Deploy waits on U1.

- U4. **Merge the graph endpoint.**
  - Goal: `/ontology/classes/graph` exists on `dev`.
  - Requirements: R2.
  - Files: branch `origin/entity-graph-endpoint` into `dev`.
  - Approach: Rebase or merge, resolve conflicts, and run the full suite.
  - Test scenarios: the branch's existing graph tests pass on top of `dev`; an anonymous read of a public project's graph returns 200.
  - Verification: `pytest`, `ruff`, and `pyright` stay green in CI.
- U5. **Harden anonymous access.**
  - Goal: per-visitor rate limits work behind the tunnel, and anonymous users cannot queue a full parse.
  - Requirements: R5.
  - Files: the client-IP resolution used by `ontokit/api/routes/anonymous_suggestions.py`; `ontokit/core/config.py`; the normalization route; and matching tests under `tests/unit/`.
  - Approach: Per KTD8, resolve the client IP from `CF-Connecting-IP` only when the immediate peer is a configured trusted proxy. Make the anonymous-session limit configurable and set it to fit AE5. Require authentication on `POST /normalization/refresh`.
  - Test scenarios: a header from an untrusted peer is ignored; a header from a trusted peer is honored; two different `CF-Connecting-IP` values get separate buckets; 30 sessions from one IP succeed under the demo limit; and anonymous normalization refresh returns 401.
  - Verification: new tests fail before the change and pass after; the full suite stays green.

### Group C: web changes (PR to alea-institute/ontokit-web `dev`)

Waits on: nothing for merge. The deploy pairs with Group B.

- U6. **Visitor drafts and the demo banner.**
  - Goal: QR visitors see the site labeled as a demo, can start a proposal from the viewer, and can attach a note.
  - Requirements: R3, R4, R12, R8.
  - Files: `components/suggestions/CreditModal.tsx` (a note field, passed as `summary` from `app/projects/[id]/editor/page.tsx`); a "Suggest an edit" entry on the viewer at `app/projects/[id]/page.tsx` that opens propose mode; a new env-gated `components/layout/demo-site-banner.tsx` mounted in `app/layout.tsx`; and tests under `__tests__/components/`.
  - Approach: Follow the existing `canPropose` and `onProposeEdit` threading. Gate the banner on a build-time `NEXT_PUBLIC_DEMO_SITE` flag. The banner copy needs Damien's sign-off before it ships (his copy-first rule).
  - Test scenarios: the CreditModal sends the note as `summary` and still works when it is empty; the viewer shows "Suggest an edit" only when `canPropose` is true; the banner renders only with the flag set; and the review page shows the note (extend `CreditModal.integration.test.tsx`).
  - Verification: `npm run lint`, `npm run type-check`, and `npm run test` pass.

### Group D: data and GitHub (host and GitHub operations)

Waits on: U3 deployed, plus Dependency D1.

- U7. **Create the forks and projects.**
  - Goal: both ontologies are live as public projects, each pushing to its fork.
  - Requirements: R1, R7, R8, R9.
  - Approach: Fork both repos into alea-institute under the `*-ontokit-demo` names. Commit the README banner to each, and `FOLIO.ttl` to the FOLIO fork (KTD6). Install `GITHUB_MIRROR_TOKEN` from D1 and `COMMIT_NOREPLY_DOMAIN`, then redeploy. Create both projects with `POST /projects/from-github` as Damien, mark them public, and check memory during the FOLIO import.
  - Verification: both trees load anonymously, the class counts match a local rdflib count of each source, and a manual sync of an approved change appears on GitHub.
- U8. **Configure LLM and embeddings.**
  - Goal: LLM assist works for Damien only, and semantic search returns results.
  - Requirements: R6, R2.
  - Approach: Per KTD7, set each project's LLM config with the key approved in D2 and a monthly budget, then start embedding generation for both projects.
  - Verification: Damien's session generates a definition; an anonymous session sees no LLM controls (AE1); a non-member token gets a 403 from an LLM endpoint (AE4); and semantic search returns hits.

### Group E: stage readiness

Waits on: U1–U8.

- U9. **QR landing, rehearsal, and video.**
  - Goal: the stage script runs cleanly, evidence is recorded, and an offline fallback exists.
  - Requirements: R12, R14, R15, R16, R13.
  - Approach: Generate a QR code PNG for the demo URL. Script R15 in Playwright against the hosted site, signed in as Damien, plus an anonymous-visitor pass covering AE1, AE2, and AE5. Record the signed-in pass as video, then reset the rehearsal's GitHub commits by reverting them through OntoKit so the forks stay clean.
  - Verification: both passes are green, screenshots have been inspected, and the MP4 plays offline.

## Verification Contract

- API: `uv run pytest`, `uv run ruff check`, `uv run ruff format --check`, `uv run pyright`, plus CI on the PR.
- Web: `npm run lint`, `npm run type-check`, `npm run test`, plus CI on the PR.
- Hosted: forced-command `status` exits 0 with no drift, cross-checked against `docker ps` uptime and image creation times (a known trap: `status` alone can misreport). Curl probes per U2, and the Playwright passes per U9.
- Every acceptance claim cites its command and output in a receipt under `docs/releases/`.

## Definition of Done

- The demo URL and QR code work from a network other than the home box's.
- AE1 through AE5 pass on the hosted site.
- Both PRs are merged into the alea-institute `dev` branches, and the deployed SHAs equal the merged SHAs.
- The rehearsal video exists, and the forks hold no leftover rehearsal commits.
- The backup from U1 is verified. No credential value appears in any commit, receipt, or transcript.
- Abandoned-attempt code and temporary Zitadel principals are removed.

