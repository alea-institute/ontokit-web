---
title: "Hetzner Cloud blocks outbound SMTP on ports 25 and 465 — send mail on 587"
date: 2026-11-04
category: integration-issues
module: email delivery (ZITADEL SMTP on the EU DEV host)
problem_type: integration_issue
component: infrastructure
symptoms:
  - "ZITADEL's SMTP test send hangs, then times out (no error from the provider)"
  - "A TCP connect to the provider on 465 times out from the host, but works from elsewhere"
root_cause: config_error
resolution_type: config_change
severity: medium
retire_when: "OntoKit's mail moves off Hetzner Cloud, or Hetzner lifts the outbound block for the account; check with a TCP connect to smtp.resend.com:465 from the host"
tags: [hetzner, smtp, email, resend, zitadel, firewall]
---

# Hetzner Cloud blocks outbound SMTP on ports 25 and 465 — send mail on 587

## Problem

On 2026-11-04, configuring ZITADEL on the EU DEV host to send email through Resend at `smtp.resend.com:465` made every send hang until it timed out. Hetzner Cloud blocks outbound connections on ports 25 and 465 by default, so the connection never reached Resend. Nothing in OntoKit's code or config shows this.

## Symptoms

- `POST /admin/v1/smtp/{id}/_test` never answers, and the client times out.
- A probe from the host reports 465 as blocked or timed out, while 587, 2465, and 2587 open:
  `timeout 8 bash -c "exec 3<>/dev/tcp/smtp.resend.com/465"`

## Solution

Use port **587 with STARTTLS** (`smtp.resend.com:587`, TLS on in ZITADEL). The test send succeeded right away, and delivery reached a real Gmail inbox. If 587 is ever blocked too, Resend also listens on 2587 (STARTTLS) and 2465 (implicit TLS).

## Why This Works

Hetzner blocks 25 and 465, the ports used for server-to-server mail and implicit-TLS submission, to limit spam from new cloud servers. Port 587 is authenticated submission with STARTTLS and is not blocked. ZITADEL upgrades the connection with STARTTLS when TLS is on and the port isn't 465.

## Prevention

- Before choosing an email provider or port for any Hetzner-hosted OntoKit deployment, probe the ports from the host itself, not from a laptop.
- Prefer 587 STARTTLS by default on Hetzner. Implicit-TLS 465 only works after Hetzner removes the block on request.

## Related Issues

- Email setup and UAT: `docs/releases/baif-2026-11/README.md` (Sign-in and email)
- Identity hub: `docs/runbooks/identity-hub.md`
