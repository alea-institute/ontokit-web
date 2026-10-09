---
title: Editor Correctness and CI Hygiene - Plan
type: fix
date: 2026-10-09
topic: editor-correctness-and-ci-hygiene
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-brainstorm
execution: code
---

# Editor Correctness and CI Hygiene - Plan

## Goal Capsule

- **Objective:** an editor who deletes a class or saves an individual changes only what they meant to change, and the PR suite reports real regressions instead of environment flakes.
- **Product authority:** the 2026-10-09 OntoKit drain tranche 1 brief (corrections, data loss, CI hygiene). Security and API work live in the companion ontokit-api plan of the same date.
- **Open blockers:** none.

## Product Contract

### Summary

Route class deletion through the same Turtle-source save that class edits already use. Make individual saves preserve predicates the form does not describe, as class and property saves already do. Remove two known test flakes, and run the hermetic `scripts/e2e` unit suites on every PR.

### Problem Frame

A survey of `origin/dev` at `e6090b92` found most of the listed issues already fixed: #364, #345, #359, #347, #344 and #360 each have landed code and tests. Three gaps remain.

- **Delete is broken.** Delete in the project editor calls `DELETE /api/v1/projects/{id}/ontology/classes/{iri}`, which the API never served (alea#56). It fails in every auth mode. The integration test mocks that route as returning 204, so the suite encodes the bug.
- **Individual saves lose data.** The #361 data-loss fix covered classes and properties. `lib/ontology/turtleIndividualUpdater.ts` still regenerates the whole block, so any predicate the form omits (for example `skos:altLabel` translations) is destroyed on save.
- **Two flakes erode CI trust.** alea#54 fails intermittently under coverage load, and alea#58 depends on the process umask. The `scripts/e2e/*.test.mjs` suites never run in CI, so #58 was invisible there.

### Key Decisions

- **Delete removes the entity's own triples, not other entities' references.** The impact dialog already makes the editor acknowledge references, and cascading into other entities' blocks is a larger, destructive behavior that needs a product call. Governs R2.
- **Delete stays editor-only.** It is gated by `canWrite` today, and suggest-mode or anonymous deletion would be new product behavior. Governs R1.
- **The dead client calls are removed, not re-pointed.** No API route accepts a project-scoped class DELETE or PATCH. Governs R3.

### Requirements

**Class deletion**

- R1. Confirming Delete in the project editor commits the class's removal to the active branch through `PUT /projects/{id}/source`, with the source revision as the conflict guard and the message `Delete class <label>`.
- R2. The removal drops the class's own subject block and any `owl:Axiom` blocks annotating it, and leaves every other block byte-identical.
- R3. `projectOntologyApi.deleteClass` and the unused `projectOntologyApi.updateClass` are removed, and no code path issues a DELETE or PATCH to `/projects/{id}/ontology/classes/...`.
- R4. A stale revision on delete surfaces the existing source-conflict handling instead of a silent failure, and the optimistic tree removal is rolled back.
- R5. The DeleteImpactAnalysis test asserts that a zero-reference lookup calls `onAcknowledge(true)` (#364 regression guard).

**Individual saves**

- R6. Saving an individual through the form preserves every predicate and object the payload does not describe, matching the class and property updaters (#361 residual).

**CI hygiene**

- R7. The editor-actions source-insert test (alea#54) waits on the editor model holding the branch source before it acts, and passes 20 consecutive runs under `npm run test:coverage`.
- R8. The diagnostics unsafe-root fixture sets its mode explicitly, so the test passes under umask 077 and 022 (alea#58).
- R9. PR CI runs every hermetic `scripts/e2e` node test suite, which today are `test:e2e:ownership`, `test:e2e:profiles`, `test:e2e:evidence` and `test:e2e:identity`, under umask 077 to match `scripts/e2e/run.mjs`.

### Acceptance Examples

- AE1. **Covers R1, R2.** Given a class with `skos:altLabel` in nine languages and one annotated axiom, when the editor deletes it, the committed source no longer contains its IRI as a subject or as an axiom's `owl:annotatedSource`, and a sibling class's block is unchanged.
- AE2. **Covers R4.** Given another tab committed after this tab loaded source, when the editor confirms Delete, the conflict UI appears and the class reappears in the tree.
- AE3. **Covers R6.** Given an individual with `skos:altLabel "Spieler"@de` that the form does not show, when the editor changes its label and saves, the saved block still carries the altLabel.

### Scope Boundaries

- Deleting properties or individuals: no delete flow exists for them, so adding one is new product behavior.
- Suggest-mode and anonymous delete proposals.
- Cascading removal of other entities' references to a deleted class.
- Fixed upstream issues (#364 beyond R5, #345, #359, #347, #344, #360) need no code. They get comments on the alea issues only.

### Outstanding Questions

- Deferred to Planning: whether the block remover belongs in `lib/ontology/turtleClassUpdater.ts` or `lib/ontology/turtleUtils.ts`.
- Deferred to Planning: whether any `scripts/e2e` suite needs a binary or network that CI lacks. If one does, it is excluded from R9 with a note.

### Sources / Research

- `app/projects/[id]/editor/page.tsx` (`handleDeleteConfirm`, `handleUpdateClass`, `getDirectSourceSnapshot`)
- `lib/api/client.ts` (`deleteClass`, `updateClass`, `saveSource`)
- `lib/ontology/turtleClassUpdater.ts`, `lib/ontology/turtleIndividualUpdater.ts`, `lib/ontology/turtleUtils.ts`
- `__tests__/app/editor-actions.integration.test.tsx` (delete fixture near line 220; source insert near line 1459)
- `scripts/e2e/diagnostics.test.mjs` near line 85
- `.github/workflows/release.yml`

## Planning Contract

### Key Technical Decisions

- KTD1. **Deletion is a pure Turtle transform.** A new `lib/ontology/turtleClassRemover.ts` exports `removeClassFromTurtle(source, classIri)`. It reuses the block-finding helpers already in `lib/ontology/turtleUtils.ts` and every IRI form `iriTurtleForms` yields (full, prefixed, `:local`), and it does not modify `turtleUtils.ts`. Covers R2.
- KTD2. **The editor saves through the existing direct-save path:** `getDirectSourceSnapshot`, then `removeClassFromTurtle`, then `saveDirectSource(modified, "Delete class <label>", snapshot.revision)`. Conflict capture and source-state reset therefore come for free. Covers R1, R4.
- KTD3. **The alea#54 fix is test-only.** The Monaco mock must expose the current `props.value` to the model, and the test waits on the model text before it acts. Production code changes only if a real ordering bug is found, which must be reported. Covers R7.
- KTD4. **The e2e unit suites run as a new `e2e-unit` job in `.github/workflows/release.yml`,** using the repo's composite setup-node action and `umask 077`. The job is not added to required checks today. Covers R9.

### Sequencing

U1, U2 and U3 have disjoint files and run in parallel. U1 owns `__tests__/app/editor-actions.integration.test.tsx`, so both the delete fixture and the alea#54 fix live in U1.

## Implementation Units

### U1. Class delete via source save, plus the editor-actions flake

- **Goal:** working class delete (alea#56), the #364 assertion, and the alea#54 deflake.
- **Requirements:** R1, R2, R3, R4, R5, R7.
- **Files (owned):**
  - `lib/ontology/turtleClassRemover.ts` (new)
  - `__tests__/lib/ontology/turtleClassRemover.test.ts` (new)
  - `app/projects/[id]/editor/page.tsx` (`handleDeleteConfirm` only)
  - `lib/api/client.ts` (remove `projectOntologyApi.deleteClass` and `projectOntologyApi.updateClass`)
  - `__tests__/lib/api/client.test.ts`
  - `__tests__/app/editor-actions.integration.test.tsx`
  - `__tests__/components/editor/editor-proposal-lifecycle.test.tsx`
  - `__tests__/components/editor/DeleteImpactAnalysis.test.tsx`
- **Approach:** per KTD1 and KTD2. Remove the subject block for the class and any `owl:Axiom` / `[] a owl:Axiom` block whose `owl:annotatedSource` is the class. Preserve the prefixes, the surrounding blank-line structure and every other block byte-for-byte. Keep the optimistic tree removal, and restore it with `loadRootClasses()` on failure, as today. Remove the delete-route mock from the integration fixture, and assert a PUT to `/source` carrying `base_revision` and the commit message.
- **Test scenarios:**
  - The remover handles full-IRI, prefixed and `:local` subjects.
  - Multiple axiom blocks are removed.
  - The class is the last block in the file.
  - The class is absent, which is a no-op that returns the source unchanged.
  - A sibling whose IRI shares a prefix (`:Foo` vs `:FooBar`) is untouched.
  - An altLabel-rich fixture is removed completely (AE1).
  - An editor-route integration test: delete issues exactly one PUT `/source`, and the deleted IRI is absent from its body (AE1).
  - A conflict response restores the tree node (AE2).
  - `DeleteImpactAnalysis`: `total: 0` calls `onAcknowledge(true)`.
  - The alea#54 test is deterministic: run the file 20 times under coverage, and all pass.
- **Verification:** `npx vitest run __tests__/lib/ontology/turtleClassRemover.test.ts __tests__/app/editor-actions.integration.test.tsx __tests__/lib/api/client.test.ts __tests__/components/editor`, then `npx tsc --noEmit`, then `npx eslint` on the touched files. Finally `grep -rn "deleteClass\|ontology/classes/.*DELETE" app components lib` shows no production call.

### U2. Individual saves keep undescribed predicates

- **Goal:** close the #361 residual for individuals.
- **Requirements:** R6.
- **Files (owned):**
  - `lib/ontology/turtleIndividualUpdater.ts`
  - `__tests__/lib/ontology/turtleIndividualUpdater.test.ts`
  - `__tests__/lib/ontology/turtleIndividualUpdater.integration.test.ts`
- **Approach:** mirror `updateClassInTurtle` and `updatePropertyInTurtle`. Parse the existing block with `parseExistingTurtleBlock`, compute which predicate forms the payload describes, and carry the rest verbatim into the regenerated block. Prune `owl:Axiom` blocks only for literals the payload deleted, as the class updater does. Read-only use of `turtleUtils.ts`; if a helper change is needed, report it rather than editing a shared file.
- **Test scenarios:**
  - altLabel in many languages survives a label edit (AE3).
  - An unknown custom predicate survives.
  - A predicate the payload does describe is replaced, not duplicated.
  - Prefixed and full IRI subject forms both work.
  - A blank-node object on a carried predicate survives.
  - The round trip is idempotent: saving twice is byte-identical.
- **Verification:** `npx vitest run __tests__/lib/ontology`, then `npx tsc --noEmit`.

### U3. Diagnostics umask fix and e2e unit suites in PR CI

- **Goal:** alea#58 fixed, and the hermetic node suites gating PRs.
- **Requirements:** R8, R9.
- **Files (owned):**
  - `scripts/e2e/diagnostics.test.mjs`
  - `.github/workflows/release.yml` (new `e2e-unit` job only)
  - any `scripts/e2e/*.test.mjs` that fails under umask 077 and needs an explicit mode
- **Approach:** add `chmod(unsafe, 0o755)` after the `mkdir`. Run each of `test:e2e:ownership`, `test:e2e:profiles`, `test:e2e:evidence` and `test:e2e:identity` locally under `umask 077` and `umask 022`. Add every suite that is hermetic (no docker, browser or network) to the job. Pin actions by SHA, as the existing jobs do.
- **Test scenarios:** each suite passes under both umasks, and diagnostics fails before the fix under 077.
- **Verification:** `bash -c 'umask 077; npm run test:e2e:ownership && npm run test:e2e:profiles && npm run test:e2e:evidence && npm run test:e2e:identity'`, and the same under 022. `actionlint` if it is available.

## Verification Contract

- `npx vitest run` passes in full, with at least the 5,405 tests of the baseline, and `npx tsc --noEmit` is clean.
- `npx eslint .` shows 0 errors and no new warnings beyond the baseline 21.
- The hermetic e2e suites pass under umask 077.
- PR CI (`release.yml`: lint, type-check, test, build, docker jobs and the new `e2e-unit`) is green before merge.
- UAT: a local editor session against a local API deletes a synthetic class, and the resulting commit is inspected.

## Definition of Done

- Every R is covered by a test that fails without its fix.
- No production code path calls a project-scoped class DELETE or PATCH.
- Abandoned-attempt code is removed from the diff.
- Each fixed alea issue (#56, #54, #58) is closed with a comment that names the PR.
