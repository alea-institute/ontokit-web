import test from 'node:test';
import assert from 'node:assert/strict';
import { assertDiscovery, freshIdentityValues, waitUntil } from './bootstrap-identity.mjs';

test('issuer mismatch fails instead of adopting another identity server', () => {
  assert.throws(() => assertDiscovery({issuer: 'https://elsewhere.invalid'}, 'http://localhost:1234'), /issuer mismatch/);
  assert.doesNotThrow(() => assertDiscovery({issuer: 'http://localhost:1234'}, 'http://localhost:1234'));
});
test('bootstrap secrets and expiry are fresh and relative to each invocation', () => {
  const now = Date.UTC(2031, 0, 1);
  const first = freshIdentityValues(now), second = freshIdentityValues(now);
  assert.notEqual(first.IDENTITY_MASTERKEY, second.IDENTITY_MASTERKEY);
  assert.equal(first.IDENTITY_MASTERKEY.length, 32);
  assert.equal(Date.parse(first.IDENTITY_PAT_EXPIRY), now + 86_400_000);
  assert.notEqual(first.IDENTITY_ADMIN_PASSWORD, second.IDENTITY_ADMIN_PASSWORD);
});
test('bounded readiness never turns a failed check into a pass', async () => {
  await assert.rejects(waitUntil(async () => false, {timeout: 20, interval: 2}), /readiness timed out/);
});
test('readiness cooperates with interruption', async () => {
  const controller = new AbortController();
  const waiting = waitUntil(async () => false, {signal: controller.signal, timeout: 1000, interval: 50});
  controller.abort();
  await assert.rejects(waiting, /Interrupted/);
});

test('read-only identity readiness retries transient service errors before provisioning', async () => {
  const { identityRequest } = await import('./bootstrap-identity.mjs');
  const statuses = [503, 200];
  let attempts = 0;
  const result = await identityRequest({issuer: 'http://localhost:1234', pat: 'synthetic', endpoint: '/v2/organizations/_search', body: {}, readOnly: true, interval: 1,
    fetcher: async () => { attempts++; const status = statuses.shift(); return new Response(JSON.stringify(status === 200 ? {result: []} : {message: 'not ready'}), {status}); },
  });
  assert.equal(attempts, 2);
  assert.deepEqual(result, {result: []});
});
test('invalid identity credentials fail fast without retrying', async () => {
  const { identityRequest } = await import('./bootstrap-identity.mjs');
  let attempts = 0;
  await assert.rejects(identityRequest({issuer: 'http://localhost:1234', pat: 'synthetic', endpoint: '/v2/organizations/_search', body: {}, readOnly: true, interval: 1,
    fetcher: async () => { attempts++; return new Response('{"message":"invalid"}', {status: 401}); },
  }), /failed \(401\)/);
  assert.equal(attempts, 1);
});
test('identity mutation service errors are never retried', async () => {
  const { identityRequest } = await import('./bootstrap-identity.mjs');
  let attempts = 0;
  await assert.rejects(identityRequest({issuer: 'http://localhost:1234', pat: 'synthetic', endpoint: '/v2/users/new', body: {}, interval: 1,
    fetcher: async () => { attempts++; return new Response('{"message":"not ready"}', {status: 503}); },
  }), /failed \(503\)/);
  assert.equal(attempts, 1);
});
test('read-only identity readiness retries network startup failures', async () => {
  const { identityRequest } = await import('./bootstrap-identity.mjs');
  let attempts = 0;
  await identityRequest({issuer: 'http://localhost:1234', pat: 'synthetic', endpoint: '/v2/organizations/_search', body: {}, readOnly: true, interval: 1,
    fetcher: async () => { if (++attempts === 1) throw new TypeError('fetch failed'); return new Response('{"result":[]}'); },
  });
  assert.equal(attempts, 2);
});

test('default baseline profile provisions exactly the D06 owner and unrelated personas', async () => {
  const { provisionPersonas } = await import('./bootstrap-identity.mjs');
  const calls = [];
  let next = 0;
  const call = async (endpoint, _body, _readOnly = false, method = 'POST') => { calls.push(`${method} ${endpoint}`); return {id: `id-${++next}`}; };
  const {users, lifetimes} = await provisionPersonas(call, {organizationId: 'org', runId: 'a'.repeat(32)});
  assert.deepEqual(Object.keys(users), ['owner', 'unrelated']);
  assert.equal(lifetimes, null, 'baseline never changes instance-wide provider lifetimes');
  assert.deepEqual(calls, ['POST /v2/users/new', 'POST /v2/users/new']);
  const duplicate = async () => ({id: 'same'});
  await assert.rejects(provisionPersonas(duplicate, {organizationId: 'org', runId: 'a'.repeat(32)}), /distinct/);
});

test('optional-configured provisions exactly one ordinary persona and no lifetime change', async () => {
  const { provisionPersonas } = await import('./bootstrap-identity.mjs');
  const calls = [];
  const call = async (endpoint, _body, _readOnly = false, method = 'POST') => { calls.push(`${method} ${endpoint}`); return {id: '123456789012345678'}; };
  const {users, lifetimes} = await provisionPersonas(call, {profile: 'optional-configured', organizationId: 'org', runId: 'a'.repeat(32)});
  assert.deepEqual(Object.keys(users), ['owner']);
  assert.equal(lifetimes, null);
  assert.deepEqual(calls, ['POST /v2/users/new']);
});
test('provider-less profiles never provision identities or start identity services', async () => {
  const { provisionPersonas, bootstrapIdentity } = await import('./bootstrap-identity.mjs');
  for (const profile of ['optional-anonymous', 'disabled']) {
    let called = false;
    await assert.rejects(provisionPersonas(async () => { called = true; return {id: '1'}; }, {profile, organizationId: 'org', runId: 'a'.repeat(32)}), /Provider-less/);
    // Rejected before any Compose call: the context has no ports or runtime directory.
    await assert.rejects(bootstrapIdentity({profile, manifest: {}}), /Provider-less/);
    assert.equal(called, false);
  }
});
