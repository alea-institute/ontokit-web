// @vitest-environment node
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAuthMode, isZitadelConfigured } from '@/lib/auth-mode';

beforeEach(() => {
  for (const name of ['AUTH_MODE', 'ZITADEL_ISSUER', 'ZITADEL_CLIENT_ID', 'NEXT_PUBLIC_API_URL', 'NEXT_PUBLIC_WS_URL', 'CODECOV_TOKEN', 'TURBOPACK']) vi.stubEnv(name, undefined);
  vi.resetModules();
});
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });
const config = async () => (await import('../../next.config')).default;

describe('Next configuration through the real internationalization wrapper', () => {
  it.each([
    { issuer: undefined, client: undefined, expected: 'false' },
    { issuer: 'https://issuer.example.invalid', client: undefined, expected: 'false' },
    { issuer: undefined, client: 'fixture-client', expected: 'false' },
    { issuer: 'https://issuer.example.invalid', client: 'fixture-client', expected: 'true' },
  ])('keeps the browser provider flag aligned with the server for $issuer / $client', async ({ issuer, client, expected }) => {
    vi.stubEnv('ZITADEL_ISSUER', issuer); vi.stubEnv('ZITADEL_CLIENT_ID', client);
    const value = await config();
    expect(value.env?.NEXT_PUBLIC_ZITADEL_CONFIGURED).toBe(expected);
    expect(value.env?.NEXT_PUBLIC_ZITADEL_CONFIGURED).toBe(String(isZitadelConfigured()));
    expect(value.env?.NEXT_PUBLIC_AUTH_MODE).toBe('required');
    expect(value.env?.NEXT_PUBLIC_ZITADEL_ISSUER).toBe(issuer);
    expect(value.output).toBe('standalone');
    expect(value.reactStrictMode).toBe(true);
  });

  it.each(['optional', 'disabled'])('publishes the selected %s authentication mode consistently', async mode => {
    vi.stubEnv('AUTH_MODE', mode);
    const value = await config();
    expect(value.env?.NEXT_PUBLIC_AUTH_MODE).toBe(mode);
    expect(value.env?.NEXT_PUBLIC_AUTH_MODE).toBe(getAuthMode());
    expect(value.env).not.toHaveProperty('ZITADEL_CLIENT_ID');
    expect(value.env).not.toHaveProperty('CODECOV_TOKEN');
  });

  it.each([
    { api: undefined, ws: undefined, allowed: ['http://localhost:8000'] },
    { api: 'https://api.example.invalid/v1?query=ignored', ws: 'wss://socket.example.invalid:8443/ws', allowed: ['https://api.example.invalid', 'wss://socket.example.invalid:8443'] },
    { api: 'invalid-api', ws: 'invalid-socket', allowed: [] },
  ])('scopes the security policy to review routes and valid configured origins: $api / $ws', async ({ api, ws, allowed }) => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', api); vi.stubEnv('NEXT_PUBLIC_WS_URL', ws);
    const value = await config();
    const rules = await value.headers!();
    expect(rules.map(rule => rule.source)).toEqual(['/pr-party/:path*', '/pr-party']);
    for (const rule of rules) {
      expect(rule.headers).toHaveLength(1);
      expect(rule.headers[0].key).toBe('Content-Security-Policy');
      const directives = rule.headers[0].value.split('; ').map(part => part.trim());
      expect(directives.find(part => part.startsWith('connect-src'))?.split(/\s+/)).toEqual(['connect-src', "'self'", ...allowed]);
      expect(directives).toContain("frame-ancestors 'none'");
      expect(directives).toContain("object-src 'none'");
      expect(directives).toContain("base-uri 'self'");
      expect(directives).toContain("form-action 'self'");
      expect(rule.headers[0].value).not.toContain('query=ignored');
    }
    expect(value.env?.NEXT_PUBLIC_API_URL).toBe(api);
    expect(value.env?.NEXT_PUBLIC_WS_URL).toBe(ws);
  });

  it.each([false, true])('preserves existing webpack plugins and composes the i18n alias (server: %s)', async isServer => {
    const value = await config();
    const existing = { apply() {} };
    const input = { context: process.cwd(), plugins: [existing], resolve: { alias: { fixture: '/fixture' } } };
    const output = value.webpack!(input, { isServer } as Parameters<NonNullable<typeof value.webpack>>[1]);
    expect(output).toBe(input);
    expect(output.watchOptions).toEqual({ poll: 1000, aggregateTimeout: 300 });
    expect(output.resolve.alias).toMatchObject({ fixture: '/fixture', 'next-intl/config': resolve('lib/i18n/request.ts') });
    expect(output.plugins).toHaveLength(2);
    expect(output.plugins[0]).toBe(existing);
    // Construct the real Codecov plugin but do not apply it or run a build.
    expect(typeof output.plugins[1].apply).toBe('function');
  });
});
