# Phase 11: Roles, LLM Abstraction & Cost Controls - Context

**Gathered:** 2026-04-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Project owners can configure LLM providers with cost-capped access, and every role (admin/editor/suggester/anonymous) knows exactly which LLM affordances it can reach. This phase delivers: per-role gating, multi-provider LLM dispatch, project budget caps, per-user rate limits, BYO-key support, audit logging, and a usage dashboard. It does NOT deliver suggestion generation, duplicate detection, or inline suggestion UX (those are Phases 12-14).

</domain>

<decisions>
## Implementation Decisions

### LLM Dispatch Strategy
- **D-01:** Direct provider SDKs — backend calls OpenAI, Anthropic, Ollama, etc. directly (not ALEA LLM Client or litellm). Simple, always supports latest models, no intermediary dependency.
- **D-02:** Provider list matches whatever folio-enrich and folio-mapper already support. Researcher must check those repos for the exact list.
- **D-03:** Project-level default model tier (quality/cheap) + per-call override. Owner sets default in settings; individual calls can toggle to the other tier.
- **D-04:** Local model support (Ollama/compatible endpoints) is first-class at launch, not deferred. Users configure a local endpoint URL in project settings alongside cloud providers.

### BYO-Key Routing
- **D-05:** BYO-key calls proxy through the backend — browser sends key per-request (in-memory only, NOT stored server-side). Avoids CORS issues, enables audit trail.
- **D-06:** BYO calls count against the user's daily rate limit (500/day editor, 100/day suggester) but do NOT count against the project budget (per COST-07).
- **D-07:** BYO key stored in browser localStorage. On entry, backend makes a lightweight provider call to validate the key works before accepting it.

### Audit Logging
- **D-08:** Metadata only — log timestamp, user ID, model name, token count (input+output), cost estimate, endpoint called. No prompt or response content stored. Privacy-safe.
- **D-09:** Backend maintains a price-per-token table for estimated cost alongside token counts. Dashboard shows both.

### LLM Settings UI
- **D-10:** New "AI / LLM" section in existing project settings page (owner/admin only). Follows existing settings page pattern.
- **D-11:** Dropdown provider picker with provider name + small logo. API key field appears below the dropdown.
- **D-12:** One active provider at a time per project. Matches how embeddings config works today. No multi-provider routing.
- **D-13:** BYO key entry via two paths: (1) inline toggle in AI/LLM settings section, and (2) just-in-time popover on first LLM action if no BYO key is set. Popover links back to settings for review/changes.

### Usage Dashboard & Budget
- **D-14:** Usage dashboard lives as a tab/section within project settings (owner/admin only).
- **D-15:** Summary bar (budget used/remaining, burn rate) + table of per-user daily call counts and estimated cost. No charts at launch — can add later.
- **D-16:** Budget exhaustion: LLM action buttons become disabled with tooltip "LLM budget exhausted for this month." Subtle banner in editor header. Manual suggestions remain fully functional.
- **D-17:** Monthly budget ceiling + optional daily sub-cap. Prevents one heavy day from burning the whole month. Resets on the 1st.

### Role Override Permissions
- **D-18:** Per-user toggle in existing member list: "Can self-merge structural PRs" (default: off for editors). Admin flips it for trusted editors. Minimal UI addition to existing Members section.
- **D-19:** Visible role-based LLM access indicator near LLM features — small badge showing limits (e.g., "Editor — 500 calls/day"). Users know their limits upfront.
- **D-20:** Admin self-merge requires confirmation dialog: "You are about to merge this directly. Continue?" One extra click, prevents accidents.

### Claude's Discretion
- Exact provider logo assets and dropdown styling
- Price-per-token table update mechanism (config file vs. admin UI)
- Exact popover placement and dismissal behavior for BYO key prompt
- localStorage key naming for BYO key store
- Usage table pagination / date range defaults

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — ROLE-01 through ROLE-05, LLM-01 through LLM-07, COST-01 through COST-07 (all mapped to Phase 11)

### Role & Permission System
- `lib/api/projects.ts` — `ProjectRole` type definition, `ProjectMember` interface, project API client
- `app/projects/[id]/settings/page.tsx` — Existing settings page structure, `canManage`/`isOwner` role gates, member management UI

### Existing Multi-Provider Pattern
- `lib/api/embeddings.ts` — `EmbeddingProvider` type, `EmbeddingConfig`/`EmbeddingConfigUpdate` interfaces, provider + API key + model pattern. This is the model for how LLM config should work.

### Auth & Session
- `lib/auth-mode.ts` — `getAuthMode()`, `isZitadelConfigured()`, `isAuthRequired()`
- `auth.ts` — NextAuth config, session with `accessToken`

### API Client Pattern
- `lib/api/client.ts` — `api.get/post/put/patch/delete`, `ApiError`, Bearer token auth, retry logic

### Existing Suggestion Flow
- `lib/api/suggestions.ts` — Suggestion API client (session CRUD, save, submit, review)
- `lib/hooks/useSuggestionSession.ts` — Session lifecycle hook

### Stores
- `lib/stores/editorModeStore.ts` — Zustand persist pattern for editor preferences (model for BYO key store)

### External Repos (researcher must check)
- `folio-enrich` — Check which LLM providers are supported (determines D-02 provider list)
- `folio-mapper` — Check which LLM providers are supported (determines D-02 provider list)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ProjectRole` type (`lib/api/projects.ts`): owner/admin/editor/suggester/viewer already defined — extend with LLM access levels
- `EmbeddingConfig` pattern (`lib/api/embeddings.ts`): provider + API key + model config — direct model for LLM config
- `EmbeddingSettingsSection` (in settings page): existing provider/key/model UI — can adapt for LLM section
- Settings page role gates (`canManage`, `isOwner`): reuse for gating AI/LLM section
- Zustand + localStorage persist pattern: reuse for BYO key store
- React Query hooks: reuse for `useLLMConfig`, `useLLMUsage` hooks

### Established Patterns
- API client: typed methods with Bearer token auth, `ApiError` class, retry logic
- Settings page: fetch on mount, role-gate sections, separate form components, toast notifications
- Stores: Zustand with `persist` middleware, `createJSONStorage(() => localStorage)`

### Integration Points
- Project settings page: add "AI / LLM" section and "Usage" tab
- Member list component: add per-user "Can self-merge structural" toggle
- Editor header: budget exhaustion banner + role/limit indicator badge
- LLM action buttons (future phases): disabled state + tooltip when budget exhausted
- New API client: `lib/api/llm.ts` following `embeddings.ts` pattern

</code_context>

<specifics>
## Specific Ideas

- Provider list should match folio-enrich + folio-mapper exactly — consistency across the ALEA/CatholicOS toolchain
- BYO key popover should feel like a just-in-time onboarding moment, not a blocker — "Enter your API key to use AI features" with a link to settings for full config
- Usage dashboard is functional, not flashy — summary bar + table is enough. Charts can come in a future phase.
- The budget exhaustion state must be clearly distinct from "provider not configured" — two different states, two different messages

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 11-roles-llm-abstraction-cost-controls*
*Context gathered: 2026-04-05*
