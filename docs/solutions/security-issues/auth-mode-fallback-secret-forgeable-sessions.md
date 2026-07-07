---
title: "Permissive auth mode reused a known signing secret in a mode that still mints real sessions"
category: security-issues
component: auth
date: 2026-07-07
tags: [auth, nextauth, zitadel, jwt, session-forgery, auth-mode, secrets, byok]
severity: blocker
reviewer: kieran-typescript-reviewer (/ce:review)
commit: ca55c65
pr: alea-institute/ontokit-web#5 (PR-2 optional/anon auth)
---

# Auth-mode fallback secret → forgeable sessions

## Problem

Adding an `AUTH_MODE=required|optional|disabled` flag so OntoKit can run without
Zitadel, the extracted code injected a **hardcoded fallback** `NEXTAUTH_SECRET`
whenever `AUTH_MODE !== "required"`:

```ts
if (getAuthMode() !== "required" && !process.env.NEXTAUTH_SECRET) {
  process.env.NEXTAUTH_SECRET = "ontokit-optional-auth-secret"; // committed, known
}
```

This looks safe ("no auth → no identity to protect") but is **wrong for one mode:
`optional` + Zitadel configured**. That mode still mints **real authenticated
sessions** via Zitadel. NextAuth's JWT strategy validates only the *signature* of
the session cookie, not that a login actually happened — so with a known/committed
signing secret, anyone who reads the source can forge a valid session JWT and
**impersonate any signed-in user**.

## Root cause

The gate for *"is there a session worth protecting?"* was tied to the wrong
predicate. The real condition is **"is the OIDC provider active/configured?"**,
not **"is auth `required`?"**. `optional` mode is not "auth off" — it is "auth
available but not forced," and when Zitadel is configured it produces genuine
identities.

Two things let it hide:
- **No auth-mode tests existed** — the full suite was green while the hole was open.
- A **duplicated `showAuthUI` predicate** across `header.tsx` and `user-menu.tsx`
  masked a related client/server drift (the client `NEXT_PUBLIC_ZITADEL_CONFIGURED`
  checked only `ISSUER`; the server needed `ISSUER && CLIENT_ID`).

## Solution

Gate the fallback on **Zitadel configuration**, randomize it, and hard-require a
real secret whenever Zitadel is configured — in every auth mode.

```ts
// auth.ts — only auto-supply a secret when there are NO real sessions to protect,
// and never a fixed/replayable value.
if (!isZitadelConfigured() && !process.env.NEXTAUTH_SECRET) {
  process.env.NEXTAUTH_SECRET = randomBytes(32).toString("hex");
}
```

```ts
// lib/env.ts — strict schema (real NEXTAUTH_SECRET + Zitadel vars required) whenever
// auth is required OR Zitadel is configured; relaxed only when truly no Zitadel.
const strict = isAuthRequired() || isZitadelConfigured();
```

Supporting fixes: one shared `isAuthActive()` = `getAuthMode() !== "disabled" &&
isZitadelConfigured()` now gates the provider list, token refresh, and custom auth
pages (previously three subtly different conditions); a single client-safe
`shouldShowAuthUI()` replaces the duplicated predicate; the client flag now uses the
identical `ISSUER && CLIENT_ID` predicate as the server.

## Prevention

**When adding a permissive/anonymous mode to an auth system, audit every fallback,
default, and guard against the mode where real identities still exist — not just
the fully-open mode.** Concretely: (1) never derive a security posture from a
coarse mode enum when a finer "is the identity provider active" signal is the real
condition; (2) any auto-supplied secret must be random per-process, never a
literal; (3) keep client and server "is auth active" predicates identical and in
**one** place (duplication hides drift); (4) add tests for the new mode matrix —
a green suite with zero auth-mode tests is a false signal.
