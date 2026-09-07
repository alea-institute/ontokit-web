---
artifact_contract: "ce-handoff/v1"
created_at: "2026-09-07T18:15:47Z"
title: "OntoKit march-through day 2 handoff"
summary: "Gates B11/B1/B12/B2/B3/B4/B5/B6 answered, U9 parked on one approval, U11 sent to CatholicOS, U14 planned with ce-work run u14-api at U1 committed, U15 done."
keywords: ["ontokit", "march-through", "u14", "retention", "ce-work", "u14-api", "decision-sheet"]
cwd: "/home/damienriehl/Coding Projects/ontokit-web"
resume_focus: "Finish ce-work run u14-api (U2, U3, U4, U6, then web U5), take the U9 DEV receipts once the parked deploy run is approved, then U10 UAT and the next Decision Sheet batch."
repository: "alea-institute/ontokit-web"
repo_root_sha: "94cce743547802ce3b81b29a7a8815263ceae88d"
branch: "docs/u14-retired-demo-plan-20260907"
head: "be8b3a4e"
---

# OntoKit march-through day 2 handoff

Plan of record: `docs/plans/2026-09-05-1153-chore-recent-plan-march-through-plan.md` (Appendix B gate register). This retires `docs/handoffs/2026-09-06-march-through-handoff.md`, which this session resumed from and whose tasks are done or superseded below.

## Decisions Damien made today (2026-09-07), all in `briefs/qa/*-answers.json`

| Gate | Answer | Effect |
|---|---|---|
| B11 | Yes: drop and recreate DEV `ontokit` DB | Done; backup kept on the host |
| B1 | Yes, he approves the parked run | Approved once; re-run parked again (see U9) |
| B12 | Yes: rulesets, lock, secret scanning | Done on both ALEA forks |
| B2 | Yes, T1 only, no self-merge | U11 sent |
| B3 (D11) | Redirect to current generation with a notice | U14 planned |
| B4 (D12) | Damien is umbrella steward | U15 done, web #38 closed |
| B5 | Yes, agent UAT on DEV after deploy | U10 unblocked once U9 lands |
| B6 | Dev is the line; feat/pr-party frozen | Damien asked "which is best practice"; recorded as the best-practice option with his verbatim note |
| T1 send (`ontokit-web-2026-09-07-1412-t1-send`) | Push to CatholicOS; close #57/#27 with pointers | Done |

Still open: dev-hard-blocks q3 (B13 rewrap window), judgment q3 B9 (Mike/AWS), tasks B7 (ontokit.org), B8 (demo credentials). Ask at the next checkpoint after U9's receipts; check `briefs/qa-state.json` first.

## Unit state

- **U9 (DEV deploy): everything but the click.** DEV database reset (backup on host), old api/worker containers stopped, rulesets live, manifest PR api #41 merged (`5583ea5d`), first run 34127559843 failed on the runner (key written without trailing newline), fixed by api #42 (`9814b8e8`). Re-run **34129972766** is parked at the `dev-deploy` approval; the permission classifier refuses to let the agent approve it. DEV is down until it runs. After it lands: container image times, deploy `status` verb, Alembic head, FOLIO re-import via `POST /projects/import`, rollback dry-run, UAT log entry. Host seam drift to record: the installed forced-command deploy script is the 253-line August 10 version; `deploy/ontokit-deploy.sh` on `dev` is 415 lines and depends on the newer compose file.
- **U11 (CatholicOS T1): complete.** Issue CatholicOS/ontokit-web#401 (new), api #83 updated; PRs CatholicOS/ontokit-web#402 (head `df50cb61`) and CatholicOS/ontokit-api#228 (head `de912347`), both CI green; #57 and #27 closed. Journal merged via alea web #44. Never self-merge upstream.
- **U14 (retired demo URL + retention): planned and in ce-work.** Plan `docs/plans/2026-09-07-1250-feat-retired-demo-url-and-retention-plan.md` (alea web PR #45, this branch), reviewed by six personas plus a Codex cross-model pass with every finding folded in. Controller run `u14-api` on the API feature branch `feat/retired-demo-retention` (pushed to ALEA): **U1 committed `88adb22d`**; U2, U3, U4, U6 not started; web U5 not started and depends on U2 merged to `dev`. Resume with the controller's `resume --run-id u14-api`, never by re-initializing.
- **U15: complete.** All open ALEA activation/retention issues assigned to Damien; web #38 closed.
- **U10, U12, U13, U16, U17, U18:** gated as in Appendix B.

## Gotchas the next session will hit

- **mypy in the local API venv** (Python 3.13) fails on NumPy stubs under the repo's 3.11 pin; CI is 3.11 and green. Use `--python-version 3.13` locally as the proxy gate and say so in verification summaries.
- **Controller terminalize refuses ignored byproducts** in the unit workspace (caches, a venv symlink). Remove them before `terminalize`. The worker needs a venv to run tests; link the canonical checkout's `.venv` into the workspace after `prepare` and remove the link before `terminalize`.
- **codex-run.sh** reported "no verified payload" on every synchronous dispatch today although each edit landed; verify from the git diff, not the runner's verdict.
- **PreCompact hook** commits "WIP: PreCompact auto-save" on compaction; check `git log` before pushing.
- **CatholicOS web CI build** needs `AUTH_MODE: optional` (added on the T1 branch).

## Follow-ups worth issues

API: compose.prod.yaml required-var secrets; submit-path 402/503 mapping; installed deploy script drift on DEV; ruff I001 in the T1 migration file. Learnings for `ce-compound`: the secret-newline defect, the forced-command script drift, the terminalize ignored-path rule.
