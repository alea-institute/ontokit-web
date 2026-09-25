// Lifecycle profile support (D08 U1): provider lifetime policy (KTD2) and the
// controlled-clock preflight for the owned Next process (KTD3). Nothing here writes
// credentials, cookies or raw responses outside the private run directory; returned
// evidence contains only booleans and numbers.
import { setTimeout as delay } from 'node:timers/promises';

import * as clock from './auth-clock.mjs';
export { clock };

/** Short, instance-wide OIDC lifetimes for the disposable lifecycle instance only (seconds). */
export const LIFECYCLE_LIFETIMES = Object.freeze({
  accessTokenLifetime: 60,
  idTokenLifetime: 60,
  refreshTokenIdleExpiration: 180,
  refreshTokenExpiration: 360,
});
/** Real elapsed-time budget added after an observed provider expiry before a case may fail. */
export const LIFECYCLE_GRACE_SECONDS = 20;
/** Pinned @auth/core 0.41.3 `jwt.decode` passes clockTolerance: 15 to jose `jwtDecrypt`. */
export const AUTHJS_VERIFIER_TOLERANCE_SECONDS = 15;
/** Pinned Auth.js default session maxAge (auth.ts does not override it). */
export const AUTHJS_SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const FIELDS = ['accessTokenLifetime', 'idTokenLifetime', 'refreshTokenIdleExpiration', 'refreshTokenExpiration'];

/** Parses a protobuf JSON duration ("60s", "60.000000001s") to seconds. */
export function durationSeconds(value) {
  const match = typeof value === 'string' ? /^(\d{1,12})(?:\.(\d{1,9}))?s$/.exec(value) : null;
  if (!match) throw new Error('Lifecycle OIDC lifetime readback malformed');
  return Number(match[1]) + (match[2] ? Number(`0.${match[2]}`) : 0);
}
function assertLifetimes(values) {
  for (const field of FIELDS) {
    if (!Number.isSafeInteger(values?.[field]) || values[field] <= 0) throw new Error('Lifecycle OIDC lifetimes invalid');
  }
  if (values.refreshTokenIdleExpiration <= values.accessTokenLifetime || values.refreshTokenExpiration < values.refreshTokenIdleExpiration) {
    throw new Error('Lifecycle OIDC lifetimes cannot provoke renewal before refresh expiry');
  }
  return values;
}
export function readbackLifetimes(response) {
  const settings = response?.settings;
  if (!settings || typeof settings !== 'object') throw new Error('Lifecycle OIDC lifetime readback malformed');
  return Object.fromEntries(FIELDS.map(field => [field, durationSeconds(settings[field])]));
}

// All four fields are sent in one update (the provider requires it), then read back
// until the effective projection matches exactly or the bounded wait expires.
export async function configureLifecycleLifetimes(call, {apply = LIFECYCLE_LIFETIMES, expected = apply, signal, timeout = 30_000, interval = 500} = {}) {
  assertLifetimes(apply);
  await call('/admin/v1/settings/oidc', Object.fromEntries(FIELDS.map(field => [field, `${apply[field]}s`])), false, 'PUT');
  const deadline = Date.now() + timeout;
  let observed;
  for (;;) {
    observed = readbackLifetimes(await call('/admin/v1/settings/oidc', undefined, true, 'GET'));
    if (FIELDS.every(field => observed[field] === expected[field])) return observed;
    if (Date.now() >= deadline) break;
    try { await delay(interval, undefined, {signal}); } catch { throw new Error('Interrupted'); }
  }
  throw new Error('Lifecycle OIDC lifetime readback mismatch');
}

// The persona must be a new ordinary human: never the bootstrap machine administrator
// and never an instance or organization member (administrative role holder).
export async function verifyOrdinaryPersona(call, personaId) {
  if (typeof personaId !== 'string' || !personaId) throw new Error('Lifecycle persona missing');
  const me = await call('/auth/v1/users/me', undefined, true, 'GET');
  const adminId = me?.user?.id;
  if (typeof adminId !== 'string' || !adminId) throw new Error('Lifecycle bootstrap administrator identity unavailable');
  if (adminId === personaId) throw new Error('Lifecycle persona is bootstrap administration');
  for (const endpoint of ['/admin/v1/members/_search', '/management/v1/orgs/me/members/_search']) {
    const members = await call(endpoint, {}, true);
    if (!Array.isArray(members?.result ?? [])) throw new Error('Lifecycle membership readback malformed');
    const ids = (members.result ?? []).map(member => member?.userId);
    if (!ids.includes(adminId) && endpoint.startsWith('/admin/')) throw new Error('Lifecycle membership readback did not include bootstrap administration');
    if (ids.includes(personaId)) throw new Error('Lifecycle persona holds an administrative membership');
  }
  return true;
}

/** exp - iat of a JWT access token, computed in memory; the token itself is never returned. */
export function jwtLifetimeSeconds(token) {
  const parts = typeof token === 'string' ? token.split('.') : [];
  if (parts.length !== 3) throw new Error('Lifecycle access token is not a JWT');
  let claims;
  try { claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')); } catch { throw new Error('Lifecycle access token claims malformed'); }
  if (!Number.isSafeInteger(claims?.exp) || !Number.isSafeInteger(claims?.iat) || claims.exp <= claims.iat) throw new Error('Lifecycle access token claims malformed');
  return claims.exp - claims.iat;
}

/**
 * Environment for the owned `next start` process only. Every other process (npm,
 * build, Playwright, Docker) must keep an environment without the clock preload.
 */
export function nextServerEnv(env, preloadPath) {
  if (typeof preloadPath !== 'string' || !preloadPath.startsWith('/') || /[\s"'\\]/.test(preloadPath)) throw new Error('Lifecycle clock preload path unsafe');
  assertNoClockOverride(env);
  return {...env, NODE_OPTIONS: `--import=${preloadPath}`, ONTOKIT_E2E_AUTH_CLOCK: '1'};
}
export function assertNoClockOverride(env) {
  if ('NODE_OPTIONS' in env || 'ONTOKIT_E2E_AUTH_CLOCK' in env) throw new Error('Clock override leaked outside the owned Next process');
  return env;
}

const SESSION_COOKIE = /^authjs\.session-token(?:\.\d{1,2})?$/;
/** Validates a private specimen captured from a genuine browser login. */
export function validateSpecimen(specimen, {now = Date.now()} = {}) {
  const cookies = specimen?.cookies;
  if (!Array.isArray(cookies) || !cookies.length || cookies.length > 16) throw new Error('Lifecycle cookie specimen missing');
  const names = new Set();
  for (const cookie of cookies) {
    if (!SESSION_COOKIE.test(cookie?.name) || names.has(cookie.name) || typeof cookie.value !== 'string' || !cookie.value || !Number.isFinite(cookie.expires)) throw new Error('Lifecycle cookie specimen malformed');
    names.add(cookie.name);
  }
  const expiresMs = Math.min(...cookies.map(cookie => cookie.expires * 1000));
  if (Math.max(...cookies.map(cookie => cookie.expires * 1000)) - expiresMs > 2000) throw new Error('Lifecycle cookie specimen chunks disagree');
  if (expiresMs <= now) throw new Error('Lifecycle cookie specimen already expired');
  if (typeof specimen.subject !== 'string' || !specimen.subject) throw new Error('Lifecycle cookie specimen subject missing');
  return {cookieHeader: cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; '), names: [...names], expiresMs, subject: specimen.subject};
}

function clearsCookie(header, name, now) {
  const [pair, ...attributes] = header.split(';');
  if (pair.slice(0, pair.indexOf('=')).trim() !== name) return false;
  return attributes.some(attribute => {
    const [key, ...rest] = attribute.split('=');
    const value = rest.join('=').trim();
    if (key.trim().toLowerCase() === 'max-age') return Number(value) <= 0;
    if (key.trim().toLowerCase() === 'expires') return Date.parse(value) <= now;
    return false;
  });
}

/**
 * Controlled-clock preflight (KTD3). Uses one unchanged genuine cookie specimen:
 *   0. normal time: session valid; records the worker's Auth.js clock skew baseline
 *   1. just before specimen expiry + verifier tolerance: session still valid, and the
 *      Auth.js clock is observed shifted by the written offset (reachability)
 *   2. just after it: session null and every specimen cookie cleared
 *   3. reset to zero: same specimen valid again at the baseline skew (restoration)
 * Renewed cookies returned by any step are ignored, never substituted. The clock is
 * reset in a finally block even when a step fails.
 */
export async function clockPreflight({
  web, specimen, setOffset, fetcher = fetch, now = () => Date.now(), serviceUrls = [], signal,
  toleranceSeconds = AUTHJS_VERIFIER_TOLERANCE_SECONDS, maxAgeSeconds = AUTHJS_SESSION_MAX_AGE_SECONDS,
  marginMs = 5000, settleMs = 150, skewToleranceMs = 3000, failAt,
}) {
  const sample = validateSpecimen(specimen, {now: now()});
  const pause = async ms => { try { await delay(ms, undefined, {signal}); } catch { throw new Error('Interrupted'); } };
  const apply = async offsetMs => { await setOffset(clock.validateOffset(Math.round(offsetMs))); await pause(settleMs); };
  const probe = async () => {
    const requestedAt = now();
    const response = await fetcher(`${web}/api/auth/session`, {
      headers: {cookie: sample.cookieHeader}, redirect: 'manual',
      signal: AbortSignal.any([signal ?? new AbortController().signal, AbortSignal.timeout(20_000)]),
    });
    const respondedAt = now();
    const body = response.status === 200 ? await response.json() : undefined;
    const setCookies = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [];
    const valid = !!body && body.user?.id === sample.subject && Number.isFinite(Date.parse(body.expires));
    return {
      status: response.status, isNull: body === null, valid, refreshError: body?.error === 'RefreshAccessTokenError',
      // Worker Auth.js clock minus host clock, via `expires = workerNow + maxAge`.
      skewMs: valid ? Date.parse(body.expires) - maxAgeSeconds * 1000 - (requestedAt + respondedAt) / 2 : NaN,
      setCookies,
    };
  };
  const serviceSkewMs = async () => {
    let worst = 0;
    for (const url of serviceUrls) {
      const requestedAt = now();
      const response = await fetcher(url, {redirect: 'manual', signal: AbortSignal.any([signal ?? new AbortController().signal, AbortSignal.timeout(10_000)])});
      await response.body?.cancel();
      const date = Date.parse(response.headers.get('date') ?? '');
      if (!Number.isFinite(date)) throw new Error('Lifecycle service clock unobservable');
      // HTTP Date has one-second resolution.
      worst = Math.max(worst, Math.abs(date - requestedAt) - 1000);
    }
    return Math.max(0, worst);
  };
  const boundaryMs = sample.expiresMs + toleranceSeconds * 1000;
  const result = {verifierToleranceSeconds: toleranceSeconds, sessionMaxAgeSeconds: maxAgeSeconds, marginMs};
  let restored = false;
  let normal;
  try {
    await apply(0);
    normal = await probe();
    if (normal.status !== 200 || !normal.valid) throw new Error('Lifecycle preflight: specimen rejected at normal time');
    if (Math.abs(normal.skewMs) > skewToleranceMs) throw new Error('Lifecycle preflight: worker clock not normal at zero offset');

    const beforeOffset = boundaryMs - marginMs - now();
    await apply(beforeOffset);
    const before = await probe();
    if (before.status !== 200 || !before.valid) throw new Error('Lifecycle preflight: specimen rejected before expiry boundary');
    result.workerShiftErrorMs = Math.round(Math.abs(before.skewMs - normal.skewMs - beforeOffset));
    if (result.workerShiftErrorMs > skewToleranceMs) throw new Error('Lifecycle preflight: Next worker clock did not follow the control');
    // The pre-boundary instant lies past the cookie expiry but inside the verifier
    // tolerance, so acceptance here pins the tolerance actually in effect.
    result.toleranceWindowExercised = boundaryMs - marginMs > sample.expiresMs;
    result.refreshErrorBeforeBoundary = before.refreshError;
    result.serviceClockSkewMs = await serviceSkewMs();
    if (result.serviceClockSkewMs > skewToleranceMs) throw new Error('Lifecycle preflight: service clocks moved with the Next clock');
    if (failAt === 'clock-preflight') throw new Error('Injected lifecycle clock failure');

    const afterOffset = boundaryMs + marginMs - now();
    await apply(afterOffset);
    const after = await probe();
    if (after.status !== 200 || !after.isNull) throw new Error('Lifecycle preflight: specimen accepted after expiry boundary');
    if (!sample.names.every(name => after.setCookies.some(header => clearsCookie(header, name, now())))) throw new Error('Lifecycle preflight: expired specimen cookies were not cleared');

    await apply(0);
    const reset = await probe();
    if (reset.status !== 200 || !reset.valid || Math.abs(reset.skewMs - normal.skewMs) > skewToleranceMs) throw new Error('Lifecycle preflight: normal clock not restored');
    restored = true;
    return {...result, beforeAccepted: true, afterRejected: true, cookiesCleared: true, restored: true};
  } finally {
    if (!restored) {
      // Failure cleanup: always return the worker to normal time; never mask the original error.
      let written = false;
      try { await setOffset(0); written = true; } catch { console.error('Lifecycle clock reset failed; owned cleanup will stop the Next process'); }
      if (written && normal?.valid && !signal?.aborted) {
        try {
          await delay(settleMs);
          const check = await probe();
          console.error(check.valid && Math.abs(check.skewMs - normal.skewMs) <= skewToleranceMs
            ? 'Lifecycle clock reset to normal time after failure (observed through Auth.js)'
            : 'Lifecycle clock reset written after failure; normal time not observed');
        } catch { console.error('Lifecycle clock reset written after failure; observation unavailable'); }
      }
    }
  }
}
