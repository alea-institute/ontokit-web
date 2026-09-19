// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Auth } from '@auth/core';
import { decode, encode } from '@auth/core/jwt';
import type { OIDCConfig } from '@auth/core/providers';
import type { JWT } from 'next-auth/jwt';

// The Next.js adapter requires a running server. Auth.js core, encrypted cookies,
// environment validation and all application callbacks remain real.
vi.mock('next-auth', () => ({ default: () => ({ handlers: {}, auth: undefined, signIn: undefined, signOut: undefined }) }));
const secret = 'synthetic-session-signing-secret-for-tests-only';
const user = { id: 'reviewer', name: 'Reviewer', email: 'reviewer@example.invalid' };
let fetcher: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('AUTH_MODE', 'required');
  vi.stubEnv('ZITADEL_ISSUER', 'https://issuer.example.invalid');
  vi.stubEnv('ZITADEL_CLIENT_ID', 'synthetic-client');
  vi.stubEnv('ZITADEL_CLIENT_SECRET', 'synthetic-client-secret');
  vi.stubEnv('NEXTAUTH_SECRET', secret);
  fetcher = vi.fn(async () => Response.json({ access_token: 'renewed-access', expires_in: 3600, refresh_token: 'rotated-refresh' }));
  vi.stubGlobal('fetch', fetcher);
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
async function session(token: JWT) {
  const { authConfig } = await import('@/auth');
  const cookie = await encode({ token, secret, salt: 'authjs.session-token' });
  return Auth(new Request('http://localhost/api/auth/session', { headers: { cookie: `authjs.session-token=${cookie}` } }), {
    ...authConfig, secret, trustHost: true, basePath: '/api/auth',
  });
}

async function cookieToken(response: Response) {
  const cookie = response.headers.getSetCookie().find(value => value.startsWith('authjs.session-token='))!;
  return decode({ token: decodeURIComponent(cookie.split(';')[0].slice('authjs.session-token='.length)), secret, salt: 'authjs.session-token' });
}

describe('authenticated sessions through encrypted cookies and real callbacks', () => {
  it.each([
    [{ sub: 'reviewer', name: 'Display name', preferred_username: 'handle', email: 'reviewer@example.invalid', picture: 'https://example.invalid/avatar' }, 'Display name'],
    [{ sub: 'reviewer', preferred_username: 'handle', email: 'reviewer@example.invalid' }, 'handle'],
  ])('maps the issuer profile and initial grant into a usable session: %j', async (profile, name) => {
    const { authConfig } = await import('@/auth');
    const provider = authConfig.providers[0] as OIDCConfig<Record<string, unknown>>;
    const signedInUser = await provider.profile!(profile, {});
    expect(signedInUser).toEqual({ id: 'reviewer', name, email: 'reviewer@example.invalid', image: "picture" in profile ? profile.picture : undefined });
    const initial = await authConfig.callbacks!.jwt!({ token: { sub: 'reviewer' }, user: signedInUser, account: { provider: 'zitadel', type: 'oidc', providerAccountId: 'reviewer', access_token: 'initial-access', refresh_token: 'initial-refresh', expires_at: Math.floor(Date.now() / 1000) + 600 } });
    const response = await session(initial!);
    expect(await response.json()).toMatchObject({ user: { id: 'reviewer', name, email: 'reviewer@example.invalid' }, accessToken: 'initial-access' });
    expect(await cookieToken(response)).toMatchObject({ refreshToken: 'initial-refresh' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('refreshes expired credentials and exposes only the application session fields', async () => {
    const response = await session({ user, accessToken: 'expired', refreshToken: 'refresh-original', expiresAt: 1 });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ user, accessToken: 'renewed-access' });
    expect(body.refreshToken).toBeUndefined();
    const renewed = await cookieToken(response);
    expect(renewed).toMatchObject({ accessToken: 'renewed-access', refreshToken: 'rotated-refresh', user });
    expect(renewed?.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000) + 3590);
    expect(fetcher).toHaveBeenCalledOnce();
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://issuer.example.invalid/oauth/v2/token');
    expect(init.method).toBe('POST');
    expect(Object.fromEntries(new URLSearchParams(init.body as URLSearchParams))).toEqual({ client_id: 'synthetic-client', client_secret: 'synthetic-client-secret', grant_type: 'refresh_token', refresh_token: 'refresh-original' });
  });
  it('retains the previous refresh token when the issuer does not rotate it', async () => {
    fetcher.mockResolvedValue(Response.json({ access_token: 'renewed-access', expires_in: 60 }));
    const response = await session({ user, refreshToken: 'refresh-original', expiresAt: 1 });
    expect(await cookieToken(response)).toMatchObject({ refreshToken: 'refresh-original', accessToken: 'renewed-access' });
  });

  it('returns unexpired credentials without contacting the issuer', async () => {
    const response = await session({ user, accessToken: 'valid-access', refreshToken: 'refresh-original', expiresAt: Math.floor(Date.now() / 1000) + 600 });
    expect(await response.json()).toMatchObject({ user, accessToken: 'valid-access' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('does not refresh expired credentials when authentication is disabled', async () => {
    vi.stubEnv('AUTH_MODE', 'disabled');
    const response = await session({ user, accessToken: 'old-access', refreshToken: 'refresh-original', expiresAt: 1 });
    expect(await response.json()).toMatchObject({ user, accessToken: 'old-access' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('preserves the session without a refresh token instead of sending an invalid grant', async () => {
    const response = await session({ user, accessToken: 'old-access', expiresAt: 1 });
    expect(await response.json()).toMatchObject({ user, accessToken: 'old-access' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('refreshes a token with no expiry and tolerates an absent application user', async () => {
    const response = await session({ name: 'JWT name', refreshToken: 'refresh-original' });
    expect(await response.json()).toMatchObject({ user: { name: 'JWT name' }, accessToken: 'renewed-access' });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it.each(['rejected grant', 'network failure', 'malformed response'])('propagates %s into the session error without leaking refresh credentials', async failure => {
    if (failure === 'rejected grant') fetcher.mockResolvedValue(Response.json({ error: 'invalid_grant' }, { status: 400 }));
    if (failure === 'network failure') fetcher.mockRejectedValue(new TypeError('Issuer unavailable'));
    if (failure === 'malformed response') fetcher.mockResolvedValue(new Response('not-json'));
    const response = await session({ user, accessToken: 'old-access', refreshToken: 'refresh-original', expiresAt: 1 });
    const body = await response.json();
    expect(body).toMatchObject({ user, accessToken: 'old-access', error: 'RefreshAccessTokenError' });
    expect(body.refreshToken).toBeUndefined();
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('returns no session for a request without a session cookie', async () => {
    const { authConfig } = await import('@/auth');
    const response = await Auth(new Request('http://localhost/api/auth/session'), { ...authConfig, secret, trustHost: true, basePath: '/api/auth' });
    expect(response.status).toBe(200);
    expect(await response.json()).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
