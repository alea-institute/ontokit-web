# Handoff — DEV is sound; PROD is gated on two human decisions

**Date:** 2026-08-15 · **Repos:** ontokit-web + ontokit-api · **For:** the next session picking up
OntoKit after a three-bug build day.

**Decision Sheet:** ask `ontokit-web-2026-08-15-1500-prod-gate-and-next` (four questions). Read
`briefs/qa-state.json` by (stem, qid) before re-asking Damien anything.

## Situation in one paragraph

DEV is fixed and verified. Three bugs shipped today: two from the U7 persona sweep, plus a
data-loss bug found while verifying them that was worse than either. Everything still open is
either Damien's decision or blocked on Mike Bommarito's AWS access. **No engineering work is
blocked.**

## What shipped, with evidence

All three are merged on the ALEA fork, deployed to DEV, and verified against **running
containers** — never the `ontokit-deploy status` verb, which reads git HEAD rather than the
running images and will report a deploy that never rebuilt (see CatholicOS/ontokit-api#211).

- **CatholicOS/ontokit-web#344** — federated logout dead-ended at `localhost`.
  `NEXT_PUBLIC_ZITADEL_ISSUER` was set nowhere, so a fallback shipped into the client bundle.
  Now derived in `next.config.ts` from the build-time `ZITADEL_ISSUER`, fallback removed, missing
  issuer fails loudly. *Proof:* the live bundle builds the real Zitadel `end_session` URL.
- **CatholicOS/ontokit-web#345** — suggester saves created a session but never wrote content.
  The issue's own hypothesis (`useAutoSave`/`flushToGit`) was **wrong**. Real cause: a stale
  closure — `saveToSession` was a `useCallback` closed over the `sessionId` state, called
  immediately after `startSession()` set it, so it hit its guard and skipped the PUT **silently**
  while the success toast fired anyway. Fixed in all three handlers (class, property, individual);
  the issue named only the class one. *Proof:* the network log now shows `POST sessions 201` then
  `PUT …/save`, and commits land.
- **CatholicOS/ontokit-web#361** — **data loss.** Saving any class destroyed every
  `skos:altLabel`, `skos:prefLabel`, `dcterms:title` and `dc:title` on it. One observed edit
  deleted 13 synonyms across nine languages while the user changed a single comment. Two causes,
  one per repo — see below.

### #361's two causes, because the pattern matters more than the fix

**ontokit-api** (`ontokit/services/ontology_index.py`, `get_class_detail`): two queries meant to
be complements were not. The labels query returned only `rdfs:label`; the annotations query
excluded **all** of `LABEL_PROPERTIES` — five entries — on the comment *"already returned via
IndexedLabel"*, true for exactly one of them. The other four fell through both and vanished.

**Only the indexed path** was affected; the RDFLib fallback iterates `ANNOTATION_PROPERTIES`,
which includes them, and was correct. **So cold-start tests pass and a warm index loses data.**
That asymmetry is why it survived until someone drove the real UI.

**ontokit-web** (`lib/ontology/turtleClassUpdater.ts`): `genBlock` regenerated the class block
from the payload, so anything absent from the payload was destroyed. The API fired the gun; this
loaded it. Now round-trip safe — predicates the payload does not describe are carried through
verbatim, with a Turtle-aware scanner handling quoted literals, long strings, escapes and IRI refs.

*Proof:* signed in as the UAT suggester on DEV, edited one comment on the real `Actor / Player`
class; the commit preserved all 13 `altLabel` values across 10 language tags byte-identical,
including the Hebrew, Hindi, Japanese and Chinese scripts. The identical action before the fix
produced `5 insertions(+), 16 deletions(-)`.

## What is open — nothing blocks engineering

**Damien's, in the Decision Sheet:**

1. **PROD promotion mechanism.** He chose "promote the main line to PROD (auth-on)" and asked
   whether that is best practice. Answer given: the principle is right — a long-lived
   `feature/folio-adapter` serving PROD for three months is the anti-pattern — but **in-place is
   the wrong execution**. PROD is an auth-free public FOLIO browser on bare metal; the main line
   needs nine services and a probable instance upsize, and promotion puts a sign-in wall in front
   of a public site on day one. **Recommended: parallel stand-up on its own hostname, UAT there,
   then DNS cutover.** Nothing PROD-side has been built pending his call.
2. **Mike's access.** One security-group rule opening SSH from the home box's egress IP to the
   AWS PROD instance. Re-validated 2026-08-15: still closed, and no AWS credentials exist locally.
   The IP is residential and will rotate, so a scoped Route 53 + EC2 IAM key is the durable fix.
3. **What to build while blocked** — persona sweeps, the PROD deploy workflow, the follow-up
   queue, or upstream delivery.
4. **Upstream delivery.** ~690 commits sit on the ALEA fork with zero CatholicOS-org PRs, and
   every fix widens the gap. Needs human review capacity, so it is a scheduling decision.

**Filed follow-ups, none blocking:**

- **CatholicOS/ontokit-api#212** — the indexed and RDFLib paths still diverge for predicates
  outside `ANNOTATION_PROPERTIES` (e.g. `skos:related`). Same shape as #361, lower severity now
  that a missing predicate degrades to a display gap rather than data loss.
- **CatholicOS/ontokit-web#359** — Node v25's incomplete experimental `localStorage` fails 46
  autosave tests on a clean checkout. Run the suite with
  `NODE_OPTIONS=--no-experimental-webstorage` until fixed.
- **CatholicOS/ontokit-web#360** — `auth.ts` still carries the same silent localhost fallback
  that caused #344. Latent, not live.
- **Cosmetic Turtle churn** (noted on #361, not separately filed): `altLabel` re-serializes to
  one predicate per line and `rdfs:label` gains an unrequested `@en`. No data loss; deliberately
  not risked against the fix.

## Norms this day established — worth keeping

- **Verify a deploy by container uptime and image build time.** The `status` verb reads git HEAD,
  not running images, and reported success for a deploy that never rebuilt.
- **`ssh … | tail` masks the exit code.** A failing deploy returned 0 that way.
- **A worker's report is a claim.** One Codex run reported committing work it had not committed —
  the code was real, the commits were not. Another wrote a correct fix but died before reporting,
  and a missing report file was briefly mistaken for no work. **Check `git status` and rerun the
  tests yourself.** Red-then-green was independently reproduced on both halves of #361 by
  reverting only the source and watching the tests fail.
- **Dispatch heavy workers serially.** Two concurrent Codex workers plus two `--no-cache` Docker
  builds exhausted the home box's RAM and killed the shell for the rest of that session. Root
  cause and recovery: `docs/solutions/conventions/tmpfs-is-ram-a-cache-in-tmp-costs-memory-not-disk.md`.
- **The empty-tree trap:** the editor shows 0 classes until a branch resolves. Load it with an
  explicit `?branch=` before concluding the data is missing.

## Where things live

- Plan: `docs/plans/2026-08-13-002-fix-annotation-data-loss-plan.md`
- Learnings: `docs/solutions/conventions/` — the tmpfs outage, and validate-before-mutate.
- DEV runbook and UAT log: `docs/roundup-2026-08/`
- UAT persona credentials: locations are in the private handoff, never in this repo. Passwords are
  throwaway and rotated after use; mint new ones through the Zitadel management API.

## Retire this handoff when

The PROD mechanism is chosen and executed (or explicitly deferred), and Mike's access has either
landed or been formally abandoned. The receiving session retires it and names what absorbed it.
