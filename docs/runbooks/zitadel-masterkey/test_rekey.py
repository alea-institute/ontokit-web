"""Tests for rekey.py. Run: uv run --with cryptography --with pytest pytest -q test_rekey.py"""
import json
import os
import pathlib

import pytest

import rekey as R

HERE = pathlib.Path(__file__).parent
OLD = "MasterkeyNeedsToHave32Characters"   # value from zitadel docs/compose examples
NEW = "ThisKeyNeedsToHave32Characters!!"   # value from zitadel internal/crypto/aes_test.go


# NIST SP 800-38A, F.3.17 CFB128-AES256.Encrypt (first two blocks)
def test_nist_cfb128_aes256():
    key = bytes.fromhex("603deb1015ca71be2b73aef0857d77811f352c073b6108d72d9810a30914dff4")
    iv = bytes.fromhex("000102030405060708090a0b0c0d0e0f")
    pt = bytes.fromhex("6bc1bee22e409f96e93d7e117393172aae2d8a571e03ac9c9eb76fac45af8e51")
    ct = bytes.fromhex("dc7e84bfda79164b7ecd8486985d386039ffed143b28b1c832113c6331e5407b")
    out = R.aes_cfb_encrypt(pt, key, iv)
    assert out == iv + ct
    assert R.aes_cfb_decrypt(out, key) == pt


def test_go_generated_vectors_decrypt():
    """Vectors produced by Go running ZITADEL v4.16.3's aes.go functions (gokat/main.go)."""
    vecs = json.loads((HERE / "go_kat_vectors.json").read_text())
    assert len(vecs) >= 6
    for v in vecs:
        kek = R.kek_from_masterkey(v["masterkey"])
        dek = R.unwrap(v["row"], kek)
        assert dek.hex() == v["plain_hex"]
        assert R.decrypt_crypto_value(v["value_crypted_std_b64"], dek).decode() == v["value_plain"]


def test_go_vectors_rewrap_and_oracle():
    vecs = json.loads((HERE / "go_kat_vectors.json").read_text())
    for v in vecs:
        old_kek = R.kek_from_masterkey(v["masterkey"])
        new_mk = NEW if v["masterkey"] == OLD else OLD
        deks, new_rows = R.plan_rekey([("oidcKey", v["row"])], old_kek, R.kek_from_masterkey(new_mk))
        assert R.unwrap(new_rows["oidcKey"], R.kek_from_masterkey(new_mk)).hex() == v["plain_hex"]
        res = R.run_oracle([("oidcKey", v["value_crypted_std_b64"])], deks)
        assert res.total_ok == 1 and res.total_bad == 0 and res.strong == {"oidcKey"}


def test_wrap_format_matches_go():
    kek = R.kek_from_masterkey(OLD)
    row = R.wrap(os.urandom(32), kek)
    assert len(row) == 64  # 16 IV + 32 DEK = 48 bytes -> 64 chars, no padding needed
    assert set(row) <= set("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_=")


def test_round_trip_synthetic_table():
    old_kek, new_kek = R.kek_from_masterkey(OLD), R.kek_from_masterkey(NEW)
    deks = {k: os.urandom(32) for k in R.DEFAULT_KEY_IDS}
    rows = [(k, R.wrap(d, old_kek)) for k, d in deks.items()]
    got, new_rows = R.plan_rekey(rows, old_kek, new_kek)
    assert got == deks
    for k, row in new_rows.items():
        assert R.unwrap(row, new_kek) == deks[k]
        assert row != dict(rows)[k]


def test_wrong_old_masterkey_caught_by_oracle_not_by_length():
    real_kek, wrong_kek = R.kek_from_masterkey(OLD), R.kek_from_masterkey("x" * 32)
    dek = os.urandom(32)
    row = R.wrap(dek, real_kek)
    samples = [("userKey", R.base64.b64encode(R.aes_cfb_encrypt(b"otpauth-secret-JBSWY3DPEHPK3PXP", dek)).decode())]
    # CFB is unauthenticated: the wrong key "succeeds" and passes the length check...
    deks, _ = R.plan_rekey([("userKey", row)], wrong_kek, R.kek_from_masterkey(NEW))
    assert deks["userKey"] != dek
    # ...so the oracle must catch it
    res = R.run_oracle(samples, deks)
    assert res.total_bad == 1 and not res.strong
    good, _ = R.plan_rekey([("userKey", row)], real_kek, R.kek_from_masterkey(NEW))
    assert R.run_oracle(samples, good).strong == {"userKey"}


@pytest.mark.parametrize("mk", ["short", "x" * 33, "MasterkeyNeedsToHave32Characters\n"])
def test_masterkey_length_enforced(mk):
    with pytest.raises(R.RekeyError):
        R.kek_from_masterkey(mk)


@pytest.mark.parametrize("bad", ["not base64!", "abc", "+/+/" * 16, ""])
def test_strict_base64(bad):
    with pytest.raises(R.RekeyError):
        R.unwrap(bad, R.kek_from_masterkey(OLD))


def test_bad_dek_length_rejected():
    kek = R.kek_from_masterkey(OLD)
    with pytest.raises(R.RekeyError):
        R.plan_rekey([("oidcKey", R.wrap(os.urandom(20), kek))], kek, R.kek_from_masterkey(NEW))
    with pytest.raises(R.RekeyError):
        R.plan_rekey([("oidcKey", R.wrap(os.urandom(16), kek))], kek, R.kek_from_masterkey(NEW))
    # non-default ids may legitimately hold 16/24-byte AES keys
    R.plan_rekey([("custom", R.wrap(os.urandom(16), kek))], kek, R.kek_from_masterkey(NEW))
