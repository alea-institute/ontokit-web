# Entity Graph Port — Implementation Plan

**Feature:** Port folio-mapper's Entity Graph to ontokit (full stack)
**Issue:** CatholicOS/ontokit-web#81
**Date:** 2026-04-05

## Overview

Three plans executed sequentially:
1. **Backend** — BFS graph endpoint on ontokit-api
2. **Frontend components** — Port + adapt graph components to ontokit-web
3. **Integration** — Wire into editor layouts, inline + modal

---

## Plan 1: Backend — Graph BFS Endpoint (ontokit-api)

**Target repo:** `/home/damienriehl/Coding Projects/ontokit-api-folio/`

### Task 1.1: Pydantic schemas

**File:** `ontokit/schemas/graph.py` (new)

Port from folio-mapper's `backend/app/models/graph_models.py`, adapted:

```python
class GraphNode(BaseModel):
    id: str               # IRI hash or IRI
    label: str
    iri: str
    definition: str | None = None
    is_focus: bool = False
    is_root: bool = False  # ultimate ancestor (no parents except owl:Thing)
    depth: int = 0         # negative=ancestor, 0=focus, positive=descendant
    node_type: str = "class"  # focus|class|root|individual|property|external|unexplored
    child_count: int | None = None

class GraphEdge(BaseModel):
    id: str               # "{source}->{target}:{type}"
    source: str
    target: str
    edge_type: str        # subClassOf|equivalentClass|disjointWith|seeAlso
    label: str | None = None

class EntityGraphResponse(BaseModel):
    focus_iri: str
    focus_label: str
    nodes: list[GraphNode]
    edges: list[GraphEdge]
    truncated: bool = False
    total_concept_count: int = 0
```

Key difference from folio-mapper: no `branch` / `branch_color` fields — coloring is lineage-based, determined client-side.

### Task 1.2: Graph service method

**File:** `ontokit/services/ontology.py` — add `build_entity_graph()` method

Port BFS logic from folio-mapper's `folio_service.py` lines 861-1024, adapted to use RDFLib graph queries instead of folio-python:

- **BFS upward** (ancestors): Walk `rdfs:subClassOf` triples up to `ancestors_depth` (default 5), stop at owl:Thing
- **BFS downward** (descendants): Walk inverse subClassOf down to `descendants_depth` (default 2)
- **seeAlso cross-links**: For visited nodes, add `rdfs:seeAlso` edges (max 5 per node)
- **Node type detection**: Check if IRI is in known external namespaces (RDFS, OWL, FOAF, DC, SKOS), check rdf:type for individuals/properties
- **Root detection**: Node has no parents except owl:Thing
- **Truncation**: Cap at `max_nodes` (default 200), set `truncated` flag
- **Label resolution**: Use existing `OntologyService._get_label()` pattern

Parameters: `ontology_id`, `class_iri`, `branch`, `ancestors_depth=5`, `descendants_depth=2`, `max_nodes=200`, `include_see_also=True`

### Task 1.3: Route endpoint

**File:** `ontokit/api/routes/classes.py` — add endpoint

```text
GET /api/v1/projects/{id}/ontology/graph/{class_iri}
```

Query params: `ancestors_depth`, `descendants_depth`, `max_nodes`, `include_see_also`, `branch`

Auth: `OptionalUser` (graph viewing is read-only, should work with anonymous access)

Follow existing patterns: `Annotated[OntologyService, Depends(...)]`, return `EntityGraphResponse`.

### Task 1.4: Route registration

**File:** `ontokit/api/routes/__init__.py` — no changes needed (endpoint added to existing classes router)

---

## Plan 2: Frontend — Graph Components (ontokit-web)

**Target repo:** `/home/damienriehl/Coding Projects/ontokit-web/`

### Task 2.1: API client

**File:** `lib/api/graph.ts` (new)

```typescript
export interface GraphNode { ... }  // matches backend schema
export interface GraphEdge { ... }
export interface EntityGraphResponse { ... }

export const graphApi = {
  getEntityGraph(ontologyId: string, classIri: string, options?: {
    branch?: string;
    ancestorsDepth?: number;
    descendantsDepth?: number;
    maxNodes?: number;
    includeSeeAlso?: boolean;
  }): Promise<EntityGraphResponse>
}
```

Re-export from `lib/api/client.ts`.

### Task 2.2: Update graph types

**File:** `lib/graph/types.ts` — update to match new API response

Keep existing `GraphNodeType` and `GraphEdgeType` unions. Add/update types to align with backend `EntityGraphResponse`. Remove client-side-only types that are no longer needed.

### Task 2.3: Port useELKLayout hook

**File:** `lib/graph/useELKLayout.ts` (new, replaces `elkLayout.ts`)

Port from folio-mapper's `useELKLayout.ts`:
- Takes nodes + edges + direction (TB/LR)
- Returns positioned nodes + edges
- ELK layered algorithm with configurable spacing
- Dynamic node width based on label length: `max(180, label.length * 7.5 + 32)`
- Memoized computation on data/direction change

### Task 2.4: Port ConceptNode

**File:** `components/graph/ConceptNode.tsx` (replaces `OntologyNode.tsx`)

Port from folio-mapper, adapted with ontokit's node types:

| Node type | Style |
|-----------|-------|
| `focus` | Blue border + blue-50 bg |
| `root` | Red border (3px) — ultimate ancestor |
| `class` | Dark gray border |
| `individual` | Pink border + "I" badge |
| `property` | Blue-300 border + "P" badge |
| `external` | Slate-200 border + external icon |
| `unexplored` | Dashed border + expand icon |

Keep folio-mapper's hover shadow, click/double-click handling. Add dark mode support.

### Task 2.5: Port HierarchyEdge

**File:** `components/graph/HierarchyEdge.tsx` (replaces `OntologyEdge.tsx`)

Port from folio-mapper:
- `subClassOf` — solid gray, arrowhead
- `seeAlso` — dashed purple, no arrowhead
- `equivalentClass` — dashed blue (from existing ontokit)
- `disjointWith` — dashed red (from existing ontokit)
- Hover label display

### Task 2.6: Port EntityGraphModal

**File:** `components/graph/EntityGraphModal.tsx` (new)

Port from folio-mapper:
- Fixed overlay (98vw x 97vh)
- Close button + Esc key
- Title: "Entity Graph: {focus_label}"
- Stats: "{N} nodes, {M} edges"
- Lazy-loaded graph via Suspense
- Dark mode support

### Task 2.7: Replace useGraphData hook

**File:** `lib/hooks/useGraphData.ts` — rewrite

Replace client-side iterative fetching with single API call:
- `fetchGraph(ontologyId, classIri, options)` → `EntityGraphResponse`
- `expandNode(iri)` → fetch 1-hop neighbors, merge into existing data
- `resetGraph()` → clear state
- Progressive expansion: track expanded nodes, merge new data without full refetch
- React Query for caching

### Task 2.8: Assemble OntologyGraph

**File:** `components/graph/OntologyGraph.tsx` — rewrite

Port folio-mapper's `EntityGraph.tsx` structure:
- React Flow canvas with ConceptNode + HierarchyEdge
- Toolbar: direction toggle (TB/LR), descendants toggle, reset, node/edge counts
- MiniMap + Controls
- Truncation warning when `truncated` flag is true
- Loading/error/empty states
- Dark mode via CSS class detection (existing pattern)

---

## Plan 3: Integration — Editor Wiring

### Task 3.1: StandardEditorLayout integration

**File:** `components/editor/standard/StandardEditorLayout.tsx`

- Keep inline graph toggle (showGraph state, Graph button in detail panel header)
- Add expand button that opens EntityGraphModal
- Pass `ontologyId` (from project data) to graph components
- EntityGraphModal rendered at layout level

### Task 3.2: DeveloperEditorLayout integration

**File:** `components/editor/developer/DeveloperEditorLayout.tsx`

- Keep Graph tab alongside Tree/Source tabs
- Add expand button for full-screen modal
- Same props/wiring as standard layout

### Task 3.3: Remove old graph files

Delete files replaced by the port:
- `lib/graph/elkLayout.ts` (replaced by `useELKLayout.ts`)
- `lib/graph/buildGraphData.ts` (replaced by backend endpoint)
- Old test files in `__tests__/lib/graph/`

### Task 3.4: Tests

- Unit tests for `useELKLayout` hook
- Unit tests for ConceptNode / HierarchyEdge rendering
- Integration test for `useGraphData` hook with mocked API
- E2E: graph renders with correct nodes when selecting a class

---

## Execution Order

```text
Plan 1 (backend) → Plan 2 (frontend components) → Plan 3 (integration)
```

Plans 1 and 2 could partially overlap (frontend can mock API while backend is built), but sequential is safer for a port.

## Success Criteria

1. Backend: `GET /ontologies/{id}/classes/{iri}/graph` returns BFS subgraph with correct nodes/edges/truncation
2. Frontend: Graph renders with lineage-based coloring (root=red, ancestor=dark gray, focus=blue, seeAlso=purple)
3. Inline graph toggle works in both standard and developer layouts
4. Full-screen modal opens via expand button, closes via button/Esc
5. Progressive node expansion: click unexplored → fetch + merge neighbors
6. Direction toggle (TB ⟷ LR) relayouts correctly
7. Works with FOLIO ontology on production server
