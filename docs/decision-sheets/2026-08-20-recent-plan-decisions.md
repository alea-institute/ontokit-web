# Decision Sheet — Recent OntoKit Plan Residuals

Created: 2026-08-20
Updated: 2026-08-28 after the ALEA implementation merges and final structured review

The recommended choices are first. D1–D6 are settled. The shortest useful reply is `D7 = 1; D8 = 1; D9 = 1; D10 = 1` (or change any number).

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

**Why this matters:** Roundup U8/U9 are the largest fully missing feature. The build requires two private demo repos plus separate credentials: a read-only source credential and a destination token restricted to exactly the two demo repos.

1. **Yes; prepare the two scoped credentials, then let the agent create/seed the repos — recommended.** This preserves the plan’s credential-isolation guarantee.
2. Create and seed the repos now with the current operator credential; replace it before automation. Faster, but weakens the plan’s proof and creates temporary broad authority.
3. Defer demo mode until PROD is settled.

**Decision:** `D3 = 1` — prepare the secure path now. Repository creation, seeding, and live refresh wait for two separately scoped credentials; the current broad operator credential will not be substituted.

## D4. What should happen with CatholicOS upstream delivery?

**Current evidence:** The refreshed gap is 277 commits, not ~690. ALEA has internal staging PRs, but there is no final dependency map or CatholicOS feature PR series.

1. **Map now; authorize sends tranche-by-tranche later — recommended.** U14 produces accurate scope without consuming CatholicOS reviewer attention yet.
2. Start smallest-first now with #344, #345, and #361 as separate issue-linked PRs.
3. Keep shipping only on ALEA until PROD and demo mode are settled.

**Decision:** Prepare as much implementation and mapping work as possible first, then create the CatholicOS issues and their linked PRs together as one final batch. This is explicit authorization for that final batch after local work and validation are complete; it is not authorization to self-merge.

**Current scope:** the later instruction to clean and publish on the ALEA side holds the external batch. Web #30 preserves the prepared work until the user resumes CatholicOS-side execution.

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

**Decision:** `D6 = 1` — Damien selected registration and will decide separately whether to transfer it later. The agent will recheck rather than re-ask; picker activation waits for registration and DNS control to become externally observable.

## Resolved autonomously: optional auth without Zitadel

Current `AUTH_MODE=optional` deliberately supports anonymous browsing when Zitadel is not configured. The web #360 implementation preserves that established contract: an unconfigured optional deployment registers no provider, while any configured or required Zitadel setup is validated coherently and never falls back to localhost.

No user decision is required unless you want to change that contract.

## Resolved: Google federation activation

Google federation remains parked until the CatholicOS-side and ALEA-side domain-name questions are resolved. Domain resolution replaces the earlier login-friction-only activation condition for the current queue.

## Resolved: PR Party external coordination

Prepare the implementation and outreach package locally. Begin outreach only when the demo is ready; do not contact the CatholicOS organization earlier.

## Current decision queue

These are the only unanswered judgment or taste questions found by the final review. Each has a durable ALEA issue; answering them does not authorize deployment or external mutation.

### D7. How should a multi-store demo refresh become visible?

**Why this matters:** Git, database provisioning, and index preparation cannot commit in one transaction. Readers must not observe a mixed old/new demo generation.

1. **Prepare the complete generation off to the side and atomically switch visibility — recommended.** Coherent, uninterrupted reads; more implementation and temporary storage.
2. Temporarily unpublish the demo during refresh. Simpler; accepts a maintenance window.

**Your answer:** `D7 = 1 or 2` — tracked in [API #25](https://github.com/alea-institute/ontokit-api/issues/25).

### D8. What context may the PR Party `@claude` answerer read?

**Why this matters:** the answerer has no tools, but unbounded PR text can still carry prompt injection or unrelated sensitive context.

1. **PR title, triggering comment, and a small allowlisted metadata envelope — recommended.** Strongest containment and simplest audit; sometimes less context.
2. A larger nonce-delimited PR excerpt. Richer answers; larger injection and disclosure surface.

**Your answer:** `D8 = 1 or 2` — tracked in [API #26](https://github.com/alea-institute/ontokit-api/issues/26).

### D9. Where should the persistent demo notice live?

**Why this matters:** the current fixed bottom `z-50` banner remains visible, but can overlap editor or modal controls on small viewports.

1. **Put it in the project shell's layout flow, sticky with reserved space — recommended.** Persistent without modal overlap.
2. Keep it fixed and add responsive offsets/collision handling. Smaller change; more overlay edge cases.

**Your answer:** `D9 = 1 or 2` — tracked in [web #24](https://github.com/alea-institute/ontokit-web/issues/24).

### D10. What should prevent whole-document lost updates?

**Why this matters:** local draft and mutation-state safeguards do not stop two collaborators from saving from the same server revision.

1. **Add revision-based compare-and-set first — recommended.** Smallest complete boundary; stale saves receive a typed reconcile conflict.
2. Replace whole-document saves with atomic semantic API mutations now. Better long-term collaboration semantics; materially larger redesign.

Option 1 can be followed by option 2 later.

**Your answer:** `D10 = 1 or 2` — tracked in [web #26](https://github.com/alea-institute/ontokit-web/issues/26).

## Activation gates that do not need a decision now

- Authenticated DEV acceptance waits for an approved UAT session and explicit throwaway-state authority: [web #27](https://github.com/alea-institute/ontokit-web/issues/27).
- Demo repository activation waits for source-owner release approval, clean content scans, two separately scoped credentials, and explicit live-write/cron authority: [API #25](https://github.com/alea-institute/ontokit-api/issues/25).
- AWS/PROD waits for Mike's access and the already-selected parallel stand-up plus runtime-network prerequisites: [API #27](https://github.com/alea-institute/ontokit-api/issues/27).
- Domain-dependent picker work waits for registration, both destination domain names, and DNS/TLS authority: [web #28](https://github.com/alea-institute/ontokit-web/issues/28).
- Google federation waits for both domain contracts and private OAuth provisioning: [API #28](https://github.com/alea-institute/ontokit-api/issues/28).
- `folio-python` replacement waits for the first verified safe official release at or above 0.4.0: [API #29](https://github.com/alea-institute/ontokit-api/issues/29).
- CatholicOS delivery is held in the ALEA queue pending refreshed bases and renewed cross-organization authority; self-merge remains prohibited: [web #30](https://github.com/alea-institute/ontokit-web/issues/30).

## Defaults that do not need a decision

- PyPI currently lists `folio-python` 0.3.6 as the latest release. The dependency change remains parked until a verified safe official release at or above 0.4.0 exists; the unresolvable 0.4.0 pin was not replayed.
- The complete reviewed ALEA web stack is merged by [web PR #25](https://github.com/alea-institute/ontokit-web/pull/25); the complete reviewed API stack is merged by [API PR #24](https://github.com/alea-institute/ontokit-api/pull/24).
- Web final validation passed 217 files/3,365 tests, type-check, zero-error lint, and an optional-auth release-fidelity build. API final validation passed 2,932 tests with 32 external-fixture skips, Ruff, formatting, Pyright 0/0, one Alembic head, and remote CI.
- The ALEA deployment, security, and feature synthesis, including the security closure and dormant PROD Stage A, is incorporated in the two merged implementation PRs. This grants no deployment or PROD activation authority.
- The current execution scope is ALEA-only. CatholicOS issue/PR mutation remains held in web #30; no self-merge is authorized.
