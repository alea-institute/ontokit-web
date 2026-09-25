# EU hosting migration execution receipt

Started 2026-09-21. Status: source retired after independent restore proof; EU build and acceptance in progress.
Execution: native host orchestration; bounded independent research may use agents.

## Current user direction supersedes the original sequencing

On September 21 Damien confirmed no other operator is changing DEV, said he
believes it has never been operational, made EU migration the highest priority,
and authorized autonomous execution including earlier US retirement when the
resources are unnecessary. This session accepts DEV migration ownership.

Accordingly, repairing and accepting the unhealthy US application is no longer
a prerequisite for relocation or retiring an unnecessary source. The original
plan's healthy-source comparison and mandatory pre-retirement observation order
are conditional on finding an actual service to preserve. The historical plan
remains unchanged; this receipt records the newer instruction and deviations.

Preservation still requires independent recovery and an actual restore check.
Existing Git/object/identity state must not be inferred disposable from the empty
application schema. No identity reset, loss of acknowledged writes, unrelated
resource deletion, or infrastructure-protection bypass is authorized by this
sequencing change. Hosted functional acceptance remains open until demonstrated
on EU. D08 may proceed independently against its isolated local stack.

## Initial observations

- Canonical web worktree: migration branch `docs/eu-hosting-migration-20260920`,
  starting `cf3835d3`, initially clean. Earlier branch commits are pre-existing.
- Fresh SSH observation at 2026-09-21T11:44:54Z: API and worker still restart;
  Login is unhealthy. Web and backing services run. Caddy is active.
- US source is Hetzner server 160440821, `ontokit-dev`, Ashburn CPX41. Provider
  catalog price checked this session's preceding investigation: USD141.49/month.
- The retained D02 recovery directory exists on source (381 MiB including its
  restored baseline). It is not yet an independent recovery copy.
- Source data-volume archives, identity/application logical dumps, private host
  configuration and original image identities exist. Fresh state and current
  application table counts remain to be checked before any retirement.
- Candidate remains EU CPX32 at USD41.99/month before IPv4/recovery storage,
  subject to fresh availability and capacity verification.

## Ownership and remaining gates

This operator owns source fencing, backup retention, target provisioning, ingress
and deployment changes. Source deletion requires exact resource identity,
independent encrypted recovery/key access, successful restore, preservation of
unmapped data, and evidence no needed service still relies on the source.

U2 must remove the workflow's old-IP fallback before deployments resume. U3 must
preserve recovery outside the source. U4 must establish EU health/capacity; no
performance comparison to a healthy US baseline can be claimed if none exists.
U5 must prove one writer and the correct ingress/deployment target. U6 separates
stopped spend from hosted acceptance and later invoice reconciliation.

## U1/U3 evidence and live operations

- DEV workflow 331331024 is `disabled_manually`; no in-progress or queued API
  workflows were observed. Repository `PROD_ENABLED=false` remains set. Restore
  workflow enablement only after explicit EU target/key verification.
- Source's nine application/backing containers were stopped under the deployment
  lock. No other database clients remained at the backup boundary. Source is
  intentionally fenced; no writes have been acknowledged on EU.
- Fresh application database still has zero user tables. Identity has 143.
  Source inventory found no other application containers or custom root cron.
- The recovery set includes logical dumps/globals, five quiesced volume archives,
  private host configuration/repositories, the retained D02 recovery set, and all
  original running images. The encrypted home archive is 4,435,248,504 bytes,
  SHA256 `c2403fc5578341cc6c6562f4ee4f2ffa4784213cd48bb2f5418d94d2a37cff17`.
- Durable machine-local recovery home: an owner-only directory outside every Git tree
  on Damien's home machine, owner-only access. New age identity is stored there,
  separately from the server; no key is committed or sent to the source/target.
  This operator retains it and the archives through at least 2026-10-20 and until
  an explicit superseding recovery/retention review; no automatic deletion.
- Actual independent decryption, all 16 checksums, all five extracted archive
  content comparisons, and PostgreSQL logical restores passed. Both database
  owners/extensions/table inventories and every table row count matched.
  Proof ran with network disabled and no published ports; proof container removed.
- Preserved Git: 57 files / 41,813,745 bytes; MinIO: 27 files / 21,081,199 bytes;
  Redis: one 89-byte RDB; identity credential volume: two files / 556 bytes.
  These remain unmapped preexisting stores, not disposable fixtures.
- EU server 166772379, `ontokit-dev-eu`, CPX32 in Helsinki, IP `77.42.71.53`,
  created with delete/rebuild protection. Current compute quote USD41.99/month.
  SSH initially restricted to operator and source /32s; no public application
  ingress. Docker29.1.3 and Compose2.40.3 match source packages exactly.
- Initial EU SSH host identity was compared from home and the pinned source
  host, then pinned for strict checking. ED25519 fingerprint:
  `SHA256:dxGnz+/XWrLF9ICUhggjXntA30yBTSYs6MWtl2weVwM`.
  This is initial trust from matching network observations, not provider-console
  attestation. A rejected earlier provisioning attempt made no resource changes;
  the successful script contains no private host key and narrows SSH sources.
- Actual ingress is Traefik on separate `riehl-dev` (`204.168.246.227`), whose
  OntoKit-only dynamic file forwards to source. Source Caddy is a default static
  page, not the application ingress. Preserve this proxy and its unrelated routes.
- EU data transfer checksums passed and all five owned volumes were restored.
  Initial image pulls found pinned MinIO unavailable from its registry. Exact
  preserved images were transferred and loaded by exact content identity. EU raw
  restore matched both databases (0 application / 143 identity tables and every
  row count); no supporting service version was substituted.

## Early source retirement and EU routing

- At 2026-09-21T12:09:28.919156Z, server 160440821 was deleted. Provider readback
  confirms server and primary IPv4/IPv6 resources 144022365 / 144022366 absent.
  No attached volumes or unrelated services required retention on that server.
- The independent encrypted recovery archive also exists on EU at
  `/var/backups/ontokit/source-recovery-20260921.tar.age`; its SHA256 matches the
  home archive. The decryption identity remains on the home machine.
- The separate dev-twin/proxy remains intact. Only its OntoKit dynamic routing
  file was atomically changed: four backend URLs and one internal source-IP
  condition now target EU. DNS/TLS and unrelated routes were preserved.
- Repository and protected `dev-deploy` environment `DEV_DEPLOY_HOST` now both
  read back `77.42.71.53`; the deploy known-hosts secret contains the pinned EU
  public host key. Workflow remains disabled pending verified EU deployment.
- EU provider firewall allows SSH only from the current operator /32, and four
  application ports only from the proxy /32. The retired source allowance was
  removed. GitHub runner SSH connectivity is not established yet.
- Selected clean application pair on EU: API
  `13ad2f35d55196274c5fec313bfb254a7cc80226`, web
  `83eaf9574315b71a165b80370dd964572d2ccac9`. Builds run with memory/disk sampling.
- Quoted compute drops from USD141.49 to USD41.99 per month: USD99.50 monthly
  reduction before IPv4, overlap, recovery storage, tax and invoice reconciliation.
  This is a resource-rate forecast, not measured invoice savings.

Full EU functional/capacity acceptance, protected deployment and invoice reconciliation
remain incomplete. Basic hosted sign-in and project metadata writes now pass; DEV
is not yet fully accepted. The source is gone; rollback now
means restoring preserved state onto a replacement resource, not restarting US.


## EU application preparation and current acceptance boundary

- Both reviewed images built successfully in 508.5 seconds. Across 255 samples,
  minimum available memory was 55.39% and minimum free disk was 77.59%. This proves
  build capacity, not ontology workload capacity or a US latency comparison.
- Rehearsed migrations against a disposable clone of the restored application
  database, then applied the same image to the owned application database. Both
  reached Alembic `i7j8k9l0m1n2` with 43 tables. The rehearsal database was removed.
- The reviewed Compose contract needed four variables absent from the source
  `.env`; their exact values were recovered privately from original container
  metadata. No credential was rotated in that reconciliation.
- Installed the reviewed forced-command deployment script, preserved restricted
  deployment public key, and tested firewall script/unit with explicit EU/proxy
  configuration. IPv4 conntrack and IPv6 INPUT deny rules were read back.
- Runtime status proves API/worker `13ad2f35...` and web `83eaf957...`, equal to
  checked-out revisions with no drift. API, worker, PostgreSQL, Redis, MinIO,
  mail, identity core and Login are healthy; web runs. Login was repaired by the
  explicitly authorized recovery below; a fresh restricted-key status exits zero.
- Public web, API `/health`, and OIDC discovery return HTTP200 through TLS.
  Direct application ports 3000/8000/8080/8081 are blocked from the operator
  network. Login now passes its health assertion and real browser authentication;
  HTTP200 alone was not used as acceptance.
- [API PR52](https://github.com/alea-institute/ontokit-api/pull/52) merged as
  `f01caf638dfc92ddcdd0455eb12586ccf005ddef` at 2026-09-21T12:27:18Z with lint,
  tests, pyright, build, Docker preflight and Semgrep passing. It carries the
  explicit deployment target and configured firewall changes. Independent reviews
  passed after a reproduced insertion-failure defect was fixed. Validation: 19
  workflow tests, seven firewall groups, eight deploy groups, six production
  promotion groups, manifest validation and syntax/whitespace checks passed.
- Identity recovery has a documented, pinned-version-supported option: temporarily
  configure a single-instance IAM_OWNER system principal ([pinned runtime
  configuration](https://github.com/zitadel/zitadel/blob/beffd5e32e98a1518e5f6dc17acda93f7786cc1e/cmd/defaults.yaml#L808),
  [official authentication procedure](https://zitadel.com/docs/guides/integrate/zitadel-apis/access-zitadel-system-api)), replace only expired
  service PATs through the API, remove the principal, and verify revocation.
  The first automatic review required explicit authorization. Damien then replied
  “Yes, proceed.” Recovery completed at 2026-09-21T14:30:31Z: both existing service
  users received replacement PATs (expires 2026-12-20), both validate with HTTP200,
  the temporary runtime principal was removed, and its same JWT now returns401.
  Its private key and Compose override were deleted. No identity reset, master-key
  change, or database patch occurred. Schedule PAT renewal before expiry.
- GitHub has no registered repository runner. Protected deployment remains
  disabled: GitHub-hosted runner ingress is unresolved under the narrow SSH rule.
  The preserved forced-command key is installed, but CI SSH acceptance is unproven.

Remaining acceptance: full authenticated persona, ontology write and
rollback checks, representative workload capacity, protected CI deployment,
observation period and actual invoice reconciliation. D08 functionality planning
continues independently using the isolated D06 stack.

Machine-readable [verification evidence](eu-hosting-migration-evidence.json) includes
restore counts, sampled build capacity, migration parity, public probes and exact
installed-asset hashes. Independent copies also remain in the private home
recovery directory. Organization-level runner discovery returned HTTP403 because
the current GitHub token lacks runner-administration scope; availability of an
existing organization static-IP runner is unknown. Do not infer that none exists.

## Deployment regression discovered during manifest review

[Draft API PR53](https://github.com/alea-institute/ontokit-api/pull/53) aligns the
manifest with the actual EU pair. It remains unmerged and does not authorize
activation. Its independent review identified an existing defect: a same-pair
redeploy overwrites `.deploy-previous` before build/readiness checks, so a failed
retry can lose the older rollback target. Two new regression groups failed on
the original script. A focused fix now passes all ten deploy test groups and
retains the previous pair through build, startup, health, revision and success
outcomes; it also avoids fabricating history when no older pair exists.

The same follow-up reconciles the tracked Traefik file with installed EU routing
(all five destination/source-IP occurrences) and removes the executable historical
US bootstrap example. Parsed tracked/live YAML equality passed. Review completed and PR54 merged; the exact reviewed deployment script is
installed on EU.

The restored source `.deploy-previous` pointed to an older, unaccepted pair
(`435dc393...` / `83b62b0b...`). Under the deployment lock it was preserved as
`/var/backups/ontokit/eu-20260921/unaccepted-source-deploy-previous` and removed
from active rollback metadata. No accepted EU rollback pair exists yet. This
prevents treating historical source metadata as a tested rollback target; it
does not delete its history or replace the independent recovery archive.

D08's [required-auth lifecycle plan](../plans/2026-09-21-0727-test-required-auth-lifecycle-plan.md)
is reviewed and locally committed at `6b5d4fa6` in its isolated worktree. Six native
lenses and three independent Claude reviews produced no unresolved decisions.
The plan retains all 21 D06 cases, requires real cookie boundary controls, and
keeps optional/disabled modes separate. Implementation has not begun.

The rollback review also retained pre-existing partial-checkout retry and failed
rollback/forward-target history weaknesses. The bounded same-pair guard does not
establish transaction-wide recovery correctness. Keep normal deployment and
rollback acceptance open until these failure boundaries are resolved or a
verified operational recovery path satisfies the plan.

Protected `dev-deploy` now permits only the exact `dev` branch. Existing required
reviewers and self-review behavior were preserved and read back. The frozen
`feat/pr-party` deployment job was inspected and still uses this environment,
so the new branch policy blocks that historical workflow copy. The main workflow
remains disabled; this stricter branch rule does not claim runner connectivity
or deployment acceptance.

The existing private deployment key was found in its established owner-only home
location. Its public half matched the preserved restricted authorization. A real
SSH connection using only that identity and the pinned EU host key authenticated
and returned accurate status (initially nonzero for unhealthy Login; after
recovery and checkpoint restart, exit zero with all required services healthy and
no revision drift).
An arbitrary `id` request returned the forced command's refusal code64 without
executing a shell. This verifies the operator-network key path only, not CI
runner ingress.

[API PR54](https://github.com/alea-institute/ontokit-api/pull/54) now contains the
reviewed same-pair rollback guard, EU ingress snapshot and corrected runbook.
All required checks passed and PR54 merged at 2026-09-21T12:50:37Z as
`a2d483624e472883151c01ea2d4862a5860ed31b`. Installed the reviewed script atomically
under the deployment lock and verified its exact SHA256 against the reviewed
commit. This does not close the documented broader recovery gates.

The exact newly built EU API/web images are now preserved independently in
`eu-candidate-images.tar.gz.age` in the private home recovery directory:
3,446,559,255 bytes, SHA256
`8300294e6dec4a43940dc65d35bcb0c8891c8fa8fbd42a678c1d267f18c309b1`.
The existing age identity decrypts this archive. Supporting images remain in the
original full source recovery archive. No rebuilt image is treated as functionally
accepted merely because it was archived.

Independent decryption and streaming validation of the new candidate-image
archive passed: both OCI image indexes and revision labels match, all referenced
layers are present, all 41 content-addressed blobs match their digests, and the
encrypted archive authenticates. This is archive integrity/identity proof, not
a second Docker-load or functional-acceptance claim.

## Identity recovery and browser acceptance — 2026-09-21

A fresh ordinary test user completed the actual public OIDC flow. The browser
created private project `b241dbb2-840d-4b56-8106-8a1854acf752`, named
`eu-migration-20260921143412`. A full page navigation to its settings preserved
its name, description, privacy and owner. Normal app sign-out led to the provider's
account logout and “Logout successful”; a fresh app navigation showed Sign in.
This proves the focused metadata smoke, not ontology editing or the full D02
persona matrix. Browser snapshots and supported controls were used without
extracting session cookies or access tokens.

Deleting this disposable project was rejected by automatic approval review pending
fresh confirmation. The account and project remain intact, and an inline cleanup
question is pending. Neither was used to alter existing users or unmapped stores.
Run-owned credentials remain only in private recovery storage.

A coordinated checkpoint quiesced application/identity writers under the deployment
lock, verified zero remaining database clients, captured logical databases and five
volumes, and saved private configuration including the repaired service credentials.
An initial unordered container restart left Login stopped because it shares core's
network namespace; starting it after core resolved that dependency. All containers
subsequently passed the same restricted-key status check with no revision drift.
Future checkpoint scripts must restart dependencies before their dependents.

The independent encrypted home copy `eu-post-identity.tar.age` is 234,553,448 bytes,
SHA256 `23101a54943acbb747ba7ce740a63a95f2d0043e887fb649162283b13f24b6d9`.
Decryption, all 15 checksums, and all five extracted volume contents match. Actual
isolated PostgreSQL restores verified 43 application and 143 identity tables,
including every row count, owner and extension. The proof container had no network
or published ports and was removed. This checkpoint includes the disposable fixture
pending cleanup. A separate application restore also matched the exact browser-
acknowledged project ID, name, description, private visibility and owner. This
proves recovery of the metadata write; ontology edits and application rollback
remain untested. Exact application images remain in their independent image archive;
original source recovery remains retained. The same retention boundary applies:
through at least 2026-10-20 and a superseding review, never automatic deletion.

## Concrete continuation

1. Resolve the pending inline permission for deleting this run's ordinary account
   and project. Preserve both until approval; do not substitute a different deletion
   route. After approved cleanup, record the result and take an incremental current
   identity/application checkpoint while retaining the proven recovery boundary.
2. Complete the full authenticated persona, ontology write/recovery and representative
   workload checks. The current real login/create/reload/logout smoke is a useful
   baseline, not full hosted acceptance.
3. Resolve the recorded broader rollback-history cases and the restricted GitHub
   runner path. Organization runner discovery needs appropriate account access;
   do not open management SSH globally or install a general CI runner on the
   application host as an unreviewed shortcut. Reconcile draft PR53 against the
   actual accepted pair, then verify a normal protected deployment on `dev`.
4. Start and complete the required observation period only from an accepted
   baseline, retain independent recovery, and reconcile actual provider billing.
   Current USD99.50/month compute reduction is still a forecast from resource
   rates, not an invoice result. Renew both service PATs before 2026-12-20.

D08 can proceed through its reviewed isolated plan independently. Its optional/
disabled-mode matrix and remaining B11–B15 boundaries stay in the roadmap. The
original root checkout was not changed by these edits; refreshed migration tracking
is in this worktree. API PR52/54 are merged, PR53 is draft, and D08 planning is
committed locally, not pushed. Migration documentation is also local-only.
