---
status: awaiting_human_verify
trigger: "React error #185 Maximum update depth exceeded on /projects/[id] page. Infinite re-render loop in StandardEditorLayout or DeveloperEditorLayout."
created: 2026-04-12T00:00:00Z
updated: 2026-04-12T00:15:00Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: CONFIRMED AND FIXED
test: Replaced inline `[]` literals in Zustand selector fallback with a stable module-level `EMPTY_SUGGESTIONS` constant
expecting: Zustand equality check now returns same reference → no spurious re-renders
next_action: human verification that /projects/[id] loads without error #185 on llm-helper branch

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: Project page at /projects/[id] loads normally, showing the ontology editor with class tree and detail panel
actual: Page crashes immediately with React error #185 "Maximum update depth exceeded" — infinite re-render loop
errors: React error #185 (minified stack: rh → rp → aU → aF → iv → up → ud loop). Crash is inside editor layout components.
reproduction: Visit any /projects/[id] page (viewer or editor). Home page, sign-in, and all other routes work fine.
started: After deploying llm-helper branch to production.

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: useLLMGate hook causes crash
  evidence: Bypassed with static object, crash persists
  timestamp: 2026-04-12T00:00:00Z

- hypothesis: /llm/status 403 error causes crash
  evidence: Crash happens for anonymous users too (query never fires)
  timestamp: 2026-04-12T00:00:00Z

- hypothesis: stale build chunks
  evidence: fresh rm -rf .next && npm run build doesn't help
  timestamp: 2026-04-12T00:00:00Z

- hypothesis: useProjectViewer hook is the cause
  evidence: Simplified page rendering only project data (no editor layouts) works perfectly
  timestamp: 2026-04-12T00:00:00Z

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-04-12T00:10:00Z
  checked: llm-helper branch StandardEditorLayout.tsx and DeveloperEditorLayout.tsx
  found: Both layouts call useLLMGate(projectId, userRole), and also call useSuggestionStore and useByoKeyStore
  implication: The LLM-related hooks were added in commit 3f22c33 on llm-helper branch

- timestamp: 2026-04-12T00:11:00Z
  checked: lib/hooks/useSuggestions.ts on llm-helper branch — the selector for items
  found: `const items = useSuggestionStore((s) => entityIri ? (s.suggestions[key] || []) : [])` — returns new [] literal when entityIri is null OR when no suggestions stored for key
  implication: Zustand uses Object.is for equality; [] !== [] on every call; triggers re-render loop

- timestamp: 2026-04-12T00:12:00Z
  checked: ClassDetailPanel.tsx on llm-helper branch — calls useSuggestions 5 times
  found: childrenSuggestions, siblingsSuggestions, annotationsSuggestions, parentsSuggestions, edgesSuggestions — all use the same selector pattern with `|| []` fallback
  implication: 5 Zustand subscriptions each returning unstable [] reference → 5x re-render triggers per cycle → React error #185

- timestamp: 2026-04-12T00:13:00Z
  checked: Current branch (feat/bcp47-language-picker)
  found: useSuggestions.ts and suggestionStore.ts do NOT exist; ClassDetailPanel has no useSuggestions calls
  implication: The fix must be applied to the llm-helper branch where the bug exists

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: In lib/hooks/useSuggestions.ts, the Zustand selector `(s) => entityIri ? (s.suggestions[key] || []) : []` returned a new array literal `[]` on every call when entityIri was null or when no suggestions were stored for the key. Zustand uses Object.is for equality comparison — since `[] !== []`, this made every render look like a state change, triggering a re-render, which called the selector again, producing another new `[]`, causing another re-render. ClassDetailPanel calls useSuggestions 5 times, so 5 subscriptions were all firing simultaneously. This produced React error #185 "Maximum update depth exceeded" for all users including anonymous ones, because ClassDetailPanel is always rendered (even read-only) and classIri starts as null until a tree node is selected.

fix: Hoisted a stable module-level constant `const EMPTY_SUGGESTIONS: StoredSuggestion[] = []` outside the hook function. Changed the selector to use this constant as the fallback: `entityIri ? (s.suggestions[key] ?? EMPTY_SUGGESTIONS) : EMPTY_SUGGESTIONS`. Now Zustand's equality check gets the same reference every time when there are no suggestions, stopping the loop.

verification: npm run test — 183 tests pass, 0 failures. npm run type-check — zero type errors.

files_changed: [lib/hooks/useSuggestions.ts]
