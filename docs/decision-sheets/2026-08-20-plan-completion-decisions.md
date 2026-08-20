# Decision Sheet — finish the 21-day OntoKit plan queue

**Prepared:** 2026-08-20  
**How to answer:** reply with the decision IDs and your choices, for example `D1 A, D2 A, D3 B`. Notes are welcome. Previously answered decisions are not repeated.

## Fast path

My recommended set is: **D1 A, D2 A, D3 A, D4 A, D5 A**. That chooses the reversible PROD route, activates demo work, postpones upstream sends until a concrete map exists, wires the claimed PR Party capability, and keeps the picker on its planned domain.

## D1 — PROD mechanism

**Question:** How should the current main-line product reach PROD?

Why this matters: PROD is an auth-free public FOLIO browser on an older, stripped branch. The current product is a multi-service auth-capable stack. This is a parallel stand-up/cutover, not an ordinary in-place update.

- **A — Parallel stand-up, UAT, then DNS cutover (recommended).** Reversible; current PROD stays available throughout.
- **B — In-place promotion.** Requires a written rollback plan and accepts a larger outage/blast-radius risk.
- **C — Keep public FOLIO and the auth product on separate permanent URLs.** No cutover; two enduring products.

After your answer: I can build U13's gated PROD workflow and run every non-AWS proof. Installation and live promotion still wait on Mike/AWS access.

## D2 — Activate demo mode (U8/U9)

**Question:** Should we activate the already-decided cloned-demo design now?

What only you can supply: two private ALEA demo repositories, a destination credential restricted to those two repos, and a source credential with read-only access to the live sources. Do not paste tokens into this document or chat; use the established private secret path.

- **A — Activate now (recommended).** You create/authorize the repo and credential contract; I execute U8 and U9 end-to-end.
- **B — Build code against placeholders now; provision later.** More autonomous progress, but live refusal/token-scope proof remains blocked.
- **C — Formally defer demo mode.** U8/U9 remain open; U14 and PR Party U14 stay downstream-blocked.

## D3 — CatholicOS upstream delivery

**Question:** When the U14 dependency map and tranche drafts are ready, what should happen next?

- **A — Map first, then approve sends tranche-by-tranche (recommended).** No CatholicOS write occurs until you review the concrete issue/PR pair.
- **B — Start smallest fixes now.** Prepare #344, #345, and #361 as the first upstream tranches before the full map.
- **C — Keep shipping only on ALEA until PROD is settled.** Accepts a widening fork gap.

This does not authorize a push, issue, or PR to CatholicOS by itself. Each send remains separately approval-gated.

## D4 — PR Party reviewer-token rotation

**Question:** `rotate_reviewer_token` is exported and tested but has no caller. Should the product claim this capability or remove it?

- **A — Wire an operator-triggered rotation task (recommended).** Makes the credential-hygiene feature real and testable.
- **B — Delete the function and tests.** Honest, small, and reversible; document manual rotation.
- **C — Leave it and file/retain an explicit issue.** Accepts dead-but-tested code temporarily.

## D5 — `ontokit.org` picker gate

**Question:** What should unblock U17?

- **A — Register `ontokit.org` if available at an acceptable normal price (recommended).** Confirm the price before purchase; registration/spend remains yours.
- **B — Choose an alternate domain.** Tell me the domain; I will re-plan DNS/cert/routing around it.
- **C — Formally defer the picker.** U17 remains parked and U18 records the deferral.

## Actions already decided — status only, no re-decision

Please report this as `done`, `in progress`, or `not started`:

- **A1 — Mike/AWS access:** Damien already approved inbound SSH and the outreach. Has Mike received/acted on it? If yes, did the SG rule, IAM access, both, or neither land?

## No decision needed now

- Google federation remains trigger-gated until login friction becomes a live complaint.
- I can clear the web/API residual engineering queues without changing product direction.
- `folio-python` 0.4.0 is now published, so the already-approved API pin plus `owlready2` removal no longer needs a decision.
- I can prepare U13 offline after D1, but cannot touch AWS, DNS, or PROD without the corresponding access and approval.
