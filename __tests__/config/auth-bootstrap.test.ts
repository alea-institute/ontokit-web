import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalEnv = process.env;

beforeEach(() => {
  vi.resetModules();
  process.env = { ...originalEnv, NODE_ENV: "test" };
  delete process.env.ZITADEL_ISSUER;
  delete process.env.ZITADEL_CLIENT_ID;
  delete process.env.ZITADEL_CLIENT_SECRET;
  delete process.env.NEXTAUTH_SECRET;

  vi.doMock("next-auth", () => ({
    default: vi.fn(() => ({
      handlers: {},
      auth: vi.fn(),
      signIn: vi.fn(),
      signOut: vi.fn(),
    })),
  }));
});

afterEach(() => {
  process.env = originalEnv;
  vi.doUnmock("next-auth");
});

describe("auth bootstrap", () => {
  it("boots optional anonymous-only mode without an OIDC provider", async () => {
    process.env.AUTH_MODE = "optional";

    const { createAuthConfig } = await import("@/auth");
    const authConfig = createAuthConfig();

    expect(authConfig.providers).toEqual([]);
    const fallback = process.env.NEXTAUTH_SECRET;
    expect(fallback).toMatch(/^[a-f0-9]{64}$/);
    createAuthConfig();
    expect(process.env.NEXTAUTH_SECRET).toBe(fallback);
  });

  it("fails fast when required auth has no issuer", async () => {
    process.env.AUTH_MODE = "required";
    process.env = { ...process.env, NODE_ENV: "production" };
    delete process.env.VITEST;

    const { createAuthConfig } = await import("@/auth");
    expect(process.env.NEXTAUTH_SECRET).toBeUndefined();
    expect(() => createAuthConfig()).toThrow("ZITADEL_ISSUER");
    expect(process.env.NEXTAUTH_SECRET).toBeUndefined();
  });

  it("uses the configured issuer without substituting localhost", async () => {
    process.env.AUTH_MODE = "required";
    process.env.ZITADEL_ISSUER = "https://auth.example.com";
    process.env.ZITADEL_CLIENT_ID = "client-id";
    process.env.ZITADEL_CLIENT_SECRET = "client-secret";
    process.env.NEXTAUTH_SECRET = "nextauth-secret";

    const { createAuthConfig } = await import("@/auth");
    const authConfig = createAuthConfig();
    const provider = authConfig.providers[0];

    expect(provider).toMatchObject({ issuer: "https://auth.example.com" });
  });
});

describe("runtime auth mode policy", () => {
  it.each(["required", "optional"])("rejects missing secrets for configured %s mode", async mode => {
    process.env.AUTH_MODE = mode;
    process.env.ZITADEL_ISSUER = "https://identity.example.invalid";
    process.env.ZITADEL_CLIENT_ID = "public-client";
    const { createAuthConfig } = await import("@/auth");
    expect(process.env.NEXTAUTH_SECRET).toBeUndefined();
    expect(() => createAuthConfig()).toThrow("ZITADEL_CLIENT_SECRET");
    process.env.ZITADEL_CLIENT_SECRET = "synthetic-provider-secret";
    expect(() => createAuthConfig()).toThrow("NEXTAUTH_SECRET");
    process.env.NEXTAUTH_SECRET = "synthetic-session-secret";
    expect(createAuthConfig().providers).toHaveLength(1);
  });

  it.each([false, true])("preserves disabled mode with provider configured=%s", async configured => {
    process.env.AUTH_MODE = "disabled";
    if (configured) {
      process.env.ZITADEL_ISSUER = "https://identity.example.invalid";
      process.env.ZITADEL_CLIENT_ID = "public-client";
    }
    const { createAuthConfig } = await import("@/auth");
    expect(process.env.NEXTAUTH_SECRET).toBeUndefined();
    expect(createAuthConfig().providers).toEqual([]);
    if (configured) expect(process.env.NEXTAUTH_SECRET).toBeUndefined();
    else expect(process.env.NEXTAUTH_SECRET).toMatch(/^[a-f0-9]{64}$/);
  });

  it("passes a validating initializer to NextAuth for direct entry points", async () => {
    process.env.AUTH_MODE = "required";
    await import("@/auth");
    const { default: nextAuth } = await import("next-auth");
    const initializer = vi.mocked(nextAuth).mock.calls[0][0];
    expect(initializer).toBeTypeOf("function");
    expect(() => (initializer as () => unknown)()).toThrow("NEXTAUTH_SECRET");
  });
});
