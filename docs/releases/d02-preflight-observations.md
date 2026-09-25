# D02 preflight observations — 2026-09-20

Read-only host checks while D05 implementation proceeds; no deployment or host configuration changes. The obsolete waiting GitHub deployment was subsequently canceled under standing delivery authorization.

- SSH operator access succeeded using existing pinned host verification and existing key; no credentials were printed.
- Installed `/usr/local/sbin/ontokit-deploy`: root:root, mode755, SHA256 `96d0ed73d2ae4d62bfed084d6853ef5099f50091ad1ca260f693735b973d23aa`.
- Reviewed API baseline script SHA256: `533d0ceedb9374ecf996eae54816fb0dbf36baa6406755ad9239398ec17b40e3`. Installed script parity is not satisfied.
- Installed status command reports API checkout `773c51aa0dd2959fd07c48627d86d66639cd13fb`, web checkout `4cbe4d4c17437660b70764acb364d24b20ef20ba`. Its older output does not establish running image revisions.
- Both API and worker logs identify `PermissionError` errno13 reading relative `pyproject.toml`. Host checkout file is mode600 root:root; current reviewed Dockerfile explicitly copies that file with mode0644, and current deploy script uses checkout umask022. This is consistent with the already repaired source/image-permissions defect, but a rebuilt matched deployment is needed to prove recovery.
- Current API, worker and web containers carry no image-revision label in their container configuration; do not infer running revisions from checkout SHAs.
- API and worker: restarting/unhealthy. Login: running/unhealthy. Web: running. PostgreSQL, Redis, MinIO, Mailpit and Zitadel: running/healthy. No logs or environment values were disclosed.
- Old deployment run34155698435 at workflow head `6464f74c68fa942c96e5aa411b250254102c11e4` was canceled; GitHub now confirms status completed, conclusion cancelled. It cannot be mistaken for the new release.
- Repository Actions variables are empty. Effective organization-level PROD_ENABLED remains unverified; an empty repository list alone does not establish containment.
- dev-deploy environment retains required Damien review and allows self review. Existing user authorization covers normal deployment approval; protections must remain intact.

D02 must diagnose the unhealthy services, refresh the installed script under a verified release/rollback plan, establish the effective production gate, prove current credential validity without exposing values, and activate a reviewed immutable pair before authenticated persona acceptance. Existing operator access permits further investigation without asking the user. D05 remains the active implementation deliverable.
