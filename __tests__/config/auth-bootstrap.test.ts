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

    const { authConfig } = await import("@/auth");

    expect(authConfig.providers).toEqual([]);
  });

  it("fails fast when required auth has no issuer", async () => {
    process.env.AUTH_MODE = "required";

    await expect(import("@/auth")).rejects.toThrow("ZITADEL_ISSUER");
  });

  it("uses the configured issuer without substituting localhost", async () => {
    process.env.AUTH_MODE = "required";
    process.env.ZITADEL_ISSUER = "https://auth.example.com";
    process.env.ZITADEL_CLIENT_ID = "client-id";
    process.env.ZITADEL_CLIENT_SECRET = "client-secret";
    process.env.NEXTAUTH_SECRET = "nextauth-secret";

    const { authConfig } = await import("@/auth");
    const provider = authConfig.providers[0];

    expect(provider).toMatchObject({ issuer: "https://auth.example.com" });
  });
});
