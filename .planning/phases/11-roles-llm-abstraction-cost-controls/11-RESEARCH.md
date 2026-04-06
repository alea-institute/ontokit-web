# Phase 11: Roles, LLM Abstraction & Cost Controls — Research

**Researched:** 2026-04-05
**Domain:** Multi-provider LLM dispatch, per-role access control, cost budgeting, BYO-key proxying
**Confidence:** HIGH — primary sources are live code in sibling repos (folio-enrich, folio-mapper) and ontokit-api itself

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Direct provider SDKs — backend calls OpenAI, Anthropic, Ollama, etc. directly (not ALEA LLM Client or litellm). Simple, always supports latest models, no intermediary dependency.
- **D-02:** Provider list matches whatever folio-enrich and folio-mapper already support. Researcher must check those repos for the exact list.
- **D-03:** Project-level default model tier (quality/cheap) + per-call override. Owner sets default in settings; individual calls can toggle to the other tier.
- **D-04:** Local model support (Ollama/compatible endpoints) is first-class at launch, not deferred. Users configure a local endpoint URL in project settings alongside cloud providers.
- **D-05:** BYO-key calls proxy through the backend — browser sends key per-request (in-memory only, NOT stored server-side). Avoids CORS issues, enables audit trail.
- **D-06:** BYO calls count against the user's daily rate limit (500/day editor, 100/day suggester) but do NOT count against the project budget (per COST-07).
- **D-07:** BYO key stored in browser localStorage. On entry, backend makes a lightweight provider call to validate the key works before accepting it.
- **D-08:** Metadata only — log timestamp, user ID, model name, token count (input+output), cost estimate, endpoint called. No prompt or response content stored. Privacy-safe.
- **D-09:** Backend maintains a price-per-token table for estimated cost alongside token counts. Dashboard shows both.
- **D-10:** New "AI / LLM" section in existing project settings page (owner/admin only). Follows existing settings page pattern.
- **D-11:** Dropdown provider picker with provider name + small logo. API key field appears below the dropdown.
- **D-12:** One active provider at a time per project. Matches how embeddings config works today. No multi-provider routing.
- **D-13:** BYO key entry via two paths: (1) inline toggle in AI/LLM settings section, and (2) just-in-time popover on first LLM action if no BYO key is set. Popover links back to settings for review/changes.
- **D-14:** Usage dashboard lives as a tab/section within project settings (owner/admin only).
- **D-15:** Summary bar (budget used/remaining, burn rate) + table of per-user daily call counts and estimated cost. No charts at launch.
- **D-16:** Budget exhaustion: LLM action buttons become disabled with tooltip "LLM budget exhausted for this month." Subtle banner in editor header. Manual suggestions remain fully functional.
- **D-17:** Monthly budget ceiling + optional daily sub-cap. Prevents one heavy day from burning the whole month. Resets on the 1st.
- **D-18:** Per-user toggle in existing member list: "Can self-merge structural PRs" (default: off for editors). Admin flips it for trusted editors.
- **D-19:** Visible role-based LLM access indicator near LLM features — small badge showing limits (e.g., "Editor — 500 calls/day").
- **D-20:** Admin self-merge requires confirmation dialog: "You are about to merge this directly. Continue?"

### Claude's Discretion

- Exact provider logo assets and dropdown styling
- Price-per-token table update mechanism (config file vs. admin UI)
- Exact popover placement and dismissal behavior for BYO key prompt
- localStorage key naming for BYO key store
- Usage table pagination / date range defaults

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ROLE-01 | Admins have full access: LLM suggestions, self-merge annotation PRs, self-merge structural PRs | Role gate logic, ProjectMember.role column, canSelfMergeStructural flag |
| ROLE-02 | Editors have LLM access and self-merge annotation PRs by default; structural PRs require peer review | Per-role LLM gate + PR workflow check |
| ROLE-03 | Admin can override default editor permissions per-project (promote trusted editor to self-merge structural) | New `can_self_merge_structural` boolean on ProjectMember |
| ROLE-04 | Suggesters have LLM access and submit through the existing suggestion-session flow | Role gate: canSuggest → LLM allowed; isSuggestionMode → session flow |
| ROLE-05 | Anonymous users have no LLM access | Gate on session.user presence; no rate limit entry |
| LLM-01 | User can configure an LLM provider (cloud or local) at the project level | New `ProjectLLMConfig` DB model + settings section |
| LLM-02 | Project-owner API keys are stored on the backend and never exposed to the browser | Fernet encryption pattern (already used by `ProjectEmbeddingConfig.api_key_encrypted`) |
| LLM-03 | BYO-key users can enter their own API key which stays in the browser and proxied per-request | `X-BYO-API-Key` header forwarded in new `lib/api/llm.ts` |
| LLM-04 | User can choose between "quality" and "cheap" model tiers per LLM call | `model_tier: "quality" \| "cheap"` field in LLMConfig + per-call override |
| LLM-05 | LLM dispatch layer is pluggable — direct provider SDKs, chosen per-project | folio-enrich/folio-mapper LLM registry pattern ported to ontokit-api |
| LLM-06 | Local model endpoint (Ollama or compatible) can be configured as a provider | `base_url` field in LLMConfig; SSRF validation for local providers |
| LLM-07 | Backend records every project-key LLM call (timestamp, user, model, token count) for audit | New `LLMAuditLog` DB table; no prompt content stored |
| COST-01 | Project owner sets a monthly LLM budget ceiling per project | `monthly_budget_usd` field in `ProjectLLMConfig` |
| COST-02 | LLM features disable gracefully when project budget is exhausted (manual suggestions still work) | Budget check middleware; `budget_exhausted` field in LLM status response |
| COST-03 | Editors are rate-limited to 500 LLM calls per day per project | Redis counter key pattern; checked in dispatch middleware |
| COST-04 | Suggesters are rate-limited to 100 LLM calls per day per project | Same Redis pattern, different limit |
| COST-05 | Project owner sees a usage dashboard with per-user, per-day call counts and estimated cost | `GET /projects/{id}/llm/usage` aggregation query |
| COST-06 | Dashboard shows current budget consumption and burn rate | Derived from audit log; `budget_consumed_usd`, `burn_rate_daily_usd` in response |
| COST-07 | BYO-key users' calls do not count against the project budget | `is_byo_key` flag in audit log; budget check skips BYO calls |
</phase_requirements>

---

## Summary

This phase wires up the full LLM infrastructure foundation: provider configuration, role-gating, cost controls, and audit logging. It delivers no user-visible AI generation (that is Phase 13) — only the plumbing that every subsequent LLM feature will rely on.

The two sibling repos (folio-enrich and folio-mapper) have already solved the multi-provider dispatch problem cleanly. Both implement an identical `LLMProviderType` enum (13 providers), an abstract `LLMProvider` base class with `complete / chat / structured / test_connection / list_models` methods, and a `get_provider()` factory that routes to `OpenAICompatProvider` (handles 9 providers via the OpenAI SDK's `base_url` parameter), `AnthropicProvider`, `GoogleProvider`, `CohereProvider`, and `GitHubModelsProvider`. This entire pattern should be ported wholesale into `ontokit/services/llm/` rather than rebuilt.

The pricing mechanism is equally well established: both repos use the LiteLLM public pricing JSON (`model_prices_and_context_window.json`) as a live, 7-day-cached source of truth for input/output token costs. This eliminates the need for a manually maintained price table.

The API key encryption pattern already exists in `ontokit-api`: `ProjectEmbeddingConfig.api_key_encrypted` uses `cryptography.Fernet` (a symmetric encryption scheme) with a key derived via `hashlib.sha256(settings.secret_key)`. The same pattern is reused verbatim for `ProjectLLMConfig.api_key_encrypted`. The `cryptography` package is already installed via `python-jose[cryptography]` — no new dependency needed.

**Primary recommendation:** Port the folio-enrich LLM registry (13 providers, SSRF validation, pricing) into `ontokit/services/llm/`. Add `ProjectLLMConfig` + `LLMAuditLog` DB models (following `ProjectEmbeddingConfig`). Reuse the Fernet key-derivation pattern for API key storage. Build the frontend `LLMSettingsSection` following the `EmbeddingSettingsSection` component pattern exactly.

---

## Standard Stack

### Core (Backend — Python/FastAPI)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `openai` | >=1.0.0,<2.0.0 | OpenAI, Mistral, Ollama, Groq, xAI, LM Studio, Custom, Llamafile, Meta Llama (all OpenAI-compat) | Already in folio-mapper; single SDK covers 9 of 13 providers |
| `anthropic` | >=0.18.0,<1.0.0 | Anthropic Claude provider | Already in folio-mapper; native SDK required (not OpenAI-compat) |
| `google-generativeai` | latest | Google Gemini provider | Required for Gemini; folio-enrich uses this |
| `cohere` | latest | Cohere Command provider | Required; folio-enrich has `cohere_provider.py` |
| `cryptography` | (already installed) | Fernet symmetric encryption for API keys | Already present via `python-jose[cryptography]`; `from cryptography.fernet import Fernet` |
| `httpx` | >=0.28.0 | LiteLLM pricing fetch + BYO key validation HTTP calls | Already in ontokit-api |

### Core (Frontend — Next.js/TypeScript)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `zustand` + `persist` | (already installed) | BYO key store (localStorage) | Identical to `editorModeStore.ts` and `draftStore.ts` patterns |
| `@tanstack/react-query` | (already installed) | `useLLMConfig`, `useLLMUsage` hooks | Already used for all server state |
| `lucide-react` | (already installed) | LLM settings UI icons | Consistent with existing settings page icons |

### New Python Dependencies (to add to ontokit-api pyproject.toml)

```bash
# In ontokit-api:
uv add "openai>=1.0.0,<2.0.0" "anthropic>=0.18.0,<1.0.0" "google-generativeai>=0.8.0" "cohere>=5.0.0"
```

Note: `cryptography` is already installed (no addition needed).

### Version Verification

Verified from folio-mapper `uv.lock` (as of 2026-04-05):
- `openai` 1.109.1 (pypi latest)
- `anthropic` 0.79.0 (pypi latest)
- Google Generative AI and Cohere: folio-enrich installs lazily; check pypi at implementation time

---

## Architecture Patterns

### Backend Service Structure

```
ontokit/
├── models/
│   ├── llm_config.py          # ProjectLLMConfig, LLMAuditLog SQLAlchemy models
│   └── project_member_flags.py  # (or add can_self_merge_structural to ProjectMember)
├── schemas/
│   └── llm.py                 # Pydantic schemas: LLMConfig, LLMConfigUpdate, LLMUsage, LLMAuditEntry
├── services/
│   └── llm/
│       ├── __init__.py
│       ├── base.py             # Abstract LLMProvider (ported from folio-enrich)
│       ├── registry.py         # get_provider() factory, KNOWN_MODELS, pricing fetch
│       ├── openai_compat.py    # OpenAICompatProvider (9 providers via base_url)
│       ├── anthropic_provider.py
│       ├── google_provider.py
│       ├── cohere_provider.py
│       ├── github_models_provider.py
│       ├── pricing.py          # LiteLLM pricing fetch (7-day cache)
│       └── ssrf.py             # validate_base_url() (ported from folio-mapper)
├── api/routes/
│   └── llm.py                 # FastAPI routes: config, usage, dispatch, connection-test
└── alembic/versions/
    └── u9v0w1x2y3z4_add_llm_config_and_audit_tables.py
```

### Frontend Structure

```
lib/
├── api/
│   └── llm.ts               # llmApi: getConfig, updateConfig, testConnection, getUsage, validateBYOKey
├── stores/
│   └── byoKeyStore.ts       # Zustand persist: { provider: string; key: string } in localStorage
└── hooks/
    ├── useLLMConfig.ts      # React Query: GET /projects/{id}/llm/config
    ├── useLLMUsage.ts       # React Query: GET /projects/{id}/llm/usage
    └── useLLMGate.ts        # Derives: canUseLLM, dailyRemaining, budgetExhausted, isBYOMode

components/
├── editor/
│   ├── LLMBudgetBanner.tsx        # Subtle banner in editor header when budget exhausted
│   └── LLMRoleBadge.tsx           # "Editor — 500 calls/day" indicator near LLM features
└── projects/
    ├── LLMSettingsSection.tsx     # Mirrors EmbeddingSettingsSection; owner/admin only
    ├── LLMUsageSection.tsx        # Summary bar + per-user table; owner/admin only
    ├── BYOKeyPopover.tsx          # JIT popover on first LLM action if no BYO key
    └── member-list.tsx            # MODIFIED: add "Can self-merge structural" toggle per member
```

### Pattern 1: LLM Provider Registry (Port from folio-enrich)

**What:** Abstract base + factory function; 9 providers via `OpenAICompatProvider` (single OpenAI SDK, different `base_url`); 4 providers with native SDKs.

**When to use:** Every LLM dispatch call in ontokit-api goes through `get_provider()`.

```python
# Source: folio-enrich/backend/app/services/llm/registry.py (verified)
# Port this pattern verbatim, stripping folio-enrich-specific settings references.

from ontokit.services.llm.registry import get_provider
from ontokit.models.llm_config import ProjectLLMConfig

async def dispatch_llm_call(
    project_config: ProjectLLMConfig,
    messages: list[dict],
    byo_key: str | None = None,
) -> tuple[str, int, int]:
    """Returns (response_text, input_tokens, output_tokens)."""
    api_key = byo_key if byo_key else _decrypt_secret(project_config.api_key_encrypted)
    provider = get_provider(
        provider_type=project_config.provider,
        api_key=api_key,
        base_url=project_config.base_url,
        model=project_config.model,
    )
    response = await provider.chat(messages)
    # Token counting: provider responses include usage metadata
    return response, input_tokens, output_tokens
```

### Pattern 2: API Key Storage (Fernet — Already Used in Codebase)

**What:** Fernet symmetric encryption. Key derived from `settings.secret_key` via SHA-256. Same pattern as `embedding_service.py`.

```python
# Source: ontokit-api/ontokit/services/embedding_service.py (verified, lines 41-52)
import base64, hashlib
from cryptography.fernet import Fernet

def _get_fernet() -> Fernet:
    from ontokit.core.config import settings
    key = hashlib.sha256(settings.secret_key.encode()).digest()
    return Fernet(base64.urlsafe_b64encode(key))

def _encrypt_secret(plaintext: str) -> str:
    return _get_fernet().encrypt(plaintext.encode()).decode()

def _decrypt_secret(ciphertext: str) -> str:
    return _get_fernet().decrypt(ciphertext.encode()).decode()
```

**Copy this directly into `ontokit/services/llm/crypto.py`** — do not re-derive, do not add new dependencies.

### Pattern 3: BYO Key Proxy (Frontend → Backend)

**What:** Browser sends BYO key in a custom header per-request. Backend uses it for dispatch but never stores it.

```typescript
// Source: lib/api/llm.ts (new file, following lib/api/client.ts pattern)
export const llmApi = {
  dispatch: (projectId: string, payload: LLMDispatchRequest, token: string, byoKey?: string) =>
    api.post<LLMDispatchResponse>(`/api/v1/projects/${projectId}/llm/dispatch`, payload, {
      headers: {
        Authorization: `Bearer ${token}`,
        ...(byoKey ? { "X-BYO-API-Key": byoKey } : {}),
      },
    }),
};
```

Backend reads `request.headers.get("X-BYO-API-Key")` — never writes to DB.

### Pattern 4: Rate Limiting with Redis

**What:** Redis `INCR` + `EXPIRE` pattern for daily call counts. ontokit-api already uses Redis (arq) — use the same connection.

```python
# Pseudo-pattern for daily rate limiter (confirmed: Redis already available)
RATE_LIMITS = {"editor": 500, "suggester": 100, "admin": None, "owner": None, "viewer": 0}

async def check_rate_limit(redis, project_id: str, user_id: str, role: str) -> bool:
    limit = RATE_LIMITS.get(role)
    if limit is None:
        return True  # unlimited
    key = f"llm:rate:{project_id}:{user_id}:{date.today().isoformat()}"
    count = await redis.incr(key)
    if count == 1:
        await redis.expire(key, 86400)  # TTL = 24h
    return count <= limit
```

### Pattern 5: Budget Enforcement

**What:** Aggregate `LLMAuditLog.cost_estimate_usd WHERE is_byo_key=False` for the current month. Compare against `ProjectLLMConfig.monthly_budget_usd`. If exceeded, return 402 from dispatch endpoint.

```python
# LLMAuditLog aggregation (monthly, non-BYO only)
from sqlalchemy import select, func
from datetime import datetime, date

async def get_monthly_spend(db, project_id, month_start: date) -> float:
    result = await db.execute(
        select(func.sum(LLMAuditLog.cost_estimate_usd))
        .where(
            LLMAuditLog.project_id == project_id,
            LLMAuditLog.is_byo_key == False,
            LLMAuditLog.created_at >= month_start,
        )
    )
    return result.scalar() or 0.0
```

### Pattern 6: Pricing Fetch (LiteLLM JSON)

**What:** Both folio-enrich and folio-mapper use the same LiteLLM `model_prices_and_context_window.json` as a live pricing source, cached 7 days in-process. Port verbatim.

```python
# Source: folio-enrich/backend/app/services/llm/pricing.py (verified)
LITELLM_PRICING_URL = (
    "https://raw.githubusercontent.com/BerriAI/litellm/main/"
    "model_prices_and_context_window.json"
)
# Returns dict[model_id, cost_per_token_input] and cost_per_token_output
# Cache TTL: 7 days; falls back to stale cache on fetch failure
```

### Pattern 7: EmbeddingSettingsSection (Template for LLMSettingsSection)

**What:** The existing `EmbeddingSettingsSection` in `app/projects/[id]/settings/page.tsx` (line 2926) is the direct template for `LLMSettingsSection`. It implements: load config on mount, editable form with provider dropdown + API key field, save handler with validation, success/error toasts, and is rendered inside `{canManage && ...}`.

**LLMSettingsSection additions beyond embedding pattern:**
- Model tier selector (quality/cheap) with per-provider model list
- Monthly budget ceiling input
- Optional daily sub-cap input
- BYO key inline toggle (path 1 of D-13)
- Connection test button (calls `/projects/{id}/llm/test-connection`)

### Pattern 8: BYO Key Store (Zustand Persist)

```typescript
// Source: lib/stores/editorModeStore.ts pattern (verified)
// New: lib/stores/byoKeyStore.ts

interface BYOKeyState {
  entries: Record<string, { provider: string; key: string }>;  // keyed by projectId
  setKey: (projectId: string, provider: string, key: string) => void;
  clearKey: (projectId: string) => void;
  getKey: (projectId: string) => string | null;
}

export const useByoKeyStore = create<BYOKeyState>()(
  persist(
    (set, get) => ({
      entries: {},
      setKey: (projectId, provider, key) =>
        set((s) => ({ entries: { ...s.entries, [projectId]: { provider, key } } })),
      clearKey: (projectId) =>
        set((s) => { const e = { ...s.entries }; delete e[projectId]; return { entries: e }; }),
      getKey: (projectId) => get().entries[projectId]?.key ?? null,
    }),
    { name: "ontokit-byo-keys" },  // localStorage key
  ),
);
```

### Pattern 9: Member List Toggle (ROLE-03)

**What:** Add `can_self_merge_structural` boolean to `ProjectMember` DB model. In the member-list UI, admins see a checkbox next to each editor row. PUT `/projects/{id}/members/{userId}` with `can_self_merge_structural: true`.

Existing `MemberUpdate` schema in `lib/api/projects.ts` currently only has `{ role: ProjectRole }`. Add `can_self_merge_structural?: boolean` to both the TypeScript interface and the FastAPI Pydantic schema.

### Anti-Patterns to Avoid

- **Storing BYO key on backend:** Forbidden by D-05. The key must only exist in the request headers and in-browser localStorage. Never write `X-BYO-API-Key` value to any DB column.
- **Returning decrypted API key to browser:** The GET `/projects/{id}/llm/config` endpoint returns `api_key_set: bool`, not the key itself — same as embedding config.
- **Using litellm as a dispatch library:** D-01 is explicit about direct SDKs. LiteLLM JSON is used only as a pricing data source.
- **Calling provider APIs from the browser:** Would expose API keys to network inspection. All LLM calls go through the ontokit-api backend.
- **Resetting monthly budget counter on deploy:** Use `WHERE created_at >= date_trunc('month', NOW())` in the aggregation query — no stored counter needed, just the audit log.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multi-provider dispatch | Custom routing logic | Port `get_provider()` + `OpenAICompatProvider` from folio-enrich | Already handles 13 providers including SSRF validation |
| API key cost estimation | Hardcoded price table | LiteLLM `model_prices_and_context_window.json` (fetched + cached) | 1000+ models, maintained by BerriAI community |
| API key encryption | AES or custom | `cryptography.Fernet` via `_get_fernet()` pattern from `embedding_service.py` | Already in codebase; same key derivation reused |
| Provider SDK lazy import | Static imports at module load | `if provider_type == X: from module import Provider` inside factory | Avoids SDK initialization cost for unused providers |
| Daily call counting | Postgres query per request | Redis `INCR` + `EXPIRE(86400)` | O(1) atomic; Redis already used for arq job queue |
| SSRF protection for local endpoints | IP validation from scratch | Port `url_validator.py` from folio-mapper | Handles IPv6, private ranges, loopback, hostname resolution |

---

## Provider List (Verified from folio-enrich + folio-mapper)

Both repos implement **identical `LLMProviderType` enums** with the same 13 values:

| Provider Enum | Display Name | API Key Required | SDK Used | Notes |
|--------------|-------------|-----------------|---------|-------|
| `openai` | OpenAI | Yes | `openai` | Default: gpt-4o |
| `anthropic` | Anthropic | Yes | `anthropic` | Default: claude-sonnet-4-6 |
| `google` | Google Gemini | Yes | `google-generativeai` | Default: gemini-2.5-flash |
| `mistral` | Mistral AI | Yes | `openai` (compat) | Default: mistral-medium-latest |
| `cohere` | Cohere | Yes | `cohere` | Default: command-a-03-2025 |
| `meta_llama` | Meta Llama | Yes | `openai` (compat) | Default: llama-4-scout |
| `ollama` | Ollama (Local) | No | `openai` (compat) | Default base_url: localhost:11434 |
| `lmstudio` | LM Studio (Local) | No | `openai` (compat) | Default base_url: localhost:1234 |
| `custom` | Custom OpenAI-Compatible | No | `openai` (compat) | User-supplied base_url |
| `groq` | Groq | Yes | `openai` (compat) | Default: llama-3.3-70b-versatile |
| `xai` | xAI (Grok) | Yes | `openai` (compat) | Default: grok-3 |
| `github_models` | GitHub Models | Yes | Custom (Azure OpenAI-based) | Default: openai/gpt-4o |
| `llamafile` | Llamafile (Local) | No | `openai` (compat) | Default base_url: localhost:8080 |

**Implementation split:**
- `OpenAICompatProvider`: openai, mistral, meta_llama, ollama, lmstudio, custom, groq, xai, llamafile (9 providers, one class)
- `AnthropicProvider`: anthropic (native SDK, system message handling differs)
- `GoogleProvider`: google (native Google AI SDK)
- `CohereProvider`: cohere (native SDK)
- `GitHubModelsProvider`: github_models (Azure OpenAI endpoint variant)

---

## DB Schema: New Models

### `ProjectLLMConfig` (one per project)

```python
class ProjectLLMConfig(Base):
    __tablename__ = "project_llm_configs"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), unique=True)
    provider: Mapped[str] = mapped_column(String(50), default="openai")
    model: Mapped[str | None] = mapped_column(String(200), nullable=True)
    model_tier: Mapped[str] = mapped_column(String(20), default="quality")  # "quality" | "cheap"
    api_key_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    base_url: Mapped[str | None] = mapped_column(String(500), nullable=True)  # for local providers
    monthly_budget_usd: Mapped[float | None] = mapped_column(nullable=True)   # None = unlimited
    daily_cap_usd: Mapped[float | None] = mapped_column(nullable=True)         # None = no daily cap
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), onupdate=func.now())
```

### `LLMAuditLog` (one row per LLM call)

```python
class LLMAuditLog(Base):
    __tablename__ = "llm_audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    user_id: Mapped[str] = mapped_column(String(255))          # Zitadel user ID
    model: Mapped[str] = mapped_column(String(200))
    provider: Mapped[str] = mapped_column(String(50))
    endpoint: Mapped[str] = mapped_column(String(200))          # e.g. "llm/generate-suggestions"
    input_tokens: Mapped[int] = mapped_column(Integer)
    output_tokens: Mapped[int] = mapped_column(Integer)
    cost_estimate_usd: Mapped[float] = mapped_column()
    is_byo_key: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Indexes for dashboard queries
    __table_args__ = (
        Index("ix_llm_audit_project_date", "project_id", "created_at"),
        Index("ix_llm_audit_project_user", "project_id", "user_id"),
    )
```

### `ProjectMember` (modification — add flag)

Add to existing `ProjectMember` model:
```python
can_self_merge_structural: Mapped[bool] = mapped_column(Boolean, default=False)
```

---

## Backend API Routes

```
GET  /api/v1/projects/{id}/llm/config            # owner/admin/editor/suggester (knows if configured)
PUT  /api/v1/projects/{id}/llm/config            # owner/admin only — save provider + encrypted key + budget
POST /api/v1/projects/{id}/llm/test-connection   # owner/admin — validate key by calling provider
GET  /api/v1/projects/{id}/llm/usage             # owner/admin only — aggregated audit data
GET  /api/v1/projects/{id}/llm/status            # any authenticated user — budget_exhausted, daily_remaining
GET  /api/v1/llm/providers                       # public — list of providers with display names, key requirement
GET  /api/v1/llm/known-models                    # public — known models per provider (no key needed)
```

No `/dispatch` route is needed in Phase 11 — dispatch is added in Phase 13 when generation is implemented. Phase 11 only wires config, validation, status, and audit infrastructure.

---

## Common Pitfalls

### Pitfall 1: Fernet Key Rotation
**What goes wrong:** The Fernet key is derived from `settings.secret_key`. Changing `SECRET_KEY` env var permanently loses the ability to decrypt existing `api_key_encrypted` values.
**Why it happens:** SHA-256 derivation means the key changes if the input changes.
**How to avoid:** Document clearly in `llm_config.py` that changing `SECRET_KEY` requires re-entering all LLM API keys. Same caveat already applies to embedding keys.
**Warning signs:** Fernet decryption throws `InvalidToken` at dispatch time.

### Pitfall 2: SSRF via Custom/Local Provider base_url
**What goes wrong:** A user configures `base_url=http://169.254.169.254/` (AWS metadata endpoint) or an internal service.
**Why it happens:** The backend resolves the URL and connects to it.
**How to avoid:** Port `url_validator.py` from folio-mapper verbatim. Cloud providers: https only. Local providers: allow http but block private IP ranges unless `ALLOW_PRIVATE_URLS=true`.
**Warning signs:** Missing scheme validation or IP resolution check.

### Pitfall 3: Token Count Accuracy
**What goes wrong:** Token counts differ by provider. OpenAI responses include `usage.prompt_tokens` + `usage.completion_tokens`. Anthropic uses `input_tokens` + `output_tokens` in `response.usage`. Google has `usage_metadata.prompt_token_count` + `candidates_token_count`.
**Why it happens:** Each SDK exposes different field names.
**How to avoid:** Each provider class (`AnthropicProvider`, `GoogleProvider`, etc.) must extract token counts from the SDK response and return them alongside the text. Add a `chat_with_usage()` method or extend the base class to return `(str, int, int)`.

### Pitfall 4: BYO Key Leaking into Audit Log
**What goes wrong:** The raw BYO key value gets logged (in error messages, debug logs, or the audit table).
**Why it happens:** Exception handlers or logging middleware may capture request headers.
**How to avoid:** Strip `X-BYO-API-Key` header in logging middleware. Never log request headers verbatim. The audit log only stores `is_byo_key: True` — no key value.

### Pitfall 5: Budget Month Boundary
**What goes wrong:** Budget aggregation uses the wrong month start (e.g., using UTC date when project owner is in a different timezone, or using a stored reset date rather than `date_trunc('month', NOW())`).
**Why it happens:** D-17 says "resets on the 1st" — easiest implementation is `date_trunc('month', NOW())` in the SQL query, which is always correct.
**How to avoid:** Use PostgreSQL `date_trunc('month', NOW() AT TIME ZONE 'UTC')` in the aggregation. Do NOT store a monthly counter — compute from audit log.

### Pitfall 6: Rate Limit Redis Key Collision
**What goes wrong:** Two projects share a Redis rate limit counter because the key is `llm:rate:{user_id}:{date}` (missing project_id).
**Why it happens:** Rate limit should be per-user per-project per-day.
**How to avoid:** Key format must be `llm:rate:{project_id}:{user_id}:{YYYY-MM-DD}`. TTL = 86400s (24h rolling, safe to use `EXPIRE` on first increment).

### Pitfall 7: Frontend Budget State Staleness
**What goes wrong:** A user sees "Budget available" but their call fails because another user hit the cap between their last status fetch and the dispatch call.
**Why it happens:** Client caches the status.
**How to avoid:** Accept that the dispatch endpoint itself enforces the budget limit. The UI status is advisory (shows current state, not a lock). When a call fails with 402, show "Budget just reached — please contact the project owner." React Query should invalidate the status query on 402.

---

## Code Examples

### EmbeddingSettingsSection Structure (Template for LLMSettingsSection)

The template component lives at `app/projects/[id]/settings/page.tsx`, line 2926. Key implementation features:

1. Fetches config on mount via `useEffect` + `accessToken`
2. Local state: `provider`, `apiKey` (write-only, cleared after save), `isSaving`, `error`, `success`
3. `handleSave`: validates key required for cloud providers, calls `updateConfig`, clears apiKey field
4. Renders inside `{canManage && <LLMSettingsSection projectId={projectId} accessToken={...} />}`

### LLM Status Response (used by useLLMGate hook)

```typescript
// lib/api/llm.ts
export interface LLMStatus {
  configured: boolean;              // provider + key saved
  provider: LLMProviderType | null;
  budget_exhausted: boolean;        // monthly cap reached (non-BYO)
  daily_remaining: number | null;   // null if unlimited (admin/owner)
  monthly_budget_usd: number | null;
  monthly_spent_usd: number;
  burn_rate_daily_usd: number;      // avg daily spend last 7 days
}
```

### useLLMGate Hook Shape

```typescript
// lib/hooks/useLLMGate.ts
export function useLLMGate(projectId: string) {
  const { data: session } = useSession();
  const { data: status } = useQuery({
    queryKey: ["llm-status", projectId],
    queryFn: () => llmApi.getStatus(projectId, session!.accessToken),
    staleTime: 60_000,  // 1 min — advisory, not authoritative
    enabled: !!session?.accessToken,
  });

  const userRole = useProjectRole(projectId);
  const canUseLLM = ["owner", "admin", "editor", "suggester"].includes(userRole ?? "");

  return {
    canUseLLM: canUseLLM && status?.configured && !status?.budget_exhausted,
    budgetExhausted: status?.budget_exhausted ?? false,
    notConfigured: !status?.configured,
    dailyRemaining: status?.daily_remaining,
    isBudgetUnlimited: status?.monthly_budget_usd === null,
  };
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| litellm as dispatch intermediary | Direct provider SDKs via `get_provider()` factory | Decision D-01 | No intermediary version lag; always latest model support |
| Manual price table in code | LiteLLM pricing JSON (fetched, 7-day cache) | folio-enrich v0.4+ | Prices auto-update; 1000+ models covered |
| Single global provider config | Per-project config (follows EmbeddingConfig pattern) | Phase 11 | Different projects can use different providers |
| OpenAI SDK only | OpenAI SDK + Anthropic SDK + Google AI SDK + Cohere SDK | folio-enrich/folio-mapper | Full ecosystem coverage without litellm |

---

## Open Questions

1. **Google AI SDK — `google-generativeai` vs `google-cloud-aiplatform`**
   - What we know: folio-enrich uses `google-generativeai` (the simpler consumer SDK)
   - What's unclear: Which SDK folio-enrich exactly imports (the pyproject.toml lists neither — google deps installed lazily via `pip` inside the provider on first use)
   - Recommendation: Use `google-generativeai` (`import google.generativeai as genai`) to match folio-enrich; verify by reading `folio-enrich/backend/app/services/llm/google_provider.py` before implementing

2. **Token count extraction from Google/Cohere providers**
   - What we know: OpenAI and Anthropic both expose token counts in response objects
   - What's unclear: Whether the folio-enrich Google/Cohere providers currently surface token counts
   - Recommendation: Check the provider implementations and add usage extraction; estimate from `len(text.split()) * 1.3` as fallback if not available

3. **Monthly budget daily sub-cap enforcement priority**
   - What we know: D-17 says monthly ceiling + optional daily sub-cap
   - What's unclear: Whether daily sub-cap blocks calls even when monthly budget is not exhausted (yes, it should)
   - Recommendation: Daily sub-cap check runs first; if daily spend >= `daily_cap_usd`, reject with 429 (rate limited) not 402 (budget exhausted). Different status codes → different UI messages.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| PostgreSQL | LLM config storage, audit log | Already running | 15+ (production) | — |
| Redis | Daily rate limit counters | Already installed (arq) | 5.x | Could use Postgres, but slower |
| `openai` Python SDK | 9 of 13 providers | Not yet in ontokit-api | To be added | — |
| `anthropic` Python SDK | Anthropic provider | Not yet in ontokit-api | To be added | — |
| `google-generativeai` | Google Gemini provider | Not yet in ontokit-api | To be added | — |
| `cohere` Python SDK | Cohere provider | Not yet in ontokit-api | To be added | — |
| `cryptography.fernet` | API key encryption | Already installed via `python-jose[cryptography]` | Current | — |

**Missing dependencies with no fallback:**
- `openai`, `anthropic`, `google-generativeai`, `cohere` — must be added to `pyproject.toml` before implementation

**Missing dependencies with fallback:**
- None — all dependencies either exist or have a clear install path

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Frontend Framework | Vitest (jsdom), config at `vitest.config.ts` |
| Backend Framework | pytest + pytest-asyncio, config in `pyproject.toml` |
| Frontend quick run | `npm run test` |
| Frontend full suite | `npm run test:coverage` |
| Backend quick run | `cd ../ontokit-api && uv run pytest tests/unit/ -x -q` |
| Backend full suite | `cd ../ontokit-api && uv run pytest --cov=ontokit` |

### Phase Requirements — Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LLM-02 | API key encrypted before DB write, never returned in GET | unit | `pytest tests/unit/test_llm_config.py::test_api_key_encrypted -x` | Wave 0 |
| LLM-03 | BYO key forwarded via header, not stored | unit | `pytest tests/unit/test_llm_config.py::test_byo_key_not_stored -x` | Wave 0 |
| COST-03 | Editor rate limit 500/day enforced | unit | `pytest tests/unit/test_llm_rate_limit.py::test_editor_rate_limit -x` | Wave 0 |
| COST-04 | Suggester rate limit 100/day enforced | unit | `pytest tests/unit/test_llm_rate_limit.py::test_suggester_rate_limit -x` | Wave 0 |
| COST-07 | BYO key calls excluded from budget | unit | `pytest tests/unit/test_llm_budget.py::test_byo_excluded_from_budget -x` | Wave 0 |
| ROLE-05 | Anonymous users get 403 on any LLM endpoint | unit | `pytest tests/unit/test_llm_role_gates.py::test_anonymous_blocked -x` | Wave 0 |
| LLM-07 | Audit log written for every project-key call | unit | `pytest tests/unit/test_llm_audit.py::test_audit_log_written -x` | Wave 0 |
| LLM-01 | LLM config saved + retrieved correctly | unit | `pytest tests/unit/test_llm_config.py::test_config_round_trip -x` | Wave 0 |
| COST-02 | Budget exhaustion returns 402 + disables LLM | unit | `pytest tests/unit/test_llm_budget.py::test_budget_exhaustion_402 -x` | Wave 0 |
| byoKeyStore | BYO key persisted to/from localStorage | unit | `npm run test -- byoKeyStore` | Wave 0 |
| useLLMGate | Gate returns false for anonymous | unit | `npm run test -- useLLMGate` | Wave 0 |

### Sampling Rate

- **Per task commit:** `uv run pytest tests/unit/test_llm_*.py -x -q` (backend) + `npm run test` (frontend)
- **Per wave merge:** Full suite: `uv run pytest --cov=ontokit` + `npm run test:coverage`
- **Phase gate:** All tests green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `ontokit-api/tests/unit/test_llm_config.py` — covers LLM-01, LLM-02, LLM-03
- [ ] `ontokit-api/tests/unit/test_llm_rate_limit.py` — covers COST-03, COST-04
- [ ] `ontokit-api/tests/unit/test_llm_budget.py` — covers COST-01, COST-02, COST-07
- [ ] `ontokit-api/tests/unit/test_llm_role_gates.py` — covers ROLE-01 through ROLE-05
- [ ] `ontokit-api/tests/unit/test_llm_audit.py` — covers LLM-07
- [ ] `ontokit-web/__tests__/lib/stores/byoKeyStore.test.ts` — BYO key store
- [ ] `ontokit-web/__tests__/lib/hooks/useLLMGate.test.ts` — LLM gate hook
- [ ] Alembic migration: `u9v0w1x2y3z4_add_llm_config_and_audit_tables.py`

---

## Sources

### Primary (HIGH confidence — live code verified)

- `folio-enrich/backend/app/services/llm/` — Full LLM provider implementation (base, registry, 5 provider classes, pricing, openai_compat)
- `folio-enrich/backend/app/models/llm_models.py` — `LLMProviderType` enum (13 values), `ModelInfo`, `ConnectionTestRequest`
- `folio-mapper/backend/app/services/llm/registry.py` — Registry with SSRF validation, `sort_and_enrich_models`, `PROVIDER_ENV_VAR`
- `folio-mapper/backend/app/services/llm/url_validator.py` — SSRF protection implementation
- `folio-mapper/backend/app/models/llm_models.py` — Independent identical enum (confirms cross-repo consistency)
- `ontokit-api/ontokit/services/embedding_service.py` — Fernet encryption pattern (lines 41-52)
- `ontokit-api/ontokit/models/embedding.py` — `ProjectEmbeddingConfig` DB model (template for `ProjectLLMConfig`)
- `ontokit-api/ontokit/api/routes/embeddings.py` — Embedding route pattern (template for LLM routes)
- `ontokit-web/lib/api/embeddings.ts` — `EmbeddingProvider` type, API client pattern for new `lib/api/llm.ts`
- `ontokit-web/lib/stores/editorModeStore.ts` — Zustand persist pattern for `byoKeyStore.ts`
- `ontokit-web/app/projects/[id]/settings/page.tsx` (line 2926) — `EmbeddingSettingsSection` template
- `ontokit-web/components/projects/member-list.tsx` — Member list structure for `can_self_merge_structural` toggle

### Secondary (MEDIUM confidence — inferred from codebase structure)

- `ontokit-api/pyproject.toml` — Confirms `cryptography` available via `python-jose[cryptography]`; `openai`/`anthropic` not yet present (must be added)
- `folio-mapper/backend/pyproject.toml` — Confirms `openai>=1.0.0,<2.0.0`, `anthropic>=0.18.0,<1.0.0`, `alea-llm-client>=0.2.0`

---

## Metadata

**Confidence breakdown:**
- Provider list (D-02): HIGH — verified from both repos; enums are identical
- Encryption pattern: HIGH — Fernet pattern verified in embedding_service.py
- Pricing mechanism: HIGH — LiteLLM JSON approach verified in both repos
- Rate limiting (Redis): HIGH — Redis already in ontokit-api stack; INCR/EXPIRE is standard
- Frontend patterns: HIGH — EmbeddingSettingsSection and Zustand persist patterns verified
- Google/Cohere token extraction: LOW — provider implementations not deeply read; flag for implementation verification

**Research date:** 2026-04-05
**Valid until:** 2026-05-05 (stable patterns; provider SDKs are version-pinned in lock files)
