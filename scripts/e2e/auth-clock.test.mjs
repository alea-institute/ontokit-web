import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { chmod, copyFile, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RUNTIME_ROOT, privateDirectory } from './ownership.mjs';

import * as clock from './auth-clock.mjs';
// Like the launcher, preload a private copy: NODE_OPTIONS splits unquoted paths at spaces.
const PRELOAD_DIR = await mkdtemp('/tmp/ontokit-auth-clock-preload-');
const PRELOAD = path.join(PRELOAD_DIR, 'auth-clock.mjs');
await copyFile(fileURLToPath(new URL('./auth-clock.mjs', import.meta.url)), PRELOAD);
test.after(() => rm(PRELOAD_DIR, {recursive: true, force: true}));
const DAY = 86_400_000;

async function sandbox() {
  const root = await mkdtemp('/tmp/ontokit-auth-clock-test-');
  const run = randomBytes(16).toString('hex');
  await mkdir(path.join(root, run), {mode: 0o700});
  return {root, run, dir: path.join(root, run)};
}

test('requiring the module as a library leaves the clock untouched', () => {
  assert.equal(globalThis.Date.now, Date.now);
  assert.equal(globalThis.__ontokitAuthClock, undefined);
  assert.ok(Math.abs(Date.now() - (performance.timeOrigin + performance.now())) < 1000);
});

test('offsets must be finite safe integers inside the supported range', () => {
  for (const value of [0, 1, DAY, clock.MAX_OFFSET_MS]) assert.equal(clock.validateOffset(value), value);
  for (const value of [NaN, Infinity, -Infinity, -1, 1.5, clock.MAX_OFFSET_MS + 1, Number.MAX_SAFE_INTEGER + 2, '5', null, undefined]) {
    assert.throws(() => clock.validateOffset(value), /offset out of range/, String(value));
  }
});

test('control content must be exact, current-version and bound to this run', () => {
  const run = 'a'.repeat(32);
  assert.deepEqual(clock.parseControl(JSON.stringify({version: 1, run, offsetMs: 5}), run), {offsetMs: 5});
  for (const text of ['{', '[]', 'null', JSON.stringify({version: 2, run, offsetMs: 0}), JSON.stringify({version: 1, run, offsetMs: 0, extra: 1}), JSON.stringify({version: 1, run})]) {
    assert.throws(() => clock.parseControl(text, run), /malformed/, text);
  }
  assert.throws(() => clock.parseControl(JSON.stringify({version: 1, run: 'b'.repeat(32), offsetMs: 0}), run), /foreign run/);
  assert.throws(() => clock.parseControl(JSON.stringify({version: 1, run, offsetMs: -5}), run), /offset out of range/);
  assert.throws(() => clock.controlPath('../escape'), /invalid run identity/);
});

test('reader rejects missing, symlinked, non-private and foreign controls', async () => {
  const {root, run, dir} = await sandbox();
  const outside = await mkdtemp('/tmp/ontokit-auth-clock-outside-');
  try {
    assert.throws(() => clock.readControlSync(run, {root}), /missing/);
    clock.writeControlSync(run, 42, {root});
    assert.equal(clock.readControlSync(run, {root}).offsetMs, 42);
    const file = path.join(dir, clock.CONTROL_NAME);
    await chmod(file, 0o644);
    assert.throws(() => clock.readControlSync(run, {root}), /unsafe file/);
    await rm(file);
    await writeFile(path.join(outside, 'control'), JSON.stringify({version: 1, run, offsetMs: 7}), {mode: 0o600});
    await symlink(path.join(outside, 'control'), file);
    assert.throws(() => clock.readControlSync(run, {root}), /symlink/);
    await rm(file);
    await writeFile(file, JSON.stringify({version: 1, run: 'c'.repeat(32), offsetMs: 7}), {mode: 0o600});
    assert.throws(() => clock.readControlSync(run, {root}), /foreign run/);
    await chmod(dir, 0o755);
    assert.throws(() => clock.readControlSync(run, {root}), /unsafe run directory/);
    await chmod(dir, 0o700);
    // A run directory that is itself a symlink is rejected even when its target is private.
    const linkedRun = randomBytes(16).toString('hex');
    await symlink(dir, path.join(root, linkedRun));
    assert.throws(() => clock.readControlSync(linkedRun, {root}), /unsafe run directory/);
  } finally { await rm(root, {recursive: true, force: true}); await rm(outside, {recursive: true, force: true}); }
});

test('writer is atomic and private, never follows symlinks and never adopts a foreign control', async () => {
  const {root, run, dir} = await sandbox();
  const outside = await mkdtemp('/tmp/ontokit-auth-clock-outside-');
  try {
    const file = clock.writeControlSync(run, 0, {root});
    assert.equal(file, path.join(dir, clock.CONTROL_NAME));
    assert.deepEqual(JSON.parse(await readFile(file, 'utf8')), {version: 1, run, offsetMs: 0});
    assert.throws(() => clock.writeControlSync(run, -1, {root}), /offset out of range/);
    assert.throws(() => clock.writeControlSync(run, Infinity, {root}), /offset out of range/);
    await writeFile(file, JSON.stringify({version: 1, run: 'd'.repeat(32), offsetMs: 0}), {mode: 0o600});
    assert.throws(() => clock.writeControlSync(run, 5, {root}), /foreign run/);
    assert.equal(JSON.parse(await readFile(file, 'utf8')).run, 'd'.repeat(32));
    await rm(file);
    const target = path.join(outside, 'target');
    await writeFile(target, 'untouched', {mode: 0o600});
    await symlink(target, file);
    assert.throws(() => clock.writeControlSync(run, 5, {root}), /symlink/);
    assert.equal(await readFile(target, 'utf8'), 'untouched');
  } finally { await rm(root, {recursive: true, force: true}); await rm(outside, {recursive: true, force: true}); }
});

test('TypeScript fixture writer produces a control the preload accepts and shares the same refusals', async () => {
  const {setAuthClockOffset} = await import('../../e2e/fixtures/run.ts');
  await privateDirectory(RUNTIME_ROOT);
  const run = randomBytes(16).toString('hex');
  const dir = path.join(RUNTIME_ROOT, run);
  await mkdir(dir, {mode: 0o700});
  try {
    const config = {id: run, dir, lifecycle: {clockControl: clock.controlPath(run), maxClockOffsetMs: clock.MAX_OFFSET_MS}};
    setAuthClockOffset(config, 1234);
    assert.equal(clock.readControlSync(run).offsetMs, 1234);
    assert.throws(() => setAuthClockOffset(config, -1), /out of range/);
    assert.throws(() => setAuthClockOffset(config, 0.5), /out of range/);
    await writeFile(clock.controlPath(run), JSON.stringify({version: 1, run: 'e'.repeat(32), offsetMs: 0}), {mode: 0o600});
    assert.throws(() => setAuthClockOffset(config, 1), /another run/);
  } finally { await rm(dir, {recursive: true, force: true}); }
});

// Drives a real child Node process with the preload, as the owned Next server gets it.
function preloadedChild(run, extraEnv = {}) {
  const child = spawn(process.execPath, ['-e', `
    const readline = require('node:readline');
    const rl = readline.createInterface({input: process.stdin});
    rl.on('line', () => {
      const real = performance.timeOrigin + performance.now();
      class Sub extends Date {}
      console.log(JSON.stringify({now: Date.now() - real, constructed: new Date().getTime() - real, sub: new Sub().getTime() - real,
        explicit: new Date(0).getTime(), string: typeof Date(), parse: Date.parse('1970-01-01T00:00:01Z'), instance: new Date() instanceof Date}));
    });
  `], {env: {PATH: process.env.PATH, NODE_OPTIONS: `--import=${PRELOAD}`, ONTOKIT_E2E_RUN: run, ...extraEnv}, stdio: ['pipe', 'pipe', 'pipe']});
  let buffer = '';
  const waiting = [];
  let stderr = '';
  child.stdout.on('data', chunk => {
    buffer += chunk;
    let index;
    while ((index = buffer.indexOf('\n')) >= 0) { const line = buffer.slice(0, index); buffer = buffer.slice(index + 1); waiting.shift()?.(JSON.parse(line)); }
  });
  child.stderr.on('data', chunk => { stderr += chunk; });
  const exited = new Promise(resolve => child.on('exit', code => resolve(code)));
  return {
    probe: () => new Promise(resolve => { waiting.push(resolve); child.stdin.write('probe\n'); }),
    stop: async () => { child.stdin.end(); return exited; },
    exited, stderr: () => stderr,
  };
}
const settle = () => new Promise(resolve => setTimeout(resolve, 3 * clock.REFRESH_INTERVAL_MS));

test('preload shifts only the owned process clock and restores normal time', async () => {
  await privateDirectory(RUNTIME_ROOT);
  const run = randomBytes(16).toString('hex');
  const dir = path.join(RUNTIME_ROOT, run);
  await mkdir(dir, {mode: 0o700});
  clock.writeControlSync(run, 0);
  const child = preloadedChild(run, {ONTOKIT_E2E_AUTH_CLOCK: '1'});
  try {
    let seen = await child.probe();
    assert.ok(Math.abs(seen.now) < 500 && Math.abs(seen.constructed) < 500, 'starts at zero offset');
    const offset = 30 * DAY + 15_000;
    clock.writeControlSync(run, offset);
    await settle();
    seen = await child.probe();
    for (const key of ['now', 'constructed', 'sub']) assert.ok(Math.abs(seen[key] - offset) < 500, `${key} follows the control`);
    assert.equal(seen.explicit, 0);
    assert.equal(seen.parse, 1000);
    assert.equal(seen.string, 'string');
    assert.equal(seen.instance, true);
    // The launcher/test process (host) keeps normal time throughout.
    assert.ok(Math.abs(Date.now() - (performance.timeOrigin + performance.now())) < 500);
    // Injected failure: a corrupted control never keeps the clock advanced.
    await writeFile(path.join(dir, `${clock.CONTROL_NAME}.bad`), 'not json', {mode: 0o600});
    const {rename} = await import('node:fs/promises');
    await rename(path.join(dir, `${clock.CONTROL_NAME}.bad`), clock.controlPath(run));
    await settle();
    seen = await child.probe();
    assert.ok(Math.abs(seen.now) < 500, 'malformed control reverts to normal time');
    assert.match(child.stderr(), /Auth clock control rejected: malformed; using normal time/);
    // The writer refuses to adopt an unreadable control; explicit removal recovers.
    assert.throws(() => clock.writeControlSync(run, offset), /malformed/);
    await rm(clock.controlPath(run));
    clock.writeControlSync(run, offset);
    await settle();
    assert.ok(Math.abs((await child.probe()).now - offset) < 500);
    clock.writeControlSync(run, 0);
    await settle();
    assert.ok(Math.abs((await child.probe()).now) < 500, 'reset restores normal time');
    assert.equal(await child.stop(), 0);
  } finally { await rm(dir, {recursive: true, force: true}); }
});

test('processes without the activation marker are never shifted', async () => {
  await privateDirectory(RUNTIME_ROOT);
  const run = randomBytes(16).toString('hex');
  const dir = path.join(RUNTIME_ROOT, run);
  await mkdir(dir, {mode: 0o700});
  clock.writeControlSync(run, 0);
  clock.writeControlSync(run, 10 * DAY);
  const child = preloadedChild(run);
  try {
    assert.ok(Math.abs((await child.probe()).now) < 500);
    assert.equal(await child.stop(), 0);
  } finally { await rm(dir, {recursive: true, force: true}); }
});

test('preload refuses to start with a nonzero, foreign or missing control', async () => {
  await privateDirectory(RUNTIME_ROOT);
  const run = randomBytes(16).toString('hex');
  const dir = path.join(RUNTIME_ROOT, run);
  await mkdir(dir, {mode: 0o700});
  try {
    const missing = preloadedChild(run, {ONTOKIT_E2E_AUTH_CLOCK: '1'});
    assert.notEqual(await missing.exited, 0);
    assert.match(missing.stderr(), /missing/);
    clock.writeControlSync(run, DAY);
    const nonzero = preloadedChild(run, {ONTOKIT_E2E_AUTH_CLOCK: '1'});
    assert.notEqual(await nonzero.exited, 0);
    assert.match(nonzero.stderr(), /must start at zero offset/);
    const foreign = preloadedChild('f'.repeat(32), {ONTOKIT_E2E_AUTH_CLOCK: '1'});
    assert.notEqual(await foreign.exited, 0);
    const unmarked = preloadedChild('', {ONTOKIT_E2E_AUTH_CLOCK: '1'});
    assert.notEqual(await unmarked.exited, 0);
    assert.match(unmarked.stderr(), /invalid run identity/);
  } finally { await rm(dir, {recursive: true, force: true}); }
});
