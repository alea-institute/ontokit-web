# U6 Retrospective Alignment Review — Lens 2: Raw Initial-Outline Trace

## Findings

### [P1] DEV was built as a destination, not the required automatic waypoint to PROD

**Raw-outline quote:** “DEV is just a waypoint, and if everything looks good in DEV, then we should push to PROD automatically. Programmatically.” (`docs/roundup-2026-08/outlines/2026-08-08-folio-prod.md:8`; see also the request to investigate and keep PROD current at lines 5–7 and to establish a “full production environment” at line 14).

**Built artifact:** The deployment evidence defines only `ontokit/api:dev` and `ontokit/web:dev`, points every public URL at `ontokit.dev.openlegalstandard.org`, and labels the application `APP_ENV: staging` (`.worker-reports/u6-evidence/dev-infra-compose-and-env.txt:46-66,80-95,109-124`). The Traefik evidence likewise contains only `ontokit-dev-*` routers/services (`.worker-reports/u6-evidence/dev-infra-traefik-route.txt:3-39`). The UAT log identifies the environment solely as FOLIO DEV (`docs/roundup-2026-08/DEV-UAT-LOG.md:1-8`).

**Mismatch:** The standup is useful staging infrastructure, but there is no supplied artifact for PROD synchronization, a PROD deployment, a quality gate, or programmatic DEV→PROD promotion. This is not cured by later acknowledgment: the same-day status scan explicitly says CI and DEV→PROD promotion are absent (`docs/roundup-2026-08/IN-FLIGHT-STATUS.md:47-48,80-81`).

### [P1] Persona and end-to-end user-flow testing was explicitly deferred

**Raw-outline quote:** “that will require that we fully test all of the personas and all of the user flows” (`docs/roundup-2026-08/outlines/2026-08-08-folio-prod.md:18-20`).

**Built artifact:** DEV ran with `AUTH_MODE=disabled` in both API and web (`.worker-reports/u6-evidence/dev-infra-compose-and-env.txt:63,119-123`). The UAT log says the DEV user had full access and “persona-gating UAT [was] deferred to a Zitadel-enabled pass” (`docs/roundup-2026-08/DEV-UAT-LOG.md:6-8`). Its planned browser coverage remained pending (`docs/roundup-2026-08/DEV-UAT-LOG.md:41-46`), and later runs remained blocked before duplicate, external-parent, and approve→merge→trust flows (`docs/roundup-2026-08/DEV-UAT-LOG.md:48-57,79-96`).

**Mismatch:** Infrastructure health and a partial mint/save path are not the requested all-persona/all-flow proof. The network basic-auth gate (`.worker-reports/u6-evidence/dev-infra-traefik-route.txt:22-26`) protects the environment but cannot exercise application roles.

### [P1] The “entire pipeline … database, and then to GitHub” is not demonstrated live

**Raw-outline quote:** “When an Ontokit user provides substantive changes, those changes go through the entire pipeline, including the database, and then to GitHub” (`docs/roundup-2026-08/outlines/2026-08-08-folio-prod.md:17-20`).

**Built artifact:** Round 1–3 hardened the submission code, including server-side Turtle parsing, mint detection, and submit-time gates (`.worker-reports/u6-evidence/api-fixround-code.diff:1195-1239,1240-1334`; commits summarized in `.worker-reports/u6-evidence/api-fixround-commits.txt:1-27`). Live UAT proved only that suggestion save created a real commit on a suggestion branch; submit then blocked or ran for over an hour (`docs/roundup-2026-08/DEV-UAT-LOG.md:48-57,79-96`). Approve→merge→trust was never reached (`docs/roundup-2026-08/DEV-UAT-LOG.md:45-46`).

**Mismatch:** The code repairs are directionally aligned, but the built/deployed evidence does not establish the raw outline’s operational outcome. The status survey’s statement that GitHub wiring exists but silently falls back when integration is unconfigured is diagnostic, not execution proof (`docs/roundup-2026-08/IN-FLIGHT-STATUS.md:20-25`).

### [P2] Demo/live isolation and an easy user toggle were not built

**Raw-outline quote:** “a ‘Demo Mode’ where I can show off the features … adding dummy data and throw away changes, without actually making changes to the live database” and “The user should be able to easily toggle between demo mode and live mode” (`docs/roundup-2026-08/outlines/2026-08-08-folio-prod.md:22-25`).

**Built artifact:** The compose capture has one shared Postgres, Redis, MinIO, git-repository volume, API, worker, and web stack (`.worker-reports/u6-evidence/dev-infra-compose-and-env.txt:1-133`); there is no demo datastore/repository or user-selectable routing mode. The later scan confirms zero demo-mode/dummy-repo implementation hits (`docs/roundup-2026-08/IN-FLIGHT-STATUS.md:41-43,77-78`).

**Mismatch:** Basic auth around an auth-disabled DEV instance is an operator access gate, not a disposable data mode and not an in-product demo/live toggle.

### [P2] The fix rounds honored integrity, but live validation still rejected legitimate FOLIO work and hid the reason

**Raw-outline quote:** “the ontology’s Integrity is the most important,” with no duplicate classes/properties and no unhelpful “AI slop” (`docs/roundup-2026-08/outlines/feature-prd-llm-assisted-improvements.md:35-42`).

**Built artifact:** The API diff made exact normalized labels deterministic duplicate evidence (`.worker-reports/u6-evidence/api-fixround-code.diff:387-436`), hardened every LLM suggestion prompt against ontology-sourced instructions (`.worker-reports/u6-evidence/api-fixround-code.diff:905-957`), and added parse/mint/submit validation (`.worker-reports/u6-evidence/api-fixround-code.diff:1195-1334`). The web diff rejects unsafe Turtle IRIs (`.worker-reports/u6-evidence/web-fixround-code.diff:653-690`).

**Mismatch:** The first submit gate falsely rejected restriction-bearing FOLIO because blank nodes were mistaken for minted parents (`docs/roundup-2026-08/DEV-UAT-LOG.md:26-39`). Round 3 fixed that defect, but the next validation gate still returned a generic 422 while discarding the actual errors (`docs/roundup-2026-08/DEV-UAT-LOG.md:48-57,98-104`). The implementation therefore matches the raw priority in design, but at the reviewed cutoff its discipline prevented legitimate curation without actionable feedback—an imbalance against the PRD’s explicit request to balance ease and integrity (`feature-prd-llm-assisted-improvements.md:40-42`).

### [P2] No delivered artifact implements the requested PROD-data cleanup

**Raw-outline quote:** “Have they gone into the database? If so, we should probably clean those up, since I've been giving demos, and adding gibberish to the database.” (`docs/roundup-2026-08/outlines/2026-08-08-folio-prod.md:14-15`).

**Built artifact:** The only evidenced data operation imported a fresh 18MB FOLIO ontology into DEV (`docs/roundup-2026-08/DEV-UAT-LOG.md:10-16`). The supplied fix-round diffs concern LLM/suggestion correctness and tests (`.worker-reports/u6-evidence/api-fixround-diffstat.txt:1-47`; `.worker-reports/u6-evidence/web-fixround-diffstat.txt:1-35`), while the infrastructure capture contains no PROD backup, audit, cleanup, or migration job (`.worker-reports/u6-evidence/dev-infra-compose-and-env.txt:1-144`).

**Mismatch:** Fresh DEV seeding does not investigate or remediate possible gibberish in the existing production database.

### [P3] Operational safety work had no explicit raw-outline ask, but is a justified enabling addition

**Raw-outline quote:** O2 asks for a testing process “before any of those changes actually goes live” (`docs/roundup-2026-08/outlines/2026-08-08-folio-prod.md:22-24`), but no raw outline asks for public basic auth, provider-cost fail-closed behavior, signed beacon tokens, retry suppression, or cache-key isolation.

**Built artifact:** DEV received TLS, HTTP→HTTPS, and basic-auth protection (`.worker-reports/u6-evidence/dev-infra-traefik-route.txt:3-30`; `docs/roundup-2026-08/DEV-UAT-LOG.md:69-77`). Fix rounds added fail-closed model pricing (`.worker-reports/u6-evidence/api-fixround-code.diff:115-143`), authenticated/member-only paid duplicate checks (`api-fixround-code.diff:25-75`), no-retry generation (`.worker-reports/u6-evidence/web-fixround-code.diff:248-259`), signed beacon-token use (`web-fixround-code.diff:529-540`), actionable generation errors and project/branch scoping (`web-fixround-code.diff:544-649`).

**Mismatch:** These are built artifacts that no raw outline names. They do not contradict Damien’s intent; they are defensible controls required to make the requested LLM and DEV surfaces safe. They should nevertheless be recorded as engineering-derived scope, not retrospectively presented as user-authored requirements.

## Consolidation-loss register

These raw intents were not found in the supplied built artifacts **or elsewhere in the later non-outline documents searched** (`docs/roundup-2026-08/`, excluding `MASTER-OUTLINE.md`, plus `docs/residual-review-findings/` and `.worker-reports/u6-evidence/`):

- **User-configurable N-day acceptance.** O1 describes edits/PRs “accepted after N days (user configurable)” (`docs/roundup-2026-08/outlines/2026-07-24-feature-build.md:27-31`). No later evidence hit preserves the user-configurable timing requirement.
- **Explicit evaluation of Google or another SSO alternative.** O1 asks to explore Zitadel “Or maybe simply Google login or another SSO method” (`2026-07-24-feature-build.md:32-34`). Later material mentions Zitadel implementation/deferred testing (`docs/roundup-2026-08/IN-FLIGHT-STATUS.md:75`; `DEV-UAT-LOG.md:6-8`) but does not carry forward the comparative Google/other-SSO exploration.
- **Credential-state metadata in bot-authored submissions.** O1 requires the built-for-purpose GitHub account’s submissions to include metadata about “the username, the person's identity, the then-current credentials, Etc.” (`2026-07-24-feature-build.md:35-39`). Later status preserves bot push plus contributor authorship (`IN-FLIGHT-STATUS.md:26-30,74`) but no evidence found preserves the “then-current credentials” metadata intent.
- **Explicit tool-choice evaluation for Generative FOLIO / FOLIO-python / FOLIO-api / OWL.** O4 asks the system to choose among those tools as helpful (`docs/roundup-2026-08/outlines/feature-prd-llm-assisted-improvements.md:29-34`). The review mentions folio-python only as one structural-similarity implementation (`docs/residual-review-findings/2026-08-08-llm-subsystem-review.md:46-49`); no evidence records the requested comparative tool evaluation or disposition for all four.
- **Translations as a first-class suggested annotation.** O4 explicitly lists “translations” (`feature-prd-llm-assisted-improvements.md:20-23`). The later status groups annotation/generation functionality broadly (`IN-FLIGHT-STATUS.md:10-15,71`) but no searched artifact specifically carries translations.

The following missing implementations are **not** consolidation losses because later documents do preserve them explicitly: demo mode (`IN-FLIGHT-STATUS.md:41-43,77-78`), DEV→PROD promotion (`IN-FLIGHT-STATUS.md:47-48,80-81`), upstream delivery/molecule strategy (`IN-FLIGHT-STATUS.md:31-34,85-88`), rebase/drift analysis (`IN-FLIGHT-STATUS.md:53-64`), and session clustering (`IN-FLIGHT-STATUS.md:10-15`). Their later preservation is not counted as ratification or completion.

## Traced clean

- **LLM affordance viability.** O4 requires an LLM component supporting suggested additions and annotations (`feature-prd-llm-assisted-improvements.md:19-23`). The web fix round repaired the formerly unreachable configuration by adding a generation-model selector and preventing invalid saves (`.worker-reports/u6-evidence/web-fixround-code.diff:76-234`); the API status now requires a selected model (`api-fixround-code.diff:144-153`).
- **Children, siblings, annotations, parents, and edges remain represented.** O4 names child/sibling additions, annotation suggestions, additional parents, and helpful edges (`feature-prd-llm-assisted-improvements.md:14-28`). The prompt registry applies hardening to all five corresponding builders without dropping any (`api-fixround-code.diff:947-957`).
- **Existing-ontology duplicate defense.** O4 requires looking through the existing ontology to prevent duplicates and propose useful relationships (`feature-prd-llm-assisted-improvements.md:24-28,36-42`). The fix round searches candidates across branches and excludes the suggestion’s own branch/IRIs (`api-fixround-code.diff:359-386`), renormalizes missing structural evidence, and forces exact-label matches to block (`api-fixround-code.diff:387-436`).
- **Ontology-integrity trust boundary.** O4 rejects “AI slop” (`feature-prd-llm-assisted-improvements.md:35-42`). Prompt injection hardening (`api-fixround-code.diff:913-957`), server-side Turtle parsing/mint detection (`api-fixround-code.diff:1195-1234`), submit-time deterministic gates (`api-fixround-code.diff:1236-1334`), and web-side IRI rejection (`web-fixround-code.diff:653-690`) directly support that intent, subject to the live-validation finding above.
- **A real DEV testing waypoint exists.** O2 asks for a place/process to test before live ontology changes (`2026-08-08-folio-prod.md:22-24`). The compose capture proves healthy API, worker, Postgres, Redis, and MinIO services (`dev-infra-compose-and-env.txt:138-144`); Traefik provides TLS, redirect, and access control (`dev-infra-traefik-route.txt:3-30`); UAT imported and indexed real FOLIO data and loaded its class tree (`DEV-UAT-LOG.md:10-16`). This cleanly satisfies the waypoint portion, not the missing promotion/PROD portion.
- **Raw uncertainty was investigated rather than silently assumed.** O1 asks whether a local GitHub repository changes the account analysis (`2026-07-24-feature-build.md:40-41`), and O2 questions whether writes are fake (`2026-08-08-folio-prod.md:14-18`). The later repository survey distinguishes local git/real GitHub machinery from deployment configuration and documents system-token push plus contributor attribution (`IN-FLIGHT-STATUS.md:20-30`). This is analysis evidence only; it does not substitute for the incomplete live-pipeline proof.

## Verdict

The outside-harness work is **partially aligned, not retrospectively complete**. Rounds 1–3 materially honor O4’s deepest raw intent—make LLM-assisted curation useful without sacrificing ontology integrity—and the DEV standup creates the test waypoint O2 requested. But O2’s outcome was production-oriented: verified personas and full user flows, real database→GitHub completion, PROD synchronization, and automatic promotion. None is demonstrated, and live UAT instead records blockers before submit/merge. Demo/live isolation and PROD-data cleanup are also absent. Finally, five narrower O1/O4 intents appear to have fallen out of the later record entirely. Later documents accurately naming several gaps is useful traceability, but under the anti-ratification rule it is not evidence that those raw asks were delivered.
