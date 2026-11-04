#!/usr/bin/env bash
# Phase 1 (REHEARSAL, production untouched): back up zitadel DB, clone it, re-wrap the
# clone with a NEW masterkey, run a throwaway ZITADEL v4.16.3 against the clone, verify.
# Runs as root on the EU host. Never prints key material. Stdin line 1 = an existing
# user's password (for the password-session check).
set -euo pipefail
IFS= read -r UATPW
cd /opt/ontokit
TS=$(date -u +%Y%m%dT%H%M%SZ); B=/var/backups/ontokit/mkrot-$TS; umask 077; mkdir -p "$B" /root/mkrot
PGU=$(docker exec ontokit-postgres-1 printenv POSTGRES_USER)
psql() { docker exec -i ontokit-postgres-1 psql -v ON_ERROR_STOP=1 -U "$PGU" "$@"; }
echo "== 1. backup"; docker exec ontokit-postgres-1 pg_dump -U "$PGU" -Fc -d zitadel > "$B/zitadel-pre-rotation.dump"
sha256sum "$B/zitadel-pre-rotation.dump" | cut -c1-16; ls -la "$B" | tail -1
echo "== 2. clone"; psql -d postgres -qc "drop database if exists zitadel_mkrot" ; psql -d postgres -qc "create database zitadel_mkrot owner zitadel"
docker exec -i ontokit-postgres-1 pg_restore -U "$PGU" -d zitadel_mkrot --exit-on-error --no-owner --role=zitadel < "$B/zitadel-pre-rotation.dump"
psql -d zitadel_mkrot -Atc "select count(*), min(length(key)), max(length(key)) from system.encryption_keys"
echo "== 3. NEW key (stored at /root/mkrot/new.key, 600)"
if [ "$(wc -c < /root/mkrot/new.key 2>/dev/null || echo 0)" != 32 ]; then python3 -c 'import secrets,string; a=string.ascii_letters+string.digits; print("".join(secrets.choice(a) for _ in range(32)), end="")' > /root/mkrot/new.key; fi
chmod 600 /root/mkrot/new.key; echo "new key length: $(wc -c < /root/mkrot/new.key)"
export OLD_MASTERKEY=$(sed -nE 's/^ZITADEL_MASTERKEY=//p' .env | tr -d '"'); export NEW_MASTERKEY=$(cat /root/mkrot/new.key)
[ ${#OLD_MASTERKEY} -eq 32 ] && [ ${#NEW_MASTERKEY} -eq 32 ] || { echo "key length check failed"; exit 1; }
export PGDSN="host=postgres dbname=zitadel_mkrot user=$PGU password=$(docker exec ontokit-postgres-1 printenv POSTGRES_PASSWORD)"
runrekey() { docker run --rm --network ontokit_ontokit -e OLD_MASTERKEY -e NEW_MASTERKEY -e PGDSN -v /root/mkrot:/w:ro python:3.12-slim \
  sh -c "pip install -q --root-user-action=ignore cryptography 'psycopg[binary]' >/dev/null 2>&1 && python -I /w/rekey.py $*"; }
echo "== 4. dry run on clone"; runrekey --dry-run
echo "== 5. real run on clone"; runrekey
unset PGDSN
echo "== 6. throwaway ZITADEL on clone with NEW key"
docker rm -f zitadel-mkrot >/dev/null 2>&1 || true
ZDBPW=$(sed -nE 's/^ZITADEL_DB_PASSWORD=//p' .env | tr -d '"'); export ZITADEL_DATABASE_POSTGRES_USER_PASSWORD="$ZDBPW" ZITADEL_MASTERKEY="$NEW_MASTERKEY"
IMG=$(docker inspect -f '{{.Image}}' ontokit-zitadel-1)
docker run -d --name zitadel-mkrot --network ontokit_ontokit -p 127.0.0.1:18080:8080 \
  -e ZITADEL_MASTERKEY -e ZITADEL_DATABASE_POSTGRES_USER_PASSWORD \
  -e ZITADEL_EXTERNALDOMAIN=ontokit-auth.dev.openlegalstandard.org -e ZITADEL_EXTERNALPORT=443 -e ZITADEL_EXTERNALSECURE=true -e ZITADEL_TLS_ENABLED=false \
  -e ZITADEL_DATABASE_POSTGRES_HOST=postgres -e ZITADEL_DATABASE_POSTGRES_PORT=5432 -e ZITADEL_DATABASE_POSTGRES_DATABASE=zitadel_mkrot \
  -e ZITADEL_DATABASE_POSTGRES_USER_USERNAME=zitadel -e ZITADEL_DATABASE_POSTGRES_USER_SSL_MODE=disable \
  -e ZITADEL_DATABASE_POSTGRES_ADMIN_USERNAME=postgres -e ZITADEL_DATABASE_POSTGRES_ADMIN_SSL_MODE=disable \
  -e ZITADEL_DEFAULTINSTANCE_SMTPCONFIGURATION_SMTP_HOST=127.0.0.1:1 \
  "$IMG" start --masterkeyFromEnv --tlsMode external >/dev/null
unset ZITADEL_MASTERKEY ZITADEL_DATABASE_POSTGRES_USER_PASSWORD ZDBPW
for i in $(seq 1 60); do curl -fsS -o /dev/null http://127.0.0.1:18080/debug/ready 2>/dev/null && break; sleep 3; done
echo "== 7. verify (throwaway, Host = demo auth)"
ADM=$(sed -nE 's/^ZITADEL_SERVICE_TOKEN=//p' .env | tr -d '"')
UATPW="$UATPW" ADM="$ADM" python3 - <<'PY'
import json, os, urllib.request
H = {"Host": "ontokit-demo-auth.damienriehl.com", "X-Forwarded-Proto": "https", "Content-Type": "application/json"}
def call(m, p, b=None, auth=True):
    h = dict(H);
    if auth: h["Authorization"] = "Bearer " + os.environ["ADM"]
    r = urllib.request.Request("http://127.0.0.1:18080" + p, method=m, data=None if b is None else json.dumps(b).encode(), headers=h)
    try:
        with urllib.request.urlopen(r, timeout=30) as x: return x.status, json.loads(x.read() or b"{}")
    except urllib.error.HTTPError as e: return e.code, {"body": e.read().decode()[:200]}
ok = True
s, d = call("GET", "/.well-known/openid-configuration", auth=False); print("discovery:", s, d.get("issuer")); ok &= s == 200
s, d = call("GET", "/oauth/v2/keys", auth=False); print("jwks keys:", s, len(d.get("keys", []))); ok &= s == 200 and len(d.get("keys", [])) > 0
s, d = call("POST", "/v2/users", {"query": {"limit": 50}}); print("admin list users:", s, len(d.get("result", []))); ok &= s == 200 and len(d.get("result", [])) > 0
s, d = call("POST", "/v2/sessions", {"checks": {"user": {"loginName": "uat-d10-owner@example.com"}, "password": {"password": os.environ["UATPW"]}}}); print("password session (right pw):", s, "token" if d.get("sessionToken") else d); ok &= s in (200, 201) and bool(d.get("sessionToken"))
s, d = call("POST", "/v2/sessions", {"checks": {"user": {"loginName": "uat-d10-owner@example.com"}, "password": {"password": "definitely-wrong-Pw1!"}}}); print("password session (wrong pw):", s); ok &= s >= 400
s, d = call("POST", "/admin/v1/idps/templates/_search", {}); print("IdP configs readable (decrypt IdP secrets):", s, [i.get("name") for i in d.get("result", [])]); ok &= s == 200
print("REHEARSAL", "PASS" if ok else "FAIL")
PY
echo "decrypt errors in throwaway log: $(docker logs zitadel-mkrot 2>&1 | grep -c -E 'CRYPT-|failed to decrypt|QUERY-Iuk0s')"
echo "== 8. teardown"; docker rm -f zitadel-mkrot >/dev/null; psql -d postgres -qc "drop database zitadel_mkrot"; echo "clone dropped; backup kept at $B"
unset OLD_MASTERKEY NEW_MASTERKEY ADM UATPW
