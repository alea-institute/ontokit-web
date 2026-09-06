# OntoKit DEV — Authenticated UAT Runbook for web #27

Prepared 2026-09-06. **Document only: no execution receipt is implied.** This is
U8/R8's ordered procedure for U10 to exercise the five acceptance rows of ALEA
ontokit-web#27, capture comparable evidence, and remove its throwaway state.

## Purpose, preconditions, and boundary

Before step S01, the operator must record affirmative B1 (manifest-driven DEV
deployment approval) and B5 (agent-driven authenticated UAT with throwaway DEV
state) answers and their Cockpit receipt references. An unanswered, provisional,
or negative answer does not authorize execution. DEV must already run the manifest
pair verified by U9's deployment receipt. The operator must name both full deployed
API and web SHAs from that receipt in the environment block before step S01; old
SHAs in the historical log and local Git HEAD are not deployed-revision proof.

Environment: `https://ontokit.dev.openlegalstandard.org`; authenticated DEV with
anonymous browsing/suggestions available (`AUTH_MODE=optional`). Record the actual
mode, U9 receipt date, manifest reference, and both SHAs. If these disagree, stop
before creating state and return the discrepancy to the controller.

This procedure permits only the approved DEV application UAT and its cleanup. No
deployment, infrastructure operation, AWS, DNS, PROD, or CatholicOS change is part
of it. Use the public application UI and its existing application workflows. Do
not connect a project to an external repository. Missing capabilities, expired
access, or a required infrastructure repair are blockers for the execution owner,
not invitations to improvise a workaround.

**Timing constraint:** the supported quiet period is 1–90 days, default 7. Its
minimum is one real day, not one minute. This procedure is one ordered run, but
full live proof needs more than two days plus ordinary worker processing time:
observe a halted session past its original deadline, resolve it, then observe a
fresh full day. A short single sitting cannot prove this contract. Reserve that
execution window before S01, or record the timing blocker without creating state.
Do not backdate submissions, alter clocks, edit stored deadlines, force merges,
or lower the supported minimum. A shorter proof needs a separately authorized
mechanism outside this runbook.

## Source records and residuals

- [DEV operations runbook](DEV-RUNBOOK.md): environment, disposable persona roles,
  and known residuals. Historical access expiry and login issues require a current
  access check; this runbook does not renew access or run provisioning scripts.
- [Existing UAT log](DEV-UAT-LOG.md): dated entries, environment blocks, and
  `F<n> (P<sev>, state)` findings. Historical F-c/F-d closure is a baseline for
  logout/save regression checks, not proof on U9's deployed pair. Annotation
  preservation and serialization residuals inform the editor checks below.
- [Completion plan, U7](../plans/2026-08-20-0836-chore-recent-plan-completion-plan.md):
  four auto-accept scenarios, isolated projects, configuration snapshot/restore,
  eligibility check before shortening, and removal of only test-created state.
- [Auto-accept closure audit](../plans/2026-08-09-002-audit-intent2-auto-accept-closure.md):
  per-project clock and trusted-human eligibility. Translation review is a separate
  pipeline; confirming translations is not timer-based suggestion acceptance.
- [March plan, U8/U9/U10 and KTD9](../plans/2026-09-05-1153-chore-recent-plan-march-through-plan.md):
  document, deployed-pair receipt, gated execution, and private evidence discipline.

## Personas and isolated browser contexts

The logins live only in the session's private, machine-local handoff outside Git.
Use only the three disposable DEV accounts, identified here by role. A personal
or persistent administrator identity is prohibited. Never copy account names,
identity numbers, email addresses, or login material into this document or receipts.

| Matrix persona | Disposable account role | Project context and production of the persona |
| --- | --- | --- |
| Anonymous | None; signed-out context | Browse and suggest on the public throwaway project; no account is used. |
| Untrusted | The suggester persona | Admin verifies the project's non-trusted starting tier. Keep it non-trusted in the control project for the entire negative test. |
| Trusted | The suggester persona | Admin promotes its tier to `TRUSTED` through the main project's trust settings in TR03. Membership stays `suggester`; trust promotion is project-local. |
| Reviewer | The editor persona | Admin grants project membership `editor`; verify reviewer capabilities in TR04. This role, not a separate account, exercises objection and review. |
| Administrator | The admin persona | Disposable superadmin; creates projects, manages membership/trust/settings, and performs project cleanup. |

Create a fresh, private, temporary browser profile for each of the five matrix
personas, even though two use the same disposable account. Disable profile sync,
saved-login features, and automatic recording. Each profile is restricted to its
assigned project/tier context; never infer a tier from the profile label. The two
tabs in AS05 belong to the same untrusted profile. S01 records role labels only;
C03 revokes run-created sign-in sessions, clears browser state, and deletes every
profile. Do not persist, export, or attach authenticated browser profiles.

## Evidence and finding contract

During the later authorized execution, append a new dated entry to
`DEV-UAT-LOG.md`; leave historical observations intact. Use the heading pattern
`## YYYY-MM-DD — web #27 authenticated DEV acceptance`, followed by an
`Environment:` block containing the public application URL, mode, API SHA, web
SHA, manifest/U9 receipt reference, B1/B5 Cockpit references, run label, planned
deadline window, and role-only operator designation. Under it use
`### Environment verification`, `### Findings`, `### Pending`, and
`### Cleanup receipts`. Each defect gets the next unused
`#### F<n> (P<sev>, open) — <observed symptom>`; update its state only with a dated
recheck. Include the failing step, expected/actual behavior, and an ALEA defect
issue link when one exists. Issue filing follows the execution owner's authority;
otherwise record `none — not filed` and leave it pending. Do not mark web #27
accepted while any required observation or cleanup is outstanding.

Every observation, including setup, repeated timer observations, failures, and
cleanup, uses this exact ten-field shape. Split distinct observations into rows;
repeat the deployed pair on every row. Expected results below are not receipts.

| Date/time UTC | Step id | Persona role | URL | Deployed revision | Created state ids | Observed result | Pass/fail | Cleanup receipt id | Defect issue link if any |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `<YYYY-MM-DDTHH:mm:ssZ>` | `<step>` | `<matrix role / disposable role>` | `<sanitized application URL>` | `api=<full SHA>; web=<full SHA>` | `<application object ids or none>` | `<actual observation; evidence reference; timing if relevant>` | `<pass or fail>` | `<CR reference, pending C-step, or none>` | `<issue link or none>` |

Use application object ids for projects, ontology entities, suggestion sessions,
branches/PRs, jobs, translation records, and audit outcomes. **Suggestion sessions
are application content, not sign-in sessions.** Never record identity ids or
sign-in session identifiers. Browser state uses invented role-local ledger labels,
not filesystem locations. URLs may retain safe project/entity/branch navigation
parameters; remove authentication query strings, callback fragments, and personal
data. For precondition failures use the public application URL and explicitly
record an unavailable revision rather than inventing it.

Allocate a cleanup ledger entry when state is created; use `pending C01`,
`pending C02`, or `pending C03` until verified, then backfill its receipt reference.
Rows with no new state use `none` and may refer to an existing object's ledger in
Observed result. A blocked or unperformed check is `fail` with an explicit reason
and a Pending entry; elapsed time alone is never a pass. Keep only redacted
evidence and receipts as durable artifacts; they are not disposable test state.

### Redaction before capture and retention

Screenshots, exported HAR files, the UAT log, and any retained browser diagnostic
must contain no authentication secrets: no login answers, access/refresh/ID bearer
values, session authenticators, authorization headers, or HTTP state headers.
Never record sign-in or sign-out exchanges. Active authentication necessarily
uses transient private browser state; it must not survive the run or enter Git.

Crop or blur account menus, avatars with identifying text, email/name fields,
member identity columns, submitter/decider personal fields, login forms, address
bar authentication parameters, developer-tools headers/storage panes, and browser
profile labels containing personal information. Compare identity fields privately
and record only role, tier, origin, and match/mismatch. Preserve the non-personal
`system:auto-accept` decider in outcome evidence.

Prefer sanitized status summaries to HAR exports. If a HAR is necessary, produce
an allowlisted copy containing only safe application paths, methods, timings, and
status codes; omit request/response headers and bodies, authentication entries,
and unsafe query data. Review every retained image and file before attaching it;
delete raw captures and exports in C03. If a clean capture cannot be made, record
a redacted textual observation. Do not put raw diagnostics into the evidence log.

## Setup and throwaway state

Execute S01–S03, TR01–TR05, AS01–AS05, TA01–TA06, AX01–AX05,
AA01–AA10, then C01–C04, in order. On interruption or a blocker, stop creating
state and run C01–C04 for the state already created. If cleanup itself is blocked,
record the exact remaining object and responsible role in Pending; do not claim
it gone. Every later state-creating action includes its cleanup step below.

Use two project names: `YYYY-MM-DD-UAT-web27-<run-label>-main` and
`YYYY-MM-DD-UAT-web27-<run-label>-control`, with a non-personal unique run label.
The control project allows the same suggester account to remain untrusted while
the main project tests trusted submissions. The admin creates both and grants only
the disposable roles access. Never reuse a pre-existing project, including FOLIO,
or delete earlier runs' leftovers. Both projects are destroyed in C02.

Seed each with a small ontology using `urn:example:UAT:web27:` identifiers: three
classes named Widget, Part, and Container; a subclass relationship; English labels
and comments; two alternate labels on Widget; and leave target-language labels/comments absent on Part and Container. Use separate entity annotations for each suggestion so merges
do not conflict. Create no repository integration. Record each project's initial
revision, entity set, and empty suggestion queue.

| Step id | Actor persona | Action | Expected observation | Evidence to capture | Cleanup step |
| --- | --- | --- | --- | --- | --- |
| S01 | All personas | After the preconditions are recorded, create the five profiles, sign in to the appropriate disposable roles, and inspect the application role surfaces. | Anonymous stays signed out; each other profile has only its intended role. Failed access stops the run. | Environment verification row; role-only profile labels and successful/failed access. | C03: profiles, sign-in sessions, and any diagnostic captures. |
| S02 | Administrator / admin persona | Create and seed the main and control projects as above; make only these fixtures available to anonymous suggestions; add suggester and editor memberships. | Both small ontologies load, memberships are correct, no external repository is connected, and queues are empty. | Project/entity ids, safe URLs, seed revisions, membership roles, visibility, and empty queues. | C02: both projects, seeds, memberships, and project-owned data; C03: any local seed file. |
| S03 | Administrator / admin persona | Snapshot both projects' full trust and translation settings, enabled flag, quiet days, tier assignments, and counters by role. Snapshot per-persona save preferences before changing anything. Confirm auto-accept is off for the early checks; if initially on, switch it off only after saving the snapshot. | A redacted baseline exists for every changed setting, including `auto_accept_enabled` and `auto_accept_quiet_days`; no early suggestion can mature. | Settings values and role-level counters; before/after confirmation of the disabled flag. | C01: restore every captured setting; C02: project-scoped counters/data. |

## Trust/personas acceptance

| Step id | Actor persona | Action | Expected observation | Evidence to capture | Cleanup step |
| --- | --- | --- | --- | --- | --- |
| TR01 | Anonymous | Open the main project, browse its ontology, suggest a unique comment change, save, and submit. Inspect direct editing, review, and settings affordances. | Browsing and suggestions work; direct writes, entity minting, review decisions, and administration are unavailable. Submission does not change the default branch. | Capability labels, suggestion/branch/PR ids, pending state, and unchanged default revision. | C02: anonymous suggestion and related project state. |
| TR02 | Untrusted / suggester persona | On control, confirm a non-trusted tier and submit a human comment suggestion. Capture any first-save teaching toast and exercise its offered preference control for AS03. Inspect My Suggestions and attempt to reach reviewer/admin surfaces through application navigation. | Suggestion save/submit works; direct source writes, approval, and trust administration are refused or unavailable. | Tier, pending suggestion/branch/PR ids, role restrictions, default revision, and any teaching text/control result. | C01: any changed preference; C02: suggestion and related state. |
| TR03 | Administrator / admin persona, then trusted / suggester persona | Promote the main-project suggester to `TRUSTED` in project trust settings. Refresh the trusted profile; separately verify control is still non-trusted. | Project membership remains suggester; only main's trust tier changes. Trust does not grant editor/admin powers. | Redacted before/after tier and capability observations in both projects; trust audit row id. | C01: restore original tiers; C02: project audit state. |
| TR04 | Reviewer / editor persona | Inspect both suggestion queues, open TR01/TR02 without deciding, and inspect trust/member administration. | Reviewer can review and object, can edit as editor, and cannot manage memberships or admin trust settings. Viewing alone is not an objection. | Queue and review affordances, role restrictions, unchanged pending statuses. | None. |
| TR05 | Administrator / admin persona | Inspect members, project trust controls, translation settings, audit, and the project deletion control without deleting. | Administrator surfaces are available; displayed scope is the throwaway project. | Role-only view of each surface and project URL. | None. |

## Auto-save acceptance

Use the untrusted profile on control. Keep edits on suggestion branches and do not
submit these drafts for the timer tests. Verify persisted content by reopening it,
not by relying only on a toast. All screenshots follow the redaction rules.

| Step id | Actor persona | Action | Expected observation | Evidence to capture | Cleanup step |
| --- | --- | --- | --- | --- | --- |
| AS01 | Untrusted / suggester persona | Enable auto-save; change a fixture comment, then navigate to another entity before the normal save delay ends. Return and reload. Capture any first-save teaching toast and its preference-control result for AS03. | Navigate-away flush saves the comment on the suggestion branch; unrelated alternate labels survive; default branch stays unchanged. | Before/after literal, branch revision, saved status, preserved labels, and default revision. | C01: preference; C02: draft/session/branch and edits. |
| AS02 | Untrusted / suggester persona | Disable auto-save; edit another comment, wait beyond the displayed normal save delay, then choose Save and reload. Reopen preferences. | Manual mode stays selected; no automatic commit occurs while waiting; explicit Save persists the edit. | Preference before/after, dirty/saved status, revision before waiting and after Save. | C01: preference; C02: edit and associated draft state. |
| AS03 | Untrusted / suggester persona | Review the first-save teaching toast and control result captured in TR02 or AS01. Verify the described manual-save preference is reachable now. Do not require a one-time toast to repeat; if no teaching message was captured, record this item as unverified. | Teaching text explains auto-save and how to choose manual saving; its control changes the actual preference. | Sanitized toast text, control label, and resulting preference. If no teaching message was observed at first save, record the failure. | C01: preference; C02: edit; C03: teaching-message browser state. |
| AS04 | Untrusted / suggester persona | In manual mode, type a unique unsaved comment, close the editor tab, reopen the same project/branch in this profile, and recover the offered draft. Save explicitly. | Recovery presents the correct unsaved text and context; accepting recovery loses no edit and Save persists it. | Draft label, recovery message, recovered text, and resulting revision. | C02: recovered edit/draft/session; C03: local recovery data. |
| AS05 | Untrusted / suggester persona | Open the same entity and suggestion branch in tabs A and B. Change/save in A, then attempt a conflicting stale edit/save in B. Follow the conflict or refresh guidance; verify both tabs against the final revision. | A stale tab cannot silently discard A's change; feedback explains refresh/reconciliation and both views converge after deliberate resolution. | Both starting revisions, distinct synthetic edits, conflict/status text, and final content/revision. | C02: edits/draft/session/branch; C03: extra tab and local data. |

## Translation/audit acceptance

Use only the main fixture. Translation review and suggestion auto-accept are
independent. Do not count a translation confirmation as a timer acceptance.

| Step id | Actor persona | Action | Expected observation | Evidence to capture | Cleanup step |
| --- | --- | --- | --- | --- | --- |
| TA01 | Administrator / admin persona | In project translation settings, choose English as source and one supported target language, enable the available translation workflow, save, and reopen. | Settings persist and remain scoped to main; errors are visible. | Before/after language settings and status. | C01: translation settings; C02: any configuration audit state. |
| TA02 | Reviewer / editor persona | Open Widget annotations, add a target-language literal, save, switch entities, and reload. Compare the seed annotations. | Language tags and annotation provenance/status are visible; the intended literal persists without dropping English comments or alternate labels. | Entity/literal, language and status, revision, and preserved annotation set. | C02: annotation and revision state. |
| TA03 | Reviewer / editor persona | Open translation coverage; filter to the target language and inspect untranslated Part/Container entries. | Counts and missing entries agree with the small fixture and the TA02 change. | Counts, filter, expected fixture denominator, and missing entity ids. | None. |
| TA04 | Administrator / admin persona | Start one backfill for main's missing target-language annotations through the existing UI; wait for a terminal job status and refresh coverage. | Job scope is only main; progress/completion or failure is visible; generated translations have reviewable provenance and updated coverage. | Job id, state transitions, translation record ids, before/after coverage counts. | C02: job, generated records, revisions, and queue entries. |
| TA05 | Reviewer / editor persona | Open the translation review queue, inspect source/target pairs and provenance, confirm one generated record and reject a different one with a synthetic reason. | Both decisions persist; confirmed content and rejected content have distinct states and the queue updates correctly. If fewer than two candidates exist, record the fixture blocker. | Record ids, source/target text, decision states, queue changes, and audit outcome ids. | C02: review decisions, reason, records, and resulting revisions. |
| TA06 | Administrator / admin persona | Open audit with a fixed project/filter. Use the smallest available page size; if needed, make additional reversible trust-setting changes on main until three pages exist, keeping auto-accept disabled and restoring the main suggester to TRUSTED after each pair of changes. Freeze further writes, traverse every cursor to the terminal page, then return to the first page. | Entries retain order, no outcome is skipped or duplicated, the terminal page has no next cursor, and return navigation restores context. | Page-by-page ordered outcome ids, total count, filter, terminal control state, and redacted attribution. Record a blocker if three pages cannot be produced through supported UI. | C01: restore changed settings; C02: generated audit entries. |

## Accessibility acceptance

Use the fixture and existing queues. Record actual viewport dimensions, input
method, and assistive technology used. Unavailable tooling is a pending check,
not inferred accessibility success.

| Step id | Actor persona | Action | Expected observation | Evidence to capture | Cleanup step |
| --- | --- | --- | --- | --- | --- |
| AX01 | All personas, in table order | Use keyboard only to browse, edit/save a synthetic comment where permitted, open/close dialogs, inspect reviews, and navigate allowed settings. | Controls have usable names and logical order; no keyboard trap; Escape closes applicable dialogs and focus returns to the trigger. | Per-role route/control sequence and observed results. | C02: any edits/drafts; C03: local draft state. |
| AX02 | All personas, in table order | Tab and Shift+Tab across each tested page, dialog, save control, queue action, and audit pagination. | Focus is visible, unobscured, and follows a predictable order throughout. | Cropped focus examples and any failing control names. | None. |
| AX03 | Untrusted / suggester persona, then reviewer / editor persona | With a screen reader, trigger a fixture save and a harmless validation error, then refresh the translation queue. | Saving/saved/error and queue status changes are announced semantically without moving focus unnecessarily. | Spoken messages, relevant accessible status roles, and trigger/result pairs. | C02: saved edit/draft; C03: local validation/draft data. |
| AX04 | All personas, in table order | At narrow mobile and desktop widths, operate permitted save, menu, review, settings, and pagination controls using touch or touch emulation. | Targets remain reachable and separated without overlap, clipping, or accidental neighboring activation. | Viewport sizes, target bounds, and actual tap results for each tested surface. | C02: any save or decision state created while testing. |
| AX05 | All personas, in table order | Inspect dirty/saved/error, pending/accepted/rejected, trust tiers, and translation coverage without relying on color; repeat accepted-state inspection at AA09. | Text, icons with accessible names, or other semantic cues distinguish every state. | State-to-text/name observations and cropped examples. | None. |

## Auto-accept acceptance and timing

Only trusted human suggestion submissions are eligible. Anonymous, LLM-generated,
and non-trusted submissions never auto-accept, regardless of elapsed time. Silent
viewing does not pause a clock. An explicit reviewer objection halts it; resolving
the objection starts a complete new quiet period from zero.

Name main's positive sessions `HUMAN-A` and `HUMAN-B` in the ledger, and negative
controls `ANON`, `LLM`, and `UNTRUSTED`. These are synthetic content labels, not
account names. Record actual submission times, displayed scheduled deadlines,
objection time, resolution time, observed worker outcome time, default revisions,
and role-level trust counters. Observe through the application; do not trigger a
manual approval to stand in for automatic acceptance.

| Step id | Actor persona | Action | Expected observation | Evidence to capture | Cleanup step |
| --- | --- | --- | --- | --- | --- |
| AA01 | Administrator / admin persona | Re-snapshot both projects' current trust settings, full tier/counter state, enabled flag, and quiet days. Inspect all suggestion sessions/PRs against this run's ledger, including drafts. Confirm no non-test suggestion session is eligible in either project before shortening. | Every session belongs to this UAT; main is trusted and control remains non-trusted. Any unknown or non-test eligible session stops the change. S03 remains the final restoration baseline. | Role-only settings snapshot and session-id inventory with eligibility/reason; explicit zero non-test eligible count. | None. |
| AA02 | Administrator / admin persona | Enable auto-accept for these two projects only and set `auto_accept_quiet_days` to the minimum allowed, 1. Save and reopen settings. | Both show enabled and exactly 1 day within the supported 1–90 range. No global setting changes. | Before/after settings, audit ids, and project URLs. | C01: restore original enabled flags and quiet days; C02: configuration audit state. |
| AA03 | Anonymous; untrusted / suggester persona; trusted / suggester persona | Create three new negative controls: anonymous human comment on main, non-trusted human comment on control, and an actual LLM-generated suggestion through main's suggestion workflow. Save and submit each separately. Do not relabel handwritten text as LLM output or use translation backfill as the LLM control. | All are pending and ineligible; provenance identifies anonymous, non-trusted, and LLM origin respectively. Trusted membership never makes LLM output eligible. | Each suggestion/branch/PR id, submission UTC, origin/tier, scheduling field or displayed absence of a deadline, and baseline default revision. Missing LLM workflow is a blocker for that scenario. | C02: all three controls and generated content. |
| AA04 | Trusted / suggester persona | Submit HUMAN-A and HUMAN-B as separate human-only comment changes on distinct main entities. Capture the submitter snapshot privately at submission. | Each is trusted-human eligible with a scheduled deadline one day after its clock begins; neither has merged yet. | Session/branch/PR ids, submission/clock-start UTC, deadlines, role/tier/origin snapshot summary, and default revision. | C02: sessions, branches/PRs, edits, and later outcomes. |
| AA05 | Reviewer / editor persona | Silently view HUMAN-A without commenting. After some recorded nonzero elapsed time but before HUMAN-B's deadline, lodge an explicit reviewer objection on HUMAN-B using its objection control. | HUMAN-A's deadline is unchanged by viewing. HUMAN-B has an active objection and its clock is halted. | Before/after deadlines, viewing UTC, objection id/time, state, and synthetic objection text. | C02: objection and related session state. |
| AA06 | Reviewer / editor persona | Observe before the original deadlines, then after both original deadlines and normal worker processing. Keep HUMAN-B's objection active. Also observe all three negative controls after at least a full day since their own submissions. | Scenario 1: HUMAN-A auto-accepts only after its deadline and its change reaches the default branch. Scenario 2 halt: HUMAN-B remains pending beyond its old deadline. Scenario 3: all three negatives remain unaccepted and ineligible. | Dated before/after rows for each session, deadlines, accepted/default revision for A, active objection for B, negative statuses/provenance, and observed worker outcome time. | C02: automatic merge/outcome, trust effects, and all related project state. |
| AA07 | Reviewer / editor persona | Resolve HUMAN-B's objection through the review workflow; do not approve the suggestion. | The objection resolves; the new deadline is resolution time plus one full day, with no credit for time elapsed before the objection. | Objection resolution UTC, old deadline, new clock start/deadline, computed interval, and pending status. | C02: resolution event and related state. |
| AA08 | Reviewer / editor persona | Observe HUMAN-B after its old deadline but before its new one; observe again after the new deadline and normal worker processing. Recheck negatives with control still non-trusted. | Scenario 2 restart: B stays pending until the fresh interval expires, then auto-accepts. Negatives remain ineligible and unaccepted throughout. | Before/after rows, elapsed interval from resolution, merge revision/outcome time, and final negative-control states. | C02: automatic merge/outcome, trust effects, and related state. |
| AA09 | Administrator / admin persona | Open A/B audit outcomes and compare submitter snapshots to AA04; compare role-level trust counters before/after successful merges. Revisit AX05's accepted-state check. | Scenario 4: historical submitter snapshot matches submission-time data, decider is `system:auto-accept`, outcome links to the actual merged revision, and trust credit reflects successful merges without credit to negative controls. | Outcome ids, snapshot role/tier/origin and private comparison match/mismatch, literal system decider, merged revisions, counter deltas, and semantic accepted-state cue. | None; underlying outcome/counter state is removed by C02. |
| AA10 | Administrator / admin persona | Capture final outcome and settings summaries, then immediately perform C01–C04. | Settings are restored before project destruction; only run-created state is removed; evidence references final cleanup receipts. | Final session disposition inventory and linked C-step rows. | C01, C02, C03: complete all restoration and deletion. |

Worker delay is not permission to force an outcome. Record a planned observation
cutoff in the environment block based on the execution owner's available window;
if acceptance is absent by that cutoff, record the timing/result failure and run
cleanup. Never infer "never auto-accepts" solely from a brief wait: the negative
scenario requires both the ineligible state/provenance and observations past the
positive controls' completed quiet periods.

## Cleanup and receipts

Cleanup runs even after partial failure. Do not delete disposable accounts that
predate this run, unrelated projects, earlier probe sessions, or historical audit
evidence. No direct data-store cleanup is authorized. If the application cannot
remove a project-owned object, record the residual and return it to the execution
owner rather than broadening cleanup.

| Step id | Actor persona | Action | Expected observation | Evidence to capture | Cleanup step |
| --- | --- | --- | --- | --- | --- |
| C01 | Administrator / admin persona; each affected persona | Restore both projects' exact S03 trust/quiet-period/translation settings and tier assignments, plus each persona's original save preference. Reopen to compare with S03. If stopping with eligible sessions pending, disable the test timer temporarily, withdraw those run-created sessions, then restore the baseline. | Original values match before project deletion; no test timer is left running. No non-test setting is touched. | One restoration receipt per changed setting/tier/preference, with before/after comparison; withdrawn session receipts if applicable. | C02 removes the remaining project state; C03 removes local preference data. |
| C02 | Reviewer / editor persona, then administrator / admin persona | Stop/cancel outstanding test jobs and withdraw or close run-created pending suggestions through supported controls. Admin deletes both projects. Reconcile every ledger object, including seed, memberships, branches/PRs, drafts, translations, jobs, objections, revisions, audit outcomes, and project-scoped trust effects. | Both projects disappear from a refreshed admin list and direct project URLs report absence. Each child is confirmed absent through its supported lookup/list or a verified application deletion cascade; an access denial alone is not deletion proof. | One receipt per ledger object naming actual deletion/cascade verification. Record any surviving object as failed cleanup, even if its parent is gone. | None. |
| C03 | Each persona, with administrator / admin persona as needed | Revoke only sign-in sessions created by this run through the supported session-management UI, leaving the current administrative session until last; sign out any remaining run session and verify authenticated pages require sign-in again. Clear local drafts/storage, close all tabs, delete all five profiles, temporary seed files, and raw screenshots/HAR/diagnostic files. | No reusable run authentication or browser state remains; logout returns through the application correctly. Only reviewed redacted evidence is retained. | Role-only revocation/sign-out receipt and one deletion receipt per profile/local artifact, verified by absence. If session revocation is unavailable, record it pending; sign-out alone is not proof of revocation. | None. |
| C04 | Administrator / admin persona acting as evidence custodian | Reconcile every created-state entry to a verified receipt, fill all pending cleanup references, inspect retained evidence for redaction, and record overall acceptance or remaining findings. | No unaccounted state or secret-bearing evidence remains; failures and timing gaps stay explicit. | Final inventory counts, redaction review result, findings/pending list, and cleanup completion result. | None; sanitized evidence and receipts are retained. |

Use one line per created state, including a separate line for each child verified
removed by cascade. Restoration entries use the same format with `restored` in
the action field. Grouping everything under "project deleted" is insufficient.

```text
CR-<run>-<sequence> | <UTC> | <C-step> | <state kind and safe application id or role-local label> | <removed/restored action> | <persona role> | <verification method and observed absence/baseline match> | <pass/fail>
```

Failed deletion retains a failed receipt and a Pending entry; never backfill it as
successful. Sanitized screenshots and outcome summaries survive the deleted test
projects, so evidence links must not rely solely on now-absent application pages.

## Appendix: acceptance matrix to step mapping

There are **26 matrix items across five rows**, each mapped below. The additional
negative auto-accept controls, snapshot/restore safeguards, evidence discipline,
and boundary checks are explicit in AA01–AA10, S01–S03, and C01–C04.

| Matrix row | Item | Step ids |
| --- | --- | --- |
| Auto-save | Navigate-away save | AS01 |
| Auto-save | Manual-save preference | AS02 |
| Auto-save | Teaching toast | AS03 |
| Auto-save | Draft recovery | AS04 |
| Auto-save | Two-tab behavior | AS05 |
| Translation/audit | Settings | TA01 |
| Translation/audit | Editor annotations | TA02 |
| Translation/audit | Coverage | TA03, TA04 |
| Translation/audit | Backfill | TA04 |
| Translation/audit | Review queue | TA05 |
| Translation/audit | Audit cursor navigation | TA06 |
| Trust/personas | Anonymous | TR01 |
| Trust/personas | Untrusted | TR02 |
| Trust/personas | Trusted | TR03, AA04 |
| Trust/personas | Reviewer | TR04, AA05, AA07 |
| Trust/personas | Administrator | TR05, AA01, AA02 |
| Auto-accept | Eligible quiet-period acceptance | AA04, AA05, AA06 |
| Auto-accept | Objection halt | AA05, AA06 |
| Auto-accept | Restart from zero | AA07, AA08 |
| Auto-accept | Outcome snapshot | AA04, AA09 |
| Auto-accept | Cleanup | AA10, C01, C02, C03, C04 |
| Accessibility | Keyboard-only operation | AX01 |
| Accessibility | Visible focus | AX02 |
| Accessibility | Semantic status announcements | AX03 |
| Accessibility | Responsive touch targets | AX04 |
| Accessibility | Non-color-only state | AX05, AA09 |

## Dry read-through checklist

- [ ] B1/B5 affirmative Cockpit answers and U9's manifest pair are required before execution; both deployed SHAs are named before S01.
- [ ] No step requires a credential in the document; all personas are role-only and all retained evidence is redacted.
- [ ] Every state-creating step names C01, C02, or C03; each actual object will get its own cleanup receipt, including cascaded children and browser artifacts.
- [ ] Every one of the 26 matrix items maps to at least one defined step id in the appendix.
- [ ] All four auto-accept scenarios are explicit, including anonymous/LLM/non-trusted negatives and the submitter snapshot/system decider.
- [ ] Quiet-period snapshots, zero non-test eligibility checks, one-day minimum, halt/restart observations, restoration, and cleanup are ordered; the multi-day timing limitation is explicit.
- [ ] Every evidence row uses all ten fields; dated findings follow the existing log convention; failed or pending observations cannot count as acceptance.
- [ ] The procedure includes interruption cleanup and deletes only run-created state; no deployment or excluded environment operation is requested.
- [ ] Reading or preparing this document executes nothing and does not assert that DEV acceptance passed.
