---
artifact_contract: "ce-handoff/v1"
created_at: "2026-09-19T01:28:46Z"
title: "OntoKit-web Codex pickup — 21-day audit follow-through"
summary: "Local checkout hygiene is start-now work; almost everything else is blocked on Damien's parked GitHub Actions deploy-approval click in the sibling ontokit-api repo."
keywords: ["codex-pickup", "ontokit-web", "ontokit", "catholicos", "dev-deploy"]
cwd: "/home/damienriehl/Coding Projects/ontokit-web"
resume_focus: "Clean up local dev checkout drift; everything past that waits on Damien or on network access this session does not have."
repository: "ontokit-web"
branch: "dev"
head: "4f6eeed3c63306e5d0404ce2013e47b574ebd6dc"
---

# OntoKit-web Codex pickup

## STANDING GATE — read this before anything else

**OntoKit is a CatholicOS project.** Damien's standing rule: pushes to CatholicOS
projects (this repo and its sibling `ontokit-api`) always require his explicit
permission, with no exception, ever. **Prepare work on local branches only. Do
not `git push`, do not open a PR, do not merge to `dev` or `main`.** If a task
below produces a commit, leave it on a local branch and say so in your report —
Damien pushes it himself, or asks the orchestrating session to.

## Readiness verdict

**BLOCKED — do not start a Codex session here yet.** The only local task (dropping 4 stray WIP auto-save commits) requires `git reset --hard`, which is on Damien's standing must-ask list, so it cannot run unattended; a safe preserve-first step is described under that task and needs no approval. Everything else waits on Damien's parked GitHub Actions deploy-approval click (in the sibling `ontokit-api` repo) and on network access this session does not have.

## Orientation

OntoKit-web is the Next.js/TypeScript frontend for a collaborative OWL ontology
curation platform (sibling `ontokit-api` is the FastAPI backend; they deploy
together). Three plans drove the last three weeks of work here, all audited
read-only by a cockpit session on 2026-09-18 against live git/GitHub state
(the catalog this handoff distills from lives outside this repo, in the
orchestrating cockpit repo — this document already pulls in everything from it
that matters to a session sandboxed to this repo).

State as verified live at the moment this handoff was written (2026-09-19,
re-checked against the 2026-09-18 audit and found to still match):

- `dev` is 4 commits **ahead** of `origin/dev` (all four are `WIP: PreCompact
  auto-save` noise from 2026-08-29, not real work) and 1 commit **behind**
  (PR #46, `5eb9888f`, already merged upstream and already present in this
  checkout's cached `origin/dev` ref).
- `main` is at `fab3d2899`, untouched by this work.
- Two PRs are open: **#2** (`docs/readme-personas`, stale, unrelated — ignore
  it) and **#45** (`docs(plan): retired demo URL redirect and bounded
  retention (U14)`, branch `docs/u14-retired-demo-plan-20260907` → target
  `feat/roundup-brainstorm`). #45 documents work whose *code* already merged
  via PR #46 on 2026-09-07 — it is a paper-trail PR waiting to be merged, and
  merging it needs `gh`/network, so it is not yours to do.
- Working tree is clean (0 dirty files).

**Trap that will confuse you:** the plan documents driving this work are
**not on `dev`**. They live on a long-running documentation branch,
`feat/roundup-brainstorm` (present locally — `git show-ref
refs/heads/feat/roundup-brainstorm` resolves), plus one plan on the still-open
PR #45 branch `docs/u14-retired-demo-plan-20260907`. Code implementing each
plan's units lands on `dev` via separate, already-merged PRs; the plan prose
itself never did. **Do not switch your working tree to those branches** —
read their content with `git show <branch>:<path>` from your current `dev`
checkout instead, so you never carry uncommitted plan-branch state into the
hygiene task below.

## Read these first

1. `AGENTS.md` (repo root, lines 1–90) — the real command reference: `npm run
   test` (Vitest), `npm run lint` / `lint:fix`, `npm run type-check`, and the
   two local Semgrep invocations (Pro vs. free tier) mirroring what CI runs
   diff-aware on every PR.
2. `CLAUDE.md` (repo root) — project overview and file-layout conventions
   (e.g. `components/revision/` for branch/revision-history UI).
3. `git show feat/roundup-brainstorm:docs/plans/2026-09-05-1153-chore-recent-plan-march-through-plan.md`
   — the live tracker plan. Its own units U1–U8, U19, U20 (the autonomous
   lane) are done; U9–U18 (the gated lane) are mostly blocked on one action —
   read its "Needs-Damien" framing to understand why almost nothing here is
   Codex work right now.
4. `git show docs/u14-retired-demo-plan-20260907:docs/plans/2026-09-07-1250-feat-retired-demo-url-and-retention-plan.md`
   — the retired-demo-URL plan (march-through's U14). All six code units
   shipped in PR #46 (merged 2026-09-07); its "Verification Contract" section
   lists the two live-evidence receipts (DEV retention receipt, AE1 browser
   receipt) still owed — both need a live authenticated DEV environment, i.e.
   network, i.e. not this session.
5. `git show feat/roundup-brainstorm:docs/plans/2026-08-20-0836-chore-recent-plan-completion-plan.md`
   — the older, superseded plan (kept for cross-reference only; its live
   units were re-scoped into #3 above).

## The task list

### 1. Local checkout hygiene — drop the 4 stray WIP auto-save commits `[start now]`

**Goal:** get `dev` back to a clean state that matches upstream, with no
leftover PreCompact auto-save noise.

**Files:** none — this is git history surgery only, no file edits.

**What to do:** `git merge-base HEAD origin/dev` currently resolves to
`4cbe4d4c17437660b70764acb364d24b20ef20ba`, which is exactly the commit
immediately before the 4 WIP commits — i.e. those 4 commits are pure noise
with nothing else layered on top, and `origin/dev`'s cached tip
(`5eb9888f…`, PR #46) already contains everything real that came after. So:

> ### STOP — this task needs Damien's approval before any agent runs it
>
> `git reset --hard` is on Damien's standing must-ask list, alongside
> `git push --force` and `git branch -D`. **Do not run it because this handoff
> describes it.** An earlier draft of this document presented the reset as a
> start-now task; that was wrong and is corrected here.
>
> Two things make this worth a pause rather than a rubber stamp. The four
> commits are `WIP: PreCompact auto-save` snapshots from 2026-08-29, which is
> the mechanism that exists precisely so work survives a context compaction —
> so they may hold the only copy of something. And with no network you cannot
> confirm the cached `origin/dev` ref matches true upstream.
>
> **Preserve first, then ask.** This is non-destructive and needs no approval:
>
> ```
> git log --oneline -5                       # confirm the 4 WIP commits are on top
> git branch wip/dev-autosave-20260829 dev   # keep them reachable under a name
> git log --oneline -4 wip/dev-autosave-20260829
> ```
>
> With that branch in place the commits are recoverable no matter what happens
> next. Then ask Damien whether to discard them. Only with his explicit yes:
>
> ```
> git reset --hard origin/dev
> git status -sb                             # expect "## dev...origin/dev", no ahead/behind
> ```
>
> If he would rather not decide now, leaving the four commits in place costs
> nothing — they are local-only and, under the CatholicOS gate, nothing here
> gets pushed anyway.

**Caveat — read before running:** `origin/dev` here is this checkout's
*cached* remote-tracking ref, last updated whenever this repo was last
fetched (confirmed current as of the 2026-09-18 audit and again when this
handoff was written 2026-09-19). You have no network, so you cannot fetch to
confirm nothing has landed on the real `origin/dev` since. If a network-
capable agent or Damien has fetched more recently than you can verify,
`git reset --hard origin/dev` will land you on whatever this checkout's ref
currently says, which may be one fetch behind true upstream — that is fine
for hygiene purposes (it only ever moves you *toward* upstream, never away
from it, since you have no divergent real work to lose), but don't report
this as "fully synced to GitHub," only as "synced to this checkout's last
known `origin/dev`."

**Acceptance test:** `git log --oneline -3` no longer shows any `WIP:
PreCompact auto-save` commit; `git status -sb` shows no ahead/behind counts
against `origin/dev`.

**Pattern to mirror:** none needed — this is a one-shot reset, not a code
change.

### 2. Everything else `[blocked: waiting on Damien / network / the sibling repo]`

There is no second Codex-executable task right now. Every other unit in both
plans (U9 authenticated DEV acceptance, U10 auto-accept proof, U12 demo
activation, U13 reviewer-PAT rewrap, the two retired-demo-URL live receipts)
cascades from one thing: a `dev-deploy` GitHub Actions run in **ontokit-api**
(run `34155698435`) has been parked at its `deploy` job, waiting for a
GitHub Actions environment-approval click, since 2026-09-07 — verified live
today (`gh run view 34155698435` in ontokit-api still shows the `deploy` job
unstarted, 11 days later). None of that is reachable from this repo, let
alone from this session: it needs `gh`/GitHub network access and it needs
Damien's literal click. See "What is NOT Codex's" below.

## What is NOT Codex's

- **The deploy-approval click itself** — filed as Cockpit ask
  `ontokit-web-2026-09-18-2219-dev-deploy-and-two-followups`, question about
  approving GitHub Actions run `34155698435` in `ontokit-api`. This is the
  single dominant blocker: once it lands, U9's remaining scripted steps, U10
  (auto-accept UAT proof), U12 (demo activation), U13 (PAT rewrap), and the
  two retired-demo-URL receipts all become executable — but every one of
  them additionally needs a live, authenticated DEV environment, which is
  network access this session doesn't have either. A Codex session started
  *before* that click lands will find essentially nothing to do beyond task 1
  above — say so plainly if asked to look for more work.
- **Demo credentials (B8)** — same ask stem, second question. Damien already
  answered "not yet — remind me next session" on 2026-09-07; this audit
  re-surfaces it as a still-open deferral, not a new question.
- **Mike/AWS scoped-IAM nudge (B9)** — same ask stem, third question. Damien
  chose "nudge Mike again" on 2026-09-07; unclear whether it was sent. Needs
  him to confirm, or needs a network-capable agent to send it.
- **RDAP/NS recheck for `ontokit.org`** — pure network reconnaissance (a
  WHOIS/RDAP lookup), not a decision, but not something this sandbox can
  reach either.
- **Merging or closing PR #45** — needs `gh pr merge`/`gh pr close`, network.
  The docs-only PR just needs its paper trail landed; the code it documents
  is already live. Flag it for a network-capable agent, don't attempt it
  here.
- **`ontokit-api`'s own checkout hygiene** — that repo is 5 commits behind
  `origin/dev` with no local drift. A Codex session there has its own
  handoff (`ontokit-api/docs/handoffs/2026-09-18-codex-pickup.md`) covering
  exactly that; this session cannot reach that repo (sandbox is scoped to
  `ontokit-web`) and should not try.

## Conventions that will trip it up

- **Test:** `npm run test` (Vitest), `npm run test:coverage` for coverage.
- **Lint/types:** `npm run lint` / `npm run lint:fix`, `npm run type-check`
  (`tsc --noEmit`).
- **Security scan:** CI runs `semgrep ci` diff-aware against the PR baseline
  on every push; `AGENTS.md` gives the local-equivalent commands (Pro vs.
  free tier) if you touch any code — task 1 above does not.
- **Commit convention:** Conventional Commits with a unit tag when the commit
  implements a numbered plan unit, e.g. `feat(demo): follow the retired demo
  pointer and show a notice (U14/U5)`. Task 1 above is a reset, not a new
  commit, so this doesn't apply to it, but keep it in mind if Damien later
  assigns you real implementation work here.
- **No `docs/solutions/` directory exists in this repo** — don't assume one
  and don't invent a citation to it; if you learn something worth recording,
  say so in your report and let Damien or the orchestrating session decide
  where it goes.
- **Never push, never open a PR** — see the standing gate at the top of this
  document.

## Verification already performed

All of the following was checked live on 2026-09-19 (re-verifying the
2026-09-18 cockpit audit) and matched it exactly — do not re-derive these,
just confirm your starting state still looks the same before task 1:

- `git status -sb` → `## dev...origin/dev [ahead 4, behind 1]`, 0 dirty files.
- `git log HEAD..origin/dev --oneline` → exactly one commit, `5eb9888f`
  (PR #46).
- `git log origin/dev..HEAD --oneline` → exactly the 4 `WIP: PreCompact
  auto-save` commits.
- `git merge-base HEAD origin/dev` → `4cbe4d4c…`, i.e. those 4 commits sit on
  top of nothing else — a clean reset, not a rebase with real conflicts.
- `gh pr list --state open` → `#45` (retired-demo docs, open, targets
  `feat/roundup-brainstorm`) and `#2` (stale, unrelated).
- `gh run view 34155698435` (run in `ontokit-api`) → `deploy` job still
  unstarted, `preflight` job green, triggered "about 11 days ago."
- `docs/solutions/` does not exist in this repo (checked, not assumed).

## Attribution discipline

- The **CatholicOS no-push gate** at the top is Damien's standing rule,
  restated verbatim from cockpit-level CLAUDE.md, not this session's
  inference.
- The **readiness verdict and task-1 recommendation** (reset rather than
  rebase, since there's nothing to preserve) are this handoff-writing
  session's own reading of the git graph, verified live, not the audit's
  wording.
- The **"single dominant blocker" framing** and the three Needs-Damien
  questions (deploy click, demo credentials, Mike/AWS nudge) are the
  2026-09-18 cockpit audit's synthesis, filed as ask
  `ontokit-web-2026-09-18-2219-dev-deploy-and-two-followups` — not this
  session's invention, and not yet answered as of this writing.
- The **plans-live-off-`dev` trap** was called out explicitly by Damien when
  commissioning this handoff — flagged here verbatim because it will
  otherwise cost a fresh agent real time.
