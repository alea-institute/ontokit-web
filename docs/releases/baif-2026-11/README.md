# BAIF demo site: build and UAT receipt (2026-11-03/04)

Plan: [`docs/plans/2026-11-03-1846-feat-baif-ontokit-demo-site-plan.md`](../../plans/2026-11-03-1846-feat-baif-ontokit-demo-site-plan.md).
Demo URL: `https://ontokit-demo.damienriehl.com` (QR code: [`ontokit-demo-qr.png`](ontokit-demo-qr.png), decode-verified).

## What runs where

- **Host:** the existing Hetzner EU DEV stack (CPX32) serves the demo through a Cloudflare Tunnel. It runs as a `cloudflared` container with host networking, which bypasses the CPU-saturated `riehl-dev` proxy. No new inbound port and no new spend.
- **Auth:** the existing Zitadel instance answers on `ontokit-demo-auth.damienriehl.com` as an added instance domain. Login V2, the OIDC app callback, and post-logout URIs point at the demo hosts. Self-registration is off.
- **Projects** (public, created from GitHub forks):

  | Project | Classes | Fork that receives approved changes |
  |---|---|---|
  | Catholic Semantic Canon | 14,973 | `alea-institute/semantic-canon-ontokit-demo` |
  | FOLIO | 18,326 | `alea-institute/folio-ontokit-demo` |

  Each fork's README opens with a "demo copy, not the official ontology" banner. FOLIO's fork adds `FOLIO.ttl`, converted from `FOLIO.owl` with rdflib (18,327 `owl:Class` subjects).
- **Push:** the worker pushes `main` to each fork every five minutes, using a Damien-minted fine-grained token scoped to the two forks with Contents read/write.

## Code delivered (alea-institute forks, merged to `dev`, deployed)

| PR | Change |
|---|---|
| web #77 | Demo banner (`NEXT_PUBLIC_DEMO_SITE`), reviewer note on proposals, viewer "Suggest an edit" |
| api #78 | Graph endpoint merged; trusted-proxy client IP (`TRUSTED_PROXY_IPS`, IPv6 /64 buckets, right-to-left XFF); configurable anonymous limit; auth on normalization refresh; capped and @mention-neutralized anonymous text; `--no-proxy-headers` |
| web #78 | UAT fixes: hide the false "resettable workspace" panel; hide signed-out Similar row (401 loop); label the submitter's note |
| api #79 | Persist the submitter's note on first submit; embedding job gets its own timeout (`EMBEDDING_JOB_TIMEOUT_SECONDS`, 7200), never stranded "in progress", no resurrection, `max_tries=1` |
| web #79 | Phone layout: single-pane viewer and propose editor, 44px actions, graph height, role-aware tools, focus handoff |
| api #80 | Translation coverage reads the configured ontology file by format (fixed a 500 for signed-in members) |

Final deployed pair: API `0c8289d47618e9521883b6ee6f7658b8ea7c0e9b`, web `65ae751c47278f2bc544ff832ee63b0b1d649911`. Each deploy was verified from running image labels and container start times, not from `status` alone.

## Hosted UAT evidence (real browser, Playwright Chromium)

- **Anonymous crawl:** home, both viewers, analytics, PRs, and info pages: 0 console errors and 0 failed requests after fixes.
- **AE1 (no LLM controls for anonymous visitors):** 0 LLM-looking controls on both class detail panels.
- **Detail and graph:** "Holy See" shows its definition, synonyms, and parents. The graph shows 10 nodes and 9 edges, on desktop and on iPhone 14 after the mobile fix.
- **AE2 (anonymous proposal):** Suggest an edit → label edit → auto-save (about 11 s Canon, 15 s FOLIO) → Submit Proposal → credit dialog with name and note. The note reaches the PR description and the reviewer Summary as "Note from submitter". The ontology stays unchanged until approval.
- **AE3 (approval reaches GitHub):** owner approval returned 204, `main` updated (Canon immediately, FOLIO after about 40 s of re-indexing), and the next sync pushed it. Fork commits:
  - "Update Holy See (Apostolic See)", authored `Anonymous <anonymous-…@users.noreply.ontokit-demo.damienriehl.com>`
  - "Merge suggestion: …", authored by the approver
- **AE4 (LLM access):** a signed-in non-member gets 403 on LLM status and config, and an anonymous visitor gets 401.
- **AE5 (shared conference IP):** 7 back-to-back anonymous sessions from one IP all returned 201, with 12 in that hour and no throttle. Stored `client_ip` is the real visitor IP (via `CF-Connecting-IP` from the trusted gateway), not the proxy.
- **Phone (iPhone 14):** `scrollWidth == innerWidth == 390` on the viewer and editor (before: 602 and 625). Suggest an edit and Submit Proposal are 44px full-width buttons.
- **Rehearsal edits:** reverted afterward through OntoKit, so the stage demo can repeat them. Both labels are back to "Holy See" and "Canon Law".

## Incidents

- **Outage, 04:25–04:56 UTC.** A 2.1 GB embedding process left over from a pre-fix timeout, plus a no-cache web build on a swap-less 8 GB box, thrashed the host. SSH stalled, and a Hetzner soft reboot was ignored under load. Recovery: kill the orphan, stop the worker during the build. Prevention: api #79 stops leaving jobs behind. **Before any deploy, restart the worker to release the embedding model (about 2.5 GB).**
- **Embedding runs failed twice by design** ("Ontology branch changed during embedding refresh"), because rehearsal edits landed mid-run. A full local run takes about 16 minutes. Avoid edits while it runs.

## Still open

- **LLM assist:** needs an Anthropic API key (`~/.config/anthropic/` was empty). Once Damien runs the paste-safe prompt, set it per project with a $25/month cap.
- **Damien's sign-in:** his account is verified and an admin on both projects, but he hasn't signed in on the demo host yet.
- **GitHub PR mirroring:** each approval logs a failed attempt to mirror the suggestion as a GitHub PR, because the token has Contents only. Commits push fine. Adding Pull requests write to the token enables the mirror.
- **Minor follow-ups:**
  - A graph node for an external IRI (Wikipedia) triggers a harmless 404.
  - `/pr-party/me` returns 404 because PR Party is off.
  - Mobile hardware Back and tab-jump behaviors.
  - Coverage parses the full file on each request.
