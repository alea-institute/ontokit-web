import assert from 'node:assert/strict';
import {test} from 'node:test';
import {validateTarget, validateRuntimeAfter, validateHostedReport, HOSTED_CASES} from './hosted-suggestions-contract.mjs';
import {SUGGESTION_CASES} from './evidence.mjs';
import {mkdtemp, writeFile, readFile, stat} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {runHosted, recordResource} from './hosted-suggestions.mjs';

export function syntheticTarget(now = Date.now()) {
  return {
    web: 'https://web.example.test', api: 'https://api.example.test', issuer: 'https://id.example.test', login: 'https://login.example.test',
    users: Object.fromEntries(['owner', 'suggester', 'editor', 'unrelated'].map((p, i) => [p, {id: `${i + 1}`, email: `${p}@example.test`, password: 'synthetic-password'}])),
    hosted: {
      version: 1, retain: true, observationWindowSeconds: 60,
      runtime: {observedAt: new Date(now).toISOString(), web: 'a'.repeat(40), api: 'b'.repeat(40), worker: 'b'.repeat(40),
        authModes: {web: {mode: 'optional', providerConfigured: true}, api: {mode: 'optional', providerConfigured: true}}},
      ordinaryPersonas: Object.fromEntries(['owner', 'suggester', 'editor', 'unrelated'].map((p, i) => [p, {subject: `${i + 1}`, nonAdministrative: true}])),
      noBilling: {import: true, index: true, save: true, submit: true},
      refreshIdleSeconds: 86400, refreshAbsoluteSeconds: 172800,
    },
  };
}
export function syntheticReport() {
  const specs = SUGGESTION_CASES.filter(c => c.profile === 'suggestions').map(c => ({file: 'browser/suggestions.spec.ts', title: c.title, project: 'suggestions',
    annotations: c.probes.map(p => ({type: 'mode-evidence', description: JSON.stringify(p)}))}));
  specs.push(...HOSTED_CASES.map(c => ({file: 'browser/hosted-personas.spec.ts', title: c.title, project: 'hosted-personas',
    annotations: [{type: 'hosted-evidence', description: JSON.stringify(c.proof)}]})));
  return {errors: [], stats: {expected: specs.length, unexpected: 0, skipped: 0, flaky: 0}, suites: [{specs: specs.map(({file, title, project, annotations}) => ({file, title, ok: true, tests: [{projectName: project, status: 'expected', expectedStatus: 'passed', annotations, results: [{status: 'passed', retry: 0, errors: []}]}]}))}]};
}
test('hosted preflight requires four distinct attested ordinary identities and non-billing optional mode', () => {
  assert.equal(validateTarget(syntheticTarget()).hosted.runtime.api, 'b'.repeat(40));
  for (const mutate of [t => delete t.users.editor, t => t.users.editor.id = '1', t => t.hosted.ordinaryPersonas.owner.nonAdministrative = false,
    t => delete t.hosted.noBilling.index, t => t.hosted.runtime.authModes.api.mode = 'required', t => t.hosted.runtime.worker = 'c'.repeat(40),
    t => t.hosted.runtime.observedAt = '2020-01-01T00:00:00.000Z', t => t.web = 'https://user:sentinel@web.example.test/path',
    t => t.api = 'https://127.1', t => t.hosted.retain = false]) {
    const target = syntheticTarget(); mutate(target);
    assert.throws(() => validateTarget(target), /^Error: HOSTED_[A-Z_]+$/);
  }
});
test('runtime after must follow execution, match deployed pair and never substitute runner HEAD', () => {
  const target = validateTarget(syntheticTarget());
  const after = {...target.hosted.runtime, webOrigin: target.web, apiOrigin: target.api, observedAt: new Date().toISOString()};
  assert.doesNotThrow(() => validateRuntimeAfter(target, after, Date.parse(after.observedAt)));
  assert.throws(() => validateRuntimeAfter(target, {...after, web: 'c'.repeat(40)}, 0));
  assert.throws(() => validateRuntimeAfter(target, after, Date.now() + 1000));
});
test('hosted inventory preserves all seven journeys and rejects omissions, retries, skips and wrong profiles', () => {
  const report = syntheticReport();
  const result = validateHostedReport(report);
  assert.equal(result.suggestions.passed, 7);
  assert.equal(result.personas.length, HOSTED_CASES.length);
  for (const mutate of [r => r.suites[0].specs.pop(), r => r.suites[0].specs.push(r.suites[0].specs[0]),
    r => r.suites[0].specs[0].tests[0].results[0].retry = 1, r => r.stats.skipped = 1,
    r => r.suites[0].specs[0].tests[0].projectName = 'baseline', r => r.suites[0].specs[0].tests[0].annotations = [],
    r => r.suites[0].specs[7].tests[0].annotations = []]) {
    const candidate = structuredClone(report); mutate(candidate);
    assert.throws(() => validateHostedReport(candidate));
  }
});
test('untrusted report details cannot enter public case facts', () => {
  const report = syntheticReport();
  report.secret = 'sentinel-private-person';
  report.suites[0].specs[0].tests[0].results[0].stdout = [{text: 'sentinel-private-person'}];
  assert.ok(!JSON.stringify(validateHostedReport(report)).includes('sentinel'));
});
const healthy = async () => ({ok: true, json: async () => ({zitadel: {}})});
async function targetFile(target) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'ow2-synthetic-'));
  const file = path.join(dir, 'target.json');
  await writeFile(file, JSON.stringify(target), {mode: 0o600});
  return file;
}
test('missing prerequisites produce a fixed incomplete receipt before any network or browser call', async () => {
  let called = false;
  const {receipt} = await runHosted({fetchImpl: async () => {called = true;}, runPlaywright: async () => {called = true;}});
  assert.equal(called, false);
  assert.equal(receipt.status, 'preflight-incomplete');
  assert.equal(receipt.tests, null);
  assert.equal(receipt.acceptance.chainAccepted, false);
});
test('failed or interrupted child preserves the fsynced ledger without publishing private errors', async () => {
  for (const interrupted of [false, true]) {
    const abort = new AbortController();
    let dir;
    const {receipt} = await runHosted({targetFile: await targetFile(syntheticTarget()), fetchImpl: healthy, signal: abort.signal,
      runPlaywright: async (env, options) => {
        dir = options.dir;
        const run = JSON.parse(await readFile(env.ONTOKIT_E2E_CONFIG, 'utf8'));
        await recordResource(run, {event: 'project-created', id: 'synthetic-project', marker: `ontokit-e2e-run:${run.id}`});
        if (interrupted) abort.abort();
        throw new Error('sentinel-secret-person');
      }});
    assert.equal(receipt.status, interrupted ? 'interrupted' : 'executed-failed');
    assert.equal(receipt.fixtures.cleanupPerformed, false);
    assert.match(await readFile(path.join(dir, 'owned-resources.jsonl'), 'utf8'), /synthetic-project/);
    assert.equal((await stat(path.join(dir, 'owned-resources.jsonl'))).mode & 0o077, 0);
    assert.ok(!JSON.stringify(receipt).includes('sentinel'));
  }
});
test('passing browser report without a post-run deployment readback stays incomplete', async () => {
  const {receipt} = await runHosted({targetFile: await targetFile(syntheticTarget()), fetchImpl: healthy,
    runPlaywright: async (_, {dir}) => {await writeFile(path.join(dir, 'playwright-report.json'), JSON.stringify(syntheticReport())); return 0;}});
  assert.equal(receipt.status, 'preflight-incomplete');
  assert.equal(receipt.failure, 'HOSTED_RUNTIME_AFTER');
  assert.equal(receipt.tests.suggestions.passed, 7);
  assert.equal(receipt.acceptance.chainAccepted, false);
  assert.equal(receipt.expiry.cookieExpiry, 'not-observed');
});
