import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, stat, rm, symlink, writeFile, mkdir, readdir, chmod, lstat } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { recordFailure, retainDiagnostics, expireDiagnostics, RETENTION_MS } from './diagnostics.mjs';

test('JavaScript failures are captured only in the private log and append owned-command evidence', async () => {
  const dir = await mkdtemp('/tmp/ontokit-failure-log-');
  try {
    const file = path.join(dir, 'private.log');
    await writeFile(file, 'owned command evidence\n', {mode: 0o600});
    await recordFailure({dir}, new Error('synthetic-private-bootstrap-failure'));
    const log = await readFile(file, 'utf8');
    assert.match(log, /^owned command evidence\n/);
    assert.match(log, /Error: synthetic-private-bootstrap-failure/);
    assert.equal((await stat(file)).mode & 0o777, 0o600);
  } finally { await rm(dir, {recursive: true, force: true}); }
});
test('failure capture refuses symlink logs without changing the target', async () => {
  const dir = await mkdtemp('/tmp/ontokit-failure-log-');
  try {
    const target = path.join(dir, 'target');
    await writeFile(target, 'unchanged');
    await symlink(target, path.join(dir, 'private.log'));
    await assert.rejects(recordFailure({dir}, new Error('synthetic failure')));
    assert.equal(await readFile(target, 'utf8'), 'unchanged');
  } finally { await rm(dir, {recursive: true, force: true}); }
});

const id = 'e'.repeat(32);
for (const state of ['missing-metadata', 'staging', 'invalid-metadata', 'symlink-directory', 'symlink-log', 'symlink-metadata', 'unsafe-directory', 'unsafe-metadata', 'unreadable-directory', 'unreadable-metadata', 'extra-entry', 'unrecognized-name']) {
  test(`expiry preserves and reports unverified ${state} entries without blocking valid expiry`, async t => {
    const root = await mkdtemp('/tmp/ontokit-diagnostics-test-');
    const outside = await mkdtemp('/tmp/ontokit-diagnostics-outside-');
    const name = state === 'staging' ? `.staging-${id}-interrupted` : state === 'unrecognized-name' ? 'unexpected\n\u001b[31m' : id;
    const dir = path.join(root, name);
    const warnings = [];
    t.mock.method(console, 'warn', message => warnings.push(message));
    try {
      await writeFile(path.join(outside, 'sentinel'), 'synthetic-private-content');
      if (state === 'symlink-directory') await symlink(outside, dir);
      else {
        await mkdir(dir, {mode: 0o700});
        await writeFile(path.join(dir, 'private.log'), 'synthetic-private-content', {mode: 0o600});
        if (!['missing-metadata', 'staging'].includes(state)) {
          await writeFile(path.join(dir, 'metadata.json'), state === 'invalid-metadata' ? 'synthetic-private-content' : JSON.stringify({id, uid: process.getuid(), createdAt: 0, expiresAt: RETENTION_MS}), {mode: 0o600});
        }
        if (state === 'symlink-log') { await rm(path.join(dir, 'private.log')); await symlink(path.join(outside, 'sentinel'), path.join(dir, 'private.log')); }
        if (state === 'symlink-metadata') { await rm(path.join(dir, 'metadata.json')); await symlink(path.join(outside, 'sentinel'), path.join(dir, 'metadata.json')); }
        if (state === 'unsafe-directory') await chmod(dir, 0o755);
        if (state === 'unsafe-metadata') await chmod(path.join(dir, 'metadata.json'), 0o644);
        if (state === 'unreadable-directory') await chmod(dir, 0o000);
        if (state === 'unreadable-metadata') await chmod(path.join(dir, 'metadata.json'), 0o000);
        if (state === 'extra-entry') await symlink(outside, path.join(dir, 'unexpected'));
      }
      const valid = path.join(root, 'f'.repeat(32));
      await mkdir(valid, {mode: 0o700});
      await writeFile(path.join(valid, 'private.log'), 'valid private content', {mode: 0o600});
      await writeFile(path.join(valid, 'metadata.json'), JSON.stringify({id: 'f'.repeat(32), uid: process.getuid(), createdAt: 0, expiresAt: RETENTION_MS}), {mode: 0o600});
      await expireDiagnostics({root, now: RETENTION_MS});
      await lstat(dir);
      assert.equal(await readFile(path.join(outside, 'sentinel'), 'utf8'), 'synthetic-private-content');
      await assert.rejects(lstat(valid), {code: 'ENOENT'});
      assert.deepEqual(warnings, [`Unverified diagnostics preserved; inspect for manual cleanup: ${JSON.stringify(dir)}`]);
    } finally { if (state === 'unreadable-directory') await chmod(dir, 0o700); await rm(root, {recursive: true, force: true}); await rm(outside, {recursive: true, force: true}); }
  });
}
test('diagnostic publication refuses an existing entry and removes only its own staging directory', async t => {
  const root = await mkdtemp('/tmp/ontokit-diagnostics-test-');
  const source = await mkdtemp('/tmp/ontokit-diagnostics-source-');
  t.mock.method(console, 'warn', () => {});
  try {
    await writeFile(path.join(source, 'private.log'), 'new private log', {mode: 0o600});
    await mkdir(path.join(root, id), {mode: 0o700});
    await assert.rejects(retainDiagnostics({dir: source, manifest: {id, status: 'failed'}}, {root}));
    assert.deepEqual(await readdir(root), [id]);
    assert.deepEqual(await readdir(path.join(root, id)), []);
  } finally { await rm(root, {recursive: true, force: true}); await rm(source, {recursive: true, force: true}); }
});
test('expiry still refuses unsafe or symlinked private roots', async () => {
  const base = await mkdtemp('/tmp/ontokit-diagnostics-test-');
  try {
    const unsafe = path.join(base, 'unsafe');
    await mkdir(unsafe, {mode: 0o755});
    await assert.rejects(expireDiagnostics({root: unsafe}), /Unsafe private directory/);
    const linked = path.join(base, 'linked');
    await symlink(unsafe, linked);
    await assert.rejects(expireDiagnostics({root: linked}), /Unsafe private directory/);
  } finally { await rm(base, {recursive: true, force: true}); }
});

test('hard interruption during metadata writing leaves only unpublished staging, which next launch reports', async t => {
  const root = await mkdtemp('/tmp/ontokit-diagnostics-test-');
  const source = await mkdtemp('/tmp/ontokit-diagnostics-source-');
  const warnings = [];
  t.mock.method(console, 'warn', message => warnings.push(message));
  // Pause precisely at the filesystem boundary, without a production failure-injection hook.
  const code = `import fs from 'node:fs/promises';
import {syncBuiltinESMExports} from 'node:module';
const write = fs.writeFile;
fs.writeFile = async (file, ...args) => {
  if (String(file).endsWith('/metadata.json')) { process.send('writing-metadata'); await new Promise(() => {}); }
  return write(file, ...args);
};
syncBuiltinESMExports();
const {retainDiagnostics} = await import(${JSON.stringify(new URL('./diagnostics.mjs', import.meta.url).href)});
await retainDiagnostics({dir: ${JSON.stringify(source)}, manifest: {id: ${JSON.stringify(id)}, status: 'failed'}}, {root: ${JSON.stringify(root)}});`;
  let child;
  let exit;
  try {
    await writeFile(path.join(source, 'private.log'), 'synthetic-private-log', {mode: 0o600});
    child = spawn(process.execPath, ['--input-type=module', '-e', code], {stdio: ['ignore', 'ignore', 'ignore', 'ipc']});
    exit = new Promise(resolve => child.once('exit', resolve));
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Metadata boundary was not reached')), 3000);
      child.once('message', () => { clearTimeout(timer); resolve(); });
      child.once('error', error => { clearTimeout(timer); reject(error); });
      child.once('exit', () => { clearTimeout(timer); reject(new Error('Publisher exited before metadata boundary')); });
    });
    child.kill('SIGKILL');
    await exit;
    const entries = await readdir(root);
    assert.equal(entries.length, 1);
    assert.match(entries[0], new RegExp(`^\\.staging-${id}-`));
    const staging = path.join(root, entries[0]);
    assert.deepEqual(await readdir(staging), ['private.log']);
    assert.equal((await lstat(staging)).mode & 0o777, 0o700);
    await expireDiagnostics({root});
    assert.deepEqual(await readdir(root), entries);
    assert.deepEqual(warnings, [`Unverified diagnostics preserved; inspect for manual cleanup: ${JSON.stringify(staging)}`]);
  } finally {
    if (child) { child.kill('SIGKILL'); await exit; }
    await rm(root, {recursive: true, force: true}); await rm(source, {recursive: true, force: true});
  }
});
test('successful publication is complete and private; verified expiry deletion failure remains fatal', async () => {
  const root = await mkdtemp('/tmp/ontokit-diagnostics-test-');
  const source = await mkdtemp('/tmp/ontokit-diagnostics-source-');
  try {
    await writeFile(path.join(source, 'private.log'), 'synthetic-private-log', {mode: 0o600});
    await retainDiagnostics({dir: source, manifest: {id, status: 'failed'}}, {root, now: 0});
    assert.deepEqual(await readdir(root), [id]);
    const dir = path.join(root, id);
    assert.equal((await lstat(dir)).mode & 0o777, 0o700);
    for (const file of ['metadata.json', 'private.log']) assert.equal((await lstat(path.join(dir, file))).mode & 0o777, 0o600);
    assert.equal(JSON.parse(await readFile(path.join(dir, 'metadata.json'), 'utf8')).expiresAt, RETENTION_MS);
    await chmod(root, 0o500);
    await assert.rejects(expireDiagnostics({root, now: RETENTION_MS}), {code: 'EACCES'});
    await lstat(dir);
  } finally { await chmod(root, 0o700); await rm(root, {recursive: true, force: true}); await rm(source, {recursive: true, force: true}); }
});
