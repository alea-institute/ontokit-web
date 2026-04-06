# Phase 11: Roles, LLM Abstraction & Cost Controls - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-05
**Phase:** 11-roles-llm-abstraction-cost-controls
**Areas discussed:** LLM dispatch strategy, LLM settings & BYO-key UX, Usage dashboard & budget UX, Role override permissions

---

## LLM Dispatch Strategy

### How should the backend dispatch LLM calls to providers?

| Option | Description | Selected |
|--------|-------------|----------|
| Direct provider SDKs | Backend calls OpenAI, Anthropic, Ollama SDKs directly. Simple, always supports latest models. | ✓ |
| ALEA LLM Client wrapper | Route through ALEA's existing multi-provider dispatch. Reuses existing code but adds dependency layer. | |
| litellm / unified proxy | Normalize all providers behind one interface. Broad support, but adds abstraction layer. | |

**User's choice:** Direct provider SDKs
**Notes:** Aligns with how folio-enrich/folio-mapper already call providers directly.

### Which cloud providers should be supported at launch?

| Option | Description | Selected |
|--------|-------------|----------|
| OpenAI + Anthropic | Two major providers cover most use cases. | |
| OpenAI + Anthropic + Google | Add Gemini as a third option. | |
| OpenAI only to start | Simplest launch. | |

**User's choice:** Other — "Support all providers that folio-enrich and folio-mapper support."
**Notes:** Researcher must check those repos for the exact provider list.

### Model tier selection (quality vs cheap)

| Option | Description | Selected |
|--------|-------------|----------|
| Project-level default + per-call override | Owner sets default, individual calls can override. | ✓ |
| Project-level default only | Owner picks one tier for whole project. | |
| Per-call choice only | User chooses each time. | |

**User's choice:** Project-level default + per-call override

### Ollama/local model support timing

| Option | Description | Selected |
|--------|-------------|----------|
| First-class at launch | Users configure local endpoint URL alongside cloud providers. | ✓ |
| Stub the config, implement later | Show field but don't wire dispatch yet. | |

**User's choice:** First-class at launch

### BYO-key routing

| Option | Description | Selected |
|--------|-------------|----------|
| Browser-direct to provider | Key never touches server. True BYO but CORS constraints, no audit. | |
| Proxy through backend | Browser sends key per-request (not stored). Avoids CORS, enables audit. | ✓ |
| User chooses per-key | Let user decide direct vs proxied. | |

**User's choice:** Proxy through backend

### BYO-key rate limiting

| Option | Description | Selected |
|--------|-------------|----------|
| Rate limit yes, budget no | BYO calls count toward daily rate limit but not project budget. | ✓ |
| No limits for BYO | Fully uncapped. | |
| Separate BYO rate limit | Higher limit for BYO users. | |

**User's choice:** Rate limit yes, budget no

### BYO-key storage and validation

| Option | Description | Selected |
|--------|-------------|----------|
| localStorage + validate on save | Persist in localStorage, validate via lightweight provider call. | ✓ |
| localStorage, no validation | Store immediately, let first real call fail. | |
| Session-only (no persist) | Memory only, cleared on tab close. | |

**User's choice:** localStorage + validate on save

### Audit logging detail level

| Option | Description | Selected |
|--------|-------------|----------|
| Metadata only | Timestamp, user, model, tokens, cost estimate. No prompt/response. | ✓ |
| Metadata + prompt hash | Same plus hash for deduplication analysis. | |
| Full content logging | Store prompt and response. | |

**User's choice:** Metadata only

### Cost estimate approach

| Option | Description | Selected |
|--------|-------------|----------|
| Token counts + estimated cost | Backend maintains price-per-token table. Shows both. | ✓ |
| Token counts only | Log tokens, let consumer do cost math. | |
| Provider-reported cost | Use cost field from provider API responses when available. | |

**User's choice:** Token counts + estimated cost

---

## LLM Settings & BYO-Key UX

### Settings page location

| Option | Description | Selected |
|--------|-------------|----------|
| New 'AI / LLM' section | Dedicated section in project settings. | ✓ |
| Merged with Embeddings section | Combine into 'AI Settings'. | |
| Separate settings page | New route /projects/[id]/settings/llm. | |

**User's choice:** New 'AI / LLM' section

### Provider picker design

| Option | Description | Selected |
|--------|-------------|----------|
| Dropdown with provider logos | Select from dropdown with name + logo. | ✓ |
| Card-per-provider grid | Each provider as a card with logo and status. | |
| Tab-per-provider | Horizontal tabs, each with own config. | |

**User's choice:** Dropdown with provider logos

### Multi-provider support

| Option | Description | Selected |
|--------|-------------|----------|
| One active provider at a time | Owner picks one. Matches embeddings pattern. | ✓ |
| Multiple providers, per-tier | Different provider for quality vs cheap. | |
| Multiple providers, fallback chain | Primary + fallback on failure. | |

**User's choice:** One active provider at a time

### BYO key entry location

| Option | Description | Selected |
|--------|-------------|----------|
| Inline in AI/LLM settings | Below project config, 'Use your own key' toggle. | ✓ |
| User profile / account page | Separate page, applies across projects. | |
| Popover on first LLM action | Just-in-time prompt when user triggers LLM feature. | ✓ |

**User's choice:** Both inline AND popover on first LLM action
**Notes:** Dual entry points — inline for deliberate config, popover for just-in-time onboarding. Popover links to settings.

---

## Usage Dashboard & Budget UX

### Dashboard location

| Option | Description | Selected |
|--------|-------------|----------|
| Tab in project settings | Within existing settings page. Owner/admin only. | ✓ |
| Dedicated route | Separate page /projects/[id]/usage. | |
| Inline in AI/LLM section | Below LLM config. | |

**User's choice:** Tab in project settings

### Dashboard content

| Option | Description | Selected |
|--------|-------------|----------|
| Table + summary stats | Summary bar + per-user daily table. No charts at launch. | ✓ |
| Chart + table | Line chart + per-user breakdown. | |
| Summary stats only | Headline numbers only, no per-user breakdown. | |

**User's choice:** Table + summary stats

### Budget exhaustion behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Disabled buttons + banner | Buttons disabled with tooltip, banner in editor header. | ✓ |
| Modal on first attempt | Modal explains exhaustion, offers BYO key or manual mode. | |
| Toast notification + fallback | Toast first time, then silently skip LLM calls. | |

**User's choice:** Disabled buttons + banner

### Budget period

| Option | Description | Selected |
|--------|-------------|----------|
| Monthly only | Resets on the 1st. One number to configure. | |
| Monthly with daily sub-cap | Monthly ceiling + optional daily max. | ✓ |

**User's choice:** Monthly with daily sub-cap
**Notes:** Prevents one heavy day from burning the whole monthly budget.

---

## Role Override Permissions

### Admin override configuration

| Option | Description | Selected |
|--------|-------------|----------|
| Per-user toggle in member list | Each editor row gets "Can self-merge structural PRs" toggle. | ✓ |
| Permission presets | 'Standard editor' vs 'Trusted editor' preset roles. | |
| Custom permission matrix | Full rows=users, columns=permissions matrix. | |

**User's choice:** Per-user toggle in member list

### Role-based LLM access visibility

| Option | Description | Selected |
|--------|-------------|----------|
| Visible indicator | Badge near LLM features showing limits. | ✓ |
| Invisible, show on limit | Don't show until user hits a limit. | |
| Visible in settings only | Show in profile/settings, not inline. | |

**User's choice:** Visible indicator

### Admin self-merge confirmation

| Option | Description | Selected |
|--------|-------------|----------|
| Immediate merge, no confirmation | Trusts admin judgment. Fast. | |
| Confirmation dialog | "You are about to merge this directly. Continue?" | ✓ |
| Time delay | Merge after 5-minute cancelable delay. | |

**User's choice:** Confirmation dialog

---

## Claude's Discretion

- Exact provider logo assets and dropdown styling
- Price-per-token table update mechanism
- Exact popover placement and dismissal for BYO key prompt
- localStorage key naming for BYO key store
- Usage table pagination / date range defaults

## Deferred Ideas

None — discussion stayed within phase scope
