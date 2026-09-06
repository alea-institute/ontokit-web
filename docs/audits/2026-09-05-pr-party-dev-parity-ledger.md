# PR Party → dev parity ledger

Date: 2026-09-05 (unit ledger date); audit performed 2026-09-06.

## Refs compared

- `feat/pr-party`: `83b62b0b47916736274bb48f87448c8dbc3fb09b` (frozen deployed history).
- `dev`: `289aa103c03c5f32724bc9752f75ec5d7d62cf0e` (integration and deploy line).

## Method

Enumerated `git diff --name-status feat/pr-party dev`: 191 rows (34 A, 20 D, 137 M, no renames). Direction is frozen → dev: A is dev-only, D is frozen-only. Compared frozen source using `git show feat/pr-party:<path>` and path-scoped diffs, examining removed behavior, callers and test assertions rather than accepting a filename as evidence of parity. Most revisions are dev re-synthesis, with gains noted below. The pointers in this ledger refer to the immutable refs above, before this carry-over. The supplied clean workspace starts at `b83c50c1ee312e59e6599ee10341bc0a549e50d5`; its only differences from dev are three pre-existing `.planning/` scratch changes. Those are outside this unit and untouched; all audited TypeScript sources match dev at the start.

Enumerated top-level exports with the installed TypeScript parser for every D/M `.ts`/`.tsx` path, including declarations, destructured exported variables, named re-exports and default exports. Compared names at each path, then searched dev for every removed name and its behavior (credential helpers, lint controls, session persistence, redirect/capability gates, PAT status, and PROV-O emission). Found 15 removed exports; no removed default exports or unresolved star exports. A removed public name does not imply lost behavior when a current helper supplies it.

Applied unit exclusions to frozen documentation/scratch and dependency manifests. The two A rows under `.planning/` are recorded as **dev-only additions**, per the explicit A-row rule; no frozen documentation is imported and those files are untouched. Inspected both workflow diffs: no shipped job or step is missing; updated action pins and added Docker fidelity checks stay on dev. Conflicting behavior choices are recorded under Findings and preserved for host review. A carry row means only its described missing slice is restored, preserving unrelated dev improvements.

## Summary counts

| Inventory | carry | dev supersedes | drop | Total |
| --- | ---: | ---: | ---: | ---: |
| Name-status rows | 17 | 154 | 20 | 191 |
| Removed exports | 5 | 9 | 1 | 15 |

## Name-status rows

| Kind | Path | Disposition | Pointer or reason | Note |
| --- | --- | --- | --- | --- |
| D | .claude/RESUME.md | drop | frozen-line documentation/scratch; durable copies live on the documentation branch | Excluded by unit policy. |
| D | .claude/bootup.json | drop | frozen-line documentation/scratch; durable copies live on the documentation branch | Excluded by unit policy. |
| A | .dockerignore | dev supersedes | dev-only addition | No frozen-line content to carry; unchanged by this unit. |
| M | .github/dependabot.yml | dev supersedes | dev re-synthesis (same file, revised) | Adds seven-day dependency cooldowns. |
| M | .github/workflows/release.yml | dev supersedes | dev re-synthesis (same file, revised) | All shipped jobs/steps retained; adds non-pushing Docker build gate and matching optional-auth build arguments. |
| M | .github/workflows/semgrep.yml | dev supersedes | dev re-synthesis (same file, revised) | Updates checkout pin; scan step retained. |
| A | .planning/HANDOFF.json | dev supersedes | dev-only addition | No frozen-line content to carry; unchanged by this unit. |
| M | .planning/STATE.md | drop | frozen-line documentation/scratch; durable copies live on the documentation branch | Excluded by unit policy. |
| A | .planning/phases/16-reviewer-enhancements/.continue-here.md | dev supersedes | dev-only addition | No frozen-line content to carry; unchanged by this unit. |
| D | .report-u10.md | drop | frozen-line documentation/scratch; durable copies live on the documentation branch | Excluded by unit policy. |
| M | .serena/memories/suggested_commands.md | drop | frozen-line documentation/scratch; durable copies live on the documentation branch | Excluded by unit policy. |
| M | AGENTS.md | dev supersedes | dev re-synthesis (same file, revised) | Current repository instructions retained; historical fork publishing instructions do not govern this unit. |
| M | Dockerfile | dev supersedes | dev re-synthesis (same file, revised) | Adds matching optional-auth build/runtime defaults; removed provider build arguments require host review (F2). |
| M | README.md | dev supersedes | dev re-synthesis (same file, revised) | Adds public TLS API/WebSocket build guidance. |
| M | __tests__/app/home-page.test.tsx | dev supersedes | dev re-synthesis (same file, revised) | Adds coverage: keeps the public query gated while required-auth session state is loading. |
| A | __tests__/app/project-layout.test.tsx | dev supersedes | dev-only addition | No frozen-line content to carry; unchanged by this unit. |
| M | __tests__/app/project-viewer-capabilities.test.tsx | dev supersedes | dev re-synthesis (same file, revised) | Adds coverage: does not hide a public viewer behind loading session state when auth is disabled. |
| D | __tests__/app/projects/editor/suggest-handlers.test.tsx | dev supersedes | lib/editor/suggestionSessionPersistence.ts#saveSuggestionUpdate; __tests__/lib/editor/suggestionSessionPersistence.test.ts; dev ee339821 | Branch-return / boolean-save API deliberately replaces explicit session-id / void-save helpers; start, existing-session and failed-save behavior is covered. |
| M | __tests__/app/translation-coverage.test.tsx | dev supersedes | dev re-synthesis (same file, revised) | Adds coverage: ignores a stale preview response after a newer request completes; invalidates an in-flight preview when a filter changes. |
| A | __tests__/components/auth/ByoKeySessionGuard.test.tsx | dev supersedes | dev-only addition | No frozen-line content to carry; unchanged by this unit. |
| M | __tests__/components/auth/user-menu.test.tsx | carry | feat/pr-party:__tests__/components/auth/user-menu.test.tsx | Restore configured and missing-issuer logout regressions; retain BYO-key clearing assertion. |
| M | __tests__/components/editor/ClassDetailPanel.test.tsx | carry | feat/pr-party:__tests__/components/editor/ClassDetailPanel.test.tsx | Adapt sibling callback assertion to restored provenance argument and exercise model/template forwarding. |
| M | __tests__/components/editor/HealthCheckPanel.test.tsx | dev supersedes | dev re-synthesis (same file, revised) | Error cases now assert structured active-job conflict display. |
| M | __tests__/components/editor/OntologySourceEditor.test.tsx | dev supersedes | dev re-synthesis (same file, revised) | Adds coverage: exposes source navigation, editing, and explicit snapshot replacement via ref. |
| M | __tests__/components/editor/PropertyDetailPanel.test.tsx | dev supersedes | dev re-synthesis (same file, revised) | Adds coverage: preserves a cross-branch candidate and marks the proposed entity as a property. |
| A | __tests__/components/editor/SourceRevisionConflictBanner.test.tsx | dev supersedes | dev-only addition | No frozen-line content to carry; unchanged by this unit. |
| M | __tests__/components/editor/TreeNodeContextMenu.test.tsx | dev supersedes | dev re-synthesis (same file, revised) | Retains behavioral assertions; updates fixtures/imports or uses shared __tests__/setup.ts storage. |
| M | __tests__/components/editor/developer/DeveloperEditorLayout.test.tsx | dev supersedes | dev re-synthesis (same file, revised) | Adds coverage: passes canEdit=true to PropertyDetailPanel in suggestion mode; exposes minting affordances to a trusted contributor in suggestion mode. |
| A | __tests__/components/editor/editor-proposal-lifecycle.test.tsx | dev supersedes | dev-only addition | No frozen-line content to carry; unchanged by this unit. |
| M | __tests__/components/editor/shared/EntityTreeNode.test.tsx | dev supersedes | dev re-synthesis (same file, revised) | Adds coverage: keeps the quick-add callback inert while child minting is locked. |
| M | __tests__/components/editor/shared/EntityTreeToolbar.test.tsx | dev supersedes | dev re-synthesis (same file, revised) | Adds coverage: keeps the add callback inert while entity minting is locked. |
| M | __tests__/components/editor/standard/StandardEditorLayout.test.tsx | dev supersedes | dev re-synthesis (same file, revised) | Adds coverage: exposes minting affordances to a trusted contributor in suggestion mode; keeps minting visible but locked for an untrusted contributor in suggestion mode. |
| M | __tests__/components/editor/suggestions/SuggestionCard.test.tsx | dev supersedes | dev re-synthesis (same file, revised) | Adds coverage: disables both plain and edit acceptance when validation_errors are present; records a distinct decision only through the explicit Not the same action. |
| M | __tests__/components/editor/trust-gating.test.tsx | dev supersedes | dev re-synthesis (same file, revised) | Mint capability behavior remains in useTrustCapabilities.ts and hook tests; role-derived duplicate field removed. |
| M | __tests__/components/layout/notification-bell.test.tsx | dev supersedes | dev re-synthesis (same file, revised) | Adds coverage: admits normal internal paths with query/hash and rejects URL parser escape forms. |
| M | __tests__/components/pr-party/card-detail.test.tsx | dev supersedes | dev re-synthesis (same file, revised) | Retains behavioral assertions; updates fixtures/imports or uses shared __tests__/setup.ts storage. |
| M | __tests__/components/pr-party/credential-card.test.tsx | dev supersedes | dev re-synthesis (same file, revised) | Retains behavioral assertions; updates fixtures/imports or uses shared __tests__/setup.ts storage. |
| M | __tests__/components/pr-party/qa-thread.test.tsx | dev supersedes | dev re-synthesis (same file, revised) | Adds coverage: keeps two reviewers' drafts separate on the same card and ignores legacy keys; never paints the previous reviewer's draft when the draft key changes in place. |
| M | __tests__/components/pr-party/queue-view.test.tsx | dev supersedes | dev re-synthesis (same file, revised) | Adds coverage: passes the authenticated reviewer identity to a card detail renderer. |
| M | __tests__/components/pr/PRActions.test.tsx | dev supersedes | dev re-synthesis (same file, revised) | Retains behavioral assertions; updates fixtures/imports or uses shared __tests__/setup.ts storage. |
| M | __tests__/components/pr/PRCreateModal.test.tsx | dev supersedes | dev re-synthesis (same file, revised) | Retains behavioral assertions; updates fixtures/imports or uses shared __tests__/setup.ts storage. |
| M | __tests__/components/pr/PRDetail.test.tsx | dev supersedes | dev re-synthesis (same file, revised) | GitHub link tests replaced by receipt states and authorized bounded retry/poll tests. |
| M | __tests__/components/pr/PRList.test.tsx | dev supersedes | dev re-synthesis (same file, revised) | Retains behavioral assertions; updates fixtures/imports or uses shared __tests__/setup.ts storage. |
| M | __tests__/components/pr/PRListItem.test.tsx | dev supersedes | dev re-synthesis (same file, revised) | Retains behavioral assertions; updates fixtures/imports or uses shared __tests__/setup.ts storage. |
| A | __tests__/components/projects/DistinctEntityDecisionsSection.test.tsx | dev supersedes | dev-only addition | No frozen-line content to carry; unchanged by this unit. |
| A | __tests__/components/projects/LLMUsageSection.test.tsx | dev supersedes | dev-only addition | No frozen-line content to carry; unchanged by this unit. |
| M | __tests__/components/projects/audit-log-section.test.tsx | dev supersedes | dev re-synthesis (same file, revised) | Adds coverage: uses erasure-safe fallbacks when display identities are gone. |
| A | __tests__/components/projects/demo-project-banner.test.tsx | dev supersedes | dev-only addition | No frozen-line content to carry; unchanged by this unit. |
| A | __tests__/components/projects/demo-project-entry.test.tsx | dev supersedes | dev-only addition | No frozen-line content to carry; unchanged by this unit. |
| M | __tests__/components/projects/lint-config-section.test.tsx | dev supersedes | dev re-synthesis (same file, revised) | Retains behavioral assertions; updates fixtures/imports or uses shared __tests__/setup.ts storage. |
| A | __tests__/components/projects/member-trust-control.test.tsx | dev supersedes | dev-only addition | No frozen-line content to carry; unchanged by this unit. |
| M | __tests__/components/projects/project-card.test.tsx | dev supersedes | dev re-synthesis (same file, revised) | Adds coverage: shows Demo lab only from the server demo flag. |
| M | __tests__/components/projects/trust-ladder-section.test.tsx | dev supersedes | dev re-synthesis (same file, revised) | Whole-object save assertion replaced by touched-field PATCH and concurrent-edit preservation. |
| M | __tests__/components/suggestions/CreditModal.test.tsx | dev supersedes | dev re-synthesis (same file, revised) | Retains behavioral assertions; updates fixtures/imports or uses shared __tests__/setup.ts storage. |
| M | __tests__/components/suggestions/triage-queue.test.tsx | dev supersedes | dev re-synthesis (same file, revised) | Adds coverage: ignores an older session request that resolves after the latest request; removes a selected terminal suggestion after a single approve. |
| A | __tests__/config/auth-bootstrap.test.ts | dev supersedes | dev-only addition | No frozen-line content to carry; unchanged by this unit. |
| A | __tests__/config/docker-release-fidelity.test.ts | dev supersedes | dev-only addition | No frozen-line content to carry; unchanged by this unit. |
| D | __tests__/config/next-config-env.test.ts | carry | feat/pr-party:__tests__/config/next-config-env.test.ts | Restore both issuer configuration tests unchanged. |
| A | __tests__/config/test-environment.test.ts | dev supersedes | dev-only addition | No frozen-line content to carry; unchanged by this unit. |
| M | __tests__/lib/api/client-retry.test.ts | dev supersedes | dev re-synthesis (same file, revised) | Deliberately replaces mutation retry default with safe read-only retry default. |
| M | __tests__/lib/api/client.test.ts | dev supersedes | dev re-synthesis (same file, revised) | Adds coverage: extracts a FastAPI string detail; extracts a structured FastAPI detail message. |
| A | __tests__/lib/api/duplicateCheck.test.ts | dev supersedes | dev-only addition | No frozen-line content to carry; unchanged by this unit. |
| M | __tests__/lib/api/indexStatus.test.ts | dev supersedes | dev re-synthesis (same file, revised) | Retains behavioral assertions; updates fixtures/imports or uses shared __tests__/setup.ts storage. |
| M | __tests__/lib/api/lint.test.ts | dev supersedes | dev re-synthesis (same file, revised) | Retains behavioral assertions; updates fixtures/imports or uses shared __tests__/setup.ts storage. |
| M | __tests__/lib/api/projects.test.ts | dev supersedes | dev re-synthesis (same file, revised) | Adds coverage: passes bounded demo discovery filters; accepts explicit null demo metadata from the API. |
| M | __tests__/lib/api/pullRequests.test.ts | dev supersedes | dev re-synthesis (same file, revised) | Adds coverage: calls the explicit retry endpoint once with authentication; can disable automatic 5xx retries for an outer polling loop. |
| M | __tests__/lib/api/quality.test.ts | dev supersedes | dev re-synthesis (same file, revised) | Retains behavioral assertions; updates fixtures/imports or uses shared __tests__/setup.ts storage. |
| M | __tests__/lib/api/revisions.test.ts | dev supersedes | dev re-synthesis (same file, revised) | Retains behavioral assertions; updates fixtures/imports or uses shared __tests__/setup.ts storage. |
| M | __tests__/lib/api/suggestions.test.ts | dev supersedes | dev re-synthesis (same file, revised) | Adds coverage: does not replay a dismissal after a 5xx response; does not replay a bulk review after a 5xx response. |
| M | __tests__/lib/api/trust.test.ts | dev supersedes | dev re-synthesis (same file, revised) | Snapshot payload tests retain nullable tier coverage; adds non-replayed privilege mutation regression. |
| M | __tests__/lib/api/userSettings.test.ts | dev supersedes | dev re-synthesis (same file, revised) | Retains behavioral assertions; updates fixtures/imports or uses shared __tests__/setup.ts storage. |
| A | __tests__/lib/api/websocketUrl.test.ts | dev supersedes | dev-only addition | No frozen-line content to carry; unchanged by this unit. |
| A | __tests__/lib/editor/generatedEntityPersistence.test.ts | dev supersedes | dev-only addition | No frozen-line content to carry; unchanged by this unit. |
| A | __tests__/lib/editor/suggestionSessionPersistence.test.ts | dev supersedes | dev-only addition | No frozen-line content to carry; unchanged by this unit. |
| M | __tests__/lib/env.test.ts | dev supersedes | dev re-synthesis (same file, revised) | Adds coverage: ignores stale Zitadel variables when auth is disabled. |
| M | __tests__/lib/hooks/useAnonymousSuggestion.test.ts | dev supersedes | dev re-synthesis (same file, revised) | Adds coverage: refuses an expired restored session and clears its persisted entry; can save immediately after starting with callbacks from the same render. |
| M | __tests__/lib/hooks/useNotifications.test.ts | dev supersedes | dev re-synthesis (same file, revised) | Retains behavioral assertions; updates fixtures/imports or uses shared __tests__/setup.ts storage. |
| M | __tests__/lib/hooks/useProject.test.ts | dev supersedes | dev re-synthesis (same file, revised) | Role-permission tests retained; removed auth-disabled capability assertions are F1. |
| M | __tests__/lib/hooks/useProjectHomeHref.test.ts | dev supersedes | dev re-synthesis (same file, revised) | Retains behavioral assertions; updates fixtures/imports or uses shared __tests__/setup.ts storage. |
| M | __tests__/lib/hooks/useProjectViewer.test.ts | dev supersedes | dev re-synthesis (same file, revised) | Adds coverage: reloadSourceContent replaces content and revision from one latest response; does not restore a stale in-flight snapshot after source state is reset. |
| A | __tests__/lib/hooks/useSourceRevisionGuard.test.ts | dev supersedes | dev-only addition | No frozen-line content to carry; unchanged by this unit. |
| M | __tests__/lib/hooks/useSuggestionSession.test.ts | carry | feat/pr-party:__tests__/lib/hooks/useSuggestionSession.test.ts | Restore signed beacon-token assertion, concurrent-save exclusion, and resumed-session save regressions; preserve revised persistence tests. |
| M | __tests__/lib/hooks/useSuggestions.test.ts | dev supersedes | dev re-synthesis (same file, revised) | Adds coverage: keeps a suggestion pending until its async acceptance callback succeeds; does not accept a replacement suggestion while persistence is in flight. |
| M | __tests__/lib/hooks/useTranslationState.test.ts | dev supersedes | dev re-synthesis (same file, revised) | Adds coverage: bounds polling for pending state observed before a local request. |
| D | __tests__/lib/ontology/suggestionProvenance.test.ts | carry | feat/pr-party:__tests__/lib/ontology/suggestionProvenance.test.ts | Restore all six provenance-selection regressions unchanged. |
| M | __tests__/lib/ontology/turtleClassUpdater.test.ts | dev supersedes | dev re-synthesis (same file, revised) | Adds coverage: preserves an untagged label and full-IRI subject when another field changes. |
| M | __tests__/lib/ontology/turtleSnippetGenerator.test.ts | carry | feat/pr-party:__tests__/lib/ontology/turtleSnippetGenerator.test.ts | Restore the removed PROV-O and governing-prefix tests; verify passage through dev persistence. |
| M | __tests__/lib/ontology/turtleUtils.test.ts | dev supersedes | dev re-synthesis (same file, revised) | Retains behavioral assertions; updates fixtures/imports or uses shared __tests__/setup.ts storage. |
| M | __tests__/lib/stores/anonymousCreditStore.test.ts | carry | feat/pr-party:__tests__/lib/stores/anonymousCreditStore.test.ts | Restore credit-store and per-project token isolation/clear/refresh tests; retain tab storage and TTL contract. |
| M | __tests__/lib/stores/byoKeyStore.test.ts | dev supersedes | dev re-synthesis (same file, revised) | Adds coverage: clears every project key at the account boundary; clears a prior account's keys on a same-tab identity switch. |
| M | __tests__/lib/stores/draftStore.test.ts | dev supersedes | dev re-synthesis (same file, revised) | Retains behavioral assertions; updates fixtures/imports or uses shared __tests__/setup.ts storage. |
| M | __tests__/lib/stores/editorModeStore.test.ts | dev supersedes | dev re-synthesis (same file, revised) | Retains behavioral assertions; updates fixtures/imports or uses shared __tests__/setup.ts storage. |
| M | __tests__/lib/stores/suggestionStore.test.ts | dev supersedes | dev re-synthesis (same file, revised) | Adds coverage: keeps duplicate verdict thresholds aligned with the API contract; removes a marked-distinct candidate and recalculates the duplicate verdict. |
| M | __tests__/lib/utils.test.ts | dev supersedes | dev re-synthesis (same file, revised) | Adds coverage: accepts Date inputs and falls back to a locale date after seven days. |
| M | __tests__/settings/commit-identity.test.tsx | dev supersedes | dev re-synthesis (same file, revised) | Retains behavioral assertions; updates fixtures/imports or uses shared __tests__/setup.ts storage. |
| A | __tests__/setup.ts | dev supersedes | dev-only addition | No frozen-line content to carry; unchanged by this unit. |
| M | app/page.tsx | dev supersedes | dev re-synthesis (same file, revised) | Adds demo entry and required-auth loading gate. |
| M | app/pr-party/page.tsx | dev supersedes | dev re-synthesis (same file, revised) | Threads authenticated reviewer identity to card detail. |
| M | app/pr-party/settings/page.tsx | dev supersedes | dev re-synthesis (same file, revised) | Credentials helpers move to lib/prPartyCredentials.ts. |
| M | app/projects/[id]/editor/page.tsx | carry | feat/pr-party:app/projects/[id]/editor/page.tsx | Thread provenance through generated entity input; retain queued authoritative persistence and revision guards. Permission divergence is F1. |
| A | app/projects/[id]/layout.tsx | dev supersedes | dev-only addition | No frozen-line content to carry; unchanged by this unit. |
| M | app/projects/[id]/page.tsx | dev supersedes | dev re-synthesis (same file, revised) | Adds demo links; removes capability input to viewer (F1). |
| M | app/projects/[id]/settings/page.tsx | dev supersedes | dev re-synthesis (same file, revised) | Lint controls extracted to components/projects/LintConfigSection.tsx; adds distinct-decision history and shared relative time. |
| M | app/projects/[id]/suggestions/page.tsx | dev supersedes | dev re-synthesis (same file, revised) | Relative time moves to lib/utils.ts#formatTimeAgo. |
| M | app/projects/[id]/suggestions/review/page.tsx | dev supersedes | dev re-synthesis (same file, revised) | Adds stale-request exclusion, selection pruning, and 100-item bulk cap. |
| M | app/projects/[id]/translations/page.tsx | dev supersedes | dev re-synthesis (same file, revised) | Preview binds immutable filters; stale responses cannot authorize a new launch. |
| M | app/providers.tsx | dev supersedes | dev re-synthesis (same file, revised) | Adds account-bound BYO key guard. |
| M | auth.ts | dev supersedes | dev re-synthesis (same file, revised) | Validates server environment at auth bootstrap. |
| A | components/auth/ByoKeySessionGuard.tsx | dev supersedes | dev-only addition | No frozen-line content to carry; unchanged by this unit. |
| M | components/auth/user-menu.tsx | carry | feat/pr-party:components/auth/user-menu.tsx | Restore missing-issuer guard and remove localhost fallback; retain synchronous BYO-key clearing. |
| M | components/editor/ClassDetailPanel.tsx | carry | feat/pr-party:components/editor/ClassDetailPanel.tsx | Restore provenance on minted children/siblings; retain async acceptance, deterministic sibling parent and distinct decisions. |
| M | components/editor/HealthCheckPanel.tsx | dev supersedes | dev re-synthesis (same file, revised) | Adds structured API error display. |
| M | components/editor/OntologySourceEditor.tsx | dev supersedes | dev re-synthesis (same file, revised) | Adds explicit saved-baseline replacement for revision reconciliation. |
| M | components/editor/PropertyDetailPanel.tsx | carry | feat/pr-party:components/editor/PropertyDetailPanel.tsx | Restore provenance on minted sub-properties; retain async acceptance and distinct decisions. |
| A | components/editor/SourceRevisionConflictBanner.tsx | dev supersedes | dev-only addition | No frozen-line content to carry; unchanged by this unit. |
| M | components/editor/TrustExplainer.tsx | dev supersedes | dev re-synthesis (same file, revised) | Constrains popup width on narrow screens. |
| M | components/editor/TurtleEditor.tsx | dev supersedes | dev re-synthesis (same file, revised) | Adapts Monaco hover option to current on enum. |
| M | components/editor/developer/DeveloperEditorLayout.tsx | carry | feat/pr-party:components/editor/developer/DeveloperEditorLayout.tsx | Restore optional provenance callback argument; retain Promise return and suggestion-mode affordances. |
| M | components/editor/standard/StandardEditorLayout.tsx | carry | feat/pr-party:components/editor/standard/StandardEditorLayout.tsx | Restore optional provenance callback argument; retain Promise return and suggestion-mode affordances. |
| M | components/editor/suggestions/SuggestionCard.tsx | dev supersedes | dev re-synthesis (same file, revised) | Adds busy/validation gating and explicit distinct-entity decisions. |
| M | components/layout/notification-bell.tsx | dev supersedes | dev re-synthesis (same file, revised) | Rejects control/backslash URL escapes; shares relative-time formatter. |
| M | components/pr-party/CardDetail.tsx | dev supersedes | dev re-synthesis (same file, revised) | Threads reviewer identity into QAThread. |
| M | components/pr-party/PRPartyQueueView.tsx | dev supersedes | dev re-synthesis (same file, revised) | Renders detail only with authenticated reviewer identity. |
| M | components/pr-party/QAThread.tsx | dev supersedes | dev re-synthesis (same file, revised) | QAThreadForDraft keyed by qaDraftKey remounts on card/reviewer change, replacing effect reset; adds reviewer isolation. |
| M | components/pr/PRDetail.tsx | dev supersedes | dev re-synthesis (same file, revised) | Replaces bare GitHub link with sync receipt, bounded polling, and authorized retry. |
| M | components/projects/AuditLogSection.tsx | dev supersedes | dev re-synthesis (same file, revised) | Shares relative-time formatter and supports erasure-safe identity display. |
| A | components/projects/DistinctEntityDecisionsSection.tsx | dev supersedes | dev-only addition | No frozen-line content to carry; unchanged by this unit. |
| M | components/projects/LLMUsageSection.tsx | dev supersedes | dev re-synthesis (same file, revised) | Clamps visible pagination after data shrink. |
| A | components/projects/LintConfigSection.tsx | dev supersedes | dev-only addition | No frozen-line content to carry; unchanged by this unit. |
| M | components/projects/MemberTrustControl.tsx | dev supersedes | dev re-synthesis (same file, revised) | Authoritative refresh supersedes optimistic rows; bounds popup width. |
| M | components/projects/TrustLadderSection.tsx | dev supersedes | dev re-synthesis (same file, revised) | PATCHes only touched settings, preserves concurrent edits, adds load retry. |
| A | components/projects/demo-project-banner.tsx | dev supersedes | dev-only addition | No frozen-line content to carry; unchanged by this unit. |
| A | components/projects/demo-project-entry.tsx | dev supersedes | dev-only addition | No frozen-line content to carry; unchanged by this unit. |
| M | components/projects/project-card.tsx | dev supersedes | dev re-synthesis (same file, revised) | Adds server-identified demo badge. |
| M | components/settings/CommitIdentityCard.tsx | dev supersedes | dev re-synthesis (same file, revised) | Improves icon accessibility and long-address wrapping. |
| M | components/suggestions/BulkActionBar.tsx | dev supersedes | dev re-synthesis (same file, revised) | Wraps narrow-screen actions and hides decorative icons from assistive tech. |
| M | components/suggestions/CreditModal.tsx | dev supersedes | dev re-synthesis (same file, revised) | Documents intentional reopen form reset; behavior retained. |
| M | components/suggestions/QueueFilterTabs.tsx | dev supersedes | dev re-synthesis (same file, revised) | Uses API queue type and scrolls narrow layouts. |
| D | docs/plans/2026-07-24-009-feat-contribution-trust-ladder-plan.md | drop | frozen-line documentation/scratch; durable copies live on the documentation branch | Excluded by unit policy. |
| D | docs/plans/2026-07-26-010-feat-pr-party-review-dashboard-plan.md | drop | frozen-line documentation/scratch; durable copies live on the documentation branch | Excluded by unit policy. |
| D | docs/plans/2026-07-26-011-feat-pr-party-ontokit-native-plan.md | drop | frozen-line documentation/scratch; durable copies live on the documentation branch | Excluded by unit policy. |
| D | docs/plans/2026-08-09-003-feat-submission-audit-snapshot-plan.md | drop | frozen-line documentation/scratch; durable copies live on the documentation branch | Excluded by unit policy. |
| D | docs/plans/2026-08-13-001-fix-u7-sweep-bugs-plan.md | drop | frozen-line documentation/scratch; durable copies live on the documentation branch | Excluded by unit policy. |
| D | docs/plans/2026-08-13-002-fix-annotation-data-loss-plan.md | drop | frozen-line documentation/scratch; durable copies live on the documentation branch | Excluded by unit policy. |
| D | docs/residual-review-findings/2026-07-28-pr-party-code-review.md | drop | frozen-line documentation/scratch; durable copies live on the documentation branch | Excluded by unit policy. |
| D | docs/residual-review-findings/2026-08-08-llm-subsystem-fixes-web.md | drop | frozen-line documentation/scratch; durable copies live on the documentation branch | Excluded by unit policy. |
| D | docs/residual-review-findings/2026-08-08-llm-subsystem-review.md | drop | frozen-line documentation/scratch; durable copies live on the documentation branch | Excluded by unit policy. |
| D | docs/residual-review-findings/2026-08-08-llm-subsystem-verification-web.md | drop | frozen-line documentation/scratch; durable copies live on the documentation branch | Excluded by unit policy. |
| D | docs/solutions/2026-07-28-cross-model-review-invariant-scope.md | drop | frozen-line documentation/scratch; durable copies live on the documentation branch | Excluded by unit policy. |
| D | docs/solutions/2026-07-28-pr-party-fifteen-unit-build.md | drop | frozen-line documentation/scratch; durable copies live on the documentation branch | Excluded by unit policy. |
| D | docs/solutions/conventions/self-check-that-can-pass-via-another-credential-proves-nothing.md | drop | frozen-line documentation/scratch; durable copies live on the documentation branch | Excluded by unit policy. |
| M | lib/api/client.ts | dev supersedes | dev re-synthesis (same file, revised) | Retries only reads by default; adds structured errors and immutable source revision precondition. |
| A | lib/api/duplicateCheck.ts | dev supersedes | dev-only addition | No frozen-line content to carry; unchanged by this unit. |
| M | lib/api/generation.ts | dev supersedes | dev re-synthesis (same file, revised) | Adds shared duplicate thresholds and candidate entity/branch metadata. |
| M | lib/api/indexStatus.ts | dev supersedes | dev re-synthesis (same file, revised) | Uses lib/api/websocketUrl.ts#getWebSocketUrl for TLS-aware origin fallback. |
| M | lib/api/lint.ts | dev supersedes | dev re-synthesis (same file, revised) | Uses lib/api/websocketUrl.ts#getWebSocketUrl for TLS-aware origin fallback. |
| M | lib/api/notifications.ts | dev supersedes | dev re-synthesis (same file, revised) | Accepts nullable erased project identity. |
| M | lib/api/projects.ts | dev supersedes | dev re-synthesis (same file, revised) | Adds demo identity metadata and bounded discovery filters. |
| M | lib/api/pullRequests.ts | dev supersedes | dev re-synthesis (same file, revised) | Adds GitHub sync receipts, cancellation-aware reads, and explicit non-replayed sync retry. |
| M | lib/api/quality.ts | dev supersedes | dev re-synthesis (same file, revised) | Uses lib/api/websocketUrl.ts#getWebSocketUrl for TLS-aware origin fallback. |
| M | lib/api/revisions.ts | dev supersedes | dev re-synthesis (same file, revised) | Adds immutable revision to source snapshots. |
| M | lib/api/suggestions.ts | dev supersedes | dev re-synthesis (same file, revised) | Formatting only; dismissal still disables replay. |
| M | lib/api/trust.ts | dev supersedes | dev re-synthesis (same file, revised) | Disables privilege-change replay; aligns user_id with server contract. |
| M | lib/api/userSettings.ts | dev supersedes | dev re-synthesis (same file, revised) | Removes unused retired PAT-write response type; read-only status and commit identity remain. |
| A | lib/api/websocketUrl.ts | dev supersedes | dev-only addition | No frozen-line content to carry; unchanged by this unit. |
| A | lib/editor/generatedEntityPersistence.ts | dev supersedes | dev-only addition | No frozen-line content to carry; unchanged by this unit. |
| M | lib/editor/indexWorker.ts | dev supersedes | dev re-synthesis (same file, revised) | Uses fixed console format string; indexing behavior retained. |
| A | lib/editor/suggestionSessionPersistence.ts | dev supersedes | dev-only addition | No frozen-line content to carry; unchanged by this unit. |
| M | lib/env.ts | dev supersedes | dev re-synthesis (same file, revised) | Disabled auth ignores inactive provider variables; active-provider validation remains. |
| M | lib/hooks/useAnonymousSuggestion.ts | dev supersedes | dev re-synthesis (same file, revised) | Coalesces session creation, returns branch, synchronizes save refs, and persists tab-token lifetime. |
| M | lib/hooks/useCollaborationStatus.ts | dev supersedes | dev re-synthesis (same file, revised) | Uses lib/api/websocketUrl.ts#getWebSocketUrl for TLS-aware origin fallback. |
| M | lib/hooks/useProject.ts | dev supersedes | dev re-synthesis (same file, revised) | Role permissions remain; mint gate in useTrustCapabilities.ts; auth-disabled capability divergence is F1. |
| M | lib/hooks/useProjectViewer.ts | dev supersedes | dev re-synthesis (same file, revised) | Adds paired revision snapshots, reload and stale-scope guards; capability removal is F1. |
| A | lib/hooks/useSourceRevisionGuard.ts | dev supersedes | dev-only addition | No frozen-line content to carry; unchanged by this unit. |
| M | lib/hooks/useSuggestionSession.ts | carry | feat/pr-party:lib/hooks/useSuggestionSession.ts | Retain the server-issued beacon_token instead of substituting a session id; preserve branch-return and boolean-save APIs. |
| M | lib/hooks/useSuggestions.ts | dev supersedes | dev re-synthesis (same file, revised) | Waits for persistence before acceptance; adds validation and distinct-candidate updates. |
| M | lib/hooks/useTranslationState.ts | dev supersedes | dev re-synthesis (same file, revised) | Bounds polling for server-observed pending translations as well as local requests. |
| D | lib/ontology/suggestionProvenance.ts | carry | feat/pr-party:lib/ontology/suggestionProvenance.ts | Restore the accepted-suggestion provenance bridge and type; no equivalent PROV-O emitter on dev. |
| M | lib/ontology/turtleClassUpdater.ts | dev supersedes | dev re-synthesis (same file, revised) | Preserves untagged labels and their axioms; documents escaped regexes. |
| M | lib/ontology/turtleSnippetGenerator.ts | carry | feat/pr-party:lib/ontology/turtleSnippetGenerator.ts | Restore PROV-O emission, governing-prefix detection, and control-character escaping; retain IRI validation. |
| M | lib/ontology/turtleUtils.ts | dev supersedes | dev re-synthesis (same file, revised) | Validates language tags; retains safe IRI/block operations. |
| A | lib/prPartyCredentials.ts | dev supersedes | dev-only addition | No frozen-line content to carry; unchanged by this unit. |
| M | lib/sitemap.ts | dev supersedes | dev re-synthesis (same file, revised) | Documents escaped regexes; sitemap behavior unchanged. |
| M | lib/stores/anonymousCreditStore.ts | dev supersedes | dev re-synthesis (same file, revised) | Deliberately replaces durable bearer storage with expiring tab storage; credit API unchanged. |
| M | lib/stores/byoKeyStore.ts | dev supersedes | dev re-synthesis (same file, revised) | Adds account ownership and all-key clearing. |
| M | lib/stores/suggestionStore.ts | dev supersedes | dev re-synthesis (same file, revised) | Adds branch-specific distinct-candidate removal and verdict recomputation. |
| M | lib/utils.ts | dev supersedes | dev re-synthesis (same file, revised) | Adds shared formatTimeAgo. |
| M | next.config.ts | carry | feat/pr-party:next.config.ts | Restore public issuer used by UserMenu federated logout; retain configured-provider predicate. |
| M | package-lock.json | drop | dependency manifests are never carried; retain dev dependency resolution | Excluded by unit policy. |
| M | package.json | drop | dependency manifests are never carried; retain dev dependency resolution | Excluded by unit policy. |
| M | vitest.config.ts | dev supersedes | dev re-synthesis (same file, revised) | Centralizes memory storage setup in __tests__/setup.ts. |

## Removed exports

| Path | Symbol | Disposition | Pointer or reason |
| --- | --- | --- | --- |
| app/pr-party/settings/page.tsx | NTFY_TOPIC_PATTERN | dev supersedes | lib/prPartyCredentials.ts#NTFY_TOPIC_PATTERN |
| app/pr-party/settings/page.tsx | hasLapsed | dev supersedes | lib/prPartyCredentials.ts#hasLapsed |
| app/projects/[id]/editor/page.tsx | persistSuggestionUpdate | dev supersedes | lib/editor/suggestionSessionPersistence.ts#saveSuggestionUpdate; app/projects/[id]/editor/page.tsx structured handlers; dev ee339821 |
| app/projects/[id]/editor/page.tsx | persistClassSuggestionUpdate | dev supersedes | lib/editor/suggestionSessionPersistence.ts#saveSuggestionUpdate; app/projects/[id]/editor/page.tsx structured handlers; dev ee339821 |
| app/projects/[id]/editor/page.tsx | persistPropertySuggestionUpdate | dev supersedes | lib/editor/suggestionSessionPersistence.ts#saveSuggestionUpdate; app/projects/[id]/editor/page.tsx structured handlers; dev ee339821 |
| app/projects/[id]/editor/page.tsx | persistIndividualSuggestionUpdate | dev supersedes | lib/editor/suggestionSessionPersistence.ts#saveSuggestionUpdate; app/projects/[id]/editor/page.tsx structured handlers; dev ee339821 |
| app/projects/[id]/settings/page.tsx | getSeverityColor | dev supersedes | components/projects/LintConfigSection.tsx#getSeverityColor |
| app/projects/[id]/settings/page.tsx | LintConfigSection | dev supersedes | components/projects/LintConfigSection.tsx#LintConfigSection |
| lib/api/userSettings.ts | GitHubTokenResponse | drop | Unused PAT-write response DTO; PAT write surface retired (lib/api/userSettings.ts R3/KD6); no frozen-line callers; dev keeps GitHubTokenStatus and CommitIdentity |
| lib/hooks/useProject.ts | shouldRedirectFromEditor | dev supersedes | app/projects/[id]/editor/page.tsx inline redirect and canPropose; lib/hooks/useProject.ts#derivePermissions; pending host review F1 |
| lib/ontology/suggestionProvenance.ts | AcceptedSuggestionProvenance | carry | feat/pr-party:lib/ontology/suggestionProvenance.ts#AcceptedSuggestionProvenance; no equivalent PROV-O generation on dev |
| lib/ontology/suggestionProvenance.ts | provenanceFromSuggestion | carry | feat/pr-party:lib/ontology/suggestionProvenance.ts#provenanceFromSuggestion; no equivalent PROV-O generation on dev |
| lib/ontology/turtleSnippetGenerator.ts | SnippetProvenance | carry | feat/pr-party:lib/ontology/turtleSnippetGenerator.ts#SnippetProvenance; no equivalent PROV-O generation on dev |
| lib/ontology/turtleSnippetGenerator.ts | PROV_NAMESPACE | carry | feat/pr-party:lib/ontology/turtleSnippetGenerator.ts#PROV_NAMESPACE; no equivalent PROV-O generation on dev |
| lib/ontology/turtleSnippetGenerator.ts | isProvPrefixBoundToProvO | carry | feat/pr-party:lib/ontology/turtleSnippetGenerator.ts#isProvPrefixBoundToProvO; no equivalent PROV-O generation on dev |

## Carried in this change

- `__tests__/components/auth/user-menu.test.tsx`: Restore configured and missing-issuer logout regressions; retain BYO-key clearing assertion.
- `__tests__/components/editor/ClassDetailPanel.test.tsx`: Adapt sibling callback assertion to restored provenance argument and exercise model/template forwarding.
- `__tests__/config/next-config-env.test.ts`: Restore both issuer configuration tests unchanged.
- `__tests__/lib/hooks/useSuggestionSession.test.ts`: Restore signed beacon-token assertion, concurrent-save exclusion, and resumed-session save regressions; preserve revised persistence tests.
- `__tests__/lib/ontology/suggestionProvenance.test.ts`: Restore all six provenance-selection regressions unchanged.
- `__tests__/lib/ontology/turtleSnippetGenerator.test.ts`: Restore the removed PROV-O and governing-prefix tests; verify passage through dev persistence.
- `__tests__/lib/stores/anonymousCreditStore.test.ts`: Restore credit-store and per-project token isolation/clear/refresh tests; retain tab storage and TTL contract.
- `app/projects/[id]/editor/page.tsx`: Thread provenance through generated entity input; retain queued authoritative persistence and revision guards. Permission divergence is F1.
- `components/auth/user-menu.tsx`: Restore missing-issuer guard and remove localhost fallback; retain synchronous BYO-key clearing.
- `components/editor/ClassDetailPanel.tsx`: Restore provenance on minted children/siblings; retain async acceptance, deterministic sibling parent and distinct decisions.
- `components/editor/PropertyDetailPanel.tsx`: Restore provenance on minted sub-properties; retain async acceptance and distinct decisions.
- `components/editor/developer/DeveloperEditorLayout.tsx`: Restore optional provenance callback argument; retain Promise return and suggestion-mode affordances.
- `components/editor/standard/StandardEditorLayout.tsx`: Restore optional provenance callback argument; retain Promise return and suggestion-mode affordances.
- `lib/hooks/useSuggestionSession.ts`: Retain the server-issued beacon_token instead of substituting a session id; preserve branch-return and boolean-save APIs.
- `lib/ontology/suggestionProvenance.ts`: Restore the accepted-suggestion provenance bridge and type; no equivalent PROV-O emitter on dev.
- `lib/ontology/turtleSnippetGenerator.ts`: Restore PROV-O emission, governing-prefix detection, and control-character escaping; retain IRI validation.
- `next.config.ts`: Restore public issuer used by UserMenu federated logout; retain configured-provider predicate.

The generated entity carries optional provenance through the editor's typed entity value into the existing `persistGeneratedEntity` spread and the restored snippet generator. The authoritative read, queued save, conflict guard, and accept-after-save sequence stay intact. Prefix declaration defaults to enabled: re-declaration safely binds PROV-O at the appended block even if the source used a conflicting prefix. This intentionally forgoes the old local-source prefix deduplication because dev reads the authoritative document inside persistence; `isProvPrefixBoundToProvO` remains available and covered.

No changes are made to the QA component: its keyed child covers the frozen card-change effect and improves reviewer isolation. No page-level persistence exports are restored: `saveSuggestionUpdate` and its tests cover their replacement API.

## Verification and adaptations

The final focused command passed **14 files / 465 tests**, including every carried test file and the existing persistence, proposal lifecycle, property-panel, layout and QA suites:

```bash
npx --no-install vitest run __tests__/config/next-config-env.test.ts __tests__/lib/ontology/suggestionProvenance.test.ts __tests__/lib/ontology/turtleSnippetGenerator.test.ts __tests__/lib/hooks/useSuggestionSession.test.ts __tests__/lib/stores/anonymousCreditStore.test.ts __tests__/components/auth/user-menu.test.tsx __tests__/components/editor/ClassDetailPanel.test.tsx __tests__/components/editor/PropertyDetailPanel.test.tsx __tests__/components/editor/developer/DeveloperEditorLayout.test.tsx __tests__/components/editor/standard/StandardEditorLayout.test.tsx __tests__/components/pr-party/qa-thread.test.tsx __tests__/lib/editor/suggestionSessionPersistence.test.ts __tests__/lib/editor/generatedEntityPersistence.test.ts __tests__/components/editor/editor-proposal-lifecycle.test.tsx --config .u4-audit-temp/vitest.config.mjs --configLoader native --cache=false
```

The disposable `.mjs` config was copied from the repository config with `__dirname` replaced by this workspace's absolute path. This preserves the existing plugins, aliases and setup while avoiding generated configuration/cache writes into the read-only dependency symlink. A first `--configLoader runner` attempt failed because `__dirname` was undefined; the native loader copy resolved that runtime issue. The temporary config and audit intermediates are removed before handoff. No dependency installation or network access was used.

Scoped ESLint on all 17 carried paths exited zero: **0 errors, 3 warnings** (existing effect-state patterns in the editor page/property panel and the federated navigation assignment). `git diff --check` passed. Full type-check, lint, test and production build remain controller verification, as specified by the unit.

Adaptations preserve dev APIs: provenance callbacks keep their Promise return types; the editor passes an optional provenance field through the existing persistence helper's entity spread; the sibling test now verifies that fourth callback argument. The snippet suite additionally exercises all four minted entity types through each of the three persistence modes, including a conflicting source prefix and the immutable revision save argument. The frozen provenance-selector and next-config tests are restored unchanged. The concurrent-session save test now expects the explicit false result instead of void, preserving its one-request assertion. Restored auth/session/credit test slices retain dev's independent regressions and shared setup. The token refresh assertion uses `toMatchObject` for the frozen token/session/branch fields because dev intentionally adds issuance/expiry metadata, which its existing tests continue to verify.

## Findings

- **F1 — Auth-disabled capability routing, pending host review.** Frozen `lib/hooks/useProject.ts#derivePermissions` consumes `capabilities.can_suggest` and `shouldRedirectFromEditor` waits for trust capabilities before redirecting. Frozen `__tests__/lib/hooks/useProject.test.ts` explicitly covers an unauthenticated principal granted suggestion access. Dev `lib/hooks/useProject.ts#derivePermissions` uses roles/token only, `lib/hooks/useProjectViewer.ts` drops the capability input, and `app/projects/[id]/editor/page.tsx` uses an inline redirect plus public-project `canPropose`. Dev does preserve the mint capability gate in `lib/hooks/useTrustCapabilities.ts`, but that is not equivalent to the removed route-access behavior. The packet does not decide role/token versus auth-disabled server-principal routing; the affected permission rows/export remain dev supersedes pending host review. The editor page's separate provenance carry does not change this routing.
- **F2 — Provider-configured Docker builds, pending host review.** Frozen `Dockerfile` accepts `ZITADEL_ISSUER` and `ZITADEL_CLIENT_ID` build arguments for client flags. Dev removes them while adding optional-auth defaults, bootstrap validation (`auth.ts`, `lib/env.ts`), and explicit credential-free release fidelity assertions (`__tests__/config/docker-release-fidelity.test.ts`, `.github/workflows/release.yml`). That deliberately validates a different deployment configuration and does not establish configured-provider Docker parity. Keep Dockerfile dev supersedes pending a host deployment decision. No workflow step was removed; no workflow edits are proposed here.
