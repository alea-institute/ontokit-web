---
title: Google Federation via Zitadel - Plan
type: feat
date: 2026-08-10
topic: google-federation-zitadel
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
product_contract_source: ce-plan-bootstrap
execution: code
---

# Google Federation via Zitadel - Plan

**Target:** Zitadel instance config (ontokit-api infra scripts/docs) + a small ontokit-web copy touch. Trigger-gated: implement when login friction becomes a live user complaint — not before.

## Goal Capsule

- **Objective:** Let users sign in with an existing Google account without changing OntoKit's identity model — Google federates INTO Zitadel as an external IdP, so the app keeps one issuer and stable Zitadel user IDs.
- **Product authority:** The 2026-08-10 SSO verdict (Reject the provider switch; keep Zitadel) — this plan is that verdict's "Conditions" line made executable. It closes the original outline's "or maybe simply Google login" intent as UX, not migration.
- **Stop conditions:** If Login V2's social-callback URI proves broken on the deployed instance and no fix lands upstream, stop and report — do not fall back to adding Google as a second NextAuth provider (that reintroduces the dual-issuer identity split the verdict rejected).

## Product Contract

### Summary

Add Google as a federated identity provider inside Zitadel with auto-create and account-linking enabled. Users clicking "Sign in with Google" on Zitadel's login page get a Zitadel user (opaque numeric ID) like any other — trust ladder, audit snapshots, and superadmin config are untouched.

### Requirements

- R1. A user with a Google account can complete first-time sign-in via Google from the OntoKit login flow and lands as a normal Zitadel-issued session (same issuer, same token shape).
- R2. A returning email/password Zitadel user who signs in with Google on the same email links to the existing account rather than minting a duplicate (linking prompt acceptable).
- R3. No change to stored user IDs, roles, trust tiers, or the anonymous path; ontokit-web and ontokit-api require no auth-code changes for R1/R2.
- R4. The federation is optional: email/password login keeps working unchanged.

### Scope Boundaries

- No NextAuth Google provider (dual issuer) — rejected by the SSO verdict.
- No Workspace/Admin SDK integration; consumer Google accounts only.
- No forced migration of existing users to Google.

## Implementation Units

### U1. Configure Google IdP in Zitadel

- **Goal:** Google appears as a login option on the deployed Zitadel instance.
- **Files:** `ontokit-api scripts/setup-zitadel.py` (extend provisioning; idempotent), `ontokit-api docs/ZITADEL_SETUP.md` + `docs/roundup-2026-08/DEV-RUNBOOK.md` (ops steps), secrets via the box's `.env` pattern (`GOOGLE_FEDERATION_CLIENT_ID`/`_SECRET`) — never in-repo.
- **Approach:** Create a Google OAuth client (web application) in Google Cloud Console with the Zitadel instance callback (`https://ontokit-auth.dev.openlegalstandard.org/ui/login/login/externalidp/callback` — verify the exact path against the deployed Login V2, see U2). Register it in Zitadel as a Google provider (templated) with auto-creation, auto-linking on verified email, and auto-update enabled; activate on the org's login policy.
- **Test scenarios:** R1 first-time Google sign-in mints a Zitadel user; R2 same-email linking; R4 password login unchanged.
- **Verification:** Manual UAT on DEV with a persona Google account; `DEV-UAT-LOG.md` entry.

### U2. Verify the Login V2 social callback (the flagged caveat)

- **Goal:** Confirm the deployed `zitadel-login` container handles the external-IdP callback; pin the working callback URI in the runbook.
- **Files:** `ontokit-api docs/roundup-2026-08/DEV-RUNBOOK.md`.
- **Approach:** The external-evidence pass flagged Login V2 social-callback URI reports as the one under-corroborated claim. Exercise the full round-trip on DEV before declaring done; record the exact URI and any Host-header caveat (the instance already needs Host-pinned health checks).
- **Test scenarios:** Full Google round-trip lands authenticated in OntoKit (AUTH_MODE optional).
- **Verification:** Screenshot/log evidence in the UAT log.

### U3. Login-page copy touch (web, optional)

- **Goal:** ontokit-web's sign-in page copy doesn't contradict the new option.
- **Files:** `ontokit-web app/auth/signin/page.tsx`.
- **Approach:** The button already just redirects to Zitadel (`signIn("zitadel")`) — Google appears on Zitadel's own page, so likely zero code change; adjust the button label/subtext only if UAT shows confusion.
- **Test scenarios:** none — copy-only; existing signin tests stay green.
- **Verification:** `npm run test` + visual check.

## Verification Contract

| Gate | Command / evidence | Done signal |
|---|---|---|
| DEV UAT round-trip | Manual: Google sign-in → authenticated session → suggest/edit per role | R1–R4 observed, logged in DEV-UAT-LOG.md |
| Web suite (if U3 touches code) | `npm run test` && `npm run type-check` | Green |

## Definition of Done

R1–R4 proven on DEV, runbook updated with the verified callback URI and secret-handling steps, no auth-code changes required in either repo (or the deviation documented), UAT log entry recorded.
