import { randomBytes } from 'node:crypto';
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { bootstrapIdentity, readyHttp } from './bootstrap-identity.mjs';
import { ownedCommand } from './runtime.mjs';
import { validateReport } from './evidence.mjs';
import { saveManifest } from './ownership.mjs';

export async function fullStack(ctx) {
  const phase = async value => { ctx.manifest.status = value; await saveManifest(ctx.manifestDir, ctx.manifest); console.log(`Isolated stack phase: ${value}`); };
  await phase('bootstrapping-identity');
  const identity = await bootstrapIdentity(ctx);
  await readyHttp(`${identity.api}/health`, {signal: ctx.signal});
  const webSource = path.join(ctx.dir, 'web');
  const browserPath = path.join(ctx.dir, 'browsers');
  await mkdir(browserPath, {mode: 0o700});
  const env = {
    ...ctx.env, NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1', AUTH_MODE: 'required', AUTH_TRUST_HOST: 'true',
    ZITADEL_ISSUER: identity.issuer, ZITADEL_CLIENT_ID: identity.clientId, ZITADEL_CLIENT_SECRET: identity.clientSecret,
    NEXTAUTH_URL: identity.web, NEXTAUTH_SECRET: randomBytes(32).toString('hex'),
    NEXT_PUBLIC_API_URL: identity.api, NEXT_PUBLIC_WS_URL: identity.api.replace('http:', 'ws:'),
    PLAYWRIGHT_BROWSERS_PATH: browserPath, npm_config_cache: path.join(ctx.dir, 'npm-cache'),
  };
  await phase('building-web');
  // Install from the copied lock; no ancestor node_modules or developer .env can participate.
  await ownedCommand(ctx, 'npm', ['ci', '--include=dev', '--no-audit', '--no-fund'], {cwd: webSource, env, timeout: 600_000});
  await ownedCommand(ctx, process.execPath, ['node_modules/@playwright/test/cli.js', 'install', 'chromium'], {cwd: webSource, env, timeout: 600_000});
  await ownedCommand(ctx, 'npm', ['run', 'build'], {cwd: webSource, env, timeout: 600_000});
  await phase('starting-web');
  const server = ownedCommand(ctx, process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(ctx.manifest.ports.web)], {cwd: webSource, env, timeout: 3_600_000})
    .then(() => { throw new Error('Owned web server exited unexpectedly'); });
  // Attach immediately: startup failure must never become an unhandled rejection.
  server.catch(() => {});
  await Promise.race([server, readyHttp(`${identity.web}/auth/signin`, {signal: ctx.signal})]);
  const runFile = path.join(ctx.dir, 'playwright-run.json');
  await writeFile(runFile, JSON.stringify({id: ctx.manifest.id, dir: ctx.dir, issuer: identity.issuer, login: identity.login, web: identity.web, api: identity.api, users: identity.users, ordinaryUserPolicyVerified: true}), {mode: 0o600});
  await phase('testing');
  await Promise.race([server, ownedCommand(ctx, process.execPath, ['node_modules/@playwright/test/cli.js', 'test'], {
    cwd: webSource, env: {...env, ONTOKIT_E2E_CONFIG: runFile}, timeout: 900_000,
  })]);
  const report = JSON.parse(await readFile(path.join(ctx.dir, 'playwright-report.json'), 'utf8'));
  ctx.manifest.tests = validateReport(report);
  console.log(`Verified browser tests: ${report.stats.expected} passed, ${report.stats.skipped} skipped, ${report.stats.unexpected} failed`);
  await phase('workflow-verified');
}
