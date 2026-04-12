# Feature: Entity Graph Port from folio-mapper - Context

**Gathered:** 2026-04-05
**Status:** Ready for planning

<domain>
## Feature Boundary

Port folio-mapper's Entity Graph implementation to ontokit-web as a full-stack feature (backend BFS endpoint + frontend components). Replace the existing Phase 6A graph visualization with folio-mapper's approach while keeping ontokit's ontology-agnostic node types and lineage-based coloring. Ship on ALEA/FOLIO first, then propose upstream to CatholicOS via GitHub Issue.

This is a standalone feature — separate from the v0.4.0 LLM-Assisted Ontology Improvements roadmap.

</domain>

<decisions>
## Implementation Decisions

### Port strategy
- **D-01:** Use folio-mapper's architecture (ConceptNode, HierarchyEdge, EntityGraphModal, useELKLayout) as the foundation
- **D-02:** Integrate ontokit-web's existing node types (focus, class, root, individual, property, external, unexplored) into folio-mapper's component structure — don't discard them
- **D-03:** Drop FOLIO-specific branch coloring (25 hardcoded branch colors) — not applicable to arbitrary ontologies

### Backend graph endpoint
- **D-04:** Add a server-side BFS graph building endpoint to ontokit-api, ported from folio-mapper's `build_entity_graph()` in `folio_service.py`
- **D-05:** Endpoint signature: `GET /api/v1/projects/{projectId}/ontology/classes/graph?class_iri={iri}&ancestors_depth=5&descendants_depth=1&max_nodes=200&include_see_also=true` — client call: `graphApi.getEntityGraph(projectId, focusIri, { ancestorsDepth, descendantsDepth, maxNodes, includeSeeAlso }, accessToken)`
- **D-06:** Returns `EntityGraphResponse` with nodes, edges, truncation flag, and total concept count
- **D-07:** Full stack in one feature — backend endpoint + frontend components ship together

### Color scheme (ontology-agnostic, lineage-based)
- **D-08:** Ultimate ancestor nodes (branch roots) — **red** border/accent
- **D-09:** Other ancestor nodes — **dark gray** border/accent
- **D-10:** Focus node — **blue** border/accent (existing convention)
- **D-11:** seeAlso relationship edges — **purple** dashed lines
- **D-12:** subClassOf edges — **solid lines** (existing convention)
- **D-13:** No hardcoded ontology-specific palette — colors derive from node role in the lineage, not from which branch the node belongs to
- **D-14:** Dynamic branch detection — auto-detect top-level classes in any ontology to identify "branch roots"

### Presentation
- **D-15:** Both inline graph AND full-screen modal — keep current inline toggle in detail panel, add expand button that opens EntityGraphModal
- **D-16:** EntityGraphModal: full-screen overlay (98vw x 97vh), close via button or Esc, lazy-loaded
- **D-17:** Inline graph: shows in the right panel area (replacing detail panel), with expand button to go full-screen

### CatholicOS upstream
- **D-18:** Create a GitHub Issue on CatholicOS/ontokit-web describing the Entity Graph enhancement before implementation begins
- **D-19:** Implement on ALEA fork first, test with FOLIO ontology, then open PR upstream to CatholicOS

### Claude's Discretion
- Exact ELK layout parameters (spacing, algorithm options)
- Loading/error/empty state designs
- Node width/height calculations
- Minimap style and positioning
- Toolbar button arrangement
- Animation timing for fit-to-view

</decisions>

<specifics>
## Specific Ideas

- "Use as much of folio-mapper as you can" — start from folio-mapper's code, adapt rather than rewrite
- Node's ultimate ancestor node is red, other ancestor nodes are dark gray, seeAlso is purple — user has a clear mental model of lineage-based coloring
- folio-mapper's progressive expansion (click unexpanded node → fetch 1-hop neighbors, merge) should be preserved
- Direction toggle (TB/LR) should be preserved from folio-mapper
- Descendants show/hide toggle should be preserved

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### folio-mapper source (port from)
Repository: `alea-institute/folio-mapper` (private)
- `packages/ui/src/components/mapping/graph/EntityGraph.tsx` — Main graph component (ported)
- `packages/ui/src/components/mapping/graph/ConceptNode.tsx` — Custom node renderer (ported)
- `packages/ui/src/components/mapping/graph/HierarchyEdge.tsx` — Custom edge renderer (ported)
- `packages/ui/src/components/mapping/graph/useELKLayout.ts` — Layout hook (ported)
- `packages/ui/src/components/mapping/EntityGraphModal.tsx` — Full-screen modal (ported)
- `packages/core/src/folio/graph-types.ts` — Type definitions (adapted)
- `packages/core/src/folio/api-client.ts` — `fetchEntityGraph()` function (adapted)
- `backend/app/models/graph_models.py` — Backend data models (ported)
- `backend/app/services/folio_service.py` lines 861-1024 — `build_entity_graph()` BFS (ported)
- `backend/app/routers/mapping.py` — REST endpoint (ported)

### ontokit-web (replace/enhance)
- `components/graph/OntologyGraph.tsx` — Graph component (replaced with server-side BFS)
- `components/graph/OntologyNode.tsx` — Node renderer (node types preserved)
- `components/graph/OntologyEdge.tsx` — Edge renderer (edge types preserved)
- `lib/graph/types.ts` — Type definitions (node/edge type unions preserved)
- `lib/graph/useELKLayout.ts` — ELK layout hook (replaced elkLayout.ts)
- `lib/hooks/useGraphData.ts` — Data hook (replaced with React Query)
- `lib/api/graph.ts` — API client for server-side BFS endpoint (new)
- `components/graph/EntityGraphModal.tsx` — Full-screen graph overlay (new)
- `components/editor/standard/StandardEditorLayout.tsx` — Integration point for inline graph

### ontokit-api (backend target)
- Repository: `CatholicOS/ontokit-api` — see CatholicOS/ontokit-api#37 for BFS endpoint

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **React Flow (@xyflow/react v12)**: Already a dependency in ontokit-web — no new library needed
- **elkjs**: Already a dependency — no new library needed
- **OntologyNode types**: 7-type system (focus, class, root, individual, property, external, unexplored) is richer than folio-mapper's — preserve it
- **Dark mode support**: ontokit-web's graph already handles dark mode via CSS class watching — keep this
- **Lazy loading pattern**: ontokit-web already lazy-loads the graph via `next/dynamic` — keep this pattern

### Established Patterns
- **Graph lives in `components/graph/`** — maintain this directory structure
- **Graph types in `lib/graph/types.ts`** — maintain this location
- **Data hooks in `lib/hooks/`** — new hook replaces `useGraphData.ts`
- **API clients in `lib/api/`** — new `graphApi` client for the backend endpoint
- **Lazy loading via `next/dynamic`** with SSR disabled

### Integration Points
- `StandardEditorLayout.tsx`: inline graph toggle (showGraph state)
- `DeveloperEditorLayout.tsx`: Graph tab in developer mode
- `ClassDetailPanel`: Graph button triggers the toggle
- New: EntityGraphModal rendered at layout level

</code_context>

<deferred>
## Deferred Ideas

- **Configurable per-project color mapping** — let project owners define custom branch→color mappings in project settings (too much UI work for initial port)
- **Edge filtering UI** — toggle visibility of edge types (subClassOf, seeAlso, equivalentClass, disjointWith) independently
- **Graph search/filter** — search for nodes within the rendered graph
- **Export graph as image** — screenshot/SVG export of the current graph view
- **Animated edge traversal** — show data flow or relationship direction with animated edges

</deferred>

---

*Feature: entity-graph-port*
*Context gathered: 2026-04-05*
