---
title: Fix production defects discovered during coverage audit
date: 2026-09-19
type: fix
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-plan-bootstrap
execution: code
origin: docs/handoffs/2026-09-19-coverage-findings.md
---

# Fix production defects discovered during coverage audit

## Goal Capsule

- Objective: Users can edit, save, navigate and review ontologies without losing newer drafts, corrupting source, or acting on obsolete asynchronous state.
- Means: Reproduce the recorded defects and make focused corrections using existing frontend patterns (KTD1–KTD3).
- Authority: The current user request authorizes production fixes. Prior no-network, no-installation, no-publication and secret-file exclusions still apply (R7).
- Execution: ce-work owns implementation, local verification, review and exact-path local commits. No deployment or remote delivery.
- Stop conditions: A required correction needs unavailable backend behavior or a genuine new product decision; preserve evidence and continue independent units.

---

## Product Contract

### Summary

Fix the defects discovered while raising coverage, preserving the detailed findings and a durable disposition for every observation.

### Problem Frame

The audit found real cases where successful-looking edits retain obsolete triples, older operations erase or overwrite newer state, and recovery controls disappear or give false feedback. The frontend already has the intended workflows; this work repairs them without redesigning the product.

### Requirements

**Data preservation**
- R1. Completing an earlier save must not delete a newer draft or overwrite another entity's state.
- R2. Saved Turtle must describe the requested entity edits exactly, preserve unrelated triples, and remain syntactically valid.

**Lifecycle and recovery**
- R3. Obsolete requests and sockets must not mutate the current project, branch, identity or selection.
- R4. Existing navigation, proposal, review, analysis and settings controls must complete their advertised behavior and expose actionable failures without false success.

**Verification and constraints**
- R5. Version scripts commit only their intended package change and preserve unrelated staged work.
- R6. Every recorded finding receives an evidence-based disposition; confirmed fixes have regression coverage exercising real module chains.
- R7. Use installed tools offline. Never read or write `.env`, `*.pem`, `*.key`, `twin-secrets/` or `~/.secrets`. Do not install, fetch, push, merge, deploy or open PRs.

### Scope Boundaries

Existing production defects and their regression tests are in scope. Pure coverage gaps, unreachable defensive arms, speculative redesigns, backend changes and live provider/browser validation are outside this local repair. Data-property versus annotation classification and disconnected graph display require evidence of the existing product contract before changing semantics.

---

## Planning Contract

### Key Technical Decisions

- KTD1. Reproduce before repair, using the audit's real HTTP, store, Turtle and browser-boundary fixtures. Tests may fail temporarily to prove a defect; final committed tests must pass.
- KTD2. Use immutable draft/request identity to guard completion. Clock timestamps alone cannot distinguish edits in one millisecond. Follow the scope-key/epoch pattern in `lib/hooks/useSourceRevisionGuard.ts`.
- KTD3. Keep changes at the owning boundary: writers own source validity; hooks own request lifecycles; UI owners own current selection and feedback. Avoid parallel sources of truth or broad refactors.
- KTD4. Preserve authorization and revision-conflict protection. Recovery restores legitimate retry; it never converts denial into permission or assumes a failed delete-impact lookup means zero references.

### Assumptions

The request authorizes fixing the verified defects rather than preserving buggy behavior solely to satisfy existing assertions. Existing non-defect behavior remains compatible. Inspection-only findings must first reproduce; ambiguous product semantics remain documented rather than guessed.

### Sequencing and Risks

Start with U1/U2/U4/U11; serialize shared writer and hook changes before U3/U7. Run independent units in bounded parallel groups with explicit file ownership. Session and authorization changes must include identity-transition tests. Turtle changes require parse/write/reparse assertions and neighbor preservation. U12 reconciles the complete inventory.

### Lifecycle Design

```mermaid
sequenceDiagram
    participant User
    participant Owner as Current editor context
    participant Store as Draft or request identity
    participant IO as Save or transport
    User->>Owner: Edit or change context
    Owner->>Store: Record current identity
    Owner->>IO: Start operation with captured identity
    User->>Owner: New edit or context change
    Owner->>Store: Replace current identity
    IO-->>Owner: Earlier operation completes
    Owner->>Store: Compare captured and current identity
    Store-->>Owner: Preserve newer state; ignore stale completion
```

---

## Implementation Units

| Unit | Scope | Primary file | Depends on |
|---|---|---|---|
| U1 | Preserve newer drafts during saves | `lib/hooks/useAutoSave.ts` | None |
| U2 | Correct Turtle subject lookup, escaping and prefixes | `lib/ontology/turtleUtils.ts` | None |
| U3 | Persist relationship edits exactly once | `components/editor/ClassDetailPanel.tsx` | U1, U2 |
| U4 | Isolate asynchronous hooks by current context | `lib/hooks/useCollaborationStatus.ts` | None |
| U5 | Keep health results scoped to the active branch | `components/editor/HealthCheckPanel.tsx` | None |
| U6 | Restore suggestion session recovery and identity | `lib/hooks/useAnonymousSuggestion.ts` | None |
| U7 | Repair editor initialization and mutation feedback | `app/projects/[id]/editor/page.tsx` | U1, U3, U6 |
| U8 | Repair editor browser controls | `components/editor/TurtleEditor.tsx` | None |
| U9 | Make settings and review feedback truthful | `app/projects/[id]/settings/page.tsx` | None |
| U10 | Repair graph retry, reset and viewport actions | `lib/hooks/useGraphData.ts` | None |
| U11 | Limit release-script commits to intended files | `scripts/set-version.mjs` | None |
| U12 | Close the remaining finding inventory | `docs/handoffs/2026-09-19-coverage-findings.md` | U1, U2, U3, U4, U5, U6, U7, U8, U9, U10, U11 |

### U1. Preserve newer drafts during saves

**Goal:** Preserve newer drafts during saves.

**Requirements:** R1, R6, R7.

**Dependencies:** None.

**Files:** `lib/hooks/useAutoSave.ts`, `lib/hooks/useEntityAutoSave.ts`, `lib/stores/draftStore.ts`, `__tests__/lib/hooks/useAutoSave.integration.test.ts`, `__tests__/lib/hooks/useEntityAutoSave.integration.test.ts`.

**Approach:** Compare the persisted draft generation captured at flush with the current entry before clearing it. Keep completion state scoped to the original entity and branch; preserve newer edits and failed writes. Follow the existing keyed draft store rather than introducing a second persistence layer.

**Execution note:** Start with a focused failing regression for each confirmed defect; inspect callers and preserve supported sibling behavior.

**Test scenarios:**

- Start a deferred save, persist another edit in the same clock tick, complete the first save: the newer draft remains and can then save.
- Repeat through class, property and individual real writers; failed saves retain the correct draft.
- Switch entity or branch during the save: completion cannot clear another key or overwrite its UI state.

**Verification:** The named regression and affected existing integration/unit suites pass; the observed failure is eliminated without bypassing its real production chain.

### U2. Correct Turtle subject lookup, escaping and prefixes

**Goal:** Correct Turtle subject lookup, escaping and prefixes.

**Requirements:** R2, R6, R7.

**Dependencies:** None.

**Files:** `lib/ontology/turtleUtils.ts`, `lib/ontology/turtleBlockParser.ts`, `lib/ontology/turtleClassUpdater.ts`, `lib/ontology/turtlePropertyUpdater.ts`, `lib/ontology/turtleIndividualUpdater.ts`, `__tests__/lib/ontology/turtleUtils.integration.test.ts`, `__tests__/lib/ontology/turtleBlockParser.integration.test.ts`, `__tests__/lib/ontology/turtleClassUpdater.test.ts`.

**Approach:** Identify a subject only at a statement subject position. Decode valid Unicode escapes without confusing escaped backslashes; use existing namespace utilities to declare generated prefixes or emit full IRIs. Preserve unrelated source and existing bindings. Prefer the existing IRI-to-Turtle formatter so absent or conflicting standard prefixes produce full IRIs. The local parser tolerates unresolved QNames, so verify resolved predicate/type IRIs and absence of undeclared standard QNames explicitly.

**Execution note:** Start with a focused failing regression for each confirmed defect; inspect callers and preserve supported sibling behavior.

**Test scenarios:**

- An IRI present only as an object returns no subject block; actual full-IRI subjects still parse.
- BMP and supplementary Unicode escapes decode correctly; escaped backslashes stay literal; invalid escapes fail safely without corrupting neighbors.
- Update a source declaring only its application prefix and full OWL types: the output parses with all emitted names bound.

**Verification:** The named regression and affected existing integration/unit suites pass; the observed failure is eliminated without bypassing its real production chain.

### U3. Persist relationship edits exactly once

**Goal:** Persist relationship edits exactly once.

**Requirements:** R2, R6, R7.

**Dependencies:** U1, U2.

**Files:** `components/editor/ClassDetailPanel.tsx`, `components/editor/PropertyDetailPanel.tsx`, `components/editor/IndividualDetailPanel.tsx`, `lib/hooks/useAutoSave.ts`, `lib/ontology/turtleClassUpdater.ts`, `lib/ontology/turtlePropertyUpdater.ts`, `lib/ontology/turtleIndividualUpdater.ts`, `__tests__/components/editor/ClassDetailPanel.branches.integration.test.tsx`, `__tests__/components/editor/PropertyDetailPanel.coverage.test.tsx`, `__tests__/components/editor/IndividualDetailPanel.coverage.test.tsx`.

**Approach:** Make the edited relationship draft authoritative for managed predicates, including explicit empty arrays. Avoid emitting both generic annotations and special relationship arrays for the same triple; preserve unrelated annotation predicates. The class writer intentionally preserves omitted predicates, so removals need explicit empty updates rather than wholesale annotation replacement.

**Execution note:** Start with a focused failing regression for each confirmed defect; inspect callers and preserve supported sibling behavior.

**Test scenarios:**

- Remove the sole seeAlso target, save and reparse: it is absent for each entity type.
- Change seeAlso to a custom predicate while retaining isDefinedBy: only the requested predicates remain.
- Save an unchanged or edited individual relationship: exact cardinality remains one.

**Verification:** The named regression and affected existing integration/unit suites pass; the observed failure is eliminated without bypassing its real production chain.

### U4. Isolate asynchronous hooks by current context

**Goal:** Isolate asynchronous hooks by current context.

**Requirements:** R3, R6, R7.

**Dependencies:** None.

**Files:** `lib/hooks/useCollaborationStatus.ts`, `lib/hooks/useNotifications.ts`, `lib/hooks/useOntologyTree.ts`, `lib/hooks/useMemberTrust.ts`, `components/projects/user-search-input.tsx`, `__tests__/lib/hooks/useCollaborationStatus.integration.test.tsx`, `__tests__/components/layout/notification-bell.integration.test.tsx`, `__tests__/lib/hooks/useOntologyTree.integration.test.tsx`, `__tests__/lib/hooks/useMemberTrust.test.tsx`, `__tests__/components/projects/user-search-input.coverage.test.tsx`.

**Approach:** Use request/socket identity and cleanup to reject obsolete callbacks. Reset authentication-specific polling state on a credential change, scope authorization-related caches to identity without exposing credentials, and reproduce inspection-only tree/search/cache findings before changes.

**Execution note:** Start with a focused failing regression for each confirmed defect; inspect callers and preserve supported sibling behavior.

**Test scenarios:**

- Open a replacement socket after token change, then deliver old close/open events: replacement stays connected and no extra reconnect starts.
- Receive notifications 401, renew token, rerender: a valid authenticated request restores polling.
- Resolve old tree/search requests after branch/query changes or clearing: stale data stays hidden; current errors remain retryable.
- Change viewer identity with cached trust data: previous private capabilities do not become actionable.

**Verification:** The named regression and affected existing integration/unit suites pass; the observed failure is eliminated without bypassing its real production chain.

### U5. Keep health results scoped to the active branch

**Goal:** Keep health results scoped to the active branch.

**Requirements:** R3, R4, R6, R7.

**Dependencies:** None.

**Files:** `components/editor/HealthCheckPanel.tsx`, `__tests__/components/editor/HealthCheckPanel.branches.integration.test.tsx`, `__tests__/components/editor/HealthCheckPanel.integration.test.tsx`.

**Approach:** Guard polling and socket completions after every asynchronous boundary with the request context. On branch change reload the active analysis tab; preserve cancellation and remove nested interactive buttons where the real navigation fixture reproduces invalid markup.

**Execution note:** Start with a focused failing regression for each confirmed defect; inspect callers and preserve supported sibling behavior.

**Test scenarios:**

- Start duplicate analysis, change branch, complete old poll: no old result or loading/error state leaks.
- Repeat for consistency analysis, panel close and unmount, then allow a new request to finish.
- Switch branches while a result tab is active: only current-branch results appear; duplicate navigation remains accessible.

**Verification:** The named regression and affected existing integration/unit suites pass; the observed failure is eliminated without bypassing its real production chain.

### U6. Restore suggestion session recovery and identity

**Goal:** Restore suggestion session recovery and identity.

**Requirements:** R3, R4, R6, R7.

**Dependencies:** None.

**Files:** `lib/hooks/useAnonymousSuggestion.ts`, `lib/hooks/useSuggestionSession.ts`, `app/projects/[id]/suggestions/review/page.tsx`, `__tests__/lib/hooks/useAnonymousSuggestion.integration.test.tsx`, `__tests__/app/suggestion-review.integration.test.tsx`.

**Approach:** Restore anonymous state per project, reject stale completions, keep retry/discard available after failed submission, and tie diff loading to selected session/tab identity instead of its own loading state. Verify actual filenames before edits.

**Execution note:** Start with a focused failing regression for each confirmed defect; inspect callers and preserve supported sibling behavior.

**Test scenarios:**

- Project changes without remount restore only that project session; late old completion cannot modify the new one.
- Submit anonymous proposal receives 403, retry succeeds using the same valid session and retained content.
- Open Files for a linked PR: real diff HTTP response renders; switching session/tab during request does not leak stale diff; failures have a usable recovery path.

**Verification:** The named regression and affected existing integration/unit suites pass; the observed failure is eliminated without bypassing its real production chain.

### U7. Repair editor initialization and mutation feedback

**Goal:** Repair editor initialization and mutation feedback.

**Requirements:** R4, R6, R7.

**Dependencies:** U1, U3, U6.

**Files:** `app/projects/[id]/editor/page.tsx`, `lib/hooks/useProjectViewer.ts`, `lib/context/BranchContext.tsx`, `components/revision/BranchSelector.tsx`, `components/editor/DeleteImpactAnalysis.tsx`, `lib/hooks/useTreeDragDrop.ts`, `components/editor/BranchNavigator.tsx`, `components/editor/standard/StandardEditorLayout.tsx`, `components/editor/developer/DeveloperEditorLayout.tsx`, `__tests__/app/editor-actions.integration.test.tsx`, `__tests__/app/project-viewer.integration.test.tsx`, `__tests__/components/editor/EditorLayoutInteractions.integration.test.tsx`.

**Approach:** Apply cold URL selections and resumed sessions after initial branch resolution; distinguish initial branch synchronization from user-requested switches. Permit zero-reference deletion only after successful impact lookup, retaining fail-closed behavior for lookup errors. Publish reparent success/undo after successful persistence. Place delayed auto-suggestion ownership in a mounted lifecycle that survives entity navigation. Preserve trust and proposal authorization.

**Execution note:** Start with a focused failing regression for each confirmed defect; inspect callers and preserve supported sibling behavior.

**Test scenarios:**

- Cold classIri URL selects the class after delayed branches/tree; cold resume never discards the resumed session during initialization.
- Zero-reference deletion becomes confirmable after lookup; lookup failure remains blocked with recovery; referenced deletion still requires acknowledgement.
- Reparent HTTP403/409 rolls back with error and no success/undo; success produces one action; anonymous path follows existing proposal capabilities.
- Navigate between keyed entity panels: enabled automatic suggestion runs once for the latest entity; disabling or unmounting cancels it.

**Verification:** The named regression and affected existing integration/unit suites pass; the observed failure is eliminated without bypassing its real production chain.

### U8. Repair editor browser controls

**Goal:** Repair editor browser controls.

**Requirements:** R4, R6, R7.

**Dependencies:** None.

**Files:** `components/editor/TurtleEditor.tsx`, `components/editor/LanguagePicker.tsx`, `components/editor/CommitMessageDialog.tsx`, `components/projects/ontology-file-picker.tsx`, `__tests__/components/editor/TurtleEditor.coverage.test.tsx`, `__tests__/components/editor/OntologySourceEditor.integration.test.tsx`, `__tests__/components/editor/LanguagePicker.test.tsx`, `__tests__/components/editor/CommitMessageDialog.integration.test.tsx`, `__tests__/components/projects/ontology-file-picker.integration.test.tsx`.

**Approach:** Read current diagnostics from mounted editor handlers, handle malformed external IRIs safely, expose valid custom language options, preserve pending commit operations and clear file selections when repository identity changes. Reproduce control hypotheses before fixes.

**Execution note:** Start with a focused failing regression for each confirmed defect; inspect callers and preserve supported sibling behavior.

**Test scenarios:**

- Mount editor before worker lint completes, then click diagnostic glyph: current issue navigates correctly.
- Malformed external IRI does not crash link navigation; normal internal/external navigation remains intact.
- Search a custom language tag and select the visible option.
- Pending commit cannot be accidentally dismissed; rejection exposes readable error and retry; changing repository clears old file selection.

**Verification:** The named regression and affected existing integration/unit suites pass; the observed failure is eliminated without bypassing its real production chain.

### U9. Make settings and review feedback truthful

**Goal:** Make settings and review feedback truthful.

**Requirements:** R4, R6, R7.

**Dependencies:** None.

**Files:** `app/projects/[id]/settings/page.tsx`, `app/settings/page.tsx`, `app/page.tsx`, `app/projects/[id]/page.tsx`, `app/pr-party/settings/page.tsx`, `app/projects/[id]/pull-requests/[prNumber]/page.tsx`, `components/projects/TranslationSettingsSection.tsx`, `components/pr/PRCreateModal.tsx`, `components/pr/PRCommentThread.tsx`, `components/pr-party/PRPartyCard.tsx`, `components/ui/confirm-dialog.tsx`, `__tests__/app/project-settings-index.integration.test.tsx`, `__tests__/app/user-settings.integration.test.tsx`, `__tests__/app/project-dashboard.integration.test.tsx`, `__tests__/app/pr-party-settings.integration.test.tsx`, `__tests__/app/pull-request-routes.integration.test.tsx`.

**Approach:** Reconcile reindex completion even when server metadata is structurally unchanged; give each success notice its own current lifetime. Clear resolved mutation errors, show otherwise hidden failures, handle typed API status rather than searching error text, initialize target branches from resolved data without overwriting user choice, and protect unsaved translation settings during refresh. Verify actual route parameter names before editing.

**Execution note:** Start with a focused failing regression for each confirmed defect; inspect callers and preserve supported sibling behavior.

**Test scenarios:**

- Reindex completes with identical ready metadata: status returns to ready.
- Save settings twice two seconds apart: second notice remains for its intended interval.
- Failed withdrawal/comment/member/review/settings load is visible; retry clears only the relevant error and preserves input.
- JSON403/404 classifies correctly; initial branch arrives late and untouched PR target updates.
- Background refresh preserves unsaved translation edits; pagination failure presents usable retry while existing cards remain.

**Verification:** The named regression and affected existing integration/unit suites pass; the observed failure is eliminated without bypassing its real production chain.

### U10. Repair graph retry, reset and viewport actions

**Goal:** Repair graph retry, reset and viewport actions.

**Requirements:** R3, R4, R6, R7.

**Dependencies:** None.

**Files:** `lib/hooks/useGraphData.ts`, `components/graph/OntologyGraph.tsx`, `__tests__/lib/hooks/useGraphData.integration.test.ts`, `__tests__/lib/hooks/useGraphData.lifecycle.integration.test.ts`, `__tests__/components/graph/OntologyGraph.integration.test.tsx`.

**Approach:** Make explicit retry eligible after transient detail failure, reload the focused graph on reset, connect the custom Fit view action to the actual graph instance, and reserve resolution capacity before parallel requests. Retain namespace, label and connection semantics.

**Execution note:** Start with a focused failing regression for each confirmed defect; inspect callers and preserve supported sibling behavior.

**Test scenarios:**

- Failed expansion followed by explicit retry succeeds without a remount.
- Reset clears expansion state and reloads the focus; old in-flight results cannot repopulate reset state.
- Custom Fit view invokes the actual viewport action.
- Wide neighborhoods stay within the configured resolution cap while usable connected nodes remain.

**Verification:** The named regression and affected existing integration/unit suites pass; the observed failure is eliminated without bypassing its real production chain.

### U11. Limit release-script commits to intended files

**Goal:** Limit release-script commits to intended files.

**Requirements:** R5, R6, R7.

**Dependencies:** None.

**Files:** `scripts/set-version.mjs`, `scripts/prepare-release.mjs`, `__tests__/scripts/version-scripts.integration.test.ts`.

**Approach:** Use explicit commit paths while preserving unrelated staged index entries and existing validation semantics. Run scripts only in disposable repositories with hooks, signing and network disabled.

**Execution note:** Start with a focused failing regression for each confirmed defect; inspect callers and preserve supported sibling behavior.

**Test scenarios:**

- With an unrelated staged file, each version script commits package metadata only and leaves the unrelated change staged.
- Invalid input leaves package and history unchanged; valid version updates still succeed.

**Verification:** The named regression and affected existing integration/unit suites pass; the observed failure is eliminated without bypassing its real production chain.

### U12. Close the remaining finding inventory

**Goal:** Close the remaining finding inventory.

**Requirements:** R6, R6, R7.

**Dependencies:** U1, U2, U3, U4, U5, U6, U7, U8, U9, U10, U11.

**Files:** `docs/handoffs/2026-09-19-coverage-findings.md`, `docs/handoffs/2026-09-19-production-fix-results.md`.

**Approach:** Map every original finding to a verified fix, an unreproduced hypothesis, intentional/unreachable behavior, or a named external/product blocker. Investigate BYOKeyPopover reachability, root-drop validation and timer cleanup, developer navigation view switching, annotation/data-property classification and disconnected graph ancestors. Apply additional bounded defect fixes only after reproducing a violated existing contract; preserve tests and record exact owned files in execution results.

**Execution note:** Start with a focused failing regression for each confirmed defect; inspect callers and preserve supported sibling behavior.

**Test scenarios:**

- Every confirmed reproduction has a passing regression or a specific documented blocker.
- No inspection hypothesis is reported fixed without evidence; no new product behavior is inferred from a coverage gap.
- Full test suite, static checks and final review cover the combined changes; abandoned probes are removed.

**Verification:** The named regression and affected existing integration/unit suites pass; the observed failure is eliminated without bypassing its real production chain.

---

## Verification Contract

Use the installed Vitest runner with a test-only configuration that sets `envDir: false`, preserving the existing setup, aliases and test inclusion. The existing offline configuration used in the coverage audit can be reused while available; otherwise reconstruct it from `vitest.config.ts` without loading environment files. Run focused regressions for each unit, then the full suite and coverage on the same original scope. Run TypeScript without incremental output, ESLint and diff whitespace checks. Preserve stderr, distinguish existing warnings from new failures, and report real tallies. Baseline is 356 files and 4,963 passing tests. Do not run release scripts in the actual working repository or a build that loads prohibited environment files.

## Definition of Done

All implementation units have a verified outcome or an explicit evidence-based blocker; no confirmed in-scope defect is silently left behind. Each fix is protected by a regression, full-suite and static checks pass, final code review findings are resolved or reported, and abandoned experimental code is removed. Detailed findings and final dispositions are committed durably. All commits remain local and path-limited.

## Sources and Research

- `docs/handoffs/2026-09-19-coverage-findings.md`: detailed reproductions, hypotheses, baseline and test inventory.
- Existing hooks, writers, editor routes and integration tests named in each unit.
- No institutional solutions corpus or configured Compound Packs found. External research is excluded by the user's offline restriction.
