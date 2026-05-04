---
phase: 16-reviewer-enhancements
plan: "02"
subsystem: suggestions-ui
tags: [ui-components, tdd, provenance, shards, testing]
dependency_graph:
  requires: [16-01]
  provides: [ProvenanceBadge, ShardTabNavigator]
  affects: [components/suggestions/]
tech_stack:
  added: []
  patterns: [lucide-react icons, native ARIA tablist pattern, Tailwind cn() utility]
key_files:
  created:
    - components/suggestions/ProvenanceBadge.tsx
    - components/suggestions/ShardTabNavigator.tsx
    - __tests__/components/suggestions/ProvenanceBadge.test.tsx
    - __tests__/components/suggestions/ShardTabNavigator.test.tsx
  modified: []
decisions:
  - "Native ARIA roles (role=tablist/tab/aria-selected) used for ShardTabNavigator instead of Radix Tabs — external activeShardId prop pattern requires full state control; Radix Tabs manages internal state which conflicts"
  - "confidence < 60% shows red-600 in ProvenanceBadge (not slate like SimilarConceptsPanel scoreColor) — confidence thresholds carry distinct semantic weight per D-03"
metrics:
  duration_minutes: 2
  completed_date: "2026-04-08"
  tasks_completed: 2
  files_created: 4
  files_modified: 0
requirements: [REVIEW-03, REVIEW-04, REVIEW-05]
---

# Phase 16 Plan 02: ProvenanceBadge + ShardTabNavigator Components Summary

**One-liner:** Pure-presentational ProvenanceBadge (provenance icon + colored confidence score) and ShardTabNavigator (shard filter tab bar with mark indicator dots) built TDD-first with 17 unit tests.

## What Was Built

Two standalone UI components for the reviewer enhancement flow, built in isolation so Plan 03 can focus purely on page-level integration.

### ProvenanceBadge (`components/suggestions/ProvenanceBadge.tsx`)

- Renders a 10px inline badge with 12px Lucide icon, provenance label, and confidence score
- Three provenance types: `llm-proposed` (Sparkles + amber-500), `user-edited-from-llm` (Pencil + blue-500), `user-written` (User + slate-400)
- Confidence colored: green-600 ≥ 80%, amber-600 ≥ 60%, red-600 < 60% (per D-03 — red, not slate)
- Renders `---` dash when confidence is null
- `aria-label` carries full provenance + confidence text for screen readers

### ShardTabNavigator (`components/suggestions/ShardTabNavigator.tsx`)

- Tab bar with `role="tablist"` container and `role="tab"` + `aria-selected` on each tab
- Always-first "All" tab, then one tab per shard with entity count badge
- Active tab: `border-b-2 border-primary-500` matching existing review page tab pattern
- Mark indicator dots: 6px circle in green-500 (approved) or red-500 (rejected)
- `overflow-x-auto` for horizontal scroll, `max-w-[160px] truncate` per label
- Exports both `ShardTabNavigator` function and `ShardTabInfo` interface

## Test Coverage

| Component | Tests | Result |
|-----------|-------|--------|
| ProvenanceBadge | 8 | PASS |
| ShardTabNavigator | 9 | PASS |
| **Full suite** | **165 + 8 skipped** | **PASS** |

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | 3515b59 | feat(16-02): add ProvenanceBadge component with tests |
| Task 2 | f4e1eac | feat(16-02): add ShardTabNavigator component with tests |

## Deviations from Plan

None — plan executed exactly as written.

The plan noted "NOT Radix Tabs" inline in the action spec for ShardTabNavigator; this was correctly followed — native ARIA roles used for full external state control.

## Known Stubs

None. Both components are fully wired to their prop interfaces. No hardcoded placeholders, no TODO/FIXME markers, no data sources needed (pure presentational components consuming props).

## Threat Flags

None. Both components are pure presentational — no data fetching, no user input storage, no new trust boundaries. Threat register accepted T-16-05 and T-16-06 as-is.

## Self-Check: PASSED
