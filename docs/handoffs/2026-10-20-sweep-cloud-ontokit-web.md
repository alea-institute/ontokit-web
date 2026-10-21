---
title: Sweep handoff — ontokit-web cloud lane (BAIF rehearsal)
date: 2026-10-20
cycle: sweep-2026-10-20
lane: cloud / alea-institute/ontokit-web
status: rehearsal passes on the isolated stack; hosted run ready, blocked on DEV personas
---

# Handoff: ontokit-web cloud lane, sweep-2026-10-20

**Mandate.** Before 2026-11-02, make OntoKit fully operational for real FOLIO work and real
Catholic OS work, with a scripted end-to-end rehearsal ahead of BAIF (Rome, 2026-11-05/06),
and bring in Adam Jace's CTT taxonomy.

**Done-when status.**

- **Isolated stack: passes.** The scripted rehearsal passes on a fresh full stack: real
  Zitadel, API `dev` `c682a2f2`, and this branch's web build. It covers sign-in, FOLIO
  browsing, a FOLIO edit reviewed and merged, Catholic OS browsing with CTT concepts, and a
  Catholic OS edit reviewed and merged.
- **Serving host: ready to run, not yet run.** `npm run rehearsal:hosted` needs three
  verified DEV persona accounts. DEV email verification still blocks them: the D10 Mailpit
  blocker. See the box steps below.

Web PR: [alea-institute/ontokit-web#68](https://github.com/alea-institute/ontokit-web/pull/68)
(branch `feat/baif-rehearsal-20261020`, base `dev`).

## Re-verified starting state

| Check | Result |
|---|---|
| `dev` at `0617a1e1` (main is the stale 0.3.0 release) | `npm ci`, lint (0 errors), type-check, Vitest 369 files / 5,482 tests all pass |
| Existing `suggestions` e2e profile in this cloud container | Failed at first: the `minio/minio` image no longer resolves. After the image fix, **7/7 passed** |
| Node harness suites | profiles, evidence and identity pass. Ownership: 4 tests fail **only as root** in this sandbox. They fail identically on untouched `dev`, and CI's `e2e-unit` (non-root) passes |

## What this lane delivered

| Deliverable | Where |
|---|---|
| CTT import path: public pages → `ctt-snapshot/v1` → OWL module → merge into Catholic OS. A structured export plugs in through `--export` | `scripts/ctt/`, [docs/ctt-import.md](../ctt-import.md) |
| Rehearsal sources: FOLIO `a8f0d29f` and Catholic OS `935bc5ac`, pinned by SHA-256, plus the live CTT import and merge, cached outside Git and re-verified (merge rebuilt) before each run | `scripts/rehearsal/{pins,sources}.mjs`, `npm run rehearsal:sources` |
| Rehearsal harness profile `rehearsal`: four exact cases; receipts carry the pins and the CTT build | `e2e/browser/rehearsal.spec.ts`, `e2e/fixtures/rehearsal.ts`, `npm run test:e2e:rehearsal` |
| Hosted runner: the same spec against a serving host, from a private target file | `scripts/rehearsal/hosted.mjs`, `npm run rehearsal:hosted` |
| Harness repair: `minio/minio` left Docker Hub in September 2026; Chainguard's MinIO is now pinned by digest | `e2e/compose.yaml` |
| Harness: allowlisted proxy/CA passthrough, so the stack builds behind an egress proxy | `scripts/e2e/runtime.mjs` |
| Plan; roadmap entry D11 | [plan](../plans/2026-10-20-rehearsal-folio-catholic-ctt-plan.md), [roadmap](../plans/2026-09-20-0649-requirements-delivery-roadmap.md) |

**The rehearsal script, step by step:**

1. A fresh browser signs in the contributor through Zitadel. The contributor browses FOLIO
   (18,326 classes): the tree, a search for "Canon Law", and its definition.
2. The contributor relabels FOLIO "Canon Law" to "Canon Law (Catholic Church)", which
   matches the class's own definition. The contributor saves and submits, and the reviewer
   approves in triage. The merged label reaches the index and the source.
3. Catholic OS now holds 15,228 classes, including 250 CTT terms. In it, "CTT term" is a
   root class with exactly six false friends under "CTT false friend". The viewer shows
   "credence" as `uncalibrated`, with both of its senses ("weight, validity, support" and
   "commission, protocol, honor").
4. The contributor relabels Catholic OS "Holy See" to "Holy See (Apostolic See)", the
   canonical synonym (CIC can. 361) that the class already lists as an altLabel. The
   reviewer approves and merges, and the CTT module survives the merge.

The rehearsal's edits land only in disposable, run-tagged projects. Nothing is written
back to the FOLIO or CatholicOS repositories.

## Evidence

Every receipt is `acceptance.scope: local-verification` with `acceptedRun: true` and cleanup
`complete`. They live in the ignored `.e2e-runs/receipts/`.

| Run | Web source | Result |
|---|---|---|
| `dccbd02d…` | branch working tree (staged) | 4/4 passed, 7.3 min of browser cases |
| `c6c5f8f5…` | same, docs staged | 4/4 passed |
| `b8f83d08…` ([receipt](../releases/d11-rehearsal-run-b8f83d0879baa4677f72f4a57a0c6739.json)) | committed head `f642426` (after the review fixes) | 4/4 passed |

All three runs used API `dev` `c682a2f2`.

**Timings on a 4-vCPU, 16 GiB host** (from run `dccbd02d`):

| Step | FOLIO | Catholic OS + CTT |
|---|---|---|
| Import (normalize) | not timed separately; both imports plus indexing finished within the 4–5 min worker setup | — |
| Index (worker) | 52 s, 18,566 entities | 33 s, 15,462 entities |
| Open class in editor | 12.5 s | 11.9 s |
| Save label | 22.9 s | 17.4 s |
| Submit | 24.6 s | 15.7 s |
| Approve and merge | 0.2 s | 0.2 s |
| Merged label in index | 67.7 s | 47.5 s |

## Findings for other lanes

1. **API (sibling lane), high for real FOLIO use.** Each suggestion save runs
   `SuggestionService._assert_branch_content_can_mint`, which parses the whole proposed and
   current ontology with rdflib, synchronously, on the event loop
   (`ontokit/services/suggestion_service.py` around line 451). On FOLIO that is about 2 × 7.7 s
   of a blocked API per save. Every other user's request stalls meanwhile, and the 15 s
   client default timed out in the first rehearsal attempt.
   - **Recommended fix:** run the check in a worker thread (`asyncio.to_thread`), or compare
     only the subjects in the changed lines. Cache the current branch's entity set by commit.
   - Submit (about 25 s on FOLIO) likely has the same shape; worth profiling.
2. **API / DEV deploy / AWS plan, high.** `deploy/compose.dev.yaml` pins
   `minio/minio@sha256:14cea4…`, and `compose.yaml` and `compose.prod.yaml` use
   `minio/minio:latest`. That image no longer resolves on Docker Hub. The running DEV host
   works only while its local copy survives; any rebuild or the ALEA AWS move will fail to
   start MinIO. This lane uses `cgr.dev/chainguard/minio@sha256:32c504be…` (release
   2026-09-22). It is a drop-in: same `server /data` command, `mc ready local` works, and a
   fresh named volume is writable. Chainguard's free tier publishes only `latest`, so pin a
   digest and record it. Whether old digests stay pullable long-term is unverified.
3. **Web, low.** The `next start` log warns that `output: standalone` should run through
   `node .next/standalone/server.js`. The harness has always used `next start`; it is
   harmless but noisy.

## Open questions (for Damien)

1. **CTT namespace.** *Setting: quick-decision.* The CTT module mints term IRIs as
   `https://ontology.catholicos.catholic/ctt/term/<slug>`, communities as `…/ctt/community/<CODE>`.
   **Recommendation:** keep this. The terms live inside Catholic OS, and every term links
   back to `https://ctt.jaces.com/vocabulary/#t-<slug>` through `rdfs:seeAlso`. The
   alternative is to ask Adam to mint stable IRIs on his site and use those as the subjects.
   It is a one-flag change (`--base`) either way.
2. **Showing CTT quotations at BAIF.** *Setting: message-to-send.* The module includes the
   site's own quotations: up to twelve words either side, attributed, and only from texts
   whose rights the site says allow quoting. `--omit-quotes` drops them. **Recommendation:**
   keep them, but ask Adam. A draft follows; Damien should send it, as it is in his voice.

   > Subject: CTT terms in OntoKit for BAIF
   >
   > Hi Adam — we've loaded the CTT vocabulary into OntoKit's Catholic OS ontology for the
   > BAIF demo: all 250 words, with sense counts, the 24 communities, the six false friends,
   > the core-word counts, and the short attributed quotations from your findings page.
   > Every term is marked "uncalibrated" and links back to its entry on your site. Two
   > questions. First, are you comfortable with us showing those quotations in Rome?
   > Second, when you publish a structured export, could it follow (or map onto) the small
   > JSON schema here: <link to docs/ctt-import.md on GitHub>? Then we swap the page
   > reader for your export without changing anything else. Thanks — Damien
3. **Rehearsal edits.** *Setting: quick-decision, low stakes.* The two scripted edits are
   "Canon Law" → "Canon Law (Catholic Church)" and "Holy See" → "Holy See (Apostolic See)".
   They show the workflow on real content and stay in disposable projects.
   **Recommendation:** keep them unless a stakeholder demo calls for specific content.

   **Answered on 2026-10-20 at 20:25Z: keep both** (ask `ontokit-web-2026-10-20-2022-sweep-baif-ctt-calls`,
   qid `rehearsal-edits`).
   - The answer came from Chief, the automated first responder (tier auto, provenance chief).
   - Its reasons: both edits match existing definitions, and they touch only disposable,
     run-tagged projects.
   - Damien can still overrule it by naming stakeholder content to swap in.
   - The rehearsal keeps the edits as built (`scripts/rehearsal/pins.mjs` `TARGETS`); no
     code changes.
   - Questions 1 (CTT namespace) and 2 (CTT quotations) remain open with Damien.

## Steps that need the home box or credentials

1. **Provision three verified DEV personas** (steward/owner, contributor/suggester,
   reviewer/editor). This is the same blocker and the same ask as D10
   (`ontokit-web-2026-09-28-2343-d10-dev-uat-account-access`: the Mailpit-reading verb,
   a Zitadel admin token, or Damien creating them). The personas must be ordinary accounts.
   The spec makes the steward the owner of the projects it imports, and adds the other two
   as members itself.
2. **Deploy current `dev` heads to DEV** before the hosted run: web `dev` after PR #68
   merges (the rehearsal itself needs no new web code, but DEV last deployed web `787eecc4`
   on 2026-09-28), and API `dev` `c682a2f2`. Use the restricted deploy key's `deploy` verb.
   Fix the MinIO pin first (finding 2) if the deploy rebuilds services.
3. **Run the hosted rehearsal** from a checkout of this branch (or `dev` after merge) on the
   home box:
   ```sh
   npm ci && npx playwright install chromium
   npm run rehearsal:sources            # NODE_USE_ENV_PROXY=1 behind a proxy
   # Create a mode-0600 JSON file outside the repo, never committed:
   #   {"web": "https://<DEV web origin>", "api": "https://<DEV API origin>",
   #    "issuer": "https://<Zitadel issuer origin>", "login": "https://<Login UI origin>",
   #    "users": {"owner": {"id": "<Zitadel user ID>", "email": "…", "password": "…"},
   #              "suggester": {…}, "editor": {…}}}
   npm run rehearsal:hosted -- --target /absolute/path/to/that-file.json
   ```
   - The run imports two run-tagged public projects of about 18 MB and 8 MB on DEV, and
     deletes them at the end.
   - It writes `.e2e-runs/receipts/hosted-<id>.json` with
     `acceptance.scope: hosted-rehearsal`. Copy that receipt into `docs/releases/` with a
     short readiness note.
   - The sign-in step expects the Zitadel Login v2 UI test IDs the isolated stack uses. If
     DEV's login UI differs, the first case fails at sign-in. Adjust
     `e2e/fixtures/auth.ts` `enterProviderCredentials`.
4. **Rehearse again before 2026-11-02** with the same command, after any DEV deploy. If
   Adam publishes an export, pass it with
   `npm run rehearsal:sources -- --ctt-export <file>`.
