import { lstat, readFile, realpath, mkdir, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
export const ROOT = fileURLToPath(new URL('../../.e2e-runs', import.meta.url));
export const RUNTIME_ROOT = `/tmp/ontokit-e2e-${process.getuid()}`;
export function validateManifest(m) {
  if (m.version !== 1 || !/^[a-f0-9]{32}$/.test(m.id) || m.project !== `ontokit-e2e-${m.id}` || m.uid !== process.getuid() || !Array.isArray(m.processes)) throw new Error('Invalid recovery identity');
  for (const p of m.processes) if (!Number.isInteger(p.pid) || p.pid <= 1 || p.group !== p.pid || !/^\d+$/.test(p.start) || typeof p.boot !== 'string') throw new Error('Invalid process identity');
  return m;
}
export function ownsResource(m, labels = {}) {
  return labels['io.ontokit.e2e.run'] === m.id && labels['com.docker.compose.project'] === m.project;
}
export function sameProcess(a, b) { return !!b && ['pid', 'start', 'boot', 'group'].every(k => a[k] === b[k]); }
export function safeSourcePath(name) {
  return !path.isAbsolute(name) && !name.split('/').some(p => ['..', '.git', '.next', 'node_modules', '.auth', 'playwright-report', 'test-results', '.worktrees', '.venv', '__pycache__', '.npmrc', '.pypirc'].includes(p) || p.startsWith('.env') || /\.(pem|key|pat)$/.test(p));
}
export async function privateDirectory(dir) {
  await mkdir(dir, {recursive: true, mode: 0o700});
  const s = await lstat(dir);
  if (!s.isDirectory() || s.isSymbolicLink() || s.uid !== process.getuid() || (s.mode & 0o077) || await realpath(dir) !== dir) throw new Error('Unsafe private directory');
}
export async function loadManifest(file) {
  if (path.dirname(path.dirname(file)) !== ROOT || path.basename(file) !== 'manifest.json') throw new Error('Recovery path outside private root');
  await privateDirectory(ROOT);
  await privateDirectory(path.dirname(file));
  const s = await lstat(file);
  if (!s.isFile() || s.isSymbolicLink() || s.uid !== process.getuid() || (s.mode & 0o077)) throw new Error('Unsafe recovery manifest');
  const m = validateManifest(JSON.parse(await readFile(file, 'utf8')));
  if (path.basename(path.dirname(file)) !== m.id) throw new Error('Recovery directory mismatch');
  return m;
}
export async function saveManifest(dir, manifest) {
  await writeFile(path.join(dir, 'manifest.next'), JSON.stringify(manifest, null, 2), {mode: 0o600});
  await rename(path.join(dir, 'manifest.next'), path.join(dir, 'manifest.json'));
}
export async function processIdentity(pid) {
  try {
    const stat = await readFile(`/proc/${pid}/stat`, 'utf8');
    const fields = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
    return {pid, group: Number(fields[2]), start: fields[19], boot: (await readFile('/proc/sys/kernel/random/boot_id', 'utf8')).trim()};
  } catch (e) { if (e.code === 'ENOENT') return null; throw e; }
}
