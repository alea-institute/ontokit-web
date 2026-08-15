---
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
execution: code
product_contract_source: ce-plan-bootstrap
title: "fix: class saves silently destroy skos:altLabel, prefLabel, and title properties"
date: 2026-08-13
type: fix
issue: CatholicOS/ontokit-web#361
branch: fix/annotation-data-loss
base: origin/feat/pr-party
repos: [ontokit-api, ontokit-web]
---

# fix: class saves silently destroy `skos:altLabel`, `prefLabel`, and title properties

## Goal Capsule

Editing any field on a class currently deletes every `skos:altLabel`, `skos:prefLabel`,
`dcterms:title`, and `dc:title` value on that class — including all translations. One
observed edit destroyed 13 values across nine languages. Close the hole in the API that
drops them, and make the web-side turtle writer incapable of destroying data it was never
told about.

Both halves ship together. Either alone leaves the product broken or fragile.

---

## Problem Frame

A suggester edited one comment on `Actor / Player` (FOLIO DEV). The resulting commit was
`5 insertions(+), 16 deletions(-)`: all 13 `skos:altLabel` values — German, Spanish (es-es,
es-mx), French, Hebrew, Hindi, Japanese, Portuguese, Chinese, en-GB, plus three English
synonyms — were gone.

This is pre-existing and role-independent. It was invisible for suggesters only because
their saves never completed (that was #345, fixed in alea-institute/ontokit-web#18).
Editors have been silently losing this data.

### Root cause — ontokit-api

`ontokit/services/ontology_index.py`, `get_class_detail`. Two queries were meant to be
complements and are not:

- **labels** returns only `rdfs:label`:
  `select(IndexedLabel).where(..., IndexedLabel.property_iri == rdfs_label_iri)`
- **annotations** excludes **all** of `LABEL_PROPERTIES`, commented *"already returned via
  IndexedLabel"*:
  `label_property_iris = {str(uri) for _, uri in LABEL_PROPERTIES}` → `excluded_iris`

`LABEL_PROPERTIES` (line 61) holds five entries: `rdfs:label`, `skos:prefLabel`,
`skos:altLabel`, `dcterms:title`, `dc:title`. The "already returned" claim is true only for
`rdfs:label`. **The other four are excluded from `annotations` and never added to `labels`,
so they fall through both and vanish.**

Critically this is **only the indexed path**. The RDFLib fallback in
`ontokit/services/ontology.py` (`_class_to_response`) iterates `ANNOTATION_PROPERTIES`,
which does include `skos:altLabel`/`prefLabel`/`hiddenLabel`, and returns them correctly.
So the bug appears **only when the index is warm** — i.e. exactly for real users, and not
in cold-start tests. That asymmetry is why it survived until now.

### Root cause — ontokit-web

`lib/ontology/turtleClassUpdater.ts`, `genBlock` + `updateClassInTurtle`. The class block
is **regenerated from the payload**, not edited in place. Every predicate absent from the
payload is destroyed. The API omission is what fired the gun, but this is what loaded it:
any future omission does the same damage.

---

## Requirements

- **R1** — The class-detail response must include `skos:altLabel`, `skos:prefLabel`,
  `dcterms:title`, and `dc:title` when present on the class.
- **R2** — The indexed path and the RDFLib fallback must return the same predicate set for
  the same class. A response must not depend on whether the index is warm.
- **R3** — The exclusion set and inclusion set must derive from a **single** definition, so
  they cannot silently drift apart again. Two hand-maintained lists that must be complements
  is the defect itself, not an incidental detail.
- **R4** — Saving a class must preserve every predicate present in the source block that the
  payload does not describe.
- **R5** — Editing one field must leave all other predicates byte-identical in the diff.
- **R6** — Each fix carries a regression test that fails before it and passes after.

---

## Key Technical Decisions

### KTD1 — Fix the API by deriving the exclusion set from what `labels` actually returns

The cleanest correction is to stop excluding properties the labels query does not in fact
return. Define the excluded set as exactly `{rdfs:label, rdfs:comment}` — the two the
response genuinely carries elsewhere — rather than the whole `LABEL_PROPERTIES` list.
`LABEL_PROPERTIES` keeps its real job (driving label *resolution* and preference ordering);
it stops doubling as an exclusion list it was never suited for.

Rejected: returning all five in `labels`. That changes the meaning of `labels` for every
consumer and would put alternate labels where clients expect the display label.

### KTD2 — Make the turtle writer preserve unknown predicates

`updateClassInTurtle` must carry forward predicate–object pairs found in the existing block
whose predicates the payload does not describe. The payload keeps authority over what it
does describe (labels, comments, parents, the annotations it carries); everything else is
passed through untouched.

This is the durable half of the fix. It converts "the API forgot a predicate" from data loss
into a display gap.

### KTD3 — Cross-path parity test is the real regression guard

The specific bug is one line; the *class* of bug is two code paths that are supposed to agree
and silently do not. A test asserting the indexed and RDFLib paths return identical predicate
sets for the same fixture is what actually prevents recurrence.

---

## Implementation Units

### U1. (api) Stop dropping non-`rdfs:label` label properties

**Goal:** The indexed class-detail response carries all four currently-lost properties.
**Requirements:** R1, R3
**Files:**
- `ontokit/services/ontology_index.py`
- `tests/` — the suite covering `get_class_detail`

**Approach:**
1. In `get_class_detail`, replace the `LABEL_PROPERTIES`-derived exclusion with an explicit
   set of exactly the properties the response returns elsewhere: `rdfs:label` and
   `rdfs:comment`.
2. Name that set once, adjacent to the labels and comments queries that justify it, with a
   comment stating the invariant: *excluded here ⇔ returned elsewhere in this response.*
3. Leave `LABEL_PROPERTIES` itself unchanged — it is correct for label resolution.

**Execution note:** write the failing test first — index a class carrying `skos:altLabel`
with several language tags and assert they appear in the response.

**Test scenarios:**
- A class with `skos:altLabel` in 3+ languages returns all of them, with language tags intact.
- A class with `skos:prefLabel` returns it.
- A class with `dcterms:title` / `dc:title` returns them.
- `rdfs:label` still appears in `labels` and **not** duplicated into `annotations`.
- `rdfs:comment` still appears in `comments` and not duplicated into `annotations`.

### U2. (api) Parity test between the indexed and RDFLib paths

**Goal:** The two paths cannot silently diverge again.
**Requirements:** R2, R3
**Dependencies:** U1
**Files:** `tests/` — a new parity test

**Approach:** For a fixture class exercising labels, comments, altLabels in several
languages, definition, and a URI-valued annotation, fetch the detail via the indexed path
and via the RDFLib fallback and assert the **predicate sets and values match**. Compare as
sets so ordering is not asserted.

**Test scenarios:**
- Predicate sets are equal between paths.
- Per-predicate value sets (value + lang) are equal.
- The test fails if a property is added to the exclusion set without being returned elsewhere.

### U3. (web) Make `updateClassInTurtle` round-trip safe

**Goal:** Saving cannot destroy predicates the payload never mentioned.
**Requirements:** R4, R5
**Files:**
- `lib/ontology/turtleClassUpdater.ts`
- `__tests__/lib/ontology/turtleClassUpdater.test.ts`

**Approach:**
1. When rebuilding a class block, parse the predicate–object pairs already present.
2. Partition them: predicates the payload describes (payload wins) versus predicates it does
   not (carry through verbatim).
3. Emit carried-through pairs in the regenerated block, preserving language tags, datatypes,
   and multi-value lists.
4. Keep the existing deletion semantics for predicates the payload **does** describe — an
   emptied field must still delete, or the editor stops being able to remove values.

**Execution note:** test-first. The red test is "edit the label; altLabels survive".

**Test scenarios:**
- Class with 13 `skos:altLabel` values across 9 languages: editing only the label leaves all 13 intact with tags.
- A predicate the payload *does* describe, emptied, is still removed (deletion is not broken).
- Datatyped literals and URI-valued objects survive round-trip.
- A class with no extra predicates is byte-identical to today's output (no gratuitous churn).
- Editing one field changes only that field's lines in the diff.

### U4. (web) Reduce serialization churn

**Goal:** Diffs show what changed, not how it was re-serialized.
**Requirements:** R5
**Dependencies:** U3
**Files:** `lib/ontology/turtleClassUpdater.ts`, its test file

**Approach:** The observed diff also flipped `<Rxxx>` to `:Rxxx` and added an unrequested
`@en` to `rdfs:label`. Preserve the subject's original IRI serialization form, and do not
add a language tag the user did not supply.

**Test scenarios:**
- A subject written as `<Rxxx>` stays `<Rxxx>`; one written as `:Rxxx` stays `:Rxxx`.
- A label with no language tag does not acquire one.
- A label with an explicit tag keeps it.

**Note:** if this proves entangled with `genBlock`'s structure, land U3 alone and split U4
out — data loss is the blocker, churn is cosmetic.

---

## Scope Boundaries

**In scope:** the API omission, the web-side preservation, parity and regression tests, the
serialization churn in U4.

### Deferred to Follow-Up Work
- Surfacing a "Synonym(s)" editor in `ClassDetailPanel` so users can *edit* altLabels. The
  property is already registered in `lib/ontology/annotationProperties.ts:58` with an icon;
  once U1 returns the data it will render read-through, but full editing is its own change.
- Auditing other entity types (properties, individuals) for the same regenerate-from-payload
  hazard. Likely present; out of scope here.

**Out of scope:** PROD promotion, anything gated on AWS access.

---

## Risks & Dependencies

- **U3 could over-preserve.** If it carries through a predicate the payload legitimately
  cleared, deletion silently stops working — the mirror-image bug. The deletion scenario in
  U3's tests is the guard and must not be dropped.
- **U1 could double-report.** If the exclusion set is loosened too far, `rdfs:label` appears
  in both `labels` and `annotations` and clients render it twice. Covered by U1's tests.
- **Cross-repo ordering.** U3 is independently valuable and safe to land first; U1 without
  U3 still leaves the writer fragile. Land both before deploying.

---

## Verification Contract

1. **api:** its test suite green; new tests demonstrated red first.
2. **web:** `npm run lint` (0 errors), `npm run type-check` (exit 0), `npm run test` green.
   Run tests with `NODE_OPTIONS=--no-experimental-webstorage` — see CatholicOS/ontokit-web#359;
   without it, 46 unrelated autosave tests fail on Node v25's incomplete `localStorage`.
3. **End-to-end on DEV, signed in as `uat-suggester`** (password at
   `~/.config/ontokit-dev/uat-suggester`, mode 600): edit one comment on a class carrying
   altLabels, save, and assert the resulting commit diff touches **only** that comment.
4. Deploy verified by container uptime and image build time, never the `ontokit-deploy
   status` verb (CatholicOS/ontokit-api#211).

## Definition of Done

- All four properties returned by the indexed path, with parity against RDFLib proven by test.
- Editing one field on the real DEV `Actor / Player` class leaves its 13 altLabels intact.
- Regression tests red-then-green in both repos.
- Deployed to DEV and verified against running containers.
- #361 updated with the evidence.
