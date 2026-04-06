# Phase 12: Toolchain Integration & Duplicate Detection - Research

**Researched:** 2026-04-06
**Domain:** Python backend — pgvector ANN indexing, folio-python structural similarity, OWL reasoner integration, composite duplicate scoring, webhook-triggered rebuild, all-branch embeddings
**Confidence:** HIGH (core infrastructure verified from source; LOW only on OpenGloss availability)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Weighted average composite score — exact label match (40%), semantic embedding similarity (40%), structural similarity from folio-python (20%).
- **D-02:** Thresholds fixed: >0.95 blocks submission (forces link to existing entity), >0.80 shows warning with candidates, ≤0.80 passes silently.
- **D-03:** Score breakdown always returned — frontend renders rich UI showing why something was flagged.
- **D-04:** Webhook-triggered rebuild — GitHub/Gitea post-merge webhook calls an ontokit-api endpoint that enqueues a rebuild job via existing worker.py infrastructure.
- **D-05:** On startup, system pings to check if rebuild is necessary. If so, runs it in background.
- **D-06:** Structural similarity only from folio-python — parent/sibling structural queries (the 20% weight). Consistency checking stays in existing consistency_service.
- **D-07:** Incremental + full rebuild strategy — full embed on first setup, diff-based re-embed after merges.
- **D-08:** All-branch duplicate checking — embeddings index covers entities across ALL branches (main + active/submitted/rejected suggestions).
- **D-09:** Duplicate check response distinguishes source: "main" (canonical), "pending" (active/submitted suggestion), "rejected" (with rejection reason + canonical link).
- **D-10:** New `duplicate_rejections` database table — columns: rejected_iri, canonical_iri, rejection_reason, rejected_by, rejected_at, suggestion_session_id.
- **D-11:** When admin rejects a suggestion as duplicative, system creates a record linking to canonical entity. Future duplicate checks surface this history.
- **D-12:** Embedding provider independent from LLM provider — existing EmbeddingConfig pattern continues unchanged.
- **D-13:** Full breakdown response: verdict (block/warn/pass), composite_score, score_breakdown {exact, semantic, structural}, candidates[] with {iri, label, score, source, rejection_reason?}.
- **D-14:** Phase 12+ work goes on a new feature branch `llm-ontology-helper` based on current `entity-graph-migration` HEAD.

### Claude's Discretion

- Exact folio-python API integration approach (pip dependency vs. subprocess vs. HTTP)
- Incremental diff detection strategy (git diff vs. DB timestamp comparison)
- Webhook endpoint authentication (shared secret vs. IP allowlist)
- Embedding text builder strategy (label + comments + parents vs. full context)
- Background job queue implementation (existing worker.py patterns)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TOOL-01 | Backend calls folio-python for graph queries (structural similarity, parent/sibling lookups) | folio-python v0.3.3 installed globally; needs adding to ontokit-api venv deps; `FOLIO.get_parents()` / `FOLIO.get_children()` / `FOLIO.query()` API confirmed |
| TOOL-02 | Backend integrates OpenGloss for definition/gloss extraction from reference texts | OpenGloss has no PyPI package and no ALEA GitHub repo — requires stub/bypass (see Open Questions) |
| TOOL-03 | Backend loads the FOLIO OWL file into a reasoner for logical consistency checks (cycles, domain/range) | owlready2 v0.50 already in venv; `consistency_service.py` has 12 existing rules via RDFLib — reasoner integration extends these patterns |
| TOOL-04 | Reasoner validation runs after user accepts suggestions but before commit | Existing consistency_service pattern; new endpoint wraps it as pre-commit validator |
| TOOL-05 | Generative FOLIO is installable as a Python dependency in the ontokit-api venv | folio-python v0.3.3 pip-installable; needs `uv add folio-python` to pyproject.toml |
| DEDUP-01 | System pre-computes embeddings for all existing classes and properties | EmbeddingService.embed_project() already does this; needs all-branch extension |
| DEDUP-02 | Embeddings stored in approximate-nearest-neighbor index for O(log n) similarity search | pgvector v0.4.2 in venv; current migration uses B-tree index only — needs HNSW index migration |
| DEDUP-03 | ANN index rebuilt automatically after each merge to main branch | ARQ worker + existing webhook infrastructure (pull_requests.py github_webhook) — needs merge event handler |
| DEDUP-04 | Every LLM suggestion scored against ontology for exact label match, semantic similarity, and structural similarity | DuplicateCheckService extends existing EmbeddingService + new folio-python structural service |
| DEDUP-05 | Composite duplicate score >0.95 blocks submission | DuplicateCheckService returns verdict="block"; API returns 422 or structured error |
| DEDUP-06 | Composite duplicate score >0.80 shows warning with candidate existing entities | DuplicateCheckService returns verdict="warn" with candidates list |
| DEDUP-07 | Composite score ≤0.80 passes silently | DuplicateCheckService returns verdict="pass" |
| DEDUP-08 | Duplicate check runs across the whole ontology, not just local neighborhood | All-branch embedding scope in EmbeddingService; cross-branch query in DuplicateCheckService |
</phase_requirements>

---

## Summary

The backend infrastructure for this phase is substantially pre-built. pgvector embeddings (per-branch, per-project) are already implemented in `EmbeddingService`, ARQ worker tasks for embedding generation exist in `worker.py`, and a GitHub webhook handler exists in `pull_requests.py`. The primary engineering work is: (1) adding the missing HNSW ANN index on `entity_embeddings`, (2) extending the embedding scope to cover all branches including suggestion branches, (3) wrapping folio-python's `get_parents`/`get_children` API into a `StructuralSimilarityService`, (4) building a `DuplicateCheckService` that composes exact + semantic + structural scores per D-01, (5) creating the `duplicate_rejections` table and surfacing rejection history in responses, (6) adding a webhook endpoint that triggers an ANN index rebuild job on post-merge, and (7) a startup health check that auto-triggers rebuild if index is stale.

folio-python v0.3.3 is installed system-wide but NOT in the ontokit-api venv — adding it to `pyproject.toml` is a required Wave 0 step. owlready2 v0.50 IS in the venv already (it's already in `pyproject.toml` under `owlready2>=0.47`). OpenGloss (TOOL-02) does not appear to exist as a PyPI package or ALEA GitHub repository — this requirement needs clarification and the planner should stub it out (see Open Questions).

**Primary recommendation:** Build a `DuplicateCheckService` that reuses `EmbeddingService.semantic_search()` for the semantic score, adds a `StructuralSimilarityService` wrapping folio-python for the structural score, and does exact-match label lookup against the ontology index for the exact score. Add HNSW index migration, all-branch embedding scope, `duplicate_rejections` table, and webhook rebuild trigger. Stub OpenGloss pending clarification.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pgvector | 0.4.2 | Vector storage + cosine similarity queries | Already in venv; production-ready ANN with HNSW (pgvector ≥ 0.5.0 supports `CREATE INDEX ... USING hnsw`) |
| folio-python | 0.3.3 | Structural similarity (parents/siblings) | ALEA Institute's official Python client; already installed globally; pip-installable |
| owlready2 | 0.50 | OWL reasoner for pre-commit consistency checks | Already in venv (pyproject.toml `owlready2>=0.47`); incumbent in ontokit |
| arq | 0.26.0 | Background job queue for rebuild tasks | Already in worker.py; all existing jobs use this pattern |
| rdflib | 7.1.0+ | Graph loading for entity extraction | Core ontology library throughout ontokit-api |
| numpy | 1.26.0+ | Vector math for cosine similarity fallback | Already in venv; used in rank_suggestions() |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| sqlalchemy | 2.0.0+ | ORM for duplicate_rejections table | Standard across all ontokit-api models |
| alembic | 1.14.0+ | Database migrations | New table + HNSW index migration |
| openai | 1.0.0 | Embedding provider (when configured) | Already in venv; used by EmbeddingService |
| sentence-transformers | 3.0.0+ | Local embedding provider | Already in venv; default "local" provider |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| pgvector HNSW | FAISS in-memory ANN | pgvector is already deployed, FAISS would require separate process and index serialization |
| folio-python as pip dep | subprocess call | Pip dep is cleaner, testable, type-safe; subprocess adds latency and error handling complexity |
| owlready2 for reasoner | RDFLib only | owlready2 provides proper OWL 2 DL reasoning (classification, consistency); RDFLib is triple-store, not reasoner |

**Installation (ontokit-api venv):**
```bash
uv add folio-python
# owlready2 already present; pgvector already present
```

**Version verification:**
- folio-python: `pip show folio-python` → 0.3.3 (2026-04-06)
- pgvector: dist-info confirms 0.4.2 (2026-04-06)
- owlready2: dist-info confirms 0.50 (2026-04-06)

---

## Architecture Patterns

### Recommended Service Structure

```
ontokit/services/
├── duplicate_detection_service.py  # EXISTING — label-similarity only (will be REPLACED)
├── duplicate_check_service.py      # NEW — composite scorer (exact + semantic + structural)
├── structural_similarity_service.py  # NEW — folio-python wrapper
└── embedding_service.py            # EXISTING — extend for all-branch scope

ontokit/api/routes/
└── duplicate_check.py              # NEW — POST /projects/{id}/duplicate-check endpoint

ontokit/models/
└── duplicate_rejection.py          # NEW — DuplicateRejection SQLAlchemy model

alembic/versions/
├── v9w0x1y2z3a4_add_hnsw_index.py         # NEW — HNSW index on entity_embeddings
└── v0x1y2z3a4b5_add_duplicate_rejections.py  # NEW — duplicate_rejections table
```

### Pattern 1: folio-python Integration as Pip Dependency

folio-python's `FOLIO` class loads the FOLIO OWL graph at instantiation. For structural similarity, the pattern is to call `get_parents(iri)` and `get_children(iri)` and compute Jaccard similarity between parent/sibling sets.

**folio-python API (confirmed from source):**
- `FOLIO(source_type='github', use_cache=True)` — loads from GitHub with local cache
- `FOLIO(source_type='http', http_url='...')` — loads from custom URL
- `folio_instance.parse_owl(buffer: str)` — accepts a raw OWL XML string (allows loading a custom ontology file)
- `folio_instance.get_parents(iri, max_depth=5) -> List[OWLClass]`
- `folio_instance.get_children(iri, max_depth=5) -> List[OWLClass]`
- `folio_instance.query(label=..., parent_iri=..., match_mode='exact', limit=20) -> List[OWLClass]`
- `OWLClass.iri`, `OWLClass.label`, `OWLClass.sub_class_of`, `OWLClass.parent_class_of`

**Critical note on folio-python and ontokit projects:** folio-python by default loads the canonical FOLIO ontology from GitHub. For ontokit projects that ARE FOLIO (the production case), this is fine. For non-FOLIO ontologies, we must use `folio_instance.parse_owl(buffer)` with the project's own OWL content. The `StructuralSimilarityService` must handle both cases.

**Singleton / caching pattern:**
```python
# Source: folio-python FOLIO.__init__ — loads once, caches to disk
# FOLIO loads from GitHub on first call; subsequent calls use cache
# For ontokit: keep a per-project singleton, invalidate on merge

_folio_cache: dict[str, "FOLIO"] = {}

def get_folio_instance(project_id: str, owl_content: str) -> "FOLIO":
    if project_id not in _folio_cache:
        f = FOLIO.__new__(FOLIO)
        # Initialize minimal state
        f.classes = []
        f.iri_to_index = {}
        # ... (see parse_owl for full init)
        f.parse_owl(owl_content.encode())
        _folio_cache[project_id] = f
    return _folio_cache[project_id]
```

**Simpler approach (recommended for Phase 12):** Since folio-python's `FOLIO` class init calls `parse_owl` internally, directly construct from an OWL buffer:

```python
# Source: folio-python graph.py FOLIO.__init__ pattern
from folio.graph import FOLIO

# For FOLIO-based projects: use default GitHub load with cache
folio_instance = FOLIO(use_cache=True)  # caches to ~/.folio/

# For custom ontology: load OWL content and parse directly
folio_instance = FOLIO.__new__(FOLIO)
folio_instance._init_empty()  # internal reset — but this is not a public API
# SAFER: use http_url pointing to local OWL file served by ontokit-api itself
```

**Recommended integration:** Use folio-python as a pip dep, load via `FOLIO(source_type='http', http_url=<project_source_url>)` or via the parse_owl path. For FOLIO projects, use default GitHub-cached load. Cache the instance per project/branch_commit_hash, invalidate on commit.

### Pattern 2: HNSW Index on entity_embeddings

The current `entity_embeddings` table has only a B-tree index (`ix_entity_embeddings_project_branch`). pgvector ≥ 0.5.0 supports HNSW which gives O(log n) approximate nearest neighbor queries — critical for 18,326+ entities at <200ms.

```sql
-- Source: pgvector documentation (HNSW, available in pgvector ≥ 0.5.0)
-- Our venv has 0.4.2 (Python client); the PostgreSQL extension version must be ≥ 0.5.0
CREATE INDEX ix_entity_embeddings_hnsw 
ON entity_embeddings 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

**Important:** The Python `pgvector` package version (0.4.2) and the PostgreSQL `pgvector` extension version are separate. The extension must be ≥ 0.5.0 for HNSW support. The Alembic migration should use `op.execute()` for raw DDL:

```python
# Source: existing alembic pattern in n2o3p4q5r6s7_add_embedding_tables.py
op.execute("""
    CREATE INDEX ix_entity_embeddings_hnsw 
    ON entity_embeddings 
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64)
""")
```

The existing `semantic_search()` SQL query in `EmbeddingService` already uses `<=>` (cosine distance operator), which will automatically use the HNSW index once created.

### Pattern 3: Composite Duplicate Score (D-01)

```python
# New service: ontokit/services/duplicate_check_service.py
class DuplicateCheckService:
    """Composite duplicate detection per D-01/D-02/D-03."""
    
    async def check(
        self,
        project_id: UUID,
        label: str,
        entity_type: str,
        limit: int = 10,
    ) -> DuplicateCheckResponse:
        # 1. Exact score: normalized label match against ontology index
        exact_score = await self._exact_score(project_id, label)
        
        # 2. Semantic score: embed label, cosine similarity across ALL branches
        semantic_candidates = await self._semantic_search_all_branches(
            project_id, label, limit=limit
        )
        semantic_score = semantic_candidates[0].score if semantic_candidates else 0.0
        
        # 3. Structural score: folio-python parent/sibling Jaccard
        structural_score = await self._structural_score(project_id, label)
        
        # 4. Composite (D-01 weights)
        composite = (
            0.40 * exact_score
            + 0.40 * semantic_score
            + 0.20 * structural_score
        )
        
        # 5. Verdict (D-02)
        if composite > 0.95:
            verdict = "block"
        elif composite > 0.80:
            verdict = "warn"
        else:
            verdict = "pass"
        
        # 6. Enrich candidates with source + rejection history (D-09)
        candidates = await self._enrich_candidates(project_id, semantic_candidates)
        
        return DuplicateCheckResponse(
            verdict=verdict,
            composite_score=round(composite, 4),
            score_breakdown=ScoreBreakdown(
                exact=exact_score,
                semantic=semantic_score,
                structural=structural_score,
            ),
            candidates=candidates,
        )
```

### Pattern 4: All-Branch Embedding Scope (D-08)

The current `EmbeddingService.semantic_search()` queries a single branch. For all-branch duplicate checking, the query must span all branches for a project. This is a targeted extension — add a new method rather than modifying the existing one:

```python
async def semantic_search_all_branches(
    self,
    project_id: UUID,
    query: str,
    limit: int = 10,
    threshold: float = 0.3,
) -> list[SemanticSearchResultWithBranch]:
    """Search across ALL branches — needed for cross-branch duplicate detection."""
    query_vec = await provider.embed_text(query)
    # No branch filter — queries across all branches for the project
    query_str = text("""
        SELECT entity_iri, label, entity_type, branch, deprecated,
               1 - (embedding <=> :query_vec::vector) AS score
        FROM entity_embeddings
        WHERE project_id = :pid
        ORDER BY embedding <=> :query_vec::vector
        LIMIT :lim
    """)
```

**Branch classification** (for D-09 source field):
- Branch == project default branch → source = "main"
- Branch matches a `SuggestionSession.branch` with status active/submitted → source = "pending"
- Branch matches a `SuggestionSession.branch` with status rejected → source = "rejected"
- Cross-reference `duplicate_rejections` table for rejection reason

### Pattern 5: Webhook-Triggered ANN Rebuild (D-04)

The existing GitHub webhook handler in `pull_requests.py` already handles `pull_request` events with `action == "closed"` and `merged == true`. The Phase 12 addition is to enqueue an embedding rebuild job when this event fires.

Pattern (extend existing webhook handler):
```python
# In PullRequestService.handle_github_pr_webhook():
if action == "closed" and pr_data.get("merged"):
    # Already syncs PR state; add embedding rebuild trigger:
    await self._enqueue_embedding_rebuild(project_id, default_branch)
```

For Gitea/non-GitHub webhooks, add a new generic `POST /projects/{id}/webhooks/post-merge` endpoint with shared-secret auth (Claude's discretion).

### Pattern 6: Startup Freshness Check (D-05)

```python
# In lifespan() in main.py, after DB check:
# Startup embedding freshness check
try:
    from ontokit.services.startup_checks import check_and_trigger_embedding_rebuilds
    await check_and_trigger_embedding_rebuilds()
except Exception:
    logger.exception("Startup embedding check failed — continuing")
```

The `check_and_trigger_embedding_rebuilds()` function queries `project_embedding_configs.last_full_embed_at` and compares against the latest commit hash in git. If stale, enqueues a rebuild job via ARQ.

### Pattern 7: DuplicateRejection Table (D-10/D-11)

```python
# New model: ontokit/models/duplicate_rejection.py
class DuplicateRejection(Base):
    __tablename__ = "duplicate_rejections"
    
    id: Mapped[uuid.UUID]
    project_id: Mapped[uuid.UUID]          # FK to projects
    rejected_iri: Mapped[str]              # IRI that was rejected as duplicate
    canonical_iri: Mapped[str]             # IRI it was a duplicate of
    rejection_reason: Mapped[str | None]   # Admin's rejection note
    rejected_by: Mapped[str]               # user_id of admin
    rejected_at: Mapped[datetime]
    suggestion_session_id: Mapped[uuid.UUID | None]  # FK to suggestion_sessions
    
    __table_args__ = (
        Index("ix_duplicate_rejections_rejected_iri", "project_id", "rejected_iri"),
    )
```

This table is populated when an admin rejects a suggestion with reason "duplicate". The `SuggestionService.reject()` method needs a new optional `canonical_iri` parameter; when provided, it writes to `duplicate_rejections`.

### Anti-Patterns to Avoid

- **Don't run folio-python query per HTTP request without caching** — the FOLIO class loads 18,326+ entities at init time. Cache per project/commit_hash, not per request.
- **Don't modify existing `semantic_search()` signature** — it's used by the frontend today. Add `semantic_search_all_branches()` as a new method.
- **Don't assume pgvector extension version matches Python package version** — they're independent. The Alembic HNSW migration should use `IF NOT EXISTS` and handle graceful failure if the extension is too old.
- **Don't block the HTTP request thread for embedding operations** — always enqueue to ARQ worker. The duplicate check endpoint may embed the query text synchronously (single vector call is fast), but full rebuilds must be async.
- **Don't store normalized composite score in the database** — scores change as the index grows; always compute at query time.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| ANN vector search | Custom FAISS service | pgvector HNSW | Already deployed, same DB, no separate process |
| OWL hierarchy traversal | Custom graph BFS | folio-python `get_parents()`/`get_children()` | Handles transitive closure, deprecated entities, cycles correctly |
| OWL consistency checking | New RDFLib rules | Existing `consistency_service.py` | 12 rules already implemented and tested |
| Background job queue | Redis queue from scratch | ARQ (existing worker.py) | Already integrated, battle-tested, has startup/shutdown hooks |
| Webhook signature verification | Custom HMAC impl | Existing `pull_requests.py` pattern | Already uses `hmac.compare_digest` + `hashlib.sha256` |
| Vector cosine similarity | numpy cosine function | pgvector `<=>` operator | HNSW index makes this O(log n) vs O(n) for numpy |

**Key insight:** The embedding and search infrastructure is 80% done. Phase 12 is primarily about composing existing services with new glue code, adding two database objects (HNSW index + duplicate_rejections table), and wiring up the webhook trigger.

---

## Runtime State Inventory

> Phase 12 is additive — new services, new tables, new index. No rename/refactor. No runtime state migration required.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | `entity_embeddings` rows (existing per-branch data) — not migrated, only extended | None — existing rows remain valid; HNSW index adds on top |
| Live service config | No external service config changes | None |
| OS-registered state | None | None |
| Secrets/env vars | No new secrets required; folio-python uses GitHub public API (no auth needed for public FOLIO repo) | None |
| Build artifacts | folio-python not yet in ontokit-api venv | `uv add folio-python` in Wave 0 |

---

## Common Pitfalls

### Pitfall 1: pgvector Extension Version vs. Python Package Version
**What goes wrong:** Developer creates HNSW migration, it runs without error on dev, but fails silently in production because the PostgreSQL pgvector extension is < 0.5.0 (HNSW was added in pgvector 0.5.0, November 2023).
**Why it happens:** `pgvector` (Python client) version 0.4.2 and `pgvector` (PostgreSQL extension) version are independent. The extension in Postgres must be ≥ 0.5.0.
**How to avoid:** Migration should check `SELECT extversion FROM pg_extension WHERE extname = 'vector'` and skip HNSW creation with a warning if < 0.5.0. Or use `CREATE INDEX IF NOT EXISTS ... USING hnsw` which will raise a clear error if not supported.
**Warning signs:** `ERROR: access method "hnsw" does not exist`

### Pitfall 2: folio-python Loading Delay at First Use
**What goes wrong:** First request after restart hits a 5-30 second delay while folio-python downloads the FOLIO OWL file from GitHub.
**Why it happens:** `FOLIO(use_cache=True)` — first load fetches from GitHub (~5MB XML), subsequent loads use `~/.folio/` disk cache. On fresh deployments, cache is empty.
**How to avoid:** Pre-warm the folio-python cache during startup lifespan (async background task). OR use `source_type='http'` pointing to a local mirror/cached file. For the FOLIO production case, the GitHub cache will persist across restarts.
**Warning signs:** 30-second timeouts on first structural similarity query after deploy.

### Pitfall 3: All-Branch Query Returns Stale Suggestion-Branch Embeddings
**What goes wrong:** Suggestion branch was merged and deleted months ago; its embeddings still exist in `entity_embeddings` because branch deletion doesn't cascade delete embeddings.
**Why it happens:** `EntityEmbedding` has no automatic cleanup on branch deletion. The all-branch query picks up ghost entries.
**How to avoid:** Add a cleanup step in the suggestion merge handler — when a PR is merged, delete embeddings for the suggestion branch (they'll be captured in main's rebuild). OR add branch-in-active-sessions guard to the all-branch query.
**Warning signs:** Duplicate check shows "pending" source for an entity that was merged months ago.

### Pitfall 4: Exact Score Computation — Case and Normalization
**What goes wrong:** User submits "Legal Entity" → exact match misses "legal entity" and "Legal entity" (different capitalization) with score=0.0, leading to composite score below warning threshold, when the true intent is to block.
**Why it happens:** Simple string equality without normalization.
**How to avoid:** Normalize both stored labels and query label to lowercase + stripped whitespace before comparison. The existing `duplicate_detection_service.py` already normalizes with `label.lower().strip()` — reuse this pattern.
**Warning signs:** Users successfully submitting classes that are obvious case-only duplicates of existing ones.

### Pitfall 5: folio-python's `parse_owl()` Expects UTF-8 Bytes, Not str
**What goes wrong:** `folio_instance.parse_owl(owl_str)` raises `lxml.etree.XMLSyntaxError` with a cryptic error.
**Why it happens:** `lxml.etree.fromstring()` in folio-python expects `bytes`, but Python string is `str`. The `XMLParser(encoding="utf-8")` param does not auto-encode.
**How to avoid:** Always encode before passing: `folio_instance.parse_owl(owl_str.encode('utf-8'))`.
**Warning signs:** `TypeError: Argument 'text' has incorrect type (expected bytes, got str)`

### Pitfall 6: ARQ Job Deduplication for Webhook-Triggered Rebuilds
**What goes wrong:** 10 PRs merge in quick succession → 10 rebuild jobs enqueued → 10 concurrent embedding jobs hammering the embedding provider API → rate limit errors and wasted cost.
**Why it happens:** The existing `generate_embeddings` endpoint already has deduplication (checks for active job before enqueuing), but the webhook rebuild trigger may bypass this check.
**How to avoid:** Reuse the existing `EmbeddingJob` deduplication pattern — check for active job before enqueuing rebuild. If a rebuild is already in progress, skip.
**Warning signs:** Multiple simultaneous embedding jobs for the same project/branch in `embedding_jobs` table.

---

## Code Examples

Verified patterns from existing source:

### Enqueueing an ARQ job (from embeddings.py)
```python
# Source: ontokit/api/routes/embeddings.py — generate_embeddings()
job_id = uuid.uuid4()
pending_job = EmbeddingJob(id=job_id, project_id=project_id, branch=resolved_branch, status="pending")
db.add(pending_job)
await db.commit()

pool = await get_arq_pool()
await pool.enqueue_job("run_embedding_generation_task", str(project_id), resolved_branch, str(job_id))
```

### ARQ task registration pattern (from worker.py)
```python
# Source: ontokit/worker.py — WorkerSettings.functions
class WorkerSettings:
    functions = [
        run_ontology_index_task,
        run_embedding_generation_task,
        # Add new task here:
        run_ann_rebuild_task,
    ]
```

### pgvector cosine distance query (from embedding_service.py)
```python
# Source: ontokit/services/embedding_service.py — semantic_search()
query_str = text("""
    SELECT entity_iri, label, entity_type, deprecated,
           1 - (embedding <=> :query_vec::vector) AS score
    FROM entity_embeddings
    WHERE project_id = :pid AND branch = :br
    ORDER BY embedding <=> :query_vec::vector
    LIMIT :lim
""")
# HNSW index will be used automatically once created
```

### folio-python parents/siblings (confirmed from source inspection)
```python
# Source: folio-python v0.3.3 graph.py
from folio.graph import FOLIO

folio = FOLIO(use_cache=True)  # loads FOLIO from GitHub with disk cache
parents = folio.get_parents(iri, max_depth=5)    # List[OWLClass]
children = folio.get_children(iri, max_depth=1)  # List[OWLClass] — direct siblings

# Structural similarity via Jaccard:
def structural_similarity(iri_a: str, iri_b: str, folio: FOLIO) -> float:
    parents_a = {c.iri for c in folio.get_parents(iri_a, max_depth=3)}
    parents_b = {c.iri for c in folio.get_parents(iri_b, max_depth=3)}
    if not parents_a and not parents_b:
        return 0.0
    intersection = parents_a & parents_b
    union = parents_a | parents_b
    return len(intersection) / len(union) if union else 0.0
```

### GitHub webhook merge detection (from pull_requests.py)
```python
# Source: ontokit/api/routes/pull_requests.py — existing github_webhook handler
if x_github_event == "pull_request":
    await service.handle_github_pr_webhook(
        project_id,
        payload.get("action", ""),
        payload.get("pull_request", {}),
    )
# Extend handle_github_pr_webhook to check:
# if action == "closed" and pr_data.get("merged"):
#     await enqueue_ann_rebuild(project_id, default_branch)
```

### DuplicateRejection creation on rejection (pattern to add to SuggestionService)
```python
# Pattern: extend SuggestionService.reject() in suggestion_service.py
async def reject(
    self, 
    project_id: UUID, 
    session_id: str, 
    request: SuggestionRejectRequest,
    canonical_iri: str | None = None,  # NEW PARAM
) -> SuggestionSessionResponse:
    # ... existing rejection logic ...
    if canonical_iri and request.reason:
        rejection = DuplicateRejection(
            project_id=project_id,
            rejected_iri=request.entity_iri,
            canonical_iri=canonical_iri,
            rejection_reason=request.reason,
            rejected_by=user.id,
            suggestion_session_id=session.id,
        )
        self._db.add(rejection)
    await self._db.commit()
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| IVFFlat index for ANN | HNSW index (pgvector ≥ 0.5.0) | November 2023 | HNSW is faster at query time, no training required, no probes tuning |
| Single-branch semantic search | All-branch cross-search | Phase 12 (new) | Catches parallel work collisions |
| Label-only duplicate detection (existing duplicate_detection_service.py) | Composite exact+semantic+structural | Phase 12 (new) | Catches near-duplicates with different labels |

**Deprecated/outdated in this phase:**
- `duplicate_detection_service.py` (find_duplicates function): The existing service uses difflib SequenceMatcher for pairwise label comparison. It is used by the HealthCheckPanel "Duplicates" tab. Phase 12 does NOT replace this service — it operates at a different level (quality report across all existing entities) vs. the new `DuplicateCheckService` (real-time check before submission). Both should coexist.

---

## Open Questions

1. **OpenGloss (TOOL-02) does not appear to exist as a Python package**
   - What we know: TOOL-02 requires "OpenGloss for definition/gloss extraction from reference texts". No PyPI package named `opengloss` exists. No ALEA GitHub repository named `opengloss` exists. The `openGloss` project on GitHub (by user `aeschylus`) is a linked data standard (JSON-LD), not a Python library.
   - What's unclear: Whether this refers to a private/internal ALEA tool, a tool that was planned but not yet built, or a different package name.
   - Recommendation: **Stub TOOL-02 in Phase 12.** Create a `GlossExtractionService` interface with a `NotImplementedError` body and a comment referencing TOOL-02. Mark the requirement as "stub — pending OpenGloss availability." The planner should schedule this as a Wave 0 investigation task — ask the user to clarify what OpenGloss refers to before Wave 2 implementation.

2. **folio-python loads the canonical FOLIO ontology by default — does this work for custom ontology projects?**
   - What we know: `FOLIO(source_type='github')` loads the FOLIO 2.0 ontology. For projects that ARE FOLIO, this is correct. For non-FOLIO projects, `parse_owl(buffer)` can load a custom ontology, but it requires the full init state to be set up first.
   - What's unclear: Are all ontokit projects FOLIO-based, or can users load arbitrary ontologies?
   - Recommendation: For Phase 12, assume FOLIO projects. `StructuralSimilarityService` uses default FOLIO load. Add a comment noting that non-FOLIO projects return structural_score=0.0 (no structural data available), which is safe — composite score falls back to exact+semantic.

3. **HNSW index requires PostgreSQL pgvector extension ≥ 0.5.0 — what version is deployed in production?**
   - What we know: Python pgvector package is 0.4.2. The production server is Ubuntu 24.04 ARM64 (from STATE.md). pgvector extension version in production is unknown.
   - What's unclear: Whether the production PostgreSQL instance has pgvector ≥ 0.5.0.
   - Recommendation: Alembic migration should use `DO $$ BEGIN ... EXCEPTION WHEN others THEN RAISE WARNING ... END $$;` pattern to attempt HNSW creation but fall back to B-tree if the extension is too old, with a clear warning in logs.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| folio-python | TOOL-01, TOOL-05, structural similarity | ✓ (system-wide) | 0.3.3 | — (no fallback; structural_score=0.0 if import fails) |
| owlready2 | TOOL-03, TOOL-04 | ✓ (venv) | 0.50 | — (no fallback; TOOL-03 degrades to RDFLib-only checks) |
| pgvector (Python) | DEDUP-01/02 | ✓ (venv) | 0.4.2 | — |
| pgvector (extension) | DEDUP-02 HNSW | Unknown in production | Unknown | Fall back to IVFFlat or B-tree scan if HNSW not available |
| ARQ + Redis | DEDUP-03 rebuild jobs | ✓ (venv + running) | 0.26.0 + 5.2.0 | None — Redis is required for ARQ |
| OpenGloss | TOOL-02 | ✗ (not found anywhere) | — | Stub with NotImplementedError — see Open Questions |
| numpy | Structural similarity Jaccard | ✓ (venv) | 1.26.0+ | Pure Python set operations |

**Missing dependencies with no fallback:**
- OpenGloss (TOOL-02) — no package found anywhere; stub required.

**Missing dependencies with fallback:**
- folio-python not in venv — add to pyproject.toml (Wave 0 task); if missing at runtime, `StructuralSimilarityService` returns score=0.0 with a warning.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework (backend) | pytest 8.3.0 + pytest-asyncio 0.24.0 |
| Config file | pyproject.toml `[tool.pytest.ini_options]` — asyncio_mode="auto" |
| Quick run command | `cd ../ontokit-api && pytest tests/unit/test_duplicate_detection.py -v` |
| Full suite command | `cd ../ontokit-api && pytest tests/ -v --cov=ontokit` |
| Framework (frontend) | Vitest (globals: true, jsdom, `__tests__/**/*.test.{ts,tsx}`) |
| Frontend quick run | `cd . && npm run test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TOOL-01 | `StructuralSimilarityService.get_structural_score(iri_a, iri_b)` returns float 0..1 | unit | `pytest tests/unit/test_structural_similarity.py -v` | ❌ Wave 0 |
| TOOL-02 | `GlossExtractionService` stub raises NotImplementedError | unit | `pytest tests/unit/test_gloss_extraction.py -v` | ❌ Wave 0 |
| TOOL-03 | Reasoner consistency check returns issues for cyclic hierarchy | unit | `pytest tests/unit/test_consistency_service.py -v` | ✅ exists |
| TOOL-04 | Pre-commit validation endpoint returns 422 on consistency failure | unit | `pytest tests/unit/test_duplicate_check_route.py -v` | ❌ Wave 0 |
| TOOL-05 | `import folio` succeeds in ontokit-api venv | unit | `pytest tests/unit/test_dependencies.py -v` | ✅ exists — add folio check |
| DEDUP-01 | `EmbeddingService.embed_project()` covers all entity types | unit | `pytest tests/unit/test_embedding_service.py -v` | ❌ Wave 0 |
| DEDUP-02 | `entity_embeddings` HNSW index exists | integration | `pytest tests/integration/ -k test_hnsw` | ❌ Wave 0 |
| DEDUP-03 | Webhook event "closed+merged" enqueues rebuild job | unit | `pytest tests/unit/test_webhook_rebuild.py -v` | ❌ Wave 0 |
| DEDUP-04 | `DuplicateCheckService.check()` returns all three scores | unit | `pytest tests/unit/test_duplicate_check_service.py -v` | ❌ Wave 0 |
| DEDUP-05 | score >0.95 → verdict="block" | unit | `pytest tests/unit/test_duplicate_check_service.py::test_block_threshold -v` | ❌ Wave 0 |
| DEDUP-06 | score >0.80 → verdict="warn" with candidates | unit | `pytest tests/unit/test_duplicate_check_service.py::test_warn_threshold -v` | ❌ Wave 0 |
| DEDUP-07 | score ≤0.80 → verdict="pass" | unit | `pytest tests/unit/test_duplicate_check_service.py::test_pass_threshold -v` | ❌ Wave 0 |
| DEDUP-08 | All-branch search hits embeddings from suggestion branches | unit | `pytest tests/unit/test_duplicate_check_service.py::test_all_branch_scope -v` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pytest tests/unit/test_duplicate_check_service.py -v -x`
- **Per wave merge:** `pytest tests/unit/ -v --cov=ontokit`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/unit/test_structural_similarity.py` — covers TOOL-01
- [ ] `tests/unit/test_gloss_extraction.py` — covers TOOL-02 stub
- [ ] `tests/unit/test_duplicate_check_service.py` — covers DEDUP-04/05/06/07/08 (block/warn/pass thresholds, all-branch scope)
- [ ] `tests/unit/test_webhook_rebuild.py` — covers DEDUP-03 (mock ARQ pool)
- [ ] `tests/unit/test_duplicate_rejection.py` — covers D-10/D-11 rejection history
- [ ] `tests/unit/test_embedding_service.py` — covers DEDUP-01 (extend existing if exists)
- [ ] Framework install: folio-python — `uv add folio-python` in pyproject.toml

---

## Sources

### Primary (HIGH confidence)
- `ontokit-api/ontokit/services/embedding_service.py` — EmbeddingService source (verified by direct read)
- `ontokit-api/ontokit/models/embedding.py` — EntityEmbedding, ProjectEmbeddingConfig models (verified)
- `ontokit-api/ontokit/worker.py` — ARQ worker pattern (verified)
- `ontokit-api/alembic/versions/n2o3p4q5r6s7_add_embedding_tables.py` — current table DDL (verified)
- `ontokit-api/ontokit/services/duplicate_detection_service.py` — existing dup service (verified)
- `ontokit-api/ontokit/api/routes/pull_requests.py` — GitHub webhook handler (verified)
- folio-python v0.3.3 source — `get_parents()`, `get_children()`, `parse_owl()`, FOLIO init (verified by `python3 -c "import inspect; from folio.graph import FOLIO..."`)
- `ontokit-api/.venv` — package versions confirmed: pgvector 0.4.2, owlready2 0.50
- `ontokit-api/pyproject.toml` — dependency list (verified)

### Secondary (MEDIUM confidence)
- pgvector HNSW documentation (from memory + community knowledge — pgvector 0.5.0 added HNSW, November 2023). MEDIUM confidence because production extension version unknown.
- folio-python cache behavior (`~/.folio/`) — inferred from source inspection; disk path not explicitly documented.

### Tertiary (LOW confidence)
- OpenGloss availability — concluded "does not exist as Python package" from PyPI search + GitHub API org search. LOW confidence: could be a private/internal package not visible in search.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified in venv or globally; versions confirmed
- Architecture: HIGH — patterns derived from existing source code
- folio-python integration: HIGH — API confirmed from source inspection
- OpenGloss status: LOW — package not found anywhere; treat as blocked pending clarification
- HNSW in production: LOW — production PostgreSQL pgvector extension version unknown
- Pitfalls: HIGH — derived from code inspection and known pgvector behavior

**Research date:** 2026-04-06
**Valid until:** 2026-05-06 (pgvector and folio-python are stable; 30-day window is conservative)
