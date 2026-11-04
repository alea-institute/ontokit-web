#!/usr/bin/env python3
"""Re-wrap ZITADEL's encryption keys under a new masterkey (ZITADEL v4.x, Postgres).

ZITADEL uses the masterkey only as a key-encryption key (KEK): each row of
system.encryption_keys holds one data key (DEK) encrypted with the masterkey.
Everything else in the database is encrypted with those DEKs, which this tool
does NOT change. Re-wrapping the DEKs therefore leaves every encrypted event
and projection readable.

Scheme (zitadel v4.16.3, internal/crypto/aes.go EncryptAESString/DecryptAESString):
    kek   = masterkey string bytes, exactly 32 bytes  -> AES-256
    row   = base64.URLEncoding( IV(16 random bytes) || AES-CFB128(kek, IV, DEK) )
            (URL-safe alphabet, WITH '=' padding)
    DEK   = 32 random bytes for ZITADEL-generated keys (crypto.NewKey)

CFB has no authentication: a wrong masterkey "decrypts" to random bytes without
error. This tool therefore proves the OLD masterkey with an oracle: it decrypts
real CryptoValue ciphertexts stored in eventstore.events2 and
projections.web_keys1 with the recovered DEKs and requires valid UTF-8.

Usage:
    OLD_MASTERKEY=... NEW_MASTERKEY=... PGDSN=postgresql://... \
      uv run --with cryptography --with 'psycopg[binary]' rekey.py --dry-run
    (same without --dry-run to write)

The masterkeys and DEKs are never printed.
"""
from __future__ import annotations

import argparse
import base64
import binascii
import os
import re
import sys
from dataclasses import dataclass, field

from cryptography.hazmat.primitives.ciphers import Cipher, algorithms

try:  # cryptography >= 46 moved CFB to "decrepit"; removal planned for 49
    from cryptography.hazmat.decrepit.ciphers.modes import CFB
except ImportError:  # pragma: no cover
    from cryptography.hazmat.primitives.ciphers.modes import CFB

BLOCK = 16
DEFAULT_KEY_IDS = (  # cmd/encryption/encryption_keys.go defaultKeyIDs
    "domainVerificationKey", "idpConfigKey", "oidcKey", "samlKey", "otpKey",
    "smsKey", "smtpKey", "userKey", "targetKey", "csrfCookieKey",
    "userAgentCookieKey",
)
_URLB64 = re.compile(r"^[A-Za-z0-9_-]*={0,2}$")


class RekeyError(Exception):
    pass


# ---------------------------------------------------------------- scheme ----
def kek_from_masterkey(masterkey: str) -> bytes:
    """[]byte(masterKey) in Go; checkMasterKeyLength demands exactly 32 bytes."""
    kek = masterkey.encode("utf-8")
    if len(kek) != 32:
        raise RekeyError(f"masterkey must be exactly 32 bytes, got {len(kek)}"
                         " (check for a trailing newline)")
    return kek


def aes_cfb_encrypt(plain: bytes, key: bytes, iv: bytes | None = None) -> bytes:
    """crypto.EncryptAES: IV || CFB128(plain)."""
    if iv is None:
        iv = os.urandom(BLOCK)
    if len(iv) != BLOCK:
        raise RekeyError("IV must be 16 bytes")
    enc = Cipher(algorithms.AES(key), CFB(iv)).encryptor()
    return iv + enc.update(plain) + enc.finalize()


def aes_cfb_decrypt(data: bytes, key: bytes) -> bytes:
    """crypto.DecryptAES."""
    if len(data) < BLOCK:
        raise RekeyError("cipher text block too short")
    dec = Cipher(algorithms.AES(key), CFB(data[:BLOCK])).decryptor()
    return dec.update(data[BLOCK:]) + dec.finalize()


def b64url_decode_strict(s: str) -> bytes:
    """base64.URLEncoding.DecodeString, but failing loudly.

    (ZITADEL's DecryptAESString silently returns "" on a decode error.)"""
    if not _URLB64.match(s) or len(s) % 4:
        raise RekeyError("stored key is not padded URL-safe base64")
    out = base64.urlsafe_b64decode(s)
    if base64.urlsafe_b64encode(out).decode() != s:
        raise RekeyError("stored key base64 is not canonical")
    return out


def unwrap(row: str, kek: bytes) -> bytes:
    """crypto.DecryptAESString(row, masterKey) -> DEK bytes."""
    return aes_cfb_decrypt(b64url_decode_strict(row), kek)


def wrap(dek: bytes, kek: bytes, iv: bytes | None = None) -> str:
    """crypto.EncryptAESString(dek, masterKey)."""
    return base64.urlsafe_b64encode(aes_cfb_encrypt(dek, kek, iv)).decode("ascii")


def decrypt_crypto_value(crypted_std_b64: str, dek: bytes) -> bytes:
    """CryptoValue.Crypted ([]byte -> std base64 in JSON), decrypted with a DEK."""
    try:
        raw = base64.b64decode(crypted_std_b64, validate=True)
    except binascii.Error as e:
        raise RekeyError(f"bad CryptoValue base64: {e}") from None
    return aes_cfb_decrypt(raw, dek)


def check_dek(key_id: str, dek: bytes) -> None:
    if len(dek) not in (16, 24, 32):
        raise RekeyError(f"key {key_id!r}: decrypted length {len(dek)} is not a valid AES key size")
    if key_id in DEFAULT_KEY_IDS and len(dek) != 32:
        raise RekeyError(f"key {key_id!r}: default keys are 32 bytes, got {len(dek)}")


# ---------------------------------------------------------------- oracle ----
@dataclass
class OracleResult:
    ok: dict[str, int] = field(default_factory=dict)
    bad: dict[str, int] = field(default_factory=dict)
    strong: set[str] = field(default_factory=set)  # key ids with >=16-byte UTF-8 hit
    unknown_key_ids: set[str] = field(default_factory=set)

    @property
    def total_ok(self) -> int:
        return sum(self.ok.values())

    @property
    def total_bad(self) -> int:
        return sum(self.bad.values())


def run_oracle(samples: list[tuple[str, str]], deks: dict[str, bytes]) -> OracleResult:
    """samples: (KeyID, Crypted std-b64). Plaintext must be valid UTF-8."""
    r = OracleResult()
    for key_id, crypted in samples:
        dek = deks.get(key_id)
        if dek is None:
            r.unknown_key_ids.add(key_id)
            continue
        try:
            plain = decrypt_crypto_value(crypted, dek)
            plain.decode("utf-8")
            good = True
        except (RekeyError, UnicodeDecodeError):
            good = False
        bucket = r.ok if good else r.bad
        bucket[key_id] = bucket.get(key_id, 0) + 1
        if good and len(plain) >= 16:
            r.strong.add(key_id)
    return r


ORACLE_SQL = [
    # every nested CryptoValue object in event payloads
    """SELECT v->>'KeyID', v->>'Crypted'
         FROM eventstore.events2 e,
              LATERAL jsonb_path_query(e.payload,
                'strict $.** ? (@.type() == "object" && exists(@.KeyID) && exists(@.Crypted))') v
        WHERE e.payload::text LIKE '%%"Crypted"%%'
          AND v->>'Algorithm' = 'aes'
        LIMIT %s""",
    # web key private keys (EncryptJSON(jwk, oidc key)) in the projection
    """SELECT private_key->>'KeyID', private_key->>'Crypted'
         FROM projections.web_keys1
        WHERE private_key ? 'Crypted'
        LIMIT %s""",
]


def fetch_oracle_samples(cur, limit: int) -> list[tuple[str, str]]:
    out: list[tuple[str, str]] = []
    for sql in ORACLE_SQL:
        cur.execute("SAVEPOINT oracle")
        try:
            cur.execute(sql, (limit,))
            out.extend((k, c) for k, c in cur.fetchall() if k and c)
            cur.execute("RELEASE SAVEPOINT oracle")
        except Exception as e:  # table may not exist on some versions
            cur.execute("ROLLBACK TO SAVEPOINT oracle")
            print(f"  oracle query skipped: {type(e).__name__}: {str(e).splitlines()[0]}")
    return out


# ------------------------------------------------------------------ main ----
def plan_rekey(rows: list[tuple[str, str]], old_kek: bytes, new_kek: bytes):
    """Pure function: returns (deks, new_rows). Raises on any sanity failure."""
    deks: dict[str, bytes] = {}
    new_rows: dict[str, str] = {}
    for key_id, stored in rows:
        dek = unwrap(stored, old_kek)
        check_dek(key_id, dek)
        new = wrap(dek, new_kek)
        if unwrap(new, new_kek) != dek:  # in-memory round trip
            raise RekeyError(f"key {key_id!r}: in-memory round trip failed")
        deks[key_id] = dek
        new_rows[key_id] = new
    return deks, new_rows


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--dry-run", action="store_true", help="decrypt/re-encrypt in memory; no writes")
    ap.add_argument("--oracle-limit", type=int, default=5000)
    ap.add_argument("--skip-oracle", action="store_true",
                    help="DANGEROUS: do not prove the OLD masterkey against stored ciphertexts")
    ap.add_argument("--allow-missing-default-keys", action="store_true")
    a = ap.parse_args(argv)

    old_mk, new_mk, dsn = (os.environ.get(n) for n in ("OLD_MASTERKEY", "NEW_MASTERKEY", "PGDSN"))
    missing = [n for n, v in (("OLD_MASTERKEY", old_mk), ("NEW_MASTERKEY", new_mk), ("PGDSN", dsn)) if not v]
    if missing:
        print(f"missing env: {', '.join(missing)}", file=sys.stderr)
        return 2
    try:
        old_kek, new_kek = kek_from_masterkey(old_mk), kek_from_masterkey(new_mk)
    except RekeyError as e:
        print(f"ABORT: {e}", file=sys.stderr)
        return 2
    if old_kek == new_kek:
        print("ABORT: NEW_MASTERKEY equals OLD_MASTERKEY", file=sys.stderr)
        return 2

    import psycopg  # imported late so tests need only `cryptography`

    with psycopg.connect(dsn, autocommit=False) as conn:
        try:
            with conn.cursor() as cur:
                cur.execute("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE")
                cur.execute("SELECT id, key FROM system.encryption_keys ORDER BY id FOR UPDATE")
                rows = cur.fetchall()
                ids = [r[0] for r in rows]
                print(f"system.encryption_keys rows: {len(rows)}")
                print(f"  ids: {', '.join(ids)}")
                if not rows:
                    raise RekeyError("no rows in system.encryption_keys")
                absent = [k for k in DEFAULT_KEY_IDS if k not in ids]
                if absent and not a.allow_missing_default_keys:
                    raise RekeyError(f"default key ids missing: {absent} (ZITADEL would "
                                     "generate fresh ones on start); use --allow-missing-default-keys")

                deks, new_rows = plan_rekey(rows, old_kek, new_kek)
                print(f"  unwrapped with OLD and re-wrapped with NEW in memory: {len(deks)} ok")

                if a.skip_oracle:
                    print("  WARNING: oracle skipped; OLD masterkey correctness NOT proven")
                else:
                    samples = fetch_oracle_samples(cur, a.oracle_limit)
                    res = run_oracle(samples, deks)
                    print(f"  oracle samples: {len(samples)}  utf8-ok: {res.total_ok}  "
                          f"bad: {res.total_bad}  per-key ok: {dict(sorted(res.ok.items()))}")
                    if res.unknown_key_ids:
                        print(f"  oracle: ciphertexts reference unknown key ids: {sorted(res.unknown_key_ids)}")
                    if res.total_bad:
                        raise RekeyError(f"oracle failures per key: {res.bad} -- OLD masterkey is "
                                         "probably wrong, or the DB is already re-keyed")
                    if not res.strong:
                        raise RekeyError("oracle found no ciphertext >=16 bytes to prove the OLD "
                                         "masterkey; refusing (use --skip-oracle to override)")
                    print(f"  OLD masterkey PROVEN via key ids: {sorted(res.strong)}")

                if a.dry_run:
                    print("DRY RUN: no changes written")
                    conn.rollback()
                    return 0

                for key_id, new in new_rows.items():
                    cur.execute("UPDATE system.encryption_keys SET key = %s WHERE id = %s", (new, key_id))
                    if cur.rowcount != 1:
                        raise RekeyError(f"update of {key_id!r} touched {cur.rowcount} rows")

                cur.execute("SELECT id, key FROM system.encryption_keys ORDER BY id")
                after = dict(cur.fetchall())
                if set(after) != set(deks):
                    raise RekeyError("key id set changed during transaction")
                for key_id, dek in deks.items():
                    if unwrap(after[key_id], new_kek) != dek:
                        raise RekeyError(f"re-read verify failed for {key_id!r}")
                print(f"  re-read inside transaction, NEW unwraps to identical DEKs: {len(after)} ok")
            conn.commit()
        except RekeyError as e:
            conn.rollback()
            print(f"ABORT (rolled back): {e}", file=sys.stderr)
            return 1
        except Exception:
            conn.rollback()
            raise

    # independent post-commit check on a fresh connection
    with psycopg.connect(dsn) as conn2, conn2.cursor() as cur:
        cur.execute("SELECT id, key FROM system.encryption_keys ORDER BY id")
        post = cur.fetchall()
        bad = [k for k, v in post if unwrap(v, new_kek) != deks.get(k)]
        if bad or len(post) != len(deks):
            print(f"POST-COMMIT VERIFY FAILED: {bad}", file=sys.stderr)
            return 3
    print(f"COMMITTED: {len(deks)} keys re-wrapped; post-commit verify ok")
    return 0


if __name__ == "__main__":
    sys.exit(main())
