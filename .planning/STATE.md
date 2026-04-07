---
gsd_state_version: 1.0
milestone: v0.4.0
milestone_name: LLM-Assisted Ontology Improvements
status: planning
stopped_at: Completed 14-04-PLAN.md
last_updated: "2026-04-07T18:33:13.220Z"
last_activity: 2026-04-07
progress:
  total_phases: 10
  completed_phases: 7
  total_plans: 26
  completed_plans: 26
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-05)

**Core value:** Enable grassroots-level collaborative ontology editing in a modern, accessible web interface — where SMEs rapidly improve their ontology with LLM assistance while preserving integrity through human curation.
**Current focus:** Phase 13 — validation-guardrails-suggestion-generation

## Current Position

Phase: 14
Plan: Not started
Status: Phase complete — ready for verification
Last activity: 2026-04-07

Progress: [ ] 0% (v0.4.0 phases)

## Performance Metrics

**Velocity:**

- Total plans completed: 0 (this milestone)
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

*Updated after each plan completion*
| Phase 08-optional-auth P01 | 4min | 2 tasks | 3 files |
| Phase 08-optional-auth P02 | 284 | 4 tasks | 9 files |
| Phase 10-anonymous-suggestions P01 | 525602min | 3 tasks | 7 files |
| Phase 10-anonymous-suggestions P02 | 2 | 2 tasks | 4 files |
| Phase 10-anonymous-suggestions P03 | 9 | 2 tasks | 6 files |
| Phase 11-roles-llm-abstraction-cost-controls P00 | 5 | 2 tasks | 7 files |
| Phase 11-roles-llm-abstraction-cost-controls P03 | 2 | 2 tasks | 6 files |
| Phase 11-roles-llm-abstraction-cost-controls P01 | 6 | 2 tasks | 18 files |
| Phase 11-roles-llm-abstraction-cost-controls P04 | 7 | 2 tasks | 3 files |
| Phase 11-roles-llm-abstraction-cost-controls P02 | 7 | 2 tasks | 7 files |
| Phase 11-roles-llm-abstraction-cost-controls P05 | 4 | 3 tasks | 8 files |
| Phase 12-toolchain-integration-duplicate-detection P00 | 2 | 1 tasks | 6 files |
| Phase 12 P01 | 2 | 2 tasks | 4 files |
| Phase 12-toolchain-integration-duplicate-detection P02 | 7 | 2 tasks | 7 files |
| Phase 12 P03 | 30 | 2 tasks | 6 files |
| Phase 12 P04 | 18 | 2 tasks | 6 files |
| Phase 13-validation-guardrails-suggestion-generation P00 | 2 | 1 tasks | 4 files |
| Phase 13-validation-guardrails-suggestion-generation P01 | 5 | 2 tasks | 4 files |
| Phase 13-validation-guardrails-suggestion-generation P02 | 5 | 2 tasks | 9 files |
| Phase 13-validation-guardrails-suggestion-generation P03 | 15 | 2 tasks | 4 files |
| Phase 14-inline-suggestion-ux-property-support P00 | 1 | 1 tasks | 3 files |
| Phase 14 P01 | 3 | 2 tasks | 6 files |
| Phase 14 P02 | 3 | 2 tasks | 8 files |
| Phase 14 P03 | 11 | 2 tasks | 7 files |
| Phase 14 P04 | 5 | 2 tasks | 4 files |

## Accumulated Context

### Decisions

- [v0.4.0]: ALEA LLM Client serves as LLM abstraction layer — no need to rebuild multi-provider dispatch
- [v0.4.0]: Project keys route through backend proxy; BYO-keys stay in browser — protects project owner's bill
- [v0.4.0]: Whole-ontology duplicate detection (not local neighborhood) — cross-branch duplicates fragment the ontology
- [v0.4.0]: Hybrid clustering D+E with max-50/min-3 shards — balance reviewer load against PR churn
- [v0.4.0]: Anonymous users get no LLM access — cost control + insufficient abuse signal
- [v0.4.0]: Property support included in v0.4.0 (not deferred) — generation pipeline is uniform, validation diverges cheaply
- [v0.4.0]: Generative FOLIO + folio-python + OpenGloss + OWL reasoner = toolchain — use existing tools, don't rebuild
- [v0.4.0]: Per-role access: admin self-merge all, editor annotations-only, suggester routes to session flow
- [v0.3.0]: CatholicOS main is long-term truth — Mike's folio-adapter was a deadline hack
- [v0.3.0]: Auth optional via `AUTH_DISABLED` env var — avoids maintaining two codebases
- [v0.3.0]: Bare metal deploy (no Docker) — server already set up this way, working fine
- [Phase 08-optional-auth]: AUTH_MODE=optional leaves RequiredUser 401ing — no code change needed for write protection
- [Phase 08-optional-auth]: ANONYMOUS_USER has roles=['viewer'] for least-privilege unauthenticated access
- [Phase 08-optional-auth]: AUTH_MODE env var gates Zitadel OIDC — optional/disabled modes enable anonymous browsing
- [Phase 08-optional-auth]: NEXT_PUBLIC_AUTH_MODE and NEXT_PUBLIC_ZITADEL_CONFIGURED expose auth mode to client via next.config.ts
- [Phase 08-optional-auth]: Sign-in UI completely hidden when Zitadel unconfigured — graceful degradation for FOLIO without auth
- [Phase 10-anonymous-suggestions]: Anonymous token uses anon: HMAC prefix to prevent type confusion with beacon tokens sharing the same SECRET_KEY
- [Phase 10-anonymous-suggestions]: Honeypot field aliased as 'website' — silent fake success prevents bots from learning they were blocked
- [Phase 10-anonymous-suggestions]: submitter_name/email stored as separate columns to preserve audit trail while allowing credit display post-submit
- [Phase Phase 10-anonymous-suggestions]: Anonymous token store uses createJSONStorage(() => localStorage) — avoids SSR issues, consistent with draftStore pattern
- [Phase Phase 10-anonymous-suggestions]: CreditModal appears post-submit so it does not block suggestion submission — callers render it conditionally on a showCreditModal flag
- [Phase Phase 10-anonymous-suggestions]: CreditModal opens pre-submit so credit info is passed directly to submitSession() in one API call
- [Phase Phase 10-anonymous-suggestions]: isAnonymousProposalMode overrides canEdit/isSuggestionMode to reuse existing form-editing infrastructure
- [Phase 11-roles-llm-abstraction-cost-controls]: Wave 0 stubs created before implementation so downstream plans can verify against real code without test-discovery failures
- [Phase 11-roles-llm-abstraction-cost-controls]: BYO key never sent to backend for storage — forwarded as X-BYO-API-Key header per-request only (D-05)
- [Phase 11-roles-llm-abstraction-cost-controls]: useLLMGate is advisory frontend-only; canUseLLM=false for anonymous users always; consumers call invalidateStatus() on 402 response
- [Phase 11-roles-llm-abstraction-cost-controls]: GoogleProvider uses httpx REST not google-generativeai SDK — SDK deprecated July 2025, REST is more stable
- [Phase 11-roles-llm-abstraction-cost-controls]: chat() returns (text, input_tokens, output_tokens) tuple — audit log requires token counts without separate API call
- [Phase 11-roles-llm-abstraction-cost-controls]: Budget inputs live in LLMSettingsSection (single save CTA); LLMUsageSection receives monthlyBudgetUsd prop for display only
- [Phase 11-roles-llm-abstraction-cost-controls]: testConnection called before updateConfig when new API key provided — invalid key blocks save
- [Phase 11-roles-llm-abstraction-cost-controls]: Two-router pattern in llm.py: project-scoped router + public public_router to avoid prefix collision between /projects/... and /llm/providers
- [Phase 11-roles-llm-abstraction-cost-controls]: check_rate_limit fails open (returns True) when Redis unavailable to avoid blocking legitimate users during Redis downtime
- [Phase Phase 11-roles-llm-abstraction-cost-controls]: AdminSelfMergeDialog uses custom dialog (not ConfirmDialog) to satisfy role=dialog + aria-modal requirements; UI-SPEC copy takes precedence over plan task spec where they differ
- [Phase Phase 12-00]: Wave 0 stubs created before implementation so downstream plans can run pytest --co without discovery failures (Nyquist compliance pattern)
- [Phase 12-01]: HNSW index wrapped in PL/pgSQL EXCEPTION WHEN others block — graceful fallback for pgvector < 0.5.0 so migration succeeds on older dev environments
- [Phase 12-01]: DuplicateVerdict and CandidateSource defined as Literal aliases (not Enum) — consistent with existing schema patterns in embeddings.py and quality.py
- [Phase 12-toolchain-integration-duplicate-detection]: RDFLib used for cycle detection instead of owlready2 is_a traversal — owlready2/HermiT normalizes cycles into class equivalences before Python can observe them
- [Phase 12-toolchain-integration-duplicate-detection]: Validation endpoint fallback uses load_project_graph() + graph.serialize() not storage.get_source() — StorageService has no get_source() method
- [Phase 12]: EmbeddingService lazy imports require patching at source module (ontokit.services.embedding_service.EmbeddingService) not call site
- [Phase 12]: async def side_effect functions in tests avoid coroutine-awaiting ambiguity vs AsyncMock.side_effect with nested coroutines
- [Phase 12]: rejected_iri in DuplicateRejection must be the entity IRI (data.entity_iri), not the session branch — _get_rejection_info queries by entity IRI
- [Phase 12]: Test block verdict requires parent_iri; without it max composite=0.80 (exact+semantic ceiling) which lands on pass/warn boundary
- [Phase 13-validation-guardrails-suggestion-generation]: Wave 0 stubs use @pytest.mark.skip decorator (not pytest.skip() in body) — consistent with Phase 11-12 established pattern
- [Phase 13-validation-guardrails-suggestion-generation]: Unit-level conftest.py created at tests/unit/ to scope Phase 13 fixtures without polluting top-level conftest.py
- [Phase Phase 13-01]: VALID-03 uses OntologyIndexService.get_ancestor_path() SQL CTE not ReasonerService DFS — lightweight pre-submit gate per RESEARCH.md Pitfall 2
- [Phase Phase 13-01]: VALID-04 skips namespace check when entity_iri empty/None — IRI minted after validation in generation pipeline
- [Phase Phase 13-01]: CONTROLLED_RELATIONSHIP_TYPES as list[str] not Literal — allows runtime iteration; Literal aliases reserved for schema type discrimination
- [Phase 13-validation-guardrails-suggestion-generation]: quality_filter.py uses plain string/list signatures instead of ConceptGenerationOutput — ontokit-api has no Pydantic model for that type
- [Phase 13-validation-guardrails-suggestion-generation]: prompts/__init__.py avoids 'from __future__ import annotations' and aliases annotations module as annotations_module to prevent Python __future__ import shadowing the module name
- [Phase 13-validation-guardrails-suggestion-generation]: SuggestionGenerationService.generate() runs validate+dedup sequentially per suggestion — AsyncSession not safe for concurrent use (Pitfall 5)
- [Phase 13-validation-guardrails-suggestion-generation]: generate_suggestions catches non-auth LLM errors and returns empty suggestions list rather than 500 — prevents cascade failures from malformed LLM output
- [Phase 13-validation-guardrails-suggestion-generation]: validate-entity endpoint defaults to branch='main' since ValidateEntityRequest has no branch field — consistent with schema definition
- [Phase 14-inline-suggestion-ux-property-support]: Wave 0 stubs follow project pattern: import only describe/it, use comments referencing downstream plan number
- [Phase 14]: Non-persisted Zustand store (no localStorage) since suggestions are session-ephemeral per D-13
- [Phase 14]: Store key format entityIri::suggestionType for composite keying of per-section suggestions
- [Phase 14]: AbortController cleanup on entityIri change prevents stale suggestion responses from overwriting current entity
- [Phase 14]: Lucide AlertTriangle icon wrapped in span for title tooltip -- Lucide components do not accept title prop directly
- [Phase 14]: BranchNavigator returns null when siblings <= 1 -- avoids rendering noise for single-child branches
- [Phase 14]: PendingSuggestionBadge uses button element for click-to-scroll affordance with hover state
- [Phase 14]: Suggestion hooks placed after helper function declarations to avoid block-scoped variable reference errors
- [Phase 14]: Children section only renders when canUseLLM is true since existing panel has no child list section
- [Phase 14]: Sparkle badge uses Lucide Sparkles icon (amber-500) matching SuggestionCard sparkle styling
- [Phase 14]: Reused children suggestion type for new property entity creation -- backend treats children uniformly
- [Phase 14]: Domain/Range sections share edgesSuggestions hook -- relationship_type field distinguishes domain vs range
- [Phase 14]: Sub-Properties section only renders when canUseLLM is true since existing panel has no sub-property list

### Key Facts

- v0.4.0 feature branch: tested on FOLIO first, then proposed upstream to CatholicOS
- Existing infra to reuse: suggestion sessions, drafts, embeddings API, analytics API, quality API, anonymous tokens
- Success metrics (all required): 50+ annotations/hour, ≥70% admin acceptance, zero duplicates in first month
- Rate limits: editors 500/day LLM calls, suggesters 100/day, anonymous 0
- Duplicate thresholds: block >0.95, warn >0.80, pass below 0.80 (composite score)
- Shard bounds: max 50 items, min 3 (small orphans roll into "Miscellaneous improvements")
- ALEA forks have zero unique commits on main — clean fast-forward, no conflicts expected
- Production server: 54.224.195.12, Ubuntu 24.04 ARM64, Caddy + systemd, 8GB RAM, 53GB disk
- Currently running Mike's folio-adapter branches (stripped auth) — must switch to CatholicOS main
- Auth changes needed in: ontokit-web (auth.ts, env.ts) AND ontokit-api (auth middleware)
- Phase 7 is trivial (~2 min git ops); Phase 8 is code changes in two repos; Phase 9 is SSH ops work
- Roadmap note: requirements count is 72 (not 65 as stated in header) — all 72 are mapped to phases 11-16

### Pending Todos

None.

### Blockers/Concerns

None yet.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260403-dth | Phase 7: Sync ALEA forks with CatholicOS main | 2026-04-03 | fbec037 | [260403-dth-phase-7-sync-alea-forks-with-catholicos-](./quick/260403-dth-phase-7-sync-alea-forks-with-catholicos-/) |

## Active Feature Branches

### Entity Graph Port (`entity-graph-migration`)

- **Issue:** CatholicOS/ontokit-web#81
- **Status:** Ready to plan
- **Handoff:** `.planning/features/entity-graph-port/HANDOFF.md`
- **Next:** Visual verify with MCP chrome-devtools (headless), then create PR

## Session Continuity

Last session: 2026-04-07T18:33:13.218Z
Stopped at: Completed 14-04-PLAN.md
Resume file: None
