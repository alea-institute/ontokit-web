import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// We must import the validation functions without triggering the module-level
// serverEnv/clientEnv calls (which would throw in a test environment).
// We use vi.importActual to isolate just the functions we need.

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
    // Mock the module to prevent top-level calls from throwing
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
