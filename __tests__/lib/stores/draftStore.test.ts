import { describe, expect, it, beforeEach, vi } from "vitest";

// Provide localStorage before the store module loads (Zustand persist captures it at import time)
vi.hoisted(() => {
  if (!globalThis.localStorage || typeof globalThis.localStorage.setItem !== "function") {
    const store = new Map<string, string>();
    (globalThis as Record<string, unknown>).localStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
      clear: () => store.clear(),
      get length() { return store.size; },
      key: (index: number) => [...store.keys()][index] ?? null,
    };
  }
});

import { useDraftStore, draftKey, type DraftEntry, type PropertyDraftEntry, type IndividualDraftEntry } from "@/lib/stores/draftStore";

function makeClassDraft(overrides?: Partial<DraftEntry>): DraftEntry {
  return {
    labels: [{ lang: "en", value: "Test" }],
    comments: [],
    parentIris: [],
    parentLabels: {},
    annotations: [],
    relationships: [],
    updatedAt: Date.now(),
    ...overrides,
  };
}

function makePropertyDraft(overrides?: Partial<PropertyDraftEntry>): PropertyDraftEntry {
  return {
    entityType: "property",
    propertyType: "object",
    labels: [],
    comments: [],
    definitions: [],
    domainIris: [],
    rangeIris: [],
    parentIris: [],
    inverseOf: null,
    characteristics: [],
    annotations: [],
    relationships: [],
    deprecated: false,
    equivalentIris: [],
    disjointIris: [],
    updatedAt: Date.now(),
    ...overrides,
  };
}

function makeIndividualDraft(overrides?: Partial<IndividualDraftEntry>): IndividualDraftEntry {
  return {
    entityType: "individual",
    labels: [],
    comments: [],
    definitions: [],
    typeIris: [],
    sameAsIris: [],
    differentFromIris: [],
    objectPropertyAssertions: [],
    dataPropertyAssertions: [],
    annotations: [],
    relationships: [],
    deprecated: false,
    updatedAt: Date.now(),
    ...overrides,
  };
}

describe("draftKey", () => {
  it("builds a composite key from projectId, branch, and IRI", () => {
    expect(draftKey("proj1", "main", "http://ex.org/A")).toBe("proj1:main:http://ex.org/A");
  });

  it("handles empty strings", () => {
    expect(draftKey("", "", "")).toBe("::");
  });
});

describe("useDraftStore", () => {
  beforeEach(() => {
    // Reset the store to a clean state before each test
    useDraftStore.setState({ drafts: {} });
  });

  describe("setDraft / getDraft", () => {
    it("stores and retrieves a class draft", () => {
      const { setDraft } = useDraftStore.getState();
      const key = draftKey("p1", "main", "urn:A");
      const draft = makeClassDraft();

      setDraft(key, draft);
      // getState again after mutation to read updated state
      const result = useDraftStore.getState().getDraft(key);
      expect(result).toEqual(draft);
    });

    it("stores and retrieves a property draft", () => {
      const key = draftKey("p1", "dev", "urn:prop1");
      const draft = makePropertyDraft({ propertyType: "data" });

      useDraftStore.getState().setDraft(key, draft);
      const result = useDraftStore.getState().getDraft(key);
      expect(result).toEqual(draft);
      expect(result?.entityType).toBe("property");
    });

    it("stores and retrieves an individual draft", () => {
      const key = draftKey("p1", "main", "urn:ind1");
      const draft = makeIndividualDraft();

      useDraftStore.getState().setDraft(key, draft);
      const result = useDraftStore.getState().getDraft(key);
      expect(result).toEqual(draft);
      expect(result?.entityType).toBe("individual");
    });

    it("overwrites an existing draft at the same key", () => {
      const key = draftKey("p1", "main", "urn:A");
      const draft1 = makeClassDraft({ updatedAt: 100 });
      const draft2 = makeClassDraft({ updatedAt: 200 });

      useDraftStore.getState().setDraft(key, draft1);
      useDraftStore.getState().setDraft(key, draft2);
      expect(useDraftStore.getState().getDraft(key)?.updatedAt).toBe(200);
    });

    it("returns undefined for a missing key", () => {
      expect(useDraftStore.getState().getDraft("nonexistent")).toBeUndefined();
    });
  });

  describe("hasDraft", () => {
    it("returns true when a draft exists", () => {
      const key = draftKey("p1", "main", "urn:A");
      useDraftStore.getState().setDraft(key, makeClassDraft());
      expect(useDraftStore.getState().hasDraft(key)).toBe(true);
    });

    it("returns false when no draft exists", () => {
      expect(useDraftStore.getState().hasDraft("missing")).toBe(false);
    });
  });

  describe("clearDraft", () => {
    it("removes a single draft by key", () => {
      const key1 = draftKey("p1", "main", "urn:A");
      const key2 = draftKey("p1", "main", "urn:B");
      useDraftStore.getState().setDraft(key1, makeClassDraft());
      useDraftStore.getState().setDraft(key2, makeClassDraft());

      useDraftStore.getState().clearDraft(key1);

      expect(useDraftStore.getState().hasDraft(key1)).toBe(false);
      expect(useDraftStore.getState().hasDraft(key2)).toBe(true);
    });

    it("does nothing when clearing a non-existent key", () => {
      useDraftStore.getState().setDraft("a", makeClassDraft());
      useDraftStore.getState().clearDraft("nonexistent");
      expect(useDraftStore.getState().hasDraft("a")).toBe(true);
    });
  });

  describe("getDraftIris", () => {
    it("returns IRIs for drafts matching projectId and branch", () => {
      useDraftStore.getState().setDraft(draftKey("p1", "main", "urn:A"), makeClassDraft());
      useDraftStore.getState().setDraft(draftKey("p1", "main", "urn:B"), makeClassDraft());
      useDraftStore.getState().setDraft(draftKey("p1", "dev", "urn:C"), makeClassDraft());
      useDraftStore.getState().setDraft(draftKey("p2", "main", "urn:D"), makeClassDraft());

      const iris = useDraftStore.getState().getDraftIris("p1", "main");
      expect(iris).toEqual(expect.arrayContaining(["urn:A", "urn:B"]));
      expect(iris).toHaveLength(2);
    });

    it("returns empty array when no drafts match", () => {
      useDraftStore.getState().setDraft(draftKey("p1", "main", "urn:A"), makeClassDraft());
      expect(useDraftStore.getState().getDraftIris("p2", "main")).toEqual([]);
    });
  });

  describe("clearAllDrafts", () => {
    it("removes all drafts for a given projectId and branch", () => {
      useDraftStore.getState().setDraft(draftKey("p1", "main", "urn:A"), makeClassDraft());
      useDraftStore.getState().setDraft(draftKey("p1", "main", "urn:B"), makeClassDraft());
      useDraftStore.getState().setDraft(draftKey("p1", "dev", "urn:C"), makeClassDraft());

      useDraftStore.getState().clearAllDrafts("p1", "main");

      expect(useDraftStore.getState().getDraftIris("p1", "main")).toEqual([]);
      // Draft on the "dev" branch should remain
      expect(useDraftStore.getState().hasDraft(draftKey("p1", "dev", "urn:C"))).toBe(true);
    });

    it("does nothing when no drafts match the prefix", () => {
      useDraftStore.getState().setDraft(draftKey("p1", "main", "urn:A"), makeClassDraft());
      useDraftStore.getState().clearAllDrafts("p2", "main");
      expect(useDraftStore.getState().hasDraft(draftKey("p1", "main", "urn:A"))).toBe(true);
    });
  });

  describe("multiple draft types coexist", () => {
    it("can hold class, property, and individual drafts simultaneously", () => {
      const classKey = draftKey("p1", "main", "urn:class");
      const propKey = draftKey("p1", "main", "urn:prop");
      const indKey = draftKey("p1", "main", "urn:ind");

      useDraftStore.getState().setDraft(classKey, makeClassDraft());
      useDraftStore.getState().setDraft(propKey, makePropertyDraft());
      useDraftStore.getState().setDraft(indKey, makeIndividualDraft());

      const iris = useDraftStore.getState().getDraftIris("p1", "main");
      expect(iris).toHaveLength(3);

      const classDraft = useDraftStore.getState().getDraft(classKey) as DraftEntry;
      expect(classDraft.entityType).toBeUndefined(); // backward-compatible: no entityType for class

      const propDraft = useDraftStore.getState().getDraft(propKey) as PropertyDraftEntry;
      expect(propDraft.entityType).toBe("property");

      const indDraft = useDraftStore.getState().getDraft(indKey) as IndividualDraftEntry;
      expect(indDraft.entityType).toBe("individual");
    });
  });
});
