---
phase: 14-inline-suggestion-ux-property-support
plan: 03
subsystem: ui
tags: [react, zustand, llm-suggestions, keyboard-shortcuts, branch-navigation]

# Dependency graph
requires:
  - phase: 14-01
    provides: useSuggestions hook, suggestionStore, generationApi
  - phase: 14-02
    provides: SuggestionCard, SuggestionSkeleton, SuggestImprovementsButton, SuggestionScopeToggle, PendingSuggestionBadge, BranchNavigator
provides:
  - Suggestion slots in all ClassDetailPanel sections (children, annotations, parents, edges)
  - Accept flow routing (child creation direct via D-07, annotation merge, parent add, edge add)
  - PendingSuggestionBadge in both editor layout headers
  - BranchNavigator with auto-suggest on navigate (D-09)
  - Sparkle badges on accepted suggestion IRIs in ClassTree
  - Keyboard shortcuts for suggestion curation (Enter/Delete/E)
affects: [14-04-property-support, editor-page, class-detail-panel]

# Tech tracking
tech-stack:
  added: []
  patterns: [suggestion-slot-pattern, accept-flow-routing, auto-suggest-on-navigate, sparkle-badge-system]

key-files:
  created: []
  modified:
    - components/editor/ClassDetailPanel.tsx
    - app/projects/[id]/editor/page.tsx
    - components/editor/standard/StandardEditorLayout.tsx
    - components/editor/developer/DeveloperEditorLayout.tsx
    - components/editor/ClassTree.tsx
    - components/editor/shared/EntityTree.tsx
    - components/editor/shared/EntityTreeNode.tsx

key-decisions:
  - "Suggestion hooks placed after helper function declarations to avoid block-scoped variable reference errors"
  - "Children section only renders when canUseLLM is true since there is no existing children list in detail panel"
  - "Sparkle badge uses Lucide Sparkles icon in amber color, matching the suggestion card sparkle styling"

patterns-established:
  - "renderSuggestionSlot pattern: reusable helper renders skeleton/error/cards for any useSuggestions instance"
  - "Section headerActions prop: optional ReactNode rendered after section title for action buttons"
  - "Auto-suggest flow: layout sets isAutoSuggesting state, flows as autoSuggestAnnotationsOnMount prop to ClassDetailPanel, useEffect fires on classIri change"

requirements-completed: [UX-01, UX-03, UX-04, UX-05, UX-06]

# Metrics
duration: 11min
completed: 2026-04-07
---

# Phase 14 Plan 03: Suggestion Integration Summary

**Wired LLM suggestion slots into ClassDetailPanel with per-section accept routing, BranchNavigator auto-suggest, sparkle badges on accepted entities, and keyboard shortcuts for curation**

## Performance

- **Duration:** 11 min
- **Started:** 2026-04-07T18:11:39Z
- **Completed:** 2026-04-07T18:23:08Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- ClassDetailPanel now has suggestion buttons and card slots in Definition, Annotations, Parents, Relationships, and Subclasses sections
- Accept flow correctly routes: child/sibling suggestions create entities directly via generateTurtleSnippet + addOptimisticNode (D-07), annotations merge into editAnnotations state, parents call addParent, edges add to editRelationships
- BranchNavigator in both layouts with auto-suggest on navigate (D-09) fires annotation suggestions automatically when navigating to new class
- PendingSuggestionBadge shows in both editor layout headers with click-to-scroll-to-first-suggestion
- Sparkle badge (Sparkles icon) appears on accepted suggestion IRIs in the class tree
- Three keyboard shortcuts under "Suggestions" category: Enter (accept), Delete (reject), E (edit) -- none global per Pitfall 4

## Task Commits

Each task was committed atomically:

1. **Task 1: Add suggestion slots to ClassDetailPanel + accept flow routing** - `99cbeb3` (feat)
2. **Task 2: Wire PendingSuggestionBadge + BranchNavigator + sparkle badges + auto-suggest into both layouts, editor page, and keyboard shortcuts** - `11e2628` (feat)

## Files Created/Modified
- `components/editor/ClassDetailPanel.tsx` - Added 5 useSuggestions hooks, accept handlers, suggestion slots in all sections, autoSuggestAnnotationsOnMount effect, SuggestionScopeToggle, renderSuggestionSlot helper
- `app/projects/[id]/editor/page.tsx` - Added handleAddSuggestedChild (D-07 direct creation), acceptedSuggestionIris state, 3 keyboard shortcuts under "Suggestions" category
- `components/editor/standard/StandardEditorLayout.tsx` - Added PendingSuggestionBadge, BranchNavigator via headerActions, isAutoSuggesting state, canUseLLM/byoKey/onAddSuggestedChild/autoSuggestAnnotationsOnMount prop threading, suggestedIris to ClassTree
- `components/editor/developer/DeveloperEditorLayout.tsx` - Same pattern as StandardEditorLayout
- `components/editor/ClassTree.tsx` - Added suggestedIris prop, passed to EntityTree
- `components/editor/shared/EntityTree.tsx` - Added suggestedIris prop, passed to EntityTreeNodeRow
- `components/editor/shared/EntityTreeNode.tsx` - Added suggestedIris prop with Sparkles icon badge rendering, passed to recursive children

## Decisions Made
- Suggestion hooks placed after all editing helper declarations (addParent, triggerSave etc.) to avoid TypeScript block-scoped variable errors
- Children section only appears when canUseLLM is true since the existing panel shows child_count in Statistics but has no child list section
- Sparkle badge uses Lucide Sparkles icon (amber-500) matching the SuggestionCard sparkle styling for visual consistency

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed block-scoped variable reference error for addParent**
- **Found during:** Task 1 (suggestion hooks placement)
- **Issue:** Accept handlers referenced `addParent` which was declared later in the component, causing TS2448/TS2454 errors
- **Fix:** Moved all suggestion hooks, accept handlers, and auto-suggest effect to after the editing helper declarations
- **Files modified:** components/editor/ClassDetailPanel.tsx
- **Verification:** `npx tsc --noEmit` passes clean
- **Committed in:** 99cbeb3 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Ordering fix necessary for TypeScript compilation. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All suggestion infrastructure wired for classes; Plan 04 (property support) can extend the same patterns
- BranchNavigator simpleNodes prop available for flat property lists
- PropertyDetailPanel needs the same suggestion slot pattern applied in Plan 04

## Self-Check: PASSED

All 7 modified files exist. Both task commits (99cbeb3, 11e2628) verified in git log. TypeScript compiles clean (0 errors). All 120 tests pass.

---
*Phase: 14-inline-suggestion-ux-property-support*
*Completed: 2026-04-07*
