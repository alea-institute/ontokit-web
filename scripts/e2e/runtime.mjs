import { createHash } from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { open, mkdir, copyFile, lstat, statfs, readFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { safeSourcePath, processIdentity, saveManifest } from './ownership.mjs';
let dockerEndpoint = 'unix:///var/run/docker.sock';
export function setDockerEndpoint(endpoint) {
  if (typeof endpoint !== 'string' || !endpoint.startsWith('unix:///') || endpoint.includes('\n')) throw new Error('Only a local Unix Docker endpoint is supported');
  dockerEndpoint = endpoint;
}
export const getDockerEndpoint = () => dockerEndpoint;
export const baseEnv = () => ({PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin', LANG: 'C.UTF-8', DOCKER_HOST: dockerEndpoint});
export function docker(args) { return execFileSync('docker', args, {env: baseEnv(), encoding: 'utf8', timeout: 60_000, stdio: ['ignore', 'pipe', 'pipe']}).trim(); }
export async function prerequisites(api, web) {
  if (process.platform !== 'linux' || !api || !path.isAbsolute(api)) throw new Error('An explicit absolute --api-source checkout is required on Linux');
  for (const [dir, file] of [[api, 'pyproject.toml'], [api, 'Dockerfile'], [web, 'package-lock.json']]) {
    try { await lstat(path.join(dir, file)); } catch { throw new Error(`Required source file missing: ${file}`); }
  }
  const connectionEnv = {PATH: process.env.PATH, HOME: process.env.HOME, ...(process.env.DOCKER_CONTEXT ? {DOCKER_CONTEXT: process.env.DOCKER_CONTEXT} : {})};
  dockerEndpoint = process.env.DOCKER_HOST || execFileSync('docker', ['context', 'inspect', '--format', '{{.Endpoints.docker.Host}}'], {env: connectionEnv, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']}).trim();
  if (!dockerEndpoint.startsWith('unix:///')) throw new Error('Only a local Unix Docker endpoint is supported');
  try { docker(['info', '--format', '{{.ServerVersion}}']); docker(['compose', 'version']); } catch { throw new Error('Local Docker daemon or Compose v2 unavailable'); }
  const disk = await statfs('/tmp');
  if (disk.bavail * disk.bsize < 8 * 1024 ** 3) throw new Error('At least 8 GiB free build space is required');
}
export async function copySource(source, dest) {
  await mkdir(dest, {recursive: true, mode: 0o700});
  const hash = createHash('sha256');
  const files = execFileSync('git', ['ls-files', '-z'], {cwd: source, encoding: 'utf8'}).split('\0').filter(Boolean).sort();
  for (const name of files) {
    if (!safeSourcePath(name)) continue;
    const from = path.join(source, name);
    if (['AGENTS.md', 'CLAUDE.md', 'GEMINI.md'].includes(name) && (await lstat(from)).isSymbolicLink()) continue;
    // Reject symlinks at every path component, including tracked directories.
    let current = source;
    for (const part of name.split('/')) { current = path.join(current, part); if ((await lstat(current)).isSymbolicLink()) throw new Error('Source symlinks are not supported'); }
    if (!(await lstat(from)).isFile()) throw new Error('Source entry is not a regular file');
    await mkdir(path.dirname(path.join(dest, name)), {recursive: true, mode: 0o700});
    await copyFile(from, path.join(dest, name));
    const bytes = await readFile(path.join(dest, name));
    hash.update(`${Buffer.byteLength(name)}:`).update(name).update(`${bytes.length}:`).update(bytes);
  }
  return {revision: execFileSync('git', ['rev-parse', 'HEAD'], {cwd: source, encoding: 'utf8'}).trim(), sha256: hash.digest('hex')};
}
export async function reservePorts() {
  const servers = [];
  const ports = {};
  try {
    for (const name of ['api', 'identity', 'login', 'web']) {
      const server = createServer(); servers.push(server);
      await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
      ports[name] = server.address().port;
    }
    return {ports, release: () => Promise.all(servers.map(s => new Promise(resolve => s.close(resolve))))};
  } catch (e) { for (const s of servers) s.close(); throw e; }
}
export async function ownedCommand(ctx, command, args, {cwd = ctx.dir, env = ctx.env, timeout = 600_000} = {}) {
  if (ctx.stopping) throw new Error('Run interrupted');
  const log = await open(path.join(ctx.dir, 'private.log'), 'a', 0o600);
  const supervisor = spawn(process.execPath, [fileURLToPath(new URL('./supervisor.mjs', import.meta.url))], {detached: true, env: {...baseEnv(), ONTOKIT_E2E_RUN: ctx.manifest.id}, stdio: ['ignore', log.fd, log.fd, 'ipc']});
  const ready = new Promise((resolve, reject) => {
    const finish = error => {
      clearTimeout(timer);
      supervisor.off('message', onReady); supervisor.off('error', onError); supervisor.off('exit', onExit);
      if (error) reject(error); else resolve();
    };
    const onReady = message => finish(message.ready === true ? null : new Error('Owned supervisor handshake invalid'));
    const onError = () => finish(new Error('Owned supervisor failed to start'));
    const onExit = () => finish(new Error('Owned supervisor exited before ready'));
    const timer = setTimeout(() => finish(new Error('Owned supervisor handshake timed out')), 10_000);
    supervisor.once('message', onReady); supervisor.once('error', onError); supervisor.once('exit', onExit);
  });
  try {
    await ready;
    const identity = await processIdentity(supervisor.pid);
    if (!identity) throw new Error('Owned supervisor exited before registration');
    ctx.manifest.processes.push(identity);
    await saveManifest(ctx.manifestDir || ctx.dir, ctx.manifest);
  } catch (error) {
    if (supervisor.connected) supervisor.disconnect();
    supervisor.kill('SIGKILL');
    throw error;
  } finally { await log.close(); }
  supervisor.unref(); supervisor.channel.unref();
  return await new Promise((resolve, reject) => {
    const finish = error => {
      clearTimeout(timer);
      ctx.signal?.removeEventListener('abort', onAbort);
      supervisor.off('message', onResult); supervisor.off('error', onError); supervisor.off('exit', onExit);
      if (error) reject(error); else resolve();
    };
    const onAbort = () => finish(new Error('Run interrupted'));
    const onError = () => finish(new Error('Owned supervisor communication failed'));
    const onExit = () => finish(new Error('Owned supervisor exited during command'));
    const onResult = ({code}) => finish(code === 0 ? null : new Error(`Owned command failed (${code})`));
    const timer = setTimeout(() => finish(new Error('Owned command timed out')), timeout);
    ctx.signal?.addEventListener('abort', onAbort, {once: true});
    supervisor.once('message', onResult); supervisor.once('error', onError); supervisor.once('exit', onExit);
    if (ctx.stopping) { onAbort(); return; }
    supervisor.send({command, args, cwd, env: {...env, ONTOKIT_E2E_RUN: ctx.manifest.id}}, error => { if (error) onError(); });
  });
}
export function composeArgs(ctx, ...args) { return ['compose', '--project-name', ctx.manifest.project, '--env-file', path.join(ctx.dir, 'runtime.env'), '-f', path.join(ctx.dir, 'compose.yaml'), ...args]; }
export async function compose(ctx, ...args) { return ownedCommand(ctx, 'docker', composeArgs(ctx, ...args)); }
