# OntoKit development and EU hosting coordination

Historical research checkpoint. The later [execution receipt](eu-hosting-migration-receipt.md) supersedes this document’s ownership and source-retirement sequencing after Damien’s explicit September 21 direction. EU is now restored and the US source deleted; hosted acceptance remains open.

Evidence refreshed 2026-09-21. This is a research and continuation receipt, not
proof of a healthy deployment, an operational handoff, or completed migration.
The reviewed [migration plan](../plans/2026-09-20-1351-chore-eu-hosting-migration-plan.md)
remains the implementation contract. No server or application state was changed.

## Recovered decisions and session boundary

The dev-twin Astra session `01a0c007-9329-7b61-be50-442b46dd097e`
(2026-09-20, final response 19:00 UTC) was inspected through its local transcript.
The transcript is machine-local; this sanitized summary preserves the decisions:

- Damien accepted a few hours to recreate dev-twin and preferred a rebuild
  package with minimal carrying cost.
- After the cost inventory, Damien redirected the immediate work to OntoKit,
  explicitly preferred EU hosting, and requested isolated planning while the
  OntoKit recovery session continued.
- The Astra session created the reviewed migration plan at `ccf36a02` in this
  worktree. It did not perform recovery, deploy, transfer operational ownership,
  or retire either server. Its last response was a planning handoff only.

The current request confirms both outcomes matter: continue OntoKit functionality
and reduce hosting cost. Dev-twin retirement remains deferred rather than canceled.

## Evidence and limits

| Source checked | Finding | Consequence |
|---|---|---|
| Fresh read-only Hetzner API inventory | OntoKit server 160440821: CPX41, Ashburn, 8 vCPU/16 GB, running; no attached volumes or enabled server backups | Current cost target remains OntoKit; API running state is not application health |
| Fresh server-type catalog | CPX32: 4 vCPU/8 GB, EU availability reported true, USD 41.99/month; current CPX41 catalog USD 141.49/month | USD 99.50/month compute difference, USD 1,194 annualized; forecast only, excluding backup/storage/overlap and invoice reconciliation |
| Fresh server-type catalog | CX33 USD 9.99 and CX43 USD 18.49 unavailable in all three listed EU locations | Do not budget unavailable capacity or wait indefinitely for it |
| Fresh inventory of riehl-dev | Server 126068458: CX33, Helsinki, USD 9.99/month compute, one attached volume | Separate resource from OntoKit; total twin cost and workload ownership were not re-audited |
| Web roadmap at `1ba812df` checkout; D02 recovery/execution receipts | D06/D07 merged without deployment; D08 research next; hosted identity authority still blocked in recorded evidence | Local test success is not hosted acceptance; no healthy immutable pair or released operational ownership is established |
| Migration worktree at `ccf36a02` and D08 worktree at `83eaf957` | Their roadmap copies predate the latest D06/D07/D08 status | Refresh coordination from the newer documentation lineage, not just the worktree's local roadmap |
| API deployment workflow at D07 reviewed head `c7992100` | DEV deployment triggers on release-manifest changes or manual dispatch; old-host fallback remains | Development can continue with a pinned deployment contract; recheck remote workflow before relying on these trigger rules |
| dev-twin source at `cd08e47` and local symlinks | Home repo-login, repo-sessions, and cli-sessions-snapshot resolve into dev-twin | Preserve this repository and home tooling even if the cloud twin is retired |
| dev-twin STATUS versus failover runbook and tracked replication code | STATUS still says replication is not built, while later artifacts describe implemented replication | A later retirement must inventory installed senders and direction state; do not execute retirement from the stale status text |

The API inventory is not an invoice. No fresh SSH health, identity sign-in,
deployment queue, DNS, active-process ownership, or backup restore was tested in
this investigation. No credential values or private workload data were collected
into this receipt. The D02 service failures cited here are September 20 evidence,
not new health measurements.

Provider rules rechecked: [powered-off servers remain billable and primary IPs
bill separately](https://docs.hetzner.com/cloud/billing/faq/); [server snapshots do
not cover attached volumes](https://docs.hetzner.com/cloud/servers/backups-snapshots/overview/).

## Concrete continuation

1. **Keep independent functionality work moving.** Resume the roadmap's bounded
   D08 authentication lifecycle research on the merged D06 isolated test
   foundation. Use separate worktrees and disposable local services. Continue
   reviewed feature changes without changing the migration release manifest or
   dispatching hosted deployments. Neither D08 completion nor the whole B01–B75
   backlog is a prerequisite for this host move.
2. **Resolve D02's actual prerequisite.** The next hosted task is supported,
   same-version identity administration and recovery under the existing D02
   plan. Refresh current ownership and health first; verify the supported admin
   path rather than repeatedly trying already-rejected PATs or treating root
   SSH as identity authority. If no operator remains active after restart, record
   an explicit successor assumption of D02 ownership following queue/lock and
   observation reconciliation. Do not mistake session termination for handoff.
3. **Make the D02-to-migration handoff concrete.** Record the accepted API/web
   SHAs, manifest SHA, image identities, schema head set, installed assets,
   recovery/retention owner, deployment owner, observation register, and next
   check times. The healthy source and real authenticated smoke remain required.
   D02 continues to own application recovery; migration does not bypass it.
4. **Avoid repeating multi-day observations.** If no natural-time D02 cases have
   begun, prefer scheduling them on the final EU environment after the healthy
   baseline and migration acceptance subset pass. Record this sequencing in
   D02's observation register and keep B03 open. Existing observations must
   either complete unchanged or be explicitly invalidated and restarted; never
   carry source observations forward as EU evidence. This is a recommended
   sequencing refinement, not a claim that ownership has been released.
5. **Execute migration U1–U6 when their gates pass.** Refresh quotes and ingress,
   prepare reviewed portable deployment assets, prove off-host restore, rehearse
   the EU workload and full build, and prove post-write reverse recovery. Only
   then cut over, observe, and retire exact source resources. Do not provision a
   paid rehearsal host while unresolved prerequisites leave it idle indefinitely.
6. **Freeze deployment, not development.** During migration acceptance, keep the
   selected pair fixed. One operator owns deployment dispatch, routing and data
   authority. Feature branches may progress; changes to deploy assets, manifests,
   schema or workflows require coordination. A necessary release change gets a
   new baseline and reruns affected checks. After acceptance, resume normal
   protected deployment with queued feature work.
7. **Close the cost result explicitly.** Record backup and overlap costs, source
   deletion and retained IP/storage disposition; reconcile the later invoice.
   Then revisit dev-twin as a separate scoped retirement/rebuild project, including
   its shared workloads, unpublished work, installed replication senders, separate
   volume recovery and a measured rebuild rehearsal. Keep useful home tooling.

## Planning assessment

The existing migration plan already covers the important restore, capacity,
single-writer, rollback and cost-verification failure paths. Replacing it with a
second migration plan would introduce competing instructions. The useful next
iteration is a bounded readiness update using this receipt: reconcile ownership,
refresh the roadmap lineage and schedule observations before executing U1.

The current blocker is operational evidence, not a missing migration design.
If supported identity access remains unavailable after bounded diagnosis, record
the exact missing account capability and its owner; continue D08 independently.
No broader rebuild, identity reset, or relaxed acceptance gate is implied.
