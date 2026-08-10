---
title: "Intent #2 (N-Day Auto-Accept) — Closure Audit"
status: satisfied-pending-merge
audit_source: ce-brainstorm
date: 2026-08-09
---

# Intent #2 — N-Day Auto-Accept — Closure Audit

## Origin

One of five intents in Damien's raw outlines that dropped during consolidation
(never reached the plan or the build) — found by U6 lens-2 at the 2026-08-08
Phase A gate. Original ask (`docs/roundup-2026-08/outlines/2026-07-24-feature-build.md:27-31`,
quoted in `docs/residual-review-findings/u6-lens2.md:65`):

> User-configurable N-day acceptance — edits/PRs "accepted after N days (user
> configurable)."

Damien's ruling on all five ([[project_five_dropped_intents_brainstorm]]):
run the full `ce-brainstorm` → `ce-plan` process, live, whenever it makes sense.

## What this session found

This session opened a live `ce-brainstorm` for intent #2 with a settled framing
(trusted-human suggestions only, per-project admin setting for N, extends the
Phase A trust ladder). Before any requirements dialogue could produce something
new, the Phase 1.1 grounding scout discovered the feature **already exists,
built end-to-end**, on the `feat/translations` branch of both repos — landed
in the same branch/PR batch as the translations feature
(`alea-institute/ontokit-api#12` + `ontokit-web#12`, open, peer review pending),
but **not scoped to translations**.

**Scope check (raised by Damien, verified in code):** the mechanism lives on
`SuggestionSession` (`suggestion_service.py:472` — one generic constructor
used for every suggester edit: class additions, annotation edits, relationship
changes, anything made through the "suggester" role's PR workflow), so it
already covers ALL general edits/PRs, not a translation-specific slice.
Translations run on a **separate, unrelated pipeline** —
`TranslationReviewService` (`translation_review.py`) confirms/rejects
individual `TranslationRecord` literals via native-speaker review and commits
directly; it has no `auto_accept`/`quiet_days` field or `SuggestionSession`
reference anywhere (grepped clean). Damien confirmed this exclusion is
correct as scoped: the original outline's "edits/PRs" maps to the general
suggestion workflow (already built); translation confirm/reject is a distinct
identity-verification concern intentionally left out of the timer-based
auto-accept, not a gap to close.

Every mechanics answer given live in this session (N-day timer as an AND-gate
on top of trust-tier eligibility, not an OR/replacement; silent viewing does
not pause the clock, only an explicit reviewer objection halts it; N is a
single per-project value, not per-tier) matches the shipped implementation
exactly — confirming the dropped intent's original shape survived independently,
not that this session invented requirements the code happens to satisfy.

## Requirement → implementation mapping

| Original requirement | Shipped evidence (repo/branch/file:line) |
|---|---|
| N is user-configurable, per project | `ontokit-api@feat/translations` `ontokit/models/project.py:60-65` — `auto_accept_quiet_days: int`, default 7, server_default `"7"` |
| Auto-accept can be turned on/off | Same file — `auto_accept_enabled: bool`, default `False` ("OFF by default (KTD8)") |
| Edits/PRs accepted after N days | `suggestion_service.py:1073-1092` `_schedule_auto_accept` sets `session.auto_accept_after = now + timedelta(days=quiet_days)`; `:1922-1950` `auto_accept_ripe_sessions` merges sessions where `auto_accept_after <= now` |
| Restricted to trusted human submissions | `trust_service.py:248-265` `is_auto_accept_eligible` requires tier == `TRUSTED`; `auto_accept_ripe_sessions` predicate excludes anonymous and LLM-generated submissions; `trust_service.py` docstring: "LLM output never auto-accepts, at any tier, ever (R13)" |
| Reviewer can stop the clock | `suggestion_service.py:1068-1071` `_halt_auto_accept` — "Stop the quiet-period clock because a reviewer objected (R12)"; a resolved objection restarts the clock from zero (KTD11) |
| Admin-configurable via project settings | `ontokit-api@feat/translations` `ontokit/api/routes/trust.py:123-172` — `GET/PATCH /{project_id}/trust/settings`, owner/admin-gated, audit-logged on flip; `ontokit-web@feat/translations` `components/projects/TrustLadderSection.tsx:153-174` — live "Quiet period (days)" input, 1-90 range, disabled unless auto-accept is enabled |

Full grounding dossier (verbatim quotes, all pointers): `/tmp/compound-engineering-1000/ce-brainstorm/intent2-auto-accept-2026-08-09/grounding.md` (ephemeral scratch — durable facts are captured in the table above).

## Also verified in passing

The 2026-08-08 review's P0-4 finding (failed PR merges recorded as successful,
minting trust credit on a swallowed error) is fixed on the current
`feat/translations` checkout — not confined to `feat/pr-party` as the review
implied — via commits `b6b27748` and `a48b211f`.
`suggestion_service.py:1218-1265` `_approve_unchecked` (the sole merge path
for both human review and auto-accept) no longer swallows merge errors.

## Status

**Satisfied, pending merge.** The mechanism, config surface, and admin UI are
built and match the original intent. Nothing further needs to be planned or
built. What remains is operational, not product-scoping:

- `feat/translations` (API + web) has not merged to `main` yet — this
  session's checkout (`feat/roundup-brainstorm`) has zero trust/auto-accept UI
  files (`git ls-tree` confirms). Auto-accept is unavailable to real users
  until that PR lands.
- No dedicated UAT pass has exercised the quiet-period clock (halt/resume,
  N-day elapse, TRUSTED-tier gating) end-to-end — worth a checklist item once
  `feat/translations` merges, alongside the rest of that PR's review.
- Per [[project_five_dropped_intents_brainstorm]], intent #3 ("then-current
  credentials" submission metadata) touches the same `SuggestionSession`→PR
  path but a different concern (identity recorded at submit time vs. this
  merge-timing clock) — no shared field or function; the two remain
  independent brainstorms.
- Translations are deliberately out of scope (see scope check above) — not a
  residual gap. If that changes later, it is new work (extend
  `TranslationReviewService`/`TranslationRecord` with an equivalent quiet-day
  clock, halt-on-objection, and trust-tier gate), not a correction to this
  closure.

## Recommendation

Mark intent #2 done in tracking (memory, on-deck) with this audit as the
record of why no new plan was written. Re-open only if `feat/translations`
peer review surfaces a functional gap against the mapping table above.
