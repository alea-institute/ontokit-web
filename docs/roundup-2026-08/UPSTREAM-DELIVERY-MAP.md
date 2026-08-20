# OntoKit upstream delivery map

**Snapshot date:** 2026-08-20  
**Status:** Working map; no CatholicOS mutation has occurred  
**Delivery policy:** Finish and validate the local work, then create the linked CatholicOS issues and PRs together as one batch. Do not self-merge.

## Cutoff and accounting

The snapshot measures each ALEA integration branch from its merge base with the refreshed CatholicOS `dev` branch. The ledger below partitions every cutoff commit exactly once. It is an accounting device, not the proposed review order: delivery tranches follow feature seams and may synthesize or squash source commits onto current CatholicOS `dev`.

| Repo | CatholicOS `dev` | ALEA cutoff | Merge base | Cutoff commits |
|---|---|---|---|---:|
| web | `c714c74bf1a440b867e2a8f8ee3ce3d58a992fb5` | `83b62b0b47916736274bb48f87448c8dbc3fb09b` | `b5aa5e3b2ea90ab3f73e2e5b89e97742557cc0d8` | 113 |
| API | `a21b7d5ce6abcf84af0fd471a72c260be0969e9d` | `435dc393f52d2607a744fdc7c2320d706e47a0f3` | `25cc4deeba2f21c7b2e4e45e6d2d4b7134bd44ea` | 164 |
| **Total** |  |  |  | **277** |

### Web cutoff ledger

| ID | Exact first-parent range | Count | Source seam |
|---|---|---:|---|
| W1 | `b5aa5e3b..d45c29a2` | 37 | LLM configuration, optional auth, suggestions, provenance, anonymous suggestion flow |
| W2 | `d45c29a2..933cb438` | 6 | Trust-ladder UI and tests |
| W3 | `933cb438..31b183fa` | 13 | PR Party UI plus plans and review learning |
| W4 | `31b183fa..add33b20` | 23 | LLM review hardening and public-viewer correctness |
| W5 | `add33b20..bf1d6d2d` | 2 | U7 auth build arguments |
| W6 | `bf1d6d2d..477b873e` | 2 | CI/Codecov hardening |
| W7 | `477b873e..ede96c3d` | 17 | Translation provenance and review surfaces |
| W8 | `ede96c3d..e6e9db28` | 2 | Self-check documentation learning |
| W9 | `e6e9db28..59747361` | 4 | Editor auto-save preference |
| W10 | `59747361..a4f95011` | 4 | U7 sweep fixes |
| W11 | `a4f95011..83b62b0b` | 3 | Annotation data-loss fix |
| **Total** |  | **113** |  |

### API cutoff ledger

| ID | Exact first-parent range | Count | Source seam |
|---|---|---:|---|
| A1 | `25cc4de..483b91f6` | 30 | LLM configuration, generation, optional auth, anonymous suggestions |
| A2 | `483b91f6..0a74ec04` | 11 | Trust ladder and commit identity |
| A3 | `0a74ec04..e2614e32` | 15 | PR Party service and review learning |
| A4 | `e2614e32..23aab106` | 45 | LLM review hardening and ontology/git correctness |
| A5 | `23aab106..9abb89b1` | 6 | CI fixes |
| A6 | `9abb89b1..bc5f19fa` | 7 | U7 Zitadel stand-up |
| A7 | `bc5f19fa..14d41c1d` | 8 | U12 DEV infrastructure as code |
| A8 | `14d41c1d..4837cfa9` | 28 | Translation lifecycle and provenance |
| A9 | `4837cfa9..6bec76ae` | 12 | Deploy workflow and hardening |
| A10 | `6bec76ae..435dc393` | 2 | Annotation data-loss fix |
| **Total** |  | **164** |  |

### Post-cutoff local deltas

These commits are not part of the 277-commit cutoff. They must be frozen at their final tested SHAs and folded into the corresponding delivery tranche before any send.

| Repo | Local branch/head | Delta | Disposition |
|---|---|---:|---|
| web | `fix/plan-audit-web-residuals` at `4a4dc5bf` | 5 commits after `83b62b0b` | Fold into T1 and the annotation seam; local-only, tested, not pushed or merged |
| API | `fix/recent-plan-api-residuals` at `0a54857a`; child `feat/demo-refresh-scaffold` at `e894f20f` | 6 residual/promotion commits plus 1 demo-refresh commit after `435dc393` | Fold audit cursor, annotation parity, FOLIO dependency, deploy-truth, and dormant promotion work into T2/T7/T8; append the refresh scaffold to T10; local-only, tested, not pushed or merged |

## Delivery tranches

Existing CatholicOS web PR #57 and API PR #27 are old AUTH_MODE prefixes. Do not duplicate them blindly: refresh them if their branch ownership and review state permit, otherwise replace them with clearly linked superseding PRs and close the stale prefixes only after reviewer confirmation.

| Order | Tranche | Feature seam and source inventory | Target | Dependencies | Review size | Validation state |
|---:|---|---|---|---|---|---|
| T1 | Optional auth, anonymous contribution, and public viewing | AUTH_MODE/anonymous/public-viewer portions of W1/W4/W5 and A1/A6; existing PR #57/#27 prefixes | web + API | none | large, split by repo | Web prefix replays cleanly; tests pass; current hardening requires synthesis; API replay pending |
| T2 | DEV deploy and CI | W6, A5, A7, A9, local deploy-truth and dormant-promotion work | API primarily; web CI companion | T1 | medium | provisional; dormant PROD scaffold is not activation authority |
| T3 | LLM configuration and controlled generation | Remaining W1/W4 and A1/A4 | web + API | T1 | large, split into config, generation, and hardening PRs if reviewer requests | provisional |
| T4 | Trust ladder and auto-accept | W2 and A2 | web + API | T1, T3 | medium | provisional; authenticated clock UAT still open |
| T5 | PR Party | W3 and A3 | web + API, then `catholicos/.github` answerer asset | T1, T3, T4, demo readiness, token-rotation decision, org gates | large | provisional; live E2E and outreach gated |
| T6 | Translation provenance | W7 and A8 | web + API | T1 | large | provisional; authenticated visual/live acceptance remains |
| T7 | Editor preference and annotation round-trip | W9, W11, A10, annotation portions of local web/API delta | web + API | T1 | small-to-medium | provisional; public two-mode UI check passed, authenticated preference UAT remains |
| T8 | Cross-feature correctness and dependency residuals | W10 plus remaining local web/API audit-cursor, FOLIO-dependency, build, and hardening commits not already synthesized into their owning tranche | web + API | T1–T7 as applicable | medium, split by repo and owner feature | provisional; direct replay was correctly refused because prerequisite feature files are absent upstream |
| T9 | Documentation learnings | W8 and documentation-only commits embedded in W3/W4/A3/A4 | appropriate upstream docs or omit with recorded rationale | after code tranches | small | provisional |
| T10 | Demo mode and picker deltas | U8/U9 implementation and picker assets not present at cutoff | web + API + deployment assets | scoped demo credentials and confirmed domain/DNS control | unknown | future; append before final batch |

No commit should be delivered twice. Where a source commit spans multiple seams, the upstream PR must replay its relevant file-level change rather than cherry-pick the mixed commit wholesale; the PR body must name the source commit and the excluded seam.

## Tranche 1 package

The held drafts are:

- [`tranche-drafts/T1-ISSUES.md`](tranche-drafts/T1-ISSUES.md) — issue/update bodies and link matrix.
- [`tranche-drafts/T1-PRS.md`](tranche-drafts/T1-PRS.md) — web and API PR descriptions.

Before the authorized final batch:

1. Freeze the tested local web and API heads and replace every provisional SHA.
2. Refresh both CatholicOS `dev` refs.
3. Reconcile and synthesize the current hardening onto the existing T1 prefixes, then replay each prefix in a clean scratch worktree and run the source-repo lint, type, unit, integration, and build gates.
4. Reconcile existing issues and AUTH_MODE PR prefixes so the batch creates no duplicates.
5. Create or update issues first, then create PRs with explicit closing/related links. Never self-merge.

### T1 scratch receipt so far

- Web PR #57's nine feature commits (`07cbcd8..a13a0fd`) replayed without a Git conflict onto CatholicOS web `dev` at `c714c74b`.
- The scratch tree's full Vitest run passed: 159 files, 2,749 tests.
- Type-check stopped on `components/editor/TurtleEditor.tsx:628`, a file unchanged by the T1 replay. The current installed toolchain therefore cannot provide a clean baseline type signal for this old prefix.
- Applying the current issuer-validation hardening commit directly produced conflicts in `auth.ts`, `lib/env.ts`, and its environment test. T1 must be synthesized against current upstream rather than sent as either stale prefix or a blind cherry-pick.
- API PR #27 and the final synthesized T1 pair remain to be replayed before send.

## Gates outside the map

- AWS/PROD: parallel stand-up is selected, but no host action occurs until the exact access and environment gates clear.
- Demo repositories: source-read and destination-write credentials must remain separate and narrowly scoped.
- Google federation: parked until ALEA-side and CatholicOS-side domain-name resolution.
- `ontokit.org`: registration is a user action in progress; picker activation waits for confirmed registration and DNS control.
- PR Party: prepare locally; outreach waits for a ready demo and the selected token-rotation disposition.
