# PR Party (OntoKit-native) — residual review findings (2026-07-28)

> **Repo lead:** this copy leads with `ontokit-web` residuals (§A). The identical `ontokit-api` copy at
> `ontokit-api/docs/residual-review-findings/2026-07-28-pr-party-code-review.md` leads with the API items.
> Both documents cover the whole feature — read either one end-to-end.

**Source plan (authoritative):** `docs/plans/2026-07-26-011-feat-pr-party-ontokit-native-plan.md`
— 15 units U1–U15, milestones M1/M2, decisions KD14–KD20, technical decisions KTD11–KTD21.
**Predecessor findings:** `~/Coding Projects/docs/residual-review-findings/2026-07-26-pr-party-dashboard-review.md`
(the Cockpit prototype's 33 findings; this build triaged and closed them).

**Branch:** `feat/pr-party`, cut from `feat/trust-ladder` in **both** repos, both pushed to `origin`
(`alea-institute/*` fork — **never** to a `catholicos` remote without asking).

| Repo | Commits | HEAD | Gates at review time |
|---|---|---|---|
| `ontokit-web` | 5 | `6ab1569` | 3146 tests green · `tsc` clean · lint 0 errors / 19 pre-existing warnings |
| `ontokit-api` | 12 | `e94580a` | 2539 tests green · mypy strict clean · ruff clean |

**Updated after the cross-model round (same day):** `web:7b49d68` — 3160 tests green, type-check clean, lint 0
errors / 19 warnings · `api:ccd6d3e` — 2547 tests green, mypy strict clean, ruff clean. Both pushed to `origin`.

**State:** all 15 units implemented, code-reviewed, and fixes applied. **No PRs opened yet** — the CatholicOS
rule is a PR to `catholicos/dev` with a linked issue, and pushing to a `catholicos` remote requires asking first.
**U14 (live E2E gate) is not done** and is blocked on the plan's external gates: Fr. John's PAT intake, org-webhook
creation, the `catholicos/.github` answerer-workflow merge, and the shared generation token.

## What the review was

Eight Opus personas over the full two-repo diff: **correctness, security, adversarial, testing, reliability,
data-migration, maintainability, project-standards.** Findings below are deduped across personas.

**Cross-model peer review was NOT run in the first round.** The `codex` CLI was present on the box but
unauthenticated, so the adversarial lens ran in-process (same limitation as the prototype round).

**CLOSED — the cross-model round ran later on 2026-07-28.** `codex` is now authenticated (ChatGPT auth), and an
independent adversarial pass ran over the branch diff in **both** repos (`codex adversarial-review --base
feat/trust-ladder --scope branch`). It returned `needs-attention` on each, with **four findings the eight
in-family personas missed** — two of them high-severity, and one (duplicate real GitHub reviews) in the feature's
highest-consequence class. All four are fixed; see the section below. The standing "no independent model looked at
this" caveat no longer applies to the code as of `web:7b49d68` / `api:ccd6d3e`.

## Verdict

**No blocking findings.** Everything recorded here is P2/P3 or advisory. The feature is shippable to a fork PR
as it stands; these are the items a future session should either action deliberately or consciously accept.

---

## Cross-model round (later on 2026-07-28) — fixed, do NOT re-file

Codex found four issues in-family review missed. What made them invisible is worth noting: three of the four are
**invariant-scope** bugs — a rule the build genuinely implemented, applied to a strict subset of the places it
needed to hold. In-family personas that read the same plan language kept validating the rule where it was applied
instead of enumerating where it wasn't.

**`ontokit-web`** — fixed in `7b49d68`
- **N1 (high) — URL guard covered a subset of sinks.** `isTrustedGitHubLink` gated LLM `brief_links` and Q&A URLs;
  the degraded `deep_link` went straight to `window.open`, and PR-derived `pr_url`/`diff_url` rendered as raw
  hrefs. Now every API-derived navigation target passes one boundary (`lib/prPartyLinks.ts`: https + exact
  `github.com` host); invalid targets render inert. Hostile-URL tests cover all sinks.
- **N2 (high) — derived idempotency key suppressed legitimate later actions.** The key was a digest of the intent,
  so an approval **dismissed at the same head SHA could never be resubmitted** — the server replayed the old
  receipt and no new GitHub review was posted, forever. Keys are now minted per attempt, persisted in
  sessionStorage only while an outcome is uncertain, and rotated on a definitive response. (This inverts the
  original design note in `lib/api/prParty.ts` — read the new one; the old rationale traded a real
  liveness failure for a retry-safety property that per-attempt keys provide anyway.)

**`ontokit-api`** — fixed in `ccd6d3e`
- **N1 (high) — concurrent claim of an *existing* action row could post duplicate real GitHub reviews.** Two
  requests could read the same stale pending / failed / degraded-intent row, both flip it to pending, both commit,
  and both call `create_review` — two real reviews on a colleague's PR. The partial unique index cannot catch this
  because both transactions **UPDATE the same row**, which is why B12's first-INSERT race looked like the whole
  problem and wasn't. Existing rows are now claimed with `SELECT ... FOR UPDATE` held through the pending commit,
  with concurrency tests on all three retry paths. Verified at unit level only — there is still no live-Postgres
  PR Party harness (that is B4).
- **N2 (medium) — brief delimiters forgeable by case.** `wrap_untrusted` stripped only exact lowercase tokens, so
  `</UNTRUSTED-PR-CONTENT>` plausibly reads as the same boundary to an LLM. Delimiters are now an unpredictable
  per-run nonce minted after content collection, with case-insensitive neutralization and adversarial tests.

**Also fixed in that round, from the lists below:** web A1, A3, A4, A5; api A2, B6 (downgrade narrowing only),
B9, B12, B13, B14, B15, B16, B17. The entries remain below for their reasoning — do not re-file them.

**Verification of that round was run by the orchestrator, not taken from the workers.** Gates re-run locally:
web `3160` tests / type-check / lint 0 errors; api `2547` tests / mypy strict / ruff. Note that the api worker
reported `make test` stalling in its sandbox — that did not reproduce (29s, clean), so treat worker gate claims
as hints, not evidence.

**B6's pre-merge stamp check is DONE and clear.** The hazard was a database stamped at `x1y2z3a4b5c6` while
missing the amended `title` column and `pr_id` index. Checked the only Postgres on this box
(`docker exec ontokit-postgres`): the `ontokit` database is stamped `47cc27515626` and has **no `pr_party*`
tables at all** — it never ran the migration, so nothing is stamped mid-amendment. Production cannot be affected:
the revision exists only on this unmerged branch. What remains of B6 is the after-merge discipline — treat the
revision as frozen; any further change is a new revision.

---

## Fixed in the first (in-family) round — do NOT re-file

Recorded so a fresh session does not "rediscover" them from the plan's risk list. All of the following were found
by the review and are already fixed on `feat/pr-party`:

**ontokit-web**
- Agenda grouping: `discuss_live` excluded from settledness, and parked checked first.
- No-credential banner copy points at **Review settings**.
- `isSafeInternalUrl` rejects backslash forms.
- Idempotency digest covers body + override; replayed announce handled.
- Fake-timer poll test.
- Derived retry-posture table.

**ontokit-api**
- Reclaimed-pending review adoption.
- Verdict/state-aware back-fill plus degraded confirmation.
- Degraded-intent replay after credential repair, with `deep_link` carried on replay.
- `httpx` transport errors folded into the error taxonomy.
- Scrubbed error prose in the credentials path (no token/response bleed).
- `passive_deletes` cascade wired on the PR Party relationships.
- `ix_pr_party_action_pr_id` added.
- Discovery reports **incomplete** when it hits the page cap instead of silently truncating.
- Webhook delivery-claim released on handler failure.
- Stale-snapshot guard in `upsert_pr`.
- Byte-wise HMAC compare.
- Per-run-nonce untrusted-data delimiters in the org answerer YAML.
- Sweep cron given an explicit timeout — in **both** the task functions and the cron registration.
- Consolidations: shared `split_repo` (was 4 copies), `default_generation_client`, `parse_dt` / `to_int`,
  `emit_ready_transition`, `CredentialResolver` + `mark_credential_dead`, `ReviewerReconcileResult` rename.

---

## A. `ontokit-web` residuals

### A1. P2 — Merge affordance not gated on an approval existing
`components/pr-party/CardDetail.tsx:~112` renders the merge affordance without checking that an approval exists.
The server still authorizes the merge, so this is not a security gap — it is a **UX-honesty** gap: the UI offers an
action it knows will be refused.

### A2. P2 — Draft-converted PR refused with the wrong wording
`ontokit-api/app/api/routes/pr_party.py:~621` (API-side, but the failure the reviewer sees is in this UI) refuses a
PR that was converted back to draft with the message "already closed on GitHub". Branch **merged / closed / draft
separately** so the copy matches reality. Keep `retire=True` in all three branches — the retirement behavior is
correct; only the explanation is wrong.

### A3. P3 — `setCredential` typed as the wrong response shape
`lib/api/prParty.ts:~377` types `setCredential` as returning `PRPartyMe`, but the endpoint returns credential
health. The call site does not read the wrong fields today, so it is latent — but the type is lying.

### A4. P3 — Unreachable branch on a non-member status
`CardDetail.handleMerge` branches on `status === "skipped"`, which is not a member of `PRPartyActionStatus`. The
branch is unreachable and **both arms are identical**, so deleting it is behavior-preserving.

### A5. P2 — Done-tab empty copy promises archival that does not happen
The Done tab's empty state promises 14-day archival, but the API's `_archive_settled` only deletes **closed/merged**
rows. An approved-but-never-merged PR therefore sits in Done indefinitely, contradicting the copy. Fix one side:
either extend archival to settled-approved rows, or change the copy to describe what actually happens.

### A6. P3 — `formatWhen` near-duplicated
`CredentialCard` and `QAThread` each carry a `formatWhen`. The behaviors **differ** (they are not a copy-paste
duplicate), so the recommendation is to **leave them** — recorded here so a future consolidation pass does not
"fix" it into a regression.

### A7. P3 (advisory) — `/pr-party` CSP ships `unsafe-inline` / `unsafe-eval`
Next.js requires both, so the CSP's real value on this route is `connect-src` and `frame-ancestors`, not script
containment. **R21's actual protection comes from text-node rendering** of untrusted PR/brief content, not from the
CSP. Recorded so nobody mistakes the header for the control.

### A8. P3 — No contract test binds client generics to FastAPI response models
The TypeScript response generics in `lib/api/prParty.ts` and the FastAPI `response_model=` declarations can drift
silently — A3 above is an instance of exactly that. A generated-types check or a schema snapshot test would close
the class.

Also note, from the API list below: **B18's last bullet** — the web hook's `onSuccess: invalidate` behavior is
asserted nowhere, so a dropped invalidation would leave a stale queue with a green suite.

---

## B. `ontokit-api` residuals

### B1. P2 — Three PR Party service modules exceed 1000 lines
- `app/services/pr_party_intake.py` — 1150 lines
- `app/services/pr_party_brief.py` — 1060 lines
- `app/services/pr_party_github.py` — 1048 lines

Suggested split, and the one with an independent payoff: **split `pr_party_intake.py` along its existing section
comments into `pr_party_facts` / `pr_party_intake` / `pr_party_sweep`.** The file already marks those boundaries,
and the split also removes the documented function-local import cycle at `pr_party_intake.py:~827` (the import is
inside the function *because* module scope would cycle; separate modules make it a normal top-level import).

### B2. P2 — Read-model projection lives in the route module
`app/api/routes/pr_party.py` is 965 lines, and a large share of that is read-model projection rather than HTTP
concerns: `compute_readiness`, `project_author_kind`, `_build_card`, `_build_detail`. These are the shape of a
service (or a dedicated `pr_party_readmodel` module), and keeping them in the route module is what makes the file
hard to test without going through FastAPI.

### B3. P2 — `rotate_reviewer_token` has no production caller
`app/services/pr_party_credentials.py:~178`. The function is exported and unit-tested, but nothing in the app calls
it. Two honest resolutions, pick one:
1. Wire an operator-triggered arq rotation task (the plan's credential-hygiene intent), or
2. delete it and its tests.

Leaving it as tested-but-dead code is the failure mode: it reads as an implemented capability in review and in the
plan's traceability table, and it is not one.

### B4. P2 — No live-Postgres integration tests for PR Party
`tests/integration/` has **no PR Party file at all**. The following are asserted only as SQLAlchemy metadata or as
Alembic DDL text — i.e. the assertions verify what we *wrote*, not what Postgres *does*:
- Both partial unique indexes — **KTD16** (one live action per fingerprint) and **R22** (once per revision).
- `ON DELETE CASCADE` behavior.
- The `head_sha` correlation join.
- The migration's `downgrade()` DELETEs.

Compounding it: the reconcile-archival test's fake `delete_pr` is a **no-op**, so the ORM cascade path never
executes in CI. A single integration module hitting a real Postgres would cover all five.

### B5. P3 — DDL-equals-model drift test covers one table of three
The drift test asserts `pr_party_pr` (and, after this round's fix, the `pr_party_action` indexes). The other two
PR Party tables can drift between migration and model undetected. Extend the test to iterate the PR Party table set.

### B6. P2 (pre-merge action) — Migration `x1y2z3a4b5c6` was amended in place on this branch
The migration was edited after it had already been applied somewhere on this branch. **Before merge, verify no
database is stamped at `x1y2z3a4b5c6` while missing the `title` column and the `pr_id` index.** After merge, treat
the revision as frozen — any further change is a new revision.

Separately, that migration's `downgrade()` issues **unbounded DELETEs** over `notifications` and `llm_audit_logs`
for the columns it relaxed. LLM cost-audit rows with a NULL project would be unrecoverable on a downgrade that had
nothing to do with them. Narrow to something like `endpoint LIKE 'pr-party/%'` (and the equivalent predicate on
notifications) so a downgrade only removes rows this feature created.

### B7. P3 (advisory) — Rolling-deploy hazard, >1 replica only
`NotificationResponse.project_id` / `project_name` were widened to optional. During a rolling deploy, an **older**
API process reading a `pr_party_ready` notification row would 500 the notification bell. Deployment today is a
single container via compose, so this is inert — record it against the day replicas > 1.

### B8. P3 (advisory) — Non-concurrent unique index on a populated table
The new unique index on `notifications` is created non-concurrently, taking a `SHARE` lock that blocks writes for
the duration. Fine at current row counts and with a single replica; at scale this needs
`CREATE INDEX CONCURRENTLY` inside an autocommit block (which also means the migration cannot run in a transaction).

### B9. P2 — Per-item `except Exception` also swallows SQLAlchemy errors
In `sweep_open_prs` and `reconcile_pass`, the per-item `except Exception` is meant to isolate one bad PR from the
batch. It also catches ORM errors. Because those loops share a single `AsyncSession`, a **flush failure leaves the
session needing rollback** — so the trailing commit and every subsequent item raise `PendingRollbackError`. The
isolation is genuine only for I/O failures (`httpx`, timeouts). Fix by either catching the I/O exception types
explicitly, or rolling back the session in the handler before continuing.

### B10. P3 — `get_arq_pool()` memoizes with no health check
The pool is cached on first use and never validated. Both call sites fail open, so a dead pool degrades to
"enqueue silently does nothing" rather than an error. Acceptable, but it means a Redis restart is invisible until
someone notices work isn't running.

### B11. P3 — Sweep cadence equals the old job timeout
With `PR_PARTY_SWEEP_MINUTES=5`, the sweep cadence matches what used to be the `job_timeout`. Concurrent
`_reconcile_missing` / `apply_brewing_timeout` passes over the same rows were **not explicitly designed for**. The
240s sweep timeout added this round bounds the overlap, but the interleaving semantics were never analyzed. If the
cadence is ever shortened, analyze it first.

### B12. P2 — Concurrent first-time actuation surfaces as 500, not 409
Two concurrent first-time actuations on the same fingerprint both attempt an INSERT; the partial unique index
raises `IntegrityError`, and **no route or app-level handler catches it** — so the second reviewer sees a 500
instead of the intended in-flight **409**. There is no double-actuation (the index does its job) and the client
opts out of 5xx retry, so the blast radius is a confusing error message. Add an `IntegrityError` handler on the
actuation route that maps the unique-violation to the 409 the client already understands.

### B13. P3 — `_approval_was_dismissed` fallback is feed-order-dependent
The fallback path returns the **first** identity match at head with `include_dismissed=True`. If a reviewer holds
both a dismissed review and a fresh review at the same head SHA, the answer depends on GitHub's feed ordering.
Prefer the most recent by `submitted_at`, or scan for any non-dismissed match before concluding "dismissed".

### B14. P2 (security, defense-in-depth) — Webhook authorization rests entirely on the shared secret
`handle_webhook_event` never checks that `repository.full_name` belongs to `settings.pr_party_org`. The HMAC is
correct and byte-wise compared, so this is not exploitable on its own — but a leaked secret currently means an
attacker can inject PR rows for *any* repo. An org-prefix check is a cheap second constraint that bounds the
damage of secret compromise.

### B15. P2 (security) — `filter_links` allowlists the app's own origin
Two issues in the same function:
1. It admits `settings.frontend_url` as an allowed origin for **LLM-emitted** links — an injected brief could
   surface a link pointing back into the app's own origin. The generation domain should not be able to emit
   app-origin links.
2. It compares against `f"https://{host}"`, so a **ported** `FRONTEND_URL` (e.g. `https://host:3000`) never
   matches itself. Compare parsed host/port, not a reconstructed string.

### B16. P3 — `_ACTION_KIND_ORDER` docstring contradicts the code
The docstring says verdict-first; `_build_card` ships the reversed order. No consumer depends on the ordering
today, so fix whichever end is wrong — but fix one, because the next consumer will read the docstring.

### B17. P2 — `upsert_pr` lets a webhook downgrade `mergeable_state`
`upsert_pr` writes `mergeable_state` unconditionally. GitHub webhooks frequently carry `mergeable: null` (the
value is computed asynchronously), so a webhook can **overwrite a sweep-established** `mergeable_state` with the
unknown value. `checks_rollup` already has exactly the guard `mergeable_state` lacks. The fix needs a
`mergeable_known` flag on `PRFacts` so the writer can distinguish "known-null" from "not reported".

### B18. P3 — Test-depth gaps worth closing
None of these are correctness claims; they are places where a regression would pass CI:
- Sweep cron **cadence/clamp** unit tests (the timeout fix is untested at the registration layer).
- The brief **head-SHA re-check** test cannot fail if `populate_existing` is dropped — the fake session ignores
  execution options, so the test passes either way.
- Action-store **row-selection policy** is only mocked, never exercised against real rows.
- Branch coverage for `MAX_DISCOVERY_PAGES`, `_needs_detail`, `_handle_check_suite`.
- `get_issue_comments` transport-error test.
- Q&A `_MIN_QUOTE_MATCH` boundary, and self-answer negative tests.
- No **signed-webhook-through-to-row** seam test (signature → handler → persisted row).
- `get_arq_pool` rewiring is untested.
- Brief **LLM provider-failure** path.
- **web:** the `onSuccess: invalidate` behavior in the PR Party hook is asserted nowhere.

---

## C. Cross-repo — org answerer asset drift

The `@claude` answerer workflow YAML **lives in `ontokit-api`** but **runs from `catholicos/.github`**. Tests
assert the text of the local copy; **nothing verifies the deployed copy.** Two consequences:

1. A change there is not live until a fork PR to `catholicos/.github` (targeting `dev`) merges upstream.
2. This round's **per-run-nonce untrusted-data delimiters** — a security fix — are therefore **not yet in effect**
   in the org. They take effect only when that PR merges.

Any future session touching the answerer must treat "merged into `catholicos/.github`" as the deploy step, and
should consider a drift check (fetch the deployed file, compare to the local copy) rather than asserting local text.

---

## Resumption pointers

- **Plan / traceability:** `docs/plans/2026-07-26-011-feat-pr-party-ontokit-native-plan.md`
- **Learnings from the build:** `docs/solutions/2026-07-28-pr-party-fifteen-unit-build.md`
- **Prototype findings (closed, kept for provenance):**
  `~/Coding Projects/docs/residual-review-findings/2026-07-26-pr-party-dashboard-review.md`
- **Next actions, in order:** (1) ~~B6's migration-stamp check~~ **done, clear** — see the cross-model section;
  (2) open the fork PRs (`ontokit-api` and `ontokit-web` → `catholicos/dev`, each with a linked issue — **ask
  before pushing to a `catholicos` remote**); (3) the `catholicos/.github` answerer PR (§C) — note the per-run
  delimiter fix landed **twice** now (first round, then the cross-model nonce hardening), and **neither is live
  in the org** until that PR merges; (4) U14's live E2E once the external gates clear.
- **Still open and deliberately deferred** (not attempted in the cross-model round): **B1/B2** the >1000-line
  module splits, **B4** the live-Postgres integration module — which the new N1 fix gives a second reason to want
  — **B5**, **B18**, and the advisory items. **B3** (`rotate_reviewer_token`: wire an operator-triggered rotation
  task, or delete it and its tests) is an owner decision, not a coding call.
