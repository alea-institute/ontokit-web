---
title: Narrow DEV Mailpit access and remaining hosted acceptance
date: 2026-09-30
execution: knowledge-work
kind: approach-plan
status: prepared-local-blocked-on-api-owner
---

# Goal and settled decision

Damien approved a narrow restricted-key Mailpit read for named disposable UAT
accounts on September 30 (`dev-uat-access`). The access decision is settled;
do not request it again or replace it with IAM-owner access. Demo credentials
(legacy B8) remain deferred. This worker may prepare local web documents only;
no network, credential reads, external-repo edits, deploys or hosted tests.

## Evidence and implementation boundary

- Current web base is `7ab0c48a3d78381425d15d4b75f99aaa6cf25ddb`; its tracked
  scripts are sitemap/version/release helpers, with no forced-command handler.
- Read-only API HEAD `773c51aa0dd2959fd07c48627d86d66639cd13fb` owns
  `deploy/ontokit-deploy.sh`, `deploy/tests/ontokit-deploy-test.sh`, and
  `deploy/RUNBOOK.md`. Its `dispatch_request` accepts only status, deploy and
  rollback; arbitrary commands return 64. `main` locks and logs the operation.
  This is evidence from a local snapshot, not a claim about latest API or live state.
- Newer local web object `14597f6c434009398662f25db4e4a6b3b5b9cb45`, path
  `docs/releases/d10-suggestion-chain-readiness.md`, records paired September 28
  deployment (`787eecc4` web / `44b6dfd3` API) and seven local suggestion cases.
  It explicitly excludes hosted B02/B03 acceptance. No redeploy is needed merely
  to reproduce that receipt, and the canceled old approval run is not actionable.
- Its `docs/releases/eu-hosting-migration-receipt.md` records identity recovery and
  metadata smoke but still lacks an accepted operational rollback pair. The deleted
  US server is not a rollback target.

**Blocker:** implementation belongs in the API deployment authority, outside this
worker's writable repo. Do not add an unused web-side clone of a security boundary.
Orchestrator must assign the API change on its current deployment source, reconcile
its installation manifest and obtain review. No Mailpit verb has been implemented
or installed by this worker. No `tools/homebox-bin` path was changed.

## Implementation contract for the API owner

1. Add one verb, proposed `uat-mail <persona>`, with exactly one selector chosen
   from owner, suggester, editor, unrelated. Resolve selectors through a root-owned
   DEV-only allowlist of exact disposable addresses. Those addresses are not supplied
   in this dispatch: obtain them from the existing UAT fixture inventory, or create
   a run-owned disposable set in the authorized operator lane. Do not infer them
   from real users or permit caller-provided addresses, domains, URLs or message IDs.
2. Keep dispatch token-based with no eval or shell interpolation. Reject CR/LF,
   extra arguments, unknown selectors, aliases and path/shell payloads with 64
   before reaching Mailpit. Require DEV identity and refuse other environments.
   Preserve existing status/deploy/rollback restrictions and SSH forwarding limits.
3. Use the installed Mailpit version's documented local read API, verified by the
   implementation owner. No external host selection, broad mailbox output, public
   port, general shell, attachment retrieval, destructive HTTP method, mail marking
   or IAM change. Read-only lookup may inspect metadata internally but must filter
   before returning anything. Apply timeouts, bounded response sizes and lookback.
4. Validate the exact recipient against message envelope/detail, not search results
   alone. Refuse any message containing an unapproved recipient (including Cc/Bcc
   when available); fail closed when recipient scope cannot be established. Only
   return the current run's verification message from the configured DEV identity
   sender, with a timestamp after the run started. On ambiguous matches, return an
   explicit ambiguity result rather than selecting stale or unrelated mail.
5. Return only the necessary verification code/link to the authorized operator's
   ephemeral channel. These are authentication secrets: suppress command tracing,
   body logging, browser traces and durable transcripts. Public evidence records
   only selector, redacted message reference, time, decision and pass/fail. Never
   commit mail bodies, verification values, tokens or cookies.
6. Rollback is removal of this verb and its routing/allowlist followed by refusal
   proof. Keep the previous reviewed script identity and install atomically under
   the existing lock. Preserve existing deployment key and other commands. The
   approved access addition does not authorize deletion of mailbox contents.

## Required offline tests in API before installation

Use the actual dispatcher with a stub local Mailpit transport; all fixtures are
synthetic. Demonstrate the new verb's expected refusal before implementation,
then test the accepted path and negative boundaries:

| Case | Required result |
|---|---|
| Exact approved persona and fresh verification | Only its minimal verification payload |
| Unknown selector, address, wildcard, extra argument, CR/LF, shell payload | 64; no transport call |
| Forged search match, different recipient, mixed recipients, unapproved Bcc | No disclosure |
| Stale message, wrong sender, duplicate matches, absent mail | Bounded non-success; no unrelated data |
| Timeout, malformed JSON, oversized data, failed HTTP | Fail closed; no body in error/log |
| Caller-controlled URL/ID and non-DEV target | Refused |
| All reads | No mutation method, no attachments or mailbox-wide output |
| Existing commands and arbitrary shell | Existing behavior and refusal preserved |
| Verb removed | New verb refused; other commands still work |

Run API deployment regression suite and added transport tests, syntax checks and
manifest validation as applicable. Security review must inspect output/log paths
and negative tests, not just a successful verification email.

## Exact network continuation (authorized operator, not this worker)

1. Reconcile current DEV runtime/checkout pair, migration version and health using
   the existing restricted status route. Save sanitized observations with UTC time.
   Verify the selected current API source and reviewed script/manifest identities.
2. Install the reviewed verb atomically through the infrastructure owner; use the
   existing approved restricted access path and pinned host identity. Verify its
   digest and refusal behavior, including rollback removal/reinstallation proof.
   Do not weaken SSH, environment or branch protections.
3. Resolve the exact disposable persona mapping privately. Read only their current
   verification messages via the new verb, and complete normal OIDC browser login.
   Owner, suggester, editor and unrelated must be ordinary accounts, not superadmins.
4. Use a fresh disposable project and fixture ontology; record fixture IDs privately
   for controlled cleanup. Preserve existing projects and run ownership. Execute
   the matrix below against hosted DEV; do not point the destructive isolated-stack
   harness at a hosted environment without adapting and reviewing its ownership rules.
5. Record per-case observed outcome and sanitized evidence; blocked or failed cases
   stay open. Reuse prior valid evidence only with its original date and boundary.
   Rollback rehearsal needs a verified compatible pair and checkpoint first.
   Cleanup requires a verified backup and explicit run ownership; historical cleanup
   denials are not an invitation to try a different deletion route.

## Hosted verification matrix

| Scope | Required observation |
|---|---|
| B02 runtime | API/worker/web revisions match selected pair; schema and health recorded |
| B02 persistence | Ontology edit/save, full reload and API read agree; restore proves acknowledged edit survives |
| D10 submit | Untrusted suggester submits; reviewer triage sees it; post-submit editing refused |
| D10 approve | Owner approval merges; source reloads; session branch removed; suggester notified |
| D10 request changes | Request changes → notification → resume → edit → same-PR revision+1 resubmit → approve |
| D10 reject | Editor rejects; PR closes; suggester sees outcome |
| D10 role refusals | Suggester cannot approve; creator cannot self-approve; completed-state actions refused |
| D10 private/mint | Private non-member and untrusted mint refused |
| D10 policies | Editor can approve; signed-in public non-member can suggest at untrusted tier |
| B03 identity/permissions | Login/logout per persona; trust promotion and role boundaries reflect catalog |
| B03 editing | Translation/audit, autosave and real submission/merge persist after reload |
| B02 recovery/CI | Verified rollback target, actual restore/rollback result, protected CI/runner evidence |

D10's optional-configured anonymous case is conditional on actual DEV auth mode;
record that mode and test the corresponding behavior without changing it for a test.
Do not declare B03 accepted from the seven D10 cases alone. Retain catalog obligations
and migration capacity/observation gaps separately.

## Local verification and definition of done

The local preparation is complete when the source ownership, restricted contract,
negative tests, hosted matrix and remaining owners are explicit. No runtime behavior
changed, so no new web unit tests are appropriate. The existing command
`npm run test -- --run` exited 127 (`vitest: not found`); dependencies are absent.
No install was attempted. Whitespace and local documentation link checks are the
available local gates, not proof that Mailpit or hosted UAT works.

## Integration and rollback of this preparation

This new plan can be cherry-picked onto the default branch independently; it refers
to later delivery evidence by immutable local object identity. The small roadmap
addendum should be reconciled into the newer tracker at integration rather than
replacing it with this old branch's ledger. Revert the documentation commit to undo
local preparation. Runtime implementation, review, installation and hosted evidence
remain with the API/deployment owner; demo access remains deferred.
