# Recent Plan Validation Handoff — 2026-08-20

## Outcome

The 21-day plan audit is complete. Seven formal plan artifacts were found for 2026-07-30 through 2026-08-20. Their 52 formal units are accounted for: 37 are complete on shared integration history, two more are implemented and tested on a local web residual branch, and 13 remain queued or intentionally gated. All five later review/execution follow-ups are now implemented and tested on isolated local branches; publication and upstream synthesis remain.

Use these artifacts as the continuation source:

- Audit ledger: `docs/audits/2026-08-20-recent-plan-completion-audit.md`
- Implementation-ready ce-work plan: `docs/plans/2026-08-20-0836-chore-recent-plan-completion-plan.md`
- Human Decision Sheet: `docs/decision-sheets/2026-08-20-recent-plan-decisions.md`

The preliminary audit and Decision Sheet committed at `e219328b` are explicitly marked superseded. That commit also retired two completed handoffs and refreshed the DEV runbook/UAT record; its history was preserved.

## What this session completed autonomously

- Searched every reachable web-repo ref and the sibling API history for in-window plans, including two August 13 plans absent from this checkout.
- Reconciled every formal unit against commits, merged ALEA PRs, tests, UAT logs, deployment receipts, current GitHub state, DNS, DEV/PROD HTTP health, AWS SSH reachability, and the official PyPI release page.
- Replaced stale external facts: the refreshed CatholicOS gap is 277 commits (113 web, 164 API), `ontokit.org` is NXDOMAIN, PROD is HTTP 200, DEV health is green, AWS SSH is still closed/filtered, and PyPI lists `folio-python` 0.4.0.
- Produced one ordered queue with activation conditions and a six-question Decision Sheet; the former optional-auth question was resolved by preserving existing behavior.
- Ran the required non-interactive document review with coherence, feasibility, scope, security, design, product, and adversarial lenses. The independent cross-model Claude jobs reached their bounded deadline without usable output and are not counted as corroboration.
- Folded review corrections into the plan: writable-branch preflight, corrected decision references, early auto-accept UAT, two-stage upstream mapping, rollout-neutral PROD prework plus access-gated activation, deployment authority controls, PR Party draft prework and workflow-integrity proof, explicit demo-data cleanup tracking, annotation-property classification, UI/accessibility acceptance, and a version-agnostic secure FOLIO release gate.

## Autonomous implementation completed in an isolated checkout

Because `feat/roundup-brainstorm` is a documentation branch 442 commits behind `origin/feat/pr-party`, implementation used an isolated clone based on integration head `83b62b0b`. The reviewed commits were imported into durable local branch `fix/plan-audit-web-residuals` without switching this dirty documentation checkout.

Web U1–U4 plus the production-build repair are implemented in commits `6f5ee59f`, `fea85b6b`, `5ef55edc`, `1697e5e7`, and `4a4dc5bf`. The final tree passes 208 test files/3,298 tests, type-check, lint with zero errors, the optional-auth production build with 24 static pages, and diff checks. The branch is local only.

The sibling API's durable local branch `fix/recent-plan-api-residuals` ends at `0a54857a`. It contains six commits for project-bound audit cursors, declaration-aware annotation parity, `folio-python==0.4.0` with `owlready2` removed, truthful preflight/runtime deploy status, a dormant fail-closed PROD promotion scaffold, and its immutable release pair. The complete API suite passes 2,738 tests against real PostgreSQL and Redis; Ruff, mypy across 182 source files, both deploy harnesses, lock validation, and diff checks pass. No push or merge occurred.

The child API branch `feat/demo-refresh-scaffold` ends at `e894f20f`. It prepares U8 without weakening D3: only the two approved source/destination routes, distinct token enforcement, ambient credential-helper disablement, default-branch-only refresh, preserved demo branches, token-scrubbed resync, nonoverlap lock, inert cron, and runbook. Six focused tests pass, including a real local Git branch-preservation proof. Activation still requires the two private repos, two scoped tokens, manual scope receipts, host installation, and live cron. No external or host state changed.

U9 is now locally implemented on API branch `feat/demo-project-isolation` at `b5b13d8f` and web branch `feat/demo-project-ui` at `d7e490ec`. The API supplies database-enforced demo identity, idempotent provisioning/full reindex, one project-aware outbound-target authorizer, and exact repository identity; the web supplies home and originating-project entry, preparation/unavailable states, server-truth badges and notice, exact resettable-repository naming, and return to the live source. The API tree previously passed 2,760 tests against real PostgreSQL and its 86 project-service unit tests remain green after the response follow-up. The web passes 210 files/3,298 tests, type-check, and lint with zero errors/19 existing warnings; light/dark browser inspection is clean. Both branches are local only. Live repo creation, scoped-token proof, deployment, keyboard/responsive acceptance, and write isolation remain activation-gated.

D5 is locally complete in the API repository at `f3c4251d` on `fix/pr-party-credential-rewrap`. It adds the explicit operator-only reviewer-credential rewrap chosen by the user: dry-run default, exact apply confirmation at both CLI and worker boundaries, stable mode-specific job IDs, all-row transactional rotation, counts/UUID-only receipts, SQL parameter redaction, and a runbook that separates ciphertext rewrap from GitHub PAT replacement and global key retirement. Seventy-eight focused unit tests and two disposable real-Postgres integration tests pass; Ruff, authoritative mypy, and advisory Pyright are clean. The branch is local only and no stored credential was read or changed.

The initial upstream map and T1 drafts now exist under `docs/roundup-2026-08/`. They account for all 277 cutoff commits. Web PR #57's nine feature commits replay cleanly onto current CatholicOS `dev` and all 2,749 scratch tests pass, but the current issuer hardening conflicts and must be synthesized. The unchanged upstream `TurtleEditor.tsx` also prevents a clean type-check signal with the installed toolchain. API replay and final T1 synthesis remain.

Live public browser evidence covers the FOLIO landing/project viewer and both Standard and Developer layouts with no errors or warnings. Authenticated auto-save, translation/audit views, personas, and the auto-accept clock remain credential-gated acceptance work.

## Next execution order

1. Activate U8/U9 only after the two private repositories and separately scoped source/destination credentials exist; then install refresh/resync, seed, run the manual scope receipt, and complete live keyboard/responsive/write-isolation acceptance.
2. Include U9 heads `b5b13d8f` and `d7e490ec`, now recorded in the upstream map, in the final refreshed scratch replay.
3. Immediately before the authorized final batch, refresh CatholicOS `dev` and replay the already-green T1 pair: API `d2c31aea` and web `4986135c`. Create/update issues first, link the PRs, and do not self-merge.
4. Run authenticated DEV acceptance for auto-save, translations/audit, personas, and the auto-accept clock when a suitable UAT session/credential is available.
5. Keep PROD Stage B dormant until branch/environment/CODEOWNERS, smoke credential, AWS access, forced-command, data-path, parallel-host, and UAT gates clear. DNS cutover remains separately approved.
6. Include D5 branch `fix/pr-party-credential-rewrap` at `f3c4251d` in the final issue/PR batch. Deploy or execute it only during a controlled application-key rotation with the previous key retained and every worker on one deployment generation. Activate the already-prepared held PR Party package after demo readiness; outreach waits for the demo.
7. Finish closeout only when every remaining item is complete or has a current, explicit activation condition.

## Protected local state

The following pre-existing files were intentionally excluded from all validation commits:

- `.claude/`
- `.codex/`
- `.worker-reports/`
- `AGENTS.md`
- `WORKER-REPORT-u7-docs.md`
- `WORKER-REPORT-u7-flip-docs.md`
- `docs/residual-review-findings/2026-08-08-llm-subsystem-review.md`

No secrets, credentials, personal roster data, AWS mutation, DNS mutation, CatholicOS issue/PR mutation, DEV write, or PROD mutation occurred during this validation pass.

## Commit and publication state

The documentation branch, including this handoff and the U9 upstream-map update, is committed and pushed on `feat/roundup-brainstorm`. The web residual branch `fix/plan-audit-web-residuals` at `4a4dc5bf`, API residual branch `fix/recent-plan-api-residuals` at `0a54857a`, API demo-refresh branch `feat/demo-refresh-scaffold` at `e894f20f`, API demo-isolation branch `feat/demo-project-isolation` at `b5b13d8f`, web demo-UI branch `feat/demo-project-ui` at `d7e490ec`, API D5 branch `fix/pr-party-credential-rewrap` at `f3c4251d`, API T1 synthesis branch `upstream-queue/t1-api-synthesis` at `d2c31aea`, and web T1 synthesis branch `upstream-queue/t1-web-synthesis` at `4986135c` are durable local branches only; none is pushed or merged.
