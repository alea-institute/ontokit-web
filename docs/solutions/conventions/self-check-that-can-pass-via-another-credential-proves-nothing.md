---
module: ontokit deployment authentication
date: "2026-08-10"
problem_type: convention
component: authentication
severity: high
applies_when:
  - "verifying a newly installed SSH key while an ssh-agent or other ambient identity may be available"
  - "proving that a credential is constrained to a forced command or restricted principal"
  - "running cloud, database, or API checks where default or cached credentials exist"
  - "reviewing whether a green self-check establishes the exact claim attached to it"
tags:
  - ssh
  - identitiesonly
  - ambient-credentials
  - authentication
  - self-check
  - verification
  - negative-proof
  - forced-command
---

# A self-check that can pass via another credential proves nothing

## Context

A one-time command minted an SSH deploy keypair, installed the public half on the DEV box with `restrict,command="/usr/local/sbin/ontokit-deploy"`, published the private half to CI secrets, and ended with one self-check intended to prove two claims at once: the new key could authenticate, and authentication with that key was locked to the forced deploy command.

```bash
ssh -i $D/deploy-key \
  -o UserKnownHostsFile=$D/known_hosts \
  -o StrictHostKeyChecking=yes \
  root@HOST status \
  && echo 'SELF-CHECK OK' || echo 'SELF-CHECK FAILED'
```

The installation completed, but the check printed `SELF-CHECK FAILED` with `bash: line 1: status: command not found`. That loud failure was fortunate: it exposed that the check was not necessarily exercising the credential it claimed to verify.

## Guidance

**A verification step must be pinned to exactly the subject it claims to verify.** A check that can be satisfied by another credential does not test the intended credential, even when its result is green.

For SSH, `-i` adds an identity to the candidates; it does not restrict authentication to that identity. In this incident, `IdentitiesOnly=yes` excluded the unrelated agent identity and made the check use the intended deploy key:

```bash
ssh -i $D/deploy-key \
  -o IdentitiesOnly=yes \
  -o UserKnownHostsFile=$D/known_hosts \
  -o StrictHostKeyChecking=yes \
  root@HOST status \
  && echo 'SELF-CHECK OK' || echo 'SELF-CHECK FAILED'
```

If the selected host configuration declares other `IdentityFile` entries, isolate that configuration too — for example with `-F /dev/null` — before treating the check as pinned to one key.

Where practical, also prove the negative: rerun the verification without the intended credential and confirm that it fails. That negative control distinguishes evidence that the credential is necessary from a coincidence in which ambient authority made the same command succeed.

This is the same verification failure one layer below the sibling lesson “Tests that mock every seam prove nothing — every plan gets a real-seam proof unit”: there, a green suite never crossed the real seam; here, a green-capable self-check could cross the seam as a different principal. It is also the same family as “A firewall rules file is not persistence — verify the restore mechanism”: the passing condition must establish the claim, not merely resemble the state that would exist if the claim were true.

## Why This Matters

Verbose SSH output showed that an agent-backed identity was offered and that authentication succeeded using public key authentication. The operator's pre-existing admin key authenticated as an unrestricted principal, so the forced command attached to the new deploy key never ran. The server instead tried to execute `status` in the unrestricted shell and reported it as an unknown command. With `IdentitiesOnly=yes`, SSH authenticated with the intended deploy key and returned the forced command's real output.

The observed failure was loud, but the mirror case is the dangerous one. Had another offered credential been subject to the same forced command — or had the ambient principal otherwise made the requested `status` operation succeed — the check could have printed `SELF-CHECK OK` while proving neither that the new key worked nor that it was restricted. Green output is only evidence after every unintended route to green has been excluded.

The same shape appears wherever ambient credentials exist: a cloud CLI check can succeed through its default profile rather than the new role, a database connectivity test can reuse a pooled superuser connection rather than exercise the new grant, and an API smoke test can pass because a cached session cookie is present. Ask of every green check: *what else could have made this pass?*

## When to Apply

- When verifying a newly created, rotated, or restricted SSH key on a machine where an SSH agent or default identities may be available.
- When a setup command both provisions a credential and uses a final self-check as evidence that provisioning succeeded.
- When validating least-privilege behavior, forced commands, roles, grants, profiles, service accounts, or sessions in an environment with ambient authority.
- When a green check will be recorded as operational, security, or deployment evidence.

## Examples

- **SSH:** use `-i $D/deploy-key -o IdentitiesOnly=yes` and ensure no additional configured identities are in scope; do not treat `-i` alone as identity pinning. Remove the intended key for a negative-control run and confirm authentication fails.
- **Cloud CLI:** select the new role with an explicit `--profile` or explicit credential source, isolate inherited environment credentials, and verify that the same request fails without that profile.
- **Database:** create a fresh connection with the new principal rather than borrowing a pool that may already contain a superuser session; omit the new grant and confirm the protected action fails.
- **API:** start from a clean cookie jar and send the explicit token under test; repeat without it and require an authentication failure rather than allowing a cached browser session to satisfy the request.
