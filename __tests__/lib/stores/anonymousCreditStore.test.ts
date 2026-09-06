import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  useAnonymousCreditStore,
  ANONYMOUS_TOKEN_TTL_MS,
  useAnonymousTokenStore,
} from "@/lib/stores/anonymousCreditStore";

const PROJECT_ID = "project-1";
const STORAGE_KEY = "ontokit-anonymous-token";
const NOW = new Date("2026-08-24T12:00:00Z");

describe("useAnonymousCreditStore", () => {
  beforeEach(() => {
    useAnonymousCreditStore.setState({ name: null, email: null });
    localStorage.clear();
  });

  it("starts with no credit info", () => {
    const s = useAnonymousCreditStore.getState();
    expect(s.name).toBeNull();
    expect(s.email).toBeNull();
    expect(s.hasCredit()).toBe(false);
  });

  it("setCredit stores name and email", () => {
    useAnonymousCreditStore.getState().setCredit("Ada Lovelace", "ada@example.org");

    const s = useAnonymousCreditStore.getState();
    expect(s.name).toBe("Ada Lovelace");
    expect(s.email).toBe("ada@example.org");
    expect(s.hasCredit()).toBe(true);
  });

  it("hasCredit is true when only one of name/email is set", () => {
    useAnonymousCreditStore.getState().setCredit("Ada Lovelace", null);
    expect(useAnonymousCreditStore.getState().hasCredit()).toBe(true);

    useAnonymousCreditStore.getState().setCredit(null, "ada@example.org");
    expect(useAnonymousCreditStore.getState().hasCredit()).toBe(true);
  });

  it("clearCredit resets name and email to null", () => {
    useAnonymousCreditStore.getState().setCredit("Ada Lovelace", "ada@example.org");
    useAnonymousCreditStore.getState().clearCredit();

    const s = useAnonymousCreditStore.getState();
    expect(s.name).toBeNull();
    expect(s.email).toBeNull();
    expect(s.hasCredit()).toBe(false);
  });

  it("persists credit info to localStorage under the ontokit-anonymous-credit key", () => {
    useAnonymousCreditStore.getState().setCredit("Ada Lovelace", "ada@example.org");

    const persisted = localStorage.getItem("ontokit-anonymous-credit");
    expect(persisted).toContain("Ada Lovelace");
    expect(persisted).toContain("ada@example.org");
  });
});

describe("anonymous token store", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    useAnonymousTokenStore.setState({ tokens: {} });
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("persists bearer tokens only for the tab with 24-hour lifetime metadata", () => {
    const issuedAt = Date.parse("2026-08-24T12:00:00Z");
    useAnonymousTokenStore
      .getState()
      .setToken(PROJECT_ID, "token", "session", "anon/session", issuedAt);

    expect(useAnonymousTokenStore.getState().getToken(PROJECT_ID)).toEqual({
      token: "token",
      sessionId: "session",
      branch: "anon/session",
      issuedAt,
      expiresAt: issuedAt + ANONYMOUS_TOKEN_TTL_MS,
    });
    expect(window.sessionStorage.getItem(STORAGE_KEY)).toContain("token");
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("isolates tokens per project", () => {
    const s = useAnonymousTokenStore.getState();
    s.setToken("project-a", "tok-a", "sess-a", "anon/sess-a");
    s.setToken("project-b", "tok-b", "sess-b", "anon/sess-b");

    expect(useAnonymousTokenStore.getState().getToken("project-a")?.token).toBe("tok-a");
    expect(useAnonymousTokenStore.getState().getToken("project-b")?.token).toBe("tok-b");
  });

  it("clearToken removes only the specified project's entry", () => {
    const s = useAnonymousTokenStore.getState();
    s.setToken("project-a", "tok-a", "sess-a", "anon/sess-a");
    s.setToken("project-b", "tok-b", "sess-b", "anon/sess-b");

    useAnonymousTokenStore.getState().clearToken("project-a");

    expect(useAnonymousTokenStore.getState().getToken("project-a")).toBeNull();
    expect(useAnonymousTokenStore.getState().getToken("project-b")?.token).toBe("tok-b");
  });

  it("overwrites an existing token entry for the same project (session refresh/reset)", () => {
    const s = useAnonymousTokenStore.getState();
    s.setToken("project-1", "tok-old", "sess-old", "anon/sess-old");
    s.setToken("project-1", "tok-new", "sess-new", "anon/sess-new");

    expect(useAnonymousTokenStore.getState().getToken("project-1")).toMatchObject({
      token: "tok-new",
      sessionId: "sess-new",
      branch: "anon/sess-new",
    });
  });

  it("rehydrates an unexpired token for same-tab reload/navigation resume", async () => {
    useAnonymousTokenStore.setState({ tokens: {} });
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        state: {
          tokens: {
            [PROJECT_ID]: {
              token: "restored-token",
              sessionId: "restored-session",
              branch: "anon/restored-session",
              issuedAt: Date.now() - 1_000,
              expiresAt: Date.now() + 1_000,
            },
          },
        },
        version: 0,
      }),
    );

    await useAnonymousTokenStore.persist.rehydrate();

    expect(useAnonymousTokenStore.getState().getToken(PROJECT_ID)?.token).toBe(
      "restored-token",
    );
  });

  it("clears expired and legacy metadata-free entries during rehydration", async () => {
    useAnonymousTokenStore.setState({ tokens: {} });
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        state: {
          tokens: {
            expired: {
              token: "expired-token",
              sessionId: "expired-session",
              branch: "anon/expired-session",
              issuedAt: Date.now() - ANONYMOUS_TOKEN_TTL_MS,
              expiresAt: Date.now(),
            },
            legacy: {
              token: "legacy-token",
              sessionId: "legacy-session",
              branch: "anon/legacy-session",
            },
          },
        },
        version: 0,
      }),
    );

    await useAnonymousTokenStore.persist.rehydrate();

    expect(useAnonymousTokenStore.getState().getToken("expired")).toBeNull();
    expect(useAnonymousTokenStore.getState().getToken("legacy")).toBeNull();
    expect(window.sessionStorage.getItem(STORAGE_KEY)).not.toContain("expired-token");
    expect(window.sessionStorage.getItem(STORAGE_KEY)).not.toContain("legacy-token");
  });
});
