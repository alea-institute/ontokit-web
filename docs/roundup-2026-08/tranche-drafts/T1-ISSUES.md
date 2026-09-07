# Tranche 1 held issue package

**Status:** Executed 2026-09-07 after gate B2 was answered yes for T1 only: new web owning issue [CatholicOS/ontokit-web#401](https://github.com/CatholicOS/ontokit-web/issues/401) was created, and existing API owning issue [CatholicOS/ontokit-api#83](https://github.com/CatholicOS/ontokit-api/issues/83) was updated by [acceptance-criteria comment](https://github.com/CatholicOS/ontokit-api/issues/83#issuecomment-5571978843) rather than duplicated.

## Known upstream records

- CatholicOS API PR #27 closes API #83 and is the existing optional-auth/anonymous-suggestion prefix.
- CatholicOS web PR #57 is the existing web prefix but has no issue link in its current body.
- CatholicOS web #360 owns the narrower issuer-fail-fast residual; do not treat it as the product issue for the whole tranche.

Before sending, search the refreshed CatholicOS web tracker once more. If no issue already owns optional auth plus anonymous contribution, use the draft below. Otherwise update and link the existing issue rather than creating a duplicate.

## Web issue draft

### Title

Support optional authentication, anonymous proposals, and public ontology viewing

### Body

OntoKit should support a coherent optional-auth deployment: public users can browse public projects and propose guarded anonymous changes, while configured users can sign in for authenticated editing. A deployment with no Zitadel provider remains a supported anonymous-browsing configuration; partial or required-provider configuration must fail fast and must never fall back to localhost.

Acceptance criteria:

- Public project listing and graph viewing do not depend on a session.
- Sign-in UI appears only when a coherent provider configuration exists.
- Anonymous proposal sessions use the guarded credit/honeypot flow and cannot reach authenticated-only mutations.
- `AUTH_MODE=optional` works with all Zitadel values absent.
- Partial Zitadel configuration and required mode without a complete provider are refused during server startup/build validation.
- Both Standard and Developer viewer layouts remain usable without authentication.

The linked PR supersedes or refreshes web PR #57 and explicitly relates #360. It will include current-upstream replay, test, type, lint, build, and browser evidence.

## API issue update note

Do not create a duplicate for API #83. Update it only if the current acceptance criteria omit any of these hardened contracts:

- exact `required | optional | disabled` mode validation;
- optional mode with all provider credentials absent;
- refusal of partial provider credentials;
- anonymous suggestion authorization, rate limiting, honeypot, and cleanup behavior;
- public-project reads without a token;
- private/authenticated mutations remaining closed.

