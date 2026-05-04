# Phase 15: Session Clustering & Batch Submit - Research

**Researched:** 2026-04-07
**Domain:** Frontend — shard preview modal, clustering API client, batch submit flow, drag-and-drop entity management (Next.js 15 / React 19 / TypeScript)
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Clustering Algorithm**
- **D-01:** Dynamic density-based splitting — auto-detect the deepest taxonomy level where PRs stay under the ~10 shard / ~50 suggestion threshold. No fixed depth.
- **D-02:** Cross-cutting changes auto-form own shard in the best-fit PR. No user prompt during clustering — preview shows the result.
- **D-03:** Small sessions skip clustering — if total suggestions ≤ threshold (≤5), skip clustering and create one PR with one commit. Falls back to current single-PR submit.
- **D-04:** Tie-breaking: larger shard wins when a suggestion belongs to two subtrees equally.

**Shard Preview UX**
- **D-05:** Nested tree layout in a full-screen modal — two-level tree: PR groupings (outer, collapsible) → shard-commits (inner) → entity list. Modal pattern matches EntityGraphModal.
- **D-06:** Both drag-and-drop (primary) + buttons (accessibility fallback) — drag entities between shards, drag shards between PRs; ⋮ menu with Merge/Split; "Move to..." dropdown on entity rows.
- **D-07:** Entity names + counts per shard — collapsible entity local names list. No inline diffs.
- **D-08:** No title/message renaming — PR titles and commit messages are auto-generated. User adds optional notes/descriptions.
- **D-09:** Top summary bar — "12 suggestions → 4 shards → 2 PRs" at modal top.

**Git Mechanics**
- **D-10:** Hybrid commit messages — human-readable subject with ancestor path + structured metadata in body (shard #, total shards, ancestor path, entity count, session ID, provenance).
- **D-11:** Branch naming: `suggest/{user}/{timestamp}` with PR index suffix for multi-PR sessions.
- **D-12:** PR body: auto-generated summary + full entity list + user-added notes.
- **D-13:** Session branch cleanup: delete after all PRs resolved (merged or rejected).
- **D-14:** PR branches from current main — clean diff, no cross-shard pollution. Backend assembles Turtle source per shard.
- **D-15:** Parallel PR creation with conflict check — serialize only if two PRs touch the same file.

**Submit Flow Lifecycle**
- **D-16:** Server-side clustering — backend computes ancestor paths and returns shard assignments via single API call.
- **D-17:** Step-by-step progress bar — "Clustering..." → "Creating branch 1/3..." → "Opening PR 1/3..." → "Done".
- **D-18:** Partial success + retry failed — show which PRs succeeded (with links) and which failed; "Retry failed" button.
- **D-19:** Success summary with PR links — completion screen with per-PR links, shard counts, "Done" button.

### Claude's Discretion

- Exact threshold for "small session" clustering bypass (suggested ≤5, tunable)
- Animation/transition effects in the shard preview modal
- Exact ELK/layout algorithm for nested tree rendering
- How the progress bar integrates with the modal (inline vs overlay)
- Conflict check implementation details (file-level vs line-level)
- Whether the summary bar animates as shards are adjusted

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CLUSTER-01 | System auto-clusters session suggestions by common class ancestor | Backend `POST /cluster` endpoint returns shard assignments; frontend reads `useSuggestionStore` accepted suggestions and maps entity IRIs + parent IRIs as input |
| CLUSTER-02 | Shards have max size of 50 items; shards exceeding this split at next taxonomy level | Backend clustering enforces this; preview modal shows the result and allows manual adjustment |
| CLUSTER-03 | Shards have min size of 3; smaller orphans roll into "Miscellaneous improvements" shard | Backend enforces min-3 rule; "Miscellaneous improvements" is a reserved shard label in the frontend data model |
| CLUSTER-04 | Cross-cutting changes that don't fit one ancestor form their own shard | Backend assigns cross-cutting entities to their own shard; preview shows them as a distinct top-level shard |
| CLUSTER-05 | Each suggestion appears in exactly one shard (no cross-posting) | `ShardPreviewState` Zustand slice ensures each suggestion IRI appears in exactly one shard — enforced client-side when user moves entities, and validated by backend before batch-submit |
| CLUSTER-06 | At submit time, user sees a preview tree of proposed shards; can merge/split/rename | `ShardPreviewModal` full-screen component with nested PR/shard/entity tree; Merge/Split via ⋮ menus and drag-and-drop |
| CLUSTER-07 | Each shard becomes one commit; shards grouped into PRs by subtree branch (1-N PRs) | `POST /batch-submit` receives the approved shard plan; backend creates one commit per shard, grouped by PR |
| CLUSTER-08 | PRs split when exceeding ~10 shards or ~50 suggestions; cross-cutting shards attach to best-fit PR | Backend enforces splits; preview shows result which user can adjust |
| CLUSTER-09 | Reviewer approves/rejects per-PR; GitHub's commit tab serves as shard navigator | PR creation uses one commit per shard; no additional frontend work needed — GitHub commit tab delivers this natively |

</phase_requirements>

---

## Summary

Phase 15 is primarily a **frontend orchestration phase** — the backend's ancestor path queries already exist (`OntologyIndexService.get_ancestor_path()` via SQL CTE), and the existing `suggestionsApi.submit()` will be extended into `suggestionsApi.cluster()` + `suggestionsApi.batchSubmit()`. The frontend's job is: (1) intercept the submit button, (2) call the cluster endpoint, (3) show the shard preview modal, (4) let the user adjust the shard plan, and (5) call the batch-submit endpoint with the approved plan.

The centerpiece component is `ShardPreviewModal` — a full-screen modal (pattern cloned from `EntityGraphModal`) containing a nested two-level interactive tree. The drag-and-drop library (`@dnd-kit/core` ^6.3.1) is already installed and in active use for the class tree. The shard preview tree uses a different interaction model (move entities between shards, move shards between PR groups) but the same sensor infrastructure. `@dnd-kit/sortable` is NOT currently installed — it is needed for the sortable entity lists within shards and is the only new dependency required by this phase.

The submit flow intercept lives in `app/projects/[id]/editor/page.tsx`. The existing `submitSession()` call in the "Submit Suggestions" button handler must be gated behind a clustering check: if `changesCount > SMALL_SESSION_THRESHOLD`, open the shard preview modal instead of the current `SuggestionSubmitDialog`. The current `SuggestionSubmitDialog` is repurposed or retired — its notes/summary field moves into the shard preview modal.

State management uses a new ephemeral Zustand slice (`useShardPreviewStore`) that holds the mutable shard plan returned by the cluster endpoint. Mutations (merge, split, move entity) are applied locally in the store, then the final plan is serialized to the `batchSubmit` API call.

**Primary recommendation:** Build the `useShardPreviewStore` Zustand slice and `suggestionsApi.cluster()` + `suggestionsApi.batchSubmit()` API client first (Wave 1), then the `ShardPreviewModal` with the static tree layout (Wave 2), then wire drag-and-drop + button interactions (Wave 3), then integrate into the editor submit flow (Wave 4).

---

## Project Constraints (from CLAUDE.md)

| Directive | Impact on This Phase |
|-----------|---------------------|
| `npm run dev` / `npm run test` / `npm run lint` / `npm run type-check` — standard commands | Wave 0 must ensure `npm run test -- --run` passes before any implementation |
| NextAuth.js v5 / `session.accessToken` for all API calls | `suggestionsApi.cluster()` and `suggestionsApi.batchSubmit()` must pass `Authorization: Bearer {token}` |
| React Query for server state, Zustand for client state | Shard plan is client-side ephemeral state → Zustand. PR creation results are server state → React Query mutation or plain async |
| `next/dynamic` for lazy-loaded heavy components | `ShardPreviewModal` must use `dynamic()` import — it's a large component with DnD context |
| Dark mode: Tailwind `class`-based (`darkMode: "class"`) | All new components need `dark:` variants |
| Accessibility: `role="dialog"` + `aria-modal` for modal components | `ShardPreviewModal` needs proper ARIA; merge/split buttons need `aria-label` |
| Add new dependencies only with explicit approval | `@dnd-kit/sortable` is the one new dependency this phase requires — flag for approval in Wave 0 plan |

---

## Standard Stack

### Core (Already Installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@dnd-kit/core` | ^6.3.1 | Drag-and-drop context, sensors, events | Already used in class tree (`DraggableTreeWrapper`) — same patterns apply |
| `zustand` | ^5.0.0 | Ephemeral shard plan state | Project-standard for all client state; non-persisted store pattern established in Phase 14 |
| `@tanstack/react-query` | ^5.62.0 | Cluster/batch-submit API mutations | Project-standard for server state; `useMutation` for submit lifecycle |
| `lucide-react` | ^1.7.0 | Icons: GitBranch, Split, Merge, Check, Loader2, ChevronDown | Project-standard icon set |
| `next/dynamic` | bundled | Lazy-load `ShardPreviewModal` | Required for full-screen heavy components; matches `EntityGraphModal` pattern |

[VERIFIED: package.json inspection]

### New Dependency Required

| Library | Version | Purpose | Requires Approval |
|---------|---------|---------|-------------------|
| `@dnd-kit/sortable` | ^8.0.0 | Sortable entity lists within shards; `SortableContext` + `useSortable` | YES — not yet installed |

**Why `@dnd-kit/sortable` specifically:** The shard preview modal needs two kinds of DnD interaction: (1) free drag of entities between arbitrary shards (possible with `@dnd-kit/core` alone using `useDraggable` + `useDroppable`), and (2) ordered entity list display and potential reordering within a shard (needs `SortableContext` from `@dnd-kit/sortable`). Without sortable, implementing ordered drop-target highlighting requires significant custom logic that `@dnd-kit/sortable` provides out of the box. [ASSUMED — no alternative sortable approach verified against `@dnd-kit/core` alone]

**Alternative if `@dnd-kit/sortable` is not approved:** Use `@dnd-kit/core` only with custom ordered insertion logic. Increases implementation complexity but avoids a new dependency. The button-fallback interactions (⋮ menu Merge/Split) work with `@dnd-kit/core` alone and are fully accessible.

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@dnd-kit/utilities` | ^3.2.2 | `CSS.Transform.toString()` for drag transform | Already installed; use in `useSortable` items |
| `@radix-ui/react-dropdown-menu` | ^2.1.0 | ⋮ menu for Merge/Split/Move actions | Already installed; used in existing context menus |
| `@radix-ui/react-dialog` | ^1.1.0 | NOT used for `ShardPreviewModal` (full-screen uses fixed overlay) | Already installed; use only for the per-shard note textarea if detached |

[VERIFIED: package.json inspection]

**Installation (pending approval):**
```bash
npm install @dnd-kit/sortable
```

**Version verification:** `@dnd-kit/sortable` latest is 8.x as of 2026. [ASSUMED — not verified via npm registry in this session; executor should run `npm view @dnd-kit/sortable version` before installing]

---

## Architecture Patterns

### Recommended Project Structure (New Files)

```
lib/
├── stores/
│   └── shardPreviewStore.ts       # Ephemeral Zustand slice for mutable shard plan
├── api/
│   └── suggestions.ts             # EXTENDED: cluster() + batchSubmit() methods added
├── hooks/
│   └── useShardDragDrop.ts        # DnD logic for entity-between-shards + shard-between-PRs

components/
└── suggestions/
    ├── ShardPreviewModal.tsx       # Full-screen modal orchestrator (dynamic import target)
    ├── ShardPreviewSummaryBar.tsx  # "12 suggestions → 4 shards → 2 PRs" bar
    ├── ShardPreviewPRGroup.tsx     # Collapsible PR grouping row + shard list
    ├── ShardPreviewShardRow.tsx    # Individual shard row with entity count + collapse
    ├── ShardPreviewEntityList.tsx  # Sortable entity list within a shard
    └── ShardSubmitProgressBar.tsx  # Multi-step progress: cluster → branches → PRs → done

__tests__/
└── lib/
    ├── stores/
    │   └── shardPreviewStore.test.ts   # Wave 0 stub
    ├── api/
    │   └── clusterApi.test.ts          # Wave 0 stub
    └── hooks/
        └── useShardDragDrop.test.ts    # Wave 0 stub
```

### Pattern 1: Ephemeral Shard Plan Store (Zustand, Non-Persisted)

**What:** Zustand store that holds the mutable shard plan — the result of the cluster API call, modified by user drag/merge/split actions. Cleared on modal close or successful submit.

**When to use:** Any time the frontend needs to represent a complex mutable tree that the user edits before submitting to the server. Non-persisted (no localStorage) because shard plans are ephemeral — exactly like `useSuggestionStore` from Phase 14.

**Key design:**
- Shard plan is a flat `Record<shardId, ShardDefinition>` (not a nested tree) — easier to mutate atomically
- PR groups are a `Record<prId, { shardIds: string[] }>` — shards reference their shard IDs
- Moving an entity: remove from source shard's `entityIris`, add to target shard's `entityIris` in one immer update
- Merging shards: combine `entityIris`, delete source shard, update PR group's `shardIds`
- Splitting a shard: create new shard with a subset of `entityIris`, update PR group

**Example shape:**
```typescript
// Source: established Zustand non-persist pattern from Phase 14 (lib/stores/suggestionStore.ts)
export interface ShardDefinition {
  id: string;                    // e.g., "shard-contract-law-commercial"
  label: string;                 // e.g., "Contract Law > Commercial Contracts"
  ancestorPath: string[];        // ["Contract Law", "Commercial Contracts"]
  entityIris: string[];          // IRIs of suggestions assigned here
  isMisc: boolean;               // true = "Miscellaneous improvements" shard
}

export interface PRGroupDefinition {
  id: string;                    // e.g., "pr-1"
  shardIds: string[];            // ordered list
  suggestionCount: number;       // cached sum; recomputed on shard mutations
}

interface ShardPreviewState {
  prGroups: Record<string, PRGroupDefinition>;
  shards: Record<string, ShardDefinition>;
  prGroupOrder: string[];        // ordered PR group IDs for stable rendering
  // Mutations
  moveEntity: (entityIri: string, fromShardId: string, toShardId: string) => void;
  mergeShards: (sourceId: string, targetId: string) => void;
  splitShard: (shardId: string, entityIris: string[], newLabel: string) => void;
  moveShard: (shardId: string, fromPrId: string, toPrId: string) => void;
  setFromClusterResponse: (response: ClusterResponse) => void;
  clear: () => void;
}
```

### Pattern 2: Cluster + Batch Submit API Extension

**What:** Two new methods added to `suggestionsApi` in `lib/api/suggestions.ts`.

**When to use:** Phase 15 only — these are the backend interfaces for the new clustering and batch PR creation features.

```typescript
// Source: pattern follows existing suggestionsApi in lib/api/suggestions.ts

export interface ClusterRequest {
  session_id: string;
  suggestion_items: ClusterSuggestionItem[];  // entity_iri + parent_iri + suggestion_type
}

export interface ClusterSuggestionItem {
  entity_iri: string;
  parent_iri?: string | null;
  suggestion_type: string;
  label: string;
}

export interface ClusterResponse {
  pr_groups: ClusterPRGroup[];
  total_suggestions: number;
  total_shards: number;
  total_prs: number;
  skip_clustering: boolean;  // true when session is small (≤5 suggestions)
}

export interface ClusterPRGroup {
  id: string;
  shards: ClusterShard[];
}

export interface ClusterShard {
  id: string;
  label: string;
  ancestor_path: string[];
  entity_iris: string[];
  is_misc: boolean;
}

export interface BatchSubmitRequest {
  session_id: string;
  pr_groups: BatchSubmitPRGroup[];
  notes?: string;
}

export interface BatchSubmitPRGroup {
  shards: BatchSubmitShard[];
}

export interface BatchSubmitShard {
  id: string;
  label: string;
  entity_iris: string[];  // the approved (possibly user-adjusted) assignment
}

export interface BatchSubmitResponse {
  results: BatchSubmitPRResult[];
  succeeded: number;
  failed: number;
}

export interface BatchSubmitPRResult {
  pr_group_index: number;
  pr_number?: number;
  pr_url?: string | null;
  github_pr_url?: string | null;
  status: "success" | "failed";
  error?: string | null;
}
```

### Pattern 3: Full-Screen Modal (EntityGraphModal Clone)

**What:** `ShardPreviewModal` uses the same fixed-overlay pattern as `EntityGraphModal` — fixed inset-0, z-[60], dark background, rounded container, header/body/footer layout.

**When to use:** Any full-screen modal in this project. The pattern is established and tested.

**Key difference from EntityGraphModal:** `ShardPreviewModal` has three internal phases — (a) preview + adjust, (b) submitting with progress bar, (c) completion summary. It uses local `useState` to track phase, not routing.

```typescript
// Source: components/graph/EntityGraphModal.tsx — clone the outer shell
// Full-screen overlay structure:
<div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
  <div className="flex h-[97vh] w-[98vw] flex-col overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-slate-900">
    {/* Header: summary bar + close button */}
    {/* Body: scrollable nested PR/shard/entity tree */}
    {/* Footer: Notes textarea + Submit / Cancel buttons */}
  </div>
</div>
```

### Pattern 4: Submit Flow Intercept in Editor Page

**What:** The "Submit Suggestions" button in `page.tsx` currently opens `SuggestionSubmitDialog`. For large sessions (changesCount > threshold), it must instead open `ShardPreviewModal`.

**Integration point:**
```typescript
// In app/projects/[id]/editor/page.tsx
// EXISTING button handler:
onClick={() => setSubmitDialogOpen(true)}

// BECOMES:
onClick={() => {
  if (suggestionSession.changesCount > SMALL_SESSION_THRESHOLD) {
    setShardPreviewOpen(true);  // opens ShardPreviewModal
  } else {
    setSubmitDialogOpen(true);  // existing single-PR flow unchanged
  }
}}
```

`ShardPreviewModal` receives `sessionId`, `accessToken`, `projectId`, and the accepted suggestion items from `useSuggestionStore`. On successful batch submit, it calls `onBatchSubmitted(results)` which resets session state just like the existing `onSubmitted` callback.

### Pattern 5: Drag-and-Drop in Shard Preview

**What:** Two distinct DnD interactions — entity rows draggable between shards, shard rows draggable between PR groups.

**Uses `@dnd-kit/core`** for all drag context and custom droppable shard containers.
**Uses `@dnd-kit/sortable`** (new dep) for the ordered entity list within each shard — `SortableContext` wraps the entity list, each entity uses `useSortable`.

**Drag data convention** (matching existing `useTreeDragDrop` pattern):
```typescript
// useDraggable/useSortable data payload
type ShardDragData =
  | { type: "entity"; entityIri: string; fromShardId: string }
  | { type: "shard"; shardId: string; fromPrId: string };
```

**Drop handlers** call `shardPreviewStore.moveEntity()` / `shardPreviewStore.moveShard()` on `onDragEnd`.

### Anti-Patterns to Avoid

- **Nested DndContext:** Do NOT nest a `DndContext` inside the existing `DraggableTreeWrapper`. The `ShardPreviewModal` is a full-screen overlay portal — it has its own `DndContext` that does not interfere with the tree's `DndContext`.
- **Persisting shard plan to localStorage:** The shard plan is ephemeral — it exists only during the preview session. Do NOT add it to `localStorage` via Zustand persist middleware.
- **Calling `submitSession()` after clustering:** Once clustering is used, `submitSession()` is bypassed. Only `batchSubmit()` creates PRs. The two code paths must not both run.
- **Mutation in cluster response objects:** The cluster response from the API should be treated as immutable. Copy into the `shardPreviewStore` immediately via `setFromClusterResponse()` and mutate only the store.
- **Blocking UI during PR creation:** The progress bar must be displayed during `batchSubmit()`. Do NOT make the submit button a blocking spinner — show inline step progress inside the modal.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Drag between arbitrary containers | Custom HTML5 drag events | `@dnd-kit/core` `useDraggable` + `useDroppable` | Already proven in class tree; handles pointer + keyboard sensors, accessibility, collision detection |
| Sortable reordering within a shard | Custom sort logic + mouse position tracking | `@dnd-kit/sortable` `SortableContext` + `useSortable` | Handles insertion point detection, auto-scroll, animation |
| Scroll-locking during drag | `overflow: hidden` toggling | `@dnd-kit/core` built-in — already handled | Avoids scroll-jump bugs |
| Collapsible tree nodes | Custom toggle state management | Zustand `expandedPrIds: Set<string>` / `expandedShardIds: Set<string>` in `shardPreviewStore` | Trivial in Zustand; consistent with tree state pattern |

---

## Common Pitfalls

### Pitfall 1: Shard Plan Constructed Client-Side From Store State Drift

**What goes wrong:** The cluster response returns entity IRIs. If the `useSuggestionStore` has stale accepted suggestions (e.g., user accepted something AFTER clicking "Submit"), the cluster input may be out of sync with what's in the store.

**Why it happens:** `useSuggestionStore` is mutable until the moment the cluster call fires. If the user accepts a suggestion while the cluster response is loading, the store and the response diverge.

**How to avoid:** Snapshot the accepted suggestions at the moment the "Submit Suggestions" button is clicked — capture the array BEFORE the `cluster()` API call is made. Pass the snapshot to both `cluster()` and `ShardPreviewModal`. Do not re-read from the store after that.

**Warning signs:** Missing entities in shard preview despite being in the accepted suggestions list.

### Pitfall 2: CLUSTER-05 Violation After User Drag

**What goes wrong:** User drags an entity from one shard to another. If `moveEntity()` is not atomic, the entity can appear in both shards simultaneously.

**Why it happens:** Non-atomic state updates in Zustand — if `moveEntity` does a `set` for removal and a separate `set` for addition.

**How to avoid:** The `moveEntity()` action must use a single `set()` call that atomically removes the entity from the source shard and adds it to the target shard in one immer-style update. Verify via unit test that the entity only appears once post-move.

**Warning signs:** `batchSubmit` backend returns a 400 "duplicate entity" error.

### Pitfall 3: `@dnd-kit/core` DndContext Nesting

**What goes wrong:** `ShardPreviewModal` is rendered inside `page.tsx`, which renders `DraggableTreeWrapper` (with its own `DndContext`). Nested `DndContext` causes drag events to be captured by the parent context.

**Why it happens:** `ShardPreviewModal` is inside the component tree below `page.tsx`. If it renders its own `DndContext` inline (not via portal), the parent's context intercepts drag events.

**How to avoid:** Render `ShardPreviewModal` as a `fixed inset-0` portal via `createPortal(document.body)`, or ensure the modal's DndContext is rendered at the same level as `DraggableTreeWrapper` (sibling, not child). Verify that tree DnD is disabled/blocked when the modal is open (pointer events on tree are irrelevant while modal is full-screen).

**Warning signs:** Dragging an entity row in the shard preview causes the class tree to highlight drop targets.

### Pitfall 4: `next/dynamic` and Suspense in the Modal Import Chain

**What goes wrong:** `ShardPreviewModal` is dynamically imported in `page.tsx`. If the modal has its own `lazy` imports inside (e.g., a diff viewer), the loading fallback chain can produce a blank white box.

**Why it happens:** `next/dynamic` without `ssr: false` can fail in some RSC contexts; nested `Suspense` in a dialog can produce empty-container flashes.

**How to avoid:** Use `dynamic(import('...'), { ssr: false, loading: () => <SpinnerFallback /> })`. The modal is client-only. Include a full-height spinner fallback that matches the modal chrome dimensions.

### Pitfall 5: Small Session Bypass Not Propagated to resubmitSession

**What goes wrong:** `resubmitSession()` (for resumed sessions with changes-requested) bypasses the clustering gate because the submit flow only checks `changesCount > threshold` for the initial submit. A resumed session with many changes goes through the old single-PR path.

**Why it happens:** `resubmitSession` shares the same button as `submitSession` but has different routing logic. The clustering gate is only wired for `submitSession`.

**How to avoid:** Apply the same `changesCount > threshold` gate to the resubmit path. The `ShardPreviewModal`'s `onBatchSubmitted` callback must call `resubmitSession` semantics (increment revision, not create new session) when `isResumed` is true. The batch-submit API endpoint must accept an `is_resubmit` flag or the session state must route correctly.

**Warning signs:** Resumed large sessions create a new PR instead of updating the existing one.

---

## Code Examples

### Cluster API Call (from editor page)

```typescript
// Source: pattern follows lib/api/suggestions.ts existing methods
// Called when changesCount > SMALL_SESSION_THRESHOLD

const clusterInput: ClusterRequest = {
  session_id: sessionId,
  suggestion_items: acceptedSuggestions.map((s) => ({
    entity_iri: s.suggestion.iri,
    parent_iri: s.suggestion.parent_iri ?? null,
    suggestion_type: s.suggestion.suggestion_type,
    label: s.suggestion.label,
  })),
};

const clusterResult = await suggestionsApi.cluster(projectId, clusterInput, accessToken);

if (clusterResult.skip_clustering) {
  // Fall through to existing single-PR submit
  setSubmitDialogOpen(true);
} else {
  shardPreviewStore.setFromClusterResponse(clusterResult);
  setShardPreviewOpen(true);
}
```

### EntityGraphModal Shell (reference pattern for ShardPreviewModal)

```typescript
// Source: components/graph/EntityGraphModal.tsx (verified via file read)
// The modal uses:
<div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
  <div className="flex h-[97vh] w-[98vw] flex-col overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-slate-900">
    {/* Header with title + Esc close button */}
    {/* Body (flex-1 overflow-hidden) */}
  </div>
</div>
// Escape key handled via useEffect + document.addEventListener("keydown")
```

### Atomic moveEntity (Zustand store)

```typescript
// Source: pattern follows Phase 14 lib/stores/suggestionStore.ts atomic set() calls
moveEntity: (entityIri, fromShardId, toShardId) => {
  set((state) => {
    const shards = { ...state.shards };
    const from = { ...shards[fromShardId] };
    const to = { ...shards[toShardId] };
    from.entityIris = from.entityIris.filter((iri) => iri !== entityIri);
    to.entityIris = [...to.entityIris, entityIri];
    return {
      shards: { ...shards, [fromShardId]: from, [toShardId]: to },
    };
  });
},
```

### DndContext Setup for Shard Preview

```typescript
// Source: components/editor/shared/DraggableTreeWrapper.tsx (verified via file read)
// Reuse same sensor config — PointerSensor with distance:8 activation constraint
const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 8 } });
const keyboardSensor = useSensor(KeyboardSensor);
const sensors = useSensors(pointerSensor, keyboardSensor);
// onDragEnd handler reads event.active.data.current and event.over?.id
// to determine what moved where, then calls store actions
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `suggestionsApi.submit()` → single PR | `suggestionsApi.cluster()` + `suggestionsApi.batchSubmit()` → N PRs | Phase 15 | Submit button opens clustering gate instead of direct `SuggestionSubmitDialog` |
| `SuggestionSubmitDialog` for all sessions | `SuggestionSubmitDialog` for small sessions only (≤5 suggestions); `ShardPreviewModal` for large sessions | Phase 15 | The two paths coexist; routing is by `changesCount > threshold` |
| `useSuggestionSession.submitSession()` directly called from editor | `submitSession()` called only for small sessions; `batchSubmit()` path replaces it for large sessions | Phase 15 | `useSuggestionSession` hook needs `batchSubmitSession()` method (or the modal handles API calls directly) |

**Nothing deprecated by this phase** — `submitSession()` and the existing `SuggestionSubmitDialog` are KEPT for the small-session bypass path.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@dnd-kit/sortable` version is 8.x and compatible with existing `@dnd-kit/core` ^6.3.1 | Standard Stack | Version mismatch; executor must run `npm view @dnd-kit/sortable version` before installing |
| A2 | Backend `OntologyIndexService.get_ancestor_path()` can be adapted to accept a batch of entity IRIs for clustering in a single call | Architecture Patterns / API Extension | If batch query doesn't exist, backend must be updated (this is backend work outside frontend scope) |
| A3 | The backend `batchSubmit` endpoint creates one GitHub PR per PR group (not one per shard) | Architecture Patterns | If backend creates one PR per shard, frontend PR group model needs rework |
| A4 | `useSuggestionStore` stores the `parent_iri` needed for clustering input alongside each accepted suggestion | Pitfall 1 | If `parent_iri` is not stored, the cluster API input is incomplete — would require a separate API lookup or re-fetch from the tree |

**A4 requires immediate verification.** Looking at `lib/stores/suggestionStore.ts` and `lib/api/generation.ts`, the `GeneratedSuggestion` type has `iri` (the entity's own IRI) but does NOT have an explicit `parent_iri` field. The clustering API needs to know which class is the parent of each accepted suggestion. Two options:
- Option A: Add `parentIri` to `StoredSuggestion` at accept time (captured from the `entityIri` the suggestion was accepted under)
- Option B: Backend clustering derives parent from the session's Turtle content (already committed to the suggestion branch) rather than requiring the frontend to pass it

**Recommendation:** Option A — the frontend already knows `entityIri` (the parent class context) when the user accepts a suggestion. Store it in `StoredSuggestion` at acceptance time in Phase 15's Wave 0 store update.

---

## Open Questions

1. **Does `useSuggestionStore` capture parent context?**
   - What we know: `StoredSuggestion` has `suggestion.iri` (the new entity IRI) but not the parent class IRI it was suggested under
   - What's unclear: Whether backend clustering can derive parent from the session branch alone, or needs it from frontend
   - Recommendation: Add `parentIri?: string` to `StoredSuggestion` and capture it when calling `acceptSuggestion(entityIri, suggestionType, index)` — `entityIri` in the store key IS the parent class IRI (the class the suggestion was generated for)

2. **Resubmit + clustering interaction**
   - What we know: `resubmitSession()` currently calls `suggestionsApi.resubmit()` which updates an existing PR. With batch submit, a resumed session may produce multiple new PRs vs updating the old ones.
   - What's unclear: Whether the backend's `resubmit` endpoint can handle multi-PR batch mode, or if resumed sessions always go through the single-PR path
   - Recommendation: For Phase 15, treat resumed sessions as small-session bypass (always use `resubmitSession()` regardless of count). Clustering is for first-time submits only. Revisit in Phase 16 if needed.

3. **`@dnd-kit/sortable` approval**
   - What we know: It is the standard DnD kit companion for ordered lists. Not currently installed.
   - What's unclear: Whether the project owner approves the dependency
   - Recommendation: Plan Wave 0 to include a "Flag new dependency" step. If not approved, implement the ordered entity list using `@dnd-kit/core` `useDraggable`/`useDroppable` with custom insertion index detection.

---

## Environment Availability

Step 2.6: SKIPPED — this phase adds new source files and extends existing API clients. No external runtimes, databases, or CLI tools beyond the already-verified Next.js dev stack are required.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^4.0.18 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npm run test -- --run` |
| Full suite command | `npm run test -- --run --coverage` |

[VERIFIED: vitest.config.ts + package.json inspection]

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CLUSTER-01 | `setFromClusterResponse()` populates shard plan from cluster API response | unit | `npm run test -- --run __tests__/lib/stores/shardPreviewStore.test.ts` | ❌ Wave 0 |
| CLUSTER-02 | No shard in plan has `entityIris.length > 50` after cluster response | unit | `npm run test -- --run __tests__/lib/stores/shardPreviewStore.test.ts` | ❌ Wave 0 |
| CLUSTER-03 | No non-misc shard has `entityIris.length < 3` after cluster response | unit | `npm run test -- --run __tests__/lib/stores/shardPreviewStore.test.ts` | ❌ Wave 0 |
| CLUSTER-04 | Cross-cutting entities appear in a shard with no ancestor overlap to other shards | unit | `npm run test -- --run __tests__/lib/stores/shardPreviewStore.test.ts` | ❌ Wave 0 |
| CLUSTER-05 | After `moveEntity()`, entity IRI appears in exactly one shard | unit | `npm run test -- --run __tests__/lib/stores/shardPreviewStore.test.ts` | ❌ Wave 0 |
| CLUSTER-06 | `ShardPreviewModal` renders PR groups, shard rows, entity counts | smoke (manual) | visual verify | N/A |
| CLUSTER-07 | `batchSubmitSession()` serializes shard plan into `BatchSubmitRequest` correctly | unit | `npm run test -- --run __tests__/lib/api/clusterApi.test.ts` | ❌ Wave 0 |
| CLUSTER-08 | Large session (>10 shards) produces multiple PR groups in cluster response | unit | `npm run test -- --run __tests__/lib/stores/shardPreviewStore.test.ts` | ❌ Wave 0 |
| CLUSTER-09 | manual-only | manual | GitHub PR commit tab navigation | N/A |

### Sampling Rate

- **Per task commit:** `npm run test -- --run`
- **Per wave merge:** `npm run test -- --run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `__tests__/lib/stores/shardPreviewStore.test.ts` — covers CLUSTER-01 through CLUSTER-05, CLUSTER-08
- [ ] `__tests__/lib/api/clusterApi.test.ts` — covers CLUSTER-07
- [ ] `__tests__/lib/hooks/useShardDragDrop.test.ts` — covers drag interaction unit tests

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `Authorization: Bearer {token}` on all new API methods (`cluster`, `batchSubmit`) — same pattern as `suggestionsApi.submit()` |
| V3 Session Management | no | Shard plan is client-side ephemeral state; no new session tokens |
| V4 Access Control | yes | `cluster` and `batchSubmit` endpoints are suggester/editor-only; backend enforces role check (established in Phase 11); frontend gates on existing `isSuggestionMode` flag |
| V5 Input Validation | yes | `BatchSubmitRequest` shape validated with zod schema before sending; entity IRIs validated to be non-empty strings |
| V6 Cryptography | no | No new crypto operations |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Entity IRI injection in `BatchSubmitRequest` | Tampering | Backend validates all IRIs against session's actual suggestion content; frontend sends only IRIs from the cluster response |
| Shard plan tampering (user-modified entity list includes IRIs not in original session) | Tampering | Backend validates that all submitted entity IRIs belong to the session before creating commits |
| Large payload DoS via oversized shard plan | DoS | Max 50 entities per shard × max 10 shards × max N PRs; backend enforces payload size limit |

---

## Sources

### Primary (HIGH confidence)
- `lib/api/suggestions.ts` — verified submit/resubmit API patterns for cluster/batchSubmit extension
- `lib/stores/suggestionStore.ts` — verified StoredSuggestion shape and store key format
- `components/graph/EntityGraphModal.tsx` — verified full-screen modal pattern (fixed inset-0, z-[60], Escape handler)
- `components/editor/shared/DraggableTreeWrapper.tsx` — verified @dnd-kit/core DndContext setup with PointerSensor (distance: 8) + KeyboardSensor
- `package.json` — verified all installed dependencies and versions
- `vitest.config.ts` — verified test framework setup and include pattern
- `app/projects/[id]/editor/page.tsx` — verified submit button location, SuggestionSubmitDialog integration, isSuggestionMode gate

### Secondary (MEDIUM confidence)
- Phase 14 RESEARCH.md — Zustand non-persisted store pattern, suggestion pipeline architecture
- Phase 14 CONTEXT.md — D-13 (persistence decisions), session lifecycle established patterns
- `.planning/STATE.md` — accumulated decisions for Zustand, React Query, API client conventions

### Tertiary (LOW confidence)
- `@dnd-kit/sortable` version 8.x compatibility claim — assumed from @dnd-kit/core ^6 co-versioning; not verified via npm registry in this session

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all existing deps verified via package.json; only `@dnd-kit/sortable` is assumed
- Architecture: HIGH — EntityGraphModal pattern directly verified; store/API patterns follow established conventions
- Pitfalls: HIGH — Pitfalls 1-3 come from direct code reading of the submit flow and DnD infrastructure; Pitfalls 4-5 are MEDIUM (reasoning from patterns)
- Test infrastructure: HIGH — vitest.config.ts and existing test stubs verified

**Research date:** 2026-04-07
**Valid until:** 2026-05-07 (stable stack; @dnd-kit version assumption should be re-verified if planning exceeds 30 days)
