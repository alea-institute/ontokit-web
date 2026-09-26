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

**Priority: complete EU hosted acceptance after verified US retirement. D06/D07 are merged and their application pair is built on EU. D08 is locally verified and published as [Web PR53](https://github.com/alea-institute/ontokit-web/pull/53), merged as `cc64c02b`, deployed to DEV. The next eligible A02 deliverable is the B11 auth-mode matrix.**

- Damien accepted sole DEV ownership and authorized early retirement of unused US resources on September 21. [Migration plan](2026-09-20-1351-chore-eu-hosting-migration-plan.md) and [execution receipt](../releases/eu-hosting-migration-receipt.md) govern the active work. Independent encrypted recovery and actual restores passed; US server and both IPs are deleted. EU build and migration rehearsal passed. Explicitly authorized identity recovery and real browser login/private-project create/reload/logout now pass; repaired state has independent encrypted restore proof. Full hosted ontology/persona/rollback acceptance, protected CI connectivity and invoice reconciliation remain open. Run-owned smoke project/account cleanup awaits fresh inline approval required by automatic review. Do not infer hosted acceptance from resource deletion or build success.

- D06 completed U1–U6 and merged through [Web PR49](https://github.com/alea-institute/ontokit-web/pull/49) as `83eaf9574315b71a165b80370dd964572d2ccac9` after all eight verification checks passed. One CI assertion finding was repaired; two final fresh runs passed all 21 mandatory tests with identical source fingerprints, complete cleanup and preserved neighboring resources. [Merged evidence](../releases/d06-merged-readiness.json) and [local acceptance](../releases/d06-full-stack-readiness.md) preserve the limits. No deployment occurred. B10 is accepted as a local regression foundation; B11–B13 remain open.
- D07 merged through [API PR51](https://github.com/alea-institute/ontokit-api/pull/51) as `13ad2f35d55196274c5fec313bfb254a7cc80226` after all six verification checks passed. All six requirements and both units passed review. The full API suite passed 3,478 tests with zero skips and 90% coverage; after final test-only simplification, 94 affected integration tests and static checks passed. One documentation rationale was corrected. [Merged receipt](../releases/d07-merged-readiness.json) retains the wider B14 remainder. No deployment occurred.
- D08 [research](../audits/2026-09-21-d08-auth-lifecycle-research.md) is complete in isolated branch `test/d08-auth-lifecycle-20260920`, based on Web `83eaf957`. The [reviewed D08 plan](2026-09-21-0727-test-required-auth-lifecycle-plan.md) and [review receipt](../audits/2026-09-21-d08-auth-lifecycle-plan-review.md) are committed locally as `6b5d4fa6`. D08 is now locally verified at Web `93ea222d` against API `a2d48362` (a D07 descendant) and published as [Web PR53](https://github.com/alea-institute/ontokit-web/pull/53), merged as `cc64c02b`, deployed to DEV. Two baseline runs passed all 21 tests and two lifecycle runs passed all four R1–R4 cases (real logout, real elapsed access and refresh-idle expiry, controlled Next-clock cookie expiry), all from identical source fingerprints with complete cleanup and unchanged neighbors. Setup, clock-preflight and late failures, SIGINT, SIGTERM with the clock shifted, and SIGKILL with exact-manifest recovery all passed with the instrumented Next process running. Six demonstrated auth defects were repaired: the stale refresh error, the unrenewable expired grant and the empty logout client ID (#51, with the #52 parity guard, both deployed to DEV at `7f92fa79`), plus token leakage in Auth.js logs, chooser-page logout without `id_token_hint`, and unbounded logout/refresh requests (deploy after PR53 merges). Review: ce-code-review full depth with an independent Codex adversarial pass. See the [readiness receipt](../releases/d08-auth-lifecycle-readiness.md). This is local verification only, not hosted acceptance. Carried forward: the B11 optional/configured, optional/unconfigured and disabled auth-mode matrix; the suggestion submit/review chain; B02/B03 hosted persona acceptance; B12; B13; multi-tab refresh locking (the deferred refresh-rotation race).
- Next eligible deliverable: the B11 auth-mode matrix (A02). The area queue orders B10–B15 by ID, and B11 remains open while B12 has not started. The mode matrix also closes the D08 plan's declared follow-on and overlaps B14's auth-disabled routing seam. It is the lowest open requirement ID in the active area, and the D06/D08 harness makes it a bounded extension, so it goes before B12. Next action: ce-plan a bounded matrix that builds optional/configured, optional/unconfigured and disabled modes on the isolated harness. D08's app repairs are live on DEV (web `cc64c02b`).

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
| 1 / A01 | Deliver and validate existing work | B01–B09 | Hosted acceptance in progress | D03–05 and API prerequisites merged; EU identity recovery, metadata smoke and independent restore proved; broader acceptance open |
| 2 / A02 | Full-stack proof and integrity | B10–B15 | B11 auth-mode matrix next | B10 accepted locally, D07 merged, D08 required-mode lifecycle locally verified (PR53, merged as `cc64c02b`, deployed to DEV); B11 auth-mode matrix next, then B12–B15 remainders |
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
| D02 | B02–03 DEV runtime and persona acceptance | Hosted acceptance in progress | [Reviewed plan](2026-09-20-1323-chore-dev-recovery-acceptance-plan.md) | [Plan review](../releases/d02-plan-review.json): six local and three independent Claude reviews resolved; [Recovery proof](../releases/d02-recovery-receipt.md) passed; historical expired hosted service tokens replaced after explicit permission, temporary administrator removed and revocation verified. EU restore, build, schema migration and real login/project-metadata/logout smoke pass; full persona/ontology/rollback acceptance remains open; see [migration receipt](../releases/eu-hosting-migration-receipt.md) |

| D06 | B10 isolated local full-stack foundation | Accepted: local foundation | [Plan](2026-09-20-1357-feat-isolated-full-stack-tests-plan.md) | [Web PR49](https://github.com/alea-institute/ontokit-web/pull/49), merge `83eaf957`; eight CI checks passed, final two runs 21 tests each; [evidence](../releases/d06-merged-readiness.json) |
| D07 | B14 schema mint authorization | Integrated | [API plan](https://github.com/alea-institute/ontokit-api/blob/fix/d07-schema-mint-20260920/docs/plans/2026-09-20-1820-fix-schema-mint-authorization-plan.md) | [API PR51](https://github.com/alea-institute/ontokit-api/pull/51), merge `13ad2f35`; six CI successes, 3,478 local tests plus 94 affected after simplification; [receipt](../releases/d07-merged-readiness.json) |

| D08 | B11 authentication lifecycle regression proof | Locally verified; merged `cc64c02b`; deployed to DEV | [Plan](2026-09-21-0727-test-required-auth-lifecycle-plan.md) | [Readiness receipt](../releases/d08-auth-lifecycle-readiness.md): 2×21 baseline and 2×4 lifecycle runs accepted, failure/signal/hard-kill recovery with instrumented Next, neighbors unchanged; six auth defects repaired; [Web PR53](https://github.com/alea-institute/ontokit-web/pull/53), merged as `cc64c02b`, deployed to DEV; [plan review](../audits/2026-09-21-d08-auth-lifecycle-plan-review.md); auth-mode matrix, suggestion chain and multi-tab refresh locking carried forward |

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
| B02 | Complete the matched API/web DEV deployment and record running revisions, migration state, health, seeded project, write smoke, and rollback evidence | Hosted acceptance in progress | EU runtime revisions, all service health, identity recovery and project metadata write/reload/logout verified; independent repaired-state restore passes. Ontology/persona/rollback and protected CI deployment remain open |
| B03 | Finish authenticated persona UAT, including trust promotion, translation/audit, autosave, permissions, and the real submission/merge chain | Queued | See catalog; assign a bounded deliverable when reached |
| B04 | Activate the two isolated demo repositories, scoped source/destination credentials, atomic refresh, cleanup and rollback | Queued | See catalog; assign a bounded deliverable when reached |
| B05 | Close retired-demo redirect and retention acceptance | Queued | See catalog; assign a bounded deliverable when reached |
| B06 | Execute the reviewer-credential encryption rewrap in its approved operator window | Queued | See catalog; assign a bounded deliverable when reached |
| B07 | Complete PR Party external activation and its credentialed, degraded, and Q&A end-to-end flows | Queued | See catalog; assign a bounded deliverable when reached |
| B08 | Finish CatholicOS delivery of the remaining feature tranches and documentation | Queued | See catalog; assign a bounded deliverable when reached |
| B09 | Complete the parallel FOLIO PROD rehearsal, UAT, reversible cutover, and gated promotion proof | Queued | See catalog; assign a bounded deliverable when reached |
| B10 | Establish repeatable full-stack API and browser tests with isolated projects, real backend state, setup and cleanup | Accepted: local foundation | D06 merged via [Web PR49](https://github.com/alea-institute/ontokit-web/pull/49), `83eaf957`; all 21 mandatory tests passed twice after final repair, cleanup and neighbors verified |
| B11 | Prove real OIDC login, logout, credential renewal, session expiry, anonymous/optional/required modes, Monaco editing, and save/submit/review/merge | Partially verified locally | D06 covers login/editor/save/merge. D08 locally verifies required-mode logout, renewal, refresh-idle and cookie expiry ([receipt](../releases/d08-auth-lifecycle-readiness.md); [Web PR53](https://github.com/alea-institute/ontokit-web/pull/53), merged as `cc64c02b`, deployed to DEV). Next: a bounded optional/configured, optional/unconfigured and disabled auth-mode matrix. Suggestion submit/review, multi-tab refresh locking and hosted B02/B03 acceptance remain separate |
| B12 | Prove WebSocket authentication, presence, acknowledgments, sync, reconnect after server restart, multi-client behavior, and index notifications | Queued | See catalog; assign a bounded deliverable when reached |
| B13 | Add browser CI, reproducible seed/cleanup, Chromium/Firefox coverage, failure traces, and frontend/backend response-contract checks | Queued | See catalog; assign a bounded deliverable when reached |
| B14 | Reconcile known correctness/policy seams before declaring the workflow complete | Partially integrated | D03 image, D04 individual mint and D05 submission errors merged; D07 three-schema mint repair merged through API PR51. Namespace/untyped policy, historical branches, auth-disabled routing (to be exercised with the B11 auth-mode matrix), review/self-merge, deployment configuration/drift and D02 hosted acceptance remain to reconcile |
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
