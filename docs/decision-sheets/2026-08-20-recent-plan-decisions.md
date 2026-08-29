# Decision Sheet — Recent OntoKit Plan Residuals

Created: 2026-08-20
Updated: 2026-08-29 after implementation, merge, and residual review

The recommended choices are first. D1–D10 are settled. D11 and D12 are the only
open judgment calls and do not block the completed D7/D9/D10 implementation.

## D1. How should the main line reach PROD?

**Why this matters:** U13 and U15 cannot be finished honestly until the rollout shape is fixed. PROD is healthy and public today. The main line is a nine-service, auth-capable stack.

1. **Parallel stand-up, UAT, then DNS cutover — recommended.** Build on a separate hostname, prove it, then move DNS. Existing PROD stays reversible throughout.
2. In-place promotion with a tested rollback plan. Fewer hostnames, but the current public service carries the migration risk.
3. Keep the public FOLIO browser and the auth product on permanent separate URLs. No cutover; two intentionally distinct products.

**Decision:** `D1 = 1` — parallel stand-up, UAT, then DNS cutover.

## D2. What is the status of Mike’s AWS access request?

**Current evidence:** SSH to 54.224.195.12 is still closed/filtered from this box. No agent-side AWS credentials are available. The concrete request is inbound TCP 22 from the current home-box egress IP, preferably replaced by scoped Route 53 + EC2 IAM access because the residential IP rotates.

1. **Sent; wait for Mike — recommended if already sent.** I will stop re-asking and only recheck access.
2. Not sent; put the final paste-ready message in chat again.
3. You have console access and will add the rule yourself.

**Decision:** `D2 = 1` — the request was sent; wait for Mike and recheck access without re-asking.

## D3. Should we activate the demo-mode prerequisite work now?

**Why this matters:** Roundup U8/U9 require both a coherent atomic-generation
implementation and a separately authorized live demo setup. The atomic implementation
is merged. Live activation still requires two private demo repositories, an approved
history-free release manifest with clean content scans, a read-only source credential,
a destination token restricted to exactly the two demo repositories, and explicit
live-write/cron authority.

1. **Yes; prepare the two scoped credentials, then let the agent create/seed the repos — recommended.** This preserves the plan’s credential-isolation guarantee.
2. Create and seed the repos now with the current operator credential; replace it before automation. Faster, but weakens the plan’s proof and creates temporary broad authority.
3. Defer demo mode until PROD is settled.

**Decision:** `D3 = 1` — prepare the secure path now. The implementation is merged.
Repository creation, seeding, cron, and live refresh remain gated in
[API #31](https://github.com/alea-institute/ontokit-api/issues/31) by source-owner
approval, clean content scans, two separately scoped credentials, and explicit
live-write/cron authority; the current broad operator credential will not be substituted.

## D4. What should happen with CatholicOS upstream delivery?

**Current evidence:** The refreshed gap is 277 commits, not ~690. ALEA has internal staging PRs, but there is no final dependency map or CatholicOS feature PR series.

1. **Map now; authorize sends tranche-by-tranche later — recommended.** U14 produces accurate scope without consuming CatholicOS reviewer attention yet.
2. Start smallest-first now with #344, #345, and #361 as separate issue-linked PRs.
3. Keep shipping only on ALEA until PROD and demo mode are settled.

**Historical decision:** Prepare as much implementation and mapping work as possible first, then create the CatholicOS issues and their linked PRs together as one final batch. That authorization was superseded by the later ALEA-only execution boundary below.

**Current controlling scope:** the later instruction to clean and publish on the ALEA side holds the external batch. Web #30 preserves the prepared work until the user grants renewed CatholicOS-side execution authority. Self-merge remains prohibited.

## D5. What should happen with PR Party’s unwired reviewer-PAT encryption rewrap?

**What is being rotated:** not the GitHub token. `rotate_reviewer_token` keeps the same reviewer PAT and re-encrypts its stored ciphertext under OntoKit’s current `SECRET_KEY`, allowing `SECRET_KEY_PREVIOUS` to be retired. GitHub PAT replacement or revocation is a separate reviewer-controlled action.

**Why this matters:** the helper is exported and tested but unwired. Leaving it that way makes dead code look like a shipped encryption-key migration control.

1. **Wire an operator-triggered bulk rewrap task — recommended.** Re-encrypts stored reviewer PATs under the current OntoKit key with an audit receipt and no token exposure.
2. Delete the function and tests; document that key retirement requires reviewers to re-enter valid PATs.
3. Leave it and accept the tracked debt.

**Decision:** `D5 = 1` — implement the operator-triggered bulk rewrap with best-practice safety controls.

**Execution status (2026-08-28):** Implemented, reviewed, validated, and merged into ALEA `dev` by API PR #24. The task is dry-run by default, requires exact confirmation plus the expected stable job ID at the worker boundary, rotates all reviewer-credential ciphertext atomically, redacts SQL parameters, and returns only counts and credential-row UUIDs. It has not been deployed or executed against stored credentials.

## D6. Do you want to register `ontokit.org` now?

**Current evidence:** Registration was selected, but public RDAP still returns not found and authoritative NS/A lookups return no records as of 2026-08-21. Confirmed registration and DNS control are the remaining prerequisites before picker implementation can start.

1. Register it now; then the agent builds the static picker.
2. **Defer registration and keep U17 parked — recommended unless the picker is a current priority.**
3. Choose a different domain; provide the name.

**Decision:** `D6 = 1` — Damien selected registration and will decide separately
whether to transfer it later. The agent will recheck rather than re-ask. Picker work
waits for observable registration/control, both final destination domain names, and
explicit DNS/TLS authority, as tracked in
[web #28](https://github.com/alea-institute/ontokit-web/issues/28).

## Resolved autonomously: optional auth without Zitadel

Current `AUTH_MODE=optional` deliberately supports anonymous browsing when Zitadel is not configured. The web #360 implementation preserves that established contract: an unconfigured optional deployment registers no provider, while any configured or required Zitadel setup is validated coherently and never falls back to localhost.

No user decision is required unless you want to change that contract.

## Activation condition resolved; Google federation execution parked

No further judgment answer is needed. Google federation remains parked until the CatholicOS-side and ALEA-side domain-name questions are resolved and private OAuth provisioning is available. Domain resolution replaces the earlier login-friction-only activation condition for the current queue.

## Resolved: PR Party external coordination

Prepare the implementation and outreach package locally. Begin outreach only when the demo is ready; do not contact the CatholicOS organization earlier.

## Resolved decision queue

Damien approved the recommended choices on 2026-08-29. Each residual remains tracked in a durable ALEA issue; these decisions authorize ALEA implementation only and do not authorize deployment or external mutation.

### D7. How should a multi-store demo refresh become visible?

**Why this matters:** Git, database provisioning, and index preparation cannot commit in one transaction. Readers must not observe a mixed old/new demo generation.

1. **Prepare the complete generation off to the side and atomically switch visibility — recommended.** Coherent, uninterrupted reads; more implementation and temporary storage.
2. Temporarily unpublish the demo during refresh. Simpler; accepts a maintenance window.

**Decision:** `D7 = 1` — prepare the full generation off to the side and atomically switch visibility. Tracked in [API #25](https://github.com/alea-institute/ontokit-api/issues/25).

**Execution status (2026-08-29):** Implemented, reviewed, fully validated, and
squash-merged to ALEA `dev` by [API PR #35](https://github.com/alea-institute/ontokit-api/pull/35)
as `d84b52831e9cd77bdc608018d0c288d342475258`. API #25 is closed. Live repository,
credential, and cron activation remains gated in [API #31](https://github.com/alea-institute/ontokit-api/issues/31);
retired-generation retention remains in [API #32](https://github.com/alea-institute/ontokit-api/issues/32).

### D8. What context may the PR Party `@claude` answerer read?

**Why this matters:** the answerer has no tools, but unbounded PR text can still carry prompt injection or unrelated sensitive context.

1. **PR title, triggering comment, and a small allowlisted metadata envelope — recommended.** Strongest containment and simplest audit; sometimes less context.
2. A larger nonce-delimited PR excerpt. Richer answers; larger injection and disclosure surface.

**Resolution:** No new decision was required. The implementation merged by API PR #24 already uses option 1: the triggering comment and pull-request title are the only untrusted text inputs, each inside a per-run nonce-delimited envelope. Remaining live activation gates stay tracked in [API #26](https://github.com/alea-institute/ontokit-api/issues/26).

### D9. Where should the persistent demo notice live?

**Why this matters:** the current fixed bottom `z-50` banner remains visible, but can overlap editor or modal controls on small viewports.

1. **Put it in the project shell's layout flow, sticky with reserved space — recommended.** Persistent without modal overlap.
2. Keep it fixed and add responsive offsets/collision handling. Smaller change; more overlay edge cases.

**Decision:** `D9 = 1` — place the notice in the project shell's sticky layout flow with reserved space. Tracked in [web #24](https://github.com/alea-institute/ontokit-web/issues/24).

**Execution status (2026-08-29):** Implemented, reviewed, fully validated, and
squash-merged to ALEA `dev` by [web PR #35](https://github.com/alea-institute/ontokit-web/pull/35)
as `dcc6326fc2564f1abc353fd4bff590943e32cc49`. Web #24 is closed.

### D10. What should prevent whole-document lost updates?

**Why this matters:** local draft and mutation-state safeguards do not stop two collaborators from saving from the same server revision.

1. **Add revision-based compare-and-set first — recommended.** Smallest complete boundary; stale saves receive a typed reconcile conflict.
2. Replace whole-document saves with atomic semantic API mutations now. Better long-term collaboration semantics; materially larger redesign.

Option 1 can be followed by option 2 later.

**Decision:** `D10 = 1` — implement revision-based compare-and-set first. Any semantic-mutation redesign is a separate future scope decision. Tracked in [web #26](https://github.com/alea-institute/ontokit-web/issues/26).

**Execution status (2026-08-29):** Implemented and squash-merged to ALEA `dev`
as a coordinated pair: [API PR #34](https://github.com/alea-institute/ontokit-api/pull/34)
(`5b355bbca6d9afcd1c43d7bc0c2643dd846071ea`) and
[web PR #35](https://github.com/alea-institute/ontokit-web/pull/35)
(`dcc6326fc2564f1abc353fd4bff590943e32cc49`). API #33 and web #26 are closed.
Stale saves now receive a typed conflict, and the web preserves that conflict until
the user explicitly loads the latest revision. A final design review found that the
discard action warned but did not actually confirm. [Web PR #37](https://github.com/alea-institute/ontokit-web/pull/37)
added explicit cancel/confirm/failure states and was squash-merged to `dev` as
`bbf8ec3250d86a324f171d667e2d527f5f641411`; web #36 is closed.

## Open product/taste decision

### D11. What should happen when someone opens a retired demo-generation URL?

**Why this matters:** atomic refresh deliberately retains old generations for safe
rollback and in-flight readers. A bookmarked project ID can therefore refer to a
retired generation after the public demo switches. Returning a generic 404 loses
useful navigation context; silently serving the retired copy risks showing stale data.

1. **Redirect to the current generation and show a clear notice — recommended.**
   Preserves bookmarks and gets visitors to current data; requires an explicit mapping
   and loop-safe redirect behavior.
2. Show a retirement page with a link to the current generation. More explicit and
   easier to reason about, but adds an extra step for every old bookmark.
3. Return 404 after the retention window. Simplest long-term behavior, but breaks old
   links and gives the least recovery help.

**Current status:** saved in [web #34](https://github.com/alea-institute/ontokit-web/issues/34).
No implementation or external action is authorized until this product choice is made.
Destructive generation cleanup in [API #32](https://github.com/alea-institute/ontokit-api/issues/32)
must wait for D11 and preserve whatever tombstone, alias, or stable source-identity
mapping the selected behavior requires.

### D12. Who should steward the recurring activation queue?

**Why this matters:** every remaining gate has a responsible role, trigger, and
receipt, but the open ALEA issues do not have named individual assignees. Without one
umbrella steward, the promised start-of-session and 30-day sweeps can silently lapse.
Assignment creates accountability; it does not authorize activation.

1. **Assign Damien as umbrella queue steward until each task is delegated —
   recommended.** One accountable owner prevents silent aging; specialized release,
   security, identity, source, and operations roles still own execution approval.
2. Leave the issues unassigned and rely on session-based sweeps. Lower notification
   load; weaker accountability.
3. Name one or more different ALEA stewards. Best delegation, but requires the names
   and issue mapping.

**Current status:** saved in [web #38](https://github.com/alea-institute/ontokit-web/issues/38).
No assignee was inferred during closeout.

## Activation gates that do not need a decision now

- Authenticated DEV acceptance waits for an approved UAT session and explicit throwaway-state authority: [web #27](https://github.com/alea-institute/ontokit-web/issues/27).
- PR Party answerer external activation waits for the named demo-readiness, private credential, installation-approval, and outreach gates; its bounded D8 context is already merged: [API #26](https://github.com/alea-institute/ontokit-api/issues/26).
- D7's generation-visibility implementation is merged. Live demo repository activation still waits for source-owner release approval, clean content scans, two separately scoped credentials, and explicit live-write/cron authority: [API #31](https://github.com/alea-institute/ontokit-api/issues/31).
- Retired demo generations remain fail-safe and durable; bounded retention/deletion waits for [API #32](https://github.com/alea-institute/ontokit-api/issues/32), and retired-link behavior waits for D11/[web #34](https://github.com/alea-institute/ontokit-web/issues/34). Cleanup cannot delete the lookup data required by the selected D11 behavior.
- The D5 ciphertext-rewrap design and implementation are settled. Execution against stored reviewer credentials still requires a deployed API revision, a named operator and authorized window, a successful dry run bound to the stable job ID, atomic rewrap verification, and retention of the previous key until every credential decrypts under the current key: [API #30](https://github.com/alea-institute/ontokit-api/issues/30).
- AWS/PROD waits for Mike's access and the already-selected parallel stand-up plus runtime-network prerequisites: [API #27](https://github.com/alea-institute/ontokit-api/issues/27).
- Domain-dependent picker work waits for registration, both destination domain names, and DNS/TLS authority: [web #28](https://github.com/alea-institute/ontokit-web/issues/28).
- Google federation waits for both domain contracts and private OAuth provisioning: [API #28](https://github.com/alea-institute/ontokit-api/issues/28).
- `folio-python` replacement waits for the first verified safe official release at or above 0.4.0: [API #29](https://github.com/alea-institute/ontokit-api/issues/29).
- CatholicOS delivery is held in the ALEA queue pending refreshed bases and renewed cross-organization authority; CatholicOS self-merge remains prohibited: [web #30](https://github.com/alea-institute/ontokit-web/issues/30).

## Defaults that do not need a decision

- PyPI currently lists `folio-python` 0.3.6 as the latest release. The dependency change remains parked until a verified safe official release at or above 0.4.0 exists; the unresolvable 0.4.0 pin was not replayed.
- The complete reviewed ALEA web stack is merged by [web PR #25](https://github.com/alea-institute/ontokit-web/pull/25), [web PR #35](https://github.com/alea-institute/ontokit-web/pull/35), and [web PR #37](https://github.com/alea-institute/ontokit-web/pull/37); the complete reviewed API stack is merged by [API PR #24](https://github.com/alea-institute/ontokit-api/pull/24), [API PR #34](https://github.com/alea-institute/ontokit-api/pull/34), and [API PR #35](https://github.com/alea-institute/ontokit-api/pull/35).
- Web final validation passed 217 files/3,365 tests, type-check, zero-error lint, and an optional-auth release-fidelity build. API final validation passed 2,932 tests with 32 external-fixture skips, Ruff, formatting, Pyright 0/0, one Alembic head, and remote CI.
- The ALEA deployment, security, and feature synthesis, including the security closure and dormant PROD Stage A, is incorporated in the two merged implementation PRs. This grants no deployment or PROD activation authority.
- D7, D9, and D10 are incorporated in merged API PRs #34/#35 and web PR #35. Their implementation trackers are closed; only D11 and named activation/retention gates remain.
- The current execution scope is ALEA-only. CatholicOS issue/PR mutation remains held in web #30; CatholicOS self-merge is not authorized.
