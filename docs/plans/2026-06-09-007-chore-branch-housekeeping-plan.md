---
title: Branch housekeeping — sync dev, prune stale refs
type: refactor
status: active
date: 2026-06-09
---

# 🧹 Branch housekeeping

Part of the [OntoKit Dev & Rollout Roadmap](2026-06-09-001-ontokit-dev-rollout-roadmap.md) — **H, small, anytime**.

## Overview

Low-risk cleanup of the local branch landscape now that all real work is backed up to remotes.

## Tasks

- [ ] **Fast-forward `dev` → `catholicos/dev`** — local `dev` is behind-only (0 ahead), lossless FF.
- [ ] **Prune leftover `[gone]` tracking branches** whose upstreams were merged + deleted on CatholicOS,
      once confirmed their content is upstream:
  - [ ] `feat/react-query-migration` (already merged into `catholicos/dev`)
  - [ ] `upgrade/lucide-react` (CatholicOS has a dependabot lucide-react bump — confirm obsolete first)
  - [ ] `feature/projects-landing-page` (fully merged into `catholicos/main`)
  - [ ] `feature/skip-project-dashboard` (pushed to origin; keep or delete per preference)
- [ ] **Delete redundant local rebases already removed this session** — done: `pr-57`, `backup/pre-rebase-main`,
      `entity-graph-{merged,clean}`, `review-pr-88` (backed up to `origin/backup/*`).
- [ ] **Drop trivial stashes** `stash@{0},{1},{3},{4}` (config/lockfile tweaks; redundant). Keep `stash@{2}`
      (tagged `stash-backup-llm-phase12`) until confirmed its phase-12 planning docs are committed.

## Context

- Branch deletes need explicit approval per workflow rules; this plan tracks the candidates.
- All at-risk work is already preserved on `origin` (alea fork) and via the stash tag.

## Acceptance Criteria

- [ ] `dev` fast-forwarded; `git branch -vv` shows no stale `[gone]` branches holding unmerged work.
- [ ] Stash list reduced to only the tagged keepsake (or empty).

## Sources & References

- Branch alignment state: project memory `project_branch_alignment_2026-06-09`.
- Backups on `origin`: `backup/nullable-index-fields-local`, `backup/entity-graph-{clean,merged}`, `backup/review-pr-88`.
