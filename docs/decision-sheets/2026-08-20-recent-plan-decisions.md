# Decision Sheet — Recent OntoKit Plan Residuals

Created: 2026-08-20
Updated: 2026-08-20 after the user settled rollout, upstream batching, domain, and external-coordination choices

The recommended choices are first. Reply with short answers such as `D1 = 1; D2 = 1; D3 = 1; D4 = 1; D5 = 1; D6 = 2`.

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

**Your answer:** `D2 = 1, 2, or 3`

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

## D5. What should happen with PR Party’s dead token-rotation capability?

**Why this matters:** `rotate_reviewer_token` is exported and tested but unwired. Leaving it that way makes dead code look like a shipped security control.

1. **Wire an operator-triggered rotation task — recommended.** Delivers the intended credential-hygiene capability.
2. Delete the function and tests; document manual rotation.
3. Leave it and accept the tracked debt.

**Your answer:** `D5 = 1, 2, or 3`

## D6. Do you want to register `ontokit.org` now?

**Current evidence:** The domain returns NXDOMAIN. Registration is the only blocker before picker implementation can be scheduled.

1. Register it now; then the agent builds the static picker.
2. **Defer registration and keep U17 parked — recommended unless the picker is a current priority.**
3. Choose a different domain; provide the name.

**Decision:** `D6 = 1` — Damien is registering `ontokit.org` now and will decide separately whether to transfer it later. Picker activation waits only for confirmed registration and DNS control.

## Resolved autonomously: optional auth without Zitadel

Current `AUTH_MODE=optional` deliberately supports anonymous browsing when Zitadel is not configured. The web #360 implementation preserves that established contract: an unconfigured optional deployment registers no provider, while any configured or required Zitadel setup is validated coherently and never falls back to localhost.

No user decision is required unless you want to change that contract.

## Resolved: Google federation activation

Google federation remains parked until the CatholicOS-side and ALEA-side domain-name questions are resolved. Domain resolution replaces the earlier login-friction-only activation condition for the current queue.

## Resolved: PR Party external coordination

Prepare the implementation and outreach package locally. Begin outreach only when the demo is ready; do not contact the CatholicOS organization earlier.

## Defaults that do not need a decision

- `folio-python` 0.4.0 is published; the tested local API branch now pins it exactly and removes `owlready2`.
- Web #348/#359/#360, cosmetic Turtle churn, the production-build blocker, and API #208/#209/#211/#212 are implemented on tested local branches. Publication/integration and the authenticated auto-accept live UAT remain.
- CatholicOS issue/PR mutation is authorized only as the final linked batch after the current local implementation and validation work. No self-merge is authorized.
