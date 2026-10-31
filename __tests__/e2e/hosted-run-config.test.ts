// @vitest-environment node
import {it, expect} from 'vitest';
import {mkdir, writeFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import path from 'node:path';
import {loadSuggestionsRun} from '../../e2e/fixtures/run';

it('requires attested hosted metadata and a dedicated launch without relaxing loopback validation', async () => {
  const id = randomBytes(16).toString('hex');
  const dir = `/tmp/ontokit-e2e-${process.getuid?.()}/${id}`;
  await mkdir(dir, {recursive: true, mode: 0o700});
  const file = path.join(dir, 'playwright-run.json');
  const keys = ['ONTOKIT_E2E_CONFIG', 'ONTOKIT_E2E_RUN', 'ONTOKIT_E2E_HOSTED'] as const;
  const previous = keys.map(k => process.env[k]);
  const users = Object.fromEntries(['owner', 'suggester', 'editor', 'unrelated'].map((p, i) => [p, {id: `${i}`, email: `${p}@example.test`, password: 'synthetic'}]));
  const run = {id, dir, profile: 'suggestions', ordinaryUserPolicyVerified: true, web: 'https://web.example.test', api: 'https://api.example.test', issuer: 'https://id.example.test', login: 'https://login.example.test', users};
  const hosted = {version: 1, retain: true, observationWindowSeconds: 0, refreshIdleSeconds: 86400, refreshAbsoluteSeconds: 172800,
    runtime: {webOrigin: run.web, apiOrigin: run.api, observedAt: new Date().toISOString(), web: 'a'.repeat(40), api: 'b'.repeat(40), worker: 'b'.repeat(40), authModes: {web: {mode: 'optional', providerConfigured: true}, api: {mode: 'optional', providerConfigured: true}}},
    ordinaryPersonas: Object.fromEntries(Object.entries(users).map(([p, u]) => [p, {subject: u.id, nonAdministrative: true}])), noBilling: {import: true, index: true, save: true, submit: true}};
  try {
    process.env.ONTOKIT_E2E_CONFIG = file; process.env.ONTOKIT_E2E_RUN = id;
    await writeFile(file, JSON.stringify(run), {mode: 0o600});
    expect(() => loadSuggestionsRun()).toThrow('loopback');
    await writeFile(file, JSON.stringify({...run, hosted}), {mode: 0o600});
    delete process.env.ONTOKIT_E2E_HOSTED;
    expect(() => loadSuggestionsRun()).toThrow('dedicated runner');
    process.env.ONTOKIT_E2E_HOSTED = 'suggestions';
    expect(loadSuggestionsRun().hosted?.retain).toBe(true);
    await writeFile(file, JSON.stringify({...run, hosted: {...hosted, noBilling: {}}}), {mode: 0o600});
    expect(() => loadSuggestionsRun()).toThrow('HOSTED_NO_BILLING');
  } finally {
    keys.forEach((key, i) => {if (previous[i] === undefined) delete process.env[key]; else process.env[key] = previous[i];});
  }
});
