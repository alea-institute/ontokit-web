import test from 'node:test';
import assert from 'node:assert/strict';
import { provisionPersonas, assertProfile, identityRequest } from './bootstrap-identity.mjs';
import {
  LIFECYCLE_LIFETIMES, AUTHJS_SESSION_MAX_AGE_SECONDS, configureLifecycleLifetimes, durationSeconds, jwtLifetimeSeconds,
  nextServerEnv, assertNoClockOverride, validateSpecimen, clockPreflight, verifyOrdinaryPersona,
} from './auth-lifecycle.mjs';
import { run } from './run.mjs';

const RUN = 'a'.repeat(32);
const DEFAULTS = {settings: {accessTokenLifetime: '43200s', idTokenLifetime: '43200s', refreshTokenIdleExpiration: '2592000s', refreshTokenExpiration: '7776000s'}};
const asSettings = values => ({settings: Object.fromEntries(Object.entries(values).map(([k, v]) => [k, `${v}s`]))});

// Fake provider admin API recording every call; readback returns queued responses.
function fakeProvider({readbacks = [asSettings(LIFECYCLE_LIFETIMES)], rejectPut = false, adminId = 'admin-1', members = {instance: ['admin-1'], org: ['admin-1']}} = {}) {
  const calls = [];
  let userCount = 0;
  const call = async (endpoint, body, readOnly = false, method = 'POST') => {
    calls.push({endpoint, method, body, readOnly});
    if (endpoint === '/admin/v1/settings/oidc' && method === 'PUT') {
      if (rejectPut) throw new Error('Disposable identity bootstrap failed (400) at /admin/v1/settings/oidc');
      return {};
    }
    if (endpoint === '/admin/v1/settings/oidc' && method === 'GET') return readbacks.length > 1 ? readbacks.shift() : readbacks[0];
    if (endpoint === '/v2/users/new') return {id: `user-${++userCount}`};
    if (endpoint === '/auth/v1/users/me') return {user: {id: adminId}};
    if (endpoint === '/admin/v1/members/_search') return {result: members.instance.map(userId => ({userId}))};
    if (endpoint === '/management/v1/orgs/me/members/_search') return {result: members.org.map(userId => ({userId}))};
    throw new Error(`unexpected ${method} ${endpoint}`);
  };
  return {call, calls};
}

test('profile selector accepts only known profiles and rejects before allocating a run', async () => {
  assert.equal(assertProfile('baseline'), 'baseline');
  assert.equal(assertProfile('lifecycle'), 'lifecycle');
  for (const value of [undefined, '', 'Lifecycle', '__proto__', 'toString']) assert.throws(() => assertProfile(value), /Unknown E2E profile/);
  await assert.rejects(run({profile: 'bogus', apiSource: '/nonexistent'}), /Unknown E2E profile/);
  await assert.rejects(run({profile: 'lifecycle', lifecycleProbe: true, apiSource: '/nonexistent'}), /Unknown E2E profile/);
});

test('default profile keeps the baseline identity sequence and never touches provider lifetimes', async () => {
  const provider = fakeProvider();
  const {users, lifetimes} = await provisionPersonas(provider.call, {organizationId: 'org', runId: RUN});
  assert.equal(lifetimes, null);
  assert.deepEqual(Object.keys(users), ['owner', 'unrelated']);
  assert.notEqual(users.owner.id, users.unrelated.id);
  assert.deepEqual(provider.calls.map(c => `${c.method} ${c.endpoint}`), ['POST /v2/users/new', 'POST /v2/users/new']);
  assert.equal(users.owner.email, `owner-${RUN}@example.test`);
});

test('lifecycle profile applies all four lifetimes, reads them back, then creates one ordinary persona', async () => {
  const provider = fakeProvider();
  const {users, lifetimes} = await provisionPersonas(provider.call, {profile: 'lifecycle', organizationId: 'org', runId: RUN});
  assert.deepEqual(lifetimes, {...LIFECYCLE_LIFETIMES});
  assert.deepEqual(Object.keys(users), ['lifecycle']);
  assert.equal(users.lifecycle.email, `lifecycle-${RUN}@example.test`);
  const sequence = provider.calls.map(c => `${c.method} ${c.endpoint}`);
  assert.deepEqual(sequence, ['PUT /admin/v1/settings/oidc', 'GET /admin/v1/settings/oidc', 'POST /v2/users/new', 'GET /auth/v1/users/me', 'POST /admin/v1/members/_search', 'POST /management/v1/orgs/me/members/_search']);
  assert.deepEqual(provider.calls[0].body, {accessTokenLifetime: '60s', idTokenLifetime: '60s', refreshTokenIdleExpiration: '180s', refreshTokenExpiration: '360s'});
  assert.equal(provider.calls[1].body, undefined);
});

test('lifecycle readback tolerates bounded projection lag', async () => {
  const provider = fakeProvider({readbacks: [DEFAULTS, DEFAULTS, asSettings(LIFECYCLE_LIFETIMES)]});
  assert.deepEqual(await configureLifecycleLifetimes(provider.call, {interval: 1, timeout: 1000}), {...LIFECYCLE_LIFETIMES});
});

test('wrong readback, injected mismatch or policy rejection fails before any persona exists', async () => {
  const stale = fakeProvider({readbacks: [DEFAULTS]});
  await assert.rejects(configureLifecycleLifetimes(stale.call, {interval: 1, timeout: 20}), /readback mismatch/);
  for (const [provider, failAt, pattern] of [
    [fakeProvider(), 'lifecycle-readback', /readback mismatch/],
    [fakeProvider({rejectPut: true}), undefined, /failed \(400\)/],
    [fakeProvider({readbacks: [{settings: {...asSettings(LIFECYCLE_LIFETIMES).settings, idTokenLifetime: '1m'}}]}), undefined, /malformed/],
    [fakeProvider({readbacks: [{}]}), undefined, /malformed/],
  ]) {
    const started = Date.now();
    await assert.rejects(provisionPersonas(provider.call, {profile: 'lifecycle', organizationId: 'org', runId: RUN, failAt, readbackTimeout: 20}), pattern);
    assert.equal(provider.calls.filter(c => c.endpoint === '/v2/users/new').length, 0);
    assert.ok(Date.now() - started < 35_000, 'mismatch wait is bounded');
  }
});

test('lifecycle persona must be distinct from and not share roles with bootstrap administration', async () => {
  await assert.rejects(verifyOrdinaryPersona(fakeProvider({adminId: 'user-1'}).call, 'user-1'), /bootstrap administration/);
  await assert.rejects(verifyOrdinaryPersona(fakeProvider({members: {instance: ['admin-1', 'user-1'], org: []}}).call, 'user-1'), /administrative membership/);
  await assert.rejects(verifyOrdinaryPersona(fakeProvider({members: {instance: ['admin-1'], org: ['user-1']}}).call, 'user-1'), /administrative membership/);
  await assert.rejects(verifyOrdinaryPersona(fakeProvider({members: {instance: [], org: []}}).call, 'user-1'), /did not include bootstrap administration/);
  assert.equal(await verifyOrdinaryPersona(fakeProvider().call, 'user-9'), true);
});

test('lifetime settings must be able to provoke renewal before refresh expiry', async () => {
  const provider = fakeProvider();
  await assert.rejects(configureLifecycleLifetimes(provider.call, {apply: {...LIFECYCLE_LIFETIMES, refreshTokenIdleExpiration: 30}}), /cannot provoke renewal/);
  await assert.rejects(configureLifecycleLifetimes(provider.call, {apply: {...LIFECYCLE_LIFETIMES, accessTokenLifetime: 0}}), /invalid/);
  assert.equal(provider.calls.length, 0);
});

test('identity requests support read-only GET readback without a body', async () => {
  let seen;
  const result = await identityRequest({issuer: 'http://localhost:1', pat: 'synthetic', endpoint: '/admin/v1/settings/oidc', method: 'GET', readOnly: true, interval: 1,
    fetcher: async (url, init) => { seen = init; return new Response(JSON.stringify(DEFAULTS)); }});
  assert.equal(seen.method, 'GET');
  assert.equal(seen.body, undefined);
  assert.equal(seen.headers['Content-Type'], undefined);
  assert.deepEqual(result, DEFAULTS);
  await assert.rejects(identityRequest({issuer: 'http://localhost:1', pat: 'x', endpoint: '/x', method: 'GET', body: {}, fetcher: async () => new Response('{}')}), /Invalid identity request/);
  await assert.rejects(identityRequest({issuer: 'http://localhost:1', pat: 'x', endpoint: '/x', method: 'DELETE', fetcher: async () => new Response('{}')}), /Invalid identity request/);
});

test('durations and issued access-token lifetimes parse strictly', () => {
  assert.equal(durationSeconds('60s'), 60);
  assert.equal(durationSeconds('1.5s'), 1.5);
  for (const bad of ['60', '1m', '-1s', '', null, 60]) assert.throws(() => durationSeconds(bad), /malformed/);
  const jwt = claims => `h.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.s`;
  assert.equal(jwtLifetimeSeconds(jwt({iat: 100, exp: 160})), 60);
  for (const bad of ['opaque', jwt({iat: 100}), jwt({iat: 100, exp: 90}), 'a.!!!.c']) assert.throws(() => jwtLifetimeSeconds(bad));
});

test('clock preload reaches only the owned Next process environment', () => {
  const env = {PATH: '/bin', NEXTAUTH_URL: 'http://localhost:1'};
  const server = nextServerEnv(env, '/tmp/ontokit-e2e-1/abc/auth-clock.mjs');
  assert.equal(server.NODE_OPTIONS, '--import=/tmp/ontokit-e2e-1/abc/auth-clock.mjs');
  assert.equal(server.ONTOKIT_E2E_AUTH_CLOCK, '1');
  assert.equal('NODE_OPTIONS' in env, false, 'shared build/test environment is not mutated');
  assert.doesNotThrow(() => assertNoClockOverride(env));
  assert.throws(() => assertNoClockOverride(server), /leaked/);
  assert.throws(() => nextServerEnv(server, '/tmp/x.mjs'), /leaked/);
  // NODE_OPTIONS splits at whitespace; an unquoted path with a space would load a different file.
  for (const unsafe of ['/home/user/Coding Projects/auth-clock.mjs', 'relative.mjs', '/tmp/"x.mjs']) assert.throws(() => nextServerEnv(env, unsafe), /unsafe/);
});

test('cookie specimens must be genuine session-token chunks that have not expired', () => {
  const now = Date.now();
  const good = {subject: 'u', cookies: [{name: 'authjs.session-token.0', value: 'a', expires: (now + 1e6) / 1000}, {name: 'authjs.session-token.1', value: 'b', expires: (now + 1e6) / 1000}]};
  const sample = validateSpecimen(good, {now});
  assert.equal(sample.cookieHeader, 'authjs.session-token.0=a; authjs.session-token.1=b');
  for (const bad of [
    {...good, cookies: []},
    {...good, cookies: [{name: 'authjs.csrf-token', value: 'a', expires: (now + 1e6) / 1000}]},
    {...good, cookies: [{name: 'authjs.session-token', value: 'a', expires: (now - 1) / 1000}]},
    {...good, cookies: [{name: 'authjs.session-token', value: 'a', expires: -1}].map(c => ({...c, expires: (now - 5000) / 1000}))},
    {...good, cookies: [good.cookies[0], {...good.cookies[1], expires: (now + 1e6 + 10_000) / 1000}]},
    {...good, subject: ''},
  ]) assert.throws(() => validateSpecimen(bad, {now}));
});

// Simulated Auth.js session route with a worker clock of host + offset. `reachable`
// false models an instrument that never reaches the worker; tolerance 0 models a
// verifier that differs from the pinned one.
function fakeNext({specimenExpiresMs, reachable = true, toleranceMs = 15_000, clearCookies = true, alwaysNull = false} = {}) {
  let offset = 0;
  const offsets = [];
  const setOffset = value => { offsets.push(value); offset = value; };
  const fetcher = async url => {
    if (!url.endsWith('/api/auth/session')) return new Response(null, {headers: {date: new Date().toUTCString()}});
    const worker = Date.now() + (reachable ? offset : 0);
    if (alwaysNull || worker >= specimenExpiresMs + toleranceMs) {
      const headers = new Headers();
      if (clearCookies) headers.append('set-cookie', 'authjs.session-token=; Path=/; Max-Age=0; HttpOnly');
      return new Response('null', {headers});
    }
    const headers = new Headers();
    headers.append('set-cookie', `authjs.session-token=renewed; Path=/; Expires=${new Date(worker + 30 * 86_400_000).toUTCString()}`);
    return new Response(JSON.stringify({user: {id: 'subject'}, expires: new Date(worker + AUTHJS_SESSION_MAX_AGE_SECONDS * 1000).toISOString(), error: worker > specimenExpiresMs - 20 * 86_400_000 ? 'RefreshAccessTokenError' : undefined}), {headers});
  };
  return {fetcher, setOffset, offsets};
}
const specimenFor = expiresMs => ({subject: 'subject', cookies: [{name: 'authjs.session-token', value: 'genuine', expires: expiresMs / 1000}]});
const preflightOptions = (fake, expiresMs, extra = {}) => ({web: 'http://localhost:1', specimen: specimenFor(expiresMs), fetcher: fake.fetcher, setOffset: fake.setOffset, settleMs: 1, serviceUrls: ['http://localhost:2/health'], ...extra});

test('preflight accepts the unchanged specimen just inside verifier tolerance, rejects just beyond it, and restores', async () => {
  const expiresMs = Math.floor((Date.now() + AUTHJS_SESSION_MAX_AGE_SECONDS * 1000) / 1000) * 1000;
  const fake = fakeNext({specimenExpiresMs: expiresMs});
  const result = await clockPreflight(preflightOptions(fake, expiresMs));
  assert.equal(result.beforeAccepted, true);
  assert.equal(result.afterRejected, true);
  assert.equal(result.cookiesCleared, true);
  assert.equal(result.restored, true);
  assert.equal(result.toleranceWindowExercised, true);
  assert.equal(result.refreshErrorBeforeBoundary, true);
  assert.ok(result.workerShiftErrorMs < 1000);
  assert.equal(fake.offsets.at(-1), 0);
  assert.equal(JSON.stringify(result).includes('genuine'), false, 'evidence never carries the cookie');
  assert.ok(fake.offsets.some(o => o > 29 * 86_400_000));
});

test('preflight fails closed and still resets the clock on instrument, verifier and cleanup failures', async () => {
  const expiresMs = Date.now() + AUTHJS_SESSION_MAX_AGE_SECONDS * 1000;
  const cases = [
    [fakeNext({specimenExpiresMs: expiresMs, reachable: false}), {}, /did not follow the control/],
    [fakeNext({specimenExpiresMs: expiresMs, alwaysNull: true}), {}, /rejected at normal time/],
    [fakeNext({specimenExpiresMs: expiresMs, toleranceMs: 0}), {}, /rejected before expiry boundary/],
    [fakeNext({specimenExpiresMs: expiresMs, clearCookies: false}), {}, /were not cleared/],
    [fakeNext({specimenExpiresMs: expiresMs}), {failAt: 'clock-preflight'}, /Injected lifecycle clock failure/],
  ];
  for (const [fake, extra, pattern] of cases) {
    await assert.rejects(clockPreflight(preflightOptions(fake, expiresMs, extra)), pattern);
    assert.equal(fake.offsets.at(-1), 0, `reset after ${pattern}`);
  }
  const moved = fakeNext({specimenExpiresMs: expiresMs});
  const skewedServices = async (url, init) => url.endsWith('/health') ? new Response(null, {headers: {date: new Date(Date.now() + 86_400_000).toUTCString()}}) : moved.fetcher(url, init);
  await assert.rejects(clockPreflight({...preflightOptions(moved, expiresMs), fetcher: skewedServices}), /service clocks moved/);
  assert.equal(moved.offsets.at(-1), 0);
});

test('preflight observes cancellation and resets the clock', async () => {
  const expiresMs = Date.now() + AUTHJS_SESSION_MAX_AGE_SECONDS * 1000;
  const fake = fakeNext({specimenExpiresMs: expiresMs});
  const controller = new AbortController();
  const setOffset = value => { fake.setOffset(value); if (value > 0) controller.abort(); };
  await assert.rejects(clockPreflight({...preflightOptions(fake, expiresMs), setOffset, settleMs: 50, signal: controller.signal}), /Interrupted/);
  assert.equal(fake.offsets.at(-1), 0);
});
