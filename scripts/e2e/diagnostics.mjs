import { constants } from 'node:fs';
import { open, writeFile, readdir, lstat, readFile, rm, mkdtemp, rename } from 'node:fs/promises';
import path from 'node:path';
import { privateDirectory } from './ownership.mjs';
export const DIAGNOSTICS_ROOT = `/tmp/ontokit-e2e-diagnostics-${process.getuid()}`;
export const RETENTION_MS = 60 * 60 * 1000;
const MAX_BYTES = 8 * 1024 * 1024;
function isPrivate(stat) { return stat.uid === process.getuid() && !(stat.mode & 0o077) && !stat.isSymbolicLink(); }
async function verifiedMetadata(dir, id) {
  if (!/^[a-f0-9]{32}$/.test(id)) return null;
  try {
    const stat = await lstat(dir);
    if (!stat.isDirectory() || !isPrivate(stat)) return null;
    const names = (await readdir(dir)).sort();
    if (names.length !== 2 || names[0] !== 'metadata.json' || names[1] !== 'private.log') return null;
    for (const name of names) {
      const fileStat = await lstat(path.join(dir, name));
      if (!fileStat.isFile() || !isPrivate(fileStat)) return null;
    }
    const metadata = JSON.parse(await readFile(path.join(dir, 'metadata.json'), 'utf8'));
    if (!metadata || metadata.id !== id || metadata.uid !== process.getuid() || !Number.isSafeInteger(metadata.createdAt) || metadata.expiresAt !== metadata.createdAt + RETENTION_MS) return null;
    return metadata;
  } catch (error) {
    if (error instanceof SyntaxError || ['ENOENT', 'ENOTDIR', 'ELOOP', 'EACCES', 'EPERM'].includes(error.code)) return null;
    throw error;
  }
}
export async function expireDiagnostics({root = DIAGNOSTICS_ROOT, now = Date.now()} = {}) {
  await privateDirectory(root);
  for (const id of await readdir(root)) {
    const dir = path.join(root, id);
    const metadata = await verifiedMetadata(dir, id);
    if (!metadata) {
      // Never expose log/metadata contents or follow an unverified entry for cleanup.
      console.warn(`Unverified diagnostics preserved; inspect for manual cleanup: ${JSON.stringify(dir)}`);
      continue;
    }
    // Deletion failures for verified entries remain fatal.
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
  let staging;
  try {
    const stat = await source.stat();
    if (!stat.isFile() || stat.uid !== process.getuid() || (stat.mode & 0o077)) throw new Error('Unsafe diagnostic log');
    staging = await mkdtemp(path.join(root, `.staging-${id}-`));
    const size = Math.min(stat.size, MAX_BYTES);
    const buffer = Buffer.alloc(size);
    const {bytesRead} = await source.read(buffer, 0, size, stat.size - size);
    await writeFile(path.join(staging, 'private.log'), buffer.subarray(0, bytesRead), {mode: 0o600, flag: 'wx'});
    await writeFile(path.join(staging, 'metadata.json'), JSON.stringify({id, uid: process.getuid(), phase: status, createdAt: now, expiresAt: now + RETENTION_MS, truncated: stat.size > size}), {mode: 0o600, flag: 'wx'});
    // A fresh run ID has one publisher. Preserve any existing entry, even if empty.
    try { await lstat(dir); throw new Error('Diagnostic entry already exists'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    await rename(staging, dir);
    staging = undefined;
  } catch (error) {
    // Interrupted staging directories are reported on the next launch.
    if (staging) await rm(staging, {recursive: true, force: true});
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
