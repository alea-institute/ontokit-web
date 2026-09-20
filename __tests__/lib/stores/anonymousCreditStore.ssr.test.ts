// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

describe("anonymous stores without browser storage", () => {
  it("initializes empty stores and permits in-memory use during server rendering", async () => {
    vi.stubGlobal("window", undefined);
    vi.stubGlobal("localStorage", undefined);
    const { useAnonymousCreditStore, useAnonymousTokenStore } = await import("@/lib/stores/anonymousCreditStore");
    expect(useAnonymousCreditStore.getState().hasCredit()).toBe(false);
    expect(useAnonymousTokenStore.getState().getToken("project")).toBeNull();
    useAnonymousTokenStore.getState().setToken("project", "fixture-token", "session", "anon/session");
    expect(useAnonymousTokenStore.getState().getToken("project")?.token).toBe("fixture-token");
    useAnonymousTokenStore.getState().clearToken("project");
    expect(useAnonymousTokenStore.getState().getToken("project")).toBeNull();
  });
});
