import { describe, expect, it, beforeEach } from "vitest";

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
