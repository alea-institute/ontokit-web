import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile, mkdtemp, lstat, chmod } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { runHosted } from './hosted.mjs';
import { PROFILE_INVENTORIES } from '../e2e/evidence.mjs';
import { UPSTREAM } from './sources.mjs';
import { hostedRunDir, importWithJournal } from './disposition.mjs';
import { backup, selectedRuntime, observeRuntime } from './test-helpers.mjs';

const SECRET = 'sentinel-password-person@example.invalid-/private/path';
const target = {web: 'https://ontokit.example.org', api: 'https://api.example.org', issuer: 'https://auth.example.org', login: 'https://auth.example.org',
  users: Object.fromEntries(['owner', 'suggester', 'editor'].map(role => [role, {id: role, email: `${role}@example.org`, password: SECRET}]))};
const serving = async url => new Response(JSON.stringify(url.endsWith('/providers') ? {zitadel: {}} : {ok: true}));
const manifest = () => ({
  files: {folio: {...UPSTREAM.folio}, catholic: {...UPSTREAM.catholic}, catholicCtt: {sha256: 'e'.repeat(64)}},
  ctt: {source: {site: 'https://ctt.jaces.com/', build: {date: '2026-10-19', commit: 'f66099a'}}, calibration: 'uncalibrated', terms: 250, communities: 24, falseFriends: 6},
});
const report = () => ({stats: {expected: 4, skipped: 0, unexpected: 0, flaky: 0}, errors: [], suites: [{specs: PROFILE_INVENTORIES.rehearsal.map(t => ({
  file: t.file, title: t.title, ok: true, tests: [{projectName: t.project, expectedStatus: 'passed', status: 'expected', annotations: [], results: [{status: 'passed', retry: 0, errors: []}]}],
}))}]});
async function exercise(options = {}) {
  const dir = await mkdtemp(path.join(tmpdir(), 'ow1-hosted-test-'));
  const targetFile = path.join(dir, 'target.json');
  await writeFile(targetFile, JSON.stringify({...target, extra: SECRET}), {mode: 0o600});
  let config;
  const stage = async destination => {
    await mkdir(destination, {mode: 0o700});
    const paths = {folio: path.join(destination, 'FOLIO.owl'), catholicCtt: path.join(destination, 'c.ttl')};
    for (const file of Object.values(paths)) await writeFile(file, 'synthetic source', {mode: 0o600});
    const value = manifest();
    options.source?.(value);
    return {paths, manifest: value};
  };
  const runPlaywright = async env => {
    config = JSON.parse(await readFile(env.ONTOKIT_E2E_CONFIG, 'utf8'));
    for (const [i, key] of ['folio', 'catholicCtt'].entries()) {
      if (options.unresolved && i === 1) {
        await assert.rejects(importWithJournal(config, key, async () => { throw new Error(SECRET); }));
      } else await importWithJournal(config, key, async () => ({id: `${i + 1}0000000-1234-1234-1234-123456789012`}));
    }
    await mkdir(path.join(config.dir, 'auth'), {mode: 0o700});
    await writeFile(path.join(config.dir, 'auth', 'owner.json'), SECRET, {mode: 0o600});
    if (options.signal) process.emit(options.signal);
    if (options.browserError) throw new Error(SECRET);
    const value = report();
    options.report?.(value);
    if (!options.missingReport) await writeFile(path.join(config.dir, 'playwright-report.json'), options.malformedReport ? SECRET : JSON.stringify({...value, extra: SECRET}), {mode: 0o600});
    if (options.unsafe) await chmod(config.dir, 0o755);
    return options.exitCode ?? 0;
  };
  try {
    const result = await runHosted({targetFile, stage, runPlaywright, fetchImpl: serving,
      selectedRuntime, observeRuntime, ...options.runner});
    if (result.file) {
      const text = await readFile(result.file, 'utf8');
      for (const value of [SECRET, '@example.org', 'password', 'auth.example.org', config?.dir].filter(Boolean)) assert.equal(text.includes(value), false, 'receipt redaction');
    }
    return {...result, config};
  } finally { if (options.unsafe && config) await chmod(config.dir, 0o700); }
}

for (const verifyBackup of [undefined, backup]) test(`exact hosted pass with ${verifyBackup ? 'verified removal' : 'protected retention'}`, async () => {
  const {receipt, config} = await exercise({runner: {verifyBackup}});
  assert.equal(receipt.passed, true);
  assert.equal(receipt.acceptance.hostedAcceptance, true);
  assert.equal(receipt.tests.passed, 4);
  assert.equal(receipt.runtime.before.revisions.web, selectedRuntime.web);
  assert.equal(receipt.runtime.after.revisions.api, selectedRuntime.api);
  assert.ok(receipt.runner.revision);
  assert.equal(receipt.web, undefined, 'runner checkout is not a deployed web identity');
  assert.equal(receipt.disposition.projects.status, 'retained');
  assert.equal(receipt.disposition.privateArtifacts.status, verifyBackup ? 'removed-after-backup' : 'retained');
  if (verifyBackup) await assert.rejects(lstat(config.dir), {code: 'ENOENT'});
  else assert.equal(await readFile(path.join(config.dir, 'auth', 'owner.json'), 'utf8'), SECRET);
});

const mutations = {
  missing: r => r.suites[0].specs.pop(),
  duplicate: r => r.suites[0].specs[1] = structuredClone(r.suites[0].specs[0]),
  extra: r => { r.suites[0].specs.push(structuredClone(r.suites[0].specs[0])); r.stats.expected++; },
  project: r => r.suites[0].specs[0].tests[0].projectName = 'chromium',
  file: r => r.suites[0].specs[0].file = 'browser/other.spec.ts',
  skipped: r => r.suites[0].specs[0].tests[0].results[0].status = 'skipped',
  fixme: r => r.suites[0].specs[0].tests[0].annotations.push({type: 'fixme'}),
  expectedFailure: r => r.suites[0].specs[0].tests[0].expectedStatus = 'failed',
  retry: r => r.suites[0].specs[0].tests[0].results[0].retry = 1,
  flaky: r => r.stats.flaky = 1,
  runnerError: r => r.errors.push({message: SECRET}),
};
for (const [name, mutate] of Object.entries(mutations)) test(`hosted acceptance rejects ${name} report`, async () => {
  const {receipt} = await exercise({report: mutate});
  assert.equal(receipt.passed, false);
  assert.equal(receipt.failure, 'report-invalid');
});

for (const [name, options] of Object.entries({
  nonzero: {exitCode: 1}, missing: {missingReport: true}, malformed: {malformedReport: true},
  browser: {browserError: true}, unresolved: {unresolved: true}, unsafe: {unsafe: true},
  SIGINT: {signal: 'SIGINT'}, SIGTERM: {signal: 'SIGTERM'},
  source: {source: value => value.files.folio.sha256 = '0'.repeat(64)},
})) test(`hosted ${name} failure is retained and cannot pass`, async () => {
  const {receipt} = await exercise(options);
  assert.equal(receipt.passed, false);
  assert.equal(receipt.acceptance.hostedAcceptance, false);
  assert.ok(receipt.failure);
});

for (const [name, mutation] of Object.entries({
  missing: () => null,
  mismatch: value => ({...value, revisions: {...value.revisions, web: 'f'.repeat(40)}}),
  run: value => ({...value, run: randomBytes(16).toString('hex')}),
  stale: value => ({...value, observedAt: '2020-01-01T00:00:00.000Z'}),
  future: value => ({...value, observedAt: '2099-01-01T00:00:00.000Z'}),
  origin: value => ({...value, host: {...value.host, web: 'https://wrong.example.org'}}),
  worker: value => ({...value, revisions: {...value.revisions, worker: 'f'.repeat(40)}}),
  provenance: value => ({...value, provenance: {source: SECRET, sha256: 'c'.repeat(64)}}),
})) test(`hosted ${name} runtime evidence refuses acceptance`, async () => {
  const {receipt} = await exercise({runner: {observeRuntime: async context => mutation(await observeRuntime(context))}});
  assert.equal(receipt.passed, false);
  assert.equal(receipt.failure, 'runtime-invalid');
});

test('after evidence must follow browser completion and belongs to the same run', async () => {
  let before;
  const {receipt} = await exercise({runner: {observeRuntime: async context => {
    if (context.phase === 'before') before = await observeRuntime(context);
    return context.phase === 'before' ? before : {...before, phase: 'after', observedAt: new Date(Date.parse(context.notBefore) - 1).toISOString()};
  }}});
  assert.equal(receipt.failure, 'runtime-invalid');
});

test('setup and receipt persistence failures are fixed categories, never raw errors', async () => {
  const failed = await exercise({runner: {stage: async () => { throw new Error(SECRET); }}});
  assert.equal(failed.receipt.failure, 'source-invalid');
  await assert.rejects(exercise({runner: {writeReceipt: async () => { throw new Error(SECRET); }}}), error => {
    assert.equal(error.message, 'Hosted receipt could not be saved');
    assert.equal(error.file, undefined);
    return true;
  });
});

test('the real Playwright subprocess keeps launch diagnostics in its private log', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'ow1-process-test-'));
  const targetFile = path.join(dir, 'target.json');
  await writeFile(targetFile, JSON.stringify(target), {mode: 0o600});
  const id = randomBytes(16).toString('hex');
  const sentinel = 'synthetic-browser-cache-sentinel';
  const script = `
    import {mkdir, writeFile} from 'node:fs/promises';
    import path from 'node:path';
    import {runHosted} from ${JSON.stringify(new URL('./hosted.mjs', import.meta.url).href)};
    import {selectedRuntime, observeRuntime} from ${JSON.stringify(new URL('./test-helpers.mjs', import.meta.url).href)};
    const result = await runHosted({
      runId: ${JSON.stringify(id)}, targetFile: ${JSON.stringify(targetFile)}, selectedRuntime, observeRuntime,
      fetchImpl: async url => new Response(JSON.stringify(url.endsWith('/providers') ? {zitadel: {}} : {ok: true})),
      stage: async destination => {
        await mkdir(destination, {mode: 0o700});
        const paths = {folio: path.join(destination, 'FOLIO.owl'), catholicCtt: path.join(destination, 'c.ttl')};
        for (const file of Object.values(paths)) await writeFile(file, 'synthetic source', {mode: 0o600});
        return {paths, manifest: ${JSON.stringify(manifest())}};
      },
    });
    console.log(JSON.stringify({run: result.receipt.run, passed: result.receipt.passed}));
  `;
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    encoding: 'utf8', timeout: 30_000,
    env: {...process.env, PLAYWRIGHT_BROWSERS_PATH: path.join(dir, sentinel)},
  });
  assert.equal(child.status, 0, child.stderr);
  assert.deepEqual(JSON.parse(child.stdout), {run: id, passed: false});
  assert.equal(`${child.stdout}${child.stderr}`.includes(sentinel), false);
  const log = await readFile(path.join(hostedRunDir(id), 'playwright-console.log'), 'utf8');
  assert.match(log, /Executable doesn't exist/);
  assert.ok(log.includes(sentinel));
  assert.equal((await lstat(path.join(hostedRunDir(id), 'playwright-console.log'))).mode & 0o077, 0);
});
