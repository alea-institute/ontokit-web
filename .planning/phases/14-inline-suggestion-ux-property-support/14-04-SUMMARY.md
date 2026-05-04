---
phase: 14-inline-suggestion-ux-property-support
plan: 04
subsystem: ui
tags: [react, llm-suggestions, owl-properties, useSuggestions, BranchNavigator]

# Dependency graph
requires:
  - phase: 14-01
    provides: useSuggestions hook, suggestion store, generation API client
  - phase: 14-02
    provides: SuggestionCard, SuggestionSkeleton, SuggestImprovementsButton, BranchNavigator with simpleNodes
  - phase: 14-03
    provides: ClassDetailPanel suggestion slots pattern, layout LLM wiring pattern (llmGate, byoEntry, handleAutoSuggest)
provides:
  - PropertyDetailPanel with LLM suggestion slots in Labels, Annotations, Domain, Range, and Sub-Properties sections
  - Property-mode suggestion support in both StandardEditorLayout and DeveloperEditorLayout
  - PropertyTree onNodesLoaded callback for BranchNavigator property navigation
  - PROP-02 new property entity creation via children suggestion type
affects: [phase-15, property-editing, suggestion-ux]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Property suggestion slots mirror ClassDetailPanel pattern: SuggestImprovementsButton in Section headerActions + renderSuggestionSlot helper"
    - "Children suggestion type reused for new property entity creation (same as class children)"
    - "BranchNavigator simpleNodes prop enables flat property list navigation without ClassTreeNode conversion"

key-files:
  created: []
  modified:
    - components/editor/PropertyDetailPanel.tsx
    - components/editor/standard/StandardEditorLayout.tsx
    - components/editor/developer/DeveloperEditorLayout.tsx
    - components/editor/standard/PropertyTree.tsx

key-decisions:
  - "Reused children suggestion type for new property entity creation — backend treats children as sub-entity creation uniformly for both classes and properties"
  - "Domain/Range sections share edgesSuggestions hook — relationship_type field distinguishes domain vs range"
  - "Sub-Properties section only renders when canUseLLM is true since existing panel has no sub-property list"

patterns-established:
  - "Property suggestion accept flow: annotations merge into edit state, edges merge into domain/range, children call onAddSuggestedProperty directly"
  - "onNodesLoaded callback pattern for flat entity lists enabling BranchNavigator integration"

requirements-completed: [PROP-01, PROP-02, PROP-03, PROP-04, PROP-05]

# Metrics
duration: 5min
completed: 2026-04-07
---

# Phase 14 Plan 04: Property Suggestion Support Summary

**LLM suggestion slots in PropertyDetailPanel for annotations, domain/range, and new sub-property creation, wired through both editor layouts with BranchNavigator property navigation**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-07T18:26:54Z
- **Completed:** 2026-04-07T18:32:15Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- PropertyDetailPanel now has suggestion slots in Labels, Annotations, Domain, Range, and Sub-Properties sections matching the ClassDetailPanel pattern
- New property entity creation via children suggestion type fulfills PROP-02
- Both StandardEditorLayout and DeveloperEditorLayout pass LLM props to PropertyDetailPanel with BranchNavigator for property navigation
- PropertyTree exposes onNodesLoaded callback enabling BranchNavigator to navigate property siblings

## Task Commits

Each task was committed atomically:

1. **Task 1: Add suggestion slots to PropertyDetailPanel including PROP-02** - `13b96eb` (feat)
2. **Task 2: Wire property suggestion props through both layouts + PropertyTree onNodesLoaded** - `dc357c1` (feat)

## Files Created/Modified
- `components/editor/PropertyDetailPanel.tsx` - Added canUseLLM/byoKey/headerActions/onAddSuggestedProperty props, 3 useSuggestions hooks, accept handlers, renderSuggestionSlot helper, Sub-Properties section
- `components/editor/standard/StandardEditorLayout.tsx` - Pass LLM props to PropertyDetailPanel, wire BranchNavigator with simpleNodes, add propertyNodes state
- `components/editor/developer/DeveloperEditorLayout.tsx` - Same property suggestion wiring as StandardEditorLayout
- `components/editor/standard/PropertyTree.tsx` - Added onNodesLoaded prop, calls it after property fetch with flat property list

## Decisions Made
- Reused children suggestion type for new property entity creation -- backend treats children as sub-entity creation uniformly for both classes and properties
- Domain/Range sections share the edgesSuggestions hook instance -- the relationship_type field on the suggestion distinguishes domain vs range targets
- Sub-Properties section only renders when canUseLLM is true since the existing panel has no sub-property list section

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All Phase 14 plans (00-04) are now complete
- Property support fulfills PROP-01 through PROP-05
- Ready for Phase 14 verification

## Self-Check: PASSED

All 4 modified files verified present. Both task commits (13b96eb, dc357c1) verified in git log.

---
*Phase: 14-inline-suggestion-ux-property-support*
*Completed: 2026-04-07*
