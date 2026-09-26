import { randomBytes } from 'node:crypto';
import { copyFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT, RUNTIME_ROOT, privateDirectory, saveManifest } from './ownership.mjs';
import { prerequisites, copySource, reservePorts, compose, composeArgs, ownedCommand, baseEnv, getDockerEndpoint, docker } from './runtime.mjs';
import { expireDiagnostics, recordFailure, retainDiagnostics as retainFailureDiagnostics } from './diagnostics.mjs';
import { sanitizedEvidence } from './evidence.mjs';
import { cleanup } from './cleanup.mjs';
import { freshIdentityValues, writeRuntimeEnv } from './bootstrap-identity.mjs';
import { assertLaunch, apiModeFor, profileSpec, IDENTITY_SERVICES } from './auth-modes.mjs';
export function waitForAbort(signal) {
  if (signal.aborted) return Promise.reject(new Error('Interrupted'));
  return new Promise((_, reject) => {
    // A pending Promise alone does not keep Node alive after child handles are unref'd.
    const keepalive = setInterval(() => {}, 60_000);
    signal.addEventListener('abort', () => {
      clearInterval(keepalive);
      reject(new Error('Interrupted'));
    }, {once: true});
  });
}
export async function run({apiSource, lifecycleProbe = false, failAt, hold = false, retainDiagnostics = false, workflow, profile = 'baseline'} = {}) {
  // Each profile is a separate fresh stack (KTD1); the default remains the D06 baseline.
  assertLaunch({profile, failAt, lifecycleProbe});
  process.umask(0o077);
  await expireDiagnostics();
  const webSource = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  await prerequisites(apiSource, webSource);
  if (!lifecycleProbe && !workflow) throw new Error('Full-stack workflow is not installed; use --lifecycle-probe for U1 only');
  await privateDirectory(ROOT);
  const id = randomBytes(16).toString('hex');
  await privateDirectory(RUNTIME_ROOT);
  const dir = path.join(RUNTIME_ROOT, id);
  const manifestDir = path.join(ROOT, id);
  await privateDirectory(manifestDir);
  await privateDirectory(dir);
  const manifest = {version: 1, id, project: `ontokit-e2e-${id}`, uid: process.getuid(), processes: [], sources: {}, status: 'preparing', dockerEndpoint: getDockerEndpoint(), profile};
  await saveManifest(manifestDir, manifest);
  const controller = new AbortController();
  const ctx = {profile, failAt, signal: controller.signal, dir, manifestDir, manifest, env: {...baseEnv(), HOME: dir, TMPDIR: dir}};
  const file = path.join(manifestDir, 'manifest.json');
  const startedAt = new Date().toISOString();
  let workflowPassed = false;
  let reservation;
  let cleaning;
  let interrupted = false;
  const teardown = () => cleaning ||= cleanup(file);
  const signal = () => { interrupted = true; ctx.stopping = true; controller.abort(); process.exitCode = 130; };
  process.on('SIGINT', signal); process.on('SIGTERM', signal);
  console.log(`Isolated run ${id}; recovery manifest ${file}`);
  try {
    manifest.sources.api = await copySource(apiSource, path.join(dir, 'api'));
    if (ctx.stopping) throw new Error('Interrupted');
    manifest.sources.web = await copySource(webSource, path.join(dir, 'web'));
    if (ctx.stopping) throw new Error('Interrupted');
    await copyFile(path.join(webSource, 'e2e/compose.yaml'), path.join(dir, 'compose.yaml'));
    await copyFile(path.join(dir, 'api/deploy/init-db.dev.sh'), path.join(dir, 'init-db.sh'));
    if (ctx.stopping) throw new Error('Interrupted');
    reservation = await reservePorts(); manifest.ports = reservation.ports;
    const secret = () => randomBytes(24).toString('hex');
    ctx.values = {...freshIdentityValues(), RUN_ID: id, PROJECT: manifest.project, API_PORT: manifest.ports.api, IDENTITY_PORT: manifest.ports.identity, LOGIN_PORT: manifest.ports.login, WEB_PORT: manifest.ports.web, POSTGRES_PASSWORD: secret(), APP_DB_PASSWORD: secret(), IDENTITY_DB_PASSWORD: secret(), APP_SECRET: secret(), MINIO_USER: secret(), MINIO_PASSWORD: secret(),
      // KTD2: the API mode is a per-profile input; the gate later reads what actually runs.
      API_AUTH_MODE: apiModeFor(profile, failAt)};
    await writeRuntimeEnv(ctx);
    await saveManifest(manifestDir, manifest);
    manifest.status = 'building'; await saveManifest(manifestDir, manifest);
    await compose(ctx, 'build', 'api');
    await reservation.release(); reservation = null;
    manifest.status = 'starting-dependencies'; await saveManifest(manifestDir, manifest);
    await compose(ctx, 'up', '-d', '--wait', '--wait-timeout', '180', 'postgres', 'redis', 'minio');
    await ownedCommand(ctx, process.execPath, ['-e', 'process.exit(0)']);
    if (failAt === 'after-dependencies') throw new Error('Injected setup failure');
    manifest.status = 'migrating'; await saveManifest(manifestDir, manifest);
    await compose(ctx, 'run', '--no-deps', 'migrate');
    // Verify database revision set equals the selected source's complete heads.
    await compose(ctx, 'run', '--no-deps', 'migrate', 'python', '-c', 'import asyncio,asyncpg,os; from alembic.config import Config; from alembic.script import ScriptDirectory\nasync def verify():\n c=await asyncpg.connect(os.environ["DATABASE_URL"].replace("+asyncpg","")); rows=await c.fetch("select version_num from alembic_version"); assert {r[0] for r in rows} == set(ScriptDirectory.from_config(Config("alembic.ini")).get_heads()); await c.close()\nasyncio.run(verify())');
    manifest.migrationHeads = docker(composeArgs(ctx, 'exec', '-T', 'postgres', 'psql', '-U', 'ontokit', '-d', 'ontokit', '-At', '-c', 'select version_num from alembic_version order by version_num')).split('\n').filter(Boolean);
    if (!manifest.migrationHeads.length || manifest.migrationHeads.some(h => !/^[a-zA-Z0-9_]{1,100}$/.test(h))) throw new Error('Invalid migration evidence');
    await compose(ctx, 'up', '-d', '--no-deps', 'api', 'worker');
    manifest.status = 'dependencies-migrated'; await saveManifest(manifestDir, manifest);
    console.log('Dependencies provisioned; migrations verified; API and worker started (authentication readiness is a separate gate)');
    if (ctx.stopping) throw new Error('Interrupted');
    if (hold) await waitForAbort(controller.signal);
    if (workflow) await workflow(ctx);
    if (failAt === 'after-workflow') throw new Error('Injected workflow failure');
    const containers = docker(['ps', '-aq', '--filter', `label=io.ontokit.e2e.run=${id}`]).split('\n').filter(Boolean);
    manifest.evidenceImages = containers.map(container => {
      const [labelJson, imageId, reference] = docker(['inspect', '--format', '{{json .Config.Labels}}\n{{.Image}}\n{{.Config.Image}}', container]).split('\n');
      const labels = JSON.parse(labelJson);
      if (labels['com.docker.compose.project'] !== manifest.project) throw new Error('Invalid image evidence ownership');
      return {service: labels['com.docker.compose.service'], id: imageId, reference};
    });
    workflowPassed = !!manifest.tests;
    await saveManifest(manifestDir, manifest);
  } catch (error) {
    try { await recordFailure(ctx, error); } catch { console.error('Private failure capture failed; cleanup will continue'); }
    console.error(`Run ${id} failed during ${manifest.status}; private artifacts will be removed`);
    if (retainDiagnostics) {
      if (!ctx.stopping) {
        const services = [...(profileSpec(profile).identity ? IDENTITY_SERVICES : []), 'api', 'worker'];
        try { await ownedCommand(ctx, 'docker', composeArgs(ctx, 'logs', '--no-color', '--tail=80', ...services), {timeout: 15_000}); }
        catch { console.error('Private service log capture failed; cleanup will continue'); }
      }
      try { await retainFailureDiagnostics(ctx); } catch { console.error('Private diagnostic retention failed; cleanup will continue'); }
    }
    throw error;
  } finally {
    if (reservation) await reservation.release();
    let cleanupResult = 'failed';
    try { await teardown(); cleanupResult = 'complete'; console.log(`Cleanup complete for ${id}`); }
    catch { console.error(`Cleanup failed; recovery: node scripts/e2e/cleanup.mjs ${file}`); throw new Error('Cleanup failed'); }
    finally {
      process.off('SIGINT', signal); process.off('SIGTERM', signal);
      // Allowlist data in memory before cleanup removes the recovery manifest and private reports.
      const receipt = sanitizedEvidence(manifest, {cleanup: cleanupResult, workflowPassed: workflowPassed && !interrupted, startedAt, finishedAt: new Date().toISOString()});
      const receipts = path.join(ROOT, 'receipts');
      await privateDirectory(receipts);
      await writeFile(path.join(receipts, `${id}.json`), JSON.stringify(receipt, null, 2) + '\n', {mode: 0o600, flag: 'wx'});
      console.log(`Sanitized run receipt: ${path.join(receipts, `${id}.json`)}`);
      if (workflowPassed && !interrupted && cleanupResult === 'complete' && !receipt.acceptedRun) throw new Error('Full-stack evidence incomplete');
    }
  }
  if (interrupted) throw new Error('Interrupted');
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const value = flag => args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined;
  const workflow = args.includes('--lifecycle-probe') ? undefined : (await import('./full-stack.mjs')).fullStack;
  run({workflow, profile: args.includes('--profile') ? value('--profile') : 'baseline', apiSource: value('--api-source'), lifecycleProbe: args.includes('--lifecycle-probe'), failAt: args.includes('--fail-at') ? value('--fail-at') ?? '' : undefined, hold: args.includes('--hold'), retainDiagnostics: args.includes('--retain-diagnostics')}).catch(error => {
    const known = /^(An explicit|Required source file missing:|Local Docker|Only a local|At least 8|Full-stack workflow|Owned command|Injected |Cleanup failed|Interrupted|Unknown E2E profile|Unknown E2E failure point|Lifecycle |Clock override|Auth clock control rejected|Authentication mode disagreement|Seed fixture|Provider-less)/.test(error.message);
    console.error(known ? error.message : 'Isolated lifecycle failed; inspect the sanitized phase above.');
    console.error('No full-stack acceptance claimed.'); process.exitCode ||= 1;});
}
