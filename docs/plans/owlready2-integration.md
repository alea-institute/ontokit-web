# owlready2 Integration Plan

## Context

owlready2 is listed as a dependency in ontokit-api but has zero imports — the codebase uses rdflib exclusively. owlready2 adds capabilities rdflib lacks: DL reasoning (HermiT/Pellet), SWRL rules, class restriction APIs, closed-world reasoning, and a fast SPARQL-to-SQLite engine. This plan introduces owlready2 as a **complementary processing layer** alongside rdflib, not a replacement.

owlready2's quadstore is SQLite-only (PostgreSQL support was removed by the developer as it was slower). We use ephemeral SQLite files in `/tmp` for processing, with automatic cleanup.

---

## Phase 1: Bridge Layer & Core Infrastructure

**Goal:** rdflib-to-owlready2 conversion layer that all subsequent phases depend on.

**Data flow:**
```
rdflib Graph -> serialize to NTriples -> load into owlready2 World (ephemeral SQLite)
-> run operations -> extract results -> clean up SQLite
```

NTriples is the bridge format (only lossless format both libraries support natively).

### Files to create

| File | Purpose |
|------|---------|
| `ontokit/services/owlready2_bridge.py` | `EphemeralWorld` context manager, `rdflib_to_world()`, `world_to_rdflib()` |
| `tests/unit/test_owlready2_bridge.py` | Round-trip tests with various OWL constructs |

### `EphemeralWorld` context manager
- Creates temp dir under `/tmp/ontokit-owlready2/` with uuid4 filenames
- Serializes rdflib graph to NTriples file
- Creates owlready2 World with SQLite backend pointing to temp dir
- Loads ontology from NTriples file
- Cleans up temp dir on exit (via `tempfile.TemporaryDirectory`)

### Config additions (`ontokit/core/config.py`)
- `owlready2_tmp_dir: str = "/tmp/ontokit-owlready2"`
- `reasoning_timeout: int = 120`

---

## Phase 2: OWL Reasoning as Background Task

**Goal:** DL reasoning (HermiT/Pellet) via ARQ background task — the highest-value feature. Current consistency checks are purely structural; reasoning detects logical inconsistencies, infers implicit subsumption, and reclassifies individuals.

### Prerequisite: Java in Docker
owlready2's HermiT/Pellet are Java-based. **Both Dockerfiles need `default-jre-headless`** added to apt-get install.

### Files to create

| File | Purpose |
|------|---------|
| `ontokit/services/reasoning_service.py` | `ReasoningService` with `run_reasoning(graph) -> ReasoningResult` |
| `ontokit/schemas/reasoning.py` | `ReasoningRunResponse`, `ReasoningResult`, `ReasoningFinding`, `ReasoningTriggerResponse` |
| `ontokit/models/reasoning.py` | `ReasoningRun` + `ReasoningFinding` tables (mirrors LintRun/LintIssue pattern) |
| `ontokit/api/routes/reasoning.py` | Trigger, list runs, get run detail, status, WebSocket |
| `alembic/versions/xxx_add_reasoning_tables.py` | Migration for new tables |
| `tests/unit/test_reasoning_service.py` | Consistent + inconsistent ontology tests |

### ReasoningService.run_reasoning(graph)
1. Create `EphemeralWorld` from graph
2. Run `sync_reasoner_hermit(world)` (or Pellet)
3. Handle `OwlReadyInconsistentOntologyError`
4. Extract: inferred subsumptions, reclassified individuals, inconsistent classes
5. Return structured `ReasoningResult`

### Worker task (`ontokit/worker.py`)
- Add `run_reasoning_task(ctx, project_id, branch, reasoner="hermit")`
- Pattern: load graph -> create ReasoningRun record -> call service -> save findings -> publish to `reasoning:updates` Redis channel
- Register in `WorkerSettings.functions`

### API routes (`ontokit/api/routes/reasoning.py`)
- `POST /{project_id}/reasoning/run` -> 202 with job_id
- `GET /{project_id}/reasoning/runs` -> paginated history
- `GET /{project_id}/reasoning/runs/{run_id}` -> detail with findings
- `GET /{project_id}/reasoning/status` -> latest run summary

### Route registration (`ontokit/api/routes/__init__.py`)
- `router.include_router(reasoning.router, prefix="/projects", tags=["Reasoning"])`

---

## Phase 3: Enhanced Consistency Checking with Reasoner

**Goal:** Augment existing structural consistency checks with semantic checks powered by owlready2 reasoning.

### Files to modify

| File | Change |
|------|--------|
| `ontokit/services/consistency_service.py` | Add 3 new reasoner-backed checks, gated behind `include_reasoning` flag |
| `ontokit/schemas/quality.py` | New rule IDs, `include_reasoning` option |
| `ontokit/api/routes/quality.py` | Add `include_reasoning` query param; when True, use async ARQ task instead of sync |

### New consistency rules (require reasoner)
- `unsatisfiable_class` — classes equivalent to owl:Nothing after reasoning
- `unintended_equivalence` — classes that become equivalent after reasoning but aren't declared so
- `logical_inconsistency` — overall ontology consistency check

### Behavior change
- `include_reasoning=False` (default): current sync behavior, structural checks only
- `include_reasoning=True`: async ARQ task (like lint), returns job_id for polling

---

## Phase 4: SWRL Rules Management

**Goal:** CRUD API for SWRL if-then rules, stored as a JSON sidecar file in git alongside the ontology.

### Files to create

| File | Purpose |
|------|---------|
| `ontokit/schemas/swrl.py` | `SWRLRuleCreate`, `SWRLRuleResponse`, `SWRLRuleListResponse` |
| `ontokit/services/swrl_service.py` | Rule CRUD (read/write `swrl-rules.json` sidecar in git), `apply_rules(graph, rules)` |
| `ontokit/api/routes/swrl.py` | CRUD + execute endpoints |

### Storage approach
- Rules stored as `swrl-rules.json` in git (alongside ontology file)
- Each rule: id (uuid), name, description, body (SWRL syntax string), enabled (bool)
- Sidecar approach keeps ontology file clean and allows enable/disable without modifying it

### API routes
- `GET /{project_id}/swrl/rules` — list rules
- `POST /{project_id}/swrl/rules` — create rule
- `PUT /{project_id}/swrl/rules/{rule_id}` — update rule
- `DELETE /{project_id}/swrl/rules/{rule_id}` — delete rule
- `POST /{project_id}/swrl/execute` — execute enabled rules (triggers reasoning task with SWRL)

### Execution
- Extend `run_reasoning_task` in worker.py to accept optional `swrl_rules` parameter
- Rules injected into owlready2 World via `Imp()` API before reasoning

---

## Phase 5: Class Restrictions & Closed World Reasoning

**Goal:** Surface OWL restriction info in class endpoints; add closed-world reasoning for validation.

### Part A: Restriction extraction (rdflib-based, no owlready2 needed)

| File | Change |
|------|--------|
| `ontokit/schemas/owl_class.py` | Add `restrictions: list[OWLRestriction] | None` to `OWLClassResponse` |
| `ontokit/services/ontology.py` | In `_class_to_response`, parse BNode parents (currently skipped) to extract restriction details |

BNode parents of a class represent OWL restrictions:
```turtle
:MyClass rdfs:subClassOf [
    rdf:type owl:Restriction ;
    owl:onProperty :someProp ;
    owl:someValuesFrom :SomeClass
] .
```

### Part B: Closed-world reasoning

| File | Change |
|------|--------|
| `ontokit/services/reasoning_service.py` | Add `run_closed_world_check(graph, target_classes=None)` |
| `ontokit/schemas/reasoning.py` | Add `ClosedWorldViolation`, `ClosedWorldCheckResult` |
| `ontokit/api/routes/reasoning.py` | Add `POST /{project_id}/reasoning/closed-world` |

---

## Phase 6: World Comparison (Before/After Reasoning Diff)

**Goal:** Show users exactly what the reasoner inferred by diffing pre- and post-reasoning states.

### Files to modify/extend

| File | Change |
|------|--------|
| `ontokit/services/reasoning_service.py` | Add `compare_worlds(graph) -> WorldDiff` |
| `ontokit/schemas/reasoning.py` | Add `WorldDiffResponse`, `InferredTriple` |
| `ontokit/api/routes/reasoning.py` | Add `POST /{project_id}/reasoning/diff` |

### Implementation
1. Create two EphemeralWorlds from same graph
2. Run reasoner on one ("after"), keep other untouched ("before")
3. Convert both back to rdflib Graphs
4. Compute triple diff (triples in "after" but not "before" = inferred)
5. Categorize: new subsumptions, new type assertions, new property values

---

## Dependency Graph

```
Phase 1 (Bridge Layer)
   |
   v
Phase 2 (Reasoning Task)
   |
   +---> Phase 3 (Enhanced Consistency)
   +---> Phase 4 (SWRL Rules)
   +---> Phase 5 (Restrictions + Closed World)
   +---> Phase 6 (World Comparison)
```

Phases 3-6 are independent of each other and can be done in any order after Phase 2.

---

## Technical Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| NTriples round-trip fidelity (complex BNode structures) | Extensive unit tests in Phase 1; fall back to RDF/XML bridge format if needed |
| Orphaned SQLite files on worker crash | `tempfile.TemporaryDirectory` auto-cleans; add periodic cleanup cron for stale files >1hr |
| Reasoner memory/CPU for large ontologies | ARQ `job_timeout` (300s) as hard cutoff; warn users above a triple-count threshold |
| **Java not in Docker images** | Add `default-jre-headless` to both Dockerfiles (prerequisite for Phase 2) |
| Concurrent reasoning tasks | Each task gets its own temp dir with uuid4 — fully isolated |

## Verification

After each phase:
1. Run `pytest tests/ -v --cov=ontokit` — all existing + new tests pass
2. Run `ruff check ontokit/ && ruff format --check ontokit/ && mypy ontokit/` — code quality
3. Manual test: start dev server, trigger new endpoints via Swagger UI (`/docs`)
4. For Phase 2+: verify with a known ontology (e.g., Pizza ontology) that reasoning produces expected inferences
