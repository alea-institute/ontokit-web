// Owned child process: one genuine browser OIDC sign-in for the lifecycle persona,
// capturing the resulting application session cookie as a private specimen.
// Usage (launcher only): node lifecycle-signin.mjs <private run config> <private output>
// Runs with cwd = the private web copy so Playwright/Chromium come from that copy.
// Writes numbers and the specimen only to the private run directory; prints nothing
// sensitive. The refresh token must never be visible to the browser session.
import { createRequire } from 'node:module';
import { lstatSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { jwtLifetimeSeconds } from './auth-lifecycle.mjs';

const [configFile, outFile] = process.argv.slice(2);
const expectedDir = `/tmp/ontokit-e2e-${process.getuid()}/${process.env.ONTOKIT_E2E_RUN}`;
if (!/^[a-f0-9]{32}$/.test(process.env.ONTOKIT_E2E_RUN ?? '') || path.dirname(configFile ?? '') !== expectedDir || path.dirname(outFile ?? '') !== expectedDir) {
  throw new Error('Lifecycle sign-in paths do not belong to this invocation');
}
const stat = lstatSync(configFile);
if (!stat.isFile() || stat.isSymbolicLink() || stat.uid !== process.getuid() || (stat.mode & 0o077)) throw new Error('Unsafe private lifecycle config');
const run = JSON.parse(readFileSync(configFile, 'utf8'));
const persona = run.users?.lifecycle;
if (run.profile !== 'lifecycle' || run.id !== process.env.ONTOKIT_E2E_RUN || !persona?.id) throw new Error('Lifecycle sign-in config invalid');

const {chromium} = createRequire(path.join(process.cwd(), 'package.json'))('@playwright/test');
const browser = await chromium.launch();
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(30_000);
  const loginOrigin = new URL(run.login).origin;
  await page.goto(`${run.web}/auth/signin?callbackUrl=${encodeURIComponent(`${run.web}/`)}`);
  await page.getByRole('button', {name: 'Sign in with Zitadel'}).click();
  await page.waitForURL(url => url.origin === loginOrigin, {timeout: 30_000});
  await page.getByTestId('username-text-input').fill(persona.email);
  await page.getByTestId('submit-button').click();
  await page.getByTestId('password-text-input').waitFor({state: 'visible', timeout: 30_000});
  await page.getByTestId('password-text-input').fill(persona.password);
  await page.getByTestId('submit-button').click();
  await page.waitForURL(url => (url.origin === run.web && url.pathname === '/') || (url.origin === loginOrigin && url.pathname.endsWith('/mfa/set')), {timeout: 45_000});
  if (new URL(page.url()).pathname.endsWith('/mfa/set')) {
    const skip = page.getByTestId('reset-button');
    if (!/skip/i.test(await skip.textContent() ?? '')) throw new Error('Unexpected MFA enrollment control');
    await skip.click();
  }
  await page.waitForURL(url => url.origin === run.web && url.pathname === '/', {timeout: 45_000});
  const response = await page.request.get(`${run.web}/api/auth/session`);
  if (response.status() !== 200) throw new Error('Lifecycle session unavailable after sign-in');
  const session = await response.json();
  if (!session?.accessToken || session.error || session.user?.id !== persona.id) throw new Error('Lifecycle session is not the verified persona');
  if ('refreshToken' in session || JSON.stringify(session).includes('refresh_token')) throw new Error('Refresh credential exposed to the browser session');
  const observedAccessTokenLifetimeSeconds = jwtLifetimeSeconds(session.accessToken);
  // Capture the jar's current session cookie(s) exactly as issued, then stop using them.
  const cookies = (await context.cookies(run.web))
    .filter(cookie => /^authjs\.session-token(?:\.\d{1,2})?$/.test(cookie.name))
    .map(({name, value, expires}) => ({name, value, expires}));
  await context.close();
  writeFileSync(outFile, JSON.stringify({subject: persona.id, cookies, observedAccessTokenLifetimeSeconds, capturedAt: Date.now()}), {mode: 0o600, flag: 'wx'});
} finally {
  await browser.close();
}
