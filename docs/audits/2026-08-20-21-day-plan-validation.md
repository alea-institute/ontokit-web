# 21-day plan validation — 2026-07-30 through 2026-08-20

> **Superseded:** This was the preliminary audit committed during the validation run. Use [`2026-08-20-recent-plan-completion-audit.md`](./2026-08-20-recent-plan-completion-audit.md) for the reconciled 52-unit ledger and current execution receipts. A later official PyPI metadata check confirmed the preliminary observation that `folio-python` 0.4.0 was published.

**Audit date:** 2026-08-20  
**Scope:** every task-bearing plan, handoff, outline, residual-review record, and reachable branch in `ontokit-web` during the inclusive 21-day window; implementation evidence in the ALEA `ontokit-web` and `ontokit-api` forks; current GitHub PR/issue state; current Cockpit answers where an old handoff pointed to them.

## Bottom line

The interrupted work was not fully complete. The feature plans for translations and the submission audit snapshot shipped, the U7 sweep bugs shipped, and the data-loss blocker shipped. The main roundup plan is only partially complete: U8/U9, U13/U14, U15-U17, and the final U18 closeout remain. U11 and U12 delivered substantial working infrastructure but do not satisfy every strict plan proof.

This audit found no plan-document activity from July 30 through August 7. The seven formal plan artifacts in the window begin on August 8. Older July 24-28 plans are included only where an August artifact explicitly carried their unfinished work forward.

## Formal plan inventory

| Plan | Result | Evidence and remaining work |
| --- | --- | --- |
| `2026-08-08-001-feat-ontokit-roundup-execution-plan.md` | **PARTIAL** | U1-U7 and U10 shipped. U11 CI runs, but required-check branch protection and the deliberate red-run proof were absent on 2026-08-20. U12 DEV IaC/deploy is live, but U8's cron could not be captured and the strict matched-pair/atomic-rollback proof is incomplete. U8/U9, U13-U17, and U18 closeout remain. |
| `2026-08-09-001-feat-translations-annotation-plan.md` | **BUILT/FORK-MERGED; ACCEPTANCE GAP** | API/web ALEA PRs #12 merged to `feat/pr-party`; API real-seam U14 caught four integration bugs; web U10-U13 and review/simplification commits are present. No translation-specific DEV visual/UAT record was found for settings, editor, coverage/backfill, and review surfaces. |
| `2026-08-09-002-audit-intent2-auto-accept-closure.md` | **IMPLEMENTED; ONE PROOF GAP** | The already-built feature merged with translations. Audit-snapshot integration covers a ripe sweep, but no dedicated live quiet-period clock/halt/resume/TRUSTED-gate UAT was found. Its `satisfied-pending-merge` metadata is now stale. |
| `2026-08-09-003-feat-submission-audit-snapshot-plan.md` | **BUILT/FORK-MERGED; VISUAL GAP** | U1-U6 implemented; API/web ALEA PRs #13 merged through translations into `feat/pr-party`; AE1-AE7 real-Postgres proof exists. The planned settings-page visual check is not durably recorded. |
| `2026-08-10-001-feat-google-federation-zitadel-plan.md` | **DORMANT BY DESIGN** | Trigger-gated until login friction becomes a live complaint. No interruption and no present implementation obligation. |
| `2026-08-13-001-fix-u7-sweep-bugs-plan.md` | **CORE COMPLETE; OPTIONAL TAIL OPEN** | U1-U5 merged in ALEA web PR #18, deployed, and live-verified. Optional U6 is still CatholicOS web #348. Follow-up web #360 remains outside the original client-side fix. |
| `2026-08-13-002-fix-annotation-data-loss-plan.md` | **CORE COMPLETE; RESIDUALS OPEN** | API/web fixes merged in ALEA PRs #22/#19, deployed, and live-verified. U4 cosmetic serialization churn remains. CatholicOS API #212 records the broader indexed/RDFLib predicate-parity gap; synonym editing and property/individual writer audits remain explicitly deferred. |

The two August 13 plans exist on `origin/feat/pr-party` and their fix branches, not on the older docs branch. They were therefore invisible in the initial current-tree listing but are included here.

## Roundup task ledger

| Unit | Status | Verification / next action |
| --- | --- | --- |
| U1 mint validation + 422 detail | **Complete** | API red/green commits and live UAT submit pass. |
| U2 default-branch resolution | **Complete** | Symbolic-HEAD fix and live curl parity. |
| U3 public projects list | **Complete** | Web commit and live browser proof. |
| U4 browser UAT sweep | **Complete** | DEV UAT log records F7/F8 closure and clean happy paths. |
| U5 suggestion lifecycle | **Complete** | Duplicate, external parent, branch, PR, merge, and trust proof; named-persona attribution completed under U7. |
| U6 retrospective review | **Complete as review** | Five lenses committed. Its findings remain tracked in their owning units/issues; the review itself is done. |
| U7 Zitadel persona pass | **Complete** | Auth-on terminal sweep and four personas passed; later #344/#345 defects merged and deployed. |
| U8 dummy repos + refresh | **Not started / user action required** | Needs the two private repos plus destination-only and source-read-only credentials. No repo/job evidence exists. |
| U9 cloned demo mode + target authorizer | **Not started** | Engineering can begin once U8's repo/token contract exists; live proof depends on U8. |
| U10 auto-save preference | **Implementation complete; acceptance partial** | ALEA web PR #17 merged; legacy state migration browser-verified. The plan's full DEV check of both auto-save and manual-save modes is not durably recorded. |
| U11 test CI | **Partial** | Both fork suites run green, real services are present, and actionlint is pinned. As of this audit `feat/pr-party` has no branch protection/ruleset, so the plan's “required status checks” condition is unmet; deliberate broken-draft proof was not found. |
| U12 DEV deploy + IaC | **Partial but operational** | IaC, forced-command deploy, Environment approval, and live deploy exist. U8 cron capture is necessarily absent. Strict matched-SHA manifest, atomic rollback, and full-history secret-scan evidence were not all found. CatholicOS API #211 also confirms the deploy script can validate after checking out new SHAs and its `status` can report git heads rather than running images. |
| U13 dormant PROD gate | **Not started; decision-gated** | The August 15 handoff says nothing PROD-side was built pending the promotion mechanism. |
| U14 upstream map + tranche 1 | **Not started** | No `UPSTREAM-DELIVERY-MAP.md` exists on any ref; zero CatholicOS feature PRs have been sent. Final cut should follow U9 as the plan requires. |
| U15 AWS PROD rebuild | **Blocked externally** | Damien approved the SSH rule; Mike/AWS access has not been observed. PROD mechanism is still undecided. |
| U16 PR Party live E2E | **Blocked externally and by U9** | Needs demo mode plus Fr. John's PAT/webhook/answerer/shared-token gates and per-send approval. |
| U17 `ontokit.org` picker | **Blocked on domain/spend decision** | No registration or alternative is recorded. |
| U18 closeout | **Partial** | The real-seam learning landed. Final gate-status, upstream closeout, active-handoff retirement, and complete cleanup cannot finish before U13/U14 and external gates are settled or formally deferred. |

## Unfinished work queue

### Autonomous lane — no new product decision required

Ordered to preserve dependencies:

1. **Documentation truth pass** — retire the completed Phase-A and August-10 handoffs; supersede stale F-c/F-d and U12 residuals in the runbook/UAT log. **Executed in this audit session.**
2. **Web hygiene bundle** — CatholicOS web #348 (audit view residuals), #359 (deterministic Node 25 localStorage test environment), and #360 (fail-fast server issuer configuration). Work from `origin/feat/pr-party`; verify and ship to the ALEA fork.
3. **Annotation residual** — finish plan U4 so Turtle edits avoid unrequested `@en` and formatting churn, with byte-focused tests.
4. **API correctness bundle** — CatholicOS API #211 (validate before mutation and truthful deploy status) and #212 (one annotation definition across indexed/RDFLib paths). This belongs in `ontokit-api`, not this checkout.
5. **FOLIO dependency follow-through** — `folio-python` 0.4.0 was published on 2026-08-18, superseding the planned 0.3.7 gate. Verify compatibility, pin the secure release, remove already-approved unused `owlready2`, update the lockfile, and run API gates (CatholicOS API #209).
6. **Live acceptance bundle** — verify translations settings/editor/coverage/backfill/review, the audit settings view, U10's two modes, and the editor/admin personas on DEV.
7. **Auto-accept operational proof** — run a dedicated real-clock or safely time-compressed DEV scenario covering enable/N days, halt/resume, TRUSTED-only acceptance, and non-eligible users.
8. **U11 strict closure** — prove an intentional red PR run, then require the intended checks on the integration branch without requiring soft `pyright` on API.
9. **U12 strict closure** — fix #211; add/verify matched-pair release manifest, atomic rollback receipt, and full-history secret scan. Capture the U8 cron after U8 exists.
10. **U9 engineering** — build the project-aware target authorizer, demo provisioning, banner/navigation, and refusal tests after U8's identifiers/secrets contract is available.
11. **U14 map/drafts** — create the dependency-ordered map and tranche-1 drafts after U9 establishes the final cutoff. Do not send anything to CatholicOS without the existing explicit approval gate.
12. **U18 final closeout** — close or consciously defer every residual, retire the active August 15 handoff, and record terminal state.

### User action or decision lane

These are normalized in the companion Decision Sheet:

- Choose the safe PROD promotion mechanism; then obtain/confirm Mike's AWS access.
- Activate U8 by creating/authorizing the two demo repositories and scoped credentials, or formally defer demo mode.
- Decide the `ontokit.org` domain/spend path.
- Decide whether to start CatholicOS upstream delivery once the U14 map exists; every send remains approval-gated.
- Resolve PR Party's dead-but-tested `rotate_reviewer_token` function: wire or delete.
- Complete an already-made decision that is now unblocked: pin published `folio-python` 0.4.0 in `ontokit-api` and remove `owlready2` as already approved.

### Intentionally parked, not interrupted

- Google federation inside Zitadel remains dormant until its complaint trigger fires.
- PR Party U14 remains parked behind U9 and the named Fr. John gates; it should not be “worked around.”
- AWS and domain gates remain parked rather than replaced with a different topology or domain without a user decision.

## Carry-in and plan-like artifacts

- The July 24 trust-ladder plan is broadly implemented, but no single artifact closes every one of its 15 unit proofs. Its N-day auto-accept proof gap is carried above.
- The July 26 review-dashboard plan is superseded by the native PR Party plan. The native plan's live U14 remains blocked; code-review residuals include live-Postgres coverage and the token-rotation choice.
- The August master outline and in-flight status were consolidation inputs, not competing execution plans. Their unfinished items are absorbed into roundup U8/U9/U13-U17.
- The FOLIO tooling verdict is complete as a decision. Its release gate cleared when `folio-python` 0.4.0 published on 2026-08-18; pinning it and removing `owlready2` remain cross-repo implementation work.
- The LLM P0/P1 residual review drove a large verified fix series. Remaining P2/P3 items are backlog, not silently assumed complete.

## Evidence limits

- “Complete” means the plan unit and its intended integration result are evidenced, usually on `feat/pr-party`; it does not mean merged to the ALEA default branch or CatholicOS upstream.
- Live DEV proof is based on the committed UAT/handoff record plus merged fork PR state. This audit did not mutate DEV, AWS, DNS, Zitadel, or CatholicOS repositories.
- GitHub issue state is not equivalent to implementation state: #344, #345, and #361 remain open upstream intentionally while their ALEA fixes are merged and deployed.
- The current checkout's untracked LLM review is byte-identical to a committed blob on another reachable ref and was preserved untouched.
