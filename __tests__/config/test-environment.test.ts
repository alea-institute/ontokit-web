import { beforeEach, describe, expect, it } from "vitest";

describe("test web storage", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it.each([
    ["localStorage", localStorage],
    ["sessionStorage", sessionStorage],
  ] as const)("provides complete deterministic %s semantics", (_name, storage) => {
    expect(storage.setItem("answer", "42")).toBeUndefined();

    expect(storage.getItem("answer")).toBe("42");
    expect(storage.key(0)).toBe("answer");
    expect(storage.length).toBe(1);

    expect(storage.removeItem("answer")).toBeUndefined();
    expect(storage.getItem("answer")).toBeNull();
  });
});
