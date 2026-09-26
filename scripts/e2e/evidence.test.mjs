import test from 'node:test';
import assert from 'node:assert/strict';
import {validateReport, REQUIRED_TESTS, LIFECYCLE_REQUIRED_TESTS, PROFILE_INVENTORIES, sanitizedEvidence} from './evidence.mjs';

const SENTINEL = 'sensitive-sentinel';
const passing = (projectName, annotations = []) => ({projectName, annotations, expectedStatus: 'passed', status: 'expected', results: [{status: 'passed', retry: 0, errors: []}]});
const baseline = () => ({stats: {expected: 21, skipped: 0, unexpected: 0, flaky: 0}, errors: [], suites: [{specs: REQUIRED_TESTS.map(t => ({file: t.file, title: t.title, ok: true, tests: [passing(t.project)]}))}]});

// Shapes match e2e/browser/auth-lifecycle.spec.ts `recordEvidence` calls exactly.
const EVIDENCE = {
  R1: [
    {case: 'r1-logout-observed', providerSessionChooser: false, postLogoutRedirected: true, endSessionClientId: true, endSessionIdTokenHint: true, appCookiesCleared: true},
    {case: 'r1-logout', clock: 'real', firstLoginInteractive: true, appCookiesCleared: true, endSessionClientId: true, endSessionIdTokenHint: true, providerSessionChooser: false, postLogoutRedirected: true, nextLoginInteractive: true},
  ],
  R2: [{case: 'r2-renewal', clock: 'real-elapsed', observedAccessLifetimeSeconds: 60, graceSeconds: 20, renewedAfterExpirySeconds: 6, credentialChanged: true, sameSubject: true, interactiveLogin: false}],
  R3: [{case: 'r3-refresh-recovery', clock: 'real-elapsed', refreshIdleSeconds: 180, graceSeconds: 20, waitedAfterIssueSeconds: 201, refreshErrorObserved: true, sessionGuardInitiated: true, providerSsoReused: true, originalUrlRestored: true, credentialChanged: true}],
  R4: [{case: 'r4-cookie-expiry', clock: 'controlled-next-process', specimenSource: 'oidc-callback', verifierToleranceSeconds: 15, marginSeconds: 5, workerShiftErrorMs: 12, toleranceWindowExercised: true, beforeAccepted: true, afterRejected: true, cookiesCleared: true, signedOutUi: true, restoredBeforeSignIn: true, refreshErrorBeforeBoundary: true, providerSsoReused: true}],
};
const annotate = entries => entries.map(e => ({type: 'lifecycle-evidence', description: JSON.stringify(e)}));
const lifecycle = () => ({stats: {expected: 4, skipped: 0, unexpected: 0, flaky: 0}, errors: [], suites: [{specs: LIFECYCLE_REQUIRED_TESTS.map(t => ({file: t.file, title: t.title, ok: true, tests: [passing(t.project, annotate(EVIDENCE[t.title.slice(0, 2)]))]}))}]});
const specOf = (r, prefix) => r.suites[0].specs.find(s => s.title.startsWith(prefix));
const rejects = (r, profile) => assert.throws(() => validateReport(r, {profile}), /mandatory/);

// ---- Baseline (D06) inventory: unchanged and still mandatory ----
test('foundation-only green report must not satisfy B10', () => {
  rejects({stats: {expected: 4, skipped: 0, unexpected: 0, flaky: 0}, errors: [], suites: []}, 'baseline');
});
test('baseline inventory is exactly the 21 D06 mandatory tests', () => {
  assert.equal(REQUIRED_TESTS.length, 21);
  assert.equal(PROFILE_INVENTORIES.baseline, REQUIRED_TESTS);
  assert.equal(validateReport(baseline(), {profile: 'baseline'}).mandatory.length, 21);
  assert.equal(validateReport(baseline(), {profile: 'baseline'}).profile, 'baseline');
});
for (const file of [...new Set(REQUIRED_TESTS.map(t => t.file))]) test(`missing ${file} fails despite inflated counts`, () => {
  const r = baseline(); r.suites[0].specs = r.suites[0].specs.filter(t => t.file !== file);
  while (r.suites[0].specs.length < 21) r.suites[0].specs.push(structuredClone(r.suites[0].specs[0]));
  rejects(r, 'baseline');
});
for (const kind of ['skipped', 'unexpected', 'flaky']) test(`baseline ${kind} fails`, () => {
  const r = baseline(); r.stats[kind] = 1; rejects(r, 'baseline');
});
for (const mutate of [
  r => r.errors.push({message: 'private error'}),
  r => r.suites[0].specs[0].tests[0].results[0].status = 'skipped',
  r => r.suites[0].specs[0].tests[0].expectedStatus = 'failed',
  r => r.suites[0].specs[0].tests[0].projectName = 'wrong-project',
  r => r.suites[0].specs[0].tests[0].results.push({status: 'passed'}),
  r => r.suites[0].specs[0].tests[0].results[0].errors = [{message: 'private error'}],
]) test('per-test errors, retries and invalid identity fail', () => {
  const r = baseline(); mutate(r); rejects(r, 'baseline');
});
test('lifecycle report cannot substitute for baseline acceptance', () => {
  rejects(lifecycle(), 'baseline');
});
test('baseline run that also carries lifecycle cases (mixed profile) fails', () => {
  const r = baseline(); const extra = lifecycle().suites[0].specs;
  r.suites[0].specs.push(...extra); r.stats.expected += extra.length;
  rejects(r, 'baseline');
});

test('baseline run with an extra lifecycle-spec or lifecycle-project test (mixed profile) fails', () => {
  const byFile = baseline(); byFile.suites[0].specs.push({file: 'browser/auth-lifecycle.spec.ts', title: 'extra', ok: true, tests: [passing('chromium')]}); byFile.stats.expected = 22;
  rejects(byFile, 'baseline');
  const byProject = baseline(); byProject.suites[0].specs.push({file: 'api/extra.spec.ts', title: 'extra', ok: true, tests: [passing('lifecycle')]}); byProject.stats.expected = 22;
  rejects(byProject, 'baseline');
});

// ---- Lifecycle inventory ----
test('complete lifecycle report passes with profile identity and clock labels', () => {
  const result = validateReport(lifecycle(), {profile: 'lifecycle'});
  assert.equal(result.profile, 'lifecycle');
  assert.equal(result.passed, 4);
  assert.deepEqual(result.mandatory.map(t => t.title), LIFECYCLE_REQUIRED_TESTS.map(t => t.title));
  assert.deepEqual(result.clockControlledCases, [LIFECYCLE_REQUIRED_TESTS[3].title]);
  assert.deepEqual(result.realElapsedCases, [LIFECYCLE_REQUIRED_TESTS[1].title, LIFECYCLE_REQUIRED_TESTS[2].title]);
  assert.deepEqual(result.cases.map(c => c.clock), ['real', 'real-elapsed', 'real-elapsed', 'controlled-next-process']);
});
for (const index of [0, 1, 2, 3]) test(`removing lifecycle case R${index + 1} fails despite inflated counts`, () => {
  const r = lifecycle(); const keep = r.suites[0].specs.filter((_, i) => i !== index);
  r.suites[0].specs = [...keep, {...structuredClone(keep[0]), title: 'an unrelated green test'}];
  rejects(r, 'lifecycle');
  const inflated = lifecycle(); inflated.suites[0].specs.splice(index, 1); inflated.stats.expected = 40;
  rejects(inflated, 'lifecycle');
});
test('lifecycle run with an extra unlisted test fails', () => {
  const r = lifecycle(); r.suites[0].specs.push({file: 'browser/auth-lifecycle.spec.ts', title: 'R5 unlisted', ok: true, tests: [passing('lifecycle')]}); r.stats.expected = 5;
  rejects(r, 'lifecycle');
});
test('baseline report cannot substitute for lifecycle acceptance', () => rejects(baseline(), 'lifecycle'));
test('unknown or missing profile fails', () => {
  rejects(lifecycle(), 'mixed');
  rejects(lifecycle(), undefined);
  rejects(baseline(), 'Baseline');
});
for (const [name, mutate] of Object.entries({
  'wrong project': r => { r.suites[0].specs[0].tests[0].projectName = 'chromium'; },
  'wrong file': r => { r.suites[0].specs[0].file = 'browser/ontology-workflow.spec.ts'; },
  'duplicate case': r => { r.suites[0].specs.push(structuredClone(r.suites[0].specs[1])); r.stats.expected = 5; },
  'duplicate evidence annotation': r => { const t = specOf(r, 'R2').tests[0]; t.annotations.push(...structuredClone(t.annotations)); },
  'skip (stats)': r => { r.stats.skipped = 1; },
  'skip (result)': r => { specOf(r, 'R3').tests[0].results[0].status = 'skipped'; },
  'fixme annotation': r => { specOf(r, 'R3').tests[0].annotations.push({type: 'fixme'}); },
  'expected failure (fail)': r => { specOf(r, 'R4').tests[0].expectedStatus = 'failed'; specOf(r, 'R4').tests[0].annotations.push({type: 'fail'}); },
  'fail annotation alone': r => { specOf(r, 'R4').tests[0].annotations.push({type: 'fail'}); },
  'retry': r => { specOf(r, 'R2').tests[0].results[0].retry = 1; },
  'second attempt': r => { specOf(r, 'R2').tests[0].results.unshift({status: 'failed', retry: 0, errors: []}); },
  'flaky': r => { r.stats.flaky = 1; specOf(r, 'R2').tests[0].status = 'flaky'; },
  'global runner error': r => { r.errors.push({message: SENTINEL}); },
  'missing evidence annotation': r => { specOf(r, 'R4').tests[0].annotations = []; },
  'evidence in the wrong case': r => { const a = specOf(r, 'R4').tests[0].annotations; specOf(r, 'R2').tests[0].annotations.push(...a); specOf(r, 'R4').tests[0].annotations = []; },
  'wrong clock label on R4': r => { specOf(r, 'R4').tests[0].annotations = annotate([{...EVIDENCE.R4[0], clock: 'real-elapsed'}]); },
  'controlled clock claimed on R2': r => { specOf(r, 'R2').tests[0].annotations = annotate([{...EVIDENCE.R2[0], clock: 'controlled-next-process'}]); },
  'false proof field': r => { specOf(r, 'R4').tests[0].annotations = annotate([{...EVIDENCE.R4[0], afterRejected: false}]); },
  'interactive renewal': r => { specOf(r, 'R2').tests[0].annotations = annotate([{...EVIDENCE.R2[0], interactiveLogin: true}]); },
  'R1 logout without id_token_hint': r => { specOf(r, 'R1').tests[0].annotations = annotate([{...EVIDENCE.R1[0], endSessionIdTokenHint: false}, EVIDENCE.R1[1]]); },
  'R1 provider session chooser tolerated': r => { specOf(r, 'R1').tests[0].annotations = annotate([EVIDENCE.R1[0], {...EVIDENCE.R1[1], providerSessionChooser: true}]); },
  'R1 no post-logout redirect': r => { specOf(r, 'R1').tests[0].annotations = annotate([{...EVIDENCE.R1[0], postLogoutRedirected: false}, EVIDENCE.R1[1]]); },
  'R1 id_token_hint omitted from evidence': r => { const {endSessionIdTokenHint: _omitted, ...rest} = EVIDENCE.R1[1]; specOf(r, 'R1').tests[0].annotations = annotate([EVIDENCE.R1[0], rest]); },
  'malformed evidence JSON': r => { specOf(r, 'R1').tests[0].annotations[1].description = '{not json'; },
})) test(`lifecycle ${name} prevents acceptance`, () => {
  const r = lifecycle(); mutate(r); rejects(r, 'lifecycle');
});
test('evidence drops unknown keys and non-fixed values', () => {
  const r = lifecycle();
  specOf(r, 'R3').tests[0].annotations = annotate([{...EVIDENCE.R3[0], bearer: SENTINEL, cookie: `a=${SENTINEL}`, subject: '312345678901234567', graceSeconds: 'twenty'}]);
  const result = validateReport(r, {profile: 'lifecycle'});
  const r3 = result.cases.find(c => c.title.startsWith('R3')).evidence[0];
  assert.equal(JSON.stringify(result).includes(SENTINEL), false);
  assert.equal('subject' in r3 || 'bearer' in r3 || 'cookie' in r3, false);
  assert.equal('graceSeconds' in r3, false);
  assert.equal(r3.refreshIdleSeconds, 180);
  assert.equal(result.cases[0].evidence[0].endSessionIdTokenHint, true);
});

// ---- Receipts ----
const source = {revision: 'a'.repeat(40), sha256: 'b'.repeat(64), secret: SENTINEL};
const images = () => ['postgres', 'redis', 'minio', 'zitadel', 'login', 'api', 'worker'].map(service => ({service, id: `sha256:${'c'.repeat(64)}`, reference: `example/image@sha256:${'d'.repeat(64)}`, secret: SENTINEL}));
const lifecycleBlock = () => ({
  lifetimes: {accessTokenLifetime: 60, idTokenLifetime: 60, refreshTokenIdleExpiration: 180, refreshTokenExpiration: 360, secret: SENTINEL},
  graceSeconds: 20, observedAccessTokenLifetimeSeconds: 60, clockControl: `/tmp/private/${SENTINEL}`,
  preflight: {verifierToleranceSeconds: 15, sessionMaxAgeSeconds: 2592000, marginMs: 5000, workerShiftErrorMs: 9, toleranceWindowExercised: true, refreshErrorBeforeBoundary: true, serviceClockSkewMs: 0, beforeAccepted: true, afterRejected: true, cookiesCleared: true, restored: true, cookieHeader: SENTINEL},
});
const baselineManifest = () => ({id: 'a'.repeat(32), profile: 'baseline', sources: {api: source, web: source}, secret: SENTINEL, tests: validateReport(baseline(), {profile: 'baseline'}), migrationHeads: ['20260920_head', 'private/token'], evidenceImages: images()});
const lifecycleManifest = () => ({...baselineManifest(), profile: 'lifecycle', tests: validateReport(lifecycle(), {profile: 'lifecycle'}), lifecycle: lifecycleBlock()});
const ok = {cleanup: 'complete', workflowPassed: true};

test('receipt allowlist drops private fields and never accepts failed cleanup', () => {
  const manifest = baselineManifest();
  const result = sanitizedEvidence(manifest, {cleanup: 'failed', workflowPassed: true});
  assert.equal(result.acceptedRun, false);
  assert.equal(JSON.stringify(result).includes(SENTINEL), false);
  assert.equal(sanitizedEvidence(manifest, ok).acceptedRun, true);
  assert.equal(sanitizedEvidence(manifest, ok).profile, 'baseline');
  assert.equal(sanitizedEvidence(manifest, {cleanup: 'complete', workflowPassed: false}).acceptedRun, false);
});
test('receipt requires every service, not seven duplicate image entries', () => {
  const image = {service: 'api', id: `sha256:${'c'.repeat(64)}`, reference: `example/image@sha256:${'d'.repeat(64)}`};
  assert.equal(sanitizedEvidence({...baselineManifest(), evidenceImages: Array(7).fill(image)}, ok).acceptedRun, false);
});
test('receipt requires an explicit known profile matching its tests', () => {
  assert.equal(sanitizedEvidence({...baselineManifest(), profile: undefined}, ok).acceptedRun, false);
  assert.equal(sanitizedEvidence({...baselineManifest(), profile: 'mixed'}, ok).acceptedRun, false);
  assert.equal(sanitizedEvidence({...baselineManifest(), profile: 'lifecycle', lifecycle: lifecycleBlock()}, ok).acceptedRun, false);
  assert.equal(sanitizedEvidence({...lifecycleManifest(), profile: 'baseline'}, ok).acceptedRun, false);
});
test('lifecycle tests with an inflated count cannot be relabelled as a baseline receipt', () => {
  const m = lifecycleManifest(); m.profile = 'baseline'; m.tests = {...m.tests, passed: 21};
  assert.equal(sanitizedEvidence(m, ok).acceptedRun, false);
});
test('receipt rebuilds inventories instead of trusting manifest names or counts', () => {
  const m = baselineManifest(); m.tests = {...m.tests, passed: `21 ${SENTINEL}`, mandatory: [{file: SENTINEL}]};
  const result = sanitizedEvidence(m, ok);
  assert.equal(JSON.stringify(result).includes(SENTINEL), false);
  assert.equal(result.acceptedRun, false);
});
test('lifecycle receipt distinguishes controlled-clock proof and local scope', () => {
  const result = sanitizedEvidence(lifecycleManifest(), ok);
  assert.equal(result.acceptedRun, true);
  assert.equal(result.profile, 'lifecycle');
  assert.equal(JSON.stringify(result).includes(SENTINEL), false);
  assert.deepEqual(result.acceptance, {scope: 'local-verification', hostedAcceptance: false});
  assert.deepEqual(result.tests.clockControlledCases, [LIFECYCLE_REQUIRED_TESTS[3].title]);
  assert.deepEqual(result.tests.realElapsedCases, [LIFECYCLE_REQUIRED_TESTS[1].title, LIFECYCLE_REQUIRED_TESTS[2].title]);
  assert.deepEqual(result.tests.cases.map(c => c.clock), ['real', 'real-elapsed', 'real-elapsed', 'controlled-next-process']);
  assert.equal(result.tests.cases[3].evidence[0].workerShiftErrorMs, 12);
  assert.deepEqual(result.lifecycle, {
    lifetimes: {accessTokenLifetime: 60, idTokenLifetime: 60, refreshTokenIdleExpiration: 180, refreshTokenExpiration: 360},
    graceSeconds: 20, observedAccessTokenLifetimeSeconds: 60,
    preflight: {verifierToleranceSeconds: 15, sessionMaxAgeSeconds: 2592000, marginMs: 5000, workerShiftErrorMs: 9, toleranceWindowExercised: true, refreshErrorBeforeBoundary: true, serviceClockSkewMs: 0, beforeAccepted: true, afterRejected: true, cookiesCleared: true, restored: true},
  });
  assert.equal(sanitizedEvidence(baselineManifest(), ok).lifecycle, null);
  assert.equal(sanitizedEvidence(baselineManifest(), ok).tests.clockControlledCases, undefined);
});
for (const [name, mutate] of Object.entries({
  'failed cleanup': null,
  'missing preflight block': m => { delete m.lifecycle; },
  'unrestored clock': m => { m.lifecycle.preflight.restored = false; },
  'string preflight number': m => { m.lifecycle.preflight.workerShiftErrorMs = '9'; },
  'missing lifetime': m => { delete m.lifecycle.lifetimes.refreshTokenIdleExpiration; },
  'missing case evidence': m => { m.tests.cases[3].evidence = []; },
  'tampered clock label': m => { m.tests.cases[3].clock = 'real-elapsed'; },
})) test(`lifecycle receipt with ${name} is not accepted`, () => {
  const m = lifecycleManifest();
  if (mutate) mutate(m);
  assert.equal(sanitizedEvidence(m, mutate ? ok : {cleanup: 'failed', workflowPassed: true}).acceptedRun, false);
});

// ---- D09 auth-mode profiles (U6: KTD3, KTD7) ----
const MODE_PROFILES = ['optional-configured', 'optional-anonymous', 'disabled'];
const modeReport = profile => {
  const inventory = PROFILE_INVENTORIES[profile];
  return {stats: {expected: inventory.length, skipped: 0, unexpected: 0, flaky: 0}, errors: [], suites: [{specs: inventory.map(t => ({file: t.file, title: t.title, ok: true, tests: [passing(t.project)]}))}]};
};
const MODE_SHAPE = {'optional-configured': ['optional', true], 'optional-anonymous': ['optional', false], disabled: ['disabled', false]};
const authModes = (profile, web = MODE_SHAPE[profile], api = web) => ({profile, web: {mode: web[0], providerConfigured: web[1]}, api: {mode: api[0], providerConfigured: api[1]}});
const providerless = profile => !MODE_SHAPE[profile][1];
const modeImages = profile => images().filter(i => !providerless(profile) || !['zitadel', 'login'].includes(i.service));
const modeManifest = profile => ({...baselineManifest(), profile, tests: validateReport(modeReport(profile), {profile}), evidenceImages: modeImages(profile), authModes: authModes(profile)});

test('baseline and lifecycle inventories are unchanged by the new profiles', () => {
  assert.equal(PROFILE_INVENTORIES.baseline, REQUIRED_TESTS);
  assert.equal(REQUIRED_TESTS.length, 21);
  assert.equal(PROFILE_INVENTORIES.lifecycle, LIFECYCLE_REQUIRED_TESTS);
  assert.equal(LIFECYCLE_REQUIRED_TESTS.length, 4);
});
for (const profile of MODE_PROFILES) {
  test(`${profile} has a fixed inventory from its own registry spec and project`, () => {
    const inventory = PROFILE_INVENTORIES[profile];
    assert.ok(inventory.length > 0);
    assert.ok(inventory.every(t => t.file === `browser/auth-mode-${profile}.spec.ts` && t.project === profile));
    assert.equal(new Set(inventory.map(t => t.title)).size, inventory.length);
    const result = validateReport(modeReport(profile), {profile});
    assert.equal(result.profile, profile);
    assert.equal(result.passed, inventory.length);
  });
  test(`${profile}: removing any mandatory case fails even with an inflated count`, () => {
    for (let i = 0; i < PROFILE_INVENTORIES[profile].length; i++) {
      const r = modeReport(profile); const keep = r.suites[0].specs.filter((_, j) => j !== i);
      r.suites[0].specs = [...keep, {...structuredClone(keep[0] ?? modeReport(profile).suites[0].specs[0]), title: 'an unrelated green test'}];
      rejects(r, profile);
    }
  });
  test(`${profile}: foreign spec, duplicate, extra, skip, retry or runner error prevents acceptance`, () => {
    for (const mutate of [
      r => { r.suites[0].specs.push({file: 'api/projects.spec.ts', title: REQUIRED_TESTS[12].title, ok: true, tests: [passing(profile)]}); r.stats.expected++; },
      r => { r.suites[0].specs.push({file: 'browser/auth-lifecycle.spec.ts', title: 'x', ok: true, tests: [passing(profile)]}); r.stats.expected++; },
      r => { const other = MODE_PROFILES.find(p => p !== profile); r.suites[0].specs.push({file: `browser/auth-mode-${other}.spec.ts`, title: 'x', ok: true, tests: [passing(profile)]}); r.stats.expected++; },
      r => { r.suites[0].specs[0].tests[0].projectName = 'chromium'; },
      r => { r.suites[0].specs.push(structuredClone(r.suites[0].specs[0])); r.stats.expected++; },
      r => { r.suites[0].specs.push({...structuredClone(r.suites[0].specs[0]), title: 'unlisted'}); r.stats.expected++; },
      r => { r.stats.skipped = 1; },
      r => { r.suites[0].specs[0].tests[0].results[0].retry = 1; },
      r => { r.errors.push({message: SENTINEL}); },
      r => { r.suites[0].specs[0].tests[0].annotations.push({type: 'fixme'}); },
    ]) { const r = modeReport(profile); mutate(r); rejects(r, profile); }
  });
  test(`${profile} report cannot stand in for baseline or lifecycle, nor they for it`, () => {
    rejects(modeReport(profile), 'baseline');
    rejects(modeReport(profile), 'lifecycle');
    rejects(baseline(), profile);
    rejects(lifecycle(), profile);
  });
  test(`${profile} receipt records agreeing modes and its own service set`, () => {
    const result = sanitizedEvidence(modeManifest(profile), ok);
    assert.equal(result.acceptedRun, true, profile);
    assert.equal(result.profile, profile);
    assert.deepEqual(result.authModes, {web: authModes(profile).web, api: authModes(profile).api});
    assert.equal(JSON.stringify(result).includes(SENTINEL), false);
  });
  test(`${profile} receipt with disagreeing or missing modes is rejected`, () => {
    const [mode, provider] = MODE_SHAPE[profile];
    const other = mode === 'disabled' ? 'optional' : 'disabled';
    for (const modes of [
      undefined,
      authModes(profile, [other, provider], [mode, provider]),
      authModes(profile, [mode, provider], [other, provider]),
      authModes(profile, [other, provider]),
      authModes(profile, [mode, !provider], [mode, provider]),
      authModes(profile, [mode, provider], [mode, !provider]),
      {...authModes(profile), profile: 'baseline'},
      {...authModes(profile), web: {mode, providerConfigured: String(provider)}},
    ]) {
      const result = sanitizedEvidence({...modeManifest(profile), authModes: modes}, ok);
      assert.equal(result.acceptedRun, false, JSON.stringify(modes));
      assert.equal(result.authModes, null);
    }
  });
}
test('provider-less receipts are accepted without Zitadel and Login; provider receipts are not', () => {
  for (const profile of ['optional-anonymous', 'disabled']) {
    assert.equal(sanitizedEvidence(modeManifest(profile), ok).acceptedRun, true);
    assert.equal(sanitizedEvidence({...modeManifest(profile), evidenceImages: images()}, ok).acceptedRun, true, 'extra images do not block');
  }
  const missingIdp = m => ({...m, evidenceImages: m.evidenceImages.filter(i => !['zitadel', 'login'].includes(i.service))});
  assert.equal(sanitizedEvidence(missingIdp(modeManifest('optional-configured')), ok).acceptedRun, false);
  assert.equal(sanitizedEvidence(missingIdp(baselineManifest()), ok).acceptedRun, false);
  assert.equal(sanitizedEvidence(missingIdp(lifecycleManifest()), ok).acceptedRun, false);
  const noWorker = {...modeManifest('disabled'), evidenceImages: modeImages('disabled').filter(i => i.service !== 'worker')};
  assert.equal(sanitizedEvidence(noWorker, ok).acceptedRun, false);
});
test('baseline receipts still accept without recorded modes but reject recorded disagreement', () => {
  assert.equal(sanitizedEvidence(baselineManifest(), ok).acceptedRun, true);
  const agreeing = {...baselineManifest(), authModes: {profile: 'baseline', web: {mode: 'required', providerConfigured: true}, api: {mode: 'required', providerConfigured: true}}};
  assert.equal(sanitizedEvidence(agreeing, ok).acceptedRun, true);
  assert.deepEqual(sanitizedEvidence(agreeing, ok).authModes, {web: agreeing.authModes.web, api: agreeing.authModes.api});
  const disagreeing = {...agreeing, authModes: {...agreeing.authModes, api: {mode: 'optional', providerConfigured: true}}};
  assert.equal(sanitizedEvidence(disagreeing, ok).acceptedRun, false);
});
