# Phase 12: Toolchain Integration & Duplicate Detection - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning

<domain>
## Phase Boundary

The backend can query the FOLIO graph, extract definitions from reference texts, check logical consistency, and tell any caller whether a proposed class/property is a duplicate of something already in the ontology. This phase delivers: folio-python structural similarity integration, ANN embeddings index for all entities, auto-rebuild on merge via webhook, composite duplicate scoring (exact + semantic + structural), all-branch duplicate checking with rejection history, and a rich duplicate check API. It does NOT deliver suggestion generation prompts, inline suggestion UX, or flashcard mode (those are Phases 13-14).

</domain>

<decisions>
## Implementation Decisions

### Duplicate Scoring Strategy
- **D-01:** Weighted average composite score — exact label match (40%), semantic embedding similarity (40%), structural similarity from folio-python (20%).
- **D-02:** Thresholds are fixed: >0.95 blocks submission (forces link to existing entity), >0.80 shows warning with candidates, ≤0.80 passes silently.
- **D-03:** Score breakdown is always returned to callers — frontend can render rich UI showing why something was flagged.

### ANN Index Rebuild Trigger
- **D-04:** Webhook-triggered rebuild — GitHub/Gitea post-merge webhook calls an ontokit-api endpoint that enqueues a rebuild job via existing worker.py infrastructure.
- **D-05:** On startup, the system pings to check if a rebuild is necessary. If so, runs it in the background — user sees minimal or no lag.

### folio-python Integration
- **D-06:** Structural similarity only — use folio-python for parent/sibling structural queries (the 20% weight in composite score). Keep consistency checking in ontokit-api's existing consistency_service. Minimal dependency, focused integration.

### Embedding Scope & Freshness
- **D-07:** Incremental + full rebuild strategy — full embed on first setup, diff-based re-embed after merges (only changed/new entities), periodic full rebuild as safety net.
- **D-08:** All-branch duplicate checking — embeddings index covers entities across ALL branches, including active suggestions, submitted suggestions, and rejected suggestions. This ensures:
  - Parallel work collisions are detected (two users proposing the same entity on different branches)
  - Previously rejected duplicates are surfaced with prior rationale
  - New users proposing the same duplicate are directed to the canonical existing entity
- **D-09:** Duplicate check response distinguishes source: "main" (canonical), "pending" (active/submitted suggestion), "rejected" (with rejection reason + canonical link).

### Rejection Metadata Model
- **D-10:** New `duplicate_rejections` database table — columns: rejected_iri, canonical_iri, rejection_reason, rejected_by, rejected_at, suggestion_session_id. Queryable, fast lookup, survives branch deletion.
- **D-11:** When an admin rejects a suggestion as duplicative, the system creates a record linking to the canonical entity. Future duplicate checks surface this history with the prior rationale.

### Embedding Provider Selection
- **D-12:** Independent from LLM provider — keep the existing EmbeddingConfig pattern (project owner configures embedding provider separately). Already supports local/openai/voyage/anthropic. No changes needed.

### Duplicate Check API Contract
- **D-13:** Full breakdown response: verdict (block/warn/pass), composite_score, score_breakdown {exact, semantic, structural}, candidates[] with {iri, label, score, source (main/pending/rejected), rejection_reason?}. Callers get everything to render rich UI.

### Branch Strategy
- **D-14:** Phase 12+ work goes on a new feature branch `llm-ontology-helper` based on current `entity-graph-migration` HEAD. Separate from graph visualization work.

### Claude's Discretion
- Exact folio-python API integration approach (pip dependency vs. subprocess vs. HTTP)
- Incremental diff detection strategy (git diff vs. DB timestamp comparison)
- Webhook endpoint authentication (shared secret vs. IP allowlist)
- Embedding text builder strategy (label + comments + parents vs. full context)
- Background job queue implementation (existing worker.py patterns)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — DEDUP-01 through DEDUP-08, plus TOOL-01 through TOOL-05 (all mapped to Phase 12)

### Existing Embedding Infrastructure
- `../ontokit-api/ontokit/services/embedding_service.py` — EmbeddingService with pgvector, semantic search, rank_suggestions(), cosine similarity
- `../ontokit-api/ontokit/models/embedding.py` — ProjectEmbeddingConfig, EntityEmbedding, EmbeddingJob SQLAlchemy models with pgvector Vector type
- `../ontokit-api/ontokit/api/routes/embeddings.py` — Embedding config/status/trigger endpoints
- `../ontokit-api/ontokit/api/routes/semantic_search.py` — Semantic search and similarity endpoints
- `../ontokit-api/ontokit/worker.py` — Background worker for embedding jobs

### Existing Ontology Index
- `../ontokit-api/ontokit/services/ontology_index.py` — SQL-backed entity queries, hierarchy, labels, annotations
- `../ontokit-api/ontokit/models/ontology_index.py` — IndexedEntity, IndexedHierarchy, IndexedLabel models

### Existing Consistency Service
- `../ontokit-api/ontokit/services/consistency_service.py` — 12-rule RDFLib consistency checker (keep as-is)

### Frontend Embedding Types (already built)
- `lib/api/embeddings.ts` — EmbeddingProvider, EmbeddingConfig, SemanticSearchResult types
- `lib/hooks/useSimilarEntities.ts` — Frontend hook for similarity queries

### Phase 11 LLM Infrastructure (dependency)
- `../ontokit-api/ontokit/services/llm/` — Provider registry, crypto, audit, budget (used for LLM-powered embedding if needed)
- `.planning/phases/11-roles-llm-abstraction-cost-controls/11-CONTEXT.md` — Prior decisions on LLM dispatch, audit logging, key routing

### Suggestion System
- `../ontokit-api/ontokit/api/routes/suggestions.py` — Suggestion session API (needed for cross-branch duplicate checking)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **EmbeddingService**: Already handles embed, search, rank — needs extension for all-branch indexing and composite scoring
- **EntityEmbedding model**: pgvector-backed, already stores entity_iri, project_id, vector, entity_type, label — may need branch/source column
- **worker.py**: Background job processing — will handle webhook-triggered rebuild jobs
- **ontology_index**: SQL queries for parent/child/sibling relationships — structural similarity can build on this
- **consistency_service**: 12 RDFLib rules — no changes needed, stays as-is

### Established Patterns
- **Embedding config**: Per-project provider + model + API key (encrypted) — same pattern continues
- **Background jobs**: EmbeddingJob model with status tracking, worker.py processes queue
- **API routes**: FastAPI routers in `ontokit/api/routes/`, dependency injection via `Depends(get_db)`

### Integration Points
- **Webhook endpoint**: New route in FastAPI to receive post-merge webhooks
- **duplicate_rejections table**: New Alembic migration
- **EmbeddingService extensions**: Add branch-aware indexing, composite scoring, rejection history lookup
- **Duplicate check endpoint**: New route consumed by Phase 13-14 suggestion generation

</code_context>

<specifics>
## Specific Ideas

- When admins reject as duplicative, ALWAYS create a link to the canonical entity — this is critical for directing future users to the right place
- Duplicate check must show prior rejection rationale — "This was previously suggested and rejected. See [canonical entity]"
- Startup health check: system auto-detects if rebuild needed, runs in background, user sees no lag
- All-branch indexing means the system catches parallel work collisions between users on different suggestion branches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 12-toolchain-integration-duplicate-detection*
*Context gathered: 2026-04-06*
