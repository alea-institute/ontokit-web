---
title: Ontology atomization (future milestone)
type: feat
status: blocked
date: 2026-06-09
---

# 🧬 Ontology atomization (future milestone)

Part of the [OntoKit Dev & Rollout Roadmap](2026-06-09-001-ontokit-dev-rollout-roadmap.md) — **P4, future track**.

> **Status: BLOCKED / not now.** Awaiting colleague review of the existing plan + critical analysis.
> This is a large architecture change, not an immediate feature branch. Promote to a real milestone
> via `/gsd:new-milestone` once reviewers weigh in.

## Overview

Replace the monolithic in-memory Turtle representation with **per-entity storage + a database index**
(auto-generating Turtle on demand) to scale OntoKit to **50K+ concepts**. The shard-as-commit model
is the leading approach (already in REQUIREMENTS notes).

## Problem Statement

Ontology content today is parsed in-memory (RDFLib) / stored as on-disk git repos — there is **no DB
for ontology content**. This does not scale to very large ontologies and complicates indexing,
search, and concurrent editing at scale.

## Proposed Solution (as written, pending review)

Per-entity files/records + PostgreSQL index + generated Turtle. Big-bang migration touching backend
and frontend together. See the existing root-level design docs (the source of truth until this plan supersedes them).

## Technical Considerations

- **Backend-first:** needs a DB schema design for ontology content (currently absent).
- **Interop risk:** atomization must not break Turtle/OWL interchange — covered in the critical analysis.
- **Cross-repo + DB migration:** the largest-scope initiative in the portfolio.

## Acceptance Criteria (placeholder — to be detailed after review)

- [ ] Colleague review of the plan + critical analysis completed; go/no-go decision recorded.
- [ ] DB schema for atomized content designed and migration strategy chosen.
- [ ] Round-trip fidelity (atomized ↔ Turtle/OWL) proven on a real ontology.
- [ ] Performance target (50K+ concepts) validated.

## Dependencies & Risks

- **Blocked on:** colleague feedback (shared for review ~2026-03-04).
- **Risk:** interop loss, filesystem/Git cost, migration complexity — all raised in the critical-analysis doc.
- **Recommendation:** do not branch until reviewed; treat as its own milestone.

## Sources & References

- `PLAN-ontology-atomization.md` and `PLAN-ontology-atomization-critical-analysis.md` (repo root) — current source of truth.
- Key backend finding: no DB for ontology content today (all RDFLib in-memory / on-disk git repos).
- `.planning/REQUIREMENTS.md` — shard=commit model decision.
