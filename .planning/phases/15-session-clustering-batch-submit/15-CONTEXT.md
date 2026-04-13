# Phase 15: Session Clustering & Batch Submit - Context

**Gathered:** 2026-04-07
**Status:** Ready for planning

<domain>
## Phase Boundary

At submit time, the system automatically groups a user's accumulated suggestions into ancestor-based PR shards, shows a shard preview tree for user review and adjustment, then creates commits and PRs from the approved shard groupings. Small sessions (≤5 suggestions) skip clustering and use the existing single-PR flow.

</domain>

<decisions>
## Implementation Decisions

### Clustering Algorithm
- **D-01:** **Dynamic density-based splitting** — auto-detect the deepest taxonomy level where PRs stay under the ~10 shard / ~50 suggestion threshold. No fixed depth — adapts to session size and ontology shape.
- **D-02:** **Cross-cutting changes auto-form own shard** — changes that don't fit one ancestor automatically become their own shard in the best-fit PR. No user prompt during clustering — the preview shows the result and user can adjust.
- **D-03:** **Small sessions skip clustering** — if total suggestions ≤ threshold (e.g., ≤5), skip clustering entirely and create one PR with one commit. Falls back to current suggestion submit behavior.
- **D-04:** **Tie-breaking: larger shard wins** — when a suggestion could belong to two subtrees equally, assign to whichever subtree already has more suggestions in this session. Keeps shards balanced.

### Shard Preview UX
- **D-05:** **Nested tree layout** — two-level tree in a full-screen modal: PR groupings (outer, collapsible) → shard-commits (inner) → entity list. Mirrors the ontology hierarchy. Modal pattern matches existing EntityGraphModal.
- **D-06:** **Both drag-and-drop + buttons** — drag-and-drop as primary interaction for moving entities between shards and shards between PRs, with button fallbacks (⋮ menu with Merge, Split; "Move to..." dropdown on entity rows) for accessibility and mobile.
- **D-07:** **Entity names + counts** — each shard shows its label, entity count, and a collapsible list of entity local names. No inline diffs in the preview.
- **D-08:** **No title/message renaming** — PR titles and commit messages are auto-generated. User can add notes/descriptions which become the commit body and PR description.
- **D-09:** **Top summary bar** — compact bar at the top of the modal: "12 suggestions → 4 shards → 2 PRs". Instant orientation before diving into the tree.

### Git Mechanics
- **D-10:** **Hybrid commit messages** — descriptive subject line with ancestor path for humans (e.g., "feat(ontology): add 5 subclasses under Contract Law > Commercial Contracts") plus structured metadata in the commit body (shard number, total shards, ancestor path, entity count, session ID, provenance) for tooling.
- **D-11:** **Branch naming: suggest/{user}/{timestamp}** — e.g., "suggest/damien/20260407-2100-1". Suffixed with PR index for multi-PR sessions.
- **D-12:** **PR body: summary + entity list + user notes** — auto-generated summary (shard count, ancestor path, entity count), full entity list, and user-added descriptions/notes appended.
- **D-13:** **Session branch cleanup: delete after all PRs resolved** — keep the original session branch until all its PRs are either merged or rejected, then delete. Safety net during review.
- **D-14:** **PR branches from main** — create each PR branch from current main, apply only the shard's entities as a single commit. Clean diff against main, no cross-shard pollution. Backend assembles Turtle source per shard.
- **D-15:** **Parallel PR creation with conflict check** — create branches in parallel, but if two PRs would touch the same file, serialize those two. Best of both speed and safety.

### Submit Flow Lifecycle
- **D-16:** **Server-side clustering** — backend has the full ontology tree (18K+ classes), ancestor paths, and can compute LCA efficiently. Returns shard assignments to the frontend for preview via a single API call.
- **D-17:** **Step-by-step progress bar** — multi-step progress: "Clustering suggestions..." → "Creating branch 1/3..." → "Opening PR 1/3..." → "Done". Shows which step is active.
- **D-18:** **Partial success + retry failed** — show which PRs were created successfully (with links) and which failed. Offer a "Retry failed" button. No rollback of successful PRs.
- **D-19:** **Success summary with PR links** — completion screen in the modal with links to each created PR, shard counts per PR, and a "Done" button to close.

### Claude's Discretion
- Exact threshold for "small session" clustering bypass (suggested ≤5, but could be tuned)
- Animation/transition effects in the shard preview modal
- Exact ELK/layout algorithm for the nested tree rendering
- How the progress bar integrates with the modal (inline vs overlay)
- Conflict check implementation details (file-level vs line-level)
- Whether the summary bar animates as shards are adjusted

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — CLUSTER-01 through CLUSTER-09

### Prior Phase Artifacts
- `.planning/phases/14-inline-suggestion-ux-property-support/14-CONTEXT.md` — Suggestion store design (D-12, D-13), sparkle badges, session state

### Existing Frontend Components
- `lib/stores/suggestionStore.ts` — Zustand store with accepted/rejected/pending suggestions, keyed by `entityIri::suggestionType`
- `lib/hooks/useSuggestionSession.ts` — Session lifecycle (create/save/submit/discard/resume/resubmit)
- `lib/api/suggestions.ts` — Suggestion session API client (create, save, submit, list, discard, approve, reject)
- `components/editor/EntityGraphModal.tsx` — Existing full-screen modal pattern to follow
- `app/projects/[id]/editor/page.tsx` — Editor orchestrator, owns submit flow

### Backend Context
- `../ontokit-api/ontokit/services/ontology_index_service.py` — Has ancestor path queries (SQL CTE) for clustering
- `../ontokit-api/ontokit/api/routes/suggestions.py` — Current single-PR submit endpoint to extend

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `suggestionStore.ts`: Has `getPendingCount()`, per-entity suggestion tracking — provides the input data for clustering
- `useSuggestionSession`: Session lifecycle hook — needs extension for batch submit flow (clustering step before PR creation)
- `suggestionsApi`: Current `submit()` creates a single PR — needs new `cluster()` + `batchSubmit()` endpoints
- `EntityGraphModal`: Full-screen modal with ReactFlow — pattern for the shard preview modal (modal chrome, close handling, keyboard escape)
- `ResizablePanelDivider`: Existing draggable divider — could be reused in preview layout

### Established Patterns
- React Query for server state, Zustand for client state
- API clients in `lib/api/` with typed responses
- Full-screen modals use `next/dynamic` for lazy loading
- Dark mode via Tailwind class-based (darkMode: "class")
- Drag-and-drop via `useTreeDragDrop` hook pattern (existing in class tree)

### Integration Points
- Editor header "Submit session" button triggers the clustering flow instead of direct submit
- `useSuggestionSession.submitSession()` needs to route through clustering when suggestions exceed threshold
- New API endpoints needed: `POST /cluster` (returns shard assignments), `POST /batch-submit` (creates PRs from approved shards)
- Notification bell should show when batch PRs are created (existing notification system)
- Session branch cleanup needs a backend webhook or polling mechanism

</code_context>

<specifics>
## Specific Ideas

- The shard preview modal is the centerpiece of this phase — it's the user's last chance to review and adjust before PRs are created. It should feel deliberate and clear, not rushed.
- Dynamic density-based clustering adapts to the user's session — a focused session on one branch might produce 1 PR, while a broad session across the taxonomy produces several. The user doesn't need to understand the algorithm, just the result.
- Hybrid commit messages (human-readable subject + machine-readable body) serve both reviewers reading GitHub and future tooling that parses commit metadata.
- The "skip clustering for small sessions" escape hatch ensures the system doesn't add overhead for simple edits — it just does what the current system does.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 15-session-clustering-batch-submit*
*Context gathered: 2026-04-07*
