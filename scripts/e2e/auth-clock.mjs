// Harness-only clock instrument for the disposable lifecycle Next process (KTD3).
//
// Loaded two ways:
//   1. As a library by the launcher and tests (no side effects on import).
//   2. As a runtime preload (`NODE_OPTIONS=--import=<private copy>`) for the owned
//      `next start` process only, activated by ONTOKIT_E2E_AUTH_CLOCK=1. The preload
//      shifts the JavaScript wall clock (Date.now / new Date()) of that process by
//      the offset in the run's private control file. Host, browser, API and provider
//      clocks are never touched, and no production source is patched.
//
// The control is bound to this run's private runtime directory and ownership marker
// (ONTOKIT_E2E_RUN). Foreign, symlinked, non-private or malformed controls and
// non-finite/out-of-range offsets are rejected. At startup a rejected control
// aborts the process; later a rejected control reverts the clock to normal time.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const CONTROL_NAME = 'auth-clock.json';
export const CONTROL_VERSION = 1;
// Auth.js default session maxAge is 30 days; allow comfortable headroom above it.
export const MAX_OFFSET_MS = 400 * 86_400_000;
const MAX_CONTROL_BYTES = 4096;
export const REFRESH_INTERVAL_MS = 20;
const RUN_PATTERN = /^[a-f0-9]{32}$/;
const RealDate = Date;

export const runtimeRoot = (uid = process.getuid()) => `/tmp/ontokit-e2e-${uid}`;

function assertRun(run) {
  if (typeof run !== 'string' || !RUN_PATTERN.test(run)) throw new Error('Auth clock control rejected: invalid run identity');
  return run;
}
export function validateOffset(offsetMs) {
  if (typeof offsetMs !== 'number' || !Number.isSafeInteger(offsetMs) || offsetMs < 0 || offsetMs > MAX_OFFSET_MS) {
    throw new Error('Auth clock control rejected: offset out of range');
  }
  return offsetMs;
}
function isPrivate(stat) {
  return stat.uid === process.getuid() && (stat.mode & 0o077) === 0;
}
function assertPrivateDirectory(dir) {
  const stat = fs.lstatSync(dir);
  if (!stat.isDirectory() || stat.isSymbolicLink() || !isPrivate(stat) || fs.realpathSync(dir) !== dir) {
    throw new Error('Auth clock control rejected: unsafe run directory');
  }
}
export function controlPath(run, root = runtimeRoot()) {
  return path.join(root, assertRun(run), CONTROL_NAME);
}
export function parseControl(text, run) {
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('Auth clock control rejected: malformed'); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Auth clock control rejected: malformed');
  const keys = Object.keys(data).sort();
  if (keys.length !== 3 || keys[0] !== 'offsetMs' || keys[1] !== 'run' || keys[2] !== 'version' || data.version !== CONTROL_VERSION) {
    throw new Error('Auth clock control rejected: malformed');
  }
  if (data.run !== assertRun(run)) throw new Error('Auth clock control rejected: foreign run');
  return {offsetMs: validateOffset(data.offsetMs)};
}
// Reads and validates the control without following symlinks at the final component.
export function readControlSync(run, {root = runtimeRoot()} = {}) {
  const dir = path.join(root, assertRun(run));
  assertPrivateDirectory(root);
  assertPrivateDirectory(dir);
  let fd;
  try {
    fd = fs.openSync(path.join(dir, CONTROL_NAME), fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  } catch (error) {
    if (error.code === 'ELOOP') throw new Error('Auth clock control rejected: symlink');
    if (error.code === 'ENOENT') throw new Error('Auth clock control rejected: missing');
    throw error;
  }
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || !isPrivate(stat) || stat.size > MAX_CONTROL_BYTES) throw new Error('Auth clock control rejected: unsafe file');
    const buffer = Buffer.alloc(stat.size);
    let read = 0;
    while (read < stat.size) {
      const count = fs.readSync(fd, buffer, read, stat.size - read, read);
      if (count === 0) break;
      read += count;
    }
    return {...parseControl(buffer.subarray(0, read).toString('utf8'), run), key: `${stat.dev}:${stat.ino}:${stat.mtimeMs}:${stat.size}`};
  } finally { fs.closeSync(fd); }
}
// Atomic private replacement. An existing control that belongs to another run is
// never overwritten; a symlink at the control path is replaced, never followed.
export function writeControlSync(run, offsetMs, {root = runtimeRoot()} = {}) {
  validateOffset(offsetMs);
  const dir = path.join(root, assertRun(run));
  assertPrivateDirectory(root);
  assertPrivateDirectory(dir);
  const file = path.join(dir, CONTROL_NAME);
  let existing = null;
  try { existing = fs.lstatSync(file); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (existing) {
    if (!existing.isFile() || existing.isSymbolicLink()) throw new Error('Auth clock control rejected: symlink');
    readControlSync(run, {root});
  }
  const temporary = path.join(dir, `.${CONTROL_NAME}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`);
  try {
    fs.writeFileSync(temporary, JSON.stringify({version: CONTROL_VERSION, run, offsetMs}), {mode: 0o600, flag: 'wx'});
    fs.renameSync(temporary, file);
  } catch (error) {
    fs.rmSync(temporary, {force: true});
    throw error;
  }
  return file;
}

// Replaces the global Date with an offset view. Primordial-captured Date values in
// Node internals are unaffected; that is why acceptance observes Auth.js directly.
export function install({run = process.env.ONTOKIT_E2E_RUN, root = runtimeRoot(), report = message => process.stderr.write(`${message}\n`)} = {}) {
  if (globalThis.__ontokitAuthClock) throw new Error('Auth clock already installed');
  assertRun(run);
  const initial = readControlSync(run, {root});
  if (initial.offsetMs !== 0) throw new Error('Auth clock control rejected: must start at zero offset');
  let offset = 0;
  let key = initial.key;
  let lastCheck = RealDate.now();
  let refreshing = false;
  let lastProblem = '';
  const refresh = () => {
    const real = RealDate.now();
    if (refreshing || real - lastCheck < REFRESH_INTERVAL_MS) return;
    refreshing = true;
    lastCheck = real;
    try {
      const control = readControlSync(run, {root});
      if (control.key !== key) { key = control.key; offset = control.offsetMs; }
      lastProblem = '';
    } catch (error) {
      // Fail toward normal time. The launcher's preflight observes Auth.js and
      // fails acceptance when the expected offset is not in effect.
      offset = 0; key = '';
      const problem = /^Auth clock control rejected: [a-z ]+$/.test(error.message) ? error.message : 'Auth clock control rejected: unreadable';
      if (problem !== lastProblem) { lastProblem = problem; try { report(`${problem}; using normal time`); } catch { /* reporting is best effort */ } }
    } finally { refreshing = false; }
  };
  const now = () => { refresh(); return RealDate.now() + offset; };
  const OffsetDate = new Proxy(RealDate, {
    construct(target, args, newTarget) {
      return Reflect.construct(target, args.length ? args : [now()], newTarget === OffsetDate ? target : newTarget);
    },
    apply() { return new RealDate(now()).toString(); },
    get(target, property, receiver) {
      if (property === 'now') return now;
      return Reflect.get(target, property, receiver === OffsetDate ? target : receiver);
    },
  });
  globalThis.Date = OffsetDate;
  Object.defineProperty(globalThis, '__ontokitAuthClock', {value: Object.freeze({run, currentOffsetMs: () => { refresh(); return offset; }}), enumerable: false});
  return OffsetDate;
}


if (process.env.ONTOKIT_E2E_AUTH_CLOCK === '1' && !globalThis.__ontokitAuthClock) install();
