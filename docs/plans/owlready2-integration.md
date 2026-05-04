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

### Frontend

#### API client (`lib/api/reasoning.ts`)
New module following the `lintApi` / `qualityApi` pattern:
```typescript
export const reasoningApi = {
  triggerReasoning: (projectId, token, options?) => ...,  // POST, returns job_id
  getStatus: (projectId, token?) => ...,                   // GET latest run summary
  getRuns: (projectId, token?, options?) => ...,           // GET paginated history
  getRunDetail: (projectId, runId, token?) => ...,         // GET run with findings
};
```

TypeScript types: `ReasoningRun`, `ReasoningFinding`, `ReasoningResult`, `ReasoningTriggerResponse`.

#### WebSocket (`ReasoningWebSocketManager` in `lib/api/reasoning.ts`)
Follow `LintWebSocketManager` pattern from `lib/api/lint.ts`:
- Connect to `ws://[API_URL]/api/v1/projects/{projectId}/reasoning/ws`
- Message types: `reasoning_started`, `reasoning_complete`, `reasoning_failed`
- Auto-reconnect with exponential backoff (max 5 attempts)

#### HealthCheckPanel integration (`components/editor/HealthCheckPanel.tsx`)
Add a **Reasoning** tab alongside the existing Lint / Consistency / Duplicates tabs:
- **Trigger button**: "Run Reasoner" with reasoner selection (HermiT/Pellet dropdown)
- **Status display**: Running spinner with WebSocket progress, or last run timestamp + duration
- **Results view**: Findings displayed as cards (same pattern as lint issues), categorized:
  - Inferred subsumptions (info severity)
  - Reclassified individuals (info severity)
  - Inconsistent classes (error severity)
  - Consistency status banner (consistent/inconsistent)
- **Navigation**: Clicking an entity IRI in a finding navigates to that class in the tree (reuse `onNavigateToClass`)

#### Editor page (`app/projects/[id]/editor/page.tsx`)
- Gate the "Run Reasoner" button behind `canManage` permission (same as "Run Lint")

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

### Frontend

#### HealthCheckPanel Consistency tab (`components/editor/HealthCheckPanel.tsx`)
- Add an "Include Reasoning" toggle/checkbox to the Consistency tab
- When enabled, the trigger call passes `include_reasoning=true` and switches to async polling (job_id pattern) instead of waiting for a synchronous response
- New semantic rule findings (`unsatisfiable_class`, `unintended_equivalence`, `logical_inconsistency`) render with a "Reasoner" badge to distinguish them from structural checks
- These findings use error severity and include explanatory detail text

#### Quality API client (`lib/api/quality.ts`)
- Update `triggerConsistencyCheck()` to accept an `includeReasoning?: boolean` option
- When `includeReasoning=true`, the response shape changes to a job_id (like lint trigger) — handle both response patterns

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

### Frontend

#### API client (`lib/api/swrl.ts`)
New module for SWRL rule CRUD:
```typescript
export const swrlApi = {
  listRules: (projectId, branch?, token?) => ...,
  createRule: (projectId, rule, token?) => ...,
  updateRule: (projectId, ruleId, update, token?) => ...,
  deleteRule: (projectId, ruleId, token?) => ...,
  executeRules: (projectId, token?) => ...,  // triggers reasoning with SWRL
};
```

TypeScript types: `SWRLRule`, `SWRLRuleCreate`, `SWRLRuleUpdate`.

#### SWRL Rules panel (`components/editor/SWRLRulesPanel.tsx`)
New panel accessible from the editor, gated behind `canManage` permission:
- **Rules list**: Table or card list showing each rule's name, description, body (code-formatted), and enabled toggle
- **Add rule**: Dialog/form with fields for name, description, body (with SWRL syntax hint/reference), enabled checkbox
- **Edit/delete**: Inline edit or dialog for existing rules; delete with confirmation
- **Execute button**: "Run Rules" triggers `swrlApi.executeRules()`, returns reasoning job_id, shows progress via WebSocket (reuses `ReasoningWebSocketManager`)
- **Results**: After execution, display inferred triples from the reasoning run (link to Phase 2 reasoning results view)

#### Editor page integration
- Add a "SWRL Rules" button/tab in the editor header or settings area (next to Health Check)
- Toggle `showSWRLRules` state to show/hide the panel
- Only visible to users with `canManage` permission

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

### Frontend

#### ClassDetailPanel restrictions display (`components/editor/ClassDetailPanel.tsx`)
Add a **Restrictions** section (after Parent Classes, before Annotations):
- Render each restriction as a human-readable statement, e.g.:
  - `someProp **some** SomeClass` (existential)
  - `someProp **only** SomeClass` (universal)
  - `someProp **min** 2 SomeClass` (min cardinality)
  - `someProp **value** someIndividual` (has value)
- Property and filler IRIs are clickable (navigate to entity in tree or open external IRI)
- Read-only display initially; editing restrictions is out of scope for this plan

TypeScript type additions to existing `OWLClassResponse`:
```typescript
interface OWLRestriction {
  restriction_type: "some_values_from" | "all_values_from" | "has_value" |
    "min_cardinality" | "max_cardinality" | "exact_cardinality";
  property_iri: string;
  property_label?: string;
  filler_iri?: string;
  filler_label?: string;
  cardinality?: number;
}
```

#### Closed-world check in Reasoning tab (`components/editor/HealthCheckPanel.tsx`)
- Add a "Closed World Check" button within the Reasoning tab
- Optional: class multi-select to scope the check to specific classes (or run on full ontology)
- Results displayed as violation cards with entity navigation

#### Reasoning API client (`lib/api/reasoning.ts`)
- Add `triggerClosedWorldCheck(projectId, token, targetClasses?)` method

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

### Frontend

#### Reasoning diff view (`components/editor/ReasoningDiffPanel.tsx`)
New component for visualizing what the reasoner inferred:
- **Summary banner**: "Reasoner inferred X new triples" with breakdown by category
- **Categorized sections** (collapsible):
  - **New subsumptions**: "ClassA is now a subclass of ClassB" — table with child/parent columns, IRIs clickable
  - **Reclassified individuals**: "IndividualX was reclassified from TypeA to TypeB" — old vs new types
  - **New property assertions**: "Subject predicate Object" triple display
- **Filter/search**: Text filter to find specific entities in the diff
- Each entity IRI is clickable (navigates to class in tree via `onNavigateToClass`)

#### Integration in HealthCheckPanel (`components/editor/HealthCheckPanel.tsx`)
- The Reasoning tab gets a "Show Reasoning Diff" button that triggers the diff endpoint
- Results open in the `ReasoningDiffPanel` (could be inline in the tab or a wider overlay/dialog for better readability)

#### Reasoning API client (`lib/api/reasoning.ts`)
- Add `triggerReasoningDiff(projectId, token, branch?)` method
- TypeScript types: `WorldDiffResponse`, `InferredTriple`

---

## Phase 7: SHACL Shapes Validation

**Goal:** Let users define SHACL shapes to validate their ontology data against expected constraints. SHACL operates under the Closed World Assumption (unlike OWL's Open World), making it ideal for data quality validation — e.g., "every class MUST have at least one rdfs:label" or "every individual of type Person MUST have exactly one foaf:name."

### New dependency
- **pySHACL** (`pyshacl>=0.31.0`) — the only mature Python SHACL validator, part of the RDFLib ecosystem. Works directly with `rdflib.Graph`, compatible with rdflib 7.x and Python 3.13.
- pySHACL includes optional OWL-RL inference (`inference='owlrl'`) so shapes can validate inferred triples without going through the owlready2 bridge.

### Two validation modes
1. **Raw validation**: Validate the asserted graph as-is against SHACL shapes (fast, default)
2. **Post-reasoning validation**: Materialize inferences first, then validate. Two paths:
   - **Lightweight**: pySHACL's built-in `inference='owlrl'` (OWL-RL profile, stays in rdflib, no Java needed)
   - **Full**: owlready2 reasoning (HermiT/Pellet, Phase 2) → export inferred graph → pySHACL validates (more powerful but slower, requires Java)

### Storage approach
- SHACL shapes stored as a Turtle file in git: `shapes.ttl` alongside the ontology file
- Follows the same sidecar pattern as SWRL rules (Phase 4)
- Users can also paste/upload shapes inline or import from a URL

### Backend files to create

| File | Purpose |
|------|---------|
| `ontokit/services/shacl_service.py` | `SHACLService` — load shapes, run validation, parse results |
| `ontokit/schemas/shacl.py` | `SHACLValidationResult`, `SHACLViolation`, `SHACLTriggerResponse`, `SHACLShapesResponse` |
| `ontokit/api/routes/shacl.py` | Shapes CRUD + validation trigger endpoints |
| `tests/unit/test_shacl_service.py` | Validation tests with conforming and non-conforming data |

### SHACLService
```python
class SHACLService:
    def validate(
        self,
        data_graph: Graph,
        shapes_graph: Graph,
        inference: str = "none",       # "none", "owlrl", "rdfs", "both"
        ont_graph: Graph | None = None, # optional ontology for import resolution
    ) -> SHACLValidationResult:
        conforms, results_graph, results_text = pyshacl.validate(
            data_graph,
            shacl_graph=shapes_graph,
            ont_graph=ont_graph,
            inference=inference,
        )
        return self._parse_results(conforms, results_graph)
```

### API routes (`ontokit/api/routes/shacl.py`)
- `GET /{project_id}/shacl/shapes` — get current shapes file content
- `PUT /{project_id}/shacl/shapes` — update shapes file (commits to git)
- `POST /{project_id}/shacl/validate` — trigger validation (options: `inference` mode, `branch`)
- `GET /{project_id}/shacl/validate/{job_id}` — get validation results

### Worker task (`ontokit/worker.py`)
- Add `run_shacl_validation_task(ctx, project_id, branch, inference="none")`
- Pattern follows lint/reasoning: load graph + shapes → run pySHACL → persist results → publish to `shacl:updates` Redis channel
- Validation with `inference='owlrl'` or full owlready2 reasoning runs as async task; raw validation can run synchronously

### Route registration (`ontokit/api/routes/__init__.py`)
- `router.include_router(shacl.router, prefix="/projects", tags=["SHACL"])`

### Frontend

#### API client (`lib/api/shacl.ts`)
```typescript
export const shaclApi = {
  getShapes: (projectId, branch?, token?) => ...,
  updateShapes: (projectId, content, token?) => ...,
  triggerValidation: (projectId, token?, options?) => ...,  // options: inference, branch
  getValidationResult: (projectId, jobId, token?) => ...,
};
```

TypeScript types: `SHACLValidationResult`, `SHACLViolation` (focusNode, resultPath, value, message, severity, sourceShape).

#### Shapes editor (`components/editor/SHACLShapesEditor.tsx`)
New panel for editing SHACL shapes:
- Monaco editor with Turtle syntax highlighting (reuses existing Turtle language support from `lib/editor/languages/turtle.ts`)
- Load/save shapes file from/to git
- "Validate" button with inference mode dropdown (None / OWL-RL / Full Reasoning)
- Gated behind `canManage` permission

#### HealthCheckPanel integration (`components/editor/HealthCheckPanel.tsx`)
Add a **Shapes** tab alongside Lint / Consistency / Duplicates / Reasoning:
- **Validation trigger**: "Validate Shapes" button with inference mode selector
- **Results view**: Violations displayed as cards with:
  - Focus node IRI (clickable, navigates to entity)
  - Result path (the property that failed)
  - Expected vs actual value
  - Severity (Violation / Warning / Info, mapped from `sh:resultSeverity`)
  - Source shape name
- **Conformance banner**: Green "Conforms" or red "X violations found"

#### Editor page integration
- Shapes editor accessible from editor header (alongside Health Check, SWRL Rules)
- Toggle `showSHACLEditor` state

---

## Frontend Files Summary

| Phase | New/Modified Frontend Files |
|-------|----------------------------|
| 2 | `lib/api/reasoning.ts` (new), `components/editor/HealthCheckPanel.tsx` (add Reasoning tab), `app/projects/[id]/editor/page.tsx` (permission gating) |
| 3 | `lib/api/quality.ts` (add `includeReasoning` option), `components/editor/HealthCheckPanel.tsx` (reasoning toggle in Consistency tab) |
| 4 | `lib/api/swrl.ts` (new), `components/editor/SWRLRulesPanel.tsx` (new), `app/projects/[id]/editor/page.tsx` (add SWRL button/panel) |
| 5 | `components/editor/ClassDetailPanel.tsx` (add Restrictions section), `lib/api/reasoning.ts` (add closed-world method), `components/editor/HealthCheckPanel.tsx` (closed-world button) |
| 6 | `components/editor/ReasoningDiffPanel.tsx` (new), `lib/api/reasoning.ts` (add diff method), `components/editor/HealthCheckPanel.tsx` (diff button) |
| 7 | `lib/api/shacl.ts` (new), `components/editor/SHACLShapesEditor.tsx` (new), `components/editor/HealthCheckPanel.tsx` (add Shapes tab), `app/projects/[id]/editor/page.tsx` (add Shapes editor button) |

---

## Dependency Graph

```
Phase 1 (Bridge Layer) — backend only
   |
   v
Phase 2 (Reasoning Task) — backend + frontend (API client, Reasoning tab, WebSocket)
   |
   +---> Phase 3 (Enhanced Consistency) — backend + frontend (reasoning toggle)
   +---> Phase 4 (SWRL Rules) — backend + frontend (SWRL panel)
   +---> Phase 5 (Restrictions + Closed World) — backend + frontend (restrictions display, closed-world UI)
   +---> Phase 6 (World Comparison) — backend + frontend (diff visualization)
   +---> Phase 7 (SHACL Validation) — backend + frontend (shapes editor, validation tab)
```

Phase 7 depends on Phase 1 only for the optional full-reasoning validation mode (owlready2 → rdflib → pySHACL). For raw and OWL-RL validation, Phase 7 can be implemented independently — it only requires rdflib + pySHACL, no owlready2 bridge needed. In practice, implementing it after Phase 2 is recommended so the full-reasoning path is available.

Phases 3-7 are independent of each other and can be done in any order after Phase 2.

---

## Technical Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| NTriples round-trip fidelity (complex BNode structures) | Extensive unit tests in Phase 1; fall back to RDF/XML bridge format if needed |
| Orphaned SQLite files on worker crash | `tempfile.TemporaryDirectory` auto-cleans; add periodic cleanup cron for stale files >1hr |
| Reasoner memory/CPU for large ontologies | ARQ `job_timeout` (300s) as hard cutoff; warn users above a triple-count threshold |
| **Java not in Docker images** | Add `default-jre-headless` to both Dockerfiles (prerequisite for Phase 2) |
| Concurrent reasoning tasks | Each task gets its own temp dir with uuid4 — fully isolated |
| pySHACL validation on large graphs | OWL-RL inference can be slow on large ontologies; offer "none" as default inference mode, document that OWL-RL adds overhead |

## Verification

### Backend (after each phase)
1. Run `pytest tests/ -v --cov=ontokit` — all existing + new tests pass
2. Run `ruff check ontokit/ && ruff format --check ontokit/ && mypy ontokit/` — code quality
3. Manual test: start dev server, trigger new endpoints via Swagger UI (`/docs`)
4. For Phase 2+: verify with a known ontology (e.g., Pizza ontology) that reasoning produces expected inferences

### Frontend (Phases 2-6)
1. Run `npm run lint && npm run type-check` — no lint/type errors
2. Run `npm run test` — all existing + new tests pass
3. Manual test per phase:
   - **Phase 2**: Trigger reasoning from HealthCheckPanel Reasoning tab, verify WebSocket updates show progress, verify findings display with entity navigation
   - **Phase 3**: Toggle "Include Reasoning" in Consistency tab, verify async polling works, verify semantic findings render with "Reasoner" badge
   - **Phase 4**: Open SWRL Rules panel, create/edit/delete/toggle rules, execute rules and verify reasoning results appear
   - **Phase 5**: Open a class with restrictions, verify Restrictions section renders with human-readable statements and clickable IRIs; trigger closed-world check and verify violation display
   - **Phase 6**: Trigger reasoning diff, verify categorized inferred triples display with entity navigation
   - **Phase 7**: Open SHACL shapes editor, write/save shapes, trigger validation in each inference mode, verify violations display with focus node navigation and severity badges
