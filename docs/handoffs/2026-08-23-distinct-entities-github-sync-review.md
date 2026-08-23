# Distinct-entity decisions and GitHub mirror retry: verified local handoff

Date: 2026-08-23

## Outcome

The approved distinct-entity decision flow and best-effort GitHub pull-request mirror status/retry flow are implemented in isolated API and web branches, reviewed, corrected, and fully verified locally.

Nothing in this handoff has been pushed, merged, deployed, or sent to GitHub, CatholicOS, AWS, DNS, or PROD.

## Approved product decisions implemented

- “Mark distinct” is an explicit decision, not an inference from reject/dismiss.
- Owners, admins, and editors may mark a pair distinct; suggesters may not.
- A reason is required.
- Entity pairs are symmetric and stored canonically.
- Server-generated fingerprints invalidate a decision when relevant entity content changes.
- Owners and admins may revoke a decision.
- Optional auth without Zitadel remains supported for browse-only behavior; mutation endpoints still require an authenticated identity.
- GitHub mirroring is best-effort and exposes `not_configured`, `pending`, `synced`, and `failed` states.
- Authorized users may safely retry a failed or stale GitHub mirror operation, including merged pull requests.
- A durable outbox remains deliberately deferred; the current design stores replayable operation receipts and supports bounded repair.

## Repository state

### API

- Repository: `ontokit-api`
- Branch: `feat/distinct-entities-sync-retry`
- Worktree: `/home/damienriehl/Coding Projects/ontokit-api/.worktrees/feat/distinct-entities-sync-retry`
- Base: `9ce84ffa33ac2f481135ad0545a47738f3ef778c`
- Commits:
  - `fa753096` — `feat(dedup): support auditable distinct-entity decisions`
  - `64ca88c9` — `feat(pr): expose retryable GitHub mirror status`
  - `0f8c4063` — `refactor: simplify duplicate and GitHub sync paths`
  - `1c07af2d` — `fix(review): harden distinct decisions and GitHub sync`
- Working tree was clean after the final commit.

### Web

- Repository: `ontokit-web`
- Branch: `feat/distinct-entities-sync-retry`
- Worktree: `/home/damienriehl/Coding Projects/ontokit-web/.worktrees/feat/distinct-entities-sync-retry`
- Base: `2c6a78137d3038f0b59daa875b84d0b91f19d2ed`
- Commits before this handoff:
  - `0693c718` — `feat(dedup): add explicit distinct-entity review UX`
  - `97bd6d67` — `feat(pr): surface retryable GitHub mirror status`
  - `8b637177` — `refactor: simplify review and mirror status UX`
  - `880b7d81` — `fix(review): preserve review context and retry states`

## Review corrections applied

### API

- Preserved the legacy `duplicate_rejections` table and contract; introduced a separate `distinct_entity_decisions` table.
- Made downgrade fail closed when auditable decision rows exist.
- Bound decisions to canonical pairs, branch, entity type, embedding text, and relevant structural content.
- Added overfetch/backfill so suppressed candidates do not reduce the requested result count.
- Restored legacy rejection metadata and made submission-time duplicate gates honor active decisions.
- Required authenticated identities at all new mutation boundaries even in optional-auth mode.
- Unified GitHub create/update/close/reopen/merge/retry receipts with replayable intent, repository binding, remote head/base verification, compare-and-set repair, and system mirror credentials.
- Protected review/comment mirroring from unverified GitHub pull-request numbers.
- Added project/time indexes, including an active-decision partial index.

### Web

- Preserved candidate branch and class/property type through decision requests.
- Removed only the exact `(IRI, branch)` candidate after a decision.
- Added an independent stale-state timer with abort/cleanup behavior.
- Exposed authorized retry for failed/stale mirror operations, including merged pull requests.

## Verification receipts

### API

- Full unit suite: `2837 passed`.
- Ruff across `ontokit` and `tests`: passed.
- mypy across `ontokit`: passed for 185 source files.
- Fresh PostgreSQL 17 + pgvector full Alembic upgrade: passed from base to the single head `g6h7i8j9k0l1`.
- PostgreSQL distinct-decision integration suite: `4 passed`.
- `git diff --check`: passed before commit.
- Disposable PostgreSQL data was synthetic, RAM-backed, stopped, and automatically removed after verification.

### Web

- Full Vitest suite: 177 files and `2908 passed`.
- TypeScript type check: passed.
- ESLint: passed with no errors (existing warnings only).
- Optional-auth production build: passed and generated all routes.
- Earlier branch browser QA: two flows passed; one editor-seed flow was skipped because the local harness lacked seed data.
- `git diff --check`: passed before commit.

## Remaining queue and gates

No additional product/taste decision is required for this implementation.

The following work remains intentionally gated or deferred:

1. Push branches, open/link issues and pull requests, and publish the work in the previously approved batch. This handoff does not authorize that external publication step by itself.
2. Run the normal PR/CI feedback cycle after publication.
3. Coordinate the production migration owner/quiescence plan and perform deployment smoke/monitoring checks only under the existing PROD approval gate.
4. Keep CatholicOS, AWS, DNS, and domain-name changes on hold pending the existing explicit approvals and domain-name resolution.
5. Revisit a durable GitHub outbox only if operational evidence shows the receipt-and-retry design is insufficient.

## Preserved original checkout

The original `ontokit-web` checkout and its unrelated untracked files were not edited, staged, or committed by this work.

