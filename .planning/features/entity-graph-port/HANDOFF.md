# Entity Graph Port — Session Handoff

**Paused:** 2026-04-06
**Branch:** `entity-graph-migration`
**Issue:** CatholicOS/ontokit-web#81

## What's Done

### Plan 1: Backend (committed)
- `1866d04` — Server-side BFS graph endpoint ported to ontokit-api
- Schemas, service method, route all implemented in `/home/damienriehl/Coding Projects/ontokit-api-folio/`

### Plan 2: Frontend Components (committed)
- `1866d04` — API client (`lib/api/graph.ts`), `useELKLayout` hook, `EntityGraphModal`, `OntologyGraph` rewrite, `useGraphData` rewrite
- `65c5ac0` — Cleanup: deleted old `buildGraphData.ts` + `elkLayout.ts`, extracted `extractTreeLabelMap` to `lib/graph/utils.ts`, added 3 new test files

### Plan 3: Integration (committed)
- `1866d04` + `65c5ac0` — Layout imports updated in both `DeveloperEditorLayout` and `StandardEditorLayout`
- Old files removed, new tests passing

## Current State

- **All 103 tests pass** (10 test files)
- **No type errors** in project code
- **All 3 plans are code-complete** — committed on `entity-graph-migration` branch
- **NOT yet visually verified** — Chrome DevTools MCP couldn't launch Chrome (no X display in remote session)

## What's Left

1. **Visual verification** — use MCP chrome-devtools (now configured with `--headless` in `~/.claude/.mcp.json`) to:
   - Navigate to a project editor, select a class, open the Graph tab/button
   - Verify nodes render with lineage-based coloring (focus=blue, root=red, ancestor=gray, seeAlso=purple)
   - Test expand/collapse, direction toggle (TB/LR), EntityGraphModal (full-screen)
   - Test both developer and standard layouts
2. **Create PR** — once visually verified, create PR against `catholicos/main`
3. **File GitHub Issue** — CatholicOS/ontokit-web#81 should be updated or a new issue created upstream

## Environment Notes

- Chrome DevTools MCP now configured with `--headless` mode (`~/.claude/.mcp.json`) — works over SSH/remote terminals
- Dev server: `./ontokit-web.sh start` (port 3000 or 53000 depending on config)
- Backend API needed for graph data — either local ontokit-api or production server

## Key Files Changed (from main)

### New files
- `lib/api/graph.ts` — graph API client
- `lib/graph/useELKLayout.ts` — ELK layout hook (replaces `elkLayout.ts`)
- `lib/graph/utils.ts` — `extractTreeLabelMap` utility
- `components/graph/EntityGraphModal.tsx` — full-screen graph modal
- `__tests__/lib/graph/useELKLayout.test.ts`
- `__tests__/lib/graph/utils.test.ts`
- `__tests__/lib/hooks/useGraphData.test.ts`

### Modified files
- `components/graph/OntologyGraph.tsx` — rewritten (folio-mapper port)
- `components/graph/OntologyNode.tsx` — minor updates
- `components/graph/OntologyEdge.tsx` — minor updates
- `lib/hooks/useGraphData.ts` — rewritten (single API call + expand)
- `components/editor/standard/StandardEditorLayout.tsx` — import update
- `components/editor/developer/DeveloperEditorLayout.tsx` — import update

### Deleted files
- `lib/graph/buildGraphData.ts` — replaced by backend endpoint
- `lib/graph/elkLayout.ts` — replaced by `useELKLayout.ts`
- `__tests__/lib/graph/buildGraphData.test.ts` — replaced by new tests
