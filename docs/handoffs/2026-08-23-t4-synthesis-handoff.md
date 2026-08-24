# T4 Trust-Ladder Synthesis Handoff — 2026-08-23

## Outcome

T4 trust ladder and auto-accept are synthesized, deeply reviewed, remediated, and committed on isolated local API and web branches. No implementation branch, issue, pull request, CatholicOS record, DEV/PROD system, AWS resource, DNS record, or external organization asset was published or changed.

The durable local heads are:

- API `upstream-queue/t4-api-synthesis` at `8d6fc226` (`feat(trust): add contribution ladder and guarded auto-accept`), based on T3 API `1b8bde28`.
- Web `upstream-queue/t4-web-synthesis` at `d4ed4581` (`feat(trust): add contribution controls and triage`), based on T3 web `2c6a7813`.

Both implementation worktrees are clean. Both commits are local only, unpushed, and unmerged.

## What T4 now covers

The paired candidate implements per-project trust tiers and overrides, append-only suggestion outcomes and promotion, authenticated and anonymous minting enforcement derived from RDF changes, first-suggestion verification and shared rate limiting, triage and bounded bulk review, quiet-period auto-accept with objection halting and recoverable leases, server-owned LLM provenance exclusion, contributor-safe commit identity, and outbound-only system-credential GitHub mirroring.

The web exposes the trust explainer, tier-aware editor affordances, proposal completion nudge, member and policy administration, triage filters and bulk actions, and commit-identity preferences. Review follow-up removed stale queue races, stale selections, unsafe mutation retries, concurrent-policy overwrite behavior, persistent optimistic trust state, and the 100-item select-all dead end.

Optional mode without Zitadel remains supported for browse-only operation. Semantic embedding computation remains authenticated; reviewers proposed anonymous access, but that conflicted with the settled compute boundary and was rejected.

## Verification receipts

API:

- Full suite: 2,095 passed, two expected integration skips, 13 known warnings.
- Ruff: clean.
- Targeted mypy: clean across all 23 changed source files using the worktree's Python 3.13 environment.
- Full-project mypy: only three pre-existing errors in `ontokit/models/embedding.py`; no T4 error remains.
- Alembic: one head `w0x1y2z3a4b5`.
- Disposable PostgreSQL/pgvector: empty-to-head upgrade, expected T4 lease/index/unique constraint inspection, T4-only downgrade, and re-upgrade all passed.
- Code review: ten local lenses plus three validator batches; every validated finding applied. External adversarial code egress was denied, so the required adversarial coverage ran locally.

Web:

- Full suite: 184 files, 2,983 tests passed.
- TypeScript: clean.
- ESLint: zero errors, 18 pre-existing warnings.
- `AUTH_MODE=optional` production build: passed, 22 static pages; only the known Turbopack tracing warning remains.
- Code review: nine local lenses plus validator pass; all 11 validated findings applied. External adversarial code egress was denied, so the adversarial coverage ran locally.

## Operational note

During migration verification, one Alembic invocation did not receive the intended tool-call environment override and therefore applied the additive T4 migration to the repository's configured local API database. No downgrade was attempted against that unknown local dataset. The authoritative destructive downgrade/re-upgrade test was then rerun against an explicitly addressed disposable PostgreSQL container, which was stopped and auto-removed afterward. No remote or production database was targeted.

## Next autonomous engineering order

1. Replay the already-green distinct-entities net changes onto the final T4 API and web heads, preserving the paired order and excluding the earlier web handoff-only commit from implementation history.
2. Replay GitHub synchronization after distinct entities, so its migration and contracts descend from the distinct pair.
3. Run simplify, full local code review, and the complete source-repo gates for each new paired head.
4. Continue the remaining T5–T10 local syntheses before the authorized issue-first final batch.
5. At the final batch only: refresh CatholicOS bases, create/update issues first, link PRs to their owning issues, push/open the prepared branches, and do not self-merge.

Authenticated DEV acceptance for the elapsed quiet period, objection halt/resume, and automatic `system:auto-accept` outcome remains a named activation gate. It is not a code blocker and must not be represented as complete until a suitable credentialed UAT window exists.

## Protected state

The authoritative `feat/roundup-brainstorm` checkout remains at `16fe6411` with exactly its seven preserved untracked paths. This docs checkpoint was created in a separate worktree and contains no secrets, credentials, personal roster data, or unrelated private information.
