# Phase 14: Inline Suggestion UX & Property Support - Research

**Researched:** 2026-04-07
**Domain:** Frontend UX — LLM suggestion display, accept/reject/edit affordances, property tree integration (Next.js 15 / React 19 / TypeScript)
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Suggestions appear **inline below each section** — child suggestions below existing children, annotation suggestions below annotations, etc.
- **D-02:** Each suggestion card has **inline icon buttons** on the right: check (accept), X (reject), pencil (edit). Compact, no extra clicks. Matches existing annotation row patterns.
- **D-03:** Confidence scores display as **subtle badge + color coding** — small percentage badge with green/amber/red background based on thresholds.
- **D-04:** AI-generated suggestions visually distinguished with a **sparkle icon** prefix (Sparkles from lucide-react).
- **D-05:** Two distinct trigger workflows: class additions via "Suggest improvements" button → classes first → then auto-annotate accepted classes. Annotation additions via inline radio/toggle: "This class" | "Siblings" | "Descendants".
- **D-06:** Sibling/descendant scope results grouped by class in collapsible sections.
- **D-07:** Accepted classes appear in tree immediately with sparkle badge; annotation auto-generation fires on acceptance.
- **D-08:** No separate flashcard UI mode. Existing edit view populated with AI suggestions + Next/Prev navigation buttons in detail panel header.
- **D-09:** When iterating a branch, auto-suggest annotations on navigate.
- **D-10:** Properties appear as a **tab alongside the class tree**: "Classes" | "Properties" (EntityTabBar already supports this).
- **D-11:** Detail panel uses **adapted sections** for property types: "Domain" and "Range" replace "Children" for ObjectProperty.
- **D-12:** Editor header shows a **pending count badge** (e.g., "✨ 5") updating in real time. Clicking scrolls to first pending suggestion.
- **D-13:** Pending suggestions **persist in session state** until session ends.
- **D-14:** While waiting for LLM suggestions: **skeleton placeholder rows** appear in the relevant section.
- **D-15:** On LLM failure: **inline error banner** (no modal). Budget exhaustion shows existing LLMBudgetBanner.
- **D-16:** Keyboard shortcuts: Tab/Shift+Tab between suggestions, Enter to accept, Backspace/Delete to reject, E to edit. Added under "Suggestions" category.

### Claude's Discretion

- Animation/transition effects when suggestions appear or are accepted/rejected
- Exact skeleton placeholder count and sizing (UI-SPEC says 3)
- How Next/Prev navigation interacts with tree expansion state
- Whether accepted suggestions get a brief "accepted" flash before transitioning to normal rows
- Property detail panel section ordering
- Default scope selection for annotation suggestions (UI-SPEC says "This class")

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UX-01 | Every class detail panel has an inline "✨ Suggest improvements" button | `SuggestImprovementsButton` component in each `ClassDetailPanel` section header; gates on `useLLMGate` |
| UX-02 | User can walk through classes sequentially (simplified to Next/Prev per D-08) | `BranchNavigator` component in detail panel header; tree node ordering from existing `ClassTree` nodes array |
| UX-03 | User can switch between inline and iterator modes mid-session | Mode switch is navigating in/out of branch walk; no separate mode state needed — just enabling/disabling `BranchNavigator` |
| UX-04 | Each LLM suggestion has one-click accept, reject, and inline-edit-then-accept affordances | `SuggestionCard` component with three icon buttons per UI-SPEC |
| UX-05 | Accepted suggestions land in the user's draft/staging area | Accepted suggestions flow through `useAutoSave.triggerSave()` or `flushToGit()` into existing draft/session pipeline |
| UX-06 | User can see a count of pending LLM suggestions for the current session | `PendingSuggestionBadge` in editor header; backed by `useSuggestionStore` Zustand state |
| PROP-01 | User can browse the property tree separately from the class tree | `EntityTabBar` already supports "Classes" / "Properties" / "Individuals" — `PropertyTree` already exists |
| PROP-02 | User can request LLM suggestions for new ObjectProperty, DataProperty, AnnotationProperty entities | Same `POST /llm/generate-suggestions` endpoint; add property-specific suggestion type or use class pipeline with property context |
| PROP-03 | User can request LLM suggestions for property domain and range | Same endpoint with `suggestion_type="edges"` or new type; `PropertyDetailPanel` domain/range sections get suggestion slots |
| PROP-04 | Duplicate detection and validation guardrails apply to properties | Backend pipeline already runs DEDUP + VALID on all suggestions; frontend renders `duplicate_verdict` + `validation_errors` |
| PROP-05 | Properties use the same dual UX (inline + iterator) as classes | Same `SuggestionCard`, `BranchNavigator`, `PendingSuggestionBadge` components; `PropertyDetailPanel` gets same suggestion slots |

</phase_requirements>

---

## Summary

Phase 14 is a pure frontend phase. All backend infrastructure is live and verified: `POST /projects/{id}/llm/generate-suggestions` returns `GeneratedSuggestion[]` with confidence scores, provenance, validation errors, and duplicate verdicts embedded per suggestion. `POST /projects/{id}/llm/validate-entity` handles server-side validation. The frontend's job is to wire that API into a coherent suggestion UX layer on top of the existing class and property detail panels.

The primary integration challenge is state management: pending suggestions live in client-side Zustand state (not the draft store, which is for user-authored edits). A new `useSuggestionStore` is needed to track which entity currently has active suggestions, their review status (pending/accepted/rejected), and the running count for the badge. Accepted suggestions must feed into the existing `useAutoSave` flow (draft store → git flush), keeping the two pipelines cleanly separated.

The secondary challenge is the property detail panel. `PropertyDetailPanel.tsx` already exists and parses domain/range/parent data from Turtle source. Its sections need the same suggestion slot pattern as `ClassDetailPanel`, with domain/range sections receiving ObjectProperty suggestions. The `EntityTabBar` already renders "Classes | Properties | Individuals" tabs — PROP-01 is essentially already satisfied; Phase 14 just needs to ensure the Properties tab is connected and the property detail panel gets suggestion support.

**Primary recommendation:** Build `useSuggestionStore` (Zustand) as the central client-side suggestion registry, create `SuggestionCard` / `SuggestionSkeleton` / `SuggestImprovementsButton` / `PendingSuggestionBadge` / `BranchNavigator` / `SuggestionScopeToggle` / `SuggestionGroupSection` as standalone components following UI-SPEC exactly, then add suggestion slots to `ClassDetailPanel` and `PropertyDetailPanel` via the new hook `useSuggestions`.

---

## Standard Stack

### Core (all already installed — no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `zustand` | ^5.0.0 (5.0.12) | Client-side suggestion state store | Project-wide client state standard |
| `@tanstack/react-query` | ^5.62.0 (5.96.2) | Server state — generation API call with caching | Project-wide server state standard |
| `lucide-react` | ^1.7.0 (1.7.0) | `Sparkles`, `Check`, `X`, `Pencil`, `ChevronLeft`, `ChevronRight`, `Loader2` icons | Project-wide icon library |
| `@radix-ui/react-tabs` | ^1.1.0 (1.1.13) | `ClassesPropertiesTabBar` — accessible tab list | Already installed; `EntityTabBar` uses same pattern |
| `@radix-ui/react-tooltip` | ^1.1.0 | `PendingSuggestionBadge` tooltip | Already installed |
| `next` | ^16.2.2 | Framework (no changes needed) | Project framework |
| `react` | ^19.0.0 | Framework | Project framework |

**No new npm packages required for Phase 14.** All dependencies are installed.

### Test Infrastructure

| Library | Version | Purpose |
|---------|---------|---------|
| `vitest` | ^4.0.18 | Test runner |
| `@testing-library/react` | ^16.1.0 | Component/hook testing |

Test files go in `__tests__/` following existing convention. Config: `vitest.config.ts` (jsdom environment, `__tests__/**/*.test.{ts,tsx}`).

**Version verification:** All versions confirmed from `package.json` + `npm view` output. No stale training data used.

---

## Architecture Patterns

### Recommended File Structure

```
lib/
├── api/
│   └── generation.ts           # NEW — GenerateSuggestions API client + types
├── stores/
│   └── suggestionStore.ts      # NEW — Zustand store for pending suggestions
└── hooks/
    └── useSuggestions.ts       # NEW — core suggestion lifecycle hook

components/
└── editor/
    ├── suggestions/
    │   ├── SuggestionCard.tsx           # NEW
    │   ├── SuggestionSkeleton.tsx       # NEW
    │   ├── SuggestImprovementsButton.tsx # NEW
    │   ├── SuggestionScopeToggle.tsx    # NEW
    │   ├── SuggestionGroupSection.tsx   # NEW
    │   └── index.ts                     # NEW — barrel export
    ├── PendingSuggestionBadge.tsx       # NEW
    └── BranchNavigator.tsx              # NEW

__tests__/
└── lib/
    ├── stores/suggestionStore.test.ts   # NEW
    └── hooks/useSuggestions.test.ts     # NEW (or co-located)
```

**Why `components/editor/suggestions/` subdirectory:** Phase 14 creates 5+ new components all in the suggestion domain. Grouping them avoids cluttering `components/editor/` flat directory (already 25+ files). `ClassDetailPanel` and `PropertyDetailPanel` import from `@/components/editor/suggestions/`.

### Pattern 1: Suggestion Store (Zustand)

**What:** Central client-side registry of pending suggestions per entity + running count.
**When to use:** All suggestion state reads (count badge, card renders, keyboard navigation).

```typescript
// lib/stores/suggestionStore.ts
import { create } from "zustand";
import type { GeneratedSuggestion } from "@/lib/api/generation";

export type SuggestionReviewStatus = "pending" | "accepted" | "rejected";

export interface StoredSuggestion {
  suggestion: GeneratedSuggestion;
  status: SuggestionReviewStatus;
  editedValue?: string;    // Set when user edits before accepting
}

interface SuggestionStoreState {
  // keyed by entityIri + suggestionType
  suggestions: Record<string, StoredSuggestion[]>;
  // Accept/reject/edit mutations
  setSuggestions: (entityIri: string, suggestionType: string, items: GeneratedSuggestion[]) => void;
  acceptSuggestion: (entityIri: string, suggestionType: string, index: number) => void;
  rejectSuggestion: (entityIri: string, suggestionType: string, index: number) => void;
  editSuggestion: (entityIri: string, suggestionType: string, index: number, value: string) => void;
  clearSuggestions: (entityIri: string) => void;
  clearAllSuggestions: () => void;
  // Derived
  getPendingCount: () => number;
  getPendingSuggestions: (entityIri: string, suggestionType: string) => StoredSuggestion[];
  getFirstPendingRef: () => string | null;   // For badge click scroll
}
```

**Key decisions:**
- NOT persisted to localStorage (suggestions are ephemeral within a session, per D-13 they clear on session end)
- Key format: `"${entityIri}::${suggestionType}"` — matches the sections in ClassDetailPanel
- `getPendingCount()` drives `PendingSuggestionBadge` — counts only `status === "pending"` entries across all entities

### Pattern 2: Generation API Client

**What:** Frontend wrapper for `POST /projects/{id}/llm/generate-suggestions`.
**When to use:** Called by `useSuggestions` hook when user clicks "Suggest improvements".

```typescript
// lib/api/generation.ts
import { api } from "./client";

export type SuggestionType = "children" | "siblings" | "annotations" | "parents" | "edges";
export type Provenance = "llm-proposed" | "user-written" | "user-edited-from-llm";

export interface ValidationError {
  field: string;
  code: string;
  message: string;
}

export interface GeneratedSuggestion {
  iri: string;
  suggestion_type: SuggestionType;
  label: string;
  definition?: string | null;
  confidence?: number | null;        // 0-1 normalized
  provenance: Provenance;
  validation_errors: ValidationError[];
  duplicate_verdict: "pass" | "warn" | "block";
  duplicate_candidates: { iri: string; label: string; score: number }[];
  // AnnotationSuggestion extras
  property_iri?: string;
  value?: string;
  lang?: string | null;
  // EdgeSuggestion extras
  target_iri?: string;
  relationship_type?: string;
}

export interface GenerateSuggestionsRequest {
  class_iri: string;
  branch: string;
  suggestion_type: SuggestionType;
  batch_size?: number;
}

export interface GenerateSuggestionsResponse {
  suggestions: GeneratedSuggestion[];
  input_tokens: number;
  output_tokens: number;
  context_tokens_estimate?: number | null;
}

export const generationApi = {
  generateSuggestions: (
    projectId: string,
    data: GenerateSuggestionsRequest,
    token: string,
    byoKey?: string,
  ) =>
    api.post<GenerateSuggestionsResponse>(
      `/api/v1/projects/${projectId}/llm/generate-suggestions`,
      data,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          ...(byoKey ? { "X-BYO-API-Key": byoKey } : {}),
        },
      },
    ),
};
```

**Note:** `EdgeSuggestion` and `AnnotationSuggestion` are subtypes of `GeneratedSuggestion` in the backend. The frontend receives them as `GeneratedSuggestion` with optional extra fields — no discriminated union needed since `suggestion_type` already discriminates.

### Pattern 3: useSuggestions Hook

**What:** Encapsulates "request suggestions → store → render lifecycle" for one entity+section.
**When to use:** Instantiated once per suggestion-enabled section in ClassDetailPanel / PropertyDetailPanel.

```typescript
// lib/hooks/useSuggestions.ts
export interface UseSuggestionsOptions {
  projectId: string;
  entityIri: string | null;
  branch: string;
  suggestionType: SuggestionType;
  batchSize?: number;
  canUseLLM: boolean;
  accessToken?: string;
  byoKey?: string;
  onAccepted?: (suggestion: GeneratedSuggestion, editedValue?: string) => void;
}

export interface UseSuggestionsReturn {
  items: StoredSuggestion[];
  isLoading: boolean;
  error: string | null;
  request: () => Promise<void>;
  accept: (index: number) => void;
  reject: (index: number) => void;
  edit: (index: number, value: string) => void;
}
```

**Integration with accept flow:**
- `onAccepted` callback is called when user accepts a suggestion
- For class/annotation suggestions: caller (ClassDetailPanel) calls `triggerSave()` to merge accepted suggestion into edit state, then `flushToGit()` on navigate
- For property suggestions: caller (PropertyDetailPanel) calls `onUpdateProperty()` directly

### Pattern 4: Accepting Suggestions into Draft Store

**What:** Accepted suggestions must land in the existing draft/session pipeline (UX-05).
**When to use:** Every acceptance action on a `SuggestionCard`.

```typescript
// In ClassDetailPanel — onAccepted handler:
const handleAcceptSuggestion = useCallback(
  (suggestion: GeneratedSuggestion, editedValue?: string) => {
    const value = editedValue ?? suggestion.label;
    if (suggestion.suggestion_type === "annotations" && suggestion.property_iri) {
      // Merge into editAnnotations
      setEditAnnotations((prev) => [
        ...prev.filter((a) => a.property_iri !== suggestion.property_iri || ...),
        { property_iri: suggestion.property_iri, values: [...existing, { value, lang: suggestion.lang ?? "en" }] },
      ]);
    } else if (suggestion.suggestion_type === "children") {
      // children need onAddEntity — trigger add flow with pre-filled label
      onAddEntity?.(classIri);   // or a new onAddSuggestedChild callback
    }
    triggerSave();  // Write to draft store
  },
  [...]
);
```

**Critical:** Child class suggestions require the existing `onAddEntity` flow (which mints an IRI, creates the class in source). The suggestion card for a "children" type is a _proposal_ — accepting it triggers `onAddEntity` with the suggested label pre-filled. This is different from annotation suggestions which directly modify the current class's draft state.

### Pattern 5: BranchNavigator — Tree Walking

**What:** Next/Prev navigation through sibling nodes in the selected tree branch.
**When to use:** User selects a parent class, clicks "Start review" or uses keyboard shortcuts.

```typescript
// components/editor/BranchNavigator.tsx
interface BranchNavigatorProps {
  nodes: ClassTreeNode[];          // From StandardEditorLayout (existing tree state)
  selectedIri: string | null;
  onNavigate: (iri: string) => void;  // Calls selectNode() from useOntologyTree
  autoSuggestOnNavigate?: boolean;    // D-09: auto-trigger annotation suggestions
  onAutoSuggest?: (iri: string) => void;
}
```

**Implementation approach:** `BranchNavigator` finds the parent of `selectedIri` in the `nodes` array, then walks `parent.children[]`. It does NOT need to flatten the whole tree — branch walk is siblings only. `onNavigate` calls the existing `selectNode()` from `useOntologyTree`, which updates the URL param and triggers `ClassDetailPanel` to load.

**`BranchNavigator` location:** Added to `ClassDetailPanel` header via the existing `headerActions?: ReactNode` prop slot — no changes needed to the header layout.

### Pattern 6: Confidence Badge Color Coding

```typescript
// In SuggestionCard.tsx — confidence badge rendering
function confidenceBadgeClass(confidence: number | null | undefined): string {
  if (confidence === null || confidence === undefined) return "text-slate-500 bg-slate-100 dark:text-slate-400 dark:bg-slate-800";
  if (confidence >= 0.9) return "text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-900/30";
  if (confidence >= 0.7) return "text-amber-700 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30";
  return "text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-900/20";
}

function confidenceLabel(confidence: number | null | undefined): string | null {
  if (confidence === null || confidence === undefined) return null;
  return `${Math.round(confidence * 100)}%`;
}
```

### Anti-Patterns to Avoid

- **Don't embed suggestion state in ClassDetailPanel local state**: Use `useSuggestionStore` (Zustand) so `PendingSuggestionBadge` in the editor header can read count without prop drilling.
- **Don't use React Query for suggestion state**: Suggestions are ephemeral client-side state, not server cache. React Query is correct for the _generation API call_ (loading state, error handling) but not for tracking review status.
- **Don't add a generation API call inside `SuggestionCard`**: The card is a pure presenter. `useSuggestions` owns API calls; `SuggestionCard` receives data and callbacks only.
- **Don't route accepted child class suggestions directly to the draft store**: Child suggestions create new entities — they must go through `onAddEntity` flow to get IRI minting, source write, and tree update. Only annotation/parent/relationship suggestions modify an existing entity's draft.
- **Don't hardcode `branch="main"` in generation requests**: The detail panel has an active branch prop (`branch?: string`). Always pass it; fall back to `"main"` only if undefined.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Suggestion API call | Custom fetch wrapper | `generationApi.generateSuggestions()` in `lib/api/generation.ts` | Consistent error wrapping, auth headers, BYO-key routing already handled by `api.post` |
| LLM access gating | Manual role/budget checks in components | `useLLMGate(projectId, userRole)` — returns `canUseLLM`, `budgetExhausted`, `notConfigured` | Already handles all gate states including rate limits |
| Budget error UI | Custom error banner | `LLMBudgetBanner` — renders inline when `budgetExhausted=true` | Accessible, dismissible, handles 80%+/100% states |
| Tab switcher (Classes/Properties) | New tabs component | `EntityTabBar` — already renders "Classes" / "Properties" / "Individuals" tabs; `activeTab: EntityTab` controlled from layout | Already exists, accessible |
| Keyboard shortcut registration | New keydown listener | Extend `useKeyboardShortcuts(shortcuts)` — accepts `ShortcutDefinition[]` array with category field | Single listener, Monaco suppression, Radix dialog suppression, Mac compat all handled |
| Animate collapsed card | CSS custom | `transition-all duration-150 overflow-hidden max-h-0` on reject — CSS-only, no JS needed | Matches project's animate-pulse/transition-colors patterns |
| Property tree display | New tree component | `PropertyTree` — already exists at `components/editor/standard/PropertyTree.tsx`; groups into Object/Data/Annotation | Fully functional, just needs suggestion slot support |

**Key insight:** This phase is almost entirely UI assembly. Every major capability (API client, tab bar, tree, LLM gate, draft store, keyboard shortcuts) already exists. The work is wiring new presentation components (`SuggestionCard`, `SuggestionSkeleton`, etc.) into existing containers with a new Zustand store as the connective tissue.

---

## Common Pitfalls

### Pitfall 1: Children Suggestion Accept Flow
**What goes wrong:** Accepting a "children" suggestion merges it into the current class's annotation draft. The class appears accepted but no new class was created — the ontology is unchanged.
**Why it happens:** `AnnotationSuggestion` and child class suggestions both come from the generation endpoint. They look identical from the card's perspective, but their acceptance semantics differ fundamentally.
**How to avoid:** Check `suggestion.suggestion_type === "children"` in the accept handler. Route children and siblings through `onAddEntity(classIri)` (which creates a new entity) with the suggestion label pre-populated. Route annotation/parent/edge suggestions through the draft edit state.
**Warning signs:** Accepted child suggestion causes a save event but no new node appears in the tree.

### Pitfall 2: Pending Count Disconnects from Badge
**What goes wrong:** `PendingSuggestionBadge` shows 0 even when there are pending suggestions, or shows stale counts.
**Why it happens:** `PendingSuggestionBadge` is in the editor header (rendered in the layout), while suggestions live in `ClassDetailPanel`. If count is passed as a prop that bubbles up through layout, it becomes stale.
**How to avoid:** `PendingSuggestionBadge` reads `useSuggestionStore((s) => s.getPendingCount())` directly — no prop drilling. Zustand subscriptions are granular and immediate.
**Warning signs:** Badge doesn't update when user accepts/rejects cards.

### Pitfall 3: BYO API Key Not Forwarded
**What goes wrong:** BYO-key users get 403 "no LLM configured" errors even though they have a key stored.
**Why it happens:** The generation API requires `X-BYO-API-Key` header for BYO-key users. If `byoKey` isn't plumbed from `useLLMConfig` through the layout → panel → hook, it silently falls back to project key (which may be unset).
**How to avoid:** `useLLMConfig` hook is available in both layouts. Pass `byoKey` through `StandardEditorLayoutProps` and `DeveloperEditorLayoutProps` → `ClassDetailPanel` → `useSuggestions`. Pattern established by Phase 11 for other LLM calls.
**Warning signs:** BYO users see "LLM not configured" but admin users work fine.

### Pitfall 4: Keyboard Shortcut Conflict with Edit Mode
**What goes wrong:** `Enter` to accept a suggestion fires while user is typing in an annotation input (edit mode). Backspace to reject fires while editing text.
**Why it happens:** `useKeyboardShortcuts` suppresses shortcuts when `isInputElement(document.activeElement)` returns true — but only for non-`global` shortcuts. The suggestion shortcuts must NOT be marked `global`.
**How to avoid:** Register suggestion shortcuts without `global: true`. They will automatically be suppressed when an input, textarea, or contentEditable is focused. Verify with `isInputElement` logic in `useKeyboardShortcuts.ts`.
**Warning signs:** Typing a label in AnnotationRow triggers accepts/rejects on suggestion cards.

### Pitfall 5: SuggestionCard in Edit Mode Loses Focus Ring
**What goes wrong:** The inline text field for editing a suggestion has no visible focus state.
**Why it happens:** The edit-mode text field is a new element that may not inherit the project's focus ring styles from `globals.css`.
**How to avoid:** Use `focus:border-primary-500 focus:outline-hidden focus:ring-1 focus:ring-primary-500` on the edit input — exact pattern from existing `AnnotationRow` inputs. Confirmed in UI-SPEC spacing contract.

### Pitfall 6: Auto-Generate on Branch Navigate Causes Rate Limit Spam
**What goes wrong:** D-09 says auto-suggest annotations on navigate. If user clicks Next/Prev rapidly, multiple in-flight requests hit the LLM rate limiter (500/day for editors).
**Why it happens:** Each navigate event triggers a generation call. Rapid navigation = many simultaneous calls.
**How to avoid:** Debounce the auto-suggest trigger with a 800ms delay. Cancel in-flight requests when the entity IRI changes (abort controller in `useSuggestions`). Show "suggestions loading" state only after debounce fires.
**Warning signs:** 429 rate limit errors after rapid navigation.

### Pitfall 7: Duplicate Verdict "block" Suggestions Confuse Users
**What goes wrong:** A suggestion card appears but the accept button is disabled and the user doesn't know why.
**Why it happens:** The backend embeds `duplicate_verdict: "block"` in suggestions where composite score > 0.95. The card still renders (user should see it was considered), but acceptance is prevented.
**How to avoid:** When `duplicate_verdict === "block"`: disable accept button, show amber warning badge "Likely duplicate", list top `duplicate_candidates` below the card content. When `verdict === "warn"`: accept is enabled but show amber icon with tooltip.

---

## Code Examples

### SuggestionCard Component Anatomy (from UI-SPEC)

```tsx
// Source: 14-UI-SPEC.md Component Inventory
function SuggestionCard({ item, onAccept, onReject, onEdit }: SuggestionCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(item.suggestion.label);

  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 py-2",
        "dark:border-slate-700 dark:bg-slate-800/50",
        "hover:border-solid hover:border-slate-300 hover:shadow-sm",
        // Keyboard focus state handled via data-focused attribute
      )}
      role="listitem"
    >
      <Sparkles className="h-3 w-3 shrink-0 text-amber-500 mt-0.5" />
      {/* Content */}
      {isEditing ? (
        <input
          autoFocus
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          className="flex-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm
                     focus:border-primary-500 focus:outline-hidden focus:ring-1 focus:ring-primary-500
                     dark:border-slate-600 dark:bg-slate-700 dark:text-white"
        />
      ) : (
        <span className="flex-1 text-sm text-slate-700 dark:text-slate-300">{item.suggestion.label}</span>
      )}
      {/* Confidence badge */}
      {item.suggestion.confidence !== null && (
        <span className={cn("inline-flex items-center rounded-full px-1.5 py-0.5 text-xs font-medium", confidenceBadgeClass(item.suggestion.confidence))}>
          {confidenceLabel(item.suggestion.confidence)}
        </span>
      )}
      {/* Action buttons */}
      {!isEditing && (
        <>
          <button onClick={onAccept} aria-label="Accept suggestion" className="rounded-sm p-1 text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-900/20">
            <Check className="h-3.5 w-3.5" />
          </button>
          <button onClick={onReject} aria-label="Reject suggestion" className="rounded-sm p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20">
            <X className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => setIsEditing(true)} aria-label="Edit suggestion before accepting" className="rounded-sm p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700">
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </>
      )}
      {isEditing && (
        <>
          <button onClick={() => onEdit?.(editValue)} className="...">Accept</button>
          <button onClick={() => { setEditValue(item.suggestion.label); setIsEditing(false); }} className="...">Discard edit</button>
        </>
      )}
    </div>
  );
}
```

### ClassDetailPanel Section Header — Suggestion Slot Addition

```tsx
// Source: 14-UI-SPEC.md Modified Components + existing ClassDetailPanel section pattern
// In each section's header (existing flex justify-between structure):
<div className="flex items-center justify-between gap-2">
  <h3 className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
    {icon} {title}
  </h3>
  <div className="flex items-center gap-2">
    {/* Existing section actions */}
    {/* NEW: Suggest improvements button */}
    {canUseLLM && (
      <SuggestImprovementsButton
        sectionType={suggestionType}
        isLoading={isLoadingSuggestions}
        onRequest={requestSuggestions}
      />
    )}
  </div>
</div>
```

### Pending Count Badge in Editor Header

```tsx
// Source: 14-UI-SPEC.md PendingSuggestionBadge + D-12
// In StandardEditorLayout / DeveloperEditorLayout editor header action group:
import { useSuggestionStore } from "@/lib/stores/suggestionStore";

const pendingCount = useSuggestionStore((s) => s.getPendingCount());

{pendingCount > 0 && (
  <PendingSuggestionBadge
    count={pendingCount}
    onClick={scrollToFirstPendingSuggestion}
  />
)}
```

### Rejected Card Collapse Animation

```tsx
// Source: 14-UI-SPEC.md Animation Contract + existing globals.css animate pattern
<div
  className={cn(
    "transition-all duration-150 overflow-hidden",
    item.status === "rejected" ? "max-h-0 opacity-0" : "max-h-96"
  )}
>
  <SuggestionCard ... />
</div>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Global React state for editor — monolithic page component | Zustand stores per domain (draft, editor mode) + React Query for server state | Phases 1-6 (this project) | Suggestion store follows same Zustand-per-domain pattern |
| Modal dialogs for confirmations | Inline affordances with clear labels | Phase 14 design decision (D-02, UI-SPEC destructive actions) | No new modal needed for accept/reject/edit |
| Single tree for all entity types | Tab-based EntityTabBar (Classes / Properties / Individuals) | Already shipped | PROP-01 mostly already done — `EntityTabBar` is live |
| Flash of unstyled themes | Inline script in `<head>` + `applyThemeToDOM()` | Phase 1 | No impact on Phase 14; dark mode is already fully wired |

---

## Open Questions

1. **Property suggestion_type for domain/range**
   - What we know: Backend's `SuggestionType` literal is `"children" | "siblings" | "annotations" | "parents" | "edges"`. PROP-03 needs domain/range suggestions.
   - What's unclear: Should domain/range suggestions use `"edges"` type (relationship), a subtype of `"parents"`, or does the backend need a new type? The Phase 13 verification showed `edges` covers "typed relationships to other entities" — domain/range are structural relationships that could reasonably map to `edges`.
   - Recommendation: Use `suggestion_type="annotations"` for annotation property value suggestions, and `suggestion_type="edges"` for domain/range proposals (they are IRI-valued relationships). Verify with backend that `edges` prompt context works for domain/range in the planner's Wave 0. If not, flag for a minor backend extension (new `suggestion_type="domain_range"` literal) — this is a low-risk backend change.

2. **Child class suggestions — IRI minting coordination**
   - What we know: The backend mints a UUID IRI for each `GeneratedSuggestion`. When the user accepts a child class suggestion, the frontend calls `onAddEntity()` which also mints an IRI client-side via the existing IRI generation flow.
   - What's unclear: Should the frontend reuse the backend's minted IRI (from `suggestion.iri`) or let `onAddEntity` mint a fresh one?
   - Recommendation: Reuse `suggestion.iri` — it passed VALID-06 (UUID, correct namespace) already. Pass it as a pre-filled IRI hint to `onAddEntity`. Avoids double-minting and ensures the IRI that went through validation is the IRI that gets created. The planner should define an `onAddSuggestedChild(iri, label, parentIri)` callback variant or extend the existing `onAddEntity` signature.

3. **BranchNavigator scope definition**
   - What we know: D-08 says "Next/Prev navigation buttons for sequential branch walking." D-09 says auto-suggest on navigate.
   - What's unclear: "Branch" means the subtree under the selected parent, not the git branch. Which set of nodes does it walk — immediate children of current node's parent, or all descendants?
   - Recommendation: Walk immediate siblings of `selectedIri` (children of `selectedIri`'s parent in the tree). This is the most predictable scope and matches the "branch" language in the requirements. Planner should specify this in the task description.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 14 is purely frontend code changes (new components, hooks, Zustand store, API client). No new external services, databases, or CLI tools are required. All runtime dependencies are already installed and verified in Standard Stack above.

---

## Validation Architecture

Nyquist validation: `workflow.nyquist_validation` key absent from `.planning/config.json` → treat as enabled.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 + @testing-library/react 16.1.0 |
| Config file | `vitest.config.ts` (project root) |
| Quick run command | `npm run test -- --run __tests__/lib/stores/suggestionStore.test.ts` |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UX-04 | SuggestionCard renders accept/reject/edit buttons; clicking changes review status | unit | `npm run test -- --run __tests__/lib/stores/suggestionStore.test.ts` | ❌ Wave 0 |
| UX-05 | Accepted suggestion lands in suggestion store with status "accepted" | unit | same | ❌ Wave 0 |
| UX-06 | `getPendingCount()` returns correct count as suggestions accepted/rejected | unit | `npm run test -- --run __tests__/lib/stores/suggestionStore.test.ts` | ❌ Wave 0 |
| UX-01 | `SuggestImprovementsButton` disabled when `canUseLLM=false` | unit | `npm run test -- --run __tests__/components/editor/suggestions/SuggestImprovementsButton.test.tsx` | ❌ Wave 0 |
| PROP-01 | `EntityTabBar` renders "Classes" and "Properties" tabs (already tested by existing patterns) | smoke | `npm run test` | ✅ (EntityTabBar renders via existing test coverage) |

### Sampling Rate

- **Per task commit:** `npm run test -- --run __tests__/lib/stores/suggestionStore.test.ts __tests__/lib/hooks/useSuggestions.test.ts`
- **Per wave merge:** `npm run test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `__tests__/lib/stores/suggestionStore.test.ts` — covers UX-05, UX-06 (store mutations, `getPendingCount`)
- [ ] `__tests__/lib/hooks/useSuggestions.test.ts` — covers useSuggestions loading/error/accept/reject states
- [ ] `__tests__/lib/api/generation.test.ts` — covers `generationApi.generateSuggestions()` request shape

*(No framework install needed — Vitest already configured)*

---

## Sources

### Primary (HIGH confidence)

- Direct file reads — `components/editor/ClassDetailPanel.tsx`, `PropertyDetailPanel.tsx`, `lib/stores/draftStore.ts`, `lib/hooks/useAutoSave.ts`, `lib/hooks/useKeyboardShortcuts.ts`, `lib/hooks/useLLMGate.ts`, `lib/api/llm.ts`, `lib/api/suggestions.ts`, `components/editor/standard/PropertyTree.tsx`, `components/editor/standard/EntityTabBar.tsx`, `components/editor/standard/AnnotationRow.tsx`, `lib/hooks/useSuggestionSession.ts`
- `14-CONTEXT.md` — locked decisions D-01 through D-16
- `14-UI-SPEC.md` — visual/interaction contract for all new components
- `.planning/phases/13-validation-guardrails-suggestion-generation/13-VERIFICATION.md` — backend API confirmed live, all 17 truths verified
- `../ontokit-api/ontokit/schemas/generation.py` — authoritative API response schema
- `package.json` + `npm view` — verified dependency versions

### Secondary (MEDIUM confidence)

- `vitest.config.ts` + `__tests__/` directory inspection — test infrastructure confirmed

### Tertiary (LOW confidence)

- None — all critical findings verified from source

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified from `package.json` + `npm view`
- Backend API contract: HIGH — verified from `generation.py` Pydantic schemas + Phase 13 verification report
- Architecture patterns: HIGH — derived from existing code patterns (ClassDetailPanel, draftStore, useLLMGate, useSuggestionSession)
- Component UI spec: HIGH — 14-UI-SPEC.md is a detailed verified contract
- Pitfalls: MEDIUM — derived from code structure analysis + integration reasoning; 2 pitfalls from direct code reading (keyboard suppression, children vs annotation accept routing)

**Research date:** 2026-04-07
**Valid until:** 2026-05-07 (stable framework stack, 30-day window)

---

## Project Constraints (from CLAUDE.md)

Directives extracted from `/home/damienriehl/Coding Projects/ontokit-web/CLAUDE.md` (project) + `~/.claude/CLAUDE.md` (global):

| Constraint | Source | Applies to Phase 14 |
|------------|--------|---------------------|
| Dev server port: 53000 (not 3000) | MEMORY.md | Testing/visual verification |
| Use `./ontokit-web.sh start` for dev server | Project CLAUDE.md | Visual verification |
| Dark mode: Tailwind class-based (`darkMode: "class"`) | MEMORY.md | All new components must include `dark:` variants |
| React Query for server state, Zustand for client state | MEMORY.md | `generationApi` call uses React Query loading state; suggestion review status uses Zustand |
| Use MCP chrome-devtools for every visual check | Global CLAUDE.md | Visual verification of suggestion cards |
| No new npm dependencies without approval | Global CLAUDE.md | Confirmed: Phase 14 needs no new packages |
| Run test suite after code changes (automatic) | Global CLAUDE.md | Executor runs `npm run test` after each task |
| Frontend: apply frontend-design skill | Global CLAUDE.md | Not applicable — UI-SPEC is already locked and overrides; follow UI-SPEC exactly |
