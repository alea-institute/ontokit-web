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

  it("returns the FOLIO default NEXTAUTH_SECRET when not set", async () => {
    delete process.env.NEXTAUTH_SECRET;
    delete process.env.NEXTAUTH_URL;

    const validateServerEnv = await loadValidateServerEnv();
    const result = validateServerEnv();
    expect(result.NEXTAUTH_SECRET).toBe("folio-dev-secret");
  });

  it("throws when NEXTAUTH_URL is provided but invalid", async () => {
    process.env.NEXTAUTH_URL = "not-a-url";
    process.env.NEXTAUTH_SECRET = "test-secret";

    const validateServerEnv = await loadValidateServerEnv();
    expect(() => validateServerEnv()).toThrow("Missing or invalid server environment variables");
  });

  it("returns correct data when all vars are valid", async () => {
    process.env.NEXTAUTH_URL = "https://app.example.com";
    process.env.NEXTAUTH_SECRET = "my-secret";

    const validateServerEnv = await loadValidateServerEnv();
    const result = validateServerEnv();

    expect(result.NEXTAUTH_URL).toBe("https://app.example.com");
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
