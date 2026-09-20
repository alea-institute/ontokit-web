---
title: OntoKit requirements delivery roadmap
date: 2026-09-20
execution: knowledge-work
kind: approach-plan
status: ongoing
---

# OntoKit requirements delivery roadmap

## Working agreement

On 2026-09-20 Damien granted durable authorization for pushes, PRs, merges, deployments and Claude repository-content disclosure. The current rule lives in `AGENTS.md` and supersedes earlier local-only/confirmation restrictions.

Proceed through the recovered requirements in priority order, creating and executing a focused CE implementation plan for each coherent deliverable. Maintain this master tracker throughout. The user selected thorough serial planning on 2026-09-20 and asked that later work remain visible across sessions.

This document coordinates the work; it is not an implementation plan to pass wholesale to ce-work. Broad areas may require several deliverable plans. Plan the next deliverable in detail when its prerequisites are understood, so later plans benefit from what earlier work teaches us.

## Sources of truth

- **Scope and provenance:** [requirements catalog](../audits/2026-09-20-requirements-backlog.md), with stable IDs B01–B75 and its completed/superseded dispositions.
- **Historical evidence:** [source index](../audits/2026-09-20-requirements-source-index.md), including immutable Git blobs for branch-only CE/GSD documents.
- **Program status, dependencies and next action:** this tracker.
- **Deliverable behavior and implementation:** each linked CE plan. Use ce-brainstorm only where material product decisions remain unresolved, then ce-plan, plan review, ce-work, implementation review and verification.
- **Evidence:** commits, PRs, test results and dated environment-specific acceptance receipts. A historical checkbox alone does not prove delivery.

The accepted direction is to work through every area. Alternative storage architectures, superseded tooling choices and explicitly deferred candidates still require reconciliation when reached; they are not simultaneous implementation commitments. Every ID receives a disposition, even if the conclusion is that current code already satisfies it or a newer decision supersedes it.

## Resume here

**D02: recovery verified; hosted identity access pending. Independent deliverable D06: B10 full-stack test foundation (all local verification and review complete; publication next).**

- D06's [reviewed implementation plan](2026-09-20-1357-feat-isolated-full-stack-tests-plan.md) and [review receipt](../releases/d06-plan-review.json) are checkpointed as `db916292` on `feat/d06-full-stack-tests-20260920` in `.worktrees/web-d06-full-stack`. Ten review passes completed with no unresolved findings. U1 lifecycle implementation is verified as `a5800e49`; U2 genuine identity and API authentication is verified as `19c40e86`, including production session-subject fix `6f1d9687`. U3 project/ontology persistence is verified as `f09738e5` (15 tests, zero skips/failures); phase-boundary simplification is committed as `13b10944`; U4 branch/PR/search/lint is verified as `715c86b6` (20 tests, zero skips/failures), following API serializer repair `f5f036b9`; U5 browser journey is verified as `48db779c` (21 tests, zero skips/failures); U6 final repeatability and crash recovery is verified; two fresh21-test runs pass; [full-stack readiness](../releases/d06-full-stack-readiness.md) records the mandatory-suite gate and two successful fresh runs. No full-stack acceptance is claimed. This branch starts from merged web `ab903e14`, preserving the older documentation branch's unpublished history.
- D06's first real probes found a default API Dockerfile defect: the package directory is root-owned `0644`, preventing non-root imports and migrations. [Lifecycle evidence](../releases/d06-lifecycle-readiness.md) records the reproduced failure and successful cleanup. The repair in `.worktrees/api-d06-image` is locally committed as `4d17d949`; its full-image non-root smoke and fresh migrations pass. Image and PR serializer repairs merged through [API PR50](https://github.com/alea-institute/ontokit-api/pull/50) as `d9272cc8` after all six verification checks passed; hosted DEV acceptance remains separate. U1 normal/setup-failure/late-failure/INT/TERM/crash-recovery probes all pass, with no owned leftovers and unchanged neighboring resource identities.

- D01/D03 candidate merged into ALEA web `dev` through [PR48](https://github.com/alea-institute/ontokit-web/pull/48), revision `ab903e145e2a6ad30aefd915a83cb0bafbaa0678`, after all eight verification checks passed. No deployment occurred.
- [D03 evidence](../releases/d03-image-readiness.md) supersedes D01’s required-auth image failure: all three images build and pass expanded runtime checks; 5,222 tests pass.
- Completed implementation of [the reviewed D03 plan](2026-09-20-0731-fix-configured-provider-image-plan.md): build-time public provider configuration versus runtime secrets, retaining fail-closed runtime validation. Work from the local release candidate identified in that packet, not the older repair branch.
- D01 local preparation is complete under [its reviewed plan](2026-09-20-0659-chore-repaired-release-baseline-plan.md). The candidate incorporates current ALEA `dev`, the repair/test work and one dashboard fixture adaptation. Standing authorization in `AGENTS.md` now permits publication, merge and deployment after their verification gates.
- D04 is implemented and independently reviewed: all six requirements met, no primary/actionable findings; 3,243 tests pass with no skips, Ruff/mypy/pyright pass in the locked Python 3.11 environment. All four save entry points have denial/persistence coverage.
- [API PR48](https://github.com/alea-institute/ontokit-api/pull/48) publishes D04 at `a2b981f5128ff61676f7e64a75daa860a1bf7d08`; Merged into API `dev` as `c6e552c844f315987f4eb614d04527c4c4a5e5af` after all six verification checks passed; see [merged evidence](../releases/d04-merged-readiness.md). [Durable verification](https://github.com/alea-institute/ontokit-api/blob/fix/d04-individual-mint-20260920/docs/releases/d04-individual-mint-readiness.md) includes the plan and review links. The canonical checkout is `.worktrees/api-d04-mint`; the original API checkout is stale and contains unrelated work.
- D05 is merged: [API PR49](https://github.com/alea-institute/ontokit-api/pull/49), merge `c95991c720e49d1a36abc16803cbb5a1f052e2fe`; submit embedding-error recovery and real retry/state/accounting verification are complete; resubmit retains no paid validation. B14 also retains a pre-existing schema-taxonomy gap for `owl:DeprecatedClass`, `owl:DeprecatedProperty` and `rdfs:ContainerMembershipProperty`; plan that bounded follow-up without altering submission billing/caps.
- D02 remains authenticated DEV lifecycle acceptance (B02–03), after code prerequisites and authorized release activation. The obsolete waiting workflow run34155698435 was canceled and GitHub confirmed completion; the new candidate needs its own matched release.
- If only external activation blocks, continue with the independent full-stack foundation in A02 (B10). Record the blocker owner, next action and return condition.

Local verification, publication, deployment and authenticated acceptance remain distinct. All remaining B01–B75 obligations retain their ledger rows below.

## Area queue

| Order / ID | Area | Backlog IDs | State | Dependency / next planning boundary |
|---|---|---|---|---|
| 1 / A01 | Deliver and validate existing work | B01–B09 | Preparing release | Finish D01 evidence; B14 prerequisites precede activation, then D02 |
| 2 / A02 | Full-stack proof and integrity | B10–B15 | D06 publication | Test foundation can proceed while A01 awaits external action; assess integrity seams before release |
| 3 / A03 | Ontology batching and reviewer intelligence | B16–B23 | Queued | Verify API contracts; provenance/duplicate comparison can precede shard-dependent review |
| 4 / A04 | Entity workspace and graph | B24–B27 | Queued | Reconcile historical graph port and current repairs; preserve all eleven Phase17 requirements |
| 5 / A05 | Ecosystem suggestion import loop | B28–B34 | Queued | Prove one producer-to-reviewed-change pilot before scaling feeder volume |
| 6 / A06 | Contributor onboarding and identity | B35–B38 | Queued | Separate identity provisioning, standing UI, verification and inbound GitHub contributions |
| 7 / A07 | LLM controls and efficiency | B39–B46 | Queued | Preserve existing cost/validation gates; measure outcomes once live usage is possible |
| 8 / A08 | Translation maintenance | B47–B49 | Queued | Extend existing translation lifecycle; reconcile policy-changing defaults |
| 9 / A09 | Semantic validation and extraction | B50–B55 | Queued | Reconcile current tooling before reviving old reasoner designs |
| 10 / A10 | Hosting, discovery and federation | B56–B58 | Queued | Verify domains/topology; bound the first federation use case |
| 11 / A11 | Large-ontology scaling | B59–B62 | Queued | Benchmark first; resolve competing storage proposals before migration planning |
| 12 / A12 | Polish and maintenance | B63–B75 | Queued | Select confirmed remaining needs; tracking B73 is partially addressed by this document |

Default to this order. A prerequisite may move earlier and an independent deliverable may proceed around an external blocker; record the reason and return condition. There should normally be one active implementation deliverable. Maintain only a short next-up queue rather than drafting twelve speculative implementation plans at once.

## Per-deliverable process

1. Re-read the relevant B-IDs and sources; check current code, branches and environment evidence. Identify what already exists and the exact remainder.
2. Resolve only material product choices for this slice. Record assumptions and later candidates explicitly.
3. Create or enrich a bounded ce-plan, referencing its B-IDs, dependencies, scope exclusions, acceptance criteria and delivery obligations. Review the plan before implementation.
4. Execute with ce-work, review the changes, and run appropriate verification. Preserve unrelated work.
5. Update the ledger below with plan, repository, commit/PR and acceptance evidence. Keep partial outcomes and external blockers visible.
6. Update “Resume here” before ending a session, and select the next eligible deliverable. Carry every uncovered requirement forward by ID.

This sequence does not require asking again for routine authorized work. Ask when an unresolved product decision materially changes the result or an action actually requires new authority.

## Completion and blocked-work rules

- Use states: queued, scoping, planned, implementing, locally verified, integrated, awaiting activation, accepted, deferred, superseded.
- A requirement is **accepted** only when its own acceptance boundary is satisfied. Local-only artifacts can finish locally; user-facing deployed behavior requires the relevant deployment/acceptance evidence.
- Never report an area complete because its first plan finished. Reconcile every B-ID assigned to it; distinguish delivered outcomes from explicit deferrals or supersessions.
- Keep partial IDs open and describe exactly what remains. One B-ID can span multiple deliverable plans; one plan can cover multiple IDs.
- For a blocker record the missing prerequisite, owner/action, evidence date, and event that should trigger rechecking. Do not erase it when moving to another area.
- Update this tracker with the associated work, and preserve it in Git. Record commit/push/merge separately. Do not leave the only continuation instructions in chat or temporary storage.
- At every area closeout, check all 75 IDs remain represented, newly discovered work has a stable ID, and the next action points to an actual unfinished outcome.

## Deliverable register

| ID | Scope | State | Plan | Evidence / remainder |
|---|---|---|---|---|
| D01 | B01; readiness portions of B02/B14 | Accepted: local preparation only | [Plan](2026-09-20-0659-chore-repaired-release-baseline-plan.md) | [Release evidence](../releases/d01-release-readiness.md); candidate `3d45af5b`: 364 files / 5,188 tests pass; optional-auth image builds; authenticated activation blocked |
| D03 | B14 configured-provider image fidelity | Integrated | [Plan](2026-09-20-0731-fix-configured-provider-image-plan.md) | [Image and review evidence](../releases/d03-image-readiness.md); [PR48](https://github.com/alea-institute/ontokit-web/pull/48) merged as `ab903e14`; eight CI checks passed |
| D04 | B14 individual mint enforcement | Integrated | [API plan](https://github.com/alea-institute/ontokit-api/blob/fix/d04-individual-mint-20260920/docs/plans/2026-09-20-0839-fix-individual-mint-enforcement-plan.md) | [API PR48](https://github.com/alea-institute/ontokit-api/pull/48), merged `c6e552c8`; 3,243 tests pass; all six requirements met; no new actionable review findings |
| D05 | B14 submission embedding errors | Merged | [API PR49](https://github.com/alea-institute/ontokit-api/pull/49) | Merge `c95991c7`; 3,260 tests, zero skips, 90% coverage; eight review lenses clear; six CI successes/six conditional skips; [receipt](../releases/d05-merged-readiness.md) |
| D02 | B02–03 DEV runtime and persona acceptance | Awaiting identity access | [Reviewed plan](2026-09-20-1323-chore-dev-recovery-acceptance-plan.md) | [Plan review](../releases/d02-plan-review.json): six local and three independent Claude reviews resolved; [Recovery proof](../releases/d02-recovery-receipt.md) passed; hosted admin tokens invalid; local credential also rejected by hosted DEV after authorized validation. Return when supported DEV admin authority is available; no deployment or migration performed |

| D06 | B10 isolated local full-stack foundation | Verified; publication pending | [Reviewed plan](2026-09-20-1357-feat-isolated-full-stack-tests-plan.md); checkpoint `db916292` | U1–U5 lifecycle, authentication, API and browser workflows verified; U6 final repeatability verified; full review and two recovery repairs complete; publication pending; real local services and disposable identity, API/browser workflows and repeatable cleanup; B11–13 broader coverage remains separate |

## Decision record

| Date | Decision | Rationale |
|---|---|---|
| 2026-09-20 | Maintain a master roadmap; plan and execute bounded deliverables serially | User prefers Option2's thoroughness while keeping all twelve areas visible |
| 2026-09-20 | Preserve B01–B75 as the traceability spine; retain CE/GSD provenance | Avoid losing deferred requirements or rebuilding superseded work |
| 2026-09-20 | Use multiple plans within an area when independently useful | A broad area is too large to be an effective implementation unit |
| 2026-09-20 | Sequence D03–05 before D02 | D01 reproduced required-auth image failure and identified API trust/error-contract gaps; prerequisites advance A02/B14 before A01 activation |

## Requirement ledger

The catalog owns the full requirement wording and source status. This ledger owns program progress. “Queued” means not yet reconciled/executed in this program, not that historical code is necessarily absent.

| ID | Outcome | Program state | Plan / evidence / next action |
|---|---|---|---|
| B01 | Integrate the September coverage-driven production repairs and their tests into the intended delivery branch, then ship the reviewed pair | Locally verified | [PR48](https://github.com/alea-institute/ontokit-web/pull/48) merged as `ab903e14`; matched deployment remains |
| B02 | Complete the matched API/web DEV deployment and record running revisions, migration state, health, seeded project, write smoke, and rollback evidence | Awaiting identity access | D02 backup/restore verified; hosted admin authority, deployment and acceptance remain open |
| B03 | Finish authenticated persona UAT, including trust promotion, translation/audit, autosave, permissions, and the real submission/merge chain | Queued | See catalog; assign a bounded deliverable when reached |
| B04 | Activate the two isolated demo repositories, scoped source/destination credentials, atomic refresh, cleanup and rollback | Queued | See catalog; assign a bounded deliverable when reached |
| B05 | Close retired-demo redirect and retention acceptance | Queued | See catalog; assign a bounded deliverable when reached |
| B06 | Execute the reviewer-credential encryption rewrap in its approved operator window | Queued | See catalog; assign a bounded deliverable when reached |
| B07 | Complete PR Party external activation and its credentialed, degraded, and Q&A end-to-end flows | Queued | See catalog; assign a bounded deliverable when reached |
| B08 | Finish CatholicOS delivery of the remaining feature tranches and documentation | Queued | See catalog; assign a bounded deliverable when reached |
| B09 | Complete the parallel FOLIO PROD rehearsal, UAT, reversible cutover, and gated promotion proof | Queued | See catalog; assign a bounded deliverable when reached |
| B10 | Establish repeatable full-stack API and browser tests with isolated projects, real backend state, setup and cleanup | Verified; publication pending | D06 all 21 mandatory tests pass twice with identical source fingerprints; current lifecycle recovery and review findings resolved; [final evidence](../releases/d06-full-stack-readiness.md) |
| B11 | Prove real OIDC login, logout, credential renewal, session expiry, anonymous/optional/required modes, Monaco editing, and save/submit/review/merge | Queued | See catalog; assign a bounded deliverable when reached |
| B12 | Prove WebSocket authentication, presence, acknowledgments, sync, reconnect after server restart, multi-client behavior, and index notifications | Queued | See catalog; assign a bounded deliverable when reached |
| B13 | Add browser CI, reproducible seed/cleanup, Chromium/Firefox coverage, failure traces, and frontend/backend response-contract checks | Queued | See catalog; assign a bounded deliverable when reached |
| B14 | Reconcile known correctness/policy seams before declaring the workflow complete | Partially locally verified | D03 image repair verified; D04/D05 API prerequisites and D02 acceptance remain open |
| B15 | Close demonstrated Turtle representational limits without losing existing source semantics | Queued | See catalog; assign a bounded deliverable when reached |
| B16 | Organize session changes into ancestor-based shards, max 50/min 3, with miscellaneous and cross-cutting groups and exactly-one-shard membership | Queued | See catalog; assign a bounded deliverable when reached |
| B17 | Let contributors preview and merge/split/rename/move shard contents with accessible alternatives to dragging | Queued | See catalog; assign a bounded deliverable when reached |
| B18 | Turn shards into coherent commits and bounded PR groups with progress, partial-success reporting, safe retry and cleanup | Queued | See catalog; assign a bounded deliverable when reached |
| B19 | Show per-change human/AI/edited-AI provenance and confidence, scored duplicate candidates, and side-by-side comparisons during ontology review | Queued | See catalog; assign a bounded deliverable when reached |
| B20 | Filter review by shard and retain approve/reject/feedback marks without confusing advisory marks with the final PR decision | Queued | See catalog; assign a bounded deliverable when reached |
| B21 | Generate a clean PR from approved shards only | Queued | See catalog; assign a bounded deliverable when reached |
| B22 | Resume organized batches across days/sessions | Queued | See catalog; assign a bounded deliverable when reached |
| B23 | Request changes with comments attached to individual ontology suggestions | Queued | See catalog; assign a bounded deliverable when reached |
| B24 | Reconcile and integrate the historical server-backed entity graph port | Queued | See catalog; assign a bounded deliverable when reached |
| B25 | Put Detail/Graph in the standard detail pane and Detail/Graph/Source in the developer pane; preserve active tab across selections and start on Detail | Queued | See catalog; assign a bounded deliverable when reached |
| B26 | Show meaningful property and individual neighborhoods, including domain/range/parent properties, types/object assertions/sameAs/seeAlso, and the annotation-property empty state | Queued | See catalog; assign a bounded deliverable when reached |
| B27 | Provide entity-scoped Turtle snippets with copy and line context, plus full-source modal/maximize/restore with selection-synchronized scrolling | Queued | See catalog; assign a bounded deliverable when reached |
| B28 | Establish the shared, versioned suggestion envelope: typed changes, target/project, producer, evidence, provenance, confidence kind and stable identity | Queued | See catalog; assign a bounded deliverable when reached |
| B29 | Accept batches with scoped service credentials, dry run, per-item results, safe replay, rate limits, and isolated malformed items | Queued | See catalog; assign a bounded deliverable when reached |
| B30 | Deduplicate against the ontology, current queue, and same batch; retain corroborating evidence | Queued | See catalog; assign a bounded deliverable when reached |
| B31 | Provide source/type/branch/trust/dedup/steward filtering, evidence, provenance and corroboration in the import review queue | Queued | See catalog; assign a bounded deliverable when reached |
| B32 | Materialize approved imports through the existing ontology-change/PR workflow and release the result back to consumers | Queued | See catalog; assign a bounded deliverable when reached |
| B33 | Supply the producer client and prove one feeder end to end | Queued | See catalog; assign a bounded deliverable when reached |
| B34 | Add Enrich unmapped spans, Intake gaps, Mapper unmatched nodes, Insights coverage gaps, and Generative-FOLIO/hydration batches | Queued | See catalog; assign a bounded deliverable when reached |
| B35 | Enable and prove Google sign-in through Zitadel, including same-email account linking and continued password login | Queued | See catalog; assign a bounded deliverable when reached |
| B36 | Show contributors their acceptance history and progress toward trust; offer appropriate public contribution credit | Queued | See catalog; assign a bounded deliverable when reached |
| B37 | Complete verification of the optional commit-attribution email | Queued | See catalog; assign a bounded deliverable when reached |
| B38 | Ingest GitHub-side ontology contributions as attributed, trust-gated OntoKit suggestions | Queued | See catalog; assign a bounded deliverable when reached |
| B39 | Alert project owners at 50%, 75%, and 90% of monthly budget | Queued | See catalog; assign a bounded deliverable when reached |
| B40 | Let users choose the embedding model, not only the provider's hardcoded default | Queued | See catalog; assign a bounded deliverable when reached |
| B41 | Offer a quality/cheap choice for an individual suggestion request | Queued | See catalog; assign a bounded deliverable when reached |
| B42 | Support multi-branch iterator selection | Queued | See catalog; assign a bounded deliverable when reached |
| B43 | Allow project-specific prompt templates | Queued | See catalog; assign a bounded deliverable when reached |
| B44 | Suggest missing intermediate parents and deliberate split/merge/reorganization of existing classes | Queued | See catalog; assign a bounded deliverable when reached |
| B45 | Add usage charts and an admin price-table surface if operational use warrants them | Queued | See catalog; assign a bounded deliverable when reached |
| B46 | Measure the original throughput/acceptance/duplicate outcomes with real SMEs and provider evaluations | Queued | See catalog; assign a bounded deliverable when reached |
| B47 | Retranslate after a source label changes, with stale/provisional state and provenance handled deliberately | Queued | See catalog; assign a bounded deliverable when reached |
| B48 | Add capped continuous gap-filling and targeted replacement of older machine translations where needed | Queued | See catalog; assign a bounded deliverable when reached |
| B49 | Revisit default long-form translation only if its value justifies cost and graph growth | Queued | See catalog; assign a bounded deliverable when reached |
| B50 | Extract sourced definitions/glosses from reference texts | Queued | See catalog; assign a bounded deliverable when reached |
| B51 | Display OWL restrictions as readable, navigable statements | Queued | See catalog; assign a bounded deliverable when reached |
| B52 | Run formal semantic reasoning with progress/history and useful inconsistency, unsatisfiability and inferred-relationship findings | Queued | See catalog; assign a bounded deliverable when reached |
| B53 | Show before/after inference differences and optional closed-world checks | Queued | See catalog; assign a bounded deliverable when reached |
| B54 | Edit/store SHACL shapes and validate asserted or inferred data with navigable violations | Queued | See catalog; assign a bounded deliverable when reached |
| B55 | Manage and execute SWRL rules | Queued | See catalog; assign a bounded deliverable when reached |
| B56 | Build/activate the `ontokit.org` instance picker with direct instance URLs, TLS and accessible mobile navigation | Queued | See catalog; assign a bounded deliverable when reached |
| B57 | Finish any separate Catholic DEV environment still required by the final topology | Queued | See catalog; assign a bounded deliverable when reached |
| B58 | Develop hosted multi-tenant use, cross-project references, and repo-change federation/heartbeat | Queued | See catalog; assign a bounded deliverable when reached |
| B59 | Benchmark real 50K+ ontologies: tree/search/detail, load/save/export, diff/merge and index/rebuild behavior | Queued | See catalog; assign a bounded deliverable when reached |
| B60 | Decide and implement a storage approach only against demonstrated bottlenecks | Queued | See catalog; assign a bounded deliverable when reached |
| B61 | If storage changes, provide lossless conversion, deterministic export, consistent derived indexes, rollback and performance monitoring | Queued | See catalog; assign a bounded deliverable when reached |
| B62 | Consider advanced class-expression editing and entity-level history/diffs | Queued | See catalog; assign a bounded deliverable when reached |
| B63 | Graph edge-type filters and search within the displayed graph | Queued | See catalog; assign a bounded deliverable when reached |
| B64 | SVG/PNG graph export | Queued | See catalog; assign a bounded deliverable when reached |
| B65 | Per-project branch colors and animated relationship traversal | Queued | See catalog; assign a bounded deliverable when reached |
| B66 | User/project default pane tab and shareable active-tab URLs | Queued | See catalog; assign a bounded deliverable when reached |
| B67 | Configurable generalized graph depth/per-predicate caps and graph drag-to-reparent | Queued | See catalog; assign a bounded deliverable when reached |
| B68 | Full-source-to-tree navigation refinements and modal visual refresh | Queued | See catalog; assign a bounded deliverable when reached |
| B69 | Software PR Party line-anchored comments and J/K/verdict shortcuts | Queued | See catalog; assign a bounded deliverable when reached |
| B70 | Cockpit pointer to the canonical PR Party queue; optional email notifications and wider reviewer availability | Queued | See catalog; assign a bounded deliverable when reached |
| B71 | Demo-generation rollback UX, sitemap refresh, run-level retention metrics/dashboard, long-age failed-row cleanup, and handling generation-specific links | Queued | See catalog; assign a bounded deliverable when reached |
| B72 | Remove obsolete contributor PAT storage only when no environment still depends on it | Queued | See catalog; assign a bounded deliverable when reached |
| B73 | Refresh the persistent requirements/status index and integrate branch-only documentation | Scoping | Tracker and session entry point created; historical status/doc integration remains |
| B74 | Safely reconcile stale local branches/stashes and remaining upstream delivery housekeeping | Queued | See catalog; assign a bounded deliverable when reached |
| B75 | Select remaining backend maintenance from confirmed findings, not old severity lists | Queued | See catalog; assign a bounded deliverable when reached |
