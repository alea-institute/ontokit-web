#!/usr/bin/env bash
# Usage: bash scripts/verify-auth-image.sh IMAGE required|optional configured|anonymous
# Synthetic credentials never enter a build. Containers have no network or host ports.
set -euo pipefail
image=${1:?image required}
mode=${2:?mode required}
profile=${3:?profile required}
[[ "$mode" == required || "$mode" == optional ]] || exit 2
[[ "$profile" == configured || ( "$profile" == anonymous && "$mode" == optional ) ]] || exit 2
containers=()
cleanup() {
  local id
  for id in "${containers[@]}"; do docker rm -f "$id" >/dev/null 2>&1 || true; done
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
provider_canary=d03-runtime-only-provider-canary
session_canary=d03-runtime-only-session-canary-32-characters
runtime=(-e "AUTH_MODE=$mode" -e HOSTNAME=127.0.0.1 -e NEXTAUTH_URL=http://localhost:3000 -e AUTH_TRUST_HOST=true)
if [[ "$profile" == configured ]]; then
  runtime+=(-e ZITADEL_ISSUER=https://identity.example.invalid -e ZITADEL_CLIENT_ID=d03-public-client -e NEXT_PUBLIC_API_URL=https://api.example.invalid -e NEXT_PUBLIC_WS_URL=wss://api.example.invalid)
fi
start() {
  # Named before creation so an interrupted docker run remains covered by cleanup.
  current="ontokit-auth-smoke-$$-$RANDOM"
  containers+=("$current")
  docker run --name "$current" --network none -d "${runtime[@]}" "$@" "$image" >/dev/null
}
expect_rejection() {
  local missing=$1 state code
  shift
  start "$@"
  for ((attempt=0; attempt<40; attempt++)); do
    state=$(docker inspect --format '{{.State.Status}}' "$current")
    if [[ "$state" == exited ]]; then
      code=$(docker inspect --format '{{.State.ExitCode}}' "$current")
      [[ "$code" != 0 ]] || { echo "Unexpected successful exit: $missing" >&2; exit 1; }
      docker logs "$current" 2>&1 | grep -q "Server startup aborted: missing or invalid server environment configuration." || { echo "Exit lacked the configuration rejection marker for $missing" >&2; exit 1; }
      echo "PASS: startup rejects missing $missing ($mode)"
      return
    fi
    # Any successful application response before exit violates fail-closed startup.
    if docker exec "$current" node -e 'fetch("http://127.0.0.1:3000/api/auth/providers", {signal:AbortSignal.timeout(500)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))' >/dev/null 2>&1; then
      echo "Served successful response without $missing" >&2; exit 1
    fi
    sleep 0.5
  done
  echo "Startup did not reject missing $missing within deadline" >&2; exit 1
}
if [[ "$profile" == configured ]]; then
  expect_rejection ZITADEL_CLIENT_SECRET -e "NEXTAUTH_SECRET=$session_canary"
  expect_rejection NEXTAUTH_SECRET -e "ZITADEL_CLIENT_SECRET=$provider_canary"
  start -e "NEXTAUTH_SECRET=$session_canary" -e "ZITADEL_CLIENT_SECRET=$provider_canary"
else
  start
fi
# Fetch through loopback inside the network-isolated container, with a bounded deadline.
docker exec -i "$current" node - "$mode" "$profile" "$provider_canary" "$session_canary" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const [mode, profile, ...canaries] = process.argv.slice(2);
const configured = profile === 'configured';
const base = 'http://127.0.0.1:3000';
const noSecrets = text => { for (const secret of canaries) assert(!text.includes(secret), 'Runtime secret leaked to client'); };
(async () => {
  let response;
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    try {
      response = await fetch(`${base}/api/auth/providers`, {signal: AbortSignal.timeout(1000)});
      if (response.ok) break;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert(response?.ok, 'Provider endpoint never became available');
  const body = await response.text();
  noSecrets(body);
  const providers = JSON.parse(body);
  assert.deepEqual(Object.keys(providers), configured ? ['zitadel'] : []);
  if (configured) {
    assert.equal(providers.zitadel.id, 'zitadel');
    assert.equal(providers.zitadel.type, 'oidc');
    assert(new URL(providers.zitadel.signinUrl).pathname.endsWith('/api/auth/signin/zitadel'));
  }
  const env = JSON.parse(fs.readFileSync('.next/required-server-files.json', 'utf8')).config.env;
  assert.equal(env.NEXT_PUBLIC_AUTH_MODE, mode);
  assert.equal(env.NEXT_PUBLIC_ZITADEL_CONFIGURED, String(configured));
  assert.equal(env.NEXT_PUBLIC_ZITADEL_ISSUER || '', configured ? 'https://identity.example.invalid' : '');
  if (configured) {
    assert.equal(env.NEXT_PUBLIC_API_URL, 'https://api.example.invalid');
    assert.equal(env.NEXT_PUBLIC_WS_URL, 'wss://api.example.invalid');
    assert.equal(process.env.ZITADEL_ISSUER, env.NEXT_PUBLIC_ZITADEL_ISSUER);
    assert.equal(process.env.ZITADEL_CLIENT_ID, 'd03-public-client');
  }
  // Inspect every shipped browser asset and fetch representative assets containing
  // each public URL. Minification can fold boolean/mode branches, so those values
  // are checked against the compiled Next configuration above.
  const files = fs.readdirSync('.next/static', {recursive: true}).filter(file => file.endsWith('.js'));
  const needed = new Set(configured ? [env.NEXT_PUBLIC_ZITADEL_ISSUER, env.NEXT_PUBLIC_API_URL, env.NEXT_PUBLIC_WS_URL] : []);
  for (const file of files) {
    const content = fs.readFileSync(path.join('.next/static', file), 'utf8');
    noSecrets(content);
    for (const value of [...needed]) {
      if (!content.includes(value)) continue;
      const asset = await fetch(`${base}/_next/static/${file}`, {signal: AbortSignal.timeout(5000)});
      assert(asset.ok, 'Browser asset was not served');
      const served = await asset.text();
      noSecrets(served);
      assert(served.includes(value), 'Served asset lost public setting');
      needed.delete(value);
    }
  }
  assert.equal(needed.size, 0, 'Browser assets missing expected public URLs');
  console.log(`PASS: ${mode}/${profile} provider discovery, compiled settings and browser assets`);
})().catch(error => { console.error(error.message); process.exitCode = 1; });
NODE
