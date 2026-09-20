import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, stat, rm, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { recordFailure } from './diagnostics.mjs';

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
