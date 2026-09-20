# Recovered requirements and proposed build order

Date: 2026-09-20. Baseline: `fix/coverage-defects-20260919` at `16d16747`.

Ongoing execution status and next action: [requirements delivery roadmap](../plans/2026-09-20-0649-requirements-delivery-roadmap.md). The user chose to proceed through the areas serially on 2026-09-20; this catalog remains the scope/provenance reference.

This is a requirements inventory and prioritization proposal, prepared through ce-brainstorm research. It does not approve every historical idea or constitute one implementation-ready plan. Each selected area should become a bounded CE plan; the GSD harness need not be revived.

## Recommendation

Finish delivery and real integration proof, then complete ontology suggestion batching/review, then the entity workspace, then the ecosystem import loop. Work on local testing and feature planning can proceed while deployment or external coordination waits. Treat the first two areas as parallel tracks rather than letting an approval delay stall all development.

The ordering favors data integrity, completion of the existing contributor-to-reviewed-ontology workflow, and work that unlocks other requirements. Product scope and dependency determine the sequence; age of the document does not. No effort estimates are asserted without implementation planning.

| Order | Area | Why this position | First useful outcome |
|---|---|---|---|
| 1 | Deliver and validate the work already built | Recent repairs and much older feature work still have separate integration, deployment, or acceptance obligations | A known frontend/backend pair demonstrably saves, reviews, and publishes correctly |
| 2 | Real full-stack regression coverage | Extensive mocked coverage has repeatedly missed real integration failures | Repeatable authenticated edit → submit → review → merge proof |
| 3 | Ontology session batching and intelligent review | Largest clearly recovered unfinished workflow; prevents reviewer overload | Coherent, editable batches and evidence-rich review |
| 4 | Entity-scoped Detail / Graph / Source workspace | A substantial, already-designed GSD feature is missing from the current product | One consistent workspace for classes, properties, and individuals |
| 5 | Ecosystem suggestion import loop | Highest strategic expansion, but depends on trustworthy write-back and review | A human-confirmed mapping from one feeder becomes a reviewed ontology change |
| 6 | Contributor onboarding, standing, and identity | Makes contribution easier and rewards repeat contributors | Clear trust progress and verified attribution |
| 7 | LLM controls and curation efficiency | Builds on an existing generation/dedup system rather than replacing it | Better cost visibility and controllable generation |
| 8 | Translation maintenance | Existing translation generation/review already exists; stale translations are the next lifecycle problem | Source edits can lead to deliberate, traceable retranslation |
| 9 | Semantic validation and reference extraction | Valuable specialist features, but earlier tool choices were superseded | Useful restrictions/validation or sourced definitions on real ontologies |
| 10 | Hosting, discovery, and federation expansion | Some pieces are activation work; broader federation is still a product direction | Instance discovery, then one bounded cross-instance workflow |
| 11 | Large-ontology storage and scaling | High migration cost and contradictory proposals; measure first | Evidence-backed scale decision preserving RDF/OWL fidelity |
| 12 | Graph/review polish and maintenance | Keep the ideas visible without putting cosmetic or speculative work ahead of the workflow | Small improvements selected from actual usage |

## Evidence and status rules

The [source index](2026-09-20-requirements-source-index.md) records **231 document paths and 284 distinct path/content versions**, including **142 GSD paths**, **27 plan paths under `docs/plans/`**, branch-only documents, and seven deleted historical handoffs. The two root atomization documents duplicate the corresponding plans. Source IDs below resolve to immutable Git blobs in that index; `git show <blob>` reads them without switching branches.

Review covered requirement lists, discussions, specifications/sketches, plans, summaries, verification/validation records, CE outlines, decision sheets, residual reviews, delivery records, and superseding handoffs. Current frontend code was checked for the principal missing/present claims, with an independent verification pass. Older backend and operational claims are attributed to their records unless explicitly supported by current source inspection. No live deployment, GitHub issue status, domain ownership, paid-provider result, or external package availability was verified in this audit. Cached remote refs are not live GitHub evidence.

Statuses:

- **Build**: intended behavior is missing from the current frontend or the source explicitly retains it as unfinished. Backend work still needs its own baseline check.
- **Recover**: historical implementation/design exists elsewhere; reconcile and reuse it before writing replacements.
- **Activate / prove**: code is recorded as implemented; remaining work is deployment, configuration, integration, or acceptance.
- **Partial**: some of the requirement exists; only the stated remainder belongs in the backlog.
- **Reconcile**: conflicting requirements or later decisions prevent calling the old proposal an approved build.
- **Candidate**: explicitly deferred idea, not a current commitment.
- **Verify**: historical finding whose present applicability needs confirmation before fixing anything.

“Recorded complete” does not mean deployed today. “Missing here” does not mean never implemented on any branch.

## 1. Deliver and validate existing work

| ID | Remaining outcome | Status and dependencies | Source |
|---|---|---|---|
| B01 | Integrate the September coverage-driven production repairs and their tests into the intended delivery branch, then ship the reviewed pair | **Activate / prove.** Current repair handoff explicitly says local-only, not pushed, merged, or deployed. Include a fresh production build and live boundary validation where required | Current `docs/handoffs/2026-09-19-production-fix-results.md`; [S0126](2026-09-20-requirements-source-index.md#s0126) |
| B02 | Complete the matched API/web DEV deployment and record running revisions, migration state, health, seeded project, write smoke, and rollback evidence | **Activate / prove.** Latest local handoff reports a parked deploy approval. Recheck its actual status; do not repeat the already-recorded database reset or ruleset setup | March U9, [S0181](2026-09-20-requirements-source-index.md#s0181); [S0283](2026-09-20-requirements-source-index.md#s0283); current Sep18 pickup handoff |
| B03 | Finish authenticated persona UAT, including trust promotion, translation/audit, autosave, permissions, and the real submission/merge chain | **Activate / prove**, after B02. Observe N-day auto-accept, objection halt, resolved-objection restart, and exclusion of anonymous/untrusted/LLM suggestions. The recorded one-day floor requires more than a single sitting | March U10; [S0190](2026-09-20-requirements-source-index.md#s0190); [S0177](2026-09-20-requirements-source-index.md#s0177) |
| B04 | Activate the two isolated demo repositories, scoped source/destination credentials, atomic refresh, cleanup and rollback | **Activate / prove**, after B02 and the recorded provisioning conditions. Current demo UI and refresh design should be reused | March U12; [S0170](2026-09-20-requirements-source-index.md#s0170) D3/D7; [S0222](2026-09-20-requirements-source-index.md#s0222) T10 |
| B05 | Close retired-demo redirect and retention acceptance | **Activate / prove.** Code recorded merged; still owe the authenticated redirect/browser receipt and DEV retention receipt. Preserve sub-route/allowed navigation and prove restart-safe cleanup | [S0226](2026-09-20-requirements-source-index.md#s0226); current Sep18 pickup handoff |
| B06 | Execute the reviewer-credential encryption rewrap in its approved operator window | **Activate / prove**, after B02. This re-encrypts existing credentials; it does not rotate GitHub PATs | March U13; [S0199](2026-09-20-requirements-source-index.md#s0199); [S0170](2026-09-20-requirements-source-index.md#s0170) D5 |
| B07 | Complete PR Party external activation and its credentialed, degraded, and Q&A end-to-end flows | **Activate / prove**, after demo readiness and external setup. Includes organization answerer integrity, webhook/sweep, credential intake, notifications, reconciliation and cleanup | March U18; [S0199](2026-09-20-requirements-source-index.md#s0199); [S0156](2026-09-20-requirements-source-index.md#s0156) U14 |
| B08 | Finish CatholicOS delivery of the remaining feature tranches and documentation | **Activate / prove.** T1 was already sent on Sep7; do not recreate it. Refresh T2–T10 against current upstream, reconcile scope, and carry B01 fixes into their owning tranches. Live PR/merge status is unverified | [S0222](2026-09-20-requirements-source-index.md#s0222) publication journal; [S0283](2026-09-20-requirements-source-index.md#s0283) U11 |
| B09 | Complete the parallel FOLIO PROD rehearsal, UAT, reversible cutover, and gated promotion proof | **Activate / prove**, after DEV acceptance and AWS access. Parallel stand-up was selected; an in-place rebuild is not the default | March U17; [S0170](2026-09-20-requirements-source-index.md#s0170) D1; [S0180](2026-09-20-requirements-source-index.md#s0180) U10 |

## 2. Full-stack proof and integrity

| ID | Remaining outcome | Status and dependencies | Source |
|---|---|---|---|
| B10 | Establish repeatable full-stack API and browser tests with isolated projects, real backend state, setup and cleanup | **Build.** Current package scripts contain Vitest, not the proposed Playwright suite. Cover project/ontology/branch/PR/search/lint/error contracts | [S0127](2026-09-20-requirements-source-index.md#s0127) |
| B11 | Prove real OIDC login, logout, credential renewal, session expiry, anonymous/optional/required modes, Monaco editing, and save/submit/review/merge | **Build**, on B10. Keep live acceptance B03 distinct from automated regression coverage | [S0127](2026-09-20-requirements-source-index.md#s0127); current production-fix validation limits |
| B12 | Prove WebSocket authentication, presence, acknowledgments, sync, reconnect after server restart, multi-client behavior, and index notifications | **Build**, on B10. Testing existing collaboration is not a new commitment to unrestricted real-time collaborative editing | [S0127](2026-09-20-requirements-source-index.md#s0127) |
| B13 | Add browser CI, reproducible seed/cleanup, Chromium/Firefox coverage, failure traces, and frontend/backend response-contract checks | **Build**, on B10. July PR Party response-type drift and real-Postgres constraints/cascades/migration tests belong in this effort after checking later backend coverage | [S0127](2026-09-20-requirements-source-index.md#s0127); [S0157](2026-09-20-requirements-source-index.md#s0157) A8/B4/B5/B18 |
| B14 | Reconcile known correctness/policy seams before declaring the workflow complete | **Verify / reconcile.** Auth-disabled capability routing; configured-provider Docker builds; namespace ownership; editor review/self-merge authority; entity-kind mint gates; submit-time budget/unavailability errors; production Compose required secrets; installed deploy-script drift | Current parity ledger F1/F2; [S0174](2026-09-20-requirements-source-index.md#s0174) known follow-ups; [S0225](2026-09-20-requirements-source-index.md#s0225) follow-ups; ROLE-02 / VALID-04 |
| B15 | Close demonstrated Turtle representational limits without losing existing source semantics | **Reconcile / build.** Multiple subjects on one line remain a stated writer limit. Imported/undeclared predicates need a deliberate data-property-versus-annotation contract. Do not undo the September round-trip repairs | Current production-fix handoff, “Intentional behavior…validation limits” |

## 3. Ontology batching and reviewer intelligence

This is ontology-contribution review. PR Party reviews software GitHub PRs; its existence does not satisfy these requirements.

| ID | Remaining outcome | Status and dependencies | Source |
|---|---|---|---|
| B16 | Organize session changes into ancestor-based shards, max 50/min 3, with miscellaneous and cross-cutting groups and exactly-one-shard membership | **Recover + build.** CLUSTER-02/04 remain explicitly unchecked; broader clustering is also absent from the current frontend. Validate the backend rather than trusting old mocked completion | CLUSTER-01–05; [S0100](2026-09-20-requirements-source-index.md#s0100); [S0217](2026-09-20-requirements-source-index.md#s0217) |
| B17 | Let contributors preview and merge/split/rename/move shard contents with accessible alternatives to dragging | **Recover**, on B16. Preserve small-session behavior and validate empty/oversized shards | CLUSTER-06; phase15 context; [S0217](2026-09-20-requirements-source-index.md#s0217) |
| B18 | Turn shards into coherent commits and bounded PR groups with progress, partial-success reporting, safe retry and cleanup | **Recover + build**, on B16–17 and B10. Reuse the real session/PR write path; resolve contributor versus reviewer submission permissions against current trust policy | CLUSTER-07–09; [S0217](2026-09-20-requirements-source-index.md#s0217) |
| B19 | Show per-change human/AI/edited-AI provenance and confidence, scored duplicate candidates, and side-by-side comparisons during ontology review | **Recover + build.** Submitter audit identity and minted-entity PROV-O already exist; they do not provide this review experience. Can ship before shard grouping | REVIEW-02–04; [S0110](2026-09-20-requirements-source-index.md#s0110); [S0217](2026-09-20-requirements-source-index.md#s0217) |
| B20 | Filter review by shard and retain approve/reject/feedback marks without confusing advisory marks with the final PR decision | **Recover + build**, after B16. Include notifications and preservation across navigation | [S0110](2026-09-20-requirements-source-index.md#s0110); [S0217](2026-09-20-requirements-source-index.md#s0217) |
| B21 | Generate a clean PR from approved shards only | **Candidate**, after B20. Explicit historical stretch goal; decide coexistence with batch submission and treatment of the original PR | [S0217](2026-09-20-requirements-source-index.md#s0217) clean-pr; [S0110](2026-09-20-requirements-source-index.md#s0110) |
| B22 | Resume organized batches across days/sessions | **Candidate / partial.** Existing suggestion-session resume is not evidence that a user's shard arrangement persists | CLUSTER-10 |
| B23 | Request changes with comments attached to individual ontology suggestions | **Candidate**, after B19. Distinct from whole-session request-changes and software PR Party's line comments | REVIEW-06 |

## 4. Entity workspace and graph

| ID | Remaining outcome | Status and dependencies | Source |
|---|---|---|---|
| B24 | Reconcile and integrate the historical server-backed entity graph port | **Recover.** Current class graph works and has recent fixes, but uses client-side neighbor fetching. Compare the older graph branch with current behavior before replacing it; retain its visual acceptance and upstream-delivery obligations | [S0006](2026-09-20-requirements-source-index.md#s0006); [S0212](2026-09-20-requirements-source-index.md#s0212); current `lib/hooks/useGraphData.ts` |
| B25 | Put Detail/Graph in the standard detail pane and Detail/Graph/Source in the developer pane; preserve active tab across selections and start on Detail | **Recover / build**, after the graph foundation decision. Phase17's locked design and selected sketches are branch-only; current layouts still use the older graph toggle/left source arrangement | [S0141](2026-09-20-requirements-source-index.md#s0141); [S0133](2026-09-20-requirements-source-index.md#s0133); [S0137](2026-09-20-requirements-source-index.md#s0137); [S0214](2026-09-20-requirements-source-index.md#s0214) |
| B26 | Show meaningful property and individual neighborhoods, including domain/range/parent properties, types/object assertions/sameAs/seeAlso, and the annotation-property empty state | **Build / recover**, coordinated with API support and B24–25. Preserve single-click recenter versus double-click selection behavior | [S0141](2026-09-20-requirements-source-index.md#s0141) requirements; [S0137](2026-09-20-requirements-source-index.md#s0137) |
| B27 | Provide entity-scoped Turtle snippets with copy and line context, plus full-source modal/maximize/restore with selection-synchronized scrolling | **Build / recover**, alongside B25. Preserve editing, save/lint, and source navigation semantics | [S0141](2026-09-20-requirements-source-index.md#s0141); [S0133](2026-09-20-requirements-source-index.md#s0133) decisions 9–11 |

## 5. Ecosystem suggestion import loop

The July draft contains recorded user decisions, but is still a draft implementation contract. Its invariant is human-approved ontology write-back, including for high-trust feeders. My sequencing recommendation is one small, human-confirmed mapping pilot before high-volume raw suggestions; the source separately proposes Enrich as the first volume feeder.

| ID | Remaining outcome | Status and dependencies | Source |
|---|---|---|---|
| B28 | Establish the shared, versioned suggestion envelope: typed changes, target/project, producer, evidence, provenance, confidence kind and stable identity | **Build**, coordinate across repos. Keep imported atomic suggestions distinct from human editing sessions | [S0230](2026-09-20-requirements-source-index.md#s0230) §3 |
| B29 | Accept batches with scoped service credentials, dry run, per-item results, safe replay, rate limits, and isolated malformed items | **Build**, on B28. Backend baseline needs verification; no current frontend import client was found | [S0230](2026-09-20-requirements-source-index.md#s0230) §4 |
| B30 | Deduplicate against the ontology, current queue, and same batch; retain corroborating evidence | **Build.** Recorded policy: automatic merge only for qualified deterministic exact-label matches; embedding near-matches always require human judgment | [S0230](2026-09-20-requirements-source-index.md#s0230) §4 / §7.3 |
| B31 | Provide source/type/branch/trust/dedup/steward filtering, evidence, provenance and corroboration in the import review queue | **Build**, on B29. One steward owns each decision; batches can be assigned manually or round-robin | [S0230](2026-09-20-requirements-source-index.md#s0230) §6 / §7.3 |
| B32 | Materialize approved imports through the existing ontology-change/PR workflow and release the result back to consumers | **Build / prove**, on B29–31 and B03/B10. Never bypass the human gate; destructive types require the recorded higher-trust permission | [S0230](2026-09-20-requirements-source-index.md#s0230) §6–8 |
| B33 | Supply the producer client and prove one feeder end to end | **Build.** Python first; TypeScript when a producer needs it. Confirmed mapper standards mappings are the source's lowest-risk production pilot; Enrich supplies the first high-volume gap stream | [S0230](2026-09-20-requirements-source-index.md#s0230) §5 / §8 |
| B34 | Add Enrich unmapped spans, Intake gaps, Mapper unmatched nodes, Insights coverage gaps, and Generative-FOLIO/hydration batches | **Candidate**, stagger after B33. Include embedding-space parity, backpressure, and per-project credentials rather than enabling all producers at once | [S0230](2026-09-20-requirements-source-index.md#s0230) §1.3 / §8 |

## 6. Contributor onboarding and identity

| ID | Remaining outcome | Status and dependencies | Source |
|---|---|---|---|
| B35 | Enable and prove Google sign-in through Zitadel, including same-email account linking and continued password login | **Activate / build provisioning.** Parked on final domains and private OAuth provisioning, not a new auth-provider migration. GitHub federation was also named in the trust plan; check whether configured before treating it as missing | [S0179](2026-09-20-requirements-source-index.md#s0179) R1–4; [S0170](2026-09-20-requirements-source-index.md#s0170) updated activation condition; [S0154](2026-09-20-requirements-source-index.md#s0154) R2 |
| B36 | Show contributors their acceptance history and progress toward trust; offer appropriate public contribution credit | **Candidate / partial.** Admin accepted-count controls already exist. Contributor standing and public credit pages were explicitly deferred | [S0154](2026-09-20-requirements-source-index.md#s0154) deferred follow-ons |
| B37 | Complete verification of the optional commit-attribution email | **Build.** Current UI can read verified state and opt into an already-verified address; that does not supply the verification round trip | [S0154](2026-09-20-requirements-source-index.md#s0154) deferred email verification; `components/settings/CommitIdentityCard.tsx` |
| B38 | Ingest GitHub-side ontology contributions as attributed, trust-gated OntoKit suggestions | **Candidate**, after trusted write-back. Preserve outbound-mirror ownership; this is not authorization to merge external edits directly into canonical history | [S0154](2026-09-20-requirements-source-index.md#s0154) deferred GitHub-side contributions |

## 7. LLM controls and curation efficiency

| ID | Remaining outcome | Status and dependencies | Source |
|---|---|---|---|
| B39 | Alert project owners at 50%, 75%, and 90% of monthly budget | **Candidate.** Existing usage/burn-rate display and exhaustion gating do not establish threshold notifications; check backend notification support | COST-08 |
| B40 | Let users choose the embedding model, not only the provider's hardcoded default | **Partial.** API type carries `model_name`; current settings save `MODEL_DEFAULTS[provider]`. Include dimension/rebuild implications in planning | LLM-08; `app/projects/[id]/settings/page.tsx:3274` |
| B41 | Offer a quality/cheap choice for an individual suggestion request | **Reconcile / partial.** Project model/tier configuration exists, but the generation request has no per-call tier override. Confirm later explicit-model decisions did not intentionally retire LLM-04 | LLM-04; [S0034](2026-09-20-requirements-source-index.md#s0034) D03; current generation API |
| B42 | Support multi-branch iterator selection | **Candidate**, extending existing inline/iterator navigation | UX-07 |
| B43 | Allow project-specific prompt templates | **Candidate**, preserving validation/provenance/budget gates | TOOL-06 |
| B44 | Suggest missing intermediate parents and deliberate split/merge/reorganization of existing classes | **Candidate**, after reviewer evidence and change safety. Separate additive intermediate-parent work from destructive restructuring | GEN-10/11 |
| B45 | Add usage charts and an admin price-table surface if operational use warrants them | **Candidate**, not a missing core budget dashboard | [S0034](2026-09-20-requirements-source-index.md#s0034); phase11 UI specification |
| B46 | Measure the original throughput/acceptance/duplicate outcomes with real SMEs and provider evaluations | **Activate / prove.** Targets were 50+ annotations/hour, at least 70% admin acceptance, and zero duplicates in the first month. No current outcome receipt was established | [S0001](2026-09-20-requirements-source-index.md#s0001); GSD milestone acceptance records; [S0213](2026-09-20-requirements-source-index.md#s0213) human UAT |

## 8. Translation maintenance

| ID | Remaining outcome | Status and dependencies | Source |
|---|---|---|---|
| B47 | Retranslate after a source label changes, with stale/provisional state and provenance handled deliberately | **Candidate.** Current documented behavior orphans translations and lets coverage/backfill refill them; automatic retranslation was deferred | [S0176](2026-09-20-requirements-source-index.md#s0176) scope boundaries |
| B48 | Add capped continuous gap-filling and targeted replacement of older machine translations where needed | **Candidate / verify partial.** Admin-triggered backfill, cost preview, coverage, and provenance already exist; verify existing filter support before adding it | [S0176](2026-09-20-requirements-source-index.md#s0176) R9/R12 and deferred background work |
| B49 | Revisit default long-form translation only if its value justifies cost and graph growth | **Candidate / policy change.** Definitions/examples already support on-demand translation and admin field configuration; “automatically translate everything” is not an unfinished default requirement | [S0176](2026-09-20-requirements-source-index.md#s0176) KD2/R3 |

## 9. Semantic validation and reference extraction

| ID | Remaining outcome | Status and dependencies | Source |
|---|---|---|---|
| B50 | Extract sourced definitions/glosses from reference texts | **Build / reconcile dependency.** TOOL-02 was called satisfied by a `NotImplementedError` stub. That is not the user capability. Re-evaluate the integration on current available tooling | TOOL-02; [S0054](2026-09-20-requirements-source-index.md#s0054) |
| B51 | Display OWL restrictions as readable, navigable statements | **Candidate.** Restriction display can be scoped separately from a full reasoner or storage rewrite | [S0130](2026-09-20-requirements-source-index.md#s0130) phase5A |
| B52 | Run formal semantic reasoning with progress/history and useful inconsistency, unsatisfiability and inferred-relationship findings | **Reconcile**, not “implement old owlready2 plan.” The later tooling verdict and Sep6 record remove owlready2. Structural validation already exists | TOOL-03/04; [S0130](2026-09-20-requirements-source-index.md#s0130) phases1–3; [S0208](2026-09-20-requirements-source-index.md#s0208); [S0174](2026-09-20-requirements-source-index.md#s0174) U3 |
| B53 | Show before/after inference differences and optional closed-world checks | **Candidate**, after B52's product/tool decision | [S0130](2026-09-20-requirements-source-index.md#s0130) phases5B/6 |
| B54 | Edit/store SHACL shapes and validate asserted or inferred data with navigable violations | **Candidate.** Raw validation can be scoped without full OWL reasoning | [S0130](2026-09-20-requirements-source-index.md#s0130) phase7 |
| B55 | Manage and execute SWRL rules | **Candidate**, after a fresh need/tool decision; no current dedicated SWRL UI was found | [S0130](2026-09-20-requirements-source-index.md#s0130) phase4 |

## 10. Hosting, discovery and federation

| ID | Remaining outcome | Status and dependencies | Source |
|---|---|---|---|
| B56 | Build/activate the `ontokit.org` instance picker with direct instance URLs, TLS and accessible mobile navigation | **Build / activate.** Registration was selected; ownership and final destinations need fresh verification. Do not re-treat the historical RDAP result as current | March U16; [S0170](2026-09-20-requirements-source-index.md#s0170) D6 |
| B57 | Finish any separate Catholic DEV environment still required by the final topology | **Verify / candidate.** Older Hetzner/FOLIO/Catholic allocations were repeatedly superseded; map actual deployments before provisioning | [S0192](2026-09-20-requirements-source-index.md#s0192) final topology; [S0175](2026-09-20-requirements-source-index.md#s0175) deferred work |
| B58 | Develop hosted multi-tenant use, cross-project references, and repo-change federation/heartbeat | **Candidate.** A recorded product direction, not a complete build contract. Start with one cross-instance use case | [S0192](2026-09-20-requirements-source-index.md#s0192) hosting/federation; [S0175](2026-09-20-requirements-source-index.md#s0175) deferrals; [S0230](2026-09-20-requirements-source-index.md#s0230) per-project import scope |

## 11. Large-ontology scaling and storage

| ID | Remaining outcome | Status and dependencies | Source |
|---|---|---|---|
| B59 | Benchmark real 50K+ ontologies: tree/search/detail, load/save/export, diff/merge and index/rebuild behavior | **Reconcile / measure first.** PostgreSQL indexing already exists; the original “everything parses Turtle” premise is stale | [S0129](2026-09-20-requirements-source-index.md#s0129); [S0128](2026-09-20-requirements-source-index.md#s0128); [S0215](2026-09-20-requirements-source-index.md#s0215) |
| B60 | Decide and implement a storage approach only against demonstrated bottlenecks | **Reconcile.** Competing proposals: per-entity JSON, modular Turtle plus PostgreSQL, per-entity Turtle/TriG or entity-tagged history. Preserve complex OWL, cross-entity axioms and ecosystem interoperability | [S0129](2026-09-20-requirements-source-index.md#s0129); [S0128](2026-09-20-requirements-source-index.md#s0128) |
| B61 | If storage changes, provide lossless conversion, deterministic export, consistent derived indexes, rollback and performance monitoring | **Conditional**, after B60. The original big-bang migration conflicts with the critical analysis's incremental rollout recommendation | [S0129](2026-09-20-requirements-source-index.md#s0129) phases1–8; [S0128](2026-09-20-requirements-source-index.md#s0128) recommendations |
| B62 | Consider advanced class-expression editing and entity-level history/diffs | **Candidate / conditional.** These are useful product outcomes buried in the JSON plan; they need not require accepting that entire storage architecture | [S0129](2026-09-20-requirements-source-index.md#s0129) phase6; [S0128](2026-09-20-requirements-source-index.md#s0128) §7.4 |

## 12. Deferred polish and maintenance

| ID | Remaining outcome | Status and dependencies | Source |
|---|---|---|---|
| B63 | Graph edge-type filters and search within the displayed graph | **Candidate**, after B24–26 | [S0005](2026-09-20-requirements-source-index.md#s0005) deferred ideas |
| B64 | SVG/PNG graph export | **Candidate**, consolidated across graph-port and phase17 deferrals | [S0005](2026-09-20-requirements-source-index.md#s0005); [S0138](2026-09-20-requirements-source-index.md#s0138) |
| B65 | Per-project branch colors and animated relationship traversal | **Candidate** | [S0005](2026-09-20-requirements-source-index.md#s0005) |
| B66 | User/project default pane tab and shareable active-tab URLs | **Candidate**, after B25. Existing entity deep links do not cover tab preference | [S0138](2026-09-20-requirements-source-index.md#s0138) deferred ideas |
| B67 | Configurable generalized graph depth/per-predicate caps and graph drag-to-reparent | **Candidate**, separate behaviors. Current class graph already has depth/node limits and tree reparenting; preserve those | [S0138](2026-09-20-requirements-source-index.md#s0138); [S0137](2026-09-20-requirements-source-index.md#s0137) D07 |
| B68 | Full-source-to-tree navigation refinements and modal visual refresh | **Candidate**, only if B27 UAT demonstrates need. Existing Ctrl+click IRI navigation should be retained | [S0137](2026-09-20-requirements-source-index.md#s0137) scope boundaries; [S0138](2026-09-20-requirements-source-index.md#s0138) |
| B69 | Software PR Party line-anchored comments and J/K/verdict shortcuts | **Candidate**, after B07; distinct from ontology suggestion comments B23 | [S0156](2026-09-20-requirements-source-index.md#s0156) deferred follow-ons |
| B70 | Cockpit pointer to the canonical PR Party queue; optional email notifications and wider reviewer availability | **Candidate / verify external.** The pointer belongs to the Cockpit repo. Email is an older deferral; broad multi-tenant PR Party was explicitly outside initial scope | [S0156](2026-09-20-requirements-source-index.md#s0156) KD20/deferrals; [S0155](2026-09-20-requirements-source-index.md#s0155) |
| B71 | Demo-generation rollback UX, sitemap refresh, run-level retention metrics/dashboard, long-age failed-row cleanup, and handling generation-specific links | **Candidate**, after B04–05. Retention already preserves content for rollback but does not implement rollback. Never blindly carry stale session/PR IDs across generations | [S0226](2026-09-20-requirements-source-index.md#s0226) boundaries/deferrals |
| B72 | Remove obsolete contributor PAT storage only when no environment still depends on it | **Verify / conditional.** Do not confuse retired contributor-mirror PATs with intentional PR Party reviewer credentials | [S0154](2026-09-20-requirements-source-index.md#s0154) final follow-ons |
| B73 | Refresh the persistent requirements/status index and integrate branch-only documentation | **Build documentation.** Keep original IDs, supersession links and branch evidence; retire stale dashboard status without rewriting historical decisions. Close the retired-demo paper-trail PR if still open | [S0001](2026-09-20-requirements-source-index.md#s0001)/2/4; current pickup handoff |
| B74 | Safely reconcile stale local branches/stashes and remaining upstream delivery housekeeping | **Verify.** Old branch names, ahead/behind counts and cleanup recipes are dated; preserve work and re-evaluate before any deletion/reset | [S0216](2026-09-20-requirements-source-index.md#s0216); current pickup handoff |
| B75 | Select remaining backend maintenance from confirmed findings, not old severity lists | **Verify.** PR Party module/read-model separation, Redis-pool recovery, DDL/model drift, webhook-to-row tests and conditional multi-replica/index concerns. Also reconcile the older LLM review's anonymous limiter, type-scoped dedup, dangling references, decoding, provider delays and dead-code items against later fixes | [S0157](2026-09-20-requirements-source-index.md#s0157) B1/B2/B5/B7/B8/B10/B11/B18; [S0159](2026-09-20-requirements-source-index.md#s0159); [S0222](2026-09-20-requirements-source-index.md#s0222) T3 |

## Completed, superseded, or intentionally excluded

These dispositions are as important as the backlog: copying old unchecked boxes would manufacture work.

| Historical item | Disposition |
|---|---|
| Next.js 15→16 / Tailwind 3→4 | Current `package.json` already uses Next16 and Tailwind4. Old milestone follow-ups are stale. |
| Optional auth, anonymous proposals/credit, basic inline/property LLM suggestions, project LLM configuration, budgets and usage | Current surfaces exist; preserve and verify rather than reimplement. Historical full milestone completion is still too broad. |
| Phase15/16 “complete” | Historical branch claims, not current integrated delivery. July shard design explicitly records the missing backend contracts; current frontend lacks the shard workflow. B16–23 recover the actual gap. |
| Phase17 | Detailed locked design exists on other refs, but lacks current integrated implementation. B24–27 retain all eleven design requirements, not just “move Graph.” |
| OpenGloss TOOL-02 “satisfied” | A stub was accepted by phase verification. Product functionality remains B50. |
| Generative-FOLIO as an installable runtime library; folio-api as runtime dependency | Later tooling verdict makes Generative-FOLIO reference-only and rejects folio-api for the current use case. Do not revive TOOL-05 literally. Using a producer as an ecosystem feeder is a separate proposal. |
| owlready2 integration architecture | Superseded by recorded removal. B51–55 preserve the user outcomes as candidates requiring fresh decisions. |
| folio-python release/pin blocker | Sep6 record says 0.4.0 adopted, owlready2 removed, scan/install/regressions passed. Do not repeat the older PyPI-release wait. |
| Browser-direct BYOK / persistent localStorage | Later implementation deliberately uses an ephemeral backend header and account-bound sessionStorage. Preserve the newer contract. |
| Core autosave preference, submission audit snapshots, translation verification/backfill/coverage, trust ladder and quiet-period setting | Recorded integrated and visible current surfaces. B03 is outstanding operational proof; B36/B47–49 are genuine follow-ons. |
| Dedicated “Synonyms” editor | Current generic annotation rows and adder support altLabel edits. A more prominent dedicated editor is optional UX, not total absence of editing. |
| Whole-document conflict guards, distinct-entity decisions, GitHub sync retry/status | Later completion/delivery records and current clients already cover these. Verify live behavior; do not rebuild from older findings. |
| September production bug findings U1–U12 | Recorded fixed and locally verified: 362 files / 5,148 tests passed. This audit did not rerun those tests. Remaining delivery is B01; explicit parser limits are B15. |
| PR Party hook invalidation gap | Current `__tests__/lib/hooks/usePRPartyQueue.integration.test.tsx` covers mutation invalidation; July B18's frontend assertion is stale. |
| Paid-call reservation, provider-network pinning, crypto/limiter repair and atomic embedding snapshots | Later T3 records report repairs. Do not refile the August review wholesale. Remaining backend findings need current-source reconciliation under B75. |
| Missing Redis/background worker | Old INFRA-04/05 describe infrastructure that later DEV/deploy and embedding-job records already contain. Verify the specific ANN/cache behavior/performance; do not schedule a second Redis/worker foundation. |
| Standalone Cockpit PR dashboard / twin static boards | Superseded by OntoKit-native PR Party; retain only the pointer follow-up. |
| March U11/T1 send, U15 stewardship, B11 DEV reset, B12 repository protections | Sep7 records these as done. Recheck live state as needed; do not re-ask their original decisions or repeat the mutations. |
| Bare-metal-only / Railway / early hosting recommendations | Later topology/deploy decisions supersede them. Host choices need the final topology, not the April PROJECT.md constraint. |
| Anonymous paid LLM access; automatic acceptance of ordinary LLM ontology suggestions; one change duplicated into several shards; real-time collaboration expansion | Explicit exclusions, not missing backlog. The separately approved translation-verification pipeline has its own automatic-commit rule. |
| Broader audit/role-history backfill; historical snapshot reconstruction; direct-Google NextAuth migration; unrestricted PR Party outside its chosen org | Explicit non-goals. Preserve unless a new product decision changes them. |
| Atomization original versus critical analysis | Competing proposals, not two cumulative implementation checklists. PostgreSQL index work has already partly achieved the original performance intent. |

## Immediate next planning slices

1. **Delivery and proof:** use B01–03 and B10–14 to establish one current, evidence-backed release baseline. Reuse the existing UAT runbook; identify the exact receipts still missing.
2. **First substantial feature:** plan B16–20 as bounded increments: reviewer provenance/duplicate evidence can land independently; clustering, preview and multi-PR submission require a coherent API/web contract. Keep clean-PR generation B21 optional.
3. **Next UI feature:** carry the eleven phase17 requirements and chosen sketches into a CE plan for B24–27, preserving current fixes.
4. **Strategic expansion:** scope B28–33 to a single feeder pilot before B34's larger rollout.

Open questions belong to the selected slice: current API/deployment baseline; shard submitter/reviewer authority; whether the historical graph architecture is still preferred; the first import producer; renewed need for formal reasoning or storage migration. None prevents using this inventory or discussing its order.

This audit changed documentation only. No application code, deployment, remote issue, or branch history was changed; no commit, push, or merge is included.
