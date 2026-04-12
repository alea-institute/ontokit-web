---
phase: 11-roles-llm-abstraction-cost-controls
plan: "01"
subsystem: backend
tags: [llm, database, providers, crypto, pricing, ssrf]
dependency_graph:
  requires: ["11-00"]
  provides: ["11-02", "11-03", "11-04"]
  affects: ["ontokit-api/ontokit/models", "ontokit-api/ontokit/services/llm"]
tech_stack:
  added: ["openai>=1.0.0,<2.0.0", "anthropic>=0.18.0,<1.0.0", "google-generativeai>=0.8.0", "cohere>=5.0.0"]
  patterns: ["Fernet symmetric encryption", "LiteLLM pricing cache", "OpenAI SDK base_url dispatch", "SSRF IP validation"]
key_files:
  created:
    - ../ontokit-api/ontokit/models/llm_config.py
    - ../ontokit-api/ontokit/schemas/llm.py
    - ../ontokit-api/alembic/versions/u9v0w1x2y3a4_add_llm_config_audit_tables_and_member_flag.py
    - ../ontokit-api/ontokit/services/llm/__init__.py
    - ../ontokit-api/ontokit/services/llm/base.py
    - ../ontokit-api/ontokit/services/llm/registry.py
    - ../ontokit-api/ontokit/services/llm/openai_compat.py
    - ../ontokit-api/ontokit/services/llm/anthropic_provider.py
    - ../ontokit-api/ontokit/services/llm/google_provider.py
    - ../ontokit-api/ontokit/services/llm/cohere_provider.py
    - ../ontokit-api/ontokit/services/llm/github_models_provider.py
    - ../ontokit-api/ontokit/services/llm/pricing.py
    - ../ontokit-api/ontokit/services/llm/crypto.py
    - ../ontokit-api/ontokit/services/llm/ssrf.py
  modified:
    - ../ontokit-api/ontokit/models/__init__.py
    - ../ontokit-api/ontokit/models/project.py
    - ../ontokit-api/pyproject.toml
    - ../ontokit-api/uv.lock
decisions:
  - "GoogleProvider uses httpx REST calls (not google-generativeai SDK) — SDK is deprecated as of 2025-07; REST API is more stable"
  - "SSRF validate_base_url uses allow_private kwarg not provider_type arg — more flexible, works for both local and cloud use cases"
  - "chat() returns (text, input_tokens, output_tokens) tuple — audit log requires token counts per call; folio-enrich only returned text"
  - "pricing.py stores (input_cost_per_token, output_cost_per_token) tuples instead of pre-computed per-node cost — audit log needs raw token prices"
metrics:
  duration_minutes: 6
  completed_date: "2026-04-06"
  tasks_completed: 2
  files_created: 14
  files_modified: 4
---

# Phase 11 Plan 01: Backend Data Layer and LLM Provider Registry Summary

**One-liner:** SQLAlchemy models for per-project LLM config + audit log, Alembic migration, and 13-provider registry ported from folio-enrich with Fernet crypto, LiteLLM pricing, and SSRF validation.

## What Was Built

### Task 1: DB Models, Schemas, and Alembic Migration

- **`ontokit/models/llm_config.py`** — Two new SQLAlchemy models:
  - `ProjectLLMConfig`: per-project LLM provider settings (provider, encrypted API key, model tier, base_url, monthly budget, daily cap)
  - `LLMAuditLog`: metadata-only audit trail per LLM call (tokens, cost, is_byo_key flag, no prompt content)
- **`ontokit/models/project.py`** — Added `can_self_merge_structural: Mapped[bool]` to `ProjectMember`
- **`ontokit/schemas/llm.py`** — Full Pydantic schema set: `LLMProviderType` (13-value str enum), `LLMConfigResponse` (api_key_set bool, never raw key), `LLMConfigUpdate`, `LLMStatusResponse`, `LLMUsageResponse`, `LLMUserUsage`, `LLMAuditEntry`, `LLMProviderInfo`, `LLMKnownModel`
- **Alembic migration** `u9v0w1x2y3a4` — creates `project_llm_configs`, `llm_audit_logs` (with composite indexes), adds `can_self_merge_structural` column; applied cleanly

### Task 2: LLM Provider Registry and Support Services

- **`ontokit/services/llm/registry.py`** — `get_provider()` factory for all 13 providers with lazy imports; `PROVIDER_DISPLAY_NAMES`, `PROVIDER_REQUIRES_KEY`, `PROVIDER_ICON_NAMES`, `KNOWN_MODELS`, `DEFAULT_BASE_URLS`, `DEFAULT_MODELS`
- **`ontokit/services/llm/openai_compat.py`** — `OpenAICompatProvider` handles 9 providers via OpenAI SDK `base_url` param; returns `(text, input_tokens, output_tokens)`
- **`ontokit/services/llm/anthropic_provider.py`** — `AnthropicProvider` with system-message separation; extracts token counts from `response.usage`
- **`ontokit/services/llm/google_provider.py`** — `GoogleProvider` using httpx REST (not deprecated SDK); extracts from `usageMetadata`, word-count fallback
- **`ontokit/services/llm/cohere_provider.py`** — `CohereProvider` using Cohere v2 REST API; extracts from `meta.tokens`
- **`ontokit/services/llm/github_models_provider.py`** — `GitHubModelsProvider` extends `OpenAICompatProvider`; overrides `list_models()` with GitHub catalog API
- **`ontokit/services/llm/crypto.py`** — `encrypt_secret` / `decrypt_secret` using same Fernet pattern as `embedding_service.py`
- **`ontokit/services/llm/pricing.py`** — `get_model_pricing(model)` fetches LiteLLM pricing JSON with 7-day module-level cache; graceful stale fallback on fetch failure
- **`ontokit/services/llm/ssrf.py`** — `validate_base_url()` blocks private IPs, cloud metadata endpoint, non-https for cloud providers; local providers use `allow_private=True`

## Decisions Made

1. **GoogleProvider uses httpx REST** — `google-generativeai` SDK is deprecated as of July 2025; using the REST API directly avoids the deprecation warning and is more stable.

2. **`chat()` returns `(text, input_tokens, output_tokens)`** — folio-enrich's original `chat()` returned only `str`. Changed the contract to a 3-tuple so audit logging can record token costs without a separate API call.

3. **`pricing.py` stores raw per-token costs** — stores `(input_cost_per_token, output_cost_per_token)` tuples instead of folio-enrich's pre-computed per-node cost, since the audit log needs actual token counts × per-token price.

4. **SSRF `validate_base_url(url, allow_private=False)`** — changed from folio-enrich's `validate_base_url(url, provider_type)` signature to a generic `allow_private` flag, which is more composable and works cleanly with the registry's local-provider detection.

## Deviations from Plan

### Auto-fixed Issues

None — plan executed as written with one intentional adaptation:

**[Rule 1 - Adaptation] `google-generativeai` SDK deprecated**
- **Found during:** Task 2 — `import google.generativeai` triggers `FutureWarning: All support for the google.generativeai package has ended`
- **Fix:** `GoogleProvider` uses httpx REST calls to the Generative Language API (matching folio-enrich's existing implementation — which already avoided the SDK for the same reason)
- **Files modified:** `ontokit/services/llm/google_provider.py`
- **No dependency change needed:** `google-generativeai>=0.8.0` still added per plan (other code may need it), but GoogleProvider itself uses httpx

## Known Stubs

None — all models, schemas, and service code are fully implemented. No placeholder data in any rendering path.

## Self-Check: PASSED

Files confirmed to exist:
- `FOUND: ontokit-api/ontokit/models/llm_config.py` — contains `class ProjectLLMConfig`
- `FOUND: ontokit-api/ontokit/schemas/llm.py` — contains `class LLMProviderType` with 13 values
- `FOUND: ontokit-api/ontokit/services/llm/registry.py` — contains `def get_provider` and 13-entry `PROVIDER_DISPLAY_NAMES`
- `FOUND: ontokit-api/ontokit/services/llm/crypto.py` — contains `def encrypt_secret` and `def decrypt_secret`
- `FOUND: ontokit-api/ontokit/services/llm/pricing.py` — contains `LITELLM_PRICING_URL` and `async def get_model_pricing`
- `FOUND: ontokit-api/alembic/versions/u9v0w1x2y3a4_...py` — creates all three DB changes
- `ProjectMember` contains `can_self_merge_structural: Mapped[bool]`

Commits confirmed:
- `462bc77` — feat(11-01): DB models, schemas, and Alembic migration for LLM config
- `dded39c` — feat(11-01): LLM provider registry, crypto helpers, pricing, and SSRF validator
