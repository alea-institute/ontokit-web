import { randomBytes } from 'node:crypto';
import { readFile, writeFile, chmod } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import path from 'node:path';
import { compose } from './runtime.mjs';
import { recordFailure } from './diagnostics.mjs';

export function freshIdentityValues(now = Date.now()) {
  return {
    IDENTITY_MASTERKEY: randomBytes(16).toString('hex'),
    IDENTITY_ADMIN_PASSWORD: `Aa1!${randomBytes(24).toString('hex')}`,
    IDENTITY_PAT_EXPIRY: new Date(now + 86_400_000).toISOString(),
  };
}
export function assertDiscovery(discovery, issuer) {
  if (discovery?.issuer !== issuer) throw new Error('Identity issuer mismatch');
}
export async function waitUntil(check, {signal, timeout = 180_000, interval = 500} = {}) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (signal?.aborted) throw new Error('Interrupted');
    if (await check()) return;
    try { await delay(Math.min(interval, Math.max(1, deadline - Date.now())), undefined, {signal}); }
    catch { throw new Error('Interrupted'); }
  }
  throw new Error('Identity/readiness timed out');
}
export async function readyHttp(url, {signal, validate = response => response.ok, timeout} = {}) {
  await waitUntil(async () => {
    let response;
    try { response = await fetch(url, {signal: AbortSignal.any([signal ?? new AbortController().signal, AbortSignal.timeout(5000)])}); }
    catch { return false; }
    return validate(response);
  }, {signal, timeout});
}
export async function writeRuntimeEnv(ctx) {
  await writeFile(path.join(ctx.dir, 'runtime.env'), Object.entries(ctx.values).map(([key, value]) => `${key}=${value}\n`).join(''), {mode: 0o600});
}

// Read-only discovery can become reachable before the administrative service has
// finished startup. Mutations are deliberately single-shot: an ambiguous failure
// must never create duplicate projects, applications or users.
export async function identityRequest({issuer, pat, endpoint, body, signal, readOnly = false, timeout = 120_000, interval = 500, fetcher = fetch, diagnose = async () => {}}) {
  let result;
  const request = async () => {
    let response;
    try {
      response = await fetcher(`${issuer}${endpoint}`, {
        method: 'POST', headers: {Authorization: `Bearer ${pat}`, 'Content-Type': 'application/json', 'Connect-Protocol-Version': '1'},
        body: JSON.stringify(body), signal: AbortSignal.any([signal ?? new AbortController().signal, AbortSignal.timeout(5000)]), redirect: 'error',
      });
    } catch (error) {
      if (signal?.aborted) throw new Error('Interrupted');
      if (readOnly && (error instanceof TypeError || error.name === 'TimeoutError')) return false;
      throw error;
    }
    if (!response.ok) {
      // Bound diagnostic data before retaining it. The callback writes only to
      // run-private storage, never to the terminal or durable manifest.
      const reader = response.body?.getReader();
      const chunks = [];
      let remaining = 8192;
      if (reader) {
        try {
          while (remaining > 0) {
            const {done, value} = await reader.read();
            if (done) break;
            const chunk = value.subarray(0, remaining);
            chunks.push(Buffer.from(chunk)); remaining -= chunk.length;
          }
        } finally { await reader.cancel().catch(() => {}); }
      }
      try { await diagnose(`Identity API ${endpoint} HTTP ${response.status}: ${Buffer.concat(chunks).toString('utf8')}`); } catch { /* Diagnostics cannot prevent cleanup or alter failure semantics. */ }
      if (readOnly && [502, 503, 504].includes(response.status)) return false;
      throw new Error(`Disposable identity bootstrap failed (${response.status}) at ${endpoint}`);
    }
    result = await response.json();
    return true;
  };
  if (readOnly) await waitUntil(request, {signal, timeout, interval});
  else await request();
  return result;
}

export async function bootstrapIdentity(ctx) {
  const issuer = `http://localhost:${ctx.manifest.ports.identity}`;
  const login = `http://localhost:${ctx.manifest.ports.login}/ui/v2/login`;
  const web = `http://localhost:${ctx.manifest.ports.web}`;
  await compose(ctx, 'up', '-d', '--no-deps', 'zitadel');
  await readyHttp(`${issuer}/.well-known/openid-configuration`, {signal: ctx.signal, validate: async response => {
    if (!response.ok) return false;
    assertDiscovery(await response.json(), ctx.failAt === 'identity-issuer' ? `${issuer}/mismatch` : issuer);
    return true;
  }});
  const patFile = path.join(ctx.dir, 'bootstrap-admin.pat');
  await compose(ctx, 'cp', 'zitadel:/zitadel-data/admin.pat', patFile);
  await chmod(patFile, 0o600);
  const pat = ctx.failAt === 'identity-pat' ? 'deliberately-invalid-disposable-test-pat' : (await readFile(patFile, 'utf8')).trim();
  if (!pat) throw new Error('Empty disposable identity bootstrap PAT');
  // Only this fresh run's canonical loopback issuer receives its bootstrap token.
  const call = (endpoint, body, readOnly = false) => identityRequest({
    issuer, pat, endpoint, body, signal: ctx.signal, readOnly,
    diagnose: detail => recordFailure(ctx, new Error(detail)),
  });
  const organizations = await call('/v2/organizations/_search', {queries: [{defaultQuery: {}}]}, true);
  if (organizations.result?.length !== 1 || organizations.result[0].name !== 'OntoKit isolated tests') throw new Error('Unexpected disposable identity organization');
  const organizationId = organizations.result[0].id;
  const {projectId} = await call('/zitadel.project.v2.ProjectService/CreateProject', {
    organizationId, name: `OntoKit ${ctx.manifest.id}`, authorizationRequired: false, projectAccessRequired: false,
  });
  const application = await call('/zitadel.application.v2.ApplicationService/CreateApplication', {
    projectId, name: 'OntoKit Web', oidcConfiguration: {
      redirectUris: [`${web}${ctx.failAt === 'identity-callback' ? '/invalid-callback' : '/api/auth/callback/zitadel'}`], postLogoutRedirectUris: [web],
      responseTypes: ['OIDC_RESPONSE_TYPE_CODE'],
      grantTypes: ['OIDC_GRANT_TYPE_AUTHORIZATION_CODE', 'OIDC_GRANT_TYPE_REFRESH_TOKEN'],
      applicationType: 'OIDC_APP_TYPE_WEB', authMethodType: 'OIDC_AUTH_METHOD_TYPE_BASIC',
      version: 'OIDC_VERSION_1_0', developmentMode: true, accessTokenType: 'OIDC_TOKEN_TYPE_JWT',
      // Match setup-zitadel.sh: the current Auth.js provider reads ID-token claims.
      idTokenUserinfoAssertion: true,
      loginVersion: {loginV2: {baseUri: login}},
    },
  });
  const {clientId, clientSecret} = application.oidcConfiguration ?? {};
  if (!clientId || !clientSecret) throw new Error('Disposable OIDC client credentials missing');
  const users = {};
  for (const role of ['owner', 'unrelated']) {
    const email = `${role}-${ctx.manifest.id}@example.test`;
    const password = `Aa1!${randomBytes(24).toString('hex')}`;
    const created = await call('/v2/users/new', {
      organizationId, username: email, human: {
        profile: {givenName: role, familyName: 'OntoKit Test', preferredLanguage: 'en'},
        email: {email, isVerified: true}, password: {password, changeRequired: false},
      },
    });
    if (!created.id) throw new Error('Disposable ordinary user ID missing');
    users[role] = {id: created.id, email, password};
  }
  if (users.owner.id === users.unrelated.id) throw new Error('Disposable identities must be distinct');
  await compose(ctx, 'up', '-d', '--no-deps', 'login');
  await readyHttp(`${login}/loginname`, {signal: ctx.signal, validate: async response => response.ok && (await response.text()).includes('data-testid="username-text-input"')});
  ctx.values.OIDC_CLIENT_ID = clientId;
  await writeRuntimeEnv(ctx);
  await compose(ctx, 'up', '-d', '--no-deps', '--force-recreate', 'api', 'worker');
  await compose(ctx, 'exec', '-T', 'api', 'python', '-c', 'from ontokit.core.config import settings; assert settings.auth_mode == "required"; assert not settings.superadmin_ids; print("Required authentication and ordinary-user policy verified")');
  return {issuer, login, web, api: `http://localhost:${ctx.manifest.ports.api}`, clientId, clientSecret, users};
}
