import test from 'node:test';
import assert from 'node:assert/strict';
import { validateManifest, ownsResource, sameProcess, safeSourcePath } from './ownership.mjs';
const id = 'a'.repeat(32);
const manifest = {version: 1, id, project: `ontokit-e2e-${id}`, uid: process.getuid(), processes: []};
test('rejects malformed or foreign recovery identities', () => {
  assert.equal(validateManifest(manifest).id, id);
  for (const patch of [{id: '../../etc'}, {project: 'developer'}, {uid: -1}, {version: 2}, {processes: [{pid: 1}]}]) {
    assert.throws(() => validateManifest({...manifest, ...patch}));
  }
});
test('requires both Docker labels; never adopts developer resources', () => {
  assert.equal(ownsResource(manifest, {'io.ontokit.e2e.run': id, 'com.docker.compose.project': manifest.project}), true);
  assert.equal(ownsResource(manifest, {'io.ontokit.e2e.run': id}), false);
  assert.equal(ownsResource(manifest, {'io.ontokit.e2e.run': 'b'.repeat(32), 'com.docker.compose.project': manifest.project}), false);
});
test('PID reuse and boot changes fail closed', () => {
  const record = {pid: 123, start: '456', boot: 'boot', group: 123};
  assert.equal(sameProcess(record, record), true);
  assert.equal(sameProcess(record, {...record, start: '457'}), false);
  assert.equal(sameProcess(record, {...record, boot: 'other'}), false);
});
test('excludes credentials, auth state, caches and traversal from source copies', () => {
  for (const name of ['.env', '.env.local', 'a/.env.production', '.git/config', 'node_modules/a', '.next/server/a', 'e2e/.auth/user.json', '../escape', '/etc/passwd', 'private.pem']) assert.equal(safeSourcePath(name), false, name);
  for (const name of ['package.json', 'app/page.tsx', 'ontokit/main.py']) assert.equal(safeSourcePath(name), true);
});

import { mkdtemp, mkdir, writeFile, rm, symlink, readFile } from 'node:fs/promises';
import path from 'node:path';
import { ROOT, privateDirectory, loadManifest, processIdentity } from './ownership.mjs';
import { ownedCommand } from './runtime.mjs';
import { cleanupProcesses, cleanup } from './cleanup.mjs';
test('recovery refuses symlinked manifests and directory identity mismatches', async () => {
  await privateDirectory(ROOT);
  const dir = path.join(ROOT, 'b'.repeat(32));
  await mkdir(dir, {mode: 0o700});
  const outside = await mkdtemp('/tmp/ontokit-ownership-test-');
  try {
    await writeFile(path.join(outside, 'foreign'), JSON.stringify(manifest), {mode: 0o600});
    await symlink(path.join(outside, 'foreign'), path.join(dir, 'manifest.json'));
    await assert.rejects(loadManifest(path.join(dir, 'manifest.json')), /Unsafe recovery/);
    await rm(path.join(dir, 'manifest.json'));
    await writeFile(path.join(dir, 'manifest.json'), JSON.stringify(manifest), {mode: 0o600});
    await assert.rejects(loadManifest(path.join(dir, 'manifest.json')), /mismatch/);
    assert.equal(JSON.parse(await readFile(path.join(outside, 'foreign'))).id, manifest.id);
  } finally { await rm(dir, {recursive: true, force: true}); await rm(outside, {recursive: true, force: true}); }
});
for (const detached of [false, true]) test(`owned command failure cleans descendant (detached=${detached})`, async () => {
  const dir = await mkdtemp('/tmp/ontokit-process-test-');
  const m = {...manifest, processes: []};
  let descendant;
  const unrelated = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], {detached: true, stdio: 'ignore', env: {PATH: process.env.PATH}});
  const unrelatedIdentity = await processIdentity(unrelated.pid);
  try {
    const code = `const {spawn}=require('node:child_process');const fs=require('node:fs');const p=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore',detached:${detached}});fs.writeFileSync('child.pid',String(p.pid));p.unref();process.exit(7);`;
    await assert.rejects(ownedCommand({dir, manifest: m, env: {PATH: process.env.PATH}}, process.execPath, ['-e', code]), /failed \(7\)/);
    const child = Number(await readFile(path.join(dir, 'child.pid'), 'utf8'));
    descendant = await processIdentity(child);
    const record = m.processes[0];
    assert.equal(sameProcess(record, await processIdentity(record.pid)), true);
    await assert.rejects(cleanupProcesses({...m, id: 'd'.repeat(32)}), /not a run supervisor/);
    await cleanupProcesses(m);
    assert.equal(sameProcess(unrelatedIdentity, await processIdentity(unrelated.pid)), true, 'unrelated process must survive');
    await new Promise(resolve => setTimeout(resolve, 100));
    const childStat = await readFile(`/proc/${child}/stat`, 'utf8').catch(() => '');
    assert.ok(!childStat || childStat.includes(') Z '), 'descendant must be gone or reaped zombie');
    await cleanupProcesses(m);
  } finally {
    if (sameProcess(unrelatedIdentity, await processIdentity(unrelated.pid))) unrelated.kill('SIGKILL');
    if (descendant && sameProcess(descendant, await processIdentity(descendant.pid))) { try { process.kill(descendant.pid, 'SIGKILL'); } catch {} }
    await rm(dir, {recursive: true, force: true});
  }
});
test('repeated cleanup is safe for absent confined runs, traversal is rejected', async () => {
  await cleanup(path.join(ROOT, 'c'.repeat(32), 'manifest.json'));
  await assert.rejects(cleanup('/tmp/foreign/manifest.json'), /Invalid recovery path/);
});

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
test('unarmed supervisor exits when parent IPC disconnects', async () => {
  const child = spawn(process.execPath, [fileURLToPath(new URL('./supervisor.mjs', import.meta.url))], {detached: true, stdio: ['ignore', 'ignore', 'ignore', 'ipc']});
  let exited = false;
  const exit = new Promise(resolve => child.once('exit', () => { exited = true; resolve(); }));
  try {
    await new Promise((resolve, reject) => { child.once('message', resolve); child.once('error', reject); });
    child.disconnect();
    await Promise.race([exit, new Promise(resolve => setTimeout(resolve, 300))]);
    assert.equal(exited, true, 'unregistered supervisor must not survive lost parent');
  } finally { if (!exited) child.kill('SIGKILL'); await exit; }
});

import { retainDiagnostics, expireDiagnostics, RETENTION_MS } from './diagnostics.mjs';
test('opt-in diagnostics are private, confined and expire on the next launch', async () => {
  const root = await mkdtemp('/tmp/ontokit-diagnostics-test-');
  const source = await mkdtemp('/tmp/ontokit-log-test-');
  try {
    await writeFile(path.join(source, 'private.log'), 'synthetic-private-log', {mode: 0o600});
    await retainDiagnostics({dir: source, manifest: {...manifest, status: 'migrating'}}, {root, now: 1000});
    const retained = path.join(root, id);
    const {lstat} = await import('node:fs/promises');
    assert.equal((await lstat(retained)).mode & 0o777, 0o700);
    assert.equal((await lstat(path.join(retained, 'private.log'))).mode & 0o777, 0o600);
    assert.equal(await readFile(path.join(retained, 'private.log'), 'utf8'), 'synthetic-private-log');
    await expireDiagnostics({root, now: 1000 + RETENTION_MS - 1});
    assert.equal(JSON.parse(await readFile(path.join(retained, 'metadata.json'))).phase, 'migrating');
    await expireDiagnostics({root, now: 1000 + RETENTION_MS});
    await assert.rejects(lstat(retained), {code: 'ENOENT'});
    await assert.rejects(retainDiagnostics({dir: source, manifest: {...manifest, id: '../escape', status: 'migrating'}}, {root}), /Invalid diagnostic identity/);
  } finally { await rm(root, {recursive: true, force: true}); await rm(source, {recursive: true, force: true}); }
});

for (const signal of ['SIGINT', 'SIGTERM']) test(`hold stays alive until ${signal}, then reaches cleanup with nonzero exit`, async () => {
  const moduleUrl = new URL('./run.mjs', import.meta.url).href;
  const directory = await mkdtemp('/tmp/ontokit-hold-test-');
  const code = `import {waitForAbort} from ${JSON.stringify(moduleUrl)};
import {writeFileSync} from 'node:fs';
const controller = new AbortController();
process.on('${signal}', () => controller.abort());
(async () => {
  try { writeFileSync(${JSON.stringify(path.join(directory, 'holding'))}, 'ready'); await waitForAbort(controller.signal); }
  catch { process.exitCode = 130; }
  finally { writeFileSync(${JSON.stringify(path.join(directory, 'cleanup'))}, 'reached'); }
})();`;
  const child = spawn(process.execPath, ['--input-type=module', '-e', code], {stdio: ['ignore', 'pipe', 'pipe']});
  let errors = '';
  child.stderr.on('data', chunk => { errors += chunk; });
  let exited = false;
  const exit = new Promise(resolve => child.once('exit', (code, signal) => { exited = true; resolve({code, signal}); }));
  try {
    await new Promise(resolve => setTimeout(resolve, 250));
    assert.equal(await readFile(path.join(directory, 'holding'), 'utf8'), 'ready', errors);
    assert.equal(exited, false, 'a pending hold must keep a referenced event-loop handle');
    child.kill(signal);
    const result = await Promise.race([exit, new Promise((_, reject) => setTimeout(() => reject(new Error('Hold failed to stop')), 2000).unref())]);
    assert.deepEqual(result, {code: 130, signal: null});
    assert.equal(await readFile(path.join(directory, 'cleanup'), 'utf8'), 'reached');
  } finally { if (!exited) child.kill('SIGKILL'); await exit; await rm(directory, {recursive: true, force: true}); }
});

for (const obsolete of ['start', 'boot', 'group']) test(`obsolete ${obsolete} identity preserves replacement and cleans marked orphan`, async () => {
  const runId = (await import('node:crypto')).randomBytes(16).toString('hex');
  const foreign = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], {detached: obsolete !== 'group', stdio: 'ignore', env: {PATH: process.env.PATH}});
  const owned = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], {detached: true, stdio: 'ignore', env: {PATH: process.env.PATH, ONTOKIT_E2E_RUN: runId}});
  const foreignExit = new Promise(resolve => foreign.once('exit', resolve));
  const ownedExit = new Promise(resolve => owned.once('exit', resolve));
  const identity = await processIdentity(foreign.pid);
  try {
    const stale = {...identity, [obsolete]: obsolete === 'group' ? identity.pid : obsolete === 'start' ? '0' : 'obsolete-boot'};
    await cleanupProcesses({...manifest, id: runId, processes: [stale]});
    assert.equal(sameProcess(identity, await processIdentity(foreign.pid)), true);
    assert.equal(await processIdentity(owned.pid), null, 'marked orphan must be reaped');
  } finally {
    foreign.kill('SIGKILL'); owned.kill('SIGKILL');
    await Promise.all([foreignExit, ownedExit]);
  }
});
test('matching identity without a run supervisor marker still refuses cleanup', async () => {
  const foreign = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], {detached: true, stdio: 'ignore', env: {PATH: process.env.PATH}});
  const exit = new Promise(resolve => foreign.once('exit', resolve));
  const identity = await processIdentity(foreign.pid);
  try {
    await assert.rejects(cleanupProcesses({...manifest, processes: [identity]}), /not a run supervisor/);
    assert.equal(sameProcess(identity, await processIdentity(foreign.pid)), true);
  } finally { foreign.kill('SIGKILL'); await exit; }
});
