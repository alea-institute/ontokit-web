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

async function preflight(target, fetchImpl, signal) {
  const health = await fetchImpl(`${target.api}/health`, {signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)])});
  if (!health.ok) throw new Error(`Hosted API health returned ${health.status}`);
  const providers = await fetchImpl(`${target.web}/api/auth/providers`, {signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)])});
  if (!providers.ok || !Object.hasOwn(await providers.json(), 'zitadel')) throw new Error('Hosted web does not offer Zitadel sign-in');
}
const webRevision = () => {
  try {
    const revision = execFileSync('git', ['rev-parse', 'HEAD'], {cwd: ROOT, encoding: 'utf8'}).trim();
    const dirty = execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], {cwd: ROOT, encoding: 'utf8'}).trim() !== '';
    return {revision, dirty};
  } catch { return {revision: null, dirty: null}; }
};
const revision = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
function runtimeObservation(value, context, selected) {
  const {run, phase, host, notBefore} = context;
  const observed = Date.parse(value?.observedAt);
  const now = Date.now();
  if (!selected || !['web', 'api', 'worker'].every(key => revision(selected[key])) ||
      value?.version !== 1 || value.environment !== 'dev' || value.run !== run || value.phase !== phase ||
      value.host?.web !== host.web || value.host?.api !== host.api ||
      !Number.isFinite(observed) || new Date(observed).toISOString() !== value.observedAt ||
      observed > now || observed < now - 300_000 || observed < Date.parse(notBefore) ||
      value.provenance?.source !== 'deployment-status' || !/^[a-f0-9]{64}$/.test(value.provenance?.sha256) ||
      !['web', 'api', 'worker'].every(key => value.revisions?.[key] === selected[key])) {
    throw new Error('Hosted runtime evidence is incomplete or inconsistent');
  }
  return {version: 1, environment: 'dev', run, phase, host: {...host}, observedAt: value.observedAt,
    revisions: Object.fromEntries(['web', 'api', 'worker'].map(key => [key, selected[key]])),
    provenance: {source: 'deployment-status', sha256: value.provenance.sha256}};
}

async function playwright(env, {signal, dir}) {
  const log = await open(path.join(dir, 'playwright-console.log'), 'wx', 0o600);
  try {
    return await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [path.join(ROOT, 'node_modules/@playwright/test/cli.js'), 'test'], {cwd: ROOT, env, stdio: ['ignore', log.fd, log.fd]});
      const interrupt = () => { child.kill(signal.reason === 'SIGINT' ? 'SIGINT' : 'SIGTERM'); };
      signal.addEventListener('abort', interrupt, {once: true});
      if (signal.aborted) interrupt();
      child.once('error', reject);
      child.once('close', code => { signal.removeEventListener('abort', interrupt); resolve(code); });
    });
  } finally { await log.close(); }
}

async function saveReceipt(receipt) {
  await privateDirectory(path.join(ROOT, '.e2e-runs'));
  await privateDirectory(RECEIPTS);
  const file = path.join(RECEIPTS, `hosted-${receipt.run}.json`);
  await writeFile(file, JSON.stringify(receipt, null, 2) + '\n', {mode: 0o600, flag: 'wx'});
  return file;
}
const messages = {
  'target-invalid': 'Hosted target could not be read safely',
  'preflight-failed': 'Hosted preflight failed',
  'runtime-invalid': 'Hosted runtime evidence is incomplete or inconsistent',
  'source-invalid': 'Rehearsal source evidence is malformed or unavailable',
  'setup-failed': 'Hosted rehearsal setup failed',
  'browser-failed': 'Playwright reported a failure',
  'report-invalid': 'Playwright did not pass every mandatory rehearsal case',
  'disposition-unresolved': 'Hosted resource disposition could not be verified',
  interrupted: 'Hosted rehearsal interrupted',
};

/** Controller integration: supply selectedRuntime and fresh observeRuntime observations.
 * The CLI uses nonsecret evidence files; no credential or deployment command is executed here.
 */
export async function runHosted({targetFile, fetchImpl = fetch, runPlaywright = playwright, stage = stageSources,
  verifyBackup, selectedRuntime, observeRuntime, runId = randomBytes(16).toString('hex'), writeReceipt = saveReceipt} = {}) {
  if (!/^[a-f0-9]{32}$/.test(runId)) throw new Error('Invalid hosted run identity');
  const id = runId;
  const startedAt = new Date().toISOString();
  const abort = new AbortController();
  let failureCode = null, phase = 'target-invalid', preflightMessage = null;
  let target = null, run = null, tests = null, rehearsal = null;
  const runtime = {before: null, after: null};
  const disposition = {projects: {status: 'not-created', projects: []}, privateArtifacts: {status: 'not-created', verified: true}};
  const interrupted = signal => () => { failureCode = 'interrupted'; abort.abort(signal); };
  const handlers = {SIGINT: interrupted('SIGINT'), SIGTERM: interrupted('SIGTERM')};
  for (const [signal, handler] of Object.entries(handlers)) process.on(signal, handler);
  const checkInterrupted = () => { if (abort.signal.aborted) throw new Error('Interrupted'); };
  const observe = async (moment, notBefore) => {
    const context = {run: id, phase: moment, host: {web: target.web, api: target.api}, notBefore};
    await writeFile(path.join(path.dirname(run.dir), `runtime-${moment}-request.json`), JSON.stringify(context), {mode: 0o600, flag: 'wx'});
    const value = await observeRuntime?.({...context, signal: abort.signal});
    return runtimeObservation(value, context, selectedRuntime);
  };
  try {
    try {
      target = await readTarget(targetFile);
      phase = 'preflight-failed';
      try { await preflight(target, fetchImpl, abort.signal); }
      catch (error) {
        if (/^Hosted API health returned [1-5][0-9]{2}$/.test(error.message) || error.message === 'Hosted web does not offer Zitadel sign-in') preflightMessage = error.message;
        throw error;
      }
      checkInterrupted();
      phase = 'setup-failed';
      run = await createHostedRun(id);
      phase = 'runtime-invalid';
      runtime.before = await observe('before', new Date(Date.now() - 300_000).toISOString());
      checkInterrupted();
      phase = 'source-invalid';
      const staged = await stage(path.join(run.dir, 'rehearsal'));
      rehearsal = sanitizedRehearsal('rehearsal', sourceEvidence(staged.manifest));
      if (!rehearsal) throw new Error('Invalid source evidence');
      checkInterrupted();
      phase = 'setup-failed';
      const runFile = path.join(run.dir, 'playwright-run.json');
      await writeFile(runFile, JSON.stringify({
        profile: 'rehearsal', id, dir: run.dir, web: target.web, api: target.api, issuer: target.issuer, login: target.login, users: target.users,
        ordinaryUserPolicyVerified: false,
        rehearsal: {target: 'hosted', sources: staged.paths, targets: TARGETS, ctt: rehearsal.ctt},
      }), {mode: 0o600, flag: 'wx'});
      const env = {PATH: process.env.PATH, HOME: process.env.HOME, LANG: 'C.UTF-8', ...networkEnv(),
        ...(process.env.PLAYWRIGHT_BROWSERS_PATH ? {PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH} : {}),
        ONTOKIT_E2E_CONFIG: runFile, ONTOKIT_E2E_RUN: id};
      phase = 'browser-failed';
      const code = await runPlaywright(env, {signal: abort.signal, dir: run.dir});
      const browserFinishedAt = new Date().toISOString();
      checkInterrupted();
      phase = 'runtime-invalid';
      runtime.after = await observe('after', browserFinishedAt);
      checkInterrupted();
      phase = 'report-invalid';
      tests = validateReport(JSON.parse(await readFile(path.join(run.dir, 'playwright-report.json'), 'utf8')), {profile: 'rehearsal'});
      phase = 'browser-failed';
      if (code !== 0) throw new Error('Playwright failed');
    } catch { failureCode ??= phase; }

    if (run) {
      try {
        disposition.projects = await projectDisposition(run);
        if (disposition.projects.status !== 'retained') failureCode ??= 'disposition-unresolved';
      } catch {
        disposition.projects = {status: 'unknown', projects: []};
        failureCode ??= 'disposition-unresolved';
      }
      try {
        await writeFile(path.join(path.dirname(run.dir), 'outcome-before-disposition.json'), JSON.stringify({
          version: 1, run: id, failure: failureCode, tests, rehearsal, runtime,
          disposition: {projects: disposition.projects, privateArtifacts: {status: 'pending', verified: false}},
          acceptance: {scope: 'hosted-rehearsal', hostedAcceptance: false}, passed: false,
        }, null, 2) + '\n', {mode: 0o600, flag: 'wx'});
        disposition.privateArtifacts = await disposePrivateRun({...run, verifyBackup});
      } catch {
        disposition.privateArtifacts = {status: 'unknown', verified: false};
        failureCode ??= 'disposition-unresolved';
      }
    }
    checkInterruptedOutcome();
    const passed = !failureCode && !!tests && !!rehearsal && !!runtime.before && !!runtime.after &&
      disposition.projects.status === 'retained' && disposition.privateArtifacts.verified;
    const receipt = {
      version: 2, kind: 'hosted-rehearsal', run: id, startedAt, finishedAt: new Date().toISOString(),
      host: target && {web: target.web, api: target.api}, runner: webRevision(), runtime,
      tests, rehearsal, disposition, failure: failureCode,
      acceptance: {scope: 'hosted-rehearsal', hostedAcceptance: passed}, passed,
    };
    let file;
    try { file = await writeReceipt(receipt); }
    catch { throw new Error('Hosted receipt could not be saved'); }
    const failure = failureCode && new Error(preflightMessage ?? messages[failureCode]);
    if (!run && failure) throw Object.assign(failure, {receipt, file});
    return {receipt, file, failure};
  } finally {
    for (const [signal, handler] of Object.entries(handlers)) process.off(signal, handler);
  }
  function checkInterruptedOutcome() { if (abort.signal.aborted) failureCode = 'interrupted'; }
}

async function fileObservation(directory, context) {
  const deadline = Date.now() + (context.phase === 'after' ? 60_000 : 0);
  do {
    context.signal.throwIfAborted();
    try { return JSON.parse(await readFile(path.join(directory, `${context.phase}.json`), 'utf8')); }
    catch (error) {
      if (error.code !== 'ENOENT' || Date.now() >= deadline) throw error;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  } while (Date.now() <= deadline);
  throw new Error('Runtime observation unavailable');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const value = flag => args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined;
  const main = async () => {
    const directory = value('--runtime-evidence');
    if (!directory || !path.isAbsolute(directory)) throw new Error('Runtime evidence directory required');
    const selected = JSON.parse(await readFile(path.join(directory, 'selected.json'), 'utf8'));
    return runHosted({targetFile: value('--target'), runId: selected.run, selectedRuntime: selected.revisions,
      observeRuntime: context => fileObservation(directory, context)});
  };
  main().then(({receipt}) => {
    console.log(`Hosted rehearsal receipt: .e2e-runs/receipts/hosted-${receipt.run}.json`);
    if (!receipt.passed) { console.error(`Hosted rehearsal failed: ${receipt.failure}`); process.exitCode = 1; }
    else console.log(`Hosted rehearsal passed: ${receipt.tests.passed} cases`);
  }).catch(error => {
    if (error.receipt && error.file) console.log(`Hosted rehearsal receipt: .e2e-runs/receipts/hosted-${error.receipt.run}.json`);
    console.error('Hosted rehearsal failed; check the private runner evidence and target configuration');
    process.exitCode = 1;
  });
}
