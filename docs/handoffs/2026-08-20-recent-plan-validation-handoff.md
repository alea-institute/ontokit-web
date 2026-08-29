# Recent Plan Validation Handoff — Final ALEA Closeout

Created: 2026-08-20

Final refresh: 2026-08-29

## Outcome

The 21-day audit found seven formal plans and 52 formal units. Every unit is now
either complete on ALEA or recorded in this publication-pending closeout with one
current activation condition. The Publication state below is the authoritative
durability receipt until this refresh merges.

The autonomous ALEA implementation is merged:

- Web: [PR #25](https://github.com/alea-institute/ontokit-web/pull/25), merged to `dev`; completed tracker [web #23](https://github.com/alea-institute/ontokit-web/issues/23) is closed.
- API: [PR #24](https://github.com/alea-institute/ontokit-api/pull/24), squash-merged to `dev` as `474d90d669bfdbeeaafcfa1078ef90bc42e107a7`; completed tracker [API #23](https://github.com/alea-institute/ontokit-api/issues/23) is closed.
- Documentation corrections: [web PR #29](https://github.com/alea-institute/ontokit-web/pull/29), merged to `feat/roundup-brainstorm` as `576dc2048a5356fab36a8fe0480184f51f2df61d`.
- D10 source-revision compare-and-set: [API PR #34](https://github.com/alea-institute/ontokit-api/pull/34), squash-merged to `dev` as `5b355bbca6d9afcd1c43d7bc0c2643dd846071ea`.
- D7 atomic demo generations: [API PR #35](https://github.com/alea-institute/ontokit-api/pull/35), squash-merged to `dev` as `d84b52831e9cd77bdc608018d0c288d342475258`.
- D9 sticky demo notice and D10 conflict-preserving web behavior: [web PR #35](https://github.com/alea-institute/ontokit-web/pull/35), squash-merged to `dev` as `dcc6326fc2564f1abc353fd4bff590943e32cc49`.
- D10 destructive-reload confirmation: [web PR #37](https://github.com/alea-institute/ontokit-web/pull/37), squash-merged to `dev` as `bbf8ec3250d86a324f171d667e2d527f5f641411`; web #36 is closed.

The D7, D9, and D10 implementation trackers (API #25/#33 and web #24/#26) are
closed with merge receipts. Live activation, retention, and the newly discovered
retired-link product choice remain separate open issues.

Optional mode without Zitadel remains supported. No CatholicOS, AWS, DNS, DEV, PROD, credential, demo-repository, OAuth-console, or external-organization mutation occurred during the final ALEA publication pass.

## Durable continuation sources

- Audit ledger: `docs/audits/2026-08-20-recent-plan-completion-audit.md`
- Execution plan: `docs/plans/2026-08-20-0836-chore-recent-plan-completion-plan.md`
- Decision Sheet: `docs/decision-sheets/2026-08-20-recent-plan-decisions.md`
- Held upstream manifest: `docs/roundup-2026-08/tranche-drafts/FINAL-BATCH-MANIFEST.md`

## Validation receipts

Web PR #25 finished with 217 test files and 3,365 tests passing, TypeScript type-check passing, ESLint at zero errors, and an optional-auth release-fidelity Docker build passing without Zitadel configuration. The final structured review had no actionable findings.

API PR #24 finished with 2,932 tests passing and 32 external-fixture integration tests skipped; Ruff check and formatting passed; Pyright reported 0 errors and 0 warnings; Alembic exposed one head, `g5h6i7j8k9l0`; remote CI was fully green. The final structured review applied all 12 validated findings and left no actionable findings. One CI-only `MissingGreenlet` failure was diagnosed as a test retaining an expired ORM object across an intentional rollback; caching the UUID before the rollback fixed the test without changing production behavior.

Documentation PR #29 passed build, lint, test, and type-check. It remained mergeable, clean, and review-signal-free through the babysit quiet window before merge.

API PR #34 passed its complete remote matrix after a narrow mypy naming correction;
API PR #35 passed all 2,995 tests plus lint, Pyright, static analysis, build, and
Docker preflight after strengthening the member-flags route fixture for the new
fail-closed demo mutability lookup. Web PR #35 passed 219 files/3,388 tests,
TypeScript, zero-error ESLint, and a production webpack build. Each remained green,
review-backlog-free, current-base mergeable, and unchanged for at least five minutes
before merge.

The final closeout document review covered coherence, feasibility, product, design,
security, scope, and adversarial lenses. It corrected stale D3/D6 gates, PR Party
queue coverage, D5 traceability, full-stack merge receipts, CatholicOS self-merge
scope, retention/D11 ordering, and canonical-WIP resume safety. Its only code finding
was the missing confirmation before a stale source draft is discarded; that follow-up
is merged by web PR #37 and web #36 is closed. The apparent feasibility finding that
`folio-python` 0.4.0 had shipped was rejected against the official PyPI release
history, which still lists 0.3.6 as latest. The automatic cross-model pass did not run
because the environment denied private-plan egress to the external provider without
separate disclosure authorization; it is not counted as corroboration.

## Decisions

D1–D10 are resolved. D7, D9, and D10 are now implemented and merged; D8 was
already implemented in API PR #24. No earlier Decision Sheet question needs another
answer.

Two judgment calls emerged from final review:

- **D11: retired demo URL behavior.** Recommend redirecting an old generation's URL
  to the current generation with a clear notice. Alternatives are an explicit
  retirement page or eventual 404. Full context is in the Decision Sheet and
  [web #34](https://github.com/alea-institute/ontokit-web/issues/34).
- **D12: activation-queue stewardship.** Recommend assigning Damien as the umbrella
  steward until individual tasks are delegated. Alternatives are leaving issues
  unassigned or naming different ALEA stewards. Full context is in the Decision Sheet
  and [web #38](https://github.com/alea-institute/ontokit-web/issues/38).

Neither answer authorizes deployment or external mutation; D11 does not reopen D7,
and D12 assignment does not replace any role-specific approval gate.

## Activation queue

- Authenticated DEV acceptance and auto-accept proof: [web #27](https://github.com/alea-institute/ontokit-web/issues/27). Requires an approved authenticated session and throwaway-state write authority.
- Reviewer-PAT ciphertext rewrap execution: [API #30](https://github.com/alea-institute/ontokit-api/issues/30). The task is merged but has not been deployed or run; requires the named release/operator window, dry-run receipt, stable job-ID confirmation, and previous-key retention until verification completes.
- PR Party answerer external activation: [API #26](https://github.com/alea-institute/ontokit-api/issues/26). The bounded title/comment context is merged; organization activation remains gated on the named demo-readiness and outreach controls.
- Demo repositories, scoped credentials, cron, and live acceptance: [API #31](https://github.com/alea-institute/ontokit-api/issues/31). Atomic refresh is merged; activation requires source-owner approval for an exact history-free release manifest, clean secret/sensitive-data scans, separately scoped read/write credentials, and explicit live-write/cron authority.
- Retired-generation retention: [API #32](https://github.com/alea-institute/ontokit-api/issues/32). Requires a bounded, rollback-safe retention/deletion design and validation. Destructive cleanup waits for D11 and must preserve any tombstone, alias, or stable source-identity mapping required by the selected retired-URL behavior.
- Retired demo URLs: [web #34](https://github.com/alea-institute/ontokit-web/issues/34). Wait for D11.
- Activation-queue stewardship: [web #38](https://github.com/alea-institute/ontokit-web/issues/38). Wait for D12 before assigning individuals; role-specific approval gates remain unchanged.
- Parallel PROD stand-up and rehearsal: [API #27](https://github.com/alea-institute/ontokit-api/issues/27). Requires Mike/AWS or scoped IAM access, protected-environment and runtime-network prerequisites, and separate deployment/write-drain/DNS approvals.
- `ontokit.org` picker: [web #28](https://github.com/alea-institute/ontokit-web/issues/28). Registration was selected; do not re-ask. Wait for observable control, both destination domain names, and DNS/TLS authority.
- Google federation: [API #28](https://github.com/alea-institute/ontokit-api/issues/28). Wait for both domain contracts and approved private OAuth provisioning.
- `folio-python` migration: [API #29](https://github.com/alea-institute/ontokit-api/issues/29). Wait for the first verified safe official release at or above 0.4.0; the last verified latest release was 0.3.6.
- CatholicOS delivery: [web #30](https://github.com/alea-institute/ontokit-web/issues/30). Refresh both upstream bases before the held issue-first batch; the current closeout scope is ALEA-only and CatholicOS self-merge remains prohibited.

## Queue liveness contract

Recheck each open gate at the start of a resumed planning/release session and at least every 30 days while OntoKit work is active. The named receipt, not observation alone, moves an issue into active execution.

| Queue | Responsible owner | Observable trigger source | Activation receipt |
|---|---|---|---|
| API #30 | ALEA security/release owner | Deployed task, named operator window, successful dry run | Stable-job-ID apply receipt and post-run decrypt verification |
| API #31 | Source owner and ALEA security/release owner | Approved release manifest/scans, two scoped credentials, cron/live-write authority | Controlled activation, rollback, and acceptance receipt |
| API #32 | API operations owner | D11 answer plus approved retention design, lookup-data contract, and rollback proof | Cleanup/retired-URL integration proof and bounded deletion audit receipt |
| Web #34 | Product owner | D11 answer | Decision comment and linked implementation receipt |
| Web #38 | Product owner | D12 answer | Named recurring-sweep steward and issue-assignment receipt |
| API #26 | Product owner, then ALEA security/release owner | Named external-activation gates | Controlled activation receipt |
| Web #27 | ALEA release owner | Approved authenticated UAT session and throwaway-state authority | Dated UAT and cleanup log |
| API #27 | ALEA release owner | AWS/scoped-IAM access and protected/runtime environment checks | Parallel-host deploy, scan, smoke, rollback, and UAT receipt |
| Web #28 | ALEA release owner | Registration/RDAP, final destination domains, DNS/TLS approval | Public DNS, TLS, link, and accessibility receipt |
| API #28 | ALEA identity owner | Final domain contract and approved OAuth client | DEV federation UAT receipt |
| API #29 | API dependency owner | Official package index release metadata | Lock, provenance, compatibility, test, and security receipt |
| Web #30 | ALEA release owner | Explicit resumption of CatholicOS work and refreshed upstream heads | Issue-first delivery map and linked PR receipts |

## Preserved local state

No WIP was discarded or published.

- Web canonical checkout contains user-owned WIP on local `dev`; this closeout did not
  edit, reset, publish, or otherwise absorb it.
- The interrupted integration line remains preserved at `safety/recent-plan-integration-autosave-20260828-final` and `upstream-queue/recent-plan-integration-web`, both at `10dea248`.
- The later generated phase-16 auto-save is preserved at `safety/web-phase16-precompact-20260828`, commit `72c641b0`.
- API canonical checkout remains clean and untouched at `474d90d6`; it is behind current
  `origin/dev` after the two isolated implementation PRs merged.
- Clean API recovery/review worktrees remain at `/tmp/ontokit-api-stalled-cli-recovery-handoff` (`8d0d8ea6`) and `/tmp/ontokit-api-final-review` (`6305087f`). They were not deleted because they are preserved recovery artifacts, not dirty trees.

**Mandatory resume preflight:** inspect and record the canonical web HEAD and status;
treat every local commit and changed file as user-owned. Perform all writes in a new
isolated worktree based on the intended remote target. Never reset, clean, stage,
commit, merge, rebase, or publish the canonical checkout without explicit authority.

## Publication state

The prior closeout is merged by [web PR #31](https://github.com/alea-institute/ontokit-web/pull/31)
into `feat/roundup-brainstorm`. This 2026-08-29 refresh is authored on focused branch
`docs/decision-sheet-resolution-20260829`, based on current merged documentation head
`75915d087fb88c45f62623f767d047cc2869f6da`. Commit `7a2f3095` is pushed and
published as [web PR #39](https://github.com/alea-institute/ontokit-web/pull/39)
against `feat/roundup-brainstorm`; repository history is authoritative for its final
merge state.

No secrets, credentials, personal roster data, or unrelated private information are included.
