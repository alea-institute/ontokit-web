# D10 suggestion review chain readiness

Status: **Locally verified; merged through [Web PR60](https://github.com/alea-institute/ontokit-web/pull/60) as `787eecc4` and [API PR60](https://github.com/alea-institute/ontokit-api/pull/60) as `44b6dfd3`, and deployed together to DEV (EU) on 2026-09-28. Runtime matches checkout for api, worker and web (no revision drift). Hosted persona acceptance (B02/B03) is not claimed.**
[Plan](../plans/2026-09-27-1726-test-suggestion-review-chain-plan.md)

A non-editor can propose an ontology change. A reviewer can then accept it, reject it
or send it back, and each person sees the outcome. This receipt records the local
regression proof of that chain on fresh isolated stacks with real personas in a real
browser, plus the API refusals, each recorded with its tier and status.

## Source

| Item | Value |
|---|---|
| Web HEAD at local acceptance | `2c120996ff2d5ff39b7e1d7e419aaaf6948045d7` (branch `test/d10-suggestion-chain-20260927`) |
| API HEAD at local acceptance | `19b62d2c47ffb712851a1362bdfa46d15e7be334` (branch `fix/d10-suggestion-lifecycle-20260927`) |
| Source fingerprints (all accepted runs) | web `53c917afb9…`, API `4dadd36995…` |
| Conditions | 2026-09-27/28; clean trees; standard umask |

## What changed

| Unit | Commit | Result |
|---|---|---|
| U1 API lifecycle | API `7ba90dcb` | Owner-only `reopen` (changes-requested → active, fresh beacon token, 409 while another active session exists). A reopened revision is resubmitted on the **same PR** with revision+1 and a reviewer notification, via submit, resubmit or the stale sweep. Approve, reject and request-changes notify the authenticated suggester; dismiss and anonymous sessions stay silent. Reject and discard of a reopened session close the PR through a reviewer-authorized seam. Self-approval is refused, including in bulk review |
| U2 editors approve (confirmed 2026-09-28) | API `bd138727` | Reviewer-authorized merge seam; `pr_approval_required` still enforced; direct PR merge stays owner/admin |
| U3 public non-member suggestions (confirmed 2026-09-28) | API `62a6d0ec` | Signed-in non-members suggest on public projects at the untrusted tier; capabilities agree; private projects and minting still refused |
| R1 API review fixes | API `19b62d2c` | Approvals from an earlier revision no longer count after resubmission. Reopen refuses a non-open PR. Discard tolerates a PR that is already closed or merged. The stale sweep closes the PR on a lost-access discard and skips unchanged reopened revisions. Guard tests added |
| U4 web resume flow | Web `86ee808e` | Resume calls `reopen`, adopts the server branch, beacon token and change count; reload adopts the active reopened session; failed or mismatched resume stays read-only |
| U5 harness profile | Web `e1fef2d2` | Required-auth `suggestions` profile with owner, suggester, editor and unrelated personas (none a superadmin). Memberships are added through the owner's HTTP API. The seven-case inventory is exact |
| U6 browser proof | Web `ba6c2e36` | `e2e/browser/suggestions.spec.ts` (7 cases) plus one anonymous-proposal case in optional-configured (now 6) |
| R2 web review fixes | Web `2c120996` | Branch adoption resets branch-scoped source and syncs BranchContext; a resubmit releases the resume guard; `resumeSession` is the single adoption path |

The two policies (U2 and U3) shipped provisionally. Damien confirmed both on 2026-09-28 in Cockpit ask
`ontokit-web-2026-09-27-2224-d10-suggestion-permissions` (qids
`editor-approves-suggestions`, `nonmember-suggestions`), so no revert is needed. Each still sits in its own commit with its
own inventory case (6 and 7).

## Requirements evidence

| Req | Evidence |
|---|---|
| R1 submit reaches triage | Suggestions case 1 (browser); probes: save on submitted session 400, suggester approve 403 |
| R2 owner approval merges | Case 2: label reloads from the API, session branch removed, suggester's bell shows the approval; probes: approve on merged 400, creator self-approval 403 |
| R3 reopen and resubmit | Case 3: request changes → notification → resume → edit → resubmit revision 2 on the same PR → approve → merged |
| R4 reject closes the PR | Case 4: editor rejection; PR closed; suggester notified |
| R5 decision notifications | Cases 2–4 (bell); dismiss silence and anonymous suppression covered by API unit tests |
| R6 role refusals | Probes in cases 1–2; bulk self-approval covered by API unit tests |
| R7 state refusals are 400 | Probes in cases 1–2; API unit tests for other statuses |
| R8 private and mint refusals | Case 5: private non-member create 403; untrusted mint 403 |
| R9 editor approval (confirmed) | Case 6 |
| R10 public non-member (confirmed) | Case 7: capabilities agree with create; submission succeeds |
| R11 anonymous proposal | Optional-configured case 6: anonymous submission on the owner-persona public fixture reaches the owner's triage |
| R12 harness integrity | Exact inventories; unchanged baseline, lifecycle, optional-anonymous and disabled counts; sanitized receipts; complete cleanup; neighbors unchanged (below) |

## Accepted fresh-stack runs

All runs used the same web and API revisions and fingerprints, completed cleanup and are accepted receipts.

| Profile | Run | Result |
|---|---|---|
| suggestions 1 | [`90d45a9f…`](d10-run-90d45a9fa06da04277ac91c345366df6.json) | 7/7 |
| suggestions 2 | [`c134894a…`](d10-run-c134894abdb3f4789cc7fc4f97dcaacf.json) | 7/7 |
| optional-configured 1 | [`9083152d…`](d10-run-9083152d96a455968e6eb86847a5f794.json) | 6/6 |
| optional-configured 2 | [`94bbf1e0…`](d10-run-94bbf1e00cfa4d1bfa8e95f139423806.json) | 6/6 |
| baseline | [`6c6e566e…`](d10-run-6c6e566e0b0134b4f830addf020dcde2.json) | 21/21 |
| optional-anonymous | [`6b18aaa2…`](d10-run-6b18aaa2b36cd9fb114c0474f256d154.json) | 2/2 |
| disabled | [`7136c981…`](d10-run-7136c9819dc3f945eba3795d10cc22e5.json) | 3/3 |
| lifecycle 1 | [`5532aae1…`](d10-run-5532aae15068015f55d866ba47f0163d.json) | 4/4 |
| lifecycle 2 | [`264f5fff…`](d10-run-264f5fff60c30d6d1b40cdaaa0d2b12e.json) | 4/4 |
| lifecycle 3 | [`3171e44b…`](d10-run-3171e44bec59c3bbcae6433bf200a108.json) | 4/4 |

Neighboring Docker containers, networks and volumes: 57 entries before and after the final matrix, unchanged.

### Lifecycle attempts that did not pass (recorded, not accepted)

Another workload on the host held the load average between 14 and 30 for several
hours. During that time, six lifecycle attempts on D10 code failed. Each passed two
or three of the four cases, and the failing case alternated. R1 read a session response
after the page had navigated away. R4 found the provider's submit button still
disabled after typing the username, the pattern of filling an input before
hydration. One attempt failed the lifetime preflight. The pre-D10 pair (web `80cc45c9`,
API `ab2aa903`) passed 3/3 at load 12–15. D10's product changes are confined to the
editor page, the suggestion hook and client, and BranchContext, which only the editor
mounts. The lifecycle cases never load those. Once load fell to 11–13, the final D10
pair passed 4/4 three times in a row (above). No lifecycle code or assertion was
changed to obtain that result. The same load also caused two Vitest timeouts once, so
the final gate ran the full suite with four workers; CI ran it at default parallelism
and it passed.

## Gates

| Gate | Result |
|---|---|
| API `ruff check`, `ruff format --check` (ontokit + changed tests), `mypy --python-version 3.13`, full `pytest tests/` | Pass at `19b62d2c` (3,754 tests); ce-work `verify-run` receipt |
| Web type-check, lint, full Vitest, e2e profiles/evidence/identity/ownership suites | Pass at `2c120996`; ce-work `verify-run` receipt |
| CI | Web PR60 and API PR60 checks green |
| API independent review | ce-code-review full depth plus an independent Codex cross-model pass (independence verified), run `20260927-200331-883156a6`: **Ready with fixes**. All six confirmed findings fixed in R1 |
| Web independent review | ce-code-review full depth plus an independent Codex cross-model pass (independence verified), run `20260927-202039-9ab6c5ea`: **Ready with fixes**. All four confirmed findings fixed in R2 |

Unapplied, non-blocking review notes are listed in both PR bodies.

## DEV deployment

The squash merges carry exactly the verified trees: API `44b6dfd3` has the same tree as
`19b62d2c`, and web `787eecc4` has the same tree as the verified `2c120996` plus this
receipt and the run receipts. Both deployed together to DEV (EU) on 2026-09-28 through the
forced-command key. Status reports api, worker and web runtime = checkout with no drift.
The halves must stay paired: resubmitting a sent-back suggestion now requires a prior
`reopen`, which only the new web calls.

| Smoke check | Result |
|---|---|
| Web `/` | 200 |
| Providers | 200, contains `zitadel` |
| Anonymous project create | 401 |
| Anonymous `POST …/suggestions/sessions/{sid}/reopen` | 401 (route deployed) |
| OpenAPI lists the reopen route | Yes |

These checks do not establish hosted persona acceptance of the chain (B02/B03).

## Carried forward (not delivered by D10)

- B02/B03 hosted persona acceptance of the chain on DEV.
- B12 WebSocket lifecycle; B13 recurring CI enforcement of these profiles.
- Multi-tab refresh locking.
- Deferred by plan: anonymous beacon wiring on the web; a distinct `suggestion_resubmitted` notification type.
- Auto-submit, the auto-accept sweep, bulk review, beacon unload flush and the Redis-absent 503 path keep unit-test evidence only.
