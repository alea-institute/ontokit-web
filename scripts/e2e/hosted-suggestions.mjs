#!/usr/bin/env node
// Run only from an authorized controller with explicitly supplied private files.
// No account provisioning, deployment, cleanup or credential discovery lives here.
import {randomBytes} from 'node:crypto';
import {spawn, execFileSync} from 'node:child_process';
import {constants} from 'node:fs';
import {mkdir, open, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {RUNTIME_ROOT, privateDirectory} from './ownership.mjs';
import {networkEnv} from './runtime.mjs';
import {validateTarget, validateRuntimeAfter, validateHostedReport, fail} from './hosted-suggestions-contract.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const RECEIPTS = path.join(ROOT, '.e2e-runs/receipts');
const CODES = new Set(['TARGET', 'PERSONAS', 'PREREQUISITES', 'ORDINARY_PERSONAS', 'NO_BILLING', 'RUNTIME', 'MODE', 'OBSERVATION_WINDOW', 'RUNTIME_CHANGED', 'RUNTIME_TARGET', 'REPORT', 'PRIVATE_INPUT', 'HEALTH', 'PROVIDER', 'EXECUTION', 'INTERRUPTED', 'RUNTIME_AFTER']);
const failureCode = error => CODES.has(error?.message?.replace(/^HOSTED_/, '')) ? error.message : 'HOSTED_EXECUTION';
export async function readPrivateJson(file) {
  if (typeof file !== 'string' || !path.isAbsolute(file)) fail('PRIVATE_INPUT');
  let handle;
  try {
    handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
    const stat = await handle.stat();
    if (!stat.isFile() || stat.uid !== process.getuid() || (stat.mode & 0o077)) fail('PRIVATE_INPUT');
    return JSON.parse(await handle.readFile('utf8'));
  } catch { fail('PRIVATE_INPUT'); }
  finally { await handle?.close(); }
}
/** Fsynced append-only ledger: an import intent precedes the HTTP write; its ID follows immediately. */
export async function recordResource(run, entry) {
  if (!run.hosted) return;
  await privateDirectory(run.dir);
  const handle = await open(path.join(run.dir, 'owned-resources.jsonl'), constants.O_WRONLY | constants.O_APPEND | constants.O_CREAT | constants.O_NOFOLLOW, 0o600);
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.uid !== process.getuid() || (stat.mode & 0o077)) fail('PRIVATE_INPUT');
    await handle.writeFile(JSON.stringify({run: run.id, ...entry}) + '\n');
    await handle.sync();
  } finally { await handle.close(); }
}
async function preflight(target, fetchImpl, signal) {
  const get = url => fetchImpl(url, {redirect: 'error', signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)])});
  if (!(await get(`${target.api}/health`)).ok) fail('HEALTH');
  const providers = await get(`${target.web}/api/auth/providers`);
  if (!providers.ok || !Object.hasOwn(await providers.json(), 'zitadel')) fail('PROVIDER');
}
function runnerRevision() {
  try {
    const revision = execFileSync('git', ['rev-parse', 'HEAD'], {cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']}).trim();
    const dirty = !!execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], {cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']}).trim();
    return {revision: /^[a-f0-9]{40}$/.test(revision) ? revision : null, dirty};
  } catch { return {revision: null, dirty: null}; }
}
async function playwright(env, {dir, signal}) {
  const log = await open(path.join(dir, 'playwright-private.log'), 'wx', 0o600);
  try {
    return await new Promise((resolve, reject) => {
      if (signal.aborted) return reject(new Error('HOSTED_INTERRUPTED'));
      const child = spawn(process.execPath, [path.join(ROOT, 'node_modules/@playwright/test/cli.js'), 'test', '--config', 'playwright.hosted.config.ts'],
        {cwd: ROOT, env, stdio: ['ignore', log.fd, log.fd]});
      const stop = () => child.kill('SIGTERM');
      signal.addEventListener('abort', stop, {once: true});
      const done = () => signal.removeEventListener('abort', stop);
      child.on('error', () => { done(); reject(new Error('HOSTED_EXECUTION')); });
      child.on('exit', code => { done(); resolve(code); });
    });
  } finally { await log.close(); }
}
/** Missing input produces an incomplete receipt without attempting network or project writes. */
export async function runHosted({targetFile, afterFile, fetchImpl = fetch, runPlaywright = playwright, signal: externalSignal} = {}) {
  const id = randomBytes(16).toString('hex'), dir = path.join(RUNTIME_ROOT, id);
  await privateDirectory(RUNTIME_ROOT); await mkdir(dir, {mode: 0o700});
  await recordResource({id, dir, hosted: true}, {event: 'run-created', disposition: 'retained'});
  const controller = new AbortController();
  const interrupt = () => controller.abort();
  process.on('SIGINT', interrupt); process.on('SIGTERM', interrupt);
  externalSignal?.addEventListener('abort', interrupt, {once: true});
  if (externalSignal?.aborted) interrupt();
  let target, tests = null, runtimeAfter = null, failure = null, executed = false;
  const startedAt = new Date().toISOString(), runner = runnerRevision();
  try {
    target = validateTarget(await readPrivateJson(targetFile));
    if (controller.signal.aborted) fail('INTERRUPTED');
    await preflight(target, fetchImpl, controller.signal);
    const file = path.join(dir, 'playwright-run.json');
    await writeFile(file, JSON.stringify({...target, profile: 'suggestions', id, dir, ordinaryUserPolicyVerified: true}), {mode: 0o600, flag: 'wx'});
    if (controller.signal.aborted) fail('INTERRUPTED');
    executed = true;
    const code = await runPlaywright({PATH: process.env.PATH, HOME: process.env.HOME, LANG: 'C.UTF-8', ...networkEnv(),
      ...(process.env.PLAYWRIGHT_BROWSERS_PATH ? {PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH} : {}),
      ONTOKIT_E2E_CONFIG: file, ONTOKIT_E2E_RUN: id, ONTOKIT_E2E_HOSTED: "suggestions"}, {dir, signal: controller.signal});
    const finished = Date.now();
    if (controller.signal.aborted) fail('INTERRUPTED');
    if (code !== 0) fail('EXECUTION');
    tests = validateHostedReport(JSON.parse(await readFile(path.join(dir, 'playwright-report.json'), 'utf8')));
    // The controller supplies a fresh post-run readback, bound to the same origins.
    // A missing/read-before-finish attestation can never turn green.
    if (!afterFile) fail('RUNTIME_AFTER');
    runtimeAfter = validateRuntimeAfter(target, await readPrivateJson(afterFile), finished);
  } catch (error) { failure = controller.signal.aborted ? 'HOSTED_INTERRUPTED' : failureCode(error); }
  finally {
    process.off('SIGINT', interrupt); process.off('SIGTERM', interrupt);
    externalSignal?.removeEventListener('abort', interrupt);
  }
  const passed = failure === null;
  const receipt = {
    version: 1, kind: 'hosted-suggestions', run: id, startedAt, finishedAt: new Date().toISOString(), runner,
    runtimeBefore: target?.hosted.runtime ?? null, runtimeAfter,
    status: passed ? 'passed' : failure === 'HOSTED_INTERRUPTED' ? 'interrupted' : !executed || tests ? 'preflight-incomplete' : 'executed-failed',
    failure, tests, fixtures: {disposition: 'retained', ledger: 'owned-resources.jsonl', cleanupPerformed: false},
    acceptance: {scope: 'hosted-d08-d10', chainAccepted: passed, hostedAcceptance: false},
    // Cookie expiry is deliberately still open; a chain pass is not full D08 acceptance.
    expiry: tests?.personas.find(c => c.evidence.case === 'expiry')?.evidence ?? {case: 'expiry', renewal: 'not-observed', refreshRecovery: 'not-observed', cookieExpiry: 'not-observed'},
  };
  await privateDirectory(RECEIPTS);
  const file = path.join(RECEIPTS, `ow-2-${id}.json`);
  await writeFile(file, JSON.stringify(receipt, null, 2) + '\n', {mode: 0o600, flag: 'wx'});
  return {receipt, file};
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.umask(0o077);
  const args = process.argv.slice(2);
  const value = key => args[args.indexOf(key) + 1];
  runHosted({targetFile: args.includes('--target') ? value('--target') : undefined, afterFile: args.includes('--after') ? value('--after') : undefined})
    .then(({receipt, file}) => { console.log(`${receipt.status}: ${path.relative(ROOT, file)}`); process.exitCode = receipt.acceptance.chainAccepted ? 0 : 1; })
    .catch(() => { console.error('HOSTED_PRIVATE_OUTPUT'); process.exitCode = 1; });
}
