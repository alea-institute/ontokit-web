# Proposal: PostgreSQL + GitHub Architecture for OntoKit

**Date:** 2026-04-01
**Authors:** Damien Riehl, with analysis from Claude
**Status:** Draft for discussion with Fr. John D'Orazio
**Purpose:** Basis for a PRD to refactor OntoKit's storage and version control layers

---

## 1. Executive Summary

We propose evolving OntoKit's architecture into a two-layer system:

- **PostgreSQL** as the live working layer -- all entity-level CRUD, search, browsing, and analytics happen against granular database rows
- **GitHub** as the version control layer -- formal commits, branches, pull requests, and review happen through GitHub's API and UI

**Crucially, we are not starting from scratch.** PR #10 on `ontokit-api` (`feat: PostgreSQL index tables for ontology query optimization`) already built the foundation: five PostgreSQL index tables, an `OntologyIndexService` with SQL-based tree/search/detail queries, an `IndexedOntologyService` facade that transparently routes reads through the index with RDFLib fallback, and background reindexing via ARQ workers. The proposed architecture evolves PR #10's **read-only index** into a **read-write primary store**.

---

## 2. What PR #10 Already Built

PR #10 (open on `CatholicOS/ontokit-api`, branch `feature/postgresql-ontology-index`) implemented:

### 2.1 Five PostgreSQL Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `ontology_index_status` | Tracks indexing state per (project, branch) | `project_id`, `branch`, `commit_hash`, `status` (pending/indexing/ready/failed), `entity_count` |
| `indexed_entities` | One row per OWL entity | `project_id`, `branch`, `iri`, `local_name`, `entity_type`, `deprecated` |
| `indexed_labels` | Multilingual labels | `entity_id` FK, `property_iri`, `value`, `lang` |
| `indexed_hierarchy` | Parent-child class edges | `project_id`, `branch`, `child_iri`, `parent_iri` |
| `indexed_annotations` | Non-label annotations | `entity_id` FK, `property_iri`, `value`, `lang`, `is_uri` |

**Indexes include:** GIN trigram indexes on `local_name`, `iri`, and label `value` for fast fuzzy/substring search. Composite B-tree indexes on `(project_id, branch, entity_type)` for type filtering. Hierarchy indexes on both `parent_iri` and `child_iri` for bidirectional traversal.

### 2.2 OntologyIndexService (1,134 lines)

- **`full_reindex(project_id, branch, graph, commit_hash)`** -- atomically deletes existing index data and rebuilds from an RDFLib graph, batching inserts (1,000 rows/batch) for performance
- **`get_root_classes()`** -- finds classes not appearing as children in hierarchy
- **`get_class_children()`** -- JOINs entities with hierarchy table
- **`get_class_detail()`** -- fetches entity + labels + comments + parents + annotations
- **`get_ancestor_path()`** -- recursive CTE walking up the hierarchy (depth-limited to 100)
- **`search_entities()`** -- ILIKE search across local_name, IRI, and labels
- **`get_class_count()`** -- simple COUNT query
- **Concurrency guard** -- PostgreSQL `ON CONFLICT DO UPDATE` prevents concurrent reindexing, with 10-minute stale lock reclamation

### 2.3 IndexedOntologyService (Facade)

Transparently routes queries through the SQL index when ready, falling back to RDFLib when:
- The index hasn't been built yet
- The index query throws an error
- The migration hasn't been run

Also auto-enqueues reindexing when the stored `commit_hash` doesn't match git HEAD.

### 2.4 Reindex Triggers

Four triggers already wired up: after file import, after GitHub clone, after source save (commit), and a manual admin endpoint (`POST /projects/{id}/ontology/reindex`). Branch deletion cleans up index rows.

### 2.5 What PR #10 Noted as Limitations

- `instance_count` always returns 0 (rdf:type relationships not indexed)
- `equivalent_iris` and `disjoint_iris` always return empty lists (not indexed)
- Search prefix-match sorting happens client-side after SQL LIMIT

---

## 3. The Problem: Why Read-Only Index Isn't Enough

PR #10 is a **read cache**. The actual data still lives in RDF files managed by pygit2 bare repos. Every edit still follows the expensive path:

```
Load entire RDF file from Git bare repo
  -> Parse into in-memory RDFLib graph
    -> Modify the graph
      -> Serialize entire graph back to Turtle
        -> Commit to Git bare repo
          -> Trigger background reindex to update PostgreSQL
```

### 3.1 What This Means in Practice

| Problem | Impact |
|---------|--------|
| **Writes are still whole-file** | Changing one label still requires reading, parsing, and rewriting the entire ontology file |
| **Index lag** | After an edit, the index is stale until the background ARQ job completes the full reindex |
| **Dual source of truth** | Git is canonical, PostgreSQL is a projection -- any bug in reindexing creates silent data divergence |
| **Full reindex on every edit** | `full_reindex()` deletes all rows and rebuilds from scratch, even if only one entity changed |
| **Memory pressure unchanged** | RDFLib still loads the entire graph for every write operation |
| **Merge conflicts unchanged** | pygit2 bare repos still manage branching on monolithic Turtle files |

### 3.2 Custom Code Still Maintained

Even with PR #10, the backend still maintains:
- pygit2 bare repository management (`git/bare_repository.py`)
- Custom PR workflow (create, review, comment, approve, merge)
- Custom branch management
- MinIO object storage
- Two-way GitHub sync bridge
- Full RDFLib graph loading for every write

---

## 4. Proposed Architecture: Evolve the Index into the Primary Store

### 4.1 The Two-Layer Model

```
                    +-----------------------+
                    |     OntoKit Web UI    |
                    |   (Next.js frontend)  |
                    +-----------+-----------+
                                |
                    +-----------v-----------+
                    |    OntoKit API        |
                    |   (FastAPI backend)   |
                    +-----------+-----------+
                         |             |
              Live CRUD  |             |  Version Control
                         v             v
                  +------------+  +----------+
                  | PostgreSQL |  |  GitHub   |
                  |  (entities,|  |  (commits,|
                  |   triples, |  |  branches,|
                  |   search)  |  |  PRs,     |
                  +------------+  |  reviews) |
                                  +----------+
```

### 4.2 What Changes from PR #10

| Aspect | PR #10 (Read-Only Index) | Proposed (Read-Write Primary Store) |
|--------|--------------------------|-------------------------------------|
| **Writes** | Go to Git, then reindex async | Go directly to PostgreSQL |
| **Reads** | PostgreSQL with RDFLib fallback | PostgreSQL only (no fallback needed) |
| **Source of truth** | Git bare repo + MinIO | PostgreSQL (working state), GitHub (versioned snapshots) |
| **Reindexing** | Full rebuild from RDFLib graph on every edit | Not needed -- DB is always current |
| **Serialization** | Not relevant (Git stores files) | On-demand: DB -> Turtle when committing to GitHub |
| **Branching** | pygit2 bare repos | GitHub (system/admin level) |
| **PRs** | Custom internal workflow | GitHub PRs |

### 4.3 The Evolution Path: From PR #10 to Primary Store

PR #10's tables are already close to what we need. Here's what evolves:

**`indexed_entities` -> `ontology_entities`**

Add columns for write support:

```sql
-- Existing (from PR #10):
id, project_id, branch, iri, local_name, entity_type, deprecated

-- Add:
created_at    TIMESTAMPTZ DEFAULT now()
updated_at    TIMESTAMPTZ DEFAULT now()  -- triggers on every update
created_by    UUID REFERENCES users(id)  -- who created this entity
updated_by    UUID REFERENCES users(id)  -- who last modified it
```

**`indexed_labels` -> `entity_labels`** -- add `created_at`, `updated_at`

**`indexed_hierarchy` -> `class_hierarchy`** -- add `created_at`, `updated_at`

**`indexed_annotations` -> `entity_annotations`** -- add `created_at`, `updated_at`

**New tables needed:**

```sql
-- Safety valve for complex OWL constructs
complex_axioms (
    id              UUID PRIMARY KEY,
    project_id      UUID REFERENCES projects(id) ON DELETE CASCADE,
    branch          VARCHAR(255),
    axiom_type      VARCHAR(100),    -- e.g., "EquivalentClasses", "DisjointUnion", "HasKey"
    involved_iris   TEXT[],          -- IRIs of entities involved (for cross-referencing)
    turtle_fragment TEXT,            -- original RDF serialization (lossless round-trip)
    metadata        JSONB,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
)

-- Namespace/prefix management
ontology_prefixes (
    id              UUID PRIMARY KEY,
    project_id      UUID REFERENCES projects(id) ON DELETE CASCADE,
    prefix          VARCHAR(50),
    namespace_iri   TEXT,
    UNIQUE(project_id, prefix)
)

-- Ontology-level metadata (owl:Ontology IRI, imports, version)
ontology_metadata (
    id              UUID PRIMARY KEY,
    project_id      UUID REFERENCES projects(id) ON DELETE CASCADE,
    ontology_iri    TEXT,
    version_iri     TEXT,
    imports         TEXT[],          -- owl:imports IRIs
    annotations     JSONB,          -- ontology-level annotations
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
)

-- Property domain/range declarations
property_domains (
    id              UUID PRIMARY KEY,
    property_id     UUID REFERENCES ontology_entities(id) ON DELETE CASCADE,
    class_iri       TEXT
)

property_ranges (
    id              UUID PRIMARY KEY,
    property_id     UUID REFERENCES ontology_entities(id) ON DELETE CASCADE,
    target_iri      TEXT             -- class IRI or datatype IRI
)

-- Individual type assertions and property values
individual_types (
    id              UUID PRIMARY KEY,
    individual_id   UUID REFERENCES ontology_entities(id) ON DELETE CASCADE,
    class_iri       TEXT
)

individual_property_values (
    id              UUID PRIMARY KEY,
    individual_id   UUID REFERENCES ontology_entities(id) ON DELETE CASCADE,
    property_iri    TEXT,
    value           TEXT,
    datatype        TEXT,
    language        VARCHAR(20),
    target_iri      TEXT             -- for object property assertions (points to another individual)
)
```

**`ontology_index_status` evolves to track GitHub sync state:**

```sql
-- Rename to project_sync_status
project_sync_status (
    id              UUID PRIMARY KEY,
    project_id      UUID REFERENCES projects(id) ON DELETE CASCADE,
    branch          VARCHAR(255),
    github_repo     TEXT,            -- e.g., "alea-institute/canon-law-ontology"
    last_commit_sha VARCHAR(40),     -- last commit pushed to / pulled from GitHub
    last_synced_at  TIMESTAMPTZ,
    sync_status     VARCHAR(20),     -- ready, syncing, conflict, error
    entity_count    INTEGER DEFAULT 0,
    error_message   TEXT,
    UNIQUE(project_id, branch)
)
```

### 4.4 OntologyIndexService Evolves to OntologyEntityService

PR #10's `OntologyIndexService` (1,134 lines) already has all the **read** methods. We add **write** methods:

```python
class OntologyEntityService:
    """Evolved from OntologyIndexService -- now handles reads AND writes."""

    # === READS (already built in PR #10) ===
    async def get_root_classes(...)         # already works
    async def get_class_children(...)       # already works
    async def get_class_detail(...)         # already works
    async def get_ancestor_path(...)        # already works
    async def search_entities(...)          # already works
    async def get_class_count(...)          # already works

    # === WRITES (new) ===
    async def create_entity(self, project_id, branch, iri, entity_type, labels, ...)
    async def update_entity(self, project_id, branch, iri, changes: dict)
    async def delete_entity(self, project_id, branch, iri)
    async def add_label(self, entity_id, property_iri, value, lang)
    async def update_label(self, label_id, value, lang)
    async def remove_label(self, label_id)
    async def set_parent(self, project_id, branch, child_iri, parent_iri)
    async def remove_parent(self, project_id, branch, child_iri, parent_iri)
    async def reparent_class(self, project_id, branch, class_iri, old_parent, new_parent)
    async def add_annotation(self, entity_id, property_iri, value, lang)
    async def update_annotation(self, annotation_id, value, lang)
    async def remove_annotation(self, annotation_id)

    # === SERIALIZATION (new) ===
    async def export_to_turtle(self, project_id, branch) -> str
        """Serialize all entities + hierarchy + annotations + complex_axioms to Turtle."""
    async def import_from_turtle(self, project_id, branch, turtle_content: str, user_id)
        """Parse Turtle and populate entity tables. Replaces full_reindex()."""
```

### 4.5 The IndexedOntologyService Facade Becomes Unnecessary

With PostgreSQL as the primary store, there's no RDFLib fallback needed. The facade pattern from PR #10 (`IndexedOntologyService`) can be eliminated -- the API routes call `OntologyEntityService` directly.

### 4.6 GitHub Sync Workflow

```
User edits in OntoKit UI
  -> DB updates immediately (fast, granular, per-entity SQL)
  -> No reindexing needed -- DB is always current

User clicks "Commit" (or auto-commit on save, TBD)
  -> OntologyEntityService.export_to_turtle() serializes DB -> deterministic Turtle
  -> GitHub API: create commit on branch with the Turtle file
  -> project_sync_status updated with new commit SHA

Admin creates PR on GitHub (or via OntoKit UI wrapper)
  -> Review happens on GitHub
  -> Merge happens on GitHub
  -> GitHub webhook -> OntoKit
    -> import_from_turtle() updates DB from merged Turtle
    -> project_sync_status updated

Import existing ontology
  -> User uploads .ttl/.owl/.rdf (or provides GitHub repo URL)
  -> import_from_turtle() parses and populates entity tables
  -> Initial commit pushed to GitHub
```

---

## 5. Handling Hard Problems

### 5.1 RDF Round-Tripping

**Challenge:** `Import RDF -> DB rows -> Export RDF` must be lossless. OWL has constructs that don't decompose into simple relational rows (blank nodes, complex class expressions, annotation assertions on axioms, SWRL rules).

**Solution -- Hybrid decomposition:**
- **~90% of constructs** (named classes, properties, hierarchy, labels, comments, annotations, individuals, simple restrictions) decompose cleanly into the relational tables. These get the fast CRUD path.
- **~10% of complex constructs** (class expressions with nested boolean operators, property chains, GCI axioms, SWRL rules, annotation axioms on axioms) are stored in `complex_axioms` as serialized Turtle fragments with references to involved entity IRIs. They round-trip perfectly because we store the original RDF.
- **This is the same approach** used by production ontology tools like TopBraid and PoolParty.

### 5.2 Deterministic Serialization

**Challenge:** DB -> Turtle output must be deterministic (same data = same bytes) for clean GitHub diffs.

**Solution:** OntoKit already has `serialize_deterministic()` using RDFLib's `to_isomorphic()`. The export service builds an RDFLib graph from DB rows, then serializes deterministically. Entities are sorted by IRI and grouped by type.

### 5.3 Branching Model

**Recommended for v1 -- DB already supports branching per PR #10:**

PR #10's tables already have a `branch` column on every table. This means multiple branch states can coexist in the DB. The proposed workflow:

- **`main` branch** is the primary working state, always in the DB
- **Feature branches** can also live in the DB (create via copying entity rows with a new branch value), or live only on GitHub
- **System/admin users** create GitHub branches and PRs for formal review
- **Regular users** edit the `main` branch working state via the OntoKit UI

This hybrid approach means:
- Small teams: edit `main` directly, commit to GitHub periodically
- Larger teams / formal review: create feature branches, PR on GitHub, merge triggers DB update

### 5.4 SPARQL Support

Options (in order of pragmatism):
1. **Materialize on demand** -- assemble DB state into RDFLib graph for SPARQL queries (acceptable for small/medium ontologies, caching helps)
2. **PostgreSQL recursive CTEs** -- cover most real-world query patterns without SPARQL
3. **SPARQL-to-SQL translation** (long-term, defer unless strong demand)

### 5.5 Linting

PostgreSQL makes most lint rules **simpler**, not harder:

| Lint Rule | PostgreSQL Query |
|-----------|-----------------|
| `undefined-parent` | `LEFT JOIN class_hierarchy h ON h.parent_iri = e.iri WHERE e.id IS NULL` |
| `circular-hierarchy` | Recursive CTE with cycle detection |
| `duplicate-label` | `GROUP BY value HAVING COUNT(*) > 1` |
| `missing-label` | `LEFT JOIN entity_labels WHERE labels.id IS NULL` |
| `orphan-class` | Classes with no parent and no children |
| `missing-comment` | `LEFT JOIN entity_annotations WHERE property_iri = 'rdfs:comment' AND a.id IS NULL` |

No RDFLib graph assembly needed.

---

## 6. What Changes in Each Codebase

### 6.1 ontokit-api (Backend)

**Evolve from PR #10:**
- Rename `indexed_*` tables to `ontology_*` / `entity_*` / `class_*` (clearer naming, no longer a "cache")
- Add write methods to the service layer (create, update, delete entities/labels/hierarchy/annotations)
- Add `complex_axioms`, `ontology_prefixes`, `ontology_metadata`, `property_domains`, `property_ranges`, `individual_types`, `individual_property_values` tables
- Add `export_to_turtle()` and `import_from_turtle()` methods
- Add `project_sync_status` table (evolves from `ontology_index_status`)
- Add GitHub API service (commit, branch, PR operations)
- Add GitHub webhook handler
- Add timestamp + user tracking columns for audit trail

**Remove / Simplify:**
- `git/bare_repository.py` -- no more internal Git repos
- `git/repository.py` -- already deprecated
- MinIO storage integration -- no more S3 for ontology files
- `services/ontology.py` -- RDFLib-based entity operations replaced by SQL
- `services/indexed_ontology.py` -- facade pattern no longer needed (no fallback)
- `api/routes/pull_requests.py` -- simplify to thin wrapper around GitHub API
- `services/pull_request_service.py` -- remove internal PR logic
- `services/github_sync.py` -- no more two-way sync bridge
- `full_reindex()` -- no longer needed; `import_from_turtle()` replaces it

**Keep (mostly unchanged):**
- Auth (Zitadel OIDC)
- Project/member management
- Embedding/semantic search (already PostgreSQL-based via pgvector)
- Linting (reimplemented as SQL queries, same rules)
- WebSocket collaboration (retargeted to DB writes)
- Notifications, analytics, change events

### 6.2 ontokit-web (Frontend)

**Add:**
- "Commit to GitHub" action in the UI
- GitHub PR integration views (link to GitHub, or embed via API)
- Import flow improvements (upload RDF -> parse -> show entity count -> confirm)

**Remove / Simplify:**
- Internal branch management UI (branches live on GitHub)
- Internal PR workflow UI (PRs live on GitHub)
- Internal diff viewer (use GitHub's diff, or lightweight diff from entity change events)

**Keep (mostly unchanged):**
- Ontology editor (Standard mode + Developer mode)
- Class/property/individual panels and forms
- Entity tree with drag-and-drop
- Monaco editor
- Search, analytics, health check, suggestions workflow
- Graph visualization

---

## 7. Migration Path

### Phase 0: Merge & Rename PR #10 (Foundation)
- Merge PR #10 to get the index tables and query infrastructure
- Rename tables: `indexed_entities` -> `ontology_entities`, etc.
- Add write-support columns (`created_at`, `updated_at`, `created_by`, `updated_by`)
- Add new tables (`complex_axioms`, `ontology_prefixes`, `ontology_metadata`, property/individual tables)
- Alembic migrations for all schema changes

### Phase 1: Write Path (Make PostgreSQL Primary for Writes)
- Implement `create_entity()`, `update_entity()`, `delete_entity()` and related write methods
- Implement `import_from_turtle()` to populate DB from RDF files
- Implement `export_to_turtle()` to serialize DB state to Turtle
- **Validate round-trip fidelity**: import -> export -> diff against original for test ontologies
- Wire API endpoints to use write methods (entity CRUD hits DB directly)
- Keep Git-based storage running in parallel during transition (dual-write)

### Phase 2: GitHub Integration
- Implement GitHub API service (create commits, branches, PRs via GitHub API)
- Build "Commit to GitHub" workflow in the UI
- Build GitHub webhook handler (on merge -> `import_from_turtle()`)
- Add `project_sync_status` tracking

### Phase 3: Cut Over
- Switch all reads and writes to PostgreSQL
- Switch version control from internal pygit2 to GitHub
- Remove `IndexedOntologyService` facade (no fallback needed)
- Migrate existing project data: parse current Git repos -> populate DB -> push to GitHub repos
- Remove pygit2, MinIO dependencies

### Phase 4: Cleanup & Polish
- Remove dead code (bare repo management, internal PR workflow, MinIO client, two-way sync)
- Optimize queries (materialized views for common aggregations, covering indexes)
- Enhance GitHub integration (semantic diff as PR comments, status checks)
- Fill gaps from PR #10 limitations: instance counts, equivalent/disjoint class tracking

---

## 8. Comparison with Prior Proposals

This proposal supersedes the "Ontology Atomization" plan (per-entity JSON files) and addresses every concern from the critical analysis:

| Concern from Critical Analysis | How This Proposal Addresses It |
|-------------------------------|-------------------------------|
| **Abandoning Turtle as source of truth** | Turtle remains the versioned format on GitHub. DB is the working copy; Turtle is the canonical archive format. |
| **Git performance with 50K+ files** | Not applicable -- GitHub stores one Turtle file per ontology (or modular Turtle files), not 50K entity files. |
| **Lossy JSON schema for OWL** | No proprietary JSON schema. Complex OWL constructs stored as Turtle fragments in `complex_axioms` table. |
| **Turtle regeneration bottleneck** | Serialization only happens on explicit "Commit to GitHub" (user-initiated), not on every edit. |
| **Linter requires full rewrite** | SQL-based linting is simpler than RDFLib approach for most rules. Same rule set, better performance. |
| **Big-bang migration risk** | Phased migration with dual-write period. PR #10's fallback pattern provides safety net during transition. |
| **Tool ecosystem compatibility** | Full compatibility -- Turtle files on GitHub work with Protege, ROBOT, OWL API, any RDF tool. |
| **Custom_axioms escape hatch growing** | `complex_axioms` table stores original Turtle fragments -- lossless by construction, not a "schema gap." |

---

## 9. Why Build on PR #10 (Not Start from Scratch)

| What PR #10 Provides | Lines of Code | Effort Saved |
|----------------------|---------------|-------------|
| Five PostgreSQL tables with indexes | ~150 (migration) + ~190 (models) | Schema design, index tuning, trigram setup |
| Full reindex from RDFLib graph | ~400 (service) | Entity extraction, label resolution, hierarchy walking, batch insert logic |
| Root classes, children, detail, ancestors, search queries | ~500 (service) | Recursive CTEs, label preference resolution, bulk label loading |
| Transparent fallback facade | ~300 (facade) | Strategy pattern, schema conversion, staleness detection |
| Background worker integration | ~120 (worker) | ARQ job, Redis pubsub, concurrency guard |
| API route integration | ~120 (routes) | Dependency injection, reindex triggers, branch cleanup |
| **Total** | **~1,780 lines** | **Weeks of development** |

PR #10 is the read side of the architecture we need. We add the write side and GitHub integration on top.

---

## 10. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **RDF round-trip data loss** | Medium | High | Extensive test suite comparing import->export->diff. `complex_axioms` Turtle fragments ensure no OWL construct is lost. |
| **GitHub API rate limits** | Low | Medium | Authenticated API allows 5,000 req/hour. Batch operations. Commits are infrequent (user-initiated). |
| **GitHub dependency** | Low | Medium | Serialization layer is Git-host-agnostic. Can swap GitHub for GitLab/Gitea later. |
| **Complex OWL constructs not form-editable** | High | Low | Same as today -- complex axioms use Turtle source editor. `complex_axioms` table makes this explicit. |
| **Branch state confusion** | Medium | Medium | Clear UX: "You are editing the working copy. Commit to GitHub to save a version." Branch switcher loads from GitHub. |
| **Migration breaks existing projects** | Low | Medium | Dual-write period validates DB matches Git. Rollback to Git-only path always available during transition. |

---

## 11. Open Questions for Discussion

1. **GitHub org/repo structure** -- one GitHub repo per OntoKit project? Or a monorepo with directories per project?
2. **Modular Turtle** -- should large ontologies be split into multiple Turtle files on GitHub (using `owl:imports`), or kept as a single file? The critical analysis recommends modular Turtle for diff readability at scale.
3. **Branch UX** -- should OntoKit show a "branch switcher" that loads GitHub branch content into the DB? Or should branching be GitHub-only (users go to GitHub for branch/PR work)?
4. **Commit granularity** -- auto-commit on every save (frequent, small commits), or user-initiated commits only (batched changes)?
5. **GitHub App vs. PAT** -- should OntoKit authenticate to GitHub as a GitHub App (per-installation, fine-grained permissions) or via user PATs (simpler, per-user)?
6. **Self-hosted option** -- do we need to support Gitea/GitLab from day one, or is GitHub-only acceptable for the initial release?
7. **Suggestion workflow** -- the current suggestion system (non-editors propose changes that create PRs) could map directly to GitHub PRs. Should we keep the custom suggestion flow or replace it with GitHub fork-and-PR?
8. **PR #10 merge timing** -- merge PR #10 now (to get the foundation in `main`) and evolve from there? Or develop the full write path on the PR #10 branch before merging?
