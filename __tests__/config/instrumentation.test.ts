// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("NEXT_RUNTIME", "nodejs");
  vi.stubEnv("AUTH_MODE", "required");
  vi.stubEnv("ZITADEL_ISSUER", "https://identity.example.invalid");
  vi.stubEnv("ZITADEL_CLIENT_ID", "public-client");
  vi.stubEnv("ZITADEL_CLIENT_SECRET", "synthetic-provider-secret");
  vi.stubEnv("NEXTAUTH_SECRET", "synthetic-session-secret");
});
afterEach(() => { vi.unstubAllEnvs(); vi.doUnmock("@/lib/env"); });

describe("Node startup validation", () => {
  it.each(["ZITADEL_ISSUER", "ZITADEL_CLIENT_ID", "ZITADEL_CLIENT_SECRET", "NEXTAUTH_SECRET"])("rejects required startup without %s", async key => {
    vi.stubEnv(key, undefined);
    const { register } = await import("@/instrumentation");
    await expect(register()).rejects.toThrow(key);
  });
  it.each(["ZITADEL_CLIENT_SECRET", "NEXTAUTH_SECRET"])("rejects configured optional startup without %s", async key => {
    vi.stubEnv("AUTH_MODE", "optional");
    vi.stubEnv(key, undefined);
    const { register } = await import("@/instrumentation");
    await expect(register()).rejects.toThrow(key);
  });
  it("rejects an invalid configured issuer", async () => {
    vi.stubEnv("ZITADEL_ISSUER", "invalid");
    const { register } = await import("@/instrumentation");
    await expect(register()).rejects.toThrow("ZITADEL_ISSUER");
  });
  it("accepts complete runtime configuration", async () => {
    const { register } = await import("@/instrumentation");
    await expect(register()).resolves.toBeUndefined();
  });
  it.each(["optional", "disabled"])("accepts anonymous %s startup", async mode => {
    vi.stubEnv("AUTH_MODE", mode);
    for (const key of ["ZITADEL_ISSUER", "ZITADEL_CLIENT_ID", "ZITADEL_CLIENT_SECRET", "NEXTAUTH_SECRET"]) vi.stubEnv(key, undefined);
    const { register } = await import("@/instrumentation");
    await expect(register()).resolves.toBeUndefined();
    expect(process.env.NEXTAUTH_SECRET).toBeUndefined();
  });
  it.each(["edge", undefined])("does not load server validation in runtime %s", async runtime => {
    vi.stubEnv("NEXT_RUNTIME", runtime);
    vi.doMock("@/lib/env", () => { throw new Error("server module imported"); });
    const { register } = await import("@/instrumentation");
    await expect(register()).resolves.toBeUndefined();
  });
});
