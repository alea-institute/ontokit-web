---
title: BAIF OntoKit demo site (Catholic Semantic Canon + FOLIO)
date: 2026-11-03
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-brainstorm
execution: code
deadline: 2026-11-04 evening (demo Thursday 2026-11-05, Rome)
---

# BAIF OntoKit demo site (Catholic Semantic Canon + FOLIO)

## Goal Capsule

- **Objective:** By Wednesday evening, 2026-11-04, Damien can open a public demo URL at the Builder's AI Forum and show OntoKit end to end on the Catholic Semantic Canon and FOLIO: browse and search, suggest, review, then a commit on GitHub, plus LLM assist. Attendees reach the same site by QR code, browse read-only, and leave draft input he can review later.
- **Means:** Repair the existing Hetzner EU DEV stack, which already runs Zitadel, and reuse it. Serve it at a `damienriehl.com` subdomain and sync each ontology to a clearly labeled demo fork under `alea-institute`.
- **Product authority:** Damien (all decisions below came from him on 2026-11-03).
- **Open blockers:**
  - **DEV is unreachable.** On 2026-11-03, from the home box, SSH (port 22) and HTTPS (443) to `77.42.71.53` both timed out, while general internet access worked. Planning's first step is diagnosing this.
  - **The DEV hostname points at the wrong box.** `ontokit.dev.openlegalstandard.org` resolves to `204.168.246.227` (the services box). R11 bypasses this record by moving the demo to a new hostname.

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
- R4. A visitor can submit draft input on an entity (a proposed edit or comment) without an account. Name and email are optional fields.
- R5. Visitor drafts never change an ontology or reach GitHub by themselves. They wait in a queue Damien can review, promote into a real suggestion, or discard. Abuse controls keep the queue usable during and after the conference.
- R6. Only Damien's account can invoke LLM features, under a monthly budget cap. Visitors never see LLM controls they cannot use.

**Live GitHub flow**

- R7. Each project syncs both ways with its demo fork. When Damien approves a suggestion, it appears on GitHub as a commit or pull request. Changes pushed to the fork flow back into OntoKit.
- R8. Each demo fork's README opens with a banner stating that it is an OntoKit demo, not the production ontology, and that its contents are not real Canon or FOLIO suggestions.
- R9. Changes approved on the demo commit to GitHub as Damien through OntoKit's per-user token.

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
- AE3 (Covers R7, R9). Damien approves a suggestion on stage. Within a minute, the demo fork shows a commit authored as Damien via OntoKit.
- AE4 (Covers R6). A non-owner account calls an LLM endpoint and gets a refusal with no provider spend.

### Scope Boundaries

- **Out of scope:** changes to the real `CatholicOS/ontology-semantic-canon` or the real FOLIO repo; production CDCF hosting; the openlegalstandard.org DNS fix; new spend; a laptop-local stack.
- **Deferred:** self-signup and social login for attendees, and moving the demo to a CDCF domain once one exists.
- **Accepted risk:** DEV doubles as Damien's UAT box. Freeze routine deploys from now until after BAIF.

### Outstanding Questions

- **Resolve Before Planning:** none.
- **Deferred to Planning:**
  - Why `77.42.71.53` times out (Hetzner firewall, host down, or an allowlist), and the repair path.
  - Which DNS provider hosts `damienriehl.com`, and how to issue the TLS certificate.
  - The Zitadel redirect URIs and issuer for the new hostname (related: ontokit-web#344, where logout redirects to localhost).
  - Whether the existing suggestion or session model can store anonymous drafts, or whether a small new capture path is needed. Also which abuse controls to use, for example rate limits or Turnstile.
  - How to restrict LLM to Damien using the existing member flags, budgets, and rate limits on the alea `dev` branch.
  - How fast the full FOLIO import and indexing run on the DEV box.
  - The remote-sync and webhook setup for both forks, including Damien's write token, which goes on the box by reference and never into the transcript.

### Sources

- DEV host, deploy command, and traps: memory `reference-dev-server`, and ontokit-web `docs/releases/eu-hosting-migration-receipt.md` (landed in #50, not on this branch).
- FOLIO import acceptance status (BLOCKED, no evidence): ontokit-api `docs/releases/oa-2-u9-acceptance.md`.
- LLM gating: ontokit-api `origin/dev:ontokit/api/routes/llm.py` (owner/admin configuration, member flags, budgets, rate limits).
- GitHub sync: ontokit-api `origin/dev:ontokit/api/routes/remote_sync.py` and `pr_party*.py`.
