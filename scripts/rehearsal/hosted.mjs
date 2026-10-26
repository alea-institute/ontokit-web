#!/usr/bin/env node
// Hosted BAIF rehearsal: runs e2e/browser/rehearsal.spec.ts against a serving host.
//
//   npm run rehearsal:sources                      # once per pin change
//   npm run rehearsal:hosted -- --target /abs/path/hosted-target.json
//
// The target file is private (mode 0600, owned by you, not a symlink) and holds HTTPS
// origins plus the three persona credentials that already exist on the host:
//   {"web": "https://…", "api": "https://…", "issuer": "https://…", "login": "https://…",
//    "users": {"owner": {"id", "email", "password"}, "suggester": {…}, "editor": {…}}}
// Credentials never come from arguments or the environment, never enter the receipt,
// and private artifacts and run-tagged projects are retained for controller recovery.
// Removal of private artifacts requires verified backup coverage of their final contents.
import { randomBytes } from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { constants } from 'node:fs';
import { open, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT, stageSources, sourceEvidence, TARGETS } from './sources.mjs';
import { validateReport, sanitizedRehearsal } from '../e2e/evidence.mjs';
import { networkEnv } from '../e2e/runtime.mjs';
import { privateDirectory } from '../e2e/ownership.mjs';

import { createHostedRun, disposePrivateRun, projectDisposition } from './disposition.mjs';

const PERSONAS = ['owner', 'suggester', 'editor'];
const RECEIPTS = path.join(ROOT, '.e2e-runs', 'receipts');

// A hosted receipt must describe a remote host, never this machine or a private network.
const LOCAL_HOST = /^(localhost|.*\.localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|169\.254\.\d+\.\d+|\[.*\])$/i;
function httpsOrigin(value, field) {
  let url;
  try { url = new URL(value); } catch { throw new Error(`Hosted target ${field} must be an HTTPS origin`); }
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error(`Hosted target ${field} must be an HTTPS origin`);
  if (LOCAL_HOST.test(url.hostname)) throw new Error(`Hosted target ${field} must be a remote host`);
  return url.origin;
}
/** Reads and validates the private target file; returns normalized origins and users. */
export async function readTarget(file) {
  if (!file || !path.isAbsolute(file)) throw new Error('--target must be an absolute path to the private hosted target file');
  // Open once without following links, then check the opened file itself.
  let handle;
  try { handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW); }
  catch { throw new Error('Hosted target file must be a regular file, mode 0600, owned by you'); }
  let raw;
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || (stat.mode & 0o077) !== 0 || stat.uid !== process.getuid()) throw new Error('Hosted target file must be a regular file, mode 0600, owned by you');
    raw = JSON.parse(await handle.readFile('utf8'));
  } finally { await handle.close(); }
  const target = {web: httpsOrigin(raw.web, 'web'), api: httpsOrigin(raw.api, 'api'), issuer: httpsOrigin(raw.issuer, 'issuer'), login: httpsOrigin(raw.login, 'login'), users: {}};
  if (Object.keys(raw.users ?? {}).sort().join() !== [...PERSONAS].sort().join()) throw new Error(`Hosted target users must be exactly ${PERSONAS.join(', ')}`);
  for (const persona of PERSONAS) {
    const user = raw.users[persona];
    if (!user || typeof user.id !== 'string' || !user.id || typeof user.email !== 'string' || !user.email.includes('@') || typeof user.password !== 'string' || !user.password) throw new Error(`Hosted target user ${persona} needs id, email and password`);
    target.users[persona] = {id: user.id, email: user.email, password: user.password};
  }
  if (new Set(PERSONAS.map(p => target.users[p].id)).size !== PERSONAS.length) throw new Error('Hosted target personas must be three distinct accounts');
  return target;
}

async function preflight(target, fetchImpl) {
  const health = await fetchImpl(`${target.api}/health`, {signal: AbortSignal.timeout(30_000)});
  if (!health.ok) throw new Error(`Hosted API health returned ${health.status}`);
  const providers = await fetchImpl(`${target.web}/api/auth/providers`, {signal: AbortSignal.timeout(30_000)});
  if (!providers.ok || !Object.hasOwn(await providers.json(), 'zitadel')) throw new Error('Hosted web does not offer Zitadel sign-in');
}
const webRevision = () => {
  try {
    const revision = execFileSync('git', ['rev-parse', 'HEAD'], {cwd: ROOT, encoding: 'utf8'}).trim();
    const dirty = execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], {cwd: ROOT, encoding: 'utf8'}).trim() !== '';
    return {revision, dirty};
  } catch { return {revision: null, dirty: null}; }
};
/** Runs Playwright; SIGINT/SIGTERM are forwarded so fixture teardown preserves the run's projects. */
function playwright(env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(ROOT, 'node_modules/@playwright/test/cli.js'), 'test'], {cwd: ROOT, env, stdio: 'inherit'});
    const forward = signal => () => { child.kill(signal); };
    const handlers = {SIGINT: forward('SIGINT'), SIGTERM: forward('SIGTERM')};
    for (const [signal, handler] of Object.entries(handlers)) process.on(signal, handler);
    const done = () => { for (const [signal, handler] of Object.entries(handlers)) process.off(signal, handler); };
    child.on('error', error => { done(); reject(error); });
    child.on('exit', code => { done(); resolve(code); });
  });
}

/** Runs the rehearsal against the target and writes a sanitized hosted receipt. */
export async function runHosted({targetFile, fetchImpl = fetch, runPlaywright = playwright, stage = stageSources, verifyBackup} = {}) {
  const target = await readTarget(targetFile);
  await preflight(target, fetchImpl);
  const id = randomBytes(16).toString('hex');
  const run = await createHostedRun(id);
  const {dir} = run;
  const startedAt = new Date().toISOString();
  let tests = null, failure = null, manifest = null, disposition = null;
  // An interrupt still reaches the finally below: Playwright gets the signal, tears down, exits.
  const interrupted = () => { failure ??= new Error('Interrupted'); };
  process.on('SIGINT', interrupted); process.on('SIGTERM', interrupted);
  try {
    const staged = await stage(path.join(dir, 'rehearsal'));
    manifest = staged.manifest;
    const runFile = path.join(dir, 'playwright-run.json');
    await writeFile(runFile, JSON.stringify({
      profile: 'rehearsal', id, dir, web: target.web, api: target.api, issuer: target.issuer, login: target.login, users: target.users,
      ordinaryUserPolicyVerified: false,
      rehearsal: {target: 'hosted', sources: staged.paths, targets: TARGETS, ctt: sourceEvidence(manifest).ctt},
    }), {mode: 0o600, flag: 'wx'});
    const env = {PATH: process.env.PATH, HOME: process.env.HOME, LANG: 'C.UTF-8', ...networkEnv(),
      ...(process.env.PLAYWRIGHT_BROWSERS_PATH ? {PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH} : {}),
      ONTOKIT_E2E_CONFIG: runFile, ONTOKIT_E2E_RUN: id};
    const code = await runPlaywright(env);
    const report = JSON.parse(await readFile(path.join(dir, 'playwright-report.json'), 'utf8'));
    tests = validateReport(report, {profile: 'rehearsal'});
    if (code !== 0) throw new Error('Playwright reported a failure');
  } catch (error) {
    failure ??= error;
  } finally {
    process.off('SIGINT', interrupted); process.off('SIGTERM', interrupted);
    disposition = {projects: await projectDisposition(run), privateArtifacts: await disposePrivateRun({...run, verifyBackup})};
  }
  const rehearsal = manifest && sanitizedRehearsal('rehearsal', sourceEvidence(manifest));
  if (manifest && !rehearsal) failure ??= new Error('Rehearsal source evidence is malformed');
  const passed = !failure && !!tests && !!rehearsal && disposition.projects.status === 'retained';
  const receipt = {
    version: 1, kind: 'hosted-rehearsal', run: id, startedAt, finishedAt: new Date().toISOString(),
    host: {web: target.web, api: target.api}, web: webRevision(),
    tests: tests && {passed: tests.passed, skipped: 0, failed: 0, flaky: 0, mandatory: tests.mandatory},
    rehearsal, disposition,
    acceptance: {scope: 'hosted-rehearsal', hostedAcceptance: passed},
    passed,
  };
  await privateDirectory(RECEIPTS);
  const file = path.join(RECEIPTS, `hosted-${id}.json`);
  await writeFile(file, JSON.stringify(receipt, null, 2) + '\n', {mode: 0o600, flag: 'wx'});
  return {receipt, file, failure};
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const i = args.indexOf('--target');
  runHosted({targetFile: i >= 0 ? args[i + 1] : undefined}).then(({receipt, file, failure}) => {
    console.log(`Hosted rehearsal receipt: ${file}`);
    if (failure) { console.error(`Hosted rehearsal failed: ${failure.message}`); process.exitCode = 1; }
    else console.log(`Hosted rehearsal passed: ${receipt.tests.passed} cases against ${receipt.host.web}`);
  }).catch(error => { console.error(error.message); process.exitCode = 1; });
}
