---
title: "A firewall rules file is not persistence — verify the restore mechanism"
date: "2026-08-10"
category: security-issues
module: DEV infrastructure (CPX41 ontokit-dev)
problem_type: security_issue
component: tooling
symptoms:
  - "/etc/iptables/rules.v4 and rules.v6 present and current, so the hardening log recorded the F9 rules as 'persisted'"
  - "iptables-persistent and netfilter-persistent both uninstalled (dpkg status 'un'); iptables.service not-found"
  - "no systemd unit, /etc/network hook, or rc.local referenced iptables-restore or the rules files"
  - "a reboot would have silently dropped every DOCKER-USER and ip6tables INPUT rule guarding ports 3000/8000"
root_cause: incomplete_setup
resolution_type: config_change
severity: high
tags: [iptables, firewall, persistence, docker-user, systemd, reboot, absence-claims, infra-hardening]
---

# A firewall rules file is not persistence — verify the restore mechanism

## Problem

The F9 hardening (2026-08-08) locked DEV's app ports to proxy-only with iptables DOCKER-USER and ip6tables INPUT rules, and recorded them as "persisted" because `/etc/iptables/rules.v4` and `rules.v6` existed on disk. Nothing on the box loaded those files at boot: one reboot would have silently removed every rule — and during the window when DEV ran `AUTH_MODE=disabled`, those rules were part of what stood between the internet and a full-access application.

## Symptoms

- Rules files present and matching the live rule set — the state that *looks like* persistence.
- `dpkg -l iptables-persistent netfilter-persistent` → both `un` (never installed); `systemctl` → `iptables.service not-found`.
- Grep across `/etc/systemd/system/`, `/etc/network/`, and `/etc/rc.local` for `iptables-restore`/`rules.v4` → no hits.
- Discovered only because U7 (2026-08-10) added ports 8080/8081 for Zitadel and checked how the existing rules were being restored before trusting the same mechanism.

## What Didn't Work

- **Trusting the rules files as evidence of persistence.** On Debian/Ubuntu, `iptables-save > /etc/iptables/rules.v4` writes a file that *nothing consumes* unless a restore consumer (`iptables-persistent`/`netfilter-persistent`, a systemd unit, or an ifupdown hook) is installed and enabled. The file's existence is what the persistence *would* look like if it existed, which is exactly why the claim survived review.
- **Whole-table `iptables-restore` at boot was considered and rejected.** A saved filter table snapshot includes Docker's own `DOCKER`/`DOCKER-ISOLATION` chains as they stood at save time; restoring it after Docker starts re-injects stale container rules, and restoring before Docker starts gets partially overwritten. The classic “just enable netfilter-persistent” answer has this failure mode on Docker hosts.

## Solution

An idempotent rule script plus a systemd oneshot ordered after Docker, adding only the specific rules (never restoring a table snapshot):

```bash
# /usr/local/sbin/ontokit-firewall.sh — idempotent: -C (check) before -I (insert)
PROXY=204.168.246.227; SELF=178.156.208.239
for p in 3000 8000 8080 8081; do
  iptables -C DOCKER-USER ! -s $PROXY/32 -p tcp --dport $p -m conntrack --ctorigdst $SELF -j DROP 2>/dev/null || \
  iptables -I DOCKER-USER 1 ! -s $PROXY/32 -p tcp --dport $p -m conntrack --ctorigdst $SELF -j DROP
  ip6tables -C INPUT ! -i lo -p tcp --dport $p -j DROP 2>/dev/null || \
  ip6tables -I INPUT 1 ! -i lo -p tcp --dport $p -j DROP
done
```

```ini
# /etc/systemd/system/ontokit-firewall.service
[Unit]
After=docker.service network-online.target
Wants=network-online.target
[Service]
Type=oneshot
ExecStart=/usr/local/sbin/ontokit-firewall.sh
RemainAfterExit=yes
[Install]
WantedBy=multi-user.target
```

Enabled with `systemctl enable --now`; captured as IaC in ontokit-api `deploy/firewall/` (branch `feat/u12-dev-iac`).

## Why This Works

- **The script is the source of truth, not a snapshot.** Explicit `-C || -I` rule-adds are idempotent, survive Docker's own chain rewrites, and never carry stale container state the way a full-table restore does.
- **`After=docker.service` ordering** guarantees the DOCKER-USER chain exists before rules are inserted into it.
- **The unit is the *restore mechanism*** — the thing whose absence was the original defect. `systemctl is-enabled ontokit-firewall.service` is now a one-command persistence proof.

## Prevention

- **Never accept a rules/config file as evidence of boot persistence.** Verify the *consumer*: the package (`dpkg -l iptables-persistent`), the unit (`systemctl is-enabled …`), or the hook that actually loads it. The file is the payload; persistence is the mechanism that fires it.
- **Persistence claims carry their evidence**, same as absence claims (see the cockpit convention "Claims about machine state carry their evidence"): "persisted" should cite the restore mechanism and its enabled state, not the file listing. The 2026-08-08 log said "persisted" citing only `ls /etc/iptables/` — the claim was really about where someone looked.
- **On Docker hosts, prefer idempotent rule scripts over table snapshots** for DOCKER-USER hardening; snapshot-restore and Docker's dynamic chains are a known bad interaction.
- **Reboot-test hardening when feasible**, or at minimum trace the boot path of every security control added out-of-band.

## Related Issues

- Evidence trail: ontokit-web `docs/roundup-2026-08/DEV-UAT-LOG.md` (F9 entry 2026-08-08, corrected in the U7 standup entry 2026-08-09/10) and `docs/roundup-2026-08/DEV-RUNBOOK.md` (Firewall section).
- IaC capture: ontokit-api branch `feat/u12-dev-iac`, `deploy/firewall/`.
- Sibling lesson: the cockpit-level "two sessions asserted nothing monitors riehl-dev and both were wrong" incident (2026-07-27) — same failure shape, inverted sign: there an absence claim missed an existing mechanism; here a presence claim assumed a mechanism that never existed.
