import { describe, expect, it, beforeEach } from "vitest";

import {
  useAnonymousCreditStore,
  useAnonymousTokenStore,
} from "@/lib/stores/anonymousCreditStore";

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

describe("useAnonymousTokenStore", () => {
  beforeEach(() => {
    useAnonymousTokenStore.setState({ tokens: {} });
    localStorage.clear();
  });

  it("starts with no tokens", () => {
    expect(useAnonymousTokenStore.getState().getToken("project-1")).toBeNull();
  });

  it("setToken stores an entry retrievable by projectId", () => {
    useAnonymousTokenStore.getState().setToken("project-1", "tok-abc", "sess-1", "anon/sess-1");

    const entry = useAnonymousTokenStore.getState().getToken("project-1");
    expect(entry).toEqual({
      token: "tok-abc",
      sessionId: "sess-1",
      branch: "anon/sess-1",
    });
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

    expect(useAnonymousTokenStore.getState().getToken("project-1")).toEqual({
      token: "tok-new",
      sessionId: "sess-new",
      branch: "anon/sess-new",
    });
  });

  it("persists tokens to localStorage under the ontokit-anonymous-token key", () => {
    useAnonymousTokenStore.getState().setToken("project-1", "tok-abc", "sess-1", "anon/sess-1");

    const persisted = localStorage.getItem("ontokit-anonymous-token");
    expect(persisted).toContain("tok-abc");
    expect(persisted).toContain("sess-1");
  });
});
