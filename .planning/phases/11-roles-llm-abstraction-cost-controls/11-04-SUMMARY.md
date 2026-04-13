---
phase: 11-roles-llm-abstraction-cost-controls
plan: "04"
subsystem: frontend
tags: [llm, settings, ui, cost-controls, budget]
dependency_graph:
  requires: ["11-03"]
  provides: ["LLMSettingsSection", "LLMUsageSection", "settings-page-ai-section"]
  affects: ["app/projects/[id]/settings/page.tsx"]
tech_stack:
  added: []
  patterns: ["React Query via useLLMConfig/useLLMUsage", "hand-rolled listbox dropdown", "Zustand BYO key store"]
key_files:
  created:
    - components/projects/LLMSettingsSection.tsx
    - components/projects/LLMUsageSection.tsx
  modified:
    - app/projects/[id]/settings/page.tsx
decisions:
  - "Hand-rolled listbox (no Headless UI) per UI-SPEC registry-safety contract"
  - "LLMUsageSection accepts monthlyBudgetUsd prop for remaining-budget calculation; backend provides budget_consumed_pct for progress bar"
  - "BYO key validation runs testConnection before updateConfig — invalid key blocks save"
  - "Budget fields (monthlyBudget/dailyCap) placed in LLMSettingsSection, not LLMUsageSection — single save flow"
metrics:
  duration_minutes: 10
  completed_date: "2026-04-06"
  tasks_completed: 2
  files_changed: 3
---

# Phase 11 Plan 04: LLM Settings & Usage Dashboard Summary

LLM admin UI — provider dropdown, API key management, budget ceiling, BYO key toggle, and usage dashboard — all mounted in the project settings page behind a canManage gate.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Build LLMSettingsSection component | 9fbdb70 | components/projects/LLMSettingsSection.tsx |
| 2 | Build LLMUsageSection and mount both sections in settings page | 08c5a8f | components/projects/LLMUsageSection.tsx, app/projects/[id]/settings/page.tsx |

## What Was Built

### LLMSettingsSection (`components/projects/LLMSettingsSection.tsx`)

Complete provider configuration form (611 lines):

- **Provider dropdown**: Hand-rolled listbox with 13 providers, lucide-react icons (Sparkles/OpenAI, Bot/Anthropic, Star/Google, Zap/Cohere, Cpu/local, Globe/generic), keyboard navigation (Arrow/Enter/Escape), `role="listbox"` + `role="option"` accessibility contract
- **API key field**: `type="password"` with Eye/EyeOff show/hide toggle, hidden for local providers (ollama/lmstudio/llamafile/custom)
- **Local endpoint URL**: Shown for local providers with provider-specific default placeholder; auto-fills on provider switch
- **Model tier radio group**: Quality / Cheap horizontal flex row
- **Budget inputs**: Monthly budget ceiling + daily sub-cap (number inputs, blank = no cap), placed directly in this component for a unified save flow
- **BYO key toggle**: Checkbox + browser-only key input; writes to `useByoKeyStore`; shows explanatory inline text when enabled
- **Key validation**: Calls `testConnection` before `updateConfig`; spinner/CheckCircle/XCircle states; clears after 5s
- **Empty state**: "No AI provider configured" heading with body copy per copywriting contract
- **Save button**: "Save AI Settings" per copywriting contract; spinner + "Saving..." loading state

### LLMUsageSection (`components/projects/LLMUsageSection.tsx`)

Usage dashboard (285 lines):

- **Summary bar**: Three stat tiles in a rounded-lg border card: "Budget used · Month", "Remaining" (green/red conditional), "~$X.XX/day burn rate"
- **No budget cap**: Shows "No budget cap" in remaining tile when `monthlyBudgetUsd` is null
- **Progress bar**: `h-2 rounded-full` container; fill color: `bg-primary-500` (<80%), `bg-amber-500` (80-99%), `bg-red-500` (100%+); hidden when `budget_consumed_pct` is null
- **Per-user table**: Columns: User, Calls today, Calls this month, Est. cost (USD), BYO key; sorted calls_this_month desc; Check icon for BYO key column
- **Pagination**: "Showing N–M of X users" + Previous/Next buttons when >20 rows
- **Empty state**: "No LLM calls recorded this month." per copywriting contract

### Settings page integration (`app/projects/[id]/settings/page.tsx`)

- Imports `LLMSettingsSection` and `LLMUsageSection`
- New "AI / LLM" section placed between Embeddings and Danger Zone
- Section container: `mb-8 rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800` (matches existing pattern)
- Heading: "AI / LLM" `text-lg font-semibold` + "AI" badge `rounded-full bg-primary-100 px-2 py-1 text-xs font-semibold text-primary-700`
- Gated with `canManage` (owner/admin only per D-10)
- `<hr>` divider between LLMSettingsSection and LLMUsageSection

## Decisions Made

1. **Hand-rolled listbox**: No Headless UI or Radix dependency — registry-safety contract in UI-SPEC.
2. **Budget inputs in LLMSettingsSection**: Plan spec placed budget ceiling inputs in both sections with a note about routing. Decision: single save flow in LLMSettingsSection only; `LLMUsageSection` receives `monthlyBudgetUsd` prop for remaining calculation display only.
3. **Validation before save**: `testConnection` called on save when a new API key or BYO key is provided — invalid key blocks `updateConfig` call. Clears after 5s per UI-SPEC.
4. **Auto-fill endpoint on provider switch**: Local providers auto-populate the endpoint URL field with their defaults unless already set.

## Deviations from Plan

### Auto-fixed Issues

None.

### Design Clarifications

**Budget inputs placement**: The plan spec described budget inputs in `LLMUsageSection` layout with a note: "Consider passing an `onBudgetChange` callback or making this read-only." Decision: kept budget inputs in `LLMSettingsSection` for a single save CTA. `LLMUsageSection` receives the budget as a prop for display only. This avoids two save buttons for the same config.

## Known Stubs

None. Both components wire to real hooks (`useLLMConfig`, `useLLMUsage`) which call real API endpoints. Data will be empty/loading until backend endpoints are live.

## Self-Check: PASSED

- `components/projects/LLMSettingsSection.tsx` — EXISTS (git: 9fbdb70)
- `components/projects/LLMUsageSection.tsx` — EXISTS (git: 08c5a8f)
- `app/projects/[id]/settings/page.tsx` modified — EXISTS (git: 08c5a8f)
- `npm run type-check` — PASSES
- `LLMSettingsSection` has `role="listbox"` + `role="option"` — VERIFIED
- Settings page imports `LLMSettingsSection` and `LLMUsageSection` — VERIFIED
- Settings page has `{canManage &&` gate around AI/LLM section — VERIFIED
- Settings page section heading contains "AI / LLM" — VERIFIED
- No `font-medium` usage in either new component — VERIFIED
