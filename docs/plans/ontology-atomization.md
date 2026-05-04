# Ontology Atomization: Per-Concept JSON Files

## Context

OntoKit currently stores each ontology as a single monolithic Turtle (.ttl) file. At scale (50K+ concepts), this creates severe problems: massive Git diffs, disk I/O bottlenecks, merge conflicts, and slow load/save/download times. This plan transforms the architecture so each entity (class, property, individual) gets its own structured JSON file, with PostgreSQL indexing for fast queries and auto-generated Turtle for interoperability.

**What prompted this:** Ontologies will grow to 50,000+ concepts. The single-file architecture cannot sustain that scale.

**Intended outcome:** Per-entity JSON files as source of truth, PostgreSQL-backed tree/search/detail queries, meaningful Git diffs, and parallel editing without merge conflicts.

## Key Decisions

| Decision | Choice |
|----------|--------|
| Source of truth | JSON files (Turtle is generated artifact) |
| JSON schema | Fully structured OWL constructs + `custom_axioms` safety valve |
| Query layer | PostgreSQL index tables (replaces RDFLib in-memory) |
| Directory structure | `classes/`, `properties/`, `individuals/` with root-class subdirs under `classes/` |
| File naming | `<Label>_<8-char-IRI-hash>.json` |
| Turtle sync | Auto-generated server-side on every commit, stored at repo root |
| Migration | Big-bang: all existing projects upgraded at once |
| Rollout | Backend + frontend changed together |
| Monaco editor | JSON editor for developer mode; Turtle as read-only export view |

## Repo Structure (Target)

```
project-repo.git/
  manifest.json                              # Ontology metadata, prefixes, imports
  ontology.ttl                               # Auto-generated (read-only artifact)
  classes/
    Criminal_Law_A1b2c3d4/                   # Root class = subdirectory
      Fraud_e5f6g7h8.json
      Theft_i9j0k1l2.json
      Breach_of_Contract_RRpu1234.json
    Civil_Law_m3n4o5p6/
      Negligence_q7r8s9t0.json
  properties/
    has_jurisdiction_u1v2w3x4.json
    has_party_y5z6a7b8.json
  individuals/
    USA_c9d0e1f2.json
```

---

## Phase 1: JSON Schema Design (Backend)

**Goal:** Define Pydantic models and TypeScript types for all entity JSON files.

### 1.1 Common types
- `LocalizedString`: `{value, lang}`
- `AnnotationGroup`: `{property_iri, values: LocalizedString[]}`
- `CustomAxiom`: `{turtle, description}`
- `ClassExpression` discriminated union (10 types): `named`, `someValuesFrom`, `allValuesFrom`, `hasValue`, `minCardinality`, `maxCardinality`, `exactCardinality`, `unionOf`, `intersectionOf`, `complementOf`

### 1.2 Entity schemas
- **Class**: `iri, labels[], comments[], deprecated, parent_iris[], equivalent_classes: ClassExpression[], disjoint_iris[], annotations[], custom_axioms[]`
- **Property**: `iri, property_type (object|data|annotation), labels[], comments[], deprecated, domain_iris[], range_iris[], parent_iris[], inverse_of?, characteristics[], equivalent_iris[], disjoint_iris[], property_chains[], annotations[], custom_axioms[]`
- **Individual**: `iri, labels[], comments[], deprecated, type_iris[], same_as[], different_from[], object_property_assertions[], data_property_assertions[], annotations[], custom_axioms[]`
- **Manifest**: `schema_version, ontology_iri, version_iri?, prefixes{}, imports[], annotations[], label_preferences[]`

### Files to create
- **Backend**: `ontokit-api/ontokit/schemas/json_schema/` — `common.py`, `class_expression.py`, `class_entity.py`, `property_entity.py`, `individual_entity.py`, `manifest.py`
- **Frontend**: `ontokit-web/lib/ontology/jsonSchema.ts` — TypeScript equivalents

---

## Phase 2: PostgreSQL Index Tables (Backend)

**Goal:** Add DB tables so tree/search/detail queries hit PostgreSQL instead of parsing Turtle.

### 2.1 New tables
- `ontology_classes` — `id, project_id, branch, iri, label, local_name, deprecated, parent_iris (JSONB), json_path, child_count, instance_count, search_vector (TSVECTOR), data (JSONB)`
- `ontology_properties` — same pattern with `property_type, domain_iris, range_iris`
- `ontology_individuals` — same pattern with `type_iris`

### 2.2 Indexes
- Unique: `(project_id, branch, iri)` on each table
- GIN: `parent_iris` / `type_iris` JSONB for tree child lookups
- GIN: `search_vector` for full-text search
- B-tree: `(project_id, branch)` for scoped queries

### 2.3 Index service
- `IndexService.rebuild_project_index(project_id, branch)` — full scan of JSON files → upsert all rows
- `IndexService.upsert_entity(project_id, branch, entity_type, iri, json_data)` — single-entity update after save
- `IndexService.delete_entity(...)` — remove from index
- `IndexService.recompute_child_counts(...)` — recalculate denormalized counts

### Files to create
- `ontokit-api/ontokit/models/ontology_index.py`
- `ontokit-api/alembic/versions/xxxx_add_ontology_index_tables.py`
- `ontokit-api/ontokit/services/index_service.py`

---

## Phase 3: Storage Layer (Backend)

**Goal:** Replace single-Turtle-in-Git with multi-file JSON operations.

### 3.1 JSON file manager
- `JsonFileManager.read_entity(project_id, branch, path)` → dict
- `JsonFileManager.write_entity(project_id, branch, path, data, commit_msg, author)` → CommitInfo
- `JsonFileManager.delete_entity(...)` → CommitInfo
- `JsonFileManager.list_entities(project_id, branch, directory)` → list[str]
- `JsonFileManager.resolve_json_path(entity_type, iri, parent_iri, label)` → path string

### 3.2 Bare Git repo extensions
- `BareRepository.write_files(branch, file_dict, msg, author)` — multi-file atomic commit
- `BareRepository.delete_file(branch, path, msg, author)`
- `BareRepository.list_directory(ref, directory)` → file list

### 3.3 Turtle generation service
- `TurtleGenerator.generate(manifest, classes, properties, individuals)` → Turtle string
- `class_expression_to_turtle(expr, prefixes)` — recursive converter
- Called after every entity save; result committed as `ontology.ttl`

### Files to create
- `ontokit-api/ontokit/services/json_file_manager.py`
- `ontokit-api/ontokit/services/turtle_generator.py`

### Files to modify
- `ontokit-api/ontokit/git/bare_repository.py` — add multi-file write, delete, list_directory

---

## Phase 4: API Changes (Backend)

**Goal:** New entity CRUD endpoints; update tree/search/detail to use PostgreSQL.

### 4.1 New entity endpoints
```
POST/GET/PUT/DELETE  /api/v1/projects/{id}/entities/classes/{iri}
POST/GET/PUT/DELETE  /api/v1/projects/{id}/entities/properties/{iri}
POST/GET/PUT/DELETE  /api/v1/projects/{id}/entities/individuals/{iri}
```

Each PUT/POST: validate JSON → write to Git → update PG index → trigger Turtle regen → return commit hash.

### 4.2 Update existing endpoints
- **Tree root**: `SELECT ... FROM ontology_classes WHERE parent_iris = '[]' OR parent_iris @> '["owl:Thing"]'`
- **Tree children**: `SELECT ... FROM ontology_classes WHERE parent_iris @> :parent_iri`
- **Search**: `WHERE search_vector @@ plainto_tsquery(:q)` with UNION across all 3 tables
- **Detail**: Direct fetch by `(project_id, branch, iri)` → return `data` JSONB column

### 4.3 Suggestion workflow
- Suggestion saves write individual JSON files to the suggestion branch (not full Turtle)
- Merge copies changed JSON files from suggestion → main
- Diff API returns per-file JSON diffs

### Files to create
- `ontokit-api/ontokit/api/routes/entities.py`

### Files to modify
- `ontokit-api/ontokit/api/routes/projects.py` — update tree/search/detail handlers
- `ontokit-api/ontokit/services/ontology.py` — replace RDFLib queries with PG queries
- `ontokit-api/ontokit/services/suggestion_service.py` — JSON file saves
- `ontokit-api/ontokit/models/project.py` — add `storage_format` column

---

## Phase 5: Frontend Data Model & API Client

**Goal:** Update TypeScript types, API client, and hooks for JSON-based entity operations.

### 5.1 New API client methods
- `entityApi.getClass/saveClass/createClass/deleteClass` (and same for properties, individuals)

### 5.2 Update hooks
- **`useAutoSave`**: `flushToGit()` calls `entityApi.saveClass()` directly (no Turtle manipulation)
- **Draft store**: stores full entity JSON as draft value (not partial edit state)

### 5.3 Remove Turtle manipulation code
- **DELETE**: `turtleClassUpdater.ts`, `turtlePropertyUpdater.ts`, `turtleIndividualUpdater.ts`, `turtleBlockParser.ts`, `entityDetailExtractors.ts`, `turtleSnippetGenerator.ts`
- **SIMPLIFY**: `indexWorker.ts` — no longer needed for editing; keep only if read-only Turtle view needs IRI indexing

### Files to modify
- `ontokit-web/lib/api/client.ts` — add `entityApi`
- `ontokit-web/lib/hooks/useAutoSave.ts` — JSON save path
- `ontokit-web/lib/stores/draftStore.ts` — store entity JSON
- `ontokit-web/app/projects/[id]/editor/page.tsx` — route saves through entity API

---

## Phase 6: Frontend Editor UI

**Goal:** JSON editor for developer mode, updated forms, Turtle export view.

### 6.1 Developer layout tabs
- **Tree** (unchanged)
- **JSON** (new) — Monaco in JSON mode showing selected entity's JSON, editable
- **Turtle** (read-only) — Monaco with Turtle highlighting, fetched from generated file
- **Graph** (unchanged)

### 6.2 Detail panel updates
- `ClassDetailPanel` — save handler calls `entityApi.saveClass()` directly; add class expression editor
- `PropertyDetailPanel` — data from API (remove `extractPropertyDetail` from Turtle source)
- `IndividualDetailPanel` — data from API (remove `extractIndividualDetail` from Turtle source)

### 6.3 New components
- `ClassExpressionEditor.tsx` — recursive form for building class expressions (type picker, property picker, filler picker)
- `EntityJsonEditor.tsx` — Monaco JSON editor with schema validation
- `TurtleViewer.tsx` — read-only Turtle view with export button

### 6.4 Diff views
- Suggestion review shows per-entity JSON diffs (not monolithic Turtle diff)
- Concatenated diff view with entity context headers

### Files to create
- `ontokit-web/components/editor/ClassExpressionEditor.tsx`
- `ontokit-web/components/editor/EntityJsonEditor.tsx`
- `ontokit-web/components/editor/TurtleViewer.tsx`

### Files to modify
- `ontokit-web/components/editor/ClassDetailPanel.tsx`
- `ontokit-web/components/editor/PropertyDetailPanel.tsx`
- `ontokit-web/components/editor/IndividualDetailPanel.tsx`
- `ontokit-web/components/editor/developer/DeveloperEditorLayout.tsx`
- `ontokit-web/components/editor/standard/StandardEditorLayout.tsx`
- `ontokit-web/app/projects/[id]/suggestions/review/page.tsx`

---

## Phase 7: Migration Tool (Backend)

**Goal:** One-time upgrade: parse Turtle → generate JSON files + manifest → populate PG index.

### 7.1 Turtle-to-JSON converter
- Parse with RDFLib (supports Turtle, RDF/XML, OWL/XML, N-Triples)
- Extract manifest (prefixes, imports, ontology annotations)
- For each class/property/individual: extract structured JSON, remaining axioms → `custom_axioms`
- Recursive blank node traversal for class expressions

### 7.2 Migration endpoint
- `POST /api/v1/projects/{id}/migrate-to-atomized`
- Reads Turtle from Git → runs converter → writes all JSON files + manifest in single commit → generates `ontology.ttl` → rebuilds PG index → marks project as migrated

### 7.3 Batch migration script
- `scripts/migrate_all_projects.py` — iterates all projects, calls migration endpoint, logs failures

### Files to create
- `ontokit-api/ontokit/services/migration/turtle_to_json.py`
- `ontokit-api/ontokit/api/routes/migration.py`
- `ontokit-api/scripts/migrate_all_projects.py`

---

## Phase 8: Git Performance & DevOps

**Goal:** Configure Git repos for many-files performance.

### 8.1 Git config (applied to bare repos after migration)
- `index.version = 4` (prefix-compressed index)
- `pack.threads = 0` (auto-detect)
- `pack.windowMemory = 256m`

### 8.2 Directory sharding
- Root classes as subdirectories under `classes/` (already decided)
- If a root class has >3K children, shard by first letter

### 8.3 Monitoring
- Track entity count per project, index rebuild duration, Turtle generation duration
- Alert if `custom_axioms` usage exceeds 10% of entities

---

## Phase Dependencies

```
Phase 1 (Schema)
  ├──→ Phase 2 (DB)  ─────────→ Phase 4 (API) ──→ Phase 5 (FE Data) ──→ Phase 6 (FE UI)
  ├──→ Phase 3 (Storage) ──┤                                                    │
  └──→ Phase 7 (Migration) ┘                                             Phase 8 (Perf)
```

Phases 2 + 3 can run in parallel. Phase 7 needs 1+2+3. Phase 4 needs 2+3. Phases 5→6 are sequential. Phase 8 is independent after Phase 3.

---

## Verification Plan

### Backend
1. **Unit test**: Turtle-to-JSON migration round-trips — parse a reference Turtle file, convert to JSON, regenerate Turtle, parse again, compare RDF graphs for isomorphism
2. **Unit test**: All 10 class expression types serialize/deserialize correctly
3. **Integration test**: Entity CRUD endpoints — create/read/update/delete via API, verify JSON file in Git and PG index row
4. **Integration test**: Tree endpoint returns correct roots and children from PG
5. **Integration test**: Search endpoint returns full-text matches across all entity types
6. **Load test**: 50K entities — measure tree query, search, and Turtle generation times

### Frontend
1. **Manual test**: Open a migrated project, verify tree loads, class detail displays correctly
2. **Manual test**: Edit a class via form → verify JSON file saved correctly, Turtle regenerated
3. **Manual test**: Developer mode → JSON tab shows entity JSON, editable
4. **Manual test**: Developer mode → Turtle tab shows generated Turtle, read-only
5. **Manual test**: Suggestion workflow → submit → review → see JSON diffs
6. **Visual test**: Screenshot comparison before/after migration for form-based editing
