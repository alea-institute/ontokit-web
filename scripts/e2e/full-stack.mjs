import { randomBytes } from 'node:crypto';
import { writeFile, mkdir, readFile, copyFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { bootstrapIdentity, readyHttp } from './bootstrap-identity.mjs';
import { ownedCommand } from './runtime.mjs';
import { validateReport } from './evidence.mjs';
import { saveManifest } from './ownership.mjs';
import { assertProfile } from './bootstrap-identity.mjs';
import { clock, clockPreflight, nextServerEnv, assertNoClockOverride, validateSpecimen, LIFECYCLE_GRACE_SECONDS, AUTHJS_VERIFIER_TOLERANCE_SECONDS, AUTHJS_SESSION_MAX_AGE_SECONDS } from './auth-lifecycle.mjs';

export async function fullStack(ctx) {
  const profile = assertProfile(ctx.profile ?? 'baseline');
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
  assertNoClockOverride(env);
  let serverEnv = env;
  if (profile === 'lifecycle') {
    // KTD3: only the owned Next process preloads the private clock copy, at zero offset.
    const preload = path.join(ctx.dir, 'auth-clock.mjs');
    await copyFile(fileURLToPath(new URL('./auth-clock.mjs', import.meta.url)), preload);
    clock.writeControlSync(ctx.manifest.id, 0);
    serverEnv = nextServerEnv(env, preload);
  }
  const server = ownedCommand(ctx, process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(ctx.manifest.ports.web)], {cwd: webSource, env: serverEnv, timeout: 3_600_000})
    .then(() => { throw new Error('Owned web server exited unexpectedly'); });
  // Attach immediately: startup failure must never become an unhandled rejection.
  server.catch(() => {});
  await Promise.race([server, readyHttp(`${identity.web}/auth/signin`, {signal: ctx.signal})]);
  const runFile = path.join(ctx.dir, 'playwright-run.json');
  const runConfig = {profile, id: ctx.manifest.id, dir: ctx.dir, issuer: identity.issuer, login: identity.login, web: identity.web, api: identity.api, users: identity.users, ordinaryUserPolicyVerified: true};
  if (profile === 'lifecycle') {
    await Promise.race([server, lifecyclePreflight(ctx, {identity, env, webSource, runFile, runConfig, phase})]);
    // U3: the lifecycle project runs only auth-lifecycle.spec.ts against this stack.
    // Playwright never receives the clock preload; the spec writes the private control.
    await phase('testing-lifecycle');
    await Promise.race([server, ownedCommand(ctx, process.execPath, ['node_modules/@playwright/test/cli.js', 'test'], {
      cwd: webSource, env: {...assertNoClockOverride(env), ONTOKIT_E2E_CONFIG: runFile}, timeout: 1_800_000,
    })]);
    const report = JSON.parse(await readFile(path.join(ctx.dir, 'playwright-report.json'), 'utf8'));
    // U4: the fixed lifecycle inventory, per-case allowlisted evidence and clock labels
    // are mandatory; the baseline inventory can never satisfy this profile or vice versa.
    const tests = validateReport(report, {profile});
    if (!ctx.manifest.lifecycle) throw new Error('Lifecycle preflight evidence missing');
    ctx.manifest.tests = tests;
    for (const c of tests.cases) console.log(`Lifecycle evidence [${c.clock}] ${c.title}: ${JSON.stringify(c.evidence)}`);
    console.log(`Verified lifecycle browser tests: ${tests.passed} passed, 0 skipped, 0 failed; controlled-clock case: ${tests.clockControlledCases.join('; ')}`);
    await phase('lifecycle-workflow-verified');
    return;
  }
  await writeFile(runFile, JSON.stringify(runConfig), {mode: 0o600});
  await phase('testing');
  await Promise.race([server, ownedCommand(ctx, process.execPath, ['node_modules/@playwright/test/cli.js', 'test'], {
    cwd: webSource, env: {...env, ONTOKIT_E2E_CONFIG: runFile}, timeout: 900_000,
  })]);
  const report = JSON.parse(await readFile(path.join(ctx.dir, 'playwright-report.json'), 'utf8'));
  ctx.manifest.tests = validateReport(report, {profile});
  console.log(`Verified browser tests: ${report.stats.expected} passed, ${report.stats.skipped} skipped, ${report.stats.unexpected} failed`);
  await phase('workflow-verified');
}

async function lifecyclePreflight(ctx, {identity, env, webSource, runFile, runConfig, phase}) {
  await phase('lifecycle-preflight');
  const lifecycle = {
    lifetimes: identity.lifetimes, graceSeconds: LIFECYCLE_GRACE_SECONDS,
    verifierToleranceSeconds: AUTHJS_VERIFIER_TOLERANCE_SECONDS, sessionMaxAgeSeconds: AUTHJS_SESSION_MAX_AGE_SECONDS,
    clockControl: clock.controlPath(ctx.manifest.id), maxClockOffsetMs: clock.MAX_OFFSET_MS, clockPreflightVerified: false,
  };
  // The sign-in child reads this private config; it is rewritten as verified only after the preflight.
  await writeFile(runFile, JSON.stringify({...runConfig, lifecycle}), {mode: 0o600});
  const specimenFile = path.join(ctx.dir, 'lifecycle-specimen.json');
  try {
    await ownedCommand(ctx, process.execPath, [fileURLToPath(new URL('./lifecycle-signin.mjs', import.meta.url)), runFile, specimenFile], {cwd: webSource, env, timeout: 180_000});
    const specimen = JSON.parse(await readFile(specimenFile, 'utf8'));
    validateSpecimen(specimen);
    const observed = specimen.observedAccessTokenLifetimeSeconds;
    if (!Number.isSafeInteger(observed) || Math.abs(observed - identity.lifetimes.accessTokenLifetime) > 1) throw new Error('Lifecycle provider did not issue the configured access-token lifetime');
    const preflight = await clockPreflight({
      web: identity.web, specimen, signal: ctx.signal, failAt: ctx.failAt,
      setOffset: offsetMs => clock.writeControlSync(ctx.manifest.id, offsetMs),
      serviceUrls: [`${identity.api}/health`, `${identity.issuer}/.well-known/openid-configuration`],
    });
    ctx.manifest.lifecycle = {lifetimes: identity.lifetimes, graceSeconds: LIFECYCLE_GRACE_SECONDS, observedAccessTokenLifetimeSeconds: observed, preflight};
    await writeFile(runFile, JSON.stringify({...runConfig, lifecycle: {...lifecycle, observedAccessTokenLifetimeSeconds: observed, clockPreflightVerified: true}}), {mode: 0o600});
    await phase('lifecycle-preflight-verified');
    console.log(`Lifecycle OIDC lifetimes read back (access ${identity.lifetimes.accessTokenLifetime}s, refresh idle ${identity.lifetimes.refreshTokenIdleExpiration}s, refresh absolute ${identity.lifetimes.refreshTokenExpiration}s); issued access lifetime ${observed}s`);
    console.log(`Clock preflight: specimen accepted ${preflight.marginMs}ms before and rejected ${preflight.marginMs}ms after expiry+${preflight.verifierToleranceSeconds}s tolerance; worker shift error ${preflight.workerShiftErrorMs}ms; service skew ${preflight.serviceClockSkewMs}ms; restored`);
  } finally {
    // The genuine specimen is a credential: remove it as soon as the preflight ends.
    await rm(specimenFile, {force: true});
  }
}
