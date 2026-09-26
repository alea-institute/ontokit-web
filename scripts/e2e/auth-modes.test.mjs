import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  PROFILE_REGISTRY, MODE_PROFILES, profileSpec, serviceSet, foreignSpecs, specOwner, playwrightProjects,
  assertLaunch, apiModeFor, webAuthEnv, parseCompiledMode, readCompiledMode, parseApiMode, assertModeAgreement, API_MODE_PROBE,
} from './auth-modes.mjs';
import { PROFILES, assertProfile } from './bootstrap-identity.mjs';
import { fullStack } from './full-stack.mjs';

const identity = {issuer: 'http://localhost:1', clientId: 'client', clientSecret: 'secret-value', login: 'http://localhost:2/ui/v2/login'};
const inputs = {web: 'http://localhost:3', api: 'http://localhost:4', secret: 'a'.repeat(64)};
const compiled = (mode, configured) => JSON.stringify({version: 1, config: {env: {NEXT_PUBLIC_AUTH_MODE: mode, NEXT_PUBLIC_ZITADEL_CONFIGURED: configured}}});
const apiReport = (mode, providerConfigured, extra = {}) => JSON.stringify({mode, processMode: mode, providerConfigured, superadmins: 0, ...extra});

// ---- Registry (KTD1, KTD3) ----
test('default profile is still baseline and its personas are unchanged', () => {
  assert.equal(assertProfile('baseline'), 'baseline');
  assert.deepEqual(PROFILES.baseline, ['owner', 'unrelated']);
  assert.deepEqual(PROFILES.lifecycle, ['lifecycle']);
});
test('each new profile yields its API mode, web mode and identity-service decision', () => {
  const expected = {
    'optional-configured': ['optional', 'optional', true, ['owner']],
    'optional-anonymous': ['optional', 'optional', false, []],
    disabled: ['disabled', 'disabled', false, []],
  };
  assert.deepEqual([...MODE_PROFILES].sort(), Object.keys(expected).sort());
  for (const [profile, [apiMode, webMode, identityServices, personas]] of Object.entries(expected)) {
    const p = profileSpec(profile);
    assert.equal(assertProfile(profile), profile);
    assert.deepEqual([p.apiMode, p.webMode, p.identity, [...p.personas]], [apiMode, webMode, identityServices, personas]);
    assert.deepEqual([...PROFILES[profile]], personas);
    assert.equal(serviceSet(profile).includes('zitadel'), identityServices);
    assert.equal(serviceSet(profile).includes('login'), identityServices);
  }
  for (const profile of ['baseline', 'lifecycle']) {
    assert.equal(profileSpec(profile).apiMode, 'required');
    assert.deepEqual(serviceSet(profile), ['postgres', 'redis', 'minio', 'api', 'worker', 'zitadel', 'login']);
  }
});
test('unknown profiles and unsupported combinations are rejected', () => {
  for (const profile of ['', 'optional', 'Disabled', 'toString', '__proto__', undefined]) assert.throws(() => profileSpec(profile), /Unknown E2E profile/);
  assert.throws(() => assertProfile('optional'), /Unknown E2E profile/);
  assert.throws(() => assertLaunch({profile: 'disabled', lifecycleProbe: true}), /combination/);
  assert.throws(() => assertLaunch({profile: 'baseline', failAt: 'web-mode-mismatch'}), /combination/);
  assert.throws(() => assertLaunch({profile: 'lifecycle', failAt: 'api-mode-mismatch'}), /combination/);
  assert.throws(() => assertLaunch({profile: 'optional-configured', failAt: 'api-mode-mismatch'}), /combination/);
  assert.throws(() => assertLaunch({profile: 'baseline', lifecycleProbe: true, failAt: 'before-browser'}), /combination/);
  assert.equal(assertLaunch({profile: 'baseline', lifecycleProbe: true, failAt: 'after-dependencies'}), 'baseline');
  for (const profile of MODE_PROFILES) {
    assert.equal(assertLaunch({profile, failAt: 'before-browser'}), profile);
    assert.equal(assertLaunch({profile, failAt: 'web-mode-mismatch'}), profile);
  }
});
test('a misspelled or inapplicable --fail-at is rejected before any allocation', () => {
  // A typo must never degrade into an ordinary green run.
  for (const failAt of ['', 'before-browsr', 'after_workflow', 'BEFORE-BROWSER', 'toString', '__proto__', 'constructor', 'hasOwnProperty']) {
    for (const profile of ['baseline', 'lifecycle', ...MODE_PROFILES]) {
      assert.throws(() => assertLaunch({profile, failAt}), /Unknown E2E failure point/, `${profile} ${JSON.stringify(failAt)}`);
    }
  }
  // Legacy points stay available where they can fire.
  for (const profile of ['baseline', 'lifecycle', ...MODE_PROFILES]) {
    for (const failAt of ['after-dependencies', 'after-workflow']) assert.equal(assertLaunch({profile, failAt}), profile);
  }
  for (const profile of MODE_PROFILES) assert.equal(assertLaunch({profile, failAt: 'before-browser'}), profile);
  // before-browser fires only after D09 fixture seeding, which baseline and lifecycle never do.
  for (const profile of ['baseline', 'lifecycle']) assert.throws(() => assertLaunch({profile, failAt: 'before-browser'}), /combination/, profile);
  for (const profile of ['baseline', 'lifecycle', 'optional-configured']) {
    for (const failAt of ['identity-pat', 'identity-issuer', 'identity-callback']) assert.equal(assertLaunch({profile, failAt}), profile);
  }
  for (const failAt of ['lifecycle-readback', 'clock-preflight']) assert.equal(assertLaunch({profile: 'lifecycle', failAt}), 'lifecycle');
  // Points that cannot fire in a profile would otherwise pass silently.
  for (const profile of ['optional-anonymous', 'disabled']) {
    for (const failAt of ['identity-pat', 'identity-issuer', 'identity-callback']) assert.throws(() => assertLaunch({profile, failAt}), /combination/, `${profile} ${failAt}`);
  }
  for (const profile of ['baseline', ...MODE_PROFILES]) {
    for (const failAt of ['lifecycle-readback', 'clock-preflight']) assert.throws(() => assertLaunch({profile, failAt}), /combination/, `${profile} ${failAt}`);
  }
  for (const failAt of ['identity-pat', 'lifecycle-readback', 'clock-preflight']) {
    assert.throws(() => assertLaunch({profile: 'baseline', lifecycleProbe: true, failAt}), /combination/);
  }
  assert.equal(assertLaunch({profile: 'baseline', lifecycleProbe: true, failAt: 'after-workflow'}), 'baseline');
  assert.equal(assertLaunch({profile: 'baseline'}), 'baseline');
});
test('API mode follows the profile; the injected API mismatch picks a neighbouring mode', () => {
  assert.equal(apiModeFor('baseline'), 'required');
  assert.equal(apiModeFor('lifecycle'), 'required');
  assert.equal(apiModeFor('optional-configured'), 'optional');
  assert.equal(apiModeFor('optional-anonymous'), 'optional');
  assert.equal(apiModeFor('disabled'), 'disabled');
  assert.equal(apiModeFor('optional-anonymous', 'api-mode-mismatch'), 'disabled');
  assert.equal(apiModeFor('disabled', 'api-mode-mismatch'), 'optional');
});

// ---- Web build env (KTD1, KTD3) ----
test('baseline web build env keeps the D06 keys and values', () => {
  assert.deepEqual(webAuthEnv('baseline', {identity, ...inputs}), {
    AUTH_MODE: 'required', AUTH_TRUST_HOST: 'true', ZITADEL_ISSUER: identity.issuer, ZITADEL_CLIENT_ID: identity.clientId, ZITADEL_CLIENT_SECRET: identity.clientSecret,
    NEXTAUTH_URL: inputs.web, NEXTAUTH_SECRET: inputs.secret, NEXT_PUBLIC_API_URL: inputs.api, NEXT_PUBLIC_WS_URL: 'ws://localhost:4',
  });
});
test('provider-less builds receive no issuer, client ID or secret; provider builds require them', () => {
  for (const profile of ['optional-anonymous', 'disabled']) {
    const env = webAuthEnv(profile, inputs);
    assert.equal(env.AUTH_MODE, profileSpec(profile).webMode);
    for (const key of ['ZITADEL_ISSUER', 'ZITADEL_CLIENT_ID', 'ZITADEL_CLIENT_SECRET']) assert.equal(key in env, false);
    assert.throws(() => webAuthEnv(profile, {identity, ...inputs}), /Provider-less/);
  }
  const configured = webAuthEnv('optional-configured', {identity, ...inputs});
  assert.equal(configured.AUTH_MODE, 'optional');
  assert.equal(configured.ZITADEL_CLIENT_ID, 'client');
  assert.throws(() => webAuthEnv('optional-configured', inputs), /Identity bootstrap result missing/);
  assert.throws(() => webAuthEnv('disabled', {...inputs, secret: 'short'}), /Invalid web build inputs/);
});
test('injected web mismatch builds a neighbouring mode or provider shape', () => {
  assert.deepEqual([webAuthEnv('optional-configured', {identity, ...inputs, failAt: 'web-mode-mismatch'})].map(e => [e.AUTH_MODE, 'ZITADEL_ISSUER' in e]), [['optional', false]]);
  assert.equal(webAuthEnv('optional-anonymous', {...inputs, failAt: 'web-mode-mismatch'}).AUTH_MODE, 'disabled');
  assert.equal(webAuthEnv('disabled', {...inputs, failAt: 'web-mode-mismatch'}).AUTH_MODE, 'optional');
});

// ---- Mode agreement (KTD2) ----
test('compiled web mode is read from the built env and must be well formed', async () => {
  assert.deepEqual(parseCompiledMode(compiled('optional', 'true')), {mode: 'optional', providerConfigured: true});
  assert.deepEqual(parseCompiledMode(compiled('disabled', 'false')), {mode: 'disabled', providerConfigured: false});
  for (const bad of ['', '{', '[]', JSON.stringify({config: {}}), JSON.stringify({config: {env: []}}), compiled('Optional', 'true'), compiled('optional', 'yes'), compiled(undefined, 'false')]) {
    assert.throws(() => parseCompiledMode(bad), /Authentication mode disagreement: compiled web env/);
  }
  await assert.rejects(readCompiledMode(`/nonexistent/${randomBytes(8).toString('hex')}/required-server-files.json`), /compiled web env is missing/);
});
test('API mode report must be complete, self-consistent and without superadmins', () => {
  assert.deepEqual(parseApiMode(`noise\n${apiReport('disabled', false)}\n`), {mode: 'disabled', providerConfigured: false});
  for (const bad of ['', 'not json', apiReport('open', false), apiReport('optional', 'yes'), apiReport('optional', false, {processMode: 'required'}), apiReport('optional', false, {superadmins: 1}), JSON.stringify({mode: 'optional', providerConfigured: false})]) {
    assert.throws(() => parseApiMode(bad), /Authentication mode disagreement/);
  }
  assert.match(API_MODE_PROBE, /settings\.auth_mode/);
  assert.match(API_MODE_PROBE, /\/proc\/1\/environ/);
});
test('agreement passes only when web and API both match the profile', () => {
  const agree = (profile, web, api) => assertModeAgreement(profile, {web, api});
  const m = (mode, providerConfigured) => ({mode, providerConfigured});
  assert.deepEqual(agree('optional-configured', m('optional', true), m('optional', true)).api, m('optional', true));
  agree('optional-anonymous', m('optional', false), m('optional', false));
  agree('disabled', m('disabled', false), m('disabled', false));
  agree('baseline', m('required', true), m('required', true));
  // Compiled web mode differs from the API mode.
  assert.throws(() => agree('disabled', m('optional', false), m('disabled', false)), /web mode is not disabled/);
  assert.throws(() => agree('optional-anonymous', m('optional', false), m('disabled', false)), /API mode is not optional/);
  // Both agree with each other but not with the profile.
  assert.throws(() => agree('optional-anonymous', m('disabled', false), m('disabled', false)), /web mode is not optional/);
  // Provider flags differ from the profile.
  assert.throws(() => agree('optional-configured', m('optional', false), m('optional', true)), /web provider configuration is not active/);
  assert.throws(() => agree('optional-anonymous', m('optional', false), m('optional', true)), /API provider configuration is not absent/);
  assert.throws(() => agree('disabled', undefined, m('disabled', false)), /web mode/);
});

// ---- Playwright discovery (KTD7) ----
test('baseline discovery ignores every spec owned by another profile', () => {
  const [setup, teardown, chromium] = playwrightProjects('baseline');
  assert.deepEqual([setup.name, teardown.name, chromium.name], ['stack setup', 'stack teardown', 'chromium']);
  assert.deepEqual(chromium.dependencies, ['stack setup']);
  const ignored = file => chromium.testIgnore.some(pattern => path.matchesGlob(`/tmp/run/web/e2e/${file}`, pattern));
  for (const file of foreignSpecs('baseline')) assert.equal(ignored(file), true, file);
  for (const file of ['api/projects.spec.ts', 'browser/ontology-workflow.spec.ts', 'auth-foundation.spec.ts', 'browser/x-auth-mode-disabled.spec.ts.bak']) assert.equal(ignored(file), false, file);
  assert.equal(foreignSpecs('baseline').length, 4);
});
test('each non-baseline profile discovers exactly its own spec', () => {
  for (const profile of ['lifecycle', ...MODE_PROFILES]) {
    const projects = playwrightProjects(profile);
    assert.equal(projects.length, 1);
    assert.equal(projects[0].name, PROFILE_REGISTRY[profile].projects[0]);
    for (const [other, p] of Object.entries(PROFILE_REGISTRY)) {
      for (const file of p.specs ?? ['api/projects.spec.ts', 'stack.setup.ts']) {
        assert.equal(path.matchesGlob(`/tmp/run/web/e2e/${file}`, projects[0].testMatch), other === profile, `${profile} vs ${file}`);
      }
    }
    assert.equal(specOwner(PROFILE_REGISTRY[profile].specs[0]), profile);
  }
  assert.equal(specOwner('api/projects.spec.ts'), 'baseline');
});

// ---- Launcher ordering: the gate precedes every browser case ----
function fakeCtx(profile, overrides = {}) {
  const calls = [];
  const deps = {
    bootstrapIdentity: async () => { calls.push('identity'); return {...identity, web: inputs.web, api: inputs.api, users: {owner: {id: '123', email: 'o@example.test', password: 'x'}}, lifetimes: null}; },
    readyHttp: async url => { calls.push(`ready ${new URL(url).pathname}`); },
    prepareWeb: async (_ctx, env) => { calls.push(`build ${env.AUTH_MODE} ${'ZITADEL_ISSUER' in env}`); },
    readCompiledMode: async () => { calls.push('read-web'); return {mode: profileSpec(profile).webMode, providerConfigured: profileSpec(profile).identity}; },
    probeApiMode: async () => { calls.push('read-api'); return {mode: profileSpec(profile).apiMode, providerConfigured: profileSpec(profile).identity}; },
    startWeb: async () => { calls.push('start-web'); return new Promise(() => {}); },
    seedFixtures: async () => { calls.push('seed'); return {publicProject: {id: '00000000-0000-4000-8000-000000000001'}}; },
    runPlaywright: async () => { calls.push('playwright'); throw new Error('stop after playwright'); },
    purgeSeededFixtures: async () => { calls.push('purge'); },
    saveManifest: async () => {}, writePrivate: async () => { calls.push('write-config'); }, makePrivateDir: async () => {},
    ...overrides,
  };
  const ctx = {profile, dir: `/tmp/ontokit-e2e-${process.getuid()}/${'f'.repeat(32)}`, manifestDir: null, manifest: {id: 'f'.repeat(32), ports: {web: 3, api: 4}, status: 'x'}, env: {}, signal: new AbortController().signal, deps};
  return {ctx, calls};
}
test('mode disagreement stops the launcher before any browser case', async () => {
  for (const profile of MODE_PROFILES) {
    const {ctx, calls} = fakeCtx(profile, {probeApiMode: async () => { return {mode: 'required', providerConfigured: true}; }});
    await assert.rejects(fullStack(ctx, ctx.deps), /Authentication mode disagreement/);
    assert.equal(calls.includes('playwright'), false);
    assert.equal(calls.includes('seed'), false);
    assert.equal(calls.includes('identity'), profileSpec(profile).identity);
  }
});
test('agreement, seeding and the before-browser stop run in order with no Playwright', async () => {
  for (const profile of MODE_PROFILES) {
    const {ctx, calls} = fakeCtx(profile);
    ctx.failAt = 'before-browser';
    await assert.rejects(fullStack(ctx, ctx.deps), /Injected before-browser stop/);
    const order = ['read-web', 'read-api', 'seed'].map(c => calls.indexOf(c));
    assert.ok(order.every((v, i) => v >= 0 && (i === 0 || v > order[i - 1])), calls.join());
    assert.ok(calls.indexOf(`build ${profile === 'disabled' ? 'disabled' : 'optional'} ${profile === 'optional-configured'}`) < calls.indexOf('read-web'));
    assert.equal(calls.includes('playwright'), false);
    assert.deepEqual(ctx.manifest.authModes.web, {mode: profileSpec(profile).webMode, providerConfigured: profileSpec(profile).identity});
  }
});
test('provider-less profiles never bootstrap identity; baseline and lifecycle still do', async () => {
  for (const profile of ['optional-anonymous', 'disabled']) {
    const {ctx, calls} = fakeCtx(profile); ctx.failAt = 'before-browser';
    await assert.rejects(fullStack(ctx, ctx.deps), /Injected/);
    assert.equal(calls.includes('identity'), false);
  }
  const {ctx, calls} = fakeCtx('baseline');
  await assert.rejects(fullStack(ctx, ctx.deps), /stop after playwright/);
  assert.equal(calls[0], 'identity');
  assert.equal(calls.includes('seed'), false, 'baseline keeps its D06 fixtures');
});

// ---- Private run config shape (discriminated by profile) ----
const loadRunModule = () => import('../../e2e/fixtures/run.ts');
async function withRunConfig(config, check) {
  const id = randomBytes(16).toString('hex');
  const dir = `/tmp/ontokit-e2e-${process.getuid()}/${id}`;
  await mkdir(path.dirname(dir), {recursive: true, mode: 0o700});
  await mkdir(dir, {mode: 0o700});
  const file = path.join(dir, 'playwright-run.json');
  const saved = {config: process.env.ONTOKIT_E2E_CONFIG, run: process.env.ONTOKIT_E2E_RUN};
  try {
    await writeFile(file, JSON.stringify({id, dir, web: inputs.web, api: inputs.api, ordinaryUserPolicyVerified: true, ...config}), {mode: 0o600});
    process.env.ONTOKIT_E2E_CONFIG = file; process.env.ONTOKIT_E2E_RUN = id;
    await check((await loadRunModule()).loadRunConfig);
  } finally {
    for (const [key, value] of [['ONTOKIT_E2E_CONFIG', saved.config], ['ONTOKIT_E2E_RUN', saved.run]]) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
    await rm(dir, {recursive: true, force: true});
  }
}
const user = role => ({id: `${role}-id`, email: `${role}@example.test`, password: 'x'});
const idp = {issuer: 'http://localhost:1', login: 'http://localhost:2/ui/v2/login'};
const fixtures = {publicProject: '00000000-0000-4000-8000-000000000001', foreignPrivateProject: '00000000-0000-4000-8000-000000000002'};
const modes = (mode, providerConfigured) => ({web: {mode, providerConfigured}, api: {mode, providerConfigured}});
test('baseline run config is accepted unchanged', async () => {
  await withRunConfig({profile: 'baseline', ...idp, users: {owner: user('owner'), unrelated: user('unrelated')}}, load => assert.equal(load().profile, 'baseline'));
});
test('provider-less run configs forbid identity URLs and users', async () => {
  for (const profile of ['optional-anonymous', 'disabled']) {
    const good = {profile, fixtures, authModes: modes(profile === 'disabled' ? 'disabled' : 'optional', false)};
    await withRunConfig(good, load => assert.deepEqual(load().fixtures, fixtures));
    await withRunConfig({...good, issuer: idp.issuer}, load => assert.throws(load, /Provider-less/));
    await withRunConfig({...good, login: idp.login}, load => assert.throws(load, /Provider-less/));
    await withRunConfig({...good, users: {owner: user('owner')}}, load => assert.throws(load, /Provider-less/));
    await withRunConfig({...good, fixtures: {...fixtures, personaPrivateProject: fixtures.publicProject}}, load => assert.throws(load, /fixtures/));
    await withRunConfig({...good, authModes: modes('required', false)}, load => assert.throws(load, /mode agreement/));
  }
});
test('provider run configs require identity URLs, the persona and its fixture', async () => {
  const good = {profile: 'optional-configured', ...idp, users: {owner: user('owner')}, fixtures: {...fixtures, personaPrivateProject: '00000000-0000-4000-8000-000000000003'}, authModes: modes('optional', true)};
  await withRunConfig(good, load => assert.equal(load().profile, 'optional-configured'));
  await withRunConfig({...good, issuer: undefined}, load => assert.throws(load, /loopback|identity/));
  await withRunConfig({...good, login: undefined}, load => assert.throws(load, /loopback|identity/));
  await withRunConfig({...good, users: {}}, load => assert.throws(load, /identities/));
  await withRunConfig({...good, fixtures}, load => assert.throws(load, /fixtures/));
  await withRunConfig({...good, authModes: modes('optional', false)}, load => assert.throws(load, /mode agreement/));
  await withRunConfig({...good, profile: 'optional'}, load => assert.throws(load, /Unknown E2E profile/));
});

// ---- Browser sign-in matcher and provider-less route coverage (D09 review) ----
const e2eRoot = new URL('../../e2e/', import.meta.url);
async function signInMatcher() {
  const {readFile} = await import('node:fs/promises');
  const source = await readFile(new URL('fixtures/auth-mode.ts', e2eRoot), 'utf8');
  const literal = source.match(/const SIGN_IN_NAME = \/(.+)\/([a-z]*);/);
  assert.ok(literal, 'SIGN_IN_NAME regex literal is declared');
  return new RegExp(literal[1], literal[2]);
}
test('the browser sign-in matcher catches every sign-in control variant', async () => {
  const matcher = await signInMatcher();
  for (const name of ['Sign in', 'Sign In', 'Sign in to edit', 'Sign in with Zitadel', 'Sign-in', 'signin', 'Try signing in again', 'Sign in for full editing']) {
    assert.ok(matcher.test(name), `matches ${JSON.stringify(name)}`);
  }
  for (const name of ['Sign out', 'Designing insights', 'Propose Edit', 'Go to homepage']) {
    assert.ok(!matcher.test(name), `ignores ${JSON.stringify(name)}`);
  }
});
test('provider-less browser specs visit the auth-error route inside their existing route case', async () => {
  const {readFile} = await import('node:fs/promises');
  for (const spec of ['auth-mode-optional-anonymous.spec.ts', 'auth-mode-disabled.spec.ts']) {
    const source = await readFile(new URL(`browser/${spec}`, e2eRoot), 'utf8');
    assert.match(source, /\["\/auth\/error\?error=Configuration", "Sign-in is unavailable"\]/, `${spec} visits /auth/error`);
  }
});
