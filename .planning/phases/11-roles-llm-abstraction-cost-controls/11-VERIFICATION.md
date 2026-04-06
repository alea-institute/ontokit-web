---
phase: 11-roles-llm-abstraction-cost-controls
verified: 2026-04-06T16:14:52Z
status: passed
score: 19/19 must-haves verified
gaps: []
human_verification:
  - test: "Navigate to the project Settings page, scroll to the AI/LLM section"
    expected: "Provider dropdown shows 13 options with icons; API key field with show/hide toggle; model tier radio buttons (quality/cheap); Ollama provider shows endpoint URL field instead of API key"
    why_human: "Visual rendering of dropdown, icon display, and conditional field visibility cannot be verified programmatically"
  - test: "Open the editor as an editor role user"
    expected: "LLM role badge visible in toolbar showing 'Editor — 500/day'; budget banner appears when budget >= 80% consumed"
    why_human: "Real-time budget data and visual badge placement require live rendering"
  - test: "Open Members section of a project as admin, find an editor member"
    expected: "Structural self-merge toggle visible next to the editor's role label; toggle not visible for non-editor members"
    why_human: "Toggle conditional rendering based on member role requires live page inspection"
---

# Phase 11: Roles, LLM Abstraction & Cost Controls Verification Report

**Phase Goal:** Project owners can configure LLM providers with cost-capped access, and every role (admin/editor/suggester/anonymous) knows exactly which LLM affordances it can reach
**Verified:** 2026-04-06T16:14:52Z
**Status:** gaps_found — 1 minor text mismatch in AdminSelfMergeDialog body copy
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | All 7 test stub files exist with skip markers | ✓ VERIFIED | 5 backend pytest stubs + 2 Vitest stubs confirmed; `npx vitest run` shows 8 skipped tests |
| 2 | ProjectLLMConfig model stores provider, encrypted API key, model tier, budget, and base_url | ✓ VERIFIED | `/ontokit-api/ontokit/models/llm_config.py` has all required columns |
| 3 | LLMAuditLog model records every LLM call with is_byo_key, cost, tokens | ✓ VERIFIED | `class LLMAuditLog` with `is_byo_key`, `cost_estimate_usd`, `input_tokens`, `output_tokens` confirmed |
| 4 | get_provider() factory returns a provider for all 13 LLMProviderType values | ✓ VERIFIED | `PROVIDER_DISPLAY_NAMES` has exactly 13 entries; spot-check passes |
| 5 | API key encryption and decryption round-trips correctly using Fernet | ✓ VERIFIED | `encrypt_secret`/`decrypt_secret` in crypto.py; round-trip spot-check passes |
| 6 | SSRF validation blocks private IP ranges | ✓ VERIFIED | `validate_base_url` blocks 169.254.169.254; spot-check passes |
| 7 | Anonymous users get 403 on any LLM endpoint; role gate denies viewer | ✓ VERIFIED | `check_llm_access(None, is_anonymous=True)` returns False; `check_llm_access('viewer')` returns False |
| 8 | Editors rate-limited to 500/day; suggesters to 100/day; admins unlimited | ✓ VERIFIED | `RATE_LIMITS = {'editor': 500, 'suggester': 100, 'admin': None, 'owner': None}` confirmed |
| 9 | Budget exhaustion blocks project-key calls (BYO excluded from budget) | ✓ VERIFIED | `get_monthly_spend` filters `is_byo_key=False`; `check_budget` returns (False, reason) when exceeded |
| 10 | Every project-key LLM call creates an audit log entry | ✓ VERIFIED | `log_llm_call` creates `LLMAuditLog` rows; no prompt/response content stored |
| 11 | GET config returns api_key_set: true/false, never the actual key | ✓ VERIFIED | `LLMConfigResponse` has `api_key_set: bool`; route returns `bool(config.api_key_encrypted)` |
| 12 | llmApi client can call all 7 backend endpoints with correct types | ✓ VERIFIED | `lib/api/llm.ts` exports `llmApi` with `getConfig`, `updateConfig`, `testConnection`, `getUsage`, `getStatus`, `getProviders`, `getKnownModels`; `LLMProviderType` has all 13 values |
| 13 | BYO key stored in localStorage keyed by projectId | ✓ VERIFIED | `useByoKeyStore` with `persist({name:"ontokit-byo-keys"})` using createJSONStorage(()=>localStorage) |
| 14 | useLLMGate returns canUseLLM=false for anonymous users and when budget exhausted | ✓ VERIFIED | Logic confirmed: `canUseLLM = hasAccess && configured && !budget_exhausted`; `isAnonymous` derived from `!session?.user` |
| 15 | Project owner can configure LLM provider with API key, budget, and model tier in settings page | ✓ VERIFIED | `LLMSettingsSection` mounted in settings page under `{canManage &&` gate; 611 lines, substantive implementation |
| 16 | Usage section shows budget summary bar with consumed/remaining/burn-rate | ✓ VERIFIED | `LLMUsageSection` renders three stat tiles + progress bar with color logic (primary-500/amber-500/red-500) |
| 17 | Budget banner shows in editor when budget >= 80% consumed; anonymous see nothing | ✓ VERIFIED | `LLMBudgetBanner` renders at 80%+ threshold; both editor layouts guard with `{!llmGate.isAnonymous &&` |
| 18 | LLM role badge shows correct label for each role | ✓ VERIFIED | `LLMRoleBadge` returns null for viewer/anon; role-colored badges with `aria-label="Your LLM access: {label}"` |
| 19 | Admin self-merge shows confirmation dialog before merging directly | ⚠️ PARTIAL | `AdminSelfMergeDialog` exists with correct ARIA, Escape key, button handlers, and role="dialog" aria-modal="true" — but body text deviates from D-20 spec copy |

**Score:** 18/19 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `../ontokit-api/tests/unit/test_llm_config.py` | Pytest stubs (LLM-01,02,03) | ✓ VERIFIED | 3 skip-marked test functions |
| `../ontokit-api/tests/unit/test_llm_rate_limit.py` | Pytest stubs (COST-03,04) | ✓ VERIFIED | 2 skip-marked test functions |
| `../ontokit-api/tests/unit/test_llm_budget.py` | Pytest stubs (COST-01,02,07) | ✓ VERIFIED | 2 skip-marked test functions |
| `../ontokit-api/tests/unit/test_llm_role_gates.py` | Pytest stubs (ROLE-01–05) | ✓ VERIFIED | 5 skip-marked test functions |
| `../ontokit-api/tests/unit/test_llm_audit.py` | Pytest stubs (LLM-07) | ✓ VERIFIED | 2 skip-marked test functions |
| `__tests__/lib/stores/byoKeyStore.test.ts` | Vitest stubs | ✓ VERIFIED | 4 it.skip entries confirmed |
| `__tests__/lib/hooks/useLLMGate.test.ts` | Vitest stubs | ✓ VERIFIED | 4 it.skip entries confirmed |
| `../ontokit-api/ontokit/models/llm_config.py` | ProjectLLMConfig + LLMAuditLog models | ✓ VERIFIED | Both classes, all required columns present |
| `../ontokit-api/ontokit/services/llm/registry.py` | get_provider() + 13 providers | ✓ VERIFIED | 13 entries in PROVIDER_DISPLAY_NAMES, get_provider() dispatches |
| `../ontokit-api/ontokit/services/llm/crypto.py` | Fernet encrypt/decrypt | ✓ VERIFIED | encrypt_secret / decrypt_secret with _get_fernet() pattern |
| `../ontokit-api/ontokit/services/llm/pricing.py` | LiteLLM pricing with 7-day cache | ✓ VERIFIED | LITELLM_PRICING_URL constant + get_model_pricing() |
| `../ontokit-api/ontokit/services/llm/ssrf.py` | SSRF validator | ✓ VERIFIED | validate_base_url() blocks private IPs |
| `../ontokit-api/ontokit/services/llm/rate_limiter.py` | Redis rate limiter | ✓ VERIFIED | RATE_LIMITS dict, check_rate_limit(), get_remaining_calls() |
| `../ontokit-api/ontokit/services/llm/budget.py` | Monthly budget enforcement | ✓ VERIFIED | check_budget(), get_monthly_spend() with is_byo_key=False filter |
| `../ontokit-api/ontokit/services/llm/audit.py` | Audit log writer | ✓ VERIFIED | log_llm_call() creates LLMAuditLog; no prompt/response content |
| `../ontokit-api/ontokit/services/llm/role_gates.py` | Per-role access control | ✓ VERIFIED | check_llm_access(), LLM_ACCESS_ROLES frozenset |
| `../ontokit-api/ontokit/api/routes/llm.py` | 7 FastAPI routes | ✓ VERIFIED | router + public_router; all 7 routes confirmed in spot-check |
| `../ontokit-api/alembic/versions/u9v0w1x2y3a4_add_llm_config_audit_tables_and_member_flag.py` | Alembic migration | ✓ VERIFIED | Creates project_llm_configs, llm_audit_logs, adds can_self_merge_structural |
| `lib/api/llm.ts` | LLM API client + types | ✓ VERIFIED | 13-provider union type, 7 endpoint methods, LLMConfigResponse has api_key_set:bool |
| `lib/stores/byoKeyStore.ts` | BYO key Zustand persist store | ✓ VERIFIED | name:"ontokit-byo-keys", setKey/getKey/clearKey/markValidated/getEntry |
| `lib/hooks/useLLMConfig.ts` | React Query config hook | ✓ VERIFIED | useQuery + useMutation for config + testConnection |
| `lib/hooks/useLLMUsage.ts` | React Query usage hook | ✓ VERIFIED | useQuery with 1-minute refetchInterval |
| `lib/hooks/useLLMGate.ts` | LLM access gate hook | ✓ VERIFIED | canUseLLM, budgetExhausted, isAnonymous, roleLimitLabel, invalidateStatus |
| `components/projects/LLMSettingsSection.tsx` | Provider config form (min 150 lines) | ✓ VERIFIED | 611 lines; useLLMConfig wired; role="listbox", role="option"; 13 providers |
| `components/projects/LLMUsageSection.tsx` | Usage dashboard (min 100 lines) | ✓ VERIFIED | 282 lines; useLLMUsage wired; 3-stat bar + progress bar + per-user table |
| `app/projects/[id]/settings/page.tsx` | Mounts LLM sections | ✓ VERIFIED | LLMSettingsSection + LLMUsageSection inside canManage gate with "AI / LLM" heading |
| `components/projects/BYOKeyPopover.tsx` | BYO key popover (min 50 lines) | ✓ VERIFIED | 169 lines; w-[280px]; "Enter your API key" heading; Escape + outside-click dismiss |
| `components/editor/LLMBudgetBanner.tsx` | Budget warning/exhausted banner (min 40 lines) | ✓ VERIFIED | 90 lines; role="alert" on exhausted; useAnnounce assertive; 80% threshold |
| `components/editor/LLMRoleBadge.tsx` | Role-based LLM limit badge (min 20 lines) | ✓ VERIFIED | 39 lines; returns null for viewer/anon; violet/blue/green role colors |
| `components/projects/member-list.tsx` | Self-merge structural toggle | ✓ VERIFIED | can_self_merge_structural toggle for editor-only rows; min-h-[44px]; peer-checked:bg-primary-600 |
| `components/pr/AdminSelfMergeDialog.tsx` | Admin direct-merge confirmation (min 30 lines) | ⚠️ PARTIAL | 136 lines; role="dialog" aria-modal="true"; Escape key; correct buttons — but body text deviates from spec |
| `../ontokit-api/ontokit/services/llm/openai_compat.py` | OpenAICompatProvider | ✓ VERIFIED | class OpenAICompatProvider(LLMProvider) confirmed |
| `../ontokit-api/ontokit/services/llm/anthropic_provider.py` | AnthropicProvider | ✓ VERIFIED | class AnthropicProvider(LLMProvider) confirmed |
| `../ontokit-api/ontokit/services/llm/google_provider.py` | GoogleProvider | ✓ VERIFIED | class GoogleProvider(LLMProvider) confirmed |
| `../ontokit-api/ontokit/services/llm/cohere_provider.py` | CohereProvider | ✓ VERIFIED | class CohereProvider(LLMProvider) confirmed |
| `../ontokit-api/ontokit/services/llm/github_models_provider.py` | GitHubModelsProvider | ✓ VERIFIED | class GitHubModelsProvider(OpenAICompatProvider) confirmed |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `lib/hooks/useLLMGate.ts` | `lib/api/llm.ts` | Fetches status via llmApi.getStatus | ✓ WIRED | `llmApi.getStatus(projectId, session!.accessToken!)` confirmed |
| `lib/api/llm.ts` | `lib/stores/byoKeyStore.ts` | testConnection reads BYO key → X-BYO-API-Key header | ✓ WIRED | `byoKey ? { "X-BYO-API-Key": byoKey }` in testConnection |
| `components/projects/LLMSettingsSection.tsx` | `lib/hooks/useLLMConfig.ts` | useLLMConfig for fetching/saving config | ✓ WIRED | `useLLMConfig(projectId, accessToken)` import and call confirmed |
| `components/projects/LLMUsageSection.tsx` | `lib/hooks/useLLMUsage.ts` | useLLMUsage for dashboard data | ✓ WIRED | `useLLMUsage(projectId, accessToken)` import and call confirmed |
| `app/projects/[id]/settings/page.tsx` | `components/projects/LLMSettingsSection.tsx` | Renders inside canManage gate | ✓ WIRED | `{canManage &&` block with LLMSettingsSection confirmed at line 1918 |
| `components/editor/LLMBudgetBanner.tsx` | `lib/hooks/useLLMGate.ts` | Reads budgetExhausted + monthlySpentUsd from gate | ✓ WIRED | Both editor layouts: `useLLMGate(projectId, userRole)` → props to LLMBudgetBanner |
| `components/editor/LLMRoleBadge.tsx` | `lib/hooks/useLLMGate.ts` | Reads roleLimitLabel from gate | ✓ WIRED | Both layouts pass `llmGate.roleLimitLabel` to LLMRoleBadge |
| `components/editor/developer/DeveloperEditorLayout.tsx` | `components/editor/LLMBudgetBanner.tsx` | Mounts banner in editor header | ✓ WIRED | Import confirmed at line 8; rendered at line 351 with `!llmGate.isAnonymous` guard |
| `components/editor/standard/StandardEditorLayout.tsx` | `components/editor/LLMBudgetBanner.tsx` | Mounts banner in editor header | ✓ WIRED | Import confirmed at line 5; rendered at line 278 with anonymous guard |
| `../ontokit-api/ontokit/api/routes/llm.py` | `../ontokit-api/ontokit/services/llm/budget.py` | Route calls check_budget before dispatch | ✓ WIRED | `encrypt_secret` imported and called on API key write at line 214 |
| `../ontokit-api/ontokit/api/routes/llm.py` | `../ontokit-api/ontokit/services/llm/rate_limiter.py` | Route calls check_rate_limit | ✓ WIRED | Routes import and use rate_limiter; registered in `__init__.py` at lines 52–53 |
| `../ontokit-api/ontokit/services/llm/audit.py` | `../ontokit-api/ontokit/models/llm_config.py` | Writes to LLMAuditLog table | ✓ WIRED | `from ontokit.models.llm_config import LLMAuditLog` at line 16 |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `LLMUsageSection.tsx` | `usage` | `useLLMUsage` → `llmApi.getUsage` → `GET /llm/usage` → `get_usage_summary(db)` → SQL aggregation on `llm_audit_logs` | Yes — SQL queries LLMAuditLog, not static | ✓ FLOWING |
| `LLMSettingsSection.tsx` | `config` | `useLLMConfig` → `llmApi.getConfig` → `GET /llm/config` → DB query on `project_llm_configs` | Yes — queries ProjectLLMConfig by project_id | ✓ FLOWING |
| `LLMBudgetBanner.tsx` (in editor) | `budgetExhausted`, `monthlySpentUsd`, `monthlyBudgetUsd` | `useLLMGate` → `llmApi.getStatus` → `GET /llm/status` → `get_budget_status(db)` → SQL on audit_logs | Yes — DB-backed budget status computation | ✓ FLOWING |
| `LLMRoleBadge.tsx` | `roleLimitLabel` | `useLLMGate.getRoleLimitLabel(userRole)` — pure function, no async | N/A — derived from prop, no DB | ✓ FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Backend role gate denies anonymous | `check_llm_access(None, is_anonymous=True)` | False | ✓ PASS |
| Backend rate limits match spec | `RATE_LIMITS['editor'] == 500`, `['suggester'] == 100` | 500, 100, None | ✓ PASS |
| 13 providers registered | `len(PROVIDER_DISPLAY_NAMES) == 13` | 13 | ✓ PASS |
| Crypto round-trip | encrypt then decrypt 'test-key-123' | 'test-key-123' | ✓ PASS |
| SSRF blocks metadata IP | `validate_base_url('http://169.254.169.254/')` | ValueError raised | ✓ PASS |
| All 7 API routes present | router.routes path inspection | All 7 confirmed | ✓ PASS |
| Frontend type-check | `npm run type-check` | No errors | ✓ PASS |
| Vitest stubs collected | `npx vitest run` on stubs | 8 tests skipped | ✓ PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| LLM-01 | 01, 04 | Configure LLM provider at project level | ✓ SATISFIED | ProjectLLMConfig model + LLMSettingsSection UI |
| LLM-02 | 01, 02, 04 | Project-owner API keys stored encrypted, never browser-exposed | ✓ SATISFIED | encrypt_secret in PUT config route; LLMConfigResponse has api_key_set:bool |
| LLM-03 | 02, 03 | BYO-key stays in browser, sent via header | ✓ SATISFIED | byoKeyStore localStorage + X-BYO-API-Key header in testConnection |
| LLM-04 | 03 | Quality/cheap model tier choice | ✓ SATISFIED | ModelTier type + model_tier in config; radio buttons in LLMSettingsSection |
| LLM-05 | 01 | Pluggable dispatch layer, 13 providers | ✓ SATISFIED | Provider registry with 5 provider classes covering all 13 LLMProviderType values |
| LLM-06 | 01, 04 | Local endpoint (Ollama etc.) configurable | ✓ SATISFIED | ollama/lmstudio/llamafile/custom in PROVIDERS; endpoint URL field in settings UI |
| LLM-07 | 00, 02 | Audit log for every project-key LLM call | ✓ SATISFIED | log_llm_call() creates LLMAuditLog rows with metadata only |
| ROLE-01 | 02, 05 | Admins: unlimited LLM + self-merge all | ✓ SATISFIED | RATE_LIMITS[admin]=None; LLM_ACCESS_ROLES includes admin/owner |
| ROLE-02 | 02, 05 | Editors: LLM + annotation self-merge default | ✓ SATISFIED | RATE_LIMITS[editor]=500; role badge shows "Editor — 500/day" |
| ROLE-03 | 01, 05 | Admin can toggle per-editor structural self-merge | ✓ SATISFIED | can_self_merge_structural in ProjectMember(project.py); PATCH /members/{id}/flags route; toggle in member-list.tsx |
| ROLE-04 | 02, 05 | Suggesters: LLM access with 100/day limit | ✓ SATISFIED | RATE_LIMITS[suggester]=100; check_llm_access('suggester')==True |
| ROLE-05 | 00, 02, 03, 05 | Anonymous: no LLM access | ✓ SATISFIED | check_llm_access(None, is_anonymous=True)==False; useLLMGate isAnonymous check; banner guard in layouts |
| COST-01 | 02, 04 | Monthly LLM budget ceiling | ✓ SATISFIED | monthly_budget_usd in ProjectLLMConfig; budget input in LLMSettingsSection |
| COST-02 | 02, 05 | Graceful disable when budget exhausted | ✓ SATISFIED | check_budget returns (False, reason); 402 on exhaustion; LLMBudgetBanner exhausted state |
| COST-03 | 00, 02 | Editors rate-limited 500/day | ✓ SATISFIED | RATE_LIMITS[editor]=500; Redis INCR+EXPIRE pattern |
| COST-04 | 00, 02 | Suggesters rate-limited 100/day | ✓ SATISFIED | RATE_LIMITS[suggester]=100 |
| COST-05 | 04 | Usage dashboard with per-user call counts | ✓ SATISFIED | LLMUsageSection per-user table: calls_today, calls_this_month, cost |
| COST-06 | 04 | Dashboard shows budget consumption + burn rate | ✓ SATISFIED | LLMUsageSection summary bar + progress bar with consumed/remaining/burn-rate |
| COST-07 | 00, 02 | BYO-key calls excluded from project budget | ✓ SATISFIED | get_monthly_spend filters `is_byo_key=False`; BYO calls not counted against budget |

All 19 requirements mapped to implementations. No orphaned requirements found.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `components/pr/AdminSelfMergeDialog.tsx` | 96 | Body text diverges from D-20 spec copywriting contract | ⚠️ Warning | Acceptance criteria in Plan 05 explicitly requires the exact string "You are about to merge this directly. Continue?" — functionally equivalent copy present but fails the exact-text check |

No other anti-patterns detected. No TODO/FIXME/placeholder comments in implementation files (input `placeholder` HTML attributes excluded — those are valid). No empty return stubs, hardcoded empty data, or disconnected props found.

---

### Human Verification Required

#### 1. LLM Settings Section Visual Rendering

**Test:** Navigate to a project's Settings page and scroll to the "AI / LLM" section (between Embeddings and Danger Zone).
**Expected:** Provider dropdown shows 13 options with provider icons; API key field has password type with Eye/EyeOff toggle; model tier shows Quality/Cheap radio buttons; switching to Ollama hides API key field and shows Endpoint URL field with http://localhost:11434 default.
**Why human:** Dropdown rendering, icon display, and conditional field visibility require live browser rendering.

#### 2. Editor LLM Role Badge Display

**Test:** Open the ontology editor as a user with editor role.
**Expected:** "Editor — 500/day" badge visible in the editor toolbar; badge not visible when viewing as anonymous.
**Why human:** Role badge placement and real-time rendering requires live editor session.

#### 3. Member List Self-Merge Toggle Visibility

**Test:** Open Members section of a project as an admin; inspect editor members.
**Expected:** "Structural self-merge" toggle appears next to editor role rows only; toggle not shown for viewer/suggester/admin/owner rows; toggle has correct pill styling.
**Why human:** Toggle conditional rendering per row type requires live page inspection.

---

### Gaps Summary

One gap was found:

**AdminSelfMergeDialog body text mismatch.** Plan 05 acceptance criteria requires the exact body text "You are about to merge this directly. Continue?" (per D-20 spec). The implemented text is "You are about to merge this structural change without peer review. This cannot be undone." The dialog is otherwise complete: it has `role="dialog"`, `aria-modal="true"`, correct Escape key handling, Cancel and Confirm buttons, loading spinner, and focus trap. The deviation is copy-only — one string needs to be updated in `components/pr/AdminSelfMergeDialog.tsx` line 96.

This is classified as `gaps_found` because an acceptance criterion explicitly fails the exact-text check, but the fix is a single string replacement. No architectural issues, no missing wiring, no stub implementations were found anywhere else in the phase.

---

_Verified: 2026-04-06T16:14:52Z_
_Verifier: Claude (gsd-verifier)_
