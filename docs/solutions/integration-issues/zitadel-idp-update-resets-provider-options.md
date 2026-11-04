---
title: "Updating a ZITADEL identity provider from the v1 search silently disables sign-up"
date: 2026-11-04
category: integration-issues
module: authentication (ZITADEL v4.16.3 identity hub)
problem_type: integration_issue
component: authentication
symptoms:
  - "After a routine IdP change, new Google/GitHub users can no longer sign up or link accounts"
  - "admin/v1/idps/templates/_search shows providerOptions as null for every IdP"
  - "The PUT returns details (success), so nothing looks wrong"
root_cause: wrong_api
resolution_type: config_change
severity: high
retire_when: "ZITADEL's v1 admin template search returns providerOptions, or OntoKit manages IdPs only through the v2 API; check by running _search and seeing non-null providerOptions"
tags: [zitadel, idp, google, github, auto-linking, admin-api]
---

# Updating a ZITADEL identity provider from the v1 search silently disables sign-up

## Problem

On 2026-11-04 the demo hub's Google and GitHub sign-in lost account creation and linking for about 45 minutes. A script changed one option (`autoLinking`) by reading the IdP from the v1 admin search, editing `providerOptions`, and sending it back with a PUT. New social sign-ups would have failed until someone noticed.

## Symptoms

- `POST /admin/v1/idps/templates/_search` returns `config.providerOptions: null` for every IdP, although the options exist.
- `PUT /admin/v1/idps/{github|google}/{id}` succeeds whatever you send.
- `GET /v2/idps/{id}` afterwards shows only the field you sent, for example `{"autoLinking": "AUTO_LINKING_OPTION_EMAIL"}`. The four boolean flags have reset to `false`.

## What Didn't Work

- **Copying from the search result:** `dict(search_result["config"]["providerOptions"])` starts from `null`, so the PUT carries only the edited key.
- **Reading back through the same search:** it still returned `null`, so the readback could not show the damage.

## Solution

Read the current options from the v2 API. Always send the **full** option set on update, then verify through v2:

```python
opts = {"isLinkingAllowed": True, "isCreationAllowed": True,
        "isAutoCreation": True, "isAutoUpdate": True,
        "autoLinking": "AUTO_LINKING_OPTION_EMAIL"}
call("PUT", f"/admin/v1/idps/{kind}/{idp_id}",
     {"name": name, "clientId": client_id, "scopes": scopes, "providerOptions": opts})
assert call("GET", f"/v2/idps/{idp_id}")["idp"]["config"]["options"] == opts
```

The registration script `~/ontokit-demo-sso.sh` already sends all five options at creation time, so new IdPs start correct.

## Why This Works

`providerOptions` is a whole-object field on update. Anything omitted is reset, not kept. The v1 template search simply doesn't populate it, while `GET /v2/idps/{id}` returns the stored values. The cause is not wrong options in the store; it is a read path that hides them combined with an update that replaces them.

## Prevention

- Never build an IdP update from `admin/v1/idps/templates/_search`. Read `GET /v2/idps/{id}`, change one field, send them all.
- After any IdP change, verify all five options through v2. Don't trust the PUT's success response or the v1 search.
- Auto-linking by email is only safe while email verification is required for local sign-up. Without verification, an attacker can pre-register a victim's address and get linked when the victim later uses Google (account pre-hijacking). Toggle the two together.

## Related Issues

- Identity hub recipe: `docs/runbooks/identity-hub.md`
- Incident record: `docs/releases/baif-2026-11/README.md` (Incidents)
