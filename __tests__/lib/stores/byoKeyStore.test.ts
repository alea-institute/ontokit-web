import { describe, expect, it, beforeEach, vi } from "vitest";

// The store uses sessionStorage (NOT localStorage) so BYO keys are cleared when
// the tab closes. Provide a sessionStorage mock before the store module loads,
// because Zustand's persist middleware captures the storage at import time.
vi.hoisted(() => {
  const store = new Map<string, string>();
  (globalThis as Record<string, unknown>).sessionStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
    get length() {
      return store.size;
    },
    key: (index: number) => [...store.keys()][index] ?? null,
  };
});

import { useByoKeyStore } from "@/lib/stores/byoKeyStore";

const PROJECT = "project-1";

describe("byoKeyStore", () => {
  beforeEach(() => {
    // Reset store + backing sessionStorage between tests.
    useByoKeyStore.setState({ entries: {} });
    sessionStorage.clear();
  });

  it("persists BYO keys to sessionStorage, never localStorage", () => {
    useByoKeyStore.getState().setKey(PROJECT, "openai", "sk-secret-123");

    const persisted = sessionStorage.getItem("ontokit-byo-keys");
    expect(persisted).toContain("sk-secret-123");

    // localStorage must NOT receive the key (guards against a regression back
    // to persistent, sign-out-surviving storage).
    const local =
      typeof localStorage !== "undefined" &&
      typeof localStorage.getItem === "function"
        ? localStorage.getItem("ontokit-byo-keys")
        : null;
    expect(local).toBeNull();
  });

  it("sets, reads, and clears a key by project", () => {
    const s = useByoKeyStore.getState();
    expect(s.getKey(PROJECT)).toBeNull();

    s.setKey(PROJECT, "anthropic", "sk-ant-abc");
    expect(useByoKeyStore.getState().getKey(PROJECT)).toBe("sk-ant-abc");
    expect(useByoKeyStore.getState().getEntry(PROJECT)).toMatchObject({
      provider: "anthropic",
      key: "sk-ant-abc",
      validatedAt: null,
    });

    useByoKeyStore.getState().clearKey(PROJECT);
    expect(useByoKeyStore.getState().getKey(PROJECT)).toBeNull();
    expect(useByoKeyStore.getState().getEntry(PROJECT)).toBeNull();
  });

  it("marks a key validated without altering the key material", () => {
    const s = useByoKeyStore.getState();
    s.setKey(PROJECT, "openai", "sk-secret-123");
    s.markValidated(PROJECT);

    const entry = useByoKeyStore.getState().getEntry(PROJECT);
    expect(entry?.key).toBe("sk-secret-123");
    expect(entry?.validatedAt).not.toBeNull();
  });

  it("isolates keys per project", () => {
    const s = useByoKeyStore.getState();
    s.setKey("proj-a", "openai", "key-a");
    s.setKey("proj-b", "cohere", "key-b");

    expect(useByoKeyStore.getState().getKey("proj-a")).toBe("key-a");
    expect(useByoKeyStore.getState().getKey("proj-b")).toBe("key-b");

    useByoKeyStore.getState().clearKey("proj-a");
    expect(useByoKeyStore.getState().getKey("proj-a")).toBeNull();
    expect(useByoKeyStore.getState().getKey("proj-b")).toBe("key-b");
  });
});
