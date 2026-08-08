# OntoKit Master Prompt Outline — 2026-08-08 Roundup

Consolidates four planning outlines and three Damien ↔ Fr. John transcripts into one
feature outline. Source tags: `[O1]` = 2026-07-24 feature-build outline, `[O2]` =
2026-08-08 FOLIO-PROD outline, `[O4]` = LLM-assisted-improvements PRD, `[T-May]` =
May working session, `[T-Jul]` = 2026-07-21 FOLIO update, `[T-Aug]` = 2026-08-01
strategy meeting. `⚠ DIVERGENCE` marks outline-vs-transcript conflicts awaiting
Damien's ruling (default lean: transcript).

The transcripts themselves are deliberately **not** committed (Damien's call,
2026-08-08 — they contain candid third-party remarks); they are retained
privately off-repo. The outlines are committed under `outlines/`.

**Rulings received 2026-08-08** (recorded in the Cockpit ask
`ontokit-web-2026-08-08-roundup-divergences`): Q1 bot-pushes-contributor-attributed
(ratifies code as built) · Q2 two regimes (dev PRs small; user sessions clustered)
· Q3 build the in-app demo toggle this round, seeded by TWO point-in-time dummy
repos (Semantic Canon snapshot + FOLIO.owl snapshot) · Q4 Railway superseded —
Hetzner hosts FOLIO DEV and Catholic DEV; Catholic PROD on the foundation VPS
· Q5 CE-forward hybrid · Q6 gated DEV→PROD auto-promotion on green checks.

**Topology (final ruling, Damien, 2026-08-08 evening — supersedes both earlier
versions; decided on cost allocation, personal vs nonprofit):** **FOLIO DEV *and*
PROD both live on the ALEA-funded AWS box** (54.224.195.12 /
ontokit.openlegalstandard.org — currently the stripped April folio-adapter build on
8GB ARM64; needs Docker, likely an instance upsize, and the full-stack rebuild).
Mike Bommarito holds the AWS credentials; access request sent. The Damien-funded
Hetzner CPX41 (`ontokit-dev`, 178.156.208.239, Ashburn — provisioned + hardened
2026-08-08) hosts **Catholic DEV + the future `ontokit.org` picker**. Catholic PROD
on the foundation VPS, unchanged. `ontokit.org` not yet registered. The twin-secrets
vault's AWS keys are dead (InvalidClientTokenId) — fresh scoped IAM keys come from
Mike.

**Review gate (2026-08-08):** the LLM-subsystem second-opinion review returned
NOT-DEPLOYABLE — 6 P0 / 15 P1 (report: ontokit-api
`docs/residual-review-findings/2026-08-08-llm-subsystem-review.md`). Two Codex fix
workers dispatched (api + web, live-Postgres integration harness required); DEV
deploy for Damien's UAT waits on their green + re-verification.

---

- **Fork alignment first** `[O2]`
  - **Rebase analysis:** compare `origin` (alea-institute) branches against `catholicos/dev`; decide rebase vs merge before feature work `[O2 §4]`
  - **Version currency:** Fr. John noted Damien was running an outdated build (`continuous editing` since removed) — sync down before building `[T-Aug]`
  - **PROD sync:** investigate why ontokit.openlegalstandard.org lags both upstream and the fork `[O2 §1]`
  - **DEV auto-promotes:** standing rule — DEV is a waypoint; green in DEV pushes to PROD programmatically `[O2 §1.3]` *(outline-only; no transcript discussion — confirm)*

- **Workflow & governance** *(decided in transcripts; no divergences)*
  - **Issue-first upstream:** every feature gets a CatholicOS issue before its PR; issues frame the problem so PRs don't arrive as surprises `[T-Aug]`
  - **One feature per PR:** going forward, single-purpose PRs; the early omnibus round was fine for bootstrap only `[T-May]`
  - **Async review default:** CodeRabbit pre-screens; Fr. John merges clean bug fixes async; synchronous "PR parties" reserved for design/approach changes `[T-May, T-Aug]`
  - **Local review too:** run multi-model review (CE/CodeRabbit CLI) before pushing; fix all findings, then push once `[T-May]`
  - **FOLIO as canary:** build and test on the FOLIO fork first; report learnings; then propose upstream `[T-May, T-Jul, O4]`

- **Auth & commit identity** `[O1 §2]`
  - **Kill GitHub-login friction:** lay users (e.g., a parish administrator) must not need GitHub accounts `[O1, T-May suggester discussion]`
  - **Zitadel SSO login:** Zitadel (with Google/social IdPs) once hosted; GitHub-third-party login via Zitadel needs a live deployment, not localhost `[O1, T-May]`
  - **⚠ DIVERGENCE — committer identity:**
    - **Outline wants bot:** a purpose-built account (e.g., `catholicos_commits`) makes all commits, carrying user metadata `[O1 §2.2]`
    - **John wants authorship:** commits should credit the contributor — "having the commit is useful because then you have authorship… recognition for any contribution" `[T-May]`
    - **Likely reconciliation:** bot *credentials* push, but commit author/`Co-Authored-By` carries the contributor's identity — needs Damien's ruling
  - **Local-repo wrinkle:** whether a server-side/local git repo exists (removing the remote-account need entirely) is **unverified** — repo scan will settle it `[O1 §2.4]`

- **Full production pipeline** `[O2 §3]`
  - **Real GitHub wiring:** substantive user changes flow database → commit → PR on a real repo; today's flow is believed fake/stubbed after the DB step — verify where changes actually land `[O2 §3.1]`
  - **Demo-data cleanup:** purge gibberish added during demos once the real pipeline exists `[O2 §3.1]`
  - **Personal branches:** each contributor's changes accumulate on their own branch; front-end says "Submit your changes," backend opens the PR `[T-May]`
  - **Persona testing:** exercise all roles (admin / editor / suggester) end-to-end before calling it production `[O2 §3.2.1]`
  - **⚠ DIVERGENCE — change bundling:**
    - **Outline wants molecules:** bundle atomic changes into larger molecules "so Father John has an easier time doing PRs" `[O2 §3.2.1.4]`
    - **John wants small PRs:** a PR with 20–25 changes "might be a little bit difficult… having each one in its own PR" `[T-May]`
    - **Likely reconciliation:** two regimes — developer features stay one-issue-one-PR; end-user *suggestion sessions* cluster by session/topic (the `[O4]` clustering question), so 100 edits ≠ 100 PRs and ≠ one mega-PR — needs Damien's ruling

- **Testing & demo** `[O2 §3.2.2]`
  - **Dummy GitHub repo:** decided — tests and demos hit a throwaway repo, never live data `[T-Jul]`
  - **Staging environment:** a pre-live tier where changes are validated before touching the live ontology `[O2]`
  - **⚠ SCOPE QUESTION — demo mode:** in-app demo/live toggle for showing off features with throwaway data is outline-only; transcripts only decided the dummy-repo mechanism — build the toggle now, or is dummy-repo-first enough? `[O2 §3.2.2.2]`

- **LLM-assisted contributions** `[O4 — the major feature]`
  - **User story:** SMEs suggest new classes (child/sibling) or enrich existing ones (altLabels, examples, notes) via a UX affordance `[O4]`
  - **LLM suggests:** right-click → "suggest siblings/children"; LLM proposes annotations, translations, definitions, relationships; human approves yes/no per item `[O4, T-Aug, T-May]`
  - **Duplicate defense:** system checks suggestions against the existing ontology — no duplicate classes/properties, no AI slop; integrity outranks ease `[O4]`
  - **Edge suggestions:** propose relationships (edges) between nodes, new unique classes `[O4]`
  - **Tooling candidates:** generative-folio, folio-python, folio-api, OWL file; embeddings for near-dupe detection `[O4]`
  - **BYOK cost model:** decided — users bring their own LLM key; hosting stays cheap, LLM costs land on the user `[T-Aug]`
  - **Session clustering:** cluster a user's rapid-fire suggestions into reviewable commit groups (per ontological branch/topic) — ties into the bundling divergence above `[O4]`

- **Hosting & federation** *(new from `[T-Aug]` — in no outline)*
  - **Hosted OntoKit service:** multi-tenant OntoKit where projects (Catholic, FOLIO, architecture) each define ontologies and can reference each other `[T-Aug]`
  - **Picker site:** an ontokit landing page pointing to each instance, with per-instance direct URLs that bypass the picker `[T-Aug]`
  - **Federation heartbeat:** instances watch each other's repos (pull-on-change, like Enrich watching the FOLIO OWL); hub-and-spoke, one step at a time `[T-Aug]`
  - **Homes decided:** FOLIO instance on Damien's Hetzner (openlegalstandard.org); Catholic instance on the foundation VPS (Zitadel already integrated, GitHub-Actions CI deploy) `[T-Jul, T-Aug]`
  - **⚠ SUPERSEDED — Railway:** May's Railway plan was overtaken by Hetzner + foundation-VPS decisions — confirm Railway is dead `[T-May vs T-Jul/T-Aug]`

- **Editor UX refinements** `[T-May]`
  - **Auto-save default:** auto-save on navigate-away stays; default ON `[T-May]`
  - **Preference toggle:** user cog/preferences can enable a manual Save button (VS Code analogy) `[T-May]`
  - **Teaching toast:** "auto-save enabled / saved" toast so first-timers don't hunt for Save `[T-May]`
  - **Dirty indicator:** the amber/orange unsaved dot is liked — keep `[T-May]`

- **Planned-work recovery** `[O1 §1, O2 §2]`
  - **PR-party plans:** locate the April–May GSD plans (7 sessions) and the ~5 hours of UI/UX decisions; much appears built on `feat/pr-party` (U1–U15) — repo scan will confirm what remains `[O1, O2]`
  - **⚠ HARNESS QUESTION — GSD vs CE:** run remaining plans on native GSD or convert to CE; standing policy says finish in-flight GSD, start new work in CE — confirm `[O1 §1.3]`

- **Context, not scope** *(Catholic-side architecture that constrains, but isn't, ontokit-web work)*
  - **Registries feed ontology:** datasets/registries are source of truth; ontology references them, never the reverse; apps may consume both `[T-Aug]`
  - **ID conventions:** opaque IRIs for ontology classes; transparent per-registry IDs (papal ID, biblical-person ID) for stable datasets; Zudong owns the grammar `[T-Aug]`
  - **Shared-vs-minted IDs:** cross-ontology ID sharing (FOLIO/Catholic/OpenGloss) left open — "mapping is easy; doesn't matter much"; revisit with Zudong `[T-Aug]`
  - **Semantic Canon rebuild:** lean prune-and-iterate (keep document/authority/actor structure) over from-scratch; ground in Clementine Vulgate + biblical dictionaries via Enrich `[T-Aug]`
