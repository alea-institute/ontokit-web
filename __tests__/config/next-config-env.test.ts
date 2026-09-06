import { afterEach, describe, expect, it, vi } from "vitest";

const originalIssuer = process.env.ZITADEL_ISSUER;

async function loadConfig() {
  vi.resetModules();
  return (await import("../../next.config")).default;
}

afterEach(() => {
  if (originalIssuer === undefined) {
    delete process.env.ZITADEL_ISSUER;
  } else {
    process.env.ZITADEL_ISSUER = originalIssuer;
  }
});

describe("next.config Zitadel environment", () => {
  it("exposes the configured issuer to the client bundle", async () => {
    process.env.ZITADEL_ISSUER = "https://auth.example.test";

    const config = await loadConfig();

    expect(config.env?.NEXT_PUBLIC_ZITADEL_ISSUER).toBe(
      "https://auth.example.test",
    );
  });

  it("leaves the public issuer undefined when Zitadel is not configured", async () => {
    delete process.env.ZITADEL_ISSUER;

    const config = await loadConfig();

    expect(config.env?.NEXT_PUBLIC_ZITADEL_ISSUER).toBeUndefined();
  });
});
