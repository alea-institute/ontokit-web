# Production fixes following the coverage audit

## Authority and retained evidence

The user authorized production fixes after the original tests-only audit. The detailed historical observations and 142-file test inventory remain in [coverage findings](2026-09-19-coverage-findings.md), committed at `d94a2671` on `docs/coverage-findings-20260919`. The implementation follows [the reviewed plan](../plans/2026-09-19-2012-fix-coverage-defects-plan.md) on `fix/coverage-defects-20260919`. All work is local; nothing was pushed, merged, deployed, or submitted as a PR. No packages were installed or network resources fetched.

Status: the combined implementation passes the full suite. Code review found three additional edge cases; their repairs and final verification are in progress.

## Finding dispositions

Repeated entries in the historical chronology are consolidated here. “Fixed” means a regression reproduced the failure and passed after the repair; final combined verification appears below.

| Finding | Disposition and correction |
|---|---|
| Earlier saves remove newer persisted drafts | Fixed for classes, properties and individuals. Clear only the exact submitted draft and suppress obsolete entity/branch feedback, errors and timers. Same-clock edits survive. |
| Class relationship removal/change retains old predicate | Fixed: explicit empty updates remove formerly managed predicates; unrelated annotations remain. |
| Property relationship removal re-emits original targets | Fixed: edited relationship arrays drive persistence. |
| Individual relationships duplicated | Fixed: special relationship predicates are excluded from generic annotation emission. |
| Subject lookup matches object-only references | Fixed: match the subject at a statement boundary, skip entire unrelated statements. |
| Numeric QName subject rejected after lookup repair | Fixed: recognize digit-first prefixed local names without matching object positions. |
| Unicode escapes lose characters | Fixed: decode valid BMP/supplementary escapes, retain escaped backslashes and reject invalid scalar escapes. |
| Writers introduce undeclared or wrongly bound standard prefixes | Fixed across class, property and individual writers using existing namespace-aware formatting. |
| Explicit data properties treated as annotations | Fixed when an unambiguous local `owl:DatatypeProperty` declaration exists. Boolean and numeric datatypes survive extract/write/reparse; removal actually removes the assertion. Undeclared/imported/ambiguously declared predicates keep the existing annotation fallback. |
| Decimal/exponent values truncated or numeric datatype lost | Fixed during data-assertion roundtrip verification: tokenize complete numeric values and preserve their implicit XSD datatype. |
| Old collaboration socket callbacks corrupt new connection | Fixed: socket identity guards events and retries; manual reconnect cancels prior retry. |
| Notification 401 disables renewed credentials forever | Fixed: credential scope resets polling; obsolete responses and read-mutation completions cannot alter current state. |
| Trust cache exposes prior viewer data | Fixed: cache identity includes stable viewer ID; unavailable permission/identity hides data. |
| Tree branch/search/navigation races | Fixed: scope and request generations reject obsolete root, expansion and navigation results; newer manual selection wins. |
| User search stale/debounced results after clear/context change | Fixed: cancel debounce and invalidate request identity on input, selection, credentials, disabled state and unmount. |
| Health tab does not refetch on branch change | Fixed: current active analysis tab reloads for the new context. |
| Health polling/socket completion leaks old branch results | Fixed for lint, consistency and duplicates with context/request guards after asynchronous boundaries. |
| Anonymous session remains bound to prior project | Fixed: restore per project and reject obsolete operations, including returning to the original project. |
| Anonymous failed submission removes recovery controls | Fixed: retain valid session content and retry/discard controls after failure. |
| Authenticated suggestion operations cross identity/session | Fixed: stable viewer identity clears old sessions; token renewal preserves drafts while invalidating earlier operations. Resume verification follows current session selection. |
| Review Files tab self-cancels and has no retry | Fixed: load by selected session/tab/request identity; expose visible failure and retry. |
| Cold URL selection disappears after branch initialization | Fixed in editor and viewer: defer consuming selection until branch initialization. |
| Cold resume discarded by initial BranchSelector notification | Fixed: initial synchronization preserves resumed sessions. |
| Zero-reference delete remains disabled | Fixed: only successful zero-reference lookup acknowledges automatically; failed lookup remains blocked with Retry. Obsolete lookups are ignored. |
| Reparent denial shows success and Undo | Fixed: propagate failure through the real mutation chain; publish undo/success only after persistence succeeds. |
| Anonymous reparent rejected before proposal path | Fixed: allow the established anonymous proposal capability while retaining authenticated checks elsewhere. |
| Root drop bypasses permission/editing checks; timer survives unmount | Fixed: validate root drops too; cancel expansion timer during cleanup. |
| Auto-suggestion timer disappears on keyed panel navigation | Fixed: persistent layout owns the delay, latest entity wins, disabling or unmounting cancels. |
| Developer navigation remains trapped in Source/Graph | Fixed: entity navigation switches back to the detail view. |
| Branch-list load error becomes an empty selector | Fixed: normalized branch-list error and Retry remain visible, including read-only selectors. |
| Custom language choice hidden by cmdk group | Fixed: custom group remains mounted and accessible during filtering. |
| Pending commit can close/reset on prop changes | Fixed: guard dismissal and repeated submission, preserve pending input; clean up focus timer. |
| Raw JSON in commit/property-list/confirmation errors | Fixed through the canonical API error formatter. |
| Monaco diagnostic mouse handler uses initial diagnostics | Fixed: mounted handler reads current diagnostics and callback. |
| Malformed external IRI aborts all link generation | Fixed: skip the invalid link while retaining valid links. |
| Source duplicate issue contains nested buttons | Fixed: primary issue and related-entity navigation buttons are siblings. |
| Repository file picker keeps prior selection/path mode | Fixed: reset selection and output mode before rescanning a different repository. |
| Identical index metadata leaves local status indexing | Fixed: reconcile on successful query update timestamp, including structurally shared data. |
| Earlier success timer clears newer user-settings notice | Fixed: replace timer and clear it on unmount. |
| Withdrawal failure hidden in closed form | Fixed: show error outside conditional form and clear it on retry. |
| Member mutation errors survive successful retry | Fixed: clear prior local error before role/removal/approval/decline attempts. |
| Review settings initial error presents editable fallback | Fixed: gate loading, show normalized error and Retry. |
| Pagination failure never reaches Promise.catch | Fixed: inspect React Query's resolved error result and expose Retry. |
| PR 403/404 classification depends on message text | Fixed: use typed `ApiError.status`. |
| PR creation misses asynchronous default target | Fixed: use live default until the user makes an explicit selection. |
| Translation config/reviewer refresh overwrites dirty form | Fixed: compare edits with the previous server baseline before adopting refresh; initial form preparation renders loading. |
| Comment reply/edit/delete errors only logged | Fixed: visible actionable error, cleared by retry, while retaining console diagnostics. |
| PR Party unpark/rerun error survives retry | Fixed: clear prior action error before retry. |
| Version scripts absorb unrelated staged files | Fixed: exact package path in commit command; disposable Git regressions preserve unrelated staged blobs. |

## Intentional behavior, unreachable paths and validation limits

| Observation | Evidence and disposition |
|---|---|
| BYOKeyPopover Enter/pending lifecycle hypotheses | No production import or caller in `app`, `components` or `lib`; only its own declaration and tests. Left unchanged as unreachable production UI, not reported fixed. |
| Undeclared/imported property classification | No local declaration establishes data versus annotation semantics. Preserve compatibility; imported vocabulary resolution needs an explicit additional contract/backend evidence. |
| Disconnected graph ancestors disappear | Graph builder explicitly prunes nodes without a displayed edge. No parent edge is fabricated from an inconsistent/disconnected ancestor response. Intentional current presentation. |
| Tree re-expansion refetches children | Existing refresh behavior, not an established caching defect. |
| MemberList callback rejection | Parent owns mutation errors; production parent paths now clear and render their errors. Standalone arbitrary callback behavior is not a separate UI contract. |
| New-project Import enabled before file choice | Handler intentionally validates missing file at submit. Not a defect. |
| Generation HTTP400 displays configured-model guidance | Existing deliberate error mapping; raw provider text is not the required UI. |
| GitGraph cramped fallback and absent CommitNode callback | Unreachable through normal positive dimensions and supplied graph callbacks. |
| BranchSelector non-Error switch fallback | Real BranchProvider produces wrapped errors. Distinct from the repaired load-error path. |
| Private parser boolean/bare literal fallbacks and empty-token guard | Normal parsing dispatches these earlier; no artificial calls or mutated built-ins added. |
| PR detail null render guards, queue non-Error errors and missing reviewer identity | Excluded by normal rendering/authentication/API contracts. |
| PropertyAssertionSection missing selection and ref-null guards | Normal enabled UI and DOM lifecycle prevent these paths. |
| IndividualList leaf expand/collapse and repeated collaboration cleanup guards | No-op leaf behavior and defensive cleanup are intentional. |
| ProjectForm blank-name guard and file-picker invalid/empty selection guards | Native required validation and disabled buttons prevent invalid submissions. |
| Worker empty sample/local-name debug guards | Valid worker messages filter empty subjects; no contrived array/Map mutation. |
| Next dynamic imperative insertion failure | Test resolver selected Pages Router implementation; fixture corrected to installed App Router alias. Not a production defect. |
| Empty-source imperative editor insertion fixture | Empty source reload replaces the mounted boundary; previous test assumption was unstable. No demonstrated data loss. |
| NextAuth exported route under Vitest | Installed native ESM cannot resolve `next/server` from the adapter. Auth.js core encrypted-session chain remains tested; live route/build not claimed verified. |
| Live OIDC/backend/Monaco/browser tab-close behavior | Offline environment; real frontend integrations use HTTP/editor/browser boundaries. No live external service or browser deployment validation claimed. |
| Multiple Turtle subjects on one source line | Existing line-based writer/block representation does not fully support this shape. Outside these focused repairs; no claim of general Turtle parser completeness. |
| Historical React act warnings | Remain visible in tests where present; stderr was not suppressed. |

## Verification

Before the review follow-up, the full suite passed **362 files / 5,110 tests**, with no failures or skipped cases, in **220.56 seconds**. TypeScript and whitespace checks pass; ESLint has **0 errors / 19 existing warnings**. Review follow-up verification is pending. Baseline before production fixes: **356 files / 4,963 passing tests**, original coverage lines **99.56%**, statements **98.90%**, functions **99.38%**, branches **95.55%**. Earlier audit baseline was 222 files / 3,445 tests, lines 89.24%, statements 86.84%, functions 85.27%, branches 81.27%.

Plan review completed with no retained findings. Implementation regression evidence is recorded in the new tests and the unit results below; full-suite results will supersede focused counts. No failed diagnostic probes are intentionally retained.

## Implementation evidence

| Unit | Regression evidence and focused checks |
|---|---|
| U1 | Real draft-store/writer races, 27 new cases; combined U1/U2 run20 files / 398 tests. |
| U2 | Missing/conflicting namespace, subject identity and Unicode regressions;23 new validity cases. |
| U3 | Eight initial relationship failures; final15 files / 505 tests passed. |
| U4 | Socket, notification, identity-cache, tree and search races; combined6 files / 112 tests passed plus socket 49 / notification 60 checks. |
| U5 | Five stale/refetch analysis cases;3 files / 110 tests passed. |
| U6 | Hook scope, viewer/session changes, diff loading and retry;6 files / 108 tests plus48 focused editor cases passed. |
| U7 | Sixteen observed initial regression failures across successive batches;14 files / 406 tests and branch follow-up 4 files / 78 tests passed. Whole editor file 131 tests passed with coverage after faithful Monaco mount fixture correction. |
| U8 | Accessible custom language, pending commit, current diagnostic handlers, malformed links, nested navigation and repository selection;5 files / 92 tests passed. |
| U9 | Each settings/review failure reproduced;25 files / 328 tests passed. Translation review selectors now separately assert dialog and row errors. |
| U10 | Three graph lifecycle/cap failures plus real ReactFlow no-op fit reproduced;5 files / 58 tests passed. |
| U11 | Both scripts absorbed an unrelated staged file before repair;12 disposable Git tests passed. |
| U12 | Six extractor/parser roundtrip regressions;17 ontology/panel files / 345 tests passed. Remaining inventory dispositioned above. |

The first combined run found **3 failures / 5,107 passes** in 362 files: two obsolete translation-review selectors after confirmation errors became readable, and a Monaco boundary that invoked onMount only once despite source-panel remounts. The corrected tests preserve their assertions and model the real mount lifecycle. Four affected follow-up files / 66 tests passed; the entire editor workflow file 131 tests passed with coverage. The combined rerun passed all 5,110 tests.

Simplification used three independent lenses. Reuse: six class-writer calls now reuse their existing vocabulary constants. The property-characteristic Record-to-Set proposal was skipped because it changes lookup behavior for arbitrary prototype-name strings; it is not needed for these repairs. Quality had the same map suggestion; efficiency found no actionable issue. Earlier simplification reused canonical annotation constants in the property/individual writers. TypeScript passes; full lint reports 0 errors and 19 existing warnings.

## Added regression inventory

Counts compare executed cases with the 4,963-test pre-fix baseline, including parameterized cases. Existing tests were also strengthened in other files.

| Test module | Added cases |
|---|---:|
| `__tests__/app/editor-actions.integration.test.tsx` | 10 |
| `__tests__/app/pr-party-settings.integration.test.tsx` | 1 |
| `__tests__/app/project-settings-index.integration.test.tsx` | 1 |
| `__tests__/app/project-viewer.integration.test.tsx` | 1 |
| `__tests__/app/suggestion-review.integration.test.tsx` | 2 |
| `__tests__/components/editor/BranchNavigator.test.tsx` | 1 |
| `__tests__/components/editor/ClassDetailPanel.branches.integration.test.tsx` | 2 |
| `__tests__/components/editor/CommitMessageDialog.integration.test.tsx` | 2 |
| `__tests__/components/editor/DeleteImpactAnalysis.test.tsx` | 2 |
| `__tests__/components/editor/EditorLayoutInteractions.integration.test.tsx` | 2 |
| `__tests__/components/editor/HealthCheckPanel.branches.integration.test.tsx` | 5 |
| `__tests__/components/editor/IndividualDetailPanel.coverage.test.tsx` | 3 |
| `__tests__/components/editor/PropertyDetailPanel.coverage.test.tsx` | 3 |
| `__tests__/components/editor/TurtleEditor.coverage.test.tsx` | 1 |
| `__tests__/components/graph/OntologyGraph.integration.test.tsx` | 1 |
| `__tests__/components/layout/notification-bell.integration.test.tsx` | 6 |
| `__tests__/components/pr/PRCreateModal.branches.integration.test.tsx` | 1 |
| `__tests__/components/projects/TranslationSettingsSection.integration.test.tsx` | 2 |
| `__tests__/components/projects/ontology-file-picker.integration.test.tsx` | 2 |
| `__tests__/components/projects/user-search-input.coverage.test.tsx` | 5 |
| `__tests__/components/revision/BranchSelector.coverage.test.tsx` | 1 |
| `__tests__/components/ui/confirm-dialog.test.tsx` | 1 |
| `__tests__/lib/hooks/autoSave.races.integration.test.ts` | 27 |
| `__tests__/lib/hooks/suggestion-scope.integration.test.tsx` | 15 |
| `__tests__/lib/hooks/useAutoSave.integration.test.ts` | 2 |
| `__tests__/lib/hooks/useAutoSuggestNavigation.test.ts` | 4 |
| `__tests__/lib/hooks/useCollaborationStatus.integration.test.tsx` | 1 |
| `__tests__/lib/hooks/useGraphData.lifecycle.integration.test.ts` | 3 |
| `__tests__/lib/hooks/useMemberTrust.test.tsx` | 1 |
| `__tests__/lib/hooks/useOntologyTree.integration.test.tsx` | 5 |
| `__tests__/lib/hooks/useTreeDragDrop.test.ts` | 3 |
| `__tests__/lib/ontology/entityDetailExtractors.integration.test.ts` | 6 |
| `__tests__/lib/ontology/turtleValidity.integration.test.ts` | 23 |
| `__tests__/scripts/version-scripts.integration.test.ts` | 2 |
| **Total** | **147** |

## Deployment validation handoff (not executed)

Delivery is local only. A deployment owner and production telemetry access have not been assigned in this session. Before a later release, the maintainer can repeat the draft/save/navigation, proposal retry, branch-switch, deletion and graph controls workflows against a disposable ontology and compare the saved source with the requested edit. A regression would be lost/newer draft content, obsolete branch results, incorrect RDF triples, unauthorized mutation or misleading success; any such observation should stop release or prompt rollback of the relevant fix. No live deployment result is implied by the offline suite.

## Pre-review coverage checkpoint

| Scope | Lines | Statements | Functions | Branches |
|---|---:|---:|---:|---:|
| Original lib/components scope | 99.67% (10088/10121) | 98.70% (11268/11416) | 99.53% (2935/2949) | 95.40% (8228/8625) |
| App/auth supplement | 96.87% (2103/2171) | 94.35% (2254/2389) | 94.78% (508/536) | 89.35% (1980/2216) |

Production changes alter branch/statement denominators; these are measured results, not a claim that every percentage increased. The original coverage audit's before/after results are preserved separately.

Review follow-up currently verifies terminal suggestion completion during token renewal, comment-adjacent Turtle terminators, and dotted/Unicode subject lookup. Six additional failing probes reproduced these paths before repair. Review capacity rejected fresh agents after the first independent reviewer, including a root-level retry; remaining review lenses use attributed inline passes, with no claim of independent coverage for those lenses.
