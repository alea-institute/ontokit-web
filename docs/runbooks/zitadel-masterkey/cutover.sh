#!/usr/bin/env bash
# Phase 2 (LIVE CUTOVER): re-wrap ZITADEL's encryption keys with the rehearsed NEW masterkey,
# move the key from the command line to an env var, restart, verify; auto-rollback on failure.
# Stdin line 1 = an existing user's password. Never prints key material.
set -euo pipefail
IFS= read -r UATPW
cd /opt/ontokit
[ "$(wc -c < /root/mkrot/new.key)" = 32 ] || { echo "no rehearsed NEW key - abort"; exit 1; }
TS=$(date -u +%Y%m%dT%H%M%SZ); B=/var/backups/ontokit/mkrot-cutover-$TS; umask 077; mkdir -p "$B"
PGU=$(docker exec ontokit-postgres-1 printenv POSTGRES_USER)
export ONTOKIT_API_REVISION=$(git -C ontokit-api rev-parse HEAD) ONTOKIT_WEB_REVISION=$(git -C ontokit-web rev-parse HEAD)
export OLD_MASTERKEY=$(sed -nE 's/^ZITADEL_MASTERKEY=//p' .env | tr -d '"'); export NEW_MASTERKEY=$(cat /root/mkrot/new.key)
[ ${#OLD_MASTERKEY} -eq 32 ] && [ ${#NEW_MASTERKEY} -eq 32 ] && [ "$OLD_MASTERKEY" != "$NEW_MASTERKEY" ] || { echo "key checks failed - abort"; exit 1; }
export PGDSN="host=postgres dbname=zitadel user=$PGU password=$(docker exec ontokit-postgres-1 printenv POSTGRES_PASSWORD)"
runrekey() { docker run --rm --network ontokit_ontokit -e OLD_MASTERKEY -e NEW_MASTERKEY -e PGDSN -v /root/mkrot:/w:ro python:3.12-slim \
  sh -c "pip install -q --root-user-action=ignore cryptography 'psycopg[binary]' >/dev/null 2>&1 && python -I /w/rekey.py $*"; }

echo "== 1. backups"; docker exec ontokit-postgres-1 pg_dump -U "$PGU" -Fc -d zitadel > "$B/zitadel-pre-cutover.dump"
cp .env "$B/dot-env"; cp compose.yaml "$B/compose.yaml"; ls -la "$B" | tail -3
echo "== 2. stop zitadel + login"; docker stop ontokit-login-1 ontokit-zitadel-1 >/dev/null; echo stopped

rollback() {
  echo "!! ROLLBACK: restoring OLD-wrapped keys, .env, compose.yaml"
  docker stop ontokit-login-1 ontokit-zitadel-1 >/dev/null 2>&1 || true
  cp "$B/dot-env" .env; cp "$B/compose.yaml" compose.yaml
  docker exec -i ontokit-postgres-1 psql -v ON_ERROR_STOP=1 -U "$PGU" -d postgres -qc "select pg_terminate_backend(pid) from pg_stat_activity where datname='zitadel' and pid<>pg_backend_pid()" >/dev/null
  docker exec -i ontokit-postgres-1 pg_restore -U "$PGU" -d zitadel --clean --if-exists --exit-on-error < "$B/zitadel-pre-cutover.dump"
  docker compose up -d zitadel login 2>&1 | tail -2
  echo "!! rolled back; investigate before retrying"; exit 1
}

echo "== 3. re-wrap live keys"; runrekey --dry-run || { docker compose up -d zitadel login >/dev/null 2>&1; echo "dry run failed - nothing changed, restarted"; exit 1; }
runrekey || rollback
unset PGDSN

echo "== 4. switch key: env var instead of command line"
python3 - <<'PY'
import re
c = open("compose.yaml").read()
old = """command: 'start-from-init --masterkey "${ZITADEL_MASTERKEY}" --tlsMode external'"""
assert c.count(old) == 1, "zitadel command line not found exactly once"
c = c.replace(old, "command: 'start-from-init --masterkeyFromEnv --tlsMode external'")
anchor = "      ZITADEL_EXTERNALDOMAIN: ontokit-auth.dev.openlegalstandard.org\n"
assert c.count(anchor) == 1, "zitadel env anchor not found"
if "ZITADEL_MASTERKEY: ${ZITADEL_MASTERKEY}" not in c:
    c = c.replace(anchor, "      ZITADEL_MASTERKEY: ${ZITADEL_MASTERKEY}\n" + anchor)
open("compose.yaml", "w").write(c)
e = [l for l in open(".env").read().splitlines() if not l.startswith("ZITADEL_MASTERKEY=")]
e.append("ZITADEL_MASTERKEY=" + open("/root/mkrot/new.key").read())
open(".env", "w").write("\n".join(e) + "\n")
PY
chmod 600 .env
docker compose config --quiet || rollback
echo "== 5. start"; docker compose up -d zitadel login 2>&1 | tail -2
for i in $(seq 1 60); do s=$(docker inspect -f '{{.State.Health.Status}}' ontokit-zitadel-1); [ "$s" = healthy ] && break; sleep 3; done; echo "zitadel=$s"
[ "$s" = healthy ] || rollback
echo "== 6. verify (live)"
ADM=$(sed -nE 's/^ZITADEL_SERVICE_TOKEN=//p' .env | tr -d '"')
UATPW="$UATPW" ADM="$ADM" python3 - <<'PY' || rollback
import json, os, sys, urllib.request
H = {"Host": "ontokit-demo-auth.damienriehl.com", "X-Forwarded-Proto": "https", "Content-Type": "application/json"}
def call(m, p, b=None, auth=True):
    h = dict(H)
    if auth: h["Authorization"] = "Bearer " + os.environ["ADM"]
    r = urllib.request.Request("http://127.0.0.1:8080" + p, method=m, data=None if b is None else json.dumps(b).encode(), headers=h)
    try:
        with urllib.request.urlopen(r, timeout=30) as x: return x.status, json.loads(x.read() or b"{}")
    except urllib.error.HTTPError as e: return e.code, {"body": e.read().decode()[:200]}
ok = True
s, d = call("GET", "/.well-known/openid-configuration", auth=False); print("discovery:", s, d.get("issuer")); ok &= s == 200
s, d = call("GET", "/oauth/v2/keys", auth=False); print("jwks keys:", s, len(d.get("keys", []))); ok &= s == 200 and len(d.get("keys", [])) > 0
s, d = call("POST", "/v2/users", {"query": {"limit": 50}}); print("admin list users:", s, len(d.get("result", []))); ok &= s == 200 and len(d.get("result", [])) > 0
s, d = call("POST", "/v2/sessions", {"checks": {"user": {"loginName": "uat-d10-owner@example.com"}, "password": {"password": os.environ["UATPW"]}}}); print("password session (right pw):", s, "token" if d.get("sessionToken") else d); ok &= s in (200, 201) and bool(d.get("sessionToken"))
s, d = call("POST", "/v2/sessions", {"checks": {"user": {"loginName": "uat-d10-owner@example.com"}, "password": {"password": "definitely-wrong-Pw1!"}}}); print("password session (wrong pw):", s); ok &= s >= 400
print("LIVE VERIFY", "PASS" if ok else "FAIL"); sys.exit(0 if ok else 1)
PY
n=$(docker logs --since 5m ontokit-zitadel-1 2>&1 | grep -c -E 'CRYPT-|failed to decrypt|QUERY-Iuk0s' || true); echo "decrypt errors since start: $n"; [ "$n" = 0 ] || rollback
for i in $(seq 1 40); do s=$(docker inspect -f '{{.State.Health.Status}}' ontokit-login-1); [ "$s" = healthy ] && break; sleep 3; done; echo "login=$s"
echo "key visible in ps now? $(ps -eo args | grep -c -- '--masterkey ' || true) (want 0; the grep itself may count 1)"
unset OLD_MASTERKEY NEW_MASTERKEY ADM UATPW
echo "CUTOVER COMPLETE; backups at $B"
