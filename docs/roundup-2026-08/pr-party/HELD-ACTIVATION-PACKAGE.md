# PR Party held activation package

**Status:** Draft only. Do not send, install, enable, or paste credentials from this document. The user-approved order is local preparation first, demo activation second, and one final CatholicOS issue/PR batch after the remaining local work is complete.

## What is ready locally

- API source branch: `feat/pr-party` at `23aab106249b4a7b87abf9a0b7fcfcf7cda2f683`.
- Answerer workflow source: `ontokit/pr_party_org_assets/claude-pr-answers.yml`.
- Source workflow Git blob: `b2ce6625ebe4965dde65e5d6a1fe34bc2883b938`.
- Intended destination: `catholicos/.github`, `.github/workflows/claude-pr-answers.yml`, through a linked issue and fork PR targeting `dev`.
- The source workflow is carried and tested in `ontokit-api`; it does not run there.

The live release gate remains the first real GitHub validation of both reviewer flows plus Q&A:

1. credentialed review posts under the reviewer’s own GitHub identity and the card concludes;
2. degraded review records intent, deep-links to GitHub, reconciles the manual review, and concludes;
3. a question posts, the answerer replies with a binding marker, and the answer returns to the card.

## Activation boundary

Everything below this line is held. Activation requires all of the following:

- the U8/U9 demo environment exists and its write-isolation receipt is green;
- the final local implementation and upstream scratch-validation batch is complete;
- explicit authorization to create the CatholicOS issue and linked PR;
- an org owner has approved the webhook and answerer-workflow installation route;
- each credentialed reviewer voluntarily provisions a correctly scoped personal write PAT through OntoKit’s intake UI;
- the shared read-only generation token has an approved issuer, scope, intake path, expiry record, and rotation owner;
- the answerer’s `ANTHROPIC_API_KEY` is installed as an organization secret scoped only to the participating repositories;
- the D5 encryption-key migration disposition is recorded; and
- a named live-E2E window and rollback owner exist.

No document in this package grants permission to mutate CatholicOS, AWS, DNS, DEV, or PROD.

## D5: encryption rewrap, not GitHub token rotation

`rotate_reviewer_token(ciphertext)` does not create, replace, revoke, or extend a GitHub PAT. It decrypts the already-stored reviewer PAT using OntoKit’s accepted encryption-key ring and re-encrypts the same plaintext under the current `SECRET_KEY`. The purpose is to retire `SECRET_KEY_PREVIOUS` without requiring reviewers to re-enter otherwise-valid PATs.

The approved implementation is an explicit operator-triggered bulk rewrap task with an audit receipt. It must:

- operate only on encrypted reviewer-credential rows;
- rewrap each value through `MultiFernet.rotate` without logging plaintext or ciphertext;
- fail closed and retain the previous key until every row is proven decryptable under the current key;
- report counts and row identifiers only, never token material; and
- remain separate from reviewer-controlled GitHub PAT replacement and revocation.

This control is implemented and reviewed locally at API commit `f3c4251d` on `fix/pr-party-credential-rewrap`. It is not pushed, merged, deployed, or executed. Activation still requires the ordinary final issue/PR batch, deployment review, one consistent worker generation, the previous application key retained throughout verification, and a counts/UUID-only dry-run receipt before apply. The receipt proves only the PR Party reviewer-credential domain; it does not authorize global removal of `SECRET_KEY_PREVIOUS` while other encrypted domains remain.

## Held CatholicOS issue draft: organization answerer workflow

### Title

Add a least-privilege organization workflow for PR Party Q&A

### Body

PR Party can post reviewer questions to GitHub, but those threads remain unanswered until the organization installs a reviewed `@claude` answerer workflow. Add one organization-owned workflow that can answer member-authored questions across the participating repositories without checking out pull-request code or receiving write privileges beyond its own issue/PR comment.

Acceptance criteria:

- the workflow lives at `.github/workflows/claude-pr-answers.yml` in `catholicos/.github`;
- workflow-level and job-level permissions are exactly `contents: read` and `issues: write`;
- only comments from organization `OWNER` or `MEMBER` associations can trigger it;
- the job never uses `actions/checkout`;
- untrusted PR/comment text is enclosed in per-run nonce-suffixed delimiters;
- the agent tool allowlist is limited to updating the answer comment, with shell, file-editing, and network-fetch tools denied;
- the answer begins with `> Replying to <comment URL>` so PR Party can bind it deterministically;
- `ANTHROPIC_API_KEY` is an organization secret scoped only to participating repositories; and
- the merged file is byte-compared with the reviewed source and its final SHA-256 receipt is recorded before live E2E.

Until this lands, PR Party’s supported degraded state is that questions post to GitHub and remain visible but unanswered.

## Held CatholicOS PR draft: organization answerer workflow

### Title

ci: add the least-privilege PR Party answerer

### Body

## Summary

- add the organization-owned `@claude` answerer used by PR Party Q&A;
- restrict triggers to organization owners and members;
- grant only `contents: read` and `issues: write`;
- avoid checkout of untrusted pull-request code;
- preserve nonce-delimited prompt containment, a one-tool allowlist, and deterministic answer binding.

## Issue link

Closes `[CatholicOS/.github issue]`.

## Source integrity

- reviewed API source commit: `23aab106249b4a7b87abf9a0b7fcfcf7cda2f683`
- reviewed source path: `ontokit/pr_party_org_assets/claude-pr-answers.yml`
- reviewed Git blob: `b2ce6625ebe4965dde65e5d6a1fe34bc2883b938`
- final source SHA-256: `[compute immediately before opening]`
- proposed-file SHA-256: `[must match final source SHA-256]`

## Verification

- `[exact TestOrgWorkflowAsset result]`
- `[workflow YAML parse result]`
- `[permissions and trigger review receipt]`
- `[final byte/hash comparison receipt]`

This PR does not enable PR Party by itself. Secret installation, required-workflow configuration, webhook creation, PAT intake, and live E2E remain separately gated. No self-merge is requested.

## Held org-owner setup checklist

Use only after the linked issue and PR are authorized and reviewed.

1. Choose the preferred one-copy installation: merge the workflow into `catholicos/.github` and require it for participating repositories with an organization ruleset. Use per-repository copies only if the required-workflow route is unavailable.
2. Create or select an organization `ANTHROPIC_API_KEY` secret and scope it only to participating repositories. Do not paste the value into an issue, PR, chat, log, or this repository.
3. Confirm the workflow permissions, member/owner trigger, no-checkout rule, nonce delimiters, tool restrictions, and answer-binding line against the reviewed asset.
4. Record the merged file’s SHA-256 and compare it with the reviewed local source before enabling the first Q&A run.
5. Create the PR Party org webhook with the documented event set and secret through the approved owner-controlled channel. Do not reuse the answerer API key, shared generation token, or any reviewer PAT.
6. Keep the answerer disabled or unrequired until the demo gate and live-E2E window are ready.

## Held reviewer outreach draft

**Subject:** PR Party sandbox validation — reviewer credential and scheduling request

We have finished the local PR Party implementation and are preparing a sandbox-only end-to-end validation. Nothing will be enabled against normal repositories during this exercise.

For the credentialed flow, each participating reviewer will be asked to create a fine-grained personal GitHub token with only the approved repository and review/comment capabilities, then enter it directly into OntoKit’s credential form. Please do not send the token by email, chat, issue, or pull-request comment. OntoKit validates that the token belongs to the registered GitHub login before encrypted storage. Reviewers may instead choose the supported no-credential degraded flow.

The exercise will validate one synthetic pull request through intake, brief generation, notification, review, reconciliation, and Q&A. We will schedule a short window, identify the sandbox repository and rollback owner in advance, and share the exact scope checklist before anyone creates a token.

No action is requested yet. This message will be sent only after the demo environment, organization workflow, webhook, shared generation token, and live-E2E runbook have passed their separate gates.

## Final pre-send and live-E2E receipt

Record these facts immediately before the authorized batch; stale values do not count:

- CatholicOS `.github` base SHA and default branch;
- refreshed linked-issue search result;
- API/web PR Party source heads and complete verification results;
- source asset Git blob and SHA-256;
- proposed/merged asset SHA-256 equality;
- exact organization workflow installation route and repository scope;
- secret-presence checks by name only, never values;
- reviewer-intake capability receipts with identities and token material redacted;
- webhook delivery receipt;
- credentialed flow GitHub review URL and terminal card state;
- degraded flow manual-review URL, reconciliation receipt, and terminal card state;
- Q&A question URL, bound answer URL, and returned card thread;
- cleanup/rollback receipt for all sandbox data.

If any integrity, scope, identity, or cleanup check fails, stop the live gate and preserve the external state for diagnosis rather than retrying a write blindly.
