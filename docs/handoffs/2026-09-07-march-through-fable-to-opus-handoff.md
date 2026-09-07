---
artifact_contract: "ce-handoff/v1"
created_at: "2026-09-07T18:51:09Z"
title: "OntoKit march-through: Fable to Opus orchestrator handoff"
summary: "U9 DEV deploy failed on a 0600 pyproject.toml (issue api#43, Codex fix uncommitted in a worktree); U14 run u14-api has U1+U2 committed and U3 authoring; web U5 waits on U2 reaching dev."
keywords: ["ontokit", "march-through", "u9", "u14", "retention", "ce-work", "u14-api", "dockerfile", "alembic"]
cwd: "/home/damienriehl/Coding Projects/ontokit-web"
resume_focus: "Land the api#43 Dockerfile fix and re-deploy DEV (new manifest run parks at approval), take U9 receipts, then finish ce-work run u14-api (U3 in flight, U4, U6) and web U5."
repository: "alea-institute/ontokit-web"
repo_root_sha: "94cce743547802ce3b81b29a7a8815263ceae88d"
branch: "docs/u14-retired-demo-plan-20260907"
head: "82bf2033"
---

# OntoKit march-through: Fable to Opus orchestrator handoff

Written because Fable's weekly quota hit 99% (Damien's call to hand the orchestrator seat to Opus, 2026-09-07). Plan of record: `docs/plans/2026-09-05-1153-chore-recent-plan-march-through-plan.md` (Appendix B gate register); U14 plan: `docs/plans/2026-09-07-1250-feat-retired-demo-url-and-retention-plan.md` (this branch, alea web PR #45). This retires `docs/handoffs/2026-09-07-march-through-day2-handoff.md`, which this session resumed from; its open items are carried below. Worker policy unchanged: Codex workers at every tier; the orchestrator dispatches, reviews diffs, runs gates, and owns network/credentialed steps.

## What happened this session (Fable, 2026-09-07 18:15Z to 18:55Z)

- **Damien approved the parked U9 deploy run.** It built both images and failed: api and worker crash-loop at the entrypoint's `alembic upgrade` with `PermissionError: pyproject.toml`. Root cause, verified on the host and inside the image: `deploy/ontokit-deploy.sh` runs `git checkout` under `umask 077`, the one file that changed in this deploy landed as mode 0600 root, the Dockerfile copies it without `--chmod`, and Alembic 1.19 (new on `dev`; the previous pair had 1.18.5) now opens `pyproject.toml`. Filed as alea-institute/ontokit-api#43. My call: fix forward, no rollback (DEV api was already down since the B11 reset, and the previous pair would migrate the empty DB with the old chain).
- **Fix dispatched to Codex** (uncommitted, in a worktree on branch `fix/dockerfile-pyproject-mode` off `dev` 9814b8e8): `--chmod=0644` on the Dockerfile's plain-file COPYs, both checkouts wrapped in `( umask 022; … ) || return`, a contract test `tests/unit/test_dockerfile_contract.py`, and a runbook note that the installed forced-command script on DEV is a separate copy. I reviewed the Dockerfile and deploy-script hunks and they are correct; the test and runbook were still being written at handoff.
- **U14 run `u14-api`:** U2 (retired 410 resolution) is committed as `13934b09` on `feat/retired-demo-retention` and pushed to ALEA, on top of U1 `88adb22d`. U2's diff was reviewed line by line: the 410 fires only from the single-project GET's opt-in flag, before the owner check, with `Cache-Control: no-store`, a documented OpenAPI 410, and every other path fail-closed. U3 (retention service) is authoring under Codex. U4's packet skeleton is drafted. U2 and U3 both touch `demo_project_provisioning.py`, so units run serially, not as a wave.

## Current state by unit

- **U9 (DEV deploy): failed, fix in progress.** DEV: web up on 4cbe4d4c, api and worker restarting on 773c51aa, database empty. Path to green: commit the Codex fix, PR to ALEA `dev`, CI green, merge, then a one-line `deploy/release-manifest.json` PR pointing at the new api SHA (web stays 4cbe4d4c), whose merge run parks at the `dev-deploy` approval. **That approval is Damien's click (gate B1 again)**; hand him a paste line. Then receipts per the march plan's U9 unit: status verb, container image times, Alembic head, health, FOLIO re-import (needs an authenticated user; see private copy), previous-pair check, and a dated entry in `docs/roundup-2026-08/DEV-UAT-LOG.md` (lives on this docs branch) recording the failed run, the cause, and the fixed run.
- **U14 (retention): U1 and U2 committed, U3 authoring, U4 and U6 not started.** Resume the controller run by its id; never re-initialize. U4 depends on U3's public function names; U6 depends on U2, U3, U4. After every API unit: the plan-wide `verify-run`, then an ALEA PR to `dev`.
- **U5 (web): not started;** depends on U2 merged to `dev`. Worktree exists on `feat/retired-demo-redirect` at the `dev` base.
- **U10 (authenticated DEV UAT):** blocked on U9 receipts. **U11, U15: complete.** U12, U13, U16, U17, U18 gated as in Appendix B.

## Open Damien items (already on the board; re-offer at the post-U9 checkpoint, do not re-ask before)

Ask `ontokit-web-2026-09-05-1719-march-dev-hard-blocks` q3 (B13 rewrap window); ask `ontokit-web-2026-09-05-1723-march-tasks` q1 ontokit.org registration (B7), q2 demo credentials (B8), q3 Mike/AWS (B9). The judgment ask is fully answered. Check `briefs/qa-state.json` by (stem, qid) first.

## Gotchas the next session will hit

- The ce-work controller mechanics that cost failed transitions today (venv link, cache purge before terminalize, `sync-job` takes no attempt id, a worker `scope_expansion` result must be abandoned against its transport SHA and re-dispatched with the retained patch, never sweep `tests/unit/` with `ruff format --check`) are recorded in the project memory file `project_ce_work_controller_gotchas.md` and in the private copy.
- Workers have no database; DB-touching unit tests hang for them. Tell them to interrupt at 120s and report with `-k`; the host reruns inside `integrate` with the real test database.
- mypy locally: `--python-version 3.13` proxy (CI is 3.11). codex-run.sh may report "no verified payload" even when edits landed; trust the git diff. PreCompact hook commits "WIP: PreCompact auto-save"; the main ontokit-web checkout's `dev` is 4 such commits ahead of origin, do not push it blindly.
- `.deploy-previous` on DEV still names the pre-reset pair; the deploy script has no dry-run verb, the receipt is reading that file.

## Follow-ups worth issues (still open from day 2 plus today)

API: compose.prod.yaml required-var secrets; submit-path 402/503 mapping; installed deploy script drift on DEV (now part of #43); ruff I001 in the T1 migration file; the 21-file `tests/unit/` formatting baseline. `ce-compound` candidates: the umask/COPY-mode/Alembic-1.19 incident, the secret-newline defect, the terminalize ignored-path rule, the scope-expansion re-dispatch pattern.
