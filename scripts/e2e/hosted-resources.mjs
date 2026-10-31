// Kept free of launcher/process setup so Playwright can load this ledger helper.
import {constants} from 'node:fs';
import {lstat, open, realpath} from 'node:fs/promises';
import path from 'node:path';

/** Fsynced append-only ledger: import intent precedes HTTP; its returned ID follows immediately. */
export async function recordResource(run, entry) {
  if (!run.hosted) return;
  const dir = await lstat(run.dir);
  if (!dir.isDirectory() || dir.isSymbolicLink() || dir.uid !== process.getuid() || (dir.mode & 0o077) || await realpath(run.dir) !== run.dir) throw new Error('HOSTED_PRIVATE_INPUT');
  const handle = await open(path.join(run.dir, 'owned-resources.jsonl'), constants.O_WRONLY | constants.O_APPEND | constants.O_CREAT | constants.O_NOFOLLOW, 0o600);
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.uid !== process.getuid() || (stat.mode & 0o077)) throw new Error('HOSTED_PRIVATE_INPUT');
    await handle.writeFile(JSON.stringify({run: run.id, ...entry}) + '\n');
    await handle.sync();
  } finally { await handle.close(); }
}
