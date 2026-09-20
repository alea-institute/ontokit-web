# Coverage audit and production defect findings — 2026-09-19

## Authoritative checkpoint

- Coverage branch: `test/coverage-20260919`; final commit: `7a378b86`.
- Baseline: 222 test files, 3,445 tests. Final: 356 files, 4,963 tests, zero failures or skipped tests; 218.79 seconds.
- Added: 1,518 tests across 142 test files.
- Original coverage scope: lines 89.24% → 99.56%; statements 86.84% → 98.90%; functions 85.27% → 99.38%; branches 81.27% → 95.55%.
- Supplemental app/auth: 95.81% lines, 93.22% statements, 93.03% functions, 87.95% branches.
- TypeScript passed; full ESLint: zero errors, 19 existing warnings.
- No production changes were made in the coverage task. Work was local; no push, merge, deployment, package installation or network fetch.

## Continuation authority and evidence

The user subsequently authorized fixing production defects and requested ce-plan followed by ce-work. The historical tests-only restriction below describes the completed coverage task; it no longer prohibits fixes in the continuation. Network, package-installation, publishing and secret-file restrictions remain in force.

Reproduce each defect with a regression test before fixing it. Inspection-only observations are hypotheses, not established defects. Some uncovered branches are unreachable or intentionally guarded and need no production change. Do not turn every coverage gap into a feature request.

The chronology below preserves the detailed findings and distinctions between observed failures, inspection hypotheses, fixture corrections and coverage limitations. Earlier entries labelled “Final” are intermediate checkpoints superseded by the authoritative checkpoint above. Temporary paths are historical evidence pointers, not dependencies; they may disappear after cleanup or reboot. The reproduction descriptions in this document remain durable.

## Detailed investigation log

Initial baseline 222 files / 3445 tests passed. Lines89.24 branches81.27 statements86.84 functions85.27.
Checkpoint1 dd8d31b3: 232 files /3564 tests passed. Lines92.09 branches83.84 statements89.78 functions87.02.
Preexisting docs/handoffs/2026-09-18-codex-pickup.md untouched. User forbids all production edits/network/install/push/PR. Local branch test/coverage-20260919 from original4f6eeed3.
Findings (inspection unless specified):
- entityDetailExtractors.ts dataPropertyAssertions population unreachable: every literal outside metadata yields a groupAnnotations entry, making !isKnownAnnotation false. Do not change production.
- BYOKeyPopover: no production import/caller; Enter does not guard isValidating; pending success not cancelled/scoped to owner changes/unmount.
- TurtleEditor malformed external IRI https://[invalid] throws TypeError in link provider (test-characterized). Real Monaco browser/CDN/layout not verified in offline jsdom.
- useMemberTrust cache key omits auth identity; disabled queries can still expose seeded project cache, caller cache clearing needs review.
- useOntologyTree branch changes lack request cancellation/version guard: potential stale prior branch responses replace new nodes.
- UserSearchInput lacks sequencing/abort; clearing does not cancel pending debounce; potential stale results after clear/change.
External backends/providers, browser tab-close and real Monaco rendering unavailable offline; new integrations use real frontend chains with only fetch/editor/browser boundary fixtures.
Existing baseline React act warnings and nested-button warnings remain visible. No production modifications allowed.

Wave3-5 findings:
- Individual extractor confirmed custom owl:DatatypeProperty literal is grouped as annotation. Removed unsupported parsed-data-removal expectation; genuine UI payload tests retained.
- GitGraph cramped S-curve fallback unreachable for positive dimensions; CommitNode missing-handler fallback unreachable through GitGraph.
- BranchSelector non-Error switch fallback unreachable through BranchProvider; branch list errors render empty selector.
- Tree root drops bypass validation after drag start; auto-expand timer lacks unmount cleanup (inspection).
- MemberList delegates callback rejection handling to parent; standalone callback rejections escape.
- File picker may retain previous selection when repository changes and next scan has multiple results (inspection). Disabled UI makes no-selection/invalid-path guards unreachable.
- Developer layout navigation ref changes entity type without exiting source/graph view (inspection). Source/graph actual browser rendering remains boundary fake.
- TranslationSettings briefly renders fallback error after query resolves before form effect initializes (observed).
- CommitMessageDialog and property list expose JSON API error through Error.message. Desired parsed-detail test removed; plain-text error retry tested.
- Commit dialog Close/Escape can close while pending although Cancel disabled (inspection).
- Turtle parser private parseLiteral boolean/bare branches unreachable: caller handles booleans/numbers before calling parseLiteral. tokens.length===0 unreachable after successful findBlock identifying subject. Nested collection tokenization tested without asserting unsupported collection semantics.
- Machine PreCompact automation independently created b9b912eb, including preexisting handoff and planning metadata; these were not staged or edited by coverage work. Preserve automation commit; own commits scope tests only.

- Graph ancestry API can resolve a node that the graph builder omits if no parent edge connects it to focus. Desired disconnected-ancestor display test removed after failure; production not changed.
- Graph MAX_RESOLVED_NODES guard checks cache before parallel requests complete, so initial wide neighborhoods can exceed the cap (inspection). Existing-count cap and50-ancestor bound pass.
- ConfirmDialog displays raw JSON ApiError.message while companion toast extracts readable detail (property distinct decision worker).
- TurtleEditor gutter-click handler retains initial diagnostics=[] despite later marker updates (real SourceEditor integration failure, unsupported assertion removed).
- PRPartyCard error is not cleared after successful unpark/rerun retry (worker observation); announcements and query invalidations still occur.
- PRDetail null guards inside rendering-only helper cannot be reached because early render return excludes null PR.

- NewProject import submit button is enabled before a file is chosen; handler validates missing file on submit. Unsupported disabled-button expectation removed.

Wave8-10:
- Suggestion review diff effect depends on isDiffLoading and may self-cancel after setting it; error page has no retry (inspection worker).
- Dashboard failed withdrawal sets joinError rendered only in the closed join form; pending-request users receive no visible error.
- Project settings member-mutation error remains visible after successful retry.
- PR Party settings ignores initial settings-load errors and presents editable fallback preferences.
- Viewer cold-load classIri selection is cleared by default-branch tree reload after URL selection is consumed; desired restoration test failed and was deleted. Explicit user selection tested separately.
- Machine PreCompact automation independently committed c0769d7f while work continued; route tests included by automation were preserved and subsequently verified together (59 passed). No publication by coverage work.
- EntityTree/useOntologyTree re-expansion fetches children again; desired cached-child-reuse test failed and was deleted. This is current behavior, not necessarily a defect.
- Project listing pagination request failures do not reject fetchNextPage; route .catch cannot show nextPageError/Retry label. Existing cards and Load More retry work.
- Pull-request detail page matches 403/404 in Error.message rather than ApiError.status, missing friendly classification for ordinary JSON detail.
- PRCreateModal default targetBranch initializes before async BranchProvider and does not resync default branch.
- HealthCheckPanel branch switch discards old quality results but selected tab does not refetch until tab navigation.

Final: 307 files /4303 tests passed;858 added. Lines98.54 branches92.79 statements97.44 functions97.21. Final own commit7f092fa4; clean worktree; no push/merge/deploy/PR.
- Generation HTTP400 maps to configured-model guidance; unsupported raw-provider-error expectation deleted.
- Source editor worker test timing corrected by waiting for actual lint payload. Query fixture clients cleared after each test (immediate GC removed because it invalidated cache-inspection tests).

Continuation 2026-09-19: PRCommentThread reply/edit/delete failures log errors without visible user feedback. PRPartyQueueView non-Error fallback cannot arise through real ApiError-wrapping client; missing reviewer guard requires abnormal authenticated session without id/email. PropertyAssertionSection selected-property guard inside handleAddObject is inaccessible through normal enabled UI; ref-null outside-click arms need lifecycle combinations outside normal DOM interaction. Browser/remote-service checks remain outside offline scope.

LanguagePicker integration: searching x-fixture creates the custom option inside a cmdk group with hidden attribute. forceMount is applied to the item only, leaving the Custom group hidden. Custom-language selection expected-visible test deleted per user contract; production unchanged. Observed real rendered listbox DOM, not mocked language control.

Source duplicate navigation integration triggers existing nested-button HTML warning: duplicate button is inside the issue-row button. Navigation and stopPropagation work in JSDOM; actual browser hydration/accessibility not verified offline. Production unchanged.

Automatic annotation navigation: real StandardEditorLayout with stateful selectedIri, authenticated editor and configured LLM navigates First -> Second but never sends generate-suggestions after1600ms. BranchNavigator installs800ms timer after onNavigate; keyed ClassDetailPanel remount unmounts the navigator and cleanup cancels timer. Expected-auto-request test failed and was deleted per contract. Developer layout has the same keyed-panel/timer structure by inspection. No production changes.

Graph integration observed: failed node expansion does not retry a previous class-detail failure because useGraphData.fetchDetail caches failedIris. Unsupported retry test deleted. Reset graph clears all graph data and caches but does not trigger initial load again; unsupported reset-reload test deleted. Production unchanged. Both observed with real ReactFlow, ELK, hooks, API client and fetch fixtures.

ClassDetailPanel real relationship group persistence finding: with seeAlso Old and isDefinedBy Retained, remove Old, add New, change seeAlso property to custom related, save through updateClassInTurtle. Parsed output contains related New and isDefinedBy Retained but STILL contains a seeAlso statement. Unsupported remove/change test deleted, production unchanged.

IndividualDetailPanel real edit/remove annotation chain duplicates rdfs:seeAlso reference in saved/reparsed Turtle (two identical IRIs instead of one). Both new failing preservation tests deleted as required; production unchanged. Existing tests assert contains rather than exact cardinality and miss duplication. TranslationSettingsSection config effect unconditionally replaces form on any config refresh (inspection); unlike LintConfigSection, unsaved edits have no refresh guard.

PropertyDetailPanel confirmed via real UI->draft->writer->parser: removing sole seeAlso target, Save->Saved, extractPropertyDetail still returns original reference. Production onFlush passes detail.seeAlsoIris/isDefinedByIris at226-227 alongside draft relationship annotations; writer124-132 re-emits old arrays. Failing test deleted per user instruction. No production modifications. Same design can duplicate retained relationships and preserve obsolete targets after property change.

2026-09-19 settings index: app/projects/[id]/settings/page.tsx:190-193 mirrors query data into local state, then handleReindex sets local status indexing. If index_complete refetch returns deeply identical ready metadata, React Query structural sharing keeps indexQueryData identity and the copying effect does not rerun. UI button becomes enabled but status stays Indexing in progress. Reproduced with real page/hook/WebSocket parser and identical HTTP result, failing assertion at old test line70. Removed that failing test per user; retained distinct changed-metadata completion case. No production edit.

2026-09-19 editor delete: real EditorPage + ConfirmDialog + DeleteImpactAnalysis + HTTP reference lookup with zero references leaves Delete disabled. DeleteImpactAnalysis resets onAcknowledge(false) on lookup and returns null for total0 without setting true; page confirmDisabled={!deleteImpactAcknowledged}. Same issue inferred on lookup error (no acknowledgement UI). Reproduced actual test failure at editor-actions oldline175; failing zero-reference test deleted, production untouched. Retained separate referenced-entity acknowledgement, successful deletion, rollback and cancel tests.

Editor class save: source containing only ex prefix and fully-qualified owl type is rewritten with owl:Class and rdfs:label without declaring these prefixes. Real page/form/writer test output confirmed invalid undeclared prefixes. Removed that failing variant; normal declared-prefix source integration retained. Production unchanged.

Viewer cold URL class selection race: real route starts unscoped tree request before branches resolve; URL effect restores Person via unscoped ancestors and marks key consumed. Default main branch then resets tree/selectedIri. Final page has no class detail, despite successful request. Both ancestor200/403 testvariants failed waiting for class detail and were deleted. Separate later URL-navigation tests run after branch resolution. Production unchanged.

CONFIRMED suggestion review diff unreachable: linked session pr_number12, actual Files tab, real pullRequestsApi GET /pull-requests/12/diff returned200 withvalidfilepatch. UI remained loading (tabpanel empty text) instead of showingpatch. Effect page232-244 includes isDiffLoading in deps, sets it true then cleanup cancels pending response; rerun exits dueisDiffLoadingtrue, originalfinallyalsoignored. Both directtext and awaitedrequest+tabpaneltext diagnostics failed. Diagnostic test and its HTTPfixture deleted; no productionchange. Cannot genuinely cover privateDiffView via page untilproductionfixed.

Anonymous proposal submit recovery: HTTP403 sets useAnonymousSuggestion status=error; isActive is only active/saving, so page removes Submit Proposal and Discard. Propose Edit calls startSession, which returns existing branch early without restoring active status. Session token persists but retry UI is unavailable. Real-page submission retry failed; unsupported failure parameter deleted; production unchanged. Evidence editor-anonymous-focused.json initial45test run (44pass1fail).

Reparent UI false success confirmed via real keyboard DndContext and HTTP403/409: both show Failed to reparent class and Moved "Person" simultaneously after rollback. Diagnostic stdout REPARENT_DIAGNOSTIC403/409 Moved "Person", focused3PASS. useTreeDragDrop sets undoAction before awaiting onReparent; layout success-toast effect runs on undoAction, and handleDndReparent catches without rethrowing. Production unchanged; retained tests verify rollback and error, temporary diagnostic log removed.

Checkpoint 4e6ebd9f: full 342 files / 4728 tests passed, 203.58s. 1283 cumulative added tests across121 test files; current editor batch32. Default coverage lines99.42 statements98.50 functions99.14 branches94.41. Supplemental app/auth lines93.07 statements90.25 functions85.68 branches83.71. Editor page lines408/450=90.66. Full lint0errors19existingwarnings; tsc/scopedlint/diffcheckpassed. Automated580089b2 saved prior24 editor tests plus unrelated planning metadata; preserved. Own4e6ebd9f contains test file only. No production edits/publication. Phase2 continues; next-targets.txt lists resume/beacon/parser/settings opportunities.

Confirmed: editor cold resume URL can discard resumed suggestion session during BranchSelector initial notification. Diagnostic GET sessions -> POST existing-session/discard -> POST sessions -> PUT save; Resubmit button absent. Failed cold-resume expectation removed; testing URL update after branch initialization separately. No production change.

Fixture correction: Vitest Node resolves next/dynamic Pages Router loader, whose ref is retry-only. Next installed createAppRouterApiAliases maps dynamic to next/dist/api/app-dynamic. Editor integration now uses that actual installed App Router implementation; mounted insertAtEnd tests4pass. Initial insertAtEnd TypeError was a framework-resolution fixture mismatch, not a confirmed production defect.
FilteredTree baseline repeat-render warnings came from new searchResults arrays allocated inside renderHook. Hoisted stable test arrays; strengthened request-count assertions. No production change.

Checkpoint807f8c62: editor-resume full suite342files4743tests0failures207.31s. Cumulative1298addedtests121fileswithaddedtests; existingfiltered-treeunitfilealso2strengthenedtests. Defaultcoverage99.42lines98.51statements99.14functions94.42branches; supplementalapp/auth93.21lines90.38statements85.87functions83.89branches. Localonlycommits8df12d88 and807f8c62. No productionchanges. Goal remainsactive, meaningfultargetsremain (next-targets.txt).

Confirmed testability limit: real exported NextAuth route GET cannot import under installed Vitest Node configuration: next-auth/lib/env.js imports next/server without .js, native ESM resolves MODULE_NOT_FOUND. Diagnostic auth-route test removed; existing Auth.js-core encrypted-session integration remains. Production/build config unchanged per tests-only scope.

Confirmed 2026-09-19: turtleUtils.findBlock full-IRI fallback matches an object reference anywhere on a non-continuation line. parseBlockTriples(source, missingIRI) returns unrelated subject triples for `ex:item ex:related <http://example.org/ont#missing> .`, instead of null. Diagnostic test failed (1 failed, 15 passed) and was deleted per tests-only contract. No production change.

Confirmed useAnonymousSuggestion projectId change without remount retains oldproject session: seededfirst/secondsessions, renderfirst->rerendersecond yieldsfirst-session. restoredRef guard skips rerestore despite projectId dependency; subsequent callbacks capture newprojectId witholdsessioncredentials byinspection. Diagnosticfailed1/12pass anddeletedpercontract. Whether actualNextnavigationremounts editor is not yetverified; no claim of crossproject server access.

Empty-source mounted imperative insertion test proved nondeterministic in fullsuite (executeEdits0 expected1; focusedwholefile112PASSafterward). DeveloperEditorLayout434-437 reloads while sourceContent empty, replacing source editor with loading UI750; an attached fixturemodel is not stable through that lifecycle. Removed empty-source tuple per unsupportedtestcontract, retained3nonemptyimperative cases and existingempty-source fallback coverage. No claim of data loss; productionunchanged. Fullsuitefailed4808pass1fail, rerunning after removal.

Confirmed NotificationBell/useNotifications 401 recovery defect: initialGET401, changedsessiontoken thenrerender keeps No notifications and doesnotload queuedvalidresponse. stopPollingRef settrueon401 neverreset onnewcredentials. Desiredrecoverydiagnostic failed anddeletedpercontract. No productionchange.

Confirmed TurtleEditor diagnostic gutter stale closure: mounteditorwithinitialemptydiagnostics, deliverlintworkerresults, clickline2glyph => no navigation callback. onMouseDown installedonMount closesoverinitialdiagnostics (495-504); changinghandleEditorDidMount propdoesnotrerunMonaco onMount. Diagnosticfailedanddeleted. Testing genuine alternateordering lintreadybeforeMonacomount separately. No productionchange.

2026-09-19: CONFIRMED HealthCheckPanel duplicate polling stale branch response. Real panel->qualityApi->HTTP deferred /quality/duplicates/jobs/job-1, switch branch while GET in flight, resolve200clusters for oldbranch; old clusterlabel Obsolete branch finding appears on newbranch. Diagnostic desired stale-result rejection failed and wasdeleted. Source HealthCheckPanel.tsx397checks pollCancelled onlybeforeawait;410-411setDuplicateClustersafterawait without branch/cancellation guard. Consistency analogoussource exists but diagnosticabsence assertion passedpossiblyloadingmask; no claim confirmed forconsistency. No productionchanges.

2026-09-19 worker supplementalcoverage: 100%lines/statements/functions,70/72branches97.22%; unhitdebugguards indexWorker.ts240 sampleIri false and246localName||empty fallback not reachable from validmessages. issueswithfalsysubject_iri filteredbefore unmatchedarray; nonemptysampleIRI slash/hash splitfallback producesnonempty localName. No artificial mutationofarray/Map to forceguards. LSP supplemental100%allmetrics afterinvalidprimitive documentation realRPCcase. Defaultcoverageexcludesbothmodules, so reportseparately ratherthaninflateoriginalscope.

2026-09-19 CONFIRMED version scripts include unrelated staged files: scripts/set-version.mjs and scripts/prepare-release.mjs git add onlypackagePath but invoke baregitcommit. In disposablefixture with unrelated.txt staged, bothcommitschangedpackage.json ANDunrelated.txt. Desiredexactfilecommitdiagnostics bothfailedandweredeleted. No productionfix, no realrepo script execution forvalidversions, no pushes/tags. Childconsole stdout/stderr not reliablycapturedinthisruntime; retainedCLItestsassert realexitcodes/packagecontent/githistory and forward anyreceivedstderr. Initialnpmfixturefailure double-loading/dev/null asbothglobal/user correctedusingdistinctemptyfixtureconfigfiles.

2026-09-19 confirmed useAutoSave concurrency: real hook -> persistent draftStore -> deferred actual Turtle writer. First draft flush pending; triggerSave persists Second draft; completing first flush writes First to source then unconditionally clearDraft(key), removing Second from persisted store. Diagnostic expected Second retained, received undefined; deleted failing diagnostic as requested. Edit ref still has Second, so proven loss is persisted unsaved draft, not assertion that all UI text disappears. useEntityAutoSave has same unconditional post-await clearDraft by inspection; not yet confirmed independently. Production unchanged.

2026-09-19 useEntityAutoSave concurrency now CONFIRMED for both property and individual via real hook/draftStore/extractors/deferred source writers. First payload captured before awaiting write; Second persists while pending; first completion writes First then deletes Second from draft store. Both diagnostic expected Second/received undefined; deleted diagnostic file. This strengthens prior inspection-only finding, production unchanged. Production detail panels also build draft payload before awaiting onUpdateProperty/onUpdateIndividual.

2026-09-19 coverage audit: OntologyGraph.tsx337 custom toolbar button labeled Fit view has an empty onClick handler; ReactFlow built-in Controls may provide a separate working fit action. Inspection finding only; did not add a test asserting this no-op as desirable. IndividualList108/109 expand/collapse callbacks are no-ops on leaf-only nodes. useCollaborationStatus final cleanup138/141 follows earlier disconnect cleanup that already clears timeout/socket refs. ProjectForm blank-name handler51/52 sits behind native required validation and a submit button disabled for !name.trim(); do not force private/UI-blocked calls for coverage.

2026-09-19 confirmed user-settings notice race: actual user settings page/commit-identity HTTP save at t0, second successful save at t2000, advance to t3000. First save's uncancelled setTimeout clears second save's Credit settings updated banner after only1000ms. Desirednewnoticefull3s diagnosticfailed(expectednotnull,receivednull) anddeleted. API updates/identitywerecorrect; findingonlyprematurefeedbackexpiry. Source app/settings/page.tsx65 schedulesindependenttimers withoutcancelingprevious. Similarsettingssuccesscallbacks byinspectionnotindependentlyconfirmed. Productionunchanged.

2026-09-19 inspection: editor/page.tsx handleReparentClass checks session.accessToken and throws Not authenticated before selecting handleAnonymousClassUpdate, so its anonymous-proposal save branch cannot execute with a genuinely anonymous session. Signed-in suggester path is reachable and now verified with actual keyboard drag/session/Turtle parser/Undo in both layouts. Anonymous positive reparent chain cannot be tested without production changes. No failed diagnostic was retained or production altered.

CONFIRMED 2026-09-19: turtleBlockParser.parseLiteral does not decode valid Turtle Unicode escapes. Real parseBlockTriples on ex:item ex:value "\u0041" returned literal value u0041 instead of A. Focused diagnostic failed1/skipped15, diagnostic deleted per tests-only contract. Default escape branch drops backslash and retains escape digits. No production change; correct Unicode escape decoding cannot be covered as passing behavior until fixed.

CONFIRMED final adversarial review: useCollaborationStatus stale close after active token change. Real React+unchanged hook in-memory reproduction: replacement connects with2 sockets; oldsocket delayed onclose sets status disconnected and queues1s reconnect; timercreates3rd socket and closeshealthyreplacement. isClosingRef reset bynew effect beforeoldclose arrives. Existing synchronous Socket.close testfixture hid ordering. Production fix forbidden; improvefixture lifecycle and retain onlypassing supportedcases, record unsupportedstale-event guarantee here. Review evidence /tmp/compound-engineering-1000/ce-code-review/coverage-final-20260919/adversarial.json.

FINAL VERIFIED: local7a378b86 on test/coverage-20260919; 356 files /4963 tests /0 failures /0 skipped,218.79sec. Added1518tests142modules. Defaultscope lines99.56 statements98.90 functions99.38 branches95.55. App/auth supplement lines95.81 statements93.22 functions93.03 branches87.95. Full lint0errors19existingwarnings; TypeScript/scopedlint/diffcheckpass. Completedce-code-review receipt coverage-final-20260919; onefixturefindingfixed andindependentfollowupresolved; productionstaleclosebug remains outofscope. No meaningful supported target identified byremainingline/caller/error/empty-state audit orfinalreview. No productionedits, network/install/publishing.

## Tests added by file

| Test module | Tests added |
|---|---:|
| __tests__/app/api-docs.integration.test.tsx | 3 |
| __tests__/app/auth-pages.integration.test.tsx | 21 |
| __tests__/app/docs-routes.integration.test.tsx | 13 |
| __tests__/app/editor-actions.integration.test.tsx | 121 |
| __tests__/app/editor-page.integration.test.tsx | 13 |
| __tests__/app/new-project.integration.test.tsx | 21 |
| __tests__/app/pr-party-route.integration.test.tsx | 5 |
| __tests__/app/pr-party-settings.integration.test.tsx | 17 |
| __tests__/app/project-analytics.integration.test.tsx | 9 |
| __tests__/app/project-dashboard.integration.test.tsx | 19 |
| __tests__/app/project-listing.integration.test.tsx | 13 |
| __tests__/app/project-settings-embeddings.integration.test.tsx | 13 |
| __tests__/app/project-settings-github.integration.test.tsx | 11 |
| __tests__/app/project-settings-index.integration.test.tsx | 9 |
| __tests__/app/project-settings-members.integration.test.tsx | 19 |
| __tests__/app/project-settings-normalization.integration.test.tsx | 23 |
| __tests__/app/project-settings-preferences.integration.test.tsx | 7 |
| __tests__/app/project-settings-remote.integration.test.tsx | 14 |
| __tests__/app/project-settings-webhooks.integration.test.tsx | 17 |
| __tests__/app/project-settings.integration.test.tsx | 15 |
| __tests__/app/project-viewer.integration.test.tsx | 21 |
| __tests__/app/providers.integration.test.tsx | 5 |
| __tests__/app/pull-request-routes.integration.test.tsx | 17 |
| __tests__/app/root-layout.integration.test.tsx | 8 |
| __tests__/app/sitemap-route.integration.test.ts | 9 |
| __tests__/app/static-routing.integration.test.ts | 4 |
| __tests__/app/suggestion-history.integration.test.tsx | 9 |
| __tests__/app/suggestion-review.integration.test.tsx | 27 |
| __tests__/app/translation-coverage.integration.test.tsx | 10 |
| __tests__/app/translation-review.integration.test.tsx | 10 |
| __tests__/app/user-settings.integration.test.tsx | 10 |
| __tests__/components/diff/DiffViewer.integration.test.tsx | 9 |
| __tests__/components/editor/AddEntityDialog.integration.test.tsx | 5 |
| __tests__/components/editor/BranchNavigator.test.tsx | 13 |
| __tests__/components/editor/ClassDetailPanel.branches.integration.test.tsx | 13 |
| __tests__/components/editor/ClassDetailPanel.coverage.test.tsx | 21 |
| __tests__/components/editor/CommitMessageDialog.integration.test.tsx | 7 |
| __tests__/components/editor/DeveloperEditorLayout.integration.test.tsx | 7 |
| __tests__/components/editor/EditorLayoutInteractions.integration.test.tsx | 7 |
| __tests__/components/editor/HealthCheckPanel.branches.integration.test.tsx | 19 |
| __tests__/components/editor/HealthCheckPanel.integration.test.tsx | 7 |
| __tests__/components/editor/IndividualDetailPanel.coverage.test.tsx | 16 |
| __tests__/components/editor/OntologySourceEditor.integration.test.tsx | 9 |
| __tests__/components/editor/ParentClassPicker.integration.test.tsx | 5 |
| __tests__/components/editor/PropertyDetailPanel.coverage.test.tsx | 18 |
| __tests__/components/editor/PropertyDetailPanel.suggestions.integration.test.tsx | 20 |
| __tests__/components/editor/ShareButton.integration.test.tsx | 6 |
| __tests__/components/editor/ShareButton.ssr.test.tsx | 2 |
| __tests__/components/editor/SimilarConceptsPanel.integration.test.tsx | 5 |
| __tests__/components/editor/ThemeToggle.integration.test.tsx | 1 |
| __tests__/components/editor/TrustExplainer.integration.test.tsx | 7 |
| __tests__/components/editor/TurtleEditor.coverage.test.tsx | 41 |
| __tests__/components/editor/shared/EntityTree.integration.test.tsx | 7 |
| __tests__/components/editor/standard/AnnotationEditor.integration.test.tsx | 3 |
| __tests__/components/editor/standard/EntitySearchCombobox.integration.test.tsx | 2 |
| __tests__/components/editor/standard/IndividualList.integration.test.tsx | 4 |
| __tests__/components/editor/standard/InlineAnnotationAdder.integration.test.tsx | 4 |
| __tests__/components/editor/standard/PropertyAssertionSection.integration.test.tsx | 4 |
| __tests__/components/editor/standard/PropertyTree.integration.test.tsx | 6 |
| __tests__/components/editor/standard/RelationshipSection.integration.test.tsx | 10 |
| __tests__/components/editor/standard/StandardEditorLayout.integration.test.tsx | 7 |
| __tests__/components/editor/suggestions/SuggestionCard.integration.test.tsx | 5 |
| __tests__/components/editor/suggestions/SuggestionControls.integration.test.tsx | 10 |
| __tests__/components/graph/OntologyGraph.integration.test.tsx | 4 |
| __tests__/components/layout/header.integration.test.tsx | 2 |
| __tests__/components/layout/notification-bell.integration.test.tsx | 17 |
| __tests__/components/pr-party/CardDetail.integration.test.tsx | 14 |
| __tests__/components/pr-party/PRPartyCard.integration.test.tsx | 18 |
| __tests__/components/pr-party/PRPartyQueueView.integration.test.tsx | 10 |
| __tests__/components/pr-party/QAThread.ssr.test.tsx | 2 |
| __tests__/components/pr/PRActions.integration.test.tsx | 3 |
| __tests__/components/pr/PRCommentThread.integration.test.tsx | 7 |
| __tests__/components/pr/PRDetail.integration.test.tsx | 12 |
| __tests__/components/pr/PRListItem.integration.test.tsx | 5 |
| __tests__/components/projects/BYOKeyPopover.test.tsx | 15 |
| __tests__/components/projects/DistinctEntityDecisionsSection.integration.test.tsx | 5 |
| __tests__/components/projects/LLMSettingsSection.coverage.test.tsx | 21 |
| __tests__/components/projects/LintConfigSection.integration.test.tsx | 14 |
| __tests__/components/projects/MemberTrustControl.integration.test.tsx | 11 |
| __tests__/components/projects/TranslationSettingsSection.integration.test.tsx | 15 |
| __tests__/components/projects/github-repo-picker.integration.test.tsx | 5 |
| __tests__/components/projects/member-list.integration.test.tsx | 11 |
| __tests__/components/projects/ontology-file-picker.integration.test.tsx | 14 |
| __tests__/components/projects/trust-ladder-section.integration.test.tsx | 5 |
| __tests__/components/projects/turtle-output-picker.integration.test.tsx | 6 |
| __tests__/components/projects/user-search-input.coverage.test.tsx | 13 |
| __tests__/components/revision/BranchSelector.coverage.test.tsx | 18 |
| __tests__/components/revision/GitGraph.integration.test.tsx | 7 |
| __tests__/components/revision/RevisionHistoryPanel.integration.test.tsx | 9 |
| __tests__/components/suggestions/CreditModal.integration.test.tsx | 3 |
| __tests__/components/ui/ScreenReaderAnnouncer.integration.test.tsx | 4 |
| __tests__/components/ui/confirm-dialog.test.tsx | 1 |
| __tests__/components/ui/context-menu.test.tsx | 1 |
| __tests__/components/ui/file-upload.integration.test.tsx | 9 |
| __tests__/components/ui/tooltip.test.tsx | 1 |
| __tests__/config/auth-session.integration.test.ts | 12 |
| __tests__/config/next-config-env.test.ts | 9 |
| __tests__/lib/api/client-errors.integration.test.ts | 18 |
| __tests__/lib/api/llm.coverage.test.ts | 14 |
| __tests__/lib/api/prParty.storage.integration.test.ts | 3 |
| __tests__/lib/collab/client.test.ts | 1 |
| __tests__/lib/context/BranchContext.integration.test.tsx | 6 |
| __tests__/lib/editor/generatedEntityPersistence.integration.test.ts | 10 |
| __tests__/lib/editor/indexWorker.integration.test.ts | 13 |
| __tests__/lib/editor/lsp-client.integration.test.ts | 21 |
| __tests__/lib/env.test.ts | 5 |
| __tests__/lib/graph/buildGraphData.integration.test.ts | 6 |
| __tests__/lib/hooks/useAnonymousSuggestion.integration.test.tsx | 12 |
| __tests__/lib/hooks/useAutoSave.integration.test.ts | 14 |
| __tests__/lib/hooks/useCollaborationStatus.integration.test.tsx | 10 |
| __tests__/lib/hooks/useEntityAutoSave.integration.test.ts | 8 |
| __tests__/lib/hooks/useFilteredTree.integration.test.ts | 6 |
| __tests__/lib/hooks/useGraphData.integration.test.ts | 11 |
| __tests__/lib/hooks/useGraphData.lifecycle.integration.test.ts | 8 |
| __tests__/lib/hooks/useKeyboardShortcuts.integration.test.tsx | 9 |
| __tests__/lib/hooks/useLLMConfig.integration.test.tsx | 7 |
| __tests__/lib/hooks/useLLMGate.integration.test.tsx | 5 |
| __tests__/lib/hooks/useLLMUsage.test.tsx | 7 |
| __tests__/lib/hooks/useMemberTrust.test.tsx | 7 |
| __tests__/lib/hooks/useOntologyTree.integration.test.tsx | 15 |
| __tests__/lib/hooks/usePRPartyQueue.integration.test.tsx | 13 |
| __tests__/lib/hooks/useProjectViewer.integration.test.tsx | 6 |
| __tests__/lib/hooks/useRemoteSync.integration.test.tsx | 10 |
| __tests__/lib/hooks/useSourceRevisionGuard.integration.test.tsx | 14 |
| __tests__/lib/hooks/useSuggestionSession.integration.test.tsx | 12 |
| __tests__/lib/hooks/useSuggestions.integration.test.ts | 18 |
| __tests__/lib/hooks/useTranslationCoverage.integration.test.tsx | 9 |
| __tests__/lib/hooks/useTranslationState.integration.test.ts | 11 |
| __tests__/lib/hooks/useTreeDragDrop.integration.test.tsx | 14 |
| __tests__/lib/ontology/turtleBlockParser.integration.test.ts | 15 |
| __tests__/lib/ontology/turtleClassUpdater.test.ts | 2 |
| __tests__/lib/ontology/turtleIndividualUpdater.integration.test.ts | 4 |
| __tests__/lib/ontology/turtlePropertyUpdater.integration.test.ts | 5 |
| __tests__/lib/ontology/turtleUtils.integration.test.ts | 10 |
| __tests__/lib/prPartyLinks.integration.test.ts | 10 |
| __tests__/lib/stores/anonymousCreditStore.ssr.test.ts | 1 |
| __tests__/lib/stores/anonymousCreditStore.storage.test.ts | 2 |
| __tests__/lib/stores/anonymousCreditStore.test.ts | 4 |
| __tests__/lib/stores/editorModeStore.integration.test.tsx | 5 |
| __tests__/lib/stores/suggestionStore.integration.test.tsx | 8 |
| __tests__/scripts/generate-sitemap.integration.test.ts | 3 |
| __tests__/scripts/version-scripts.integration.test.ts | 10 |
