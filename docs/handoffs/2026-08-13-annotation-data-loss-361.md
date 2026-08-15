# Handoff — #361 annotation data loss: planned, dispatched, NOT implemented

**Date:** 2026-08-13 · **Repos:** ontokit-web + ontokit-api · **Written by:** a session whose
shell died mid-task. **Nothing in the #361 fix is implemented.** Read the "State" section
before assuming anything.

## Why this exists

The session completed the U7 sweep bugs, then found a worse bug during UAT, planned the fix,
dispatched it to Codex — and its Bash tool began returning exit 1 on every command, including
`echo` and `true`. Both Codex dispatches failed as a result (they need a shell). File reads
and writes still worked, which is how this file exists.

## DONE and durable — do not redo

- **CatholicOS/ontokit-web#344** (federated logout dead-ended at localhost) and **#345**
  (suggester saves silently dropped) are **fixed, merged, deployed, and UAT-verified live**.
  - Merged as `alea-institute/ontokit-web#18` into `feat/pr-party`.
  - DEV runs **api `6bec76ae32b753ebecfa412b0eebaa6a04287d53`** + **web `a4f950117f2f03487874c61053bff9b9dd83b569`**.
  - #344 proof: the live client bundle builds `https://ontokit-auth.dev.openlegalstandard.org/oidc/v1/end_session`.
  - #345 proof: network log showed `POST …/suggestions/sessions [201]` **then** `PUT …/sessions/s_03c6aae58a51acea/save` — the PUT that never fired before — and commit `e8b6c8d` landed on the suggester branch, authored `UAT suggester`.
- **Issues filed:** #359 (Node v25 `localStorage` fails 46 tests on a clean checkout),
  #360 (latent `auth.ts` localhost fallback), #361 (this data loss, with exact root cause in a comment).
- **Learning captured:** `docs/solutions/conventions/validate-before-mutate-or-your-failure-reports-success.md`.
- **UAT credential:** `uat-suggester` password at `~/.config/ontokit-dev/uat-suggester` (mode 600), rotated after use. Users `uat-editor` / `uat-admin` exist; set their passwords the same way (Zitadel v2 API, `POST /v2/users/{id}/password`, service token in `/opt/ontokit/.env`).

## NOT done — this is the work

**CatholicOS/ontokit-web#361 — saving a class silently destroys `skos:altLabel`,
`skos:prefLabel`, `dcterms:title`, and `dc:title`.** One observed edit destroyed 13 values
across nine languages. Fix it before any PROD promotion; it directly undercuts the
translations feature.

**Plan (implementation-ready, four units):**
`docs/plans/2026-08-13-002-fix-annotation-data-loss-plan.md` — currently only in the worktree
`~/worktrees/ontokit-web-dataloss`, **uncommitted**. Recover it from there, or rewrite from
the root cause below.

### Root cause, already fully confirmed

**ontokit-api** — `ontokit/services/ontology_index.py`, `get_class_detail` (~line 577). Two
queries meant to be complements are not:

- the **labels** query returns only `rdfs:label`;
- the **annotations** query excludes **all** of `LABEL_PROPERTIES` (line 61: `rdfs:label`,
  `skos:prefLabel`, `skos:altLabel`, `dcterms:title`, `dc:title`), commented *"already
  returned via IndexedLabel"* — true only for `rdfs:label`.

So four properties are excluded from `annotations` and never added to `labels`, and vanish.
**Only the indexed path is affected** — the RDFLib fallback (`ontokit/services/ontology.py`,
`_class_to_response`) iterates `ANNOTATION_PROPERTIES`, which includes them, and is correct.
That asymmetry is why this survived testing: cold-start passes, warm index loses data.

**ontokit-web** — `lib/ontology/turtleClassUpdater.ts`. `genBlock` regenerates the class block
from the payload, so any predicate absent from the payload is destroyed. The API omission
fired the gun; this loaded it.

### Both halves are required

1. **api:** make the exclusion set exactly `{rdfs:label, rdfs:comment}` — the properties this
   response genuinely returns elsewhere — defined in one place so the two lists cannot drift
   apart again. Add a **parity test** asserting the indexed and RDFLib paths return identical
   predicate sets for the same fixture; that test, not the one-line fix, is the real guard.
2. **web:** make `updateClassInTurtle` round-trip safe — carry through predicates the payload
   does not describe. **Do not break deletion**: a payload-described predicate that is emptied
   must still be removed. That is the mirror-image bug; keep an explicit test for it.

Also worth cleaning while in there: the save flips `<Rxxx>` to `:Rxxx` and adds an unrequested
`@en` to `rdfs:label`, both pure diff churn.

## State of the tree

- Worktrees `~/worktrees/ontokit-web-dataloss` and `~/worktrees/ontokit-api-dataloss` exist on
  branch `fix/annotation-data-loss`, both based on their repo's `feat/pr-party`. **Neither
  contains any implementation** — both Codex workers failed before doing work. The web worktree
  holds only the uncommitted plan doc. Remove both worktrees if starting fresh.
- The main `ontokit-web` checkout is on `feat/roundup-brainstorm`, which does **not** show the
  merged `feat/pr-party` state.

## Environment problem to resolve first — DIAGNOSED, fix is one command

Bash returned exit 1 on every command (including `echo` and `true`) while file I/O kept
working. That split means **process creation failed while the filesystem was fine** — the
signature of `fork()` unable to get memory.

**Root cause, confirmed:** `/tmp` on the home box is a **tmpfs**, i.e. RAM. It held **25G of
31G**, of which **24G was `/tmp/ontokit-uv-cache-full`** — a `uv` package cache pointed at
`/tmp`. That is 24 GB of memory, not disk. `free -h` corroborated it exactly: `shared 22Gi`,
and swap **93% consumed** (7.4 of 8.0 GiB). Disk was never the problem (110G free on `/`,
76%), and neither was the process limit (696 processes against `ulimit -u` 250,264).

**Recovery:**

```
rm -rf /tmp/ontokit-uv-cache-full /tmp/pytest-of-damienriehl /tmp/node-compile-cache
sudo swapoff -a && sudo swapon -a
```

**Prevention:** find whatever sets `UV_CACHE_DIR=/tmp/ontokit-uv-cache-full` (likely an
ontokit-api CI-parity full-dependency install) and repoint it to `~/.cache/uv`. Full writeup:
`docs/solutions/conventions/tmpfs-is-ram-a-cache-in-tmp-costs-memory-not-disk.md`.

**Contributing factor — do not repeat:** the two Codex workers were dispatched **in parallel**
on a box already 43 GiB into RAM after two `--no-cache` Docker builds. **Re-dispatch the two
halves of #361 serially**, not concurrently.

## Verification norms this session established

- **Verify a deploy by container uptime + image build time, never `ontokit-deploy status`** —
  it reads git HEAD, not running images, and reported success for a deploy that never rebuilt
  (CatholicOS/ontokit-api#211).
- **`ssh … | tail` masks the real exit code.** A failing deploy returned 0 that way.
- **Run the web suite with `NODE_OPTIONS=--no-experimental-webstorage`** or 46 unrelated
  autosave tests fail on Node v25 (#359).
- **A worker's report is a claim.** This session's one successful Codex run reported committing
  work it had not committed; the code was real, the commits were not. Check `git status` and
  rerun the tests yourself.

## Retire this handoff when

#361 is fixed in both repos, deployed to DEV, and verified end-to-end by editing one comment on
the real DEV `Actor / Player` class and confirming its 13 `altLabel` values survive.
