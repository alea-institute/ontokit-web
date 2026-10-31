import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { cp } from 'node:fs/promises';
import { treeDigest } from './disposition.mjs';

// Test backups intentionally survive test cleanup; no fixture is deleted without proof.
export async function backup({run, dir, sha256}) {
  const destination = `${dir}-backup-${randomBytes(8).toString('hex')}`;
  await cp(dir, destination, {recursive: true, errorOnExist: true});
  assert.equal(await treeDigest(destination), sha256);
  return {run, sha256, verified: true};
}

export const selectedRuntime = {web: 'a'.repeat(40), api: 'b'.repeat(40), worker: 'b'.repeat(40)};
export const observeRuntime = async ({run, phase, host}) => ({
  version: 1, environment: 'dev', run, phase, host,
  observedAt: new Date().toISOString(), revisions: {...selectedRuntime},
  provenance: {source: 'deployment-status', sha256: 'c'.repeat(64)},
});
