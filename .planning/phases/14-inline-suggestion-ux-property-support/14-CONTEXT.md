# Phase 14: Inline Suggestion UX & Property Support - Context

**Gathered:** 2026-04-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can trigger LLM suggestions from the class detail panel, accept/reject/edit suggestions inline with sparkle-tagged affordances, walk through a branch sequentially using Next/Prev navigation, and browse and improve properties (ObjectProperty, DataProperty, AnnotationProperty) using the same pipeline. No separate "flashcard mode" — suggestions appear in the existing edit view.

</domain>

<decisions>
## Implementation Decisions

### Suggestion Card Design
- **D-01:** Suggestions appear **inline below each section** — child suggestions below existing children, annotation suggestions below annotations, etc. Keeps context close to what they augment.
- **D-02:** Each suggestion card has **inline icon buttons** on the right: check (accept), X (reject), pencil (edit). Compact, no extra clicks. Matches existing annotation row patterns.
- **D-03:** Confidence scores display as **subtle badge + color coding** — small percentage badge (e.g., "87%") with green/amber/red background based on thresholds. Validation warnings show as amber icon. Unobtrusive but scannable.
- **D-04:** AI-generated suggestions are visually distinguished with a **sparkle icon** (✨) prefix so users always know what's machine-proposed vs existing content.

### Suggestion Trigger Flow (Two-Stage Pipeline)
- **D-05:** Two distinct workflows depending on what the user wants:
  - **Class additions:** User clicks "Suggest Improvements" → system suggests **new classes only** → user curates/approves → system **auto-triggers annotation generation** for each approved class immediately (all annotation types in parallel: definitions, translations, relationships).
  - **Annotation additions:** User selects scope via **inline radio/toggle** next to the button: "This class" | "Siblings" | "Descendants". System populates all annotations for the selected scope.
- **D-06:** When suggesting annotations for siblings or descendants, results are **grouped by class in collapsible sections**. User expands one class at a time to review.
- **D-07:** Accepted classes **appear in the tree immediately** with a sparkle badge indicating they're new/uncommitted. Annotation auto-generation fires as soon as a class is accepted — no extra button click needed.

### No Separate Flashcard Mode
- **D-08:** No separate flashcard UI mode. Instead, the existing edit view is populated with AI suggestions (sparkle-tagged), and **Next/Prev navigation buttons** are added to the detail panel header for sequential branch walking. The "iterator" is just tree navigation, not a mode switch.
- **D-09:** When iterating a branch, **auto-suggest annotations on navigate** — landing on a class in sequential mode automatically requests annotation suggestions. User can dismiss if not needed.

### Property Tree Integration
- **D-10:** Properties appear as a **tab alongside the class tree**: "Classes" | "Properties". User switches between them. PropertyTree.tsx already exists.
- **D-11:** The detail panel uses **adapted sections** — same panel skeleton, but sections adapt for property types: "Domain" and "Range" replace "Children" for ObjectProperty. Labels, annotations, relationships stay the same. Suggestion cards work identically.

### Session State & Counters
- **D-12:** Editor header shows a **pending count badge** (e.g., "✨ 5") for unreviewed suggestions. Updates in real time as user accepts/rejects. Clicking scrolls to the first pending suggestion.
- **D-13:** Pending suggestions **persist in session state** until the session ends. Navigating away and back to a class re-displays its pending suggestions. Session ends on explicit submit/discard or page leave.

### Loading & Error States
- **D-14:** While waiting for LLM suggestions: **skeleton placeholder rows** appear in the relevant section (shimmer/skeleton suggestion cards). Shows where results will land.
- **D-15:** On LLM failure or budget exhaustion: **inline error banner replaces skeleton placeholders** with "Could not generate suggestions: [reason]" + Retry button. Budget exhaustion shows the existing LLMBudgetBanner. No modal interruption.

### Keyboard Shortcuts
- **D-16:** Minimal keyboard shortcut set for rapid curation: **Tab/Shift+Tab** to move between suggestions, **Enter** to accept, **Backspace/Delete** to reject, **E** to edit. Added to existing shortcut dialog under a "Suggestions" category.

### Claude's Discretion
- Animation/transition effects when suggestions appear or are accepted/rejected
- Exact skeleton placeholder count and sizing
- How the Next/Prev navigation interacts with tree expansion state
- Whether accepted suggestions get a brief "accepted" flash before transitioning to normal rows
- Property detail panel section ordering
- Default scope selection for annotation suggestions (single class vs siblings vs descendants)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — UX-01 through UX-06, PROP-01 through PROP-05

### Phase 13 Artifacts (Backend APIs)
- `../ontokit-api/ontokit/schemas/generation.py` — Pydantic schemas for suggestions (SuggestionType, GeneratedSuggestion, etc.)
- `../ontokit-api/ontokit/services/suggestion_generation_service.py` — generate() pipeline
- `../ontokit-api/ontokit/api/routes/generation.py` — POST /generate-suggestions, POST /validate-entity
- `../ontokit-api/ontokit/services/validation_service.py` — ValidationService with VALID-01..06

### Existing Frontend Components
- `components/editor/ClassDetailPanel.tsx` — Current detail panel (labels, annotations, relationships, parents)
- `components/editor/standard/StandardEditorLayout.tsx` — Standard mode layout
- `components/editor/developer/DeveloperEditorLayout.tsx` — Developer mode layout
- `components/editor/standard/PropertyTree.tsx` — Existing property tree component
- `components/editor/ClassTree.tsx` — Class tree with lazy loading and draft badges

### Existing Hooks
- `lib/hooks/useAutoSave.ts` — Has saveMode: "commit" | "suggest" + onSuggestSave
- `lib/hooks/useKeyboardShortcuts.ts` — Existing shortcut system with dialog
- `lib/hooks/useLLMGate.ts` — LLM access gating by role
- `lib/hooks/useLLMConfig.ts` — LLM configuration state

### LLM UI Components
- `components/editor/LLMBudgetBanner.tsx` — Budget exhaustion banner
- `components/editor/LLMRoleBadge.tsx` — Role-based LLM access indicator

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ClassDetailPanel.tsx`: Annotation rows with blur handlers, InlineAnnotationAdder, RelationshipSection — suggestion cards should follow similar row patterns
- `PropertyTree.tsx`: Already exists in standard layout — needs tab integration
- `useSuggestionSession`: Session lifecycle (create/save/submit/discard) — extend for suggestion tracking
- `useKeyboardShortcuts`: Single keydown listener, Mac compat, suppresses in dialogs/Monaco/inputs — extend with suggestion category
- `EntitySearchCombobox`: Already has brain icon toggle for semantic search — similar sparkle icon pattern
- `LLMBudgetBanner`, `LLMRoleBadge`: Existing LLM status components for error/access states
- `useAutoSave`: Already has saveMode + onSuggestSave — wire accepted suggestions through this

### Established Patterns
- Annotation rows use onBlur for saves, inline editing with ghost rows
- Tree uses lazy loading, draft badges (amber dots), aria-activedescendant
- ResizablePanelDivider for tree/detail split
- React Query for server state, Zustand for client state, URL params for selected class
- Dark mode via Tailwind class-based (darkMode: "class")

### Integration Points
- ClassDetailPanel sections need suggestion card slots below existing content
- Editor header needs pending count badge
- Tree needs Next/Prev sequential navigation affordance
- Tree tab bar needs Classes/Properties tab switcher
- useAutoSave needs to handle accepted suggestions as draft writes
- Accepted class suggestions need to trigger annotation generation API call

</code_context>

<specifics>
## Specific Ideas

- Two-stage pipeline: classes first, then annotations auto-fire — mirrors how a subject-matter expert thinks ("what are the concepts?" then "what do we know about each one?")
- Sparkle icon (✨) as the universal AI-generated content marker — consistent, recognizable
- Inline scope toggle (This class | Siblings | Descendants) for annotation batch scope — avoids modals or separate pages
- No separate flashcard mode — the existing edit view IS the curation surface. Sequential navigation is just tree walking with Next/Prev buttons.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 14-inline-suggestion-ux-property-support*
*Context gathered: 2026-04-07*
