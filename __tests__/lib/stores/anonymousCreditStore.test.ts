import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ANONYMOUS_TOKEN_TTL_MS,
  useAnonymousTokenStore,
} from "@/lib/stores/anonymousCreditStore";

const PROJECT_ID = "project-1";
const STORAGE_KEY = "ontokit-anonymous-token";

describe("anonymous token store", () => {
  beforeEach(() => {
    vi.useRealTimers();
    useAnonymousTokenStore.setState({ tokens: {} });
    window.localStorage.clear();
    window.sessionStorage.clear();
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

  it("rehydrates an unexpired token for same-tab reload/navigation resume", async () => {
    vi.setSystemTime(new Date("2026-08-24T12:00:00Z"));
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
    vi.setSystemTime(new Date("2026-08-24T12:00:00Z"));
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
