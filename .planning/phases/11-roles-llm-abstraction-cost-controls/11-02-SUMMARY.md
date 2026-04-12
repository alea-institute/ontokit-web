---
phase: 11-roles-llm-abstraction-cost-controls
plan: "02"
subsystem: backend-llm-api
tags: [llm, rate-limiting, budget, audit, role-gates, fastapi, redis]
dependency_graph:
  requires: ["11-01"]
  provides: ["11-03", "11-04"]
  affects: ["ontokit-api backend LLM surface"]
tech_stack:
  added: []
  patterns:
    - Redis INCR+EXPIRE for daily rate limiting
    - SQLAlchemy coalesce(sum(), 0.0) for NULL-safe aggregation
    - Two-router pattern (project-scoped + public) in FastAPI
    - Fernet encryption for API key storage (via crypto.py from Plan 01)
key_files:
  created:
    - ../ontokit-api/ontokit/services/llm/rate_limiter.py
    - ../ontokit-api/ontokit/services/llm/budget.py
    - ../ontokit-api/ontokit/services/llm/audit.py
    - ../ontokit-api/ontokit/services/llm/role_gates.py
    - ../ontokit-api/ontokit/api/routes/llm.py
  modified:
    - ../ontokit-api/ontokit/services/llm/__init__.py
    - ../ontokit-api/ontokit/api/routes/__init__.py
decisions:
  - "Two-router pattern in llm.py: project-scoped `router` + public `public_router` to avoid prefix collision between /projects/... and /llm/providers"
  - "get_usage_summary returns budget_consumed_pct=0.0 as a stub; the route patches it with config context to avoid circular dependency"
  - "Status route reports rate limit as the static cap value (not real-time Redis count) to avoid needing Redis dependency injection at the route level"
  - "check_rate_limit fails open (returns True) when Redis unavailable to avoid blocking legitimate users during Redis downtime"
metrics:
  duration_minutes: 7
  completed_date: "2026-04-06"
  tasks_completed: 2
  files_changed: 7
---

# Phase 11 Plan 02: Rate Limiting, Budget Enforcement, Role Gates, and LLM API Routes Summary

Rate limiting, budget enforcement, audit logging, and role gates as backend services; 7 FastAPI routes wired for LLM config/status/usage/test-connection and public provider catalogue.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Create rate limiter, budget enforcer, role gates, and audit logger services | 119e501 | rate_limiter.py, budget.py, audit.py, role_gates.py, llm/__init__.py |
| 2 | Create FastAPI routes for LLM config, status, usage, test-connection, and providers | 9d1d7ca | llm.py routes, routes/__init__.py |

## What Was Built

### Services (Task 1)

**`rate_limiter.py`** — Redis-based daily rate limiting per user-project pair.
- `RATE_LIMITS`: editor=500, suggester=100, owner/admin=None (unlimited), viewer=0
- `check_rate_limit()`: Redis INCR+EXPIRE(86400) pattern; fails open on Redis error
- `get_remaining_calls()`: returns None (unlimited), 0 (blocked), or remaining count
- Key format: `llm:rate:{project_id}:{user_id}:{YYYY-MM-DD}`

**`budget.py`** — Monthly budget enforcement against LLMAuditLog aggregation.
- `get_monthly_spend()` / `get_daily_spend()`: SUM with `is_byo_key=False` filter (BYO calls don't count against budget)
- `check_budget()`: checks daily sub-cap BEFORE monthly budget (per Open Question 3)
- `get_budget_status()`: full dict with spent/budget/pct/burn_rate for status endpoint

**`audit.py`** — Audit log writer and usage aggregation.
- `log_llm_call()`: writes metadata-only LLMAuditLog row (no prompt/response content — D-08)
- `get_usage_summary()`: per-user breakdown (calls today, this month, cost, is_byo_key)

**`role_gates.py`** — Per-role LLM access control.
- `check_llm_access()`: owner/admin/editor/suggester → True; viewer/anonymous → False
- `get_role_description()`: capability map including default can_self_merge_structural values

### Routes (Task 2)

**`llm.py`** — Two APIRouter instances:
- `router` (project-scoped, registered with `prefix="/projects"`):
  - `GET /{project_id}/llm/config` — returns LLMConfigResponse with api_key_set bool, never the raw key
  - `PUT /{project_id}/llm/config` — upsert config; encrypts API key via Fernet; validates base_url (SSRF)
  - `POST /{project_id}/llm/test-connection` — reads X-BYO-API-Key header; 10s timeout; sanitizes key from error messages
  - `GET /{project_id}/llm/status` — budget exhaustion + daily remaining for caller's role
  - `GET /{project_id}/llm/usage` — owner/admin only; per-user monthly breakdown with budget_consumed_pct
  - `PATCH /{project_id}/members/{user_id}/flags` — toggle can_self_merge_structural (ROLE-03)
- `public_router` (no auth, registered at root):
  - `GET /llm/providers` — full provider list with display_name, requires_api_key, icon_name
  - `GET /llm/known-models` — all well-known models from KNOWN_MODELS registry

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Deviation] Two-router split for public/project-scoped routes**
- **Found during:** Task 2
- **Issue:** Including the same router twice (once with `/projects` prefix, once without) would register duplicate routes. The plan's `router` variable is singular but serves two URL namespaces.
- **Fix:** Created `public_router` in `llm.py` for the two public catalogue routes; `router` handles all project-scoped routes. Both registered separately in `__init__.py`.
- **Files modified:** `ontokit/api/routes/llm.py`, `ontokit/api/routes/__init__.py`
- **Commit:** 9d1d7ca

**2. [Rule 2 - Missing functionality] BYO key sanitized from error output**
- **Found during:** Task 2, test-connection route
- **Issue:** Exception messages from provider clients can echo the API key back in error strings (e.g. "Invalid key: sk-abc123...").
- **Fix:** After catching the exception, check if the resolved api_key appears in the error string and replace it with `[REDACTED]`. Per Pitfall 4 from RESEARCH.md.
- **Files modified:** `ontokit/api/routes/llm.py`
- **Commit:** 9d1d7ca

## Known Stubs

- **`get_usage_summary()` returns `budget_consumed_pct=0.0`** (`audit.py`): The function has no access to ProjectLLMConfig, so it cannot compute the percentage. The route (`/llm/usage`) patches this value after calling `get_usage_summary()` with the config context. Consumers of `get_usage_summary()` directly must do the same.
- **`/llm/status` daily_remaining**: Returns the static cap (not real-time Redis count) when Redis is not injected. Phase 13 (dispatch layer) will inject Redis into the status route for live remaining-call counts.

## Self-Check: PASSED
