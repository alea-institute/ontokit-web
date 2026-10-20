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
// and the private run directory holding them is removed when the run ends. The spec
// imports run-tagged copies of both ontologies and deletes them afterwards.
import { randomBytes } from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { lstat, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT, stageSources, sourceEvidence, TARGETS } from './sources.mjs';
import { validateReport } from '../e2e/evidence.mjs';
import { networkEnv } from '../e2e/runtime.mjs';

const PERSONAS = ['owner', 'suggester', 'editor'];
const RECEIPTS = path.join(ROOT, '.e2e-runs', 'receipts');

function httpsOrigin(value, field) {
  let url;
  try { url = new URL(value); } catch { throw new Error(`Hosted target ${field} must be an HTTPS origin`); }
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error(`Hosted target ${field} must be an HTTPS origin`);
  return url.origin;
}
/** Reads and validates the private target file; returns normalized origins and users. */
export async function readTarget(file) {
  if (!file || !path.isAbsolute(file)) throw new Error('--target must be an absolute path to the private hosted target file');
  const stat = await lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o077) !== 0 || stat.uid !== process.getuid()) throw new Error('Hosted target file must be a regular file, mode 0600, owned by you');
  const raw = JSON.parse(await readFile(file, 'utf8'));
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
function playwright(env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(ROOT, 'node_modules/@playwright/test/cli.js'), 'test'], {cwd: ROOT, env, stdio: 'inherit'});
    child.on('error', reject);
    child.on('exit', code => resolve(code));
  });
}

/** Runs the rehearsal against the target and writes a sanitized hosted receipt. */
export async function runHosted({targetFile, fetchImpl = fetch, runPlaywright = playwright} = {}) {
  const target = await readTarget(targetFile);
  await preflight(target, fetchImpl);
  const id = randomBytes(16).toString('hex');
  const parent = `/tmp/ontokit-e2e-${process.getuid()}`;
  const dir = path.join(parent, id);
  await mkdir(parent, {recursive: true, mode: 0o700});
  await mkdir(dir, {mode: 0o700});
  const startedAt = new Date().toISOString();
  let tests = null, failure = null, manifest = null;
  try {
    const staged = await stageSources(path.join(dir, 'rehearsal'));
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
    failure = error;
  } finally {
    await rm(dir, {recursive: true, force: true});
  }
  const passed = !failure && !!tests;
  const receipt = {
    version: 1, kind: 'hosted-rehearsal', run: id, startedAt, finishedAt: new Date().toISOString(),
    host: {web: target.web, api: target.api}, web: webRevision(),
    tests: tests && {passed: tests.passed, skipped: 0, failed: 0, flaky: 0, mandatory: tests.mandatory},
    rehearsal: manifest && sourceEvidence(manifest),
    acceptance: {scope: 'hosted-rehearsal', hostedAcceptance: passed},
    passed,
  };
  await mkdir(RECEIPTS, {recursive: true, mode: 0o700});
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
