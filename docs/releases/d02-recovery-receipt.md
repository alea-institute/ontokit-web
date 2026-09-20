# D02 recovery prerequisite receipt

Status: **Recovery proof passed; U1 remains partial because supported identity administration is unavailable. No live migrations, deployment, credential replacement or fixtures were performed.**

Evidence collected 2026-09-20 UTC for [D02 plan](../plans/2026-09-20-1323-chore-dev-recovery-acceptance-plan.md). User standing delivery authorization applies. The executing D02 operator owns recovery retention and the remaining identity gate.

## Containment and identity

- `gh variable set PROD_ENABLED --body false --repo alea-institute/ontokit-api` succeeded; `gh variable get` returned `false`. A future release must still prove its promotion job is skipped.
- Supported HTTPS identity `GET /auth/v1/users/me` and `POST /admin/v1/orgs/_search` returned HTTP 401 / RPC code 16 for both stored administrator and Login service PATs. The separately configured API service token also returned 401 on auth-me. Values were never printed or copied into repository artifacts.
- An administrator password is configured; its presence is not proof of a valid supported administrative session. No password reset, direct identity-database change or replacement token was attempted. Root SSH access does not establish identity authority.
- Parent browser inspection found no existing DEV identity tab and encountered `ERR_BLOCKED_BY_CLIENT` opening the console. Browser protections were not disabled. A supported valid administrator session or credential remains necessary before identity repair and persona setup.

Local-machine follow-up found working administrator credentials for the separate local Zitadel instance. After explicit user authorization, the local administrator PAT was tested against hosted DEV and returned HTTP401. The local API service token is identical to that PAT, so it is not a second independent candidate. No token value is retained here. A configured hosted administrator password exists, but no usable supported sign-in path has been verified.

## Coordinated recovery set

Host durable location: `/var/backups/ontokit/d02-20260920`, owned by root with directory mode 0700 and top-level backup files restricted to owner access. The complete private recovery set is approximately 201 MB. It includes sensitive operational data and stays on the operator host; only sanitized evidence appears here.

The existing `/var/lock/ontokit-deploy.lock` was held through backup and resumption. Original container states were recorded. Web, API, worker, Login, Zitadel and Mailpit were stopped. PostgreSQL reported **zero other client backends**. Redis `SAVE` succeeded; Redis and Minio were stopped. Logical database dumps were taken before PostgreSQL was stopped for the raw volume archive. The boundary was **2026-09-20T18:37:29.326494+00:00**.

Retained artifacts:

- PostgreSQL globals and custom-format dumps of `ontokit` and `zitadel`.
- Five volume archives: PostgreSQL, Redis, Git repositories, Minio and Zitadel credential storage.
- Installed Compose, private environment configuration, deployment script, Caddy configuration and database initialization assets.
- Original container state, image IDs and RepoDigests, volume metadata, database owners/extensions/table counts, Redis persistence settings, UTC boundary and SHA-256 manifest.

All eight original images remain on the host. No image pruning was performed. The original unhealthy application state is recoverable, but is **not** a known-good application rollback. This same-host backup is not off-host disaster recovery.

The operator retains this full recovery set until a superseding recovery proof and explicit retention review. Re-evaluation date: **2026-10-20**; there is no automatic deletion. The private `owner.txt` records this policy.

## Actual isolated restore verification

Every volume archive was extracted under the restricted `restored-baseline` directory and compared against its archive using `tar --compare`: all five passed. Every original backup manifest checksum matched.

A separate PostgreSQL container used the exact original pinned pgvector image, a new `d02_recovery_postgres_baseline` volume, `--network none`, no published ports and no application workers. Globals were restored with `ON_ERROR_STOP`; the existing bootstrap `CREATE ROLE postgres` statement was intentionally omitted while its subsequent role attributes were restored. Both databases were created with their original owners, then restored with `pg_restore --exit-on-error`.

| Database | Owner | User tables | Extensions | Verification |
|---|---|---:|---|---|
| ontokit | ontokit | 0 | plpgsql 1.0; vector 0.8.6 | Owner, extensions and empty schema matched |
| zitadel | zitadel | 143 | plpgsql 1.0 | Owner, extensions, complete table list and every table row count matched |

There is no live application Alembic table/head to preserve: the configured application database has no user tables. Candidate migration rehearsal is still required on a **separate restored copy** before live migration; this baseline must remain untouched.

Redis is configured for RDB persistence (`dump.rdb`, `/data`, AOF disabled). The restored 89-byte RDB passed the pinned Redis image's `redis-check-rdb` with exit code 0. Restored Git contained 57 files / 41,813,745 bytes, Minio 33 files / 21,085,951 bytes, and identity storage two files / 556 bytes. Archive comparison preserves their original bytes and metadata.

**Cross-store limitation:** Existing Git and object data coexist with an empty application database. They are preserved preexisting, unmapped data; no claim is made that they correspond to live project rows. Do not delete them as fixture cleanup.

The isolated `d02-recovery-postgres-baseline` container is stopped with exit code 0; its volume and extracted baseline remain owned by the D02 operator for recovery and rehearsal preparation. They have no public ingress or running integrations. Cleanup requires explicit review after a successor verified recovery exists.

## Resumption and cleanup capability

The supervised backup completed its `finally` resumption without interruption. PostgreSQL, Redis, Minio, Mailpit and Zitadel returned healthy; web returned running. API and worker returned to their original restart failure. Parent verification found Login running and unhealthy, with its invalid service credential unresolved. No deployment lock or maintenance process remains owned by this unit.

No fixture was created. Source inspection confirms normal project deletion commits the database change and catches Git deletion failures; it does not clean uploaded objects. Future acceptance must record only its own project UUIDs and object prefixes before deletion, independently verify Git cleanup, and use the reviewed UUID-scoped `StorageService.delete_project_files` remediation with a live database session to preserve references from every project. Existing unmapped stores are excluded. This capability is code-inspected, not yet authenticated or exercised on DEV.

## Evidence strategy and remaining gates

No product behavior changed and no mock tests were added. Operational correctness was verified through coordinated backup, actual isolated database restores, archive comparison, row-count/owner/extension checks and Redis persistence validation. Source inspections covered deployment locking, Compose service dependencies, project deletion, UUID-scoped Git deletion and reference-preserving object deletion.

Remaining gates: supported identity administrator authority; candidate migration rehearsal on a separate copy; reviewed host assets and protected matched deployment; real identity cleanup authority and authenticated disposable acceptance. U1/U2 and B02 must not be marked complete from this receipt alone.
