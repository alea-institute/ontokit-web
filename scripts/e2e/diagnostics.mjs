import { constants } from 'node:fs';
import { open, writeFile, readdir, lstat, readFile, rm, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { privateDirectory } from './ownership.mjs';
export const DIAGNOSTICS_ROOT = `/tmp/ontokit-e2e-diagnostics-${process.getuid()}`;
export const RETENTION_MS = 60 * 60 * 1000;
const MAX_BYTES = 8 * 1024 * 1024;
export async function expireDiagnostics({root = DIAGNOSTICS_ROOT, now = Date.now()} = {}) {
  await privateDirectory(root);
  for (const id of await readdir(root)) {
    if (!/^[a-f0-9]{32}$/.test(id)) throw new Error('Unexpected private diagnostic entry');
    const dir = path.join(root, id);
    await privateDirectory(dir);
    const file = path.join(dir, 'metadata.json');
    const stat = await lstat(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.uid !== process.getuid() || (stat.mode & 0o077)) throw new Error('Unsafe diagnostic metadata');
    const metadata = JSON.parse(await readFile(file, 'utf8'));
    if (metadata.id !== id || metadata.uid !== process.getuid() || !Number.isSafeInteger(metadata.createdAt) || metadata.expiresAt !== metadata.createdAt + RETENTION_MS) throw new Error('Invalid diagnostic expiry');
    if (metadata.expiresAt <= now) await rm(dir, {recursive: true});
  }
}
export async function retainDiagnostics(ctx, {root = DIAGNOSTICS_ROOT, now = Date.now()} = {}) {
  const {id, status} = ctx.manifest;
  if (!/^[a-f0-9]{32}$/.test(id) || !/^[a-z-]+$/.test(status)) throw new Error('Invalid diagnostic identity');
  await expireDiagnostics({root, now});
  await privateDirectory(ctx.dir);
  let source;
  try { source = await open(path.join(ctx.dir, 'private.log'), constants.O_RDONLY | constants.O_NOFOLLOW); }
  catch (error) { if (error.code === 'ENOENT') return; throw error; }
  const dir = path.join(root, id);
  let created = false;
  try {
    const stat = await source.stat();
    if (!stat.isFile() || stat.uid !== process.getuid() || (stat.mode & 0o077)) throw new Error('Unsafe diagnostic log');
    await mkdir(dir, {mode: 0o700}); created = true;
    const size = Math.min(stat.size, MAX_BYTES);
    const buffer = Buffer.alloc(size);
    const {bytesRead} = await source.read(buffer, 0, size, stat.size - size);
    await writeFile(path.join(dir, 'private.log'), buffer.subarray(0, bytesRead), {mode: 0o600, flag: 'wx'});
    await writeFile(path.join(dir, 'metadata.json'), JSON.stringify({id, uid: process.getuid(), phase: status, createdAt: now, expiresAt: now + RETENTION_MS, truncated: stat.size > size}), {mode: 0o600, flag: 'wx'});
  } catch (error) {
    // Only remove the directory if this invocation created it.
    if (created) await rm(dir, {recursive: true, force: true});
    throw error;
  } finally { await source.close(); }
}

// Never send raw JavaScript errors to the terminal: fetch/build failures may carry
// credentials. Keep their bounded stack beside owned-command output so opt-in
// retention can explain failures in orchestration code as well as child commands.
export async function recordFailure(ctx, error) {
  await privateDirectory(ctx.dir);
  const file = await open(path.join(ctx.dir, 'private.log'), constants.O_WRONLY | constants.O_APPEND | constants.O_CREAT | constants.O_NOFOLLOW, 0o600);
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.uid !== process.getuid() || (stat.mode & 0o077)) throw new Error('Unsafe diagnostic log');
    const detail = error instanceof Error ? error.stack || error.message : 'Non-Error orchestration failure';
    await file.write(`\nJavaScript orchestration failure:\n${detail.slice(0, 65536)}\n`);
  } finally { await file.close(); }
}
