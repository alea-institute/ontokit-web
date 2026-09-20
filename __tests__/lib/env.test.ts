import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

describe("validateServerEnv", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  async function loadValidateServerEnv() {
    const mod = await import("@/lib/env");
    return mod.validateServerEnv;
  }

  it("throws when required vars are missing", async () => {
    delete process.env.ZITADEL_ISSUER;
    delete process.env.ZITADEL_CLIENT_ID;
    delete process.env.ZITADEL_CLIENT_SECRET;
    delete process.env.NEXTAUTH_SECRET;

    const validateServerEnv = await loadValidateServerEnv();
    expect(() => validateServerEnv()).toThrow("Missing or invalid server environment variables");
  });

  it("throws when URL vars are invalid", async () => {
    process.env.ZITADEL_ISSUER = "not-a-url";
    process.env.ZITADEL_CLIENT_ID = "test-id";
    process.env.ZITADEL_CLIENT_SECRET = "test-secret";
    process.env.NEXTAUTH_SECRET = "test-secret";

    const validateServerEnv = await loadValidateServerEnv();
    expect(() => validateServerEnv()).toThrow("ZITADEL_ISSUER");
  });

  it("returns correct data when all vars are valid", async () => {
    process.env.ZITADEL_ISSUER = "https://auth.example.com";
    process.env.ZITADEL_CLIENT_ID = "my-client-id";
    process.env.ZITADEL_CLIENT_SECRET = "my-client-secret";
    process.env.NEXTAUTH_SECRET = "my-secret";

    const validateServerEnv = await loadValidateServerEnv();
    const result = validateServerEnv();

    expect(result.ZITADEL_ISSUER).toBe("https://auth.example.com");
    expect(result.ZITADEL_CLIENT_ID).toBe("my-client-id");
    expect(result.ZITADEL_CLIENT_SECRET).toBe("my-client-secret");
    expect(result.NEXTAUTH_SECRET).toBe("my-secret");
  });

  it("still REQUIRES a real NEXTAUTH_SECRET when Zitadel is configured in optional mode (BLOCKER regression: a known secret would forge sessions)", async () => {
    process.env.AUTH_MODE = "optional";
    process.env.ZITADEL_ISSUER = "https://auth.example.com";
    process.env.ZITADEL_CLIENT_ID = "my-client-id";
    process.env.ZITADEL_CLIENT_SECRET = "my-client-secret";
    delete process.env.NEXTAUTH_SECRET;

    const validateServerEnv = await loadValidateServerEnv();
    expect(() => validateServerEnv()).toThrow("NEXTAUTH_SECRET");
  });

  it("relaxes all auth vars when Zitadel is NOT configured (disabled/optional anonymous)", async () => {
    process.env.AUTH_MODE = "disabled";
    delete process.env.ZITADEL_ISSUER;
    delete process.env.ZITADEL_CLIENT_ID;
    delete process.env.ZITADEL_CLIENT_SECRET;
    delete process.env.NEXTAUTH_SECRET;

    const validateServerEnv = await loadValidateServerEnv();
    expect(() => validateServerEnv()).not.toThrow();
  });

  it("ignores stale Zitadel variables when auth is disabled", async () => {
    process.env.AUTH_MODE = "disabled";
    process.env.ZITADEL_ISSUER = "https://auth.example.com";
    process.env.ZITADEL_CLIENT_ID = "stale-client-id";
    delete process.env.ZITADEL_CLIENT_SECRET;
    delete process.env.NEXTAUTH_SECRET;

    const validateServerEnv = await loadValidateServerEnv();
    expect(() => validateServerEnv()).not.toThrow();
  });
});

describe("validateClientEnv", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  async function loadValidateClientEnv() {
    const mod = await import("@/lib/env");
    return mod.validateClientEnv;
  }

  it("returns defaults when NEXT_PUBLIC_API_URL is not set", async () => {
    delete process.env.NEXT_PUBLIC_API_URL;

    const validateClientEnv = await loadValidateClientEnv();
    const result = validateClientEnv();

    expect(result.NEXT_PUBLIC_API_URL).toBe("http://localhost:8000");
  });

  it("throws when NEXT_PUBLIC_API_URL is invalid (non-URL)", async () => {
    process.env.NEXT_PUBLIC_API_URL = "not-a-url";

    const validateClientEnv = await loadValidateClientEnv();
    expect(() => validateClientEnv()).toThrow("Invalid client environment variables");
  });
});

describe("lazy environment exports with real validation and auth mode", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("AUTH_MODE", "disabled");
    for (const name of ["ZITADEL_ISSUER", "ZITADEL_CLIENT_ID", "ZITADEL_CLIENT_SECRET", "NEXTAUTH_SECRET", "NEXTAUTH_URL", "NEXT_PUBLIC_API_URL", "NEXT_PUBLIC_WS_URL"]) {
      vi.stubEnv(name, undefined);
    }
  });
  afterEach(() => { vi.unstubAllEnvs(); });

  it("validates the server export on access and follows the real authentication gate", async () => {
    const { serverEnv } = await import("@/lib/env");
    expect(serverEnv.ZITADEL_ISSUER).toBeUndefined();
    vi.stubEnv("AUTH_MODE", "optional");
    vi.stubEnv("ZITADEL_ISSUER", "https://identity.example.test");
    vi.stubEnv("ZITADEL_CLIENT_ID", "fixture-client");
    expect(() => serverEnv.ZITADEL_ISSUER).toThrow("NEXTAUTH_SECRET");
    vi.stubEnv("ZITADEL_CLIENT_SECRET", "fixture-provider-secret");
    vi.stubEnv("NEXTAUTH_SECRET", "fixture-session-secret");
    expect(serverEnv.ZITADEL_ISSUER).toBe("https://identity.example.test");
    expect(serverEnv.ZITADEL_CLIENT_ID).toBe("fixture-client");
  });

  it("revalidates client values after an invalid URL is corrected", async () => {
    const { clientEnv } = await import("@/lib/env");
    expect(clientEnv.NEXT_PUBLIC_API_URL).toBe("http://localhost:8000");
    expect(clientEnv.NEXT_PUBLIC_WS_URL).toBeUndefined();
    vi.stubEnv("NEXT_PUBLIC_WS_URL", "invalid websocket address");
    expect(() => clientEnv.NEXT_PUBLIC_API_URL).toThrow("NEXT_PUBLIC_WS_URL");
    vi.stubEnv("NEXT_PUBLIC_WS_URL", "wss://api.example.test/events");
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.example.test");
    expect(clientEnv.NEXT_PUBLIC_API_URL).toBe("https://api.example.test");
    expect(clientEnv.NEXT_PUBLIC_WS_URL).toBe("wss://api.example.test/events");
    vi.stubEnv("NEXT_PUBLIC_API_URL", "");
    expect(clientEnv.NEXT_PUBLIC_API_URL).toBe("http://localhost:8000");
  });
});

describe("production environment access with the real schema and authentication gate", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITEST", undefined);
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_MODE", "required");
    vi.stubEnv("ZITADEL_ISSUER", "https://identity.example.test");
    vi.stubEnv("ZITADEL_CLIENT_ID", "fixture-client");
    vi.stubEnv("ZITADEL_CLIENT_SECRET", "fixture-provider-secret");
    vi.stubEnv("NEXTAUTH_SECRET", "fixture-session-secret");
    vi.stubEnv("NEXTAUTH_URL", "https://app.example.test");
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.example.test");
    vi.stubEnv("NEXT_PUBLIC_WS_URL", "wss://api.example.test/events");
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

  it("captures validated startup configuration instead of rereading changed process values", async () => {
    const { serverEnv, clientEnv } = await import("@/lib/env");
    expect(serverEnv.ZITADEL_ISSUER).toBe("https://identity.example.test");
    expect(clientEnv.NEXT_PUBLIC_WS_URL).toBe("wss://api.example.test/events");
    vi.stubEnv("ZITADEL_ISSUER", "invalid");
    vi.stubEnv("NEXT_PUBLIC_API_URL", "invalid");
    expect(serverEnv.ZITADEL_ISSUER).toBe("https://identity.example.test");
    expect(clientEnv.NEXT_PUBLIC_API_URL).toBe("https://api.example.test");
  });

  it("defers missing session validation to access and retries after failure", async () => {
    vi.stubEnv("NEXTAUTH_SECRET", undefined);
    const { serverEnv } = await import("@/lib/env");
    expect(() => serverEnv.NEXTAUTH_SECRET).toThrow("NEXTAUTH_SECRET");
    vi.stubEnv("NEXTAUTH_SECRET", "corrected-session-secret");
    expect(serverEnv.NEXTAUTH_SECRET).toBe("corrected-session-secret");
    vi.stubEnv("NEXTAUTH_SECRET", undefined);
    expect(serverEnv.NEXTAUTH_SECRET).toBe("corrected-session-secret");
  });

  it("rejects invalid client configuration even when server configuration is valid", async () => {
    vi.stubEnv("NEXT_PUBLIC_WS_URL", "invalid");
    await expect(import("@/lib/env")).rejects.toThrow("NEXT_PUBLIC_WS_URL");
  });
});
