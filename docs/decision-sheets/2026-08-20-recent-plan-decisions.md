# Decision Sheet — Recent OntoKit Plan Residuals

Created: 2026-08-20

The recommended choices are first. Reply with short answers such as `D1 = 1; D2 = 1; D7 = 1`.

## D1. How should the main line reach PROD?

**Why this matters:** U13 and U15 cannot be finished honestly until the rollout shape is fixed. PROD is healthy and public today. The main line is a nine-service, auth-capable stack.

1. **Parallel stand-up, UAT, then DNS cutover — recommended.** Build on a separate hostname, prove it, then move DNS. Existing PROD stays reversible throughout.
2. In-place promotion with a tested rollback plan. Fewer hostnames, but the current public service carries the migration risk.
3. Keep the public FOLIO browser and the auth product on permanent separate URLs. No cutover; two intentionally distinct products.

**Your answer:** `D1 = 1, 2, or 3`

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

**Your answer:** `D3 = 1, 2, or 3`

## D4. What should happen with CatholicOS upstream delivery?

**Current evidence:** The refreshed gap is 277 commits, not ~690. ALEA has internal staging PRs, but there is no final dependency map or CatholicOS feature PR series.

1. **Map now; authorize sends tranche-by-tranche later — recommended.** U14 produces accurate scope without consuming CatholicOS reviewer attention yet.
2. Start smallest-first now with #344, #345, and #361 as separate issue-linked PRs.
3. Keep shipping only on ALEA until PROD and demo mode are settled.

**Your answer:** `D4 = 1, 2, or 3`

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

**Your answer:** `D6 = 1, 2, or 3`

## D7. Must optional auth still work without Zitadel?

**Why this matters:** Current `AUTH_MODE=optional` deliberately supports anonymous browsing when Zitadel is not configured. Web #360 instead proposes failing startup whenever optional mode lacks an issuer. Both avoid the bad localhost fallback, but they define different deployment contracts.

1. **Keep optional-without-Zitadel — recommended.** Remove the localhost fallback, register no provider when Zitadel is absent, and keep anonymous browsing available. This preserves the current contract.
2. Require Zitadel in optional mode. Missing issuer/client settings fail startup; optional means anonymous browsing plus a working sign-in path.
3. Retire optional-without-Zitadel after a documented deprecation window. Warn first, then adopt option 2 in a later release.

**Your answer:** `D7 = 1, 2, or 3`

## Defaults that do not need a decision

- Google federation remains parked until a real login-friction complaint fires its documented trigger.
- `folio-python` remains unpinned until a release containing the required security fixes is published; PyPI still serves 0.3.6, and the exact future version must be rechecked rather than assumed.
- Web #348/#359/#360, API #208/#212, the auto-accept live UAT, and cosmetic Turtle churn stay in the autonomous queue.
- No push, issue, PR, or other mutation is sent to CatholicOS without an explicit authorization that names the tranche.
