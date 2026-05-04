---
phase: 12-toolchain-integration-duplicate-detection
plan: "01"
subsystem: ontokit-api
tags: [duplicate-detection, database, alembic, pydantic, pgvector, hnsw]
dependency_graph:
  requires: []
  provides:
    - DuplicateRejection SQLAlchemy model (duplicate_rejections table)
    - Pydantic API contract: DuplicateCheckRequest, DuplicateCheckResponse, ScoreBreakdown, DuplicateCandidate
    - Alembic migration v9w0x1y2z3a4 (HNSW index + duplicate_rejections table)
  affects:
    - Plan 12-02 (duplicate check service — consumes DuplicateRejection model and schemas)
    - Plan 12-03 (duplicate check endpoint — consumes Pydantic schemas)
    - Plan 12-04 (frontend integration — consumes DuplicateCheckResponse shape)
tech_stack:
  added: []
  patterns:
    - SQLAlchemy Mapped/mapped_column typed column pattern (consistent with embedding.py)
    - pgvector HNSW index with PL/pgSQL graceful fallback for older extension versions
    - Pydantic BaseModel with Literal type aliases for verdict/source enums
key_files:
  created:
    - ../ontokit-api/ontokit/models/duplicate_rejection.py
    - ../ontokit-api/ontokit/schemas/duplicate_check.py
    - ../ontokit-api/alembic/versions/v9w0x1y2z3a4_add_hnsw_index_and_duplicate_rejections.py
  modified:
    - ../ontokit-api/ontokit/models/__init__.py
decisions:
  - "[12-01] HNSW wrapped in DO $$ ... EXCEPTION WHEN others ... END $$ block — graceful fallback for pgvector < 0.5.0 so migration succeeds on older dev environments"
  - "[12-01] DuplicateVerdict and CandidateSource defined as Literal aliases (not Enum) — consistent with existing schema patterns in embeddings.py and quality.py"
metrics:
  duration: 2min
  completed: 2026-04-06
  tasks_completed: 2
  files_created: 3
  files_modified: 1
---

# Phase 12 Plan 01: Database Layer — DuplicateRejection Model, HNSW Index, Pydantic Schemas

**One-liner:** SQLAlchemy DuplicateRejection model + Alembic migration adding HNSW ANN index on entity_embeddings and duplicate_rejections table + Pydantic API contract for the duplicate check endpoint.

## What Was Built

### Task 1: DuplicateRejection Model and Pydantic Schemas

**`ontokit/models/duplicate_rejection.py`** — SQLAlchemy model with all D-10 columns:
- `id` (UUID PK), `project_id` (FK → projects.id CASCADE), `rejected_iri`, `canonical_iri`, `rejection_reason` (nullable Text), `rejected_by`, `rejected_at` (timezone-aware, server_default=now()), `suggestion_session_id` (FK → suggestion_sessions.id SET NULL, nullable)
- Lookup index `ix_duplicate_rejections_lookup` on `(project_id, rejected_iri)` for fast per-project queries

**`ontokit/schemas/duplicate_check.py`** — Full Pydantic API contract per D-13:
- `DuplicateVerdict = Literal["block", "warn", "pass"]` — drives UI gate behavior
- `CandidateSource = Literal["main", "pending", "rejected"]` — candidate provenance
- `ScoreBreakdown(exact, semantic, structural)` — raw component scores for transparency
- `DuplicateCandidate(iri, label, score, source, branch, rejection_reason, canonical_iri)`
- `DuplicateCheckRequest(label, entity_type, parent_iri, branch)`
- `DuplicateCheckResponse(verdict, composite_score, score_breakdown, candidates[])`

**`ontokit/models/__init__.py`** updated to export `DuplicateRejection`.

### Task 2: Alembic Migration

**`alembic/versions/v9w0x1y2z3a4_...py`** — chains from `u9v0w1x2y3a4` (Phase 11):
- Creates `duplicate_rejections` table with all D-10 columns and FK constraints
- Creates `ix_duplicate_rejections_lookup` index
- Creates HNSW index `ix_entity_embeddings_hnsw` on `entity_embeddings.embedding` using `vector_cosine_ops` with `m=16, ef_construction=64` — wrapped in PL/pgSQL `EXCEPTION WHEN others` block for graceful degradation on pgvector < 0.5.0
- Downgrade: drops HNSW index, lookup index, and table in correct order

## Commits

| Task | Commit | Message |
|------|--------|---------|
| Task 1 | `8226d9e` | feat(12-01): DuplicateRejection model and Pydantic schemas |
| Task 2 | `11d1d3a` | feat(12-01): Alembic migration for HNSW index and duplicate_rejections table |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — this plan is pure database layer (model + migration + schemas). No UI rendering, no hardcoded values.

## Self-Check: PASSED

Files exist:
- FOUND: `/home/damienriehl/Coding Projects/ontokit-api/ontokit/models/duplicate_rejection.py`
- FOUND: `/home/damienriehl/Coding Projects/ontokit-api/ontokit/schemas/duplicate_check.py`
- FOUND: `/home/damienriehl/Coding Projects/ontokit-api/alembic/versions/v9w0x1y2z3a4_add_hnsw_index_and_duplicate_rejections.py`

Commits exist:
- FOUND: `8226d9e` feat(12-01): DuplicateRejection model and Pydantic schemas
- FOUND: `11d1d3a` feat(12-01): Alembic migration for HNSW index and duplicate_rejections table

Import verification: `DuplicateRejection.__tablename__ == "duplicate_rejections"` — PASSED
Schema verification: `DuplicateCheckResponse(verdict="block", ...).verdict == "block"` — PASSED
Alembic head: `v9w0x1y2z3a4` — PASSED
