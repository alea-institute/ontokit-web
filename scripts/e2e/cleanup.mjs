import { rm, lstat, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT, RUNTIME_ROOT, privateDirectory, loadManifest, ownsResource, processIdentity, sameProcess } from './ownership.mjs';
import { docker, setDockerEndpoint } from './runtime.mjs';
import { purgeSeededForRecovery } from './seed-fixtures.mjs';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function markedProcesses(id) {
  const found = [];
  for (const entry of await readdir('/proc')) {
    if (!/^\d+$/.test(entry) || Number(entry) <= 1) continue;
    try {
      if ((await lstat(`/proc/${entry}`)).uid !== process.getuid()) continue;
      const environment = await readFile(`/proc/${entry}/environ`, 'utf8');
      if (!environment.split('\0').includes(`ONTOKIT_E2E_RUN=${id}`)) continue;
      const identity = await processIdentity(Number(entry));
      if (identity) found.push(identity);
    } catch (error) {
      if (!['ENOENT', 'ESRCH', 'EACCES'].includes(error.code)) throw error;
    }
  }
  return found;
}
async function stopMarkedDescendants(id) {
  // Descendants can become session leaders or be reparented after their command exits.
  // The inherited run marker survives both; each PID identity is rechecked before signaling.
  for (const signal of ['SIGTERM', 'SIGKILL', 'SIGKILL']) {
    for (const record of await markedProcesses(id)) {
      if (sameProcess(record, await processIdentity(record.pid))) {
        try { process.kill(record.pid, signal); } catch (error) { if (error.code !== 'ESRCH') throw error; }
      }
    }
    await pause(100);
  }
  if ((await markedProcesses(id)).length) throw new Error('Owned host processes remain after cleanup');
}
export async function cleanupProcesses(manifest) {
  const boot = (await readFile('/proc/sys/kernel/random/boot_id', 'utf8')).trim();
  for (const record of manifest.processes) {
    if (record.boot !== boot) continue;
    const current = await processIdentity(record.pid);
    if (!current) {
      try { process.kill(-record.pid, 0); } catch (e) { if (e.code === 'ESRCH') continue; throw e; }
      throw new Error('Process group remains without its verified leader; refusing cleanup');
    }
    // An obsolete record cannot authorize signals to its replacement, but does not
    // block cleanup of descendants and resources with independently verified ownership.
    if (!sameProcess(record, current)) continue;
    const environment = await readFile(`/proc/${record.pid}/environ`, 'utf8');
    const command = await readFile(`/proc/${record.pid}/cmdline`, 'utf8');
    if (!environment.split('\0').includes(`ONTOKIT_E2E_RUN=${manifest.id}`) || !command.split('\0').includes(fileURLToPath(new URL('./supervisor.mjs', import.meta.url)))) throw new Error('Host process is not a run supervisor; refusing cleanup');
    if (!sameProcess(record, await processIdentity(record.pid))) continue;
    process.kill(-record.pid, 'SIGTERM');
    await pause(500);
    if (sameProcess(record, await processIdentity(record.pid))) process.kill(-record.pid, 'SIGKILL');
  }
  await stopMarkedDescendants(manifest.id);
}
/**
 * D09 seeded fixtures (KTD4): delete this run's recorded project IDs, by exact ID, tag
 * and owner, through its own still-running API container. Label-verified volume removal
 * below remains authoritative, so an unavailable container never blocks recovery; an
 * ownership mismatch still refuses cleanup.
 */
export function recoverSeededFixtures(manifest, {docker: run = docker, log = console.log} = {}) {
  let result;
  try { result = purgeSeededForRecovery(manifest, {docker: run}); }
  catch (error) {
    if (/ownership mismatch|Seed record invalid/.test(error.message)) throw error;
    log('Seeded fixture purge unavailable; run-labelled volume removal removes them');
    return 'deferred-to-volume-removal';
  }
  if (!result) return manifest.seed?.purged ? 'already-purged' : manifest.seed?.fixtures ? 'deferred-to-volume-removal' : 'none';
  log(`Seeded fixtures purged by exact ID (${result.deleted})`);
  return 'purged';
}
export async function cleanup(file) {
  // A repeated cleanup succeeds only for a syntactically confined, already absent run.
  if (path.dirname(path.dirname(file)) !== ROOT || path.basename(file) !== 'manifest.json' || !/^[a-f0-9]{32}$/.test(path.basename(path.dirname(file)))) throw new Error('Invalid recovery path');
  try { await lstat(path.dirname(file)); } catch (e) { if (e.code === 'ENOENT') return; throw e; }
  const manifest = await loadManifest(file);
  setDockerEndpoint(manifest.dockerEndpoint);
  await cleanupProcesses(manifest);
  recoverSeededFixtures(manifest);
  // Enumerate narrowly, inspect immutable IDs, and require two independent labels.
  for (const kind of ['container', 'network', 'volume', 'image']) {
    const args = kind === 'container' ? ['ps', '-aq'] : [kind, 'ls', '-q'];
    const ids = [...new Set(docker([...args, '--filter', `label=io.ontokit.e2e.run=${manifest.id}`]).split('\n').filter(Boolean))];
    for (const id of ids) {
      const info = JSON.parse(docker([kind, 'inspect', id]))[0];
      const labels = kind === 'container' || kind === 'image' ? info.Config?.Labels : info.Labels;
      if (!ownsResource(manifest, labels)) throw new Error('Docker ownership mismatch; refusing cleanup');
      if (kind === 'image') {
        const tags = info.RepoTags || [];
        if (tags.some(tag => !tag.startsWith(`${manifest.project}/`))) throw new Error('Run image has foreign tags; refusing cleanup');
        docker(['image', 'rm', ...tags]);
      } else docker([kind, 'rm', ...(kind === 'container' ? ['-f'] : []), id]);
    }
  }
  for (const kind of ['container', 'network', 'volume', 'image']) {
    const args = kind === 'container' ? ['ps', '-aq'] : [kind, 'ls', '-q'];
    if (docker([...args, '--filter', `label=io.ontokit.e2e.run=${manifest.id}`])) throw new Error('Owned Docker resources remain after cleanup');
  }
  await privateDirectory(RUNTIME_ROOT);
  const runtime = path.join(RUNTIME_ROOT, manifest.id);
  try { await lstat(runtime); await privateDirectory(runtime); await rm(runtime, {recursive: true, force: true}); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  await rm(path.dirname(file), {recursive: true, force: true});
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  cleanup(path.resolve(process.argv[2] || '')).then(() => console.log('Owned resources removed'), () => {console.error('Cleanup failed; preserve manifest for explicit recovery'); process.exitCode = 1;});
}
