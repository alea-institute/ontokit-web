import { afterEach, describe, expect, it, vi } from "vitest";

const sessionDescriptor = Object.getOwnPropertyDescriptor(window, "sessionStorage")!;
afterEach(() => {
  Object.defineProperty(window, "sessionStorage", sessionDescriptor);
  vi.restoreAllMocks();
  vi.resetModules();
  sessionStorage.removeItem("ontokit-anonymous-token");
});

describe("anonymous token persistence with restricted browser storage", () => {
  it("keeps working in memory when reading sessionStorage itself is forbidden", async () => {
    vi.resetModules();
    Object.defineProperty(window, "sessionStorage", { configurable: true, get() { throw new DOMException("Storage denied", "SecurityError"); } });
    const { useAnonymousTokenStore } = await import("@/lib/stores/anonymousCreditStore");
    useAnonymousTokenStore.getState().setToken("project", "fixture-token", "session", "anon/session");
    expect(useAnonymousTokenStore.getState().getToken("project")?.sessionId).toBe("session");
    useAnonymousTokenStore.getState().clearToken("project");
    expect(useAnonymousTokenStore.getState().getToken("project")).toBeNull();
  });

  it("still persists tab credentials when removal of a legacy local token is forbidden", async () => {
    vi.resetModules();
    const remove = vi.spyOn(localStorage, "removeItem").mockImplementation(() => { throw new DOMException("Storage denied", "SecurityError"); });
    const { useAnonymousTokenStore } = await import("@/lib/stores/anonymousCreditStore");
    expect(remove).toHaveBeenCalledWith("ontokit-anonymous-token");
    useAnonymousTokenStore.getState().setToken("project", "fixture-token", "session", "anon/session");
    expect(JSON.parse(sessionStorage.getItem("ontokit-anonymous-token")!).state.tokens.project.token).toBe("fixture-token");
    useAnonymousTokenStore.getState().clearToken("project");
    expect(JSON.parse(sessionStorage.getItem("ontokit-anonymous-token")!).state.tokens).toEqual({});
  });
});
