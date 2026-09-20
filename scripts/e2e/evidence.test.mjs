import test from 'node:test';
import assert from 'node:assert/strict';
import {validateReport} from './evidence.mjs';

test('foundation-only green report must not satisfy B10', () => {
  assert.throws(() => validateReport({stats: {expected: 4, skipped: 0, unexpected: 0, flaky: 0}, errors: [], suites: []}), /mandatory/);
});

import {REQUIRED_TESTS, sanitizedEvidence} from './evidence.mjs';
const report = () => ({stats: {expected: 21, skipped: 0, unexpected: 0, flaky: 0}, errors: [], suites: [{specs: REQUIRED_TESTS.map(t => ({file: t.file, title: t.title, ok: true, tests: [{projectName: t.project, expectedStatus: 'passed', status: 'expected', results: [{status: 'passed', errors: []}]}]}))}]});
test('complete mandatory inventory passes and exports only fixed names', () => {
  assert.equal(validateReport(report()).mandatory.length, 21);
});
for (const file of [...new Set(REQUIRED_TESTS.map(t => t.file))]) test(`missing ${file} fails despite inflated counts`, () => {
  const r = report(); r.suites[0].specs = r.suites[0].specs.filter(t => t.file !== file);
  while (r.suites[0].specs.length < 21) r.suites[0].specs.push(structuredClone(r.suites[0].specs[0]));
  assert.throws(() => validateReport(r), /mandatory/);
});
for (const kind of ['skipped', 'unexpected', 'flaky']) test(`${kind} fails`, () => {
  const r = report(); r.stats[kind] = 1;
  assert.throws(() => validateReport(r), /mandatory/);
});
for (const mutate of [
  r => r.errors.push({message: 'private error'}),
  r => r.suites[0].specs[0].tests[0].results[0].status = 'skipped',
  r => r.suites[0].specs[0].tests[0].expectedStatus = 'failed',
  r => r.suites[0].specs[0].tests[0].projectName = 'wrong-project',
  r => r.suites[0].specs[0].tests[0].results.push({status: 'passed'}),
  r => r.suites[0].specs[0].tests[0].results[0].errors = [{message: 'private error'}],
]) test('per-test errors, retries and invalid identity fail', () => {
  const r = report(); mutate(r); assert.throws(() => validateReport(r), /mandatory/);
});
test('receipt allowlist drops private fields and never accepts failed cleanup', () => {
  const source = {revision: 'a'.repeat(40), sha256: 'b'.repeat(64), secret: 'sensitive-sentinel'};
  const manifest = {id: 'a'.repeat(32), sources: {api: source, web: source}, secret: 'sensitive-sentinel', tests: validateReport(report()), migrationHeads: ['20260920_head', 'private/token'], evidenceImages: ['postgres','redis','minio','zitadel','login','api','worker'].map(service => ({service, id: `sha256:${'c'.repeat(64)}`, reference: `example/image@sha256:${'d'.repeat(64)}`, secret: 'sensitive-sentinel'}))};
  const result = sanitizedEvidence(manifest, {cleanup: 'failed', workflowPassed: true});
  assert.equal(result.acceptedRun, false);
  assert.equal(JSON.stringify(result).includes('sensitive-sentinel'), false);
  assert.equal(sanitizedEvidence(manifest, {cleanup: 'complete', workflowPassed: true}).acceptedRun, true);
  assert.equal(sanitizedEvidence(manifest, {cleanup: 'complete', workflowPassed: false}).acceptedRun, false);
});

test('receipt requires every service, not seven duplicate image entries', () => {
  const source = {revision: 'a'.repeat(40), sha256: 'b'.repeat(64)};
  const image = {service: 'api', id: `sha256:${'c'.repeat(64)}`, reference: `example/image@sha256:${'d'.repeat(64)}`};
  const result = sanitizedEvidence({id: 'a'.repeat(32), sources: {api: source, web: source}, tests: validateReport(report()), migrationHeads: ['head'], evidenceImages: Array(7).fill(image)}, {cleanup: 'complete', workflowPassed: true});
  assert.equal(result.acceptedRun, false);
});
