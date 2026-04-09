import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock next-intl/server
const mockGetRequestConfig = vi.fn((fn: (args: unknown) => unknown) => fn);
vi.mock("next-intl/server", () => ({
  getRequestConfig: (fn: (args: unknown) => unknown) => mockGetRequestConfig(fn),
}));

// Mock next/headers
const mockCookieGet = vi.fn();
const mockHeaderGet = vi.fn();
vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ get: mockCookieGet }),
  headers: () => Promise.resolve({ get: mockHeaderGet }),
}));

// Mock messages
vi.mock("@/messages/en.json", () => ({
  default: { greeting: "Hello" },
}));

describe("lib/i18n/request", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset module cache to re-import the module fresh
    vi.resetModules();
  });

  it("returns locale from cookie when NEXT_LOCALE is set to en", async () => {
    mockCookieGet.mockReturnValue({ value: "en" });
    mockHeaderGet.mockReturnValue(null);

    // Re-import to get fresh config function
    const mod = await import("@/lib/i18n/request");
    const configFn = mod.default as () => Promise<{ locale: string; messages: unknown }>;
    const result = await configFn();

    expect(result.locale).toBe("en");
    expect(result.messages).toEqual({ greeting: "Hello" });
  });

  it("ignores unsupported cookie locale and falls through to Accept-Language", async () => {
    mockCookieGet.mockReturnValue({ value: "fr" });
    mockHeaderGet.mockReturnValue("en;q=0.9");

    const mod = await import("@/lib/i18n/request");
    const configFn = mod.default as () => Promise<{ locale: string; messages: unknown }>;
    const result = await configFn();

    expect(result.locale).toBe("en");
  });

  it("detects locale from Accept-Language header", async () => {
    mockCookieGet.mockReturnValue(undefined);
    mockHeaderGet.mockReturnValue("en-US,en;q=0.9,de;q=0.8");

    const mod = await import("@/lib/i18n/request");
    const configFn = mod.default as () => Promise<{ locale: string; messages: unknown }>;
    const result = await configFn();

    expect(result.locale).toBe("en");
  });

  it("falls back to default locale when no cookie and unsupported Accept-Language", async () => {
    mockCookieGet.mockReturnValue(undefined);
    mockHeaderGet.mockReturnValue("fr,de;q=0.9");

    const mod = await import("@/lib/i18n/request");
    const configFn = mod.default as () => Promise<{ locale: string; messages: unknown }>;
    const result = await configFn();

    expect(result.locale).toBe("en");
  });

  it("falls back to default locale when no cookie and no Accept-Language header", async () => {
    mockCookieGet.mockReturnValue(undefined);
    mockHeaderGet.mockReturnValue(null);

    const mod = await import("@/lib/i18n/request");
    const configFn = mod.default as () => Promise<{ locale: string; messages: unknown }>;
    const result = await configFn();

    expect(result.locale).toBe("en");
  });

  it("handles cookie with no value", async () => {
    mockCookieGet.mockReturnValue(undefined);
    mockHeaderGet.mockReturnValue(null);

    const mod = await import("@/lib/i18n/request");
    const configFn = mod.default as () => Promise<{ locale: string; messages: unknown }>;
    const result = await configFn();

    expect(result.locale).toBe("en");
  });
});
