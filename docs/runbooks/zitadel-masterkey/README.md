# Rotate the ZITADEL masterkey (v4.16.3)

ZITADEL has no supported masterkey rotation (upstream issue zitadel/zitadel#6768, still open). This runbook re-wraps ZITADEL's data keys from the old masterkey to a new one. It was executed on the EU DEV/demo hub on 2026-11-04: rehearsal first, then the live cutover. Every check passed with zero decrypt errors.

## Why this works

- **One table:** the masterkey encrypts only `system.encryption_keys`: 11 rows (`csrfCookieKey`, `domainVerificationKey`, `idpConfigKey`, `oidcKey`, `otpKey`, `samlKey`, `smsKey`, `smtpKey`, `targetKey`, `userAgentCookieKey`, `userKey`). Each row holds a 32-byte data key. See `cmd/initialise/sql/07_encryption_keys_table.sql` and `cmd/encryption/encryption_keys.go` at tag v4.16.3.
- **Row format:** `base64.URLEncoding(IV(16) || AES-256-CFB128(dataKey))`, with the 32-character masterkey bytes used directly as the key (`internal/crypto/aes.go`).
- **Nothing else changes:** events, projections, tokens, and cookies are encrypted with the data keys, so re-wrapping the 11 rows leaves them untouched.

## The big risk: a wrong key fails silently

AES-CFB has no authentication. A ZITADEL started with the wrong masterkey still passes `/debug/healthz`, `/debug/ready`, OIDC discovery, and the login page. It then corrupts anything it writes. So:

- **Prove the old key first:** `rekey.py` proves OLD by decrypting real stored secrets (the oracle) before it writes anything, and it refuses to run twice.
- **Test real operations:** verification must call the admin API, run a real password session, and check the logs for `CRYPT-` / `failed to decrypt` / `QUERY-Iuk0s`. Health checks alone prove nothing.

## Files

| File | Purpose |
|---|---|
| `rekey.py` | Re-wraps every row in one SERIALIZABLE transaction: oracle-proves OLD, round-trips in memory, re-reads, then verifies after commit. `--dry-run` writes nothing. Reads `OLD_MASTERKEY`, `NEW_MASTERKEY`, and `PGDSN` from the environment; never prints keys. |
| `test_rekey.py`, `go_kat_vectors.json` | 14 tests: a NIST CFB128-AES256 vector, vectors produced by ZITADEL's own Go functions, and failure cases |
| `rehearse.sh` | Phase 1: back up, clone the DB, re-wrap the clone, start a throwaway ZITADEL against the clone, verify, tear down |
| `cutover.sh` | Phase 2: back up, stop ZITADEL and login, re-wrap live, move the key from `--masterkey` (visible in `ps`) to `--masterkeyFromEnv`, start, verify; auto-rollback on any failure |

## Procedure

1. **Rehearse:** copy the files to `/root/mkrot/` on the host and run `rehearse.sh` (stdin line 1 = an existing user's password for the session check). It must print `REHEARSAL PASS` and `decrypt errors ...: 0`.
2. **Cut over:** run `cutover.sh` the same way. It must print `LIVE VERIFY PASS`, `decrypt errors since start: 0`, and `CUTOVER COMPLETE`.
3. **Escrow:** copy the new key to the operator's owner-only credentials directory without displaying it. Keep the old key as long as you keep pre-rotation backups; old backups need the old key.
4. **Check from outside:** sign in through the public site in a real browser, and confirm the IdP buttons hand off.

## Rollback

`cutover.sh` rolls back on its own: it restores `.env`, `compose.yaml`, and the pre-cutover `pg_dump` of the `zitadel` database, then restarts. To do it manually: stop ZITADEL and login, then either run `rekey.py` with OLD and NEW swapped, or restore the dump and the old `.env`.

## After a real key leak

Re-wrapping protects data going forward. Anyone who already holds both a database copy and the old key still holds the data keys. After a confirmed leak, also rotate web keys, IdP client secrets, SMTP credentials, and PATs.
