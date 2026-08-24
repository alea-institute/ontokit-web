import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  getAuthMode,
  isZitadelConfigured,
  isAuthRequired,
  isAuthActive,
  shouldShowAuthUI,
} from "@/lib/auth-mode";

// These helpers read process.env at call time (no module-level side effects),
// so we mutate env per test and restore afterwards.
const originalEnv = process.env;

beforeEach(() => {
  process.env = { ...originalEnv };
});
afterEach(() => {
  process.env = originalEnv;
});

function setEnv(vars: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(vars)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

describe("getAuthMode", () => {
  it("defaults to required when AUTH_MODE is unset", () => {
    setEnv({ AUTH_MODE: undefined });
    expect(getAuthMode()).toBe("required");
  });

  it("returns optional / disabled and is case-insensitive", () => {
    setEnv({ AUTH_MODE: "optional" });
    expect(getAuthMode()).toBe("optional");
    setEnv({ AUTH_MODE: "DISABLED" });
    expect(getAuthMode()).toBe("disabled");
  });

  it("falls back to required (fail-closed) for unrecognized values", () => {
    setEnv({ AUTH_MODE: "disabed" }); // typo
    expect(getAuthMode()).toBe("required");
  });
});

describe("isZitadelConfigured", () => {
  it("is true only when BOTH issuer and client id are present", () => {
    setEnv({ ZITADEL_ISSUER: "https://auth.example.com", ZITADEL_CLIENT_ID: "cid" });
    expect(isZitadelConfigured()).toBe(true);
  });
  it("is false when only issuer is set (the client/server drift bug)", () => {
    setEnv({ ZITADEL_ISSUER: "https://auth.example.com", ZITADEL_CLIENT_ID: undefined });
    expect(isZitadelConfigured()).toBe(false);
  });
  it("is false when neither is set", () => {
    setEnv({ ZITADEL_ISSUER: undefined, ZITADEL_CLIENT_ID: undefined });
    expect(isZitadelConfigured()).toBe(false);
  });
});

describe("isAuthActive (provider usable / real sessions possible)", () => {
  const configured = { ZITADEL_ISSUER: "https://auth.example.com", ZITADEL_CLIENT_ID: "cid" };

  it("true: required + configured", () => {
    setEnv({ AUTH_MODE: "required", ...configured });
    expect(isAuthActive()).toBe(true);
  });
  it("true: optional + configured (real sessions exist — the security-critical case)", () => {
    setEnv({ AUTH_MODE: "optional", ...configured });
    expect(isAuthActive()).toBe(true);
  });
  it("false: optional + unconfigured", () => {
    setEnv({ AUTH_MODE: "optional", ZITADEL_ISSUER: undefined, ZITADEL_CLIENT_ID: undefined });
    expect(isAuthActive()).toBe(false);
  });
  it("false: disabled even when Zitadel vars linger", () => {
    setEnv({ AUTH_MODE: "disabled", ...configured });
    expect(isAuthActive()).toBe(false);
  });
});

describe("shouldShowAuthUI (client mirror of isAuthActive via NEXT_PUBLIC_* flags)", () => {
  it("true when mode != disabled and zitadel configured flag is 'true'", () => {
    setEnv({ NEXT_PUBLIC_AUTH_MODE: "optional", NEXT_PUBLIC_ZITADEL_CONFIGURED: "true" });
    expect(shouldShowAuthUI()).toBe(true);
  });
  it("false when configured flag is not 'true' (optional, no Zitadel)", () => {
    setEnv({ NEXT_PUBLIC_AUTH_MODE: "optional", NEXT_PUBLIC_ZITADEL_CONFIGURED: "false" });
    expect(shouldShowAuthUI()).toBe(false);
  });
  it("false when disabled regardless of configured flag", () => {
    setEnv({ NEXT_PUBLIC_AUTH_MODE: "disabled", NEXT_PUBLIC_ZITADEL_CONFIGURED: "true" });
    expect(shouldShowAuthUI()).toBe(false);
  });
  it("defaults to required-mode behavior (shows UI) when flag present", () => {
    setEnv({ NEXT_PUBLIC_AUTH_MODE: undefined, NEXT_PUBLIC_ZITADEL_CONFIGURED: "true" });
    expect(shouldShowAuthUI()).toBe(true);
  });
});

describe("isAuthRequired", () => {
  it("true only in required mode", () => {
    setEnv({ AUTH_MODE: "required" });
    expect(isAuthRequired()).toBe(true);
    setEnv({ AUTH_MODE: "optional" });
    expect(isAuthRequired()).toBe(false);
  });
});
