---
title: Move OntoKit DEV to ALEA-controlled AWS
date: 2026-09-30
execution: knowledge-work
kind: approach-plan
status: prepared-local
---

# Goal and scope

Prepare an ALEA-owned DEV migration, following Damien's September 30 answer:
“Mike agrees that the DEV server should be on ALEA-controlled AWS server.”
This supersedes the old request for a scoped IAM key on the current setup.
It does not authorize this worker to provision resources, spend, send, or deploy.
Demo repositories and credentials (legacy B8) remain deferred. Domain registration
(legacy B7) stays with the Decision Sheet; neither is a migration prerequisite.

## Evidence and corrections

This worktree starts at `7ab0c48a3d78381425d15d4b75f99aaa6cf25ddb`.
The newer locally available web object `14597f6c434009398662f25db4e4a6b3b5b9cb45`
contains `docs/releases/eu-hosting-migration-receipt.md` and
`docs/releases/d10-suggestion-chain-readiness.md`. They record EU hosting after
US retirement, then paired DEV deployment web `787eecc4` / API `44b6dfd3` on
September 28. These are historical receipts, not current remote observations.
Do not plan a migration from the retired US resource or repeat its deletion.
The old `mike-aws-nudge` outreach premise is superseded; past sending remains unknown.

## Proposed topology and what moves

Use one ALEA-owned EC2 DEV host in an EU region, initially sized for at least
4 vCPU / 16 GiB RAM, with encrypted persistent EBS, independent encrypted backup
storage and narrow management ingress. Confirm capacity with the actual workload
before accepting it. Retain the existing Compose service topology initially:
web, API, worker, PostgreSQL application and identity databases, Redis persistence,
MinIO objects, repository Git data, Zitadel core/Login and internal Mailpit.
Preserve pinned images, migration versions, identity IDs, issuer, client redirect
URIs and configuration semantics. An authorized operator transfers configuration
privately; secrets do not enter this plan, transcripts or this worker's filesystem.
No RDS/EKS redesign is needed for the first DEV move.

## Implementation units for the deployment owner

1. **Account/access and budget:** confirm ALEA account, region, billing owner and
   temporary assumed-role access. Scope resource permissions to the DEV deployment
   and its tags; restrict any PassRole to the named instance role. Use existing
   approved access transport. Inventory current DNS/proxy ownership and resource
   needs before finalizing policy. No long-lived access key by email.
2. **Recovery boundary:** record current paired revisions, schema versions and
   runtime health. Under the deployment lock, quiesce all writers and make an
   independently stored encrypted checkpoint of databases, volumes, Git, objects,
   image identities and private configuration. Restore to isolated AWS storage;
   compare row counts/owners/extensions, object and Git integrity, and acknowledged
   writes. Resume source dependencies before dependents. Keep source intact.
3. **Identity and mail:** preserve Zitadel issuer URL and DB/key material through
   the operator path; rehearse real login/logout and callback behavior. If a hostname
   must change, first inventory issuer/audience/callback implications and coordinate
   that explicit change. Keep Mailpit internal; install only the approved disposable
   UAT recipient verb described in the companion plan. No general mail UI exposure.
4. **DNS/routing:** retain existing DEV public names and TLS where possible. Inventory
   authoritative DNS and the existing proxy before deciding whether only upstream
   routes or DNS records change. Save exact old records/routes, lower applicable TTL
   before cutover, validate TLS and OIDC through the intended names against AWS,
   then switch only DEV targets. Keep unrelated routes intact; do not register
   ontokit.org as an incidental migration step.
5. **Acceptance:** run the companion D10/B02/B03 matrix, capacity sampling and
   protected CI deployment/rollback proof using a verified compatible release pair.
   Preserve branch/environment protections and narrow runner ingress. Record the
   actual rollback reference; the currently deployed pair is not assumed accepted.
6. **Observation and retirement:** observe at least 24 hours after acceptance, including
   login, saved ontology reload, worker processing and backup restore. Compare actual
   billing. Retirement is separately owned and requires verified retained backups;
   this plan schedules no deletion, backup expiry or duplicate historical purge.

## Planning estimate (USD, assumptions rather than an AWS quote)

Network access was prohibited. No current AWS price was fetched. These round-number
unit allowances are for a budget conversation only; the deployment owner must quote
region-specific prices and obtain spend approval before provisioning.

| Component | Assumed arithmetic | Monthly allowance |
|---|---|---:|
| EC2 compute | 730 hours × $0.20/hour | $146 |
| 150 GiB persistent disk | 150 × $0.10/GiB-month | $15 |
| 100 GiB backup/snapshot storage | 100 × $0.06/GiB-month | $6 |
| Public IPv4 | 730 × $0.005/hour | $3.65 |
| DNS, logs, egress contingency | fixed allowance | $30 |
| Total | sum, rounded | about $201/month |

Use $250/month as a provisional budget ceiling to seek approval for, not authorized
spend. Tax, unusual traffic, managed NAT/load balancer and retained source costs are
excluded; obtain a revised estimate if needed. Seven days of overlapping target
service at this assumed rate adds about $47, plus the existing host's actual cost.
The historical receipt's $41.99/month EU compute figure is not a current AWS quote.

## Rollback

Before switching, save the source routing and a timestamped coordinated checkpoint.
On pre-write failure, restore routing to the unchanged source and validate login and
read/write smoke. After AWS accepts any writes, stop both writer sets and reconcile
or restore those writes into the selected recovery target before routing back; never
silently lose acknowledged data by reverting DNS alone. If source rollback is not
viable, restore the verified checkpoint and compatible image pair on a replacement
resource and reconcile later writes. Record the tested pair/checkpoint and recovery
time. Do not fabricate a `deploy-rollback-ref` from an unaccepted revision.

## One concrete ask for Mike — draft for Damien to send

> Mike — thanks for agreeing to host OntoKit DEV in an ALEA-controlled AWS account.
> Please provide the ALEA account ID, intended EU region, and a scoped assumed-role
> access path for our deployment agent to manage the DEV EC2 instance, encrypted
> storage/backups, networking and its DNS records (or identify the DNS owner if
> separate). Please use our approved secure access channel, not an access key in
> this message. We will bring the final cost estimate for approval before provisioning.

No send is claimed. Damien only needs to send this draft; Mike supplies the access
path, and the deployment owner confirms scope and cost before executing.

## Verification and definition of done

Local deliverable: migration scope, DNS, identity/mail, cost assumptions, rollback
and send-ready ask are present. Runtime code is unchanged. `git diff --check` is the
local document gate. `npm run test -- --run` was attempted but cannot run because
Vitest/dependencies are absent; do not install or treat that as a passing suite.
Hosted completion requires the observed acceptance and rollback evidence above.

## Integration

This standalone planning document can be cherry-picked onto the default branch
independently of the 674-commit delivery branch. Do not merge that entire branch
for this document. Orchestrator owns integration, sending and remote execution.
