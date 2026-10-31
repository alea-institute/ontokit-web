import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, mkdir, open, readdir, realpath, rm } from 'node:fs/promises';
import path from 'node:path';
import { ROOT, privateDirectory } from '../e2e/ownership.mjs';

export const RETAINED_ROOT = path.join(ROOT, 'retained');
const KEYS = ['folio', 'catholicCtt'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const fail = () => { throw new Error('Hosted resource disposition could not be verified'); };
const runRoot = id => {
  if (typeof id !== 'string' || !/^[a-f0-9]{32}$/.test(id)) fail();
  return path.join(RETAINED_ROOT, id);
};
export const hostedRunDir = id => path.join(runRoot(id), 'private');
const journalPath = id => path.join(runRoot(id), 'ownership.jsonl');
const marker = (id, key) => `ontokit-e2e-run:${id}:rehearsal:${key}`;

async function checkedDirectory(dir) {
  const stat = await lstat(dir);
  if (!stat.isDirectory() || stat.isSymbolicLink() || stat.uid !== process.getuid() || (stat.mode & 0o077) || await realpath(dir) !== dir) fail();
}
async function checkRun({id, dir, journal = journalPath(id)}) {
  if (dir !== hostedRunDir(id) || journal !== journalPath(id)) fail();
  for (const directory of [ROOT, RETAINED_ROOT, runRoot(id), dir]) await checkedDirectory(directory);
}
async function journalFile(run, flags) {
  await checkRun(run);
  const handle = await open(journalPath(run.id), flags | constants.O_NOFOLLOW, 0o600);
  const stat = await handle.stat();
  if (!stat.isFile() || stat.uid !== process.getuid() || (stat.mode & 0o077) || stat.nlink !== 1) {
    await handle.close(); fail();
  }
  return handle;
}
async function append(run, event) {
  const handle = await journalFile(run, constants.O_WRONLY | constants.O_APPEND);
  try { await handle.writeFile(`${JSON.stringify(event)}\n`); await handle.sync(); }
  finally { await handle.close(); }
}
export async function createHostedRun(id) {
  for (const dir of [ROOT, RETAINED_ROOT]) await privateDirectory(dir);
  await mkdir(runRoot(id), {mode: 0o700});
  const dir = hostedRunDir(id);
  await mkdir(dir, {mode: 0o700});
  const run = {id, dir, journal: journalPath(id)};
  const handle = await journalFile(run, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL);
  try { await handle.writeFile(`${JSON.stringify({version: 1, run: id})}\n`); await handle.sync(); }
  finally { await handle.close(); }
  return run;
}

/** Only fixed source names, derived markers and validated project IDs leave the journal. */
export async function projectDisposition(run) {
  const handle = await journalFile(run, constants.O_RDONLY);
  let events;
  try { events = (await handle.readFile('utf8')).trimEnd().split('\n').map(line => JSON.parse(line)); }
  finally { await handle.close(); }
  if (events[0]?.version !== 1 || events[0]?.run !== run.id) fail();
  const projects = [];
  for (const event of events.slice(1)) {
    if (!KEYS.includes(event.key) || event.run !== run.id || event.marker !== marker(run.id, event.key)) fail();
    const existing = projects.find(p => p.source === event.key);
    if (event.event === 'import-started' && !existing) {
      projects.push({source: event.key, marker: marker(run.id, event.key), id: null, state: 'uncertain'});
    } else if (event.event === 'import-created' && existing?.state === 'uncertain' && UUID.test(event.id) && !projects.some(p => p.id === event.id)) {
      existing.id = event.id;
      existing.state = 'retained';
    } else fail();
  }
  return {status: projects.length === 2 && projects.every(p => p.state === 'retained') ? 'retained' : 'unresolved', projects};
}

/** The durable attempt precedes the HTTP request; a lost response stays uncertain. */
export async function importWithJournal(run, key, operation) {
  if (!KEYS.includes(key) || (await projectDisposition(run)).projects.some(p => p.source === key)) fail();
  const identity = {run: run.id, key, marker: marker(run.id, key)};
  await append(run, {...identity, event: 'import-started'});
  const project = await operation();
  if (!project || !UUID.test(project.id)) fail();
  await append(run, {...identity, event: 'import-created', id: project.id});
  return project;
}

/** Fingerprint final private artifacts without returning their names or contents. */
export async function treeDigest(dir) {
  await checkedDirectory(dir);
  const hash = createHash('sha256');
  async function visit(file, relative) {
    const stat = await lstat(file);
    if (stat.isSymbolicLink() || stat.uid !== process.getuid() || (stat.mode & 0o022)) fail();
    hash.update(JSON.stringify([relative, stat.mode & 0o777]));
    if (stat.isDirectory()) {
      hash.update('directory');
      for (const name of (await readdir(file)).sort()) await visit(path.join(file, name), path.join(relative, name));
    } else if (stat.isFile() && stat.nlink === 1) {
      const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
      try {
        const contents = createHash('sha256');
        for await (const chunk of handle.createReadStream({autoClose: false})) contents.update(chunk);
        hash.update(contents.digest());
      }
      finally { await handle.close(); }
    } else fail();
  }
  await visit(dir, '');
  return hash.digest('hex');
}

/** No production backup adapter is configured: the CLI always chooses retention.
 * An authorized controller may supply a verifier after all artifact writers have exited.
 * @param {{id: string, dir: string, journal?: string, verifyBackup?: Function}} run
 */
export async function disposePrivateRun({verifyBackup, ...run}) {
  await checkRun(run);
  const sha256 = await treeDigest(run.dir);
  let proof;
  try { proof = await verifyBackup?.({run: run.id, dir: run.dir, sha256}); } catch { proof = null; }
  const current = await treeDigest(run.dir);
  if (proof?.verified === true && proof.run === run.id && proof.sha256 === sha256 && current === sha256) {
    await rm(run.dir, {recursive: true});
    return {status: 'removed-after-backup', verified: true};
  }
  return {status: 'retained', verified: true};
}

/** Keep the isolated launcher's exact-ID teardown; hosted runs never issue DELETE. */
export async function teardownRehearsal({run, owner, created}) {
  const failures = [];
  try {
    if (run.rehearsal.target === 'hosted') {
      await checkRun(run);
      await treeDigest(run.dir);
    } else {
      if (owner) for (const id of created) {
        try {
          const status = (await owner.delete(`/api/v1/projects/${id}`)).status();
          if (![204, 404].includes(status)) failures.push(`${id}: ${status}`);
        } catch { failures.push(`${id}: request failed`); }
      }
      await rm(path.join(run.dir, 'auth'), {recursive: true, force: true});
    }
  } finally { await owner?.dispose(); }
  return failures;
}
