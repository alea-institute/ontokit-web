import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile, symlink, chmod, lstat } from 'node:fs/promises';
import path from 'node:path';
import { createHostedRun, hostedRunDir, importWithJournal, projectDisposition, disposePrivateRun, treeDigest, teardownRehearsal } from './disposition.mjs';

const uuid = n => `${String(n).padStart(8, '0')}-1234-1234-1234-123456789012`;
async function setup() {
  const id = randomBytes(16).toString('hex');
  const {dir, journal} = await createHostedRun(id);
  await writeFile(path.join(dir, 'credentials.json'), 'synthetic-password', {mode: 0o600});
  return {id, dir, journal};
}
import { backup } from './test-helpers.mjs';

test('hosted ownership is durable before import and records exactly two retained IDs', async () => {
  const run = await setup();
  for (const [i, key] of ['folio', 'catholicCtt'].entries()) {
    const result = await importWithJournal(run, key, async () => {
      const inFlight = await projectDisposition(run);
      assert.equal(inFlight.projects[i].state, 'uncertain');
      assert.equal(inFlight.projects[i].marker, `ontokit-e2e-run:${run.id}:rehearsal:${key}`);
      return {id: uuid(i), name: 'synthetic'};
    });
    assert.equal(result.id, uuid(i));
  }
  const disposition = await projectDisposition(run);
  assert.equal(disposition.status, 'retained');
  assert.deepEqual(disposition.projects.map(p => p.id), [uuid(0), uuid(1)]);
});

test('a lost second import response preserves the first ID and unresolved exact marker', async () => {
  const run = await setup();
  await importWithJournal(run, 'folio', async () => ({id: uuid(1)}));
  await assert.rejects(importWithJournal(run, 'catholicCtt', async () => { throw new Error('timeout'); }));
  const disposition = await projectDisposition(run);
  assert.equal(disposition.status, 'unresolved');
  assert.deepEqual(disposition.projects.map(p => p.state), ['retained', 'uncertain']);
  assert.equal(disposition.projects[0].id, uuid(1));
  assert.equal(disposition.projects[1].id, null);
  await assert.rejects(importWithJournal(run, 'catholicCtt', async () => assert.fail('never retry an uncertain import')));
});

test('private artifacts are retained without backup; a matching final backup permits removal', async () => {
  const run = await setup();
  assert.equal(run.dir, hostedRunDir(run.id));
  assert.equal((await disposePrivateRun(run)).status, 'retained');
  assert.equal(await readFile(path.join(run.dir, 'credentials.json'), 'utf8'), 'synthetic-password');
  assert.equal((await disposePrivateRun({...run, verifyBackup: backup})).status, 'removed-after-backup');
  await assert.rejects(lstat(run.dir), {code: 'ENOENT'});
  assert.ok(await readFile(run.journal, 'utf8'), 'ownership journal survives removal');
});

for (const [name, verifyBackup] of Object.entries({
  missing: async () => null,
  mismatched: async ({sha256}) => ({run: '0'.repeat(32), sha256, verified: true}),
  stale: async ({run}) => ({run, sha256: '0'.repeat(64), verified: true}),
  failed: async () => { throw new Error('private backup error'); },
  changed: async request => {
    const proof = await backup(request);
    await writeFile(path.join(request.dir, 'late.json'), 'late synthetic artifact');
    return proof;
  },
})) test(`${name} backup proof retains private data`, async () => {
  const run = await setup();
  assert.equal((await disposePrivateRun({...run, verifyBackup})).status, 'retained');
  assert.equal(await readFile(path.join(run.dir, 'credentials.json'), 'utf8'), 'synthetic-password');
});

test('unsafe retention, symlinks and foreign directories are refused without deletion', async () => {
  const run = await setup();
  const neighbor = await setup();
  await assert.rejects(disposePrivateRun({...run, dir: neighbor.dir, verifyBackup: backup}));
  await symlink(path.join(neighbor.dir, 'credentials.json'), path.join(run.dir, 'link'));
  await assert.rejects(disposePrivateRun({...run, verifyBackup: backup}));
  assert.equal(await readFile(path.join(neighbor.dir, 'credentials.json'), 'utf8'), 'synthetic-password');
  const unsafe = await setup();
  await chmod(unsafe.dir, 0o755);
  await assert.rejects(disposePrivateRun({...unsafe, verifyBackup: backup}));
  await chmod(unsafe.dir, 0o700);
});

test('torn or mismatched journals never resolve resource disposition', async () => {
  const run = await setup();
  await writeFile(run.journal, '{broken', {flag: 'a'});
  await assert.rejects(projectDisposition(run));
  const other = await setup();
  await assert.rejects(projectDisposition({...other, journal: run.journal}));
});

test('hosted teardown makes no DELETE and retains auth; isolated teardown deletes exact IDs', async () => {
  const hosted = await setup();
  const calls = [];
  const owner = {delete: async url => { calls.push(url); return {status: () => 204}; }, dispose: async () => { calls.push('disposed'); }};
  await mkdir(path.join(hosted.dir, 'auth'), {mode: 0o700});
  await writeFile(path.join(hosted.dir, 'auth', 'owner.json'), 'synthetic', {mode: 0o600});
  const created = [uuid(1), uuid(2)];
  assert.deepEqual(await teardownRehearsal({run: {...hosted, rehearsal: {target: 'hosted'}}, owner, created}), []);
  assert.deepEqual(calls, ['disposed']);
  assert.equal(await readFile(path.join(hosted.dir, 'auth', 'owner.json'), 'utf8'), 'synthetic');
  // The test harness backs up its disposable directory before exercising isolated cleanup.
  await backup({run: hosted.id, dir: hosted.dir, sha256: await treeDigest(hosted.dir)});
  calls.length = 0;
  assert.deepEqual(await teardownRehearsal({run: {...hosted, rehearsal: {target: 'isolated'}}, owner, created}), []);
  assert.deepEqual(calls, created.map(id => `/api/v1/projects/${id}`).concat('disposed'));
  await assert.rejects(lstat(path.join(hosted.dir, 'auth')), {code: 'ENOENT'});
});
