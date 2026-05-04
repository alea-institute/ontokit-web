import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useEntityAutoSave } from "@/lib/hooks/useEntityAutoSave";
import type { AnyDraftEntry } from "@/lib/stores/draftStore";

// Mock the draft store with stable function references
const mockDrafts: Record<string, AnyDraftEntry> = {};

const stableSetDraft = (key: string, data: AnyDraftEntry) => {
  mockDrafts[key] = data;
};
const stableClearDraft = (key: string) => {
  delete mockDrafts[key];
};
const stableGetDraft = (key: string) => mockDrafts[key];

vi.mock("@/lib/stores/draftStore", () => ({
  draftKey: (projectId: string, branch: string, iri: string) =>
    `${projectId}:${branch}:${iri}`,
  useDraftStore: () => ({
    setDraft: stableSetDraft,
    clearDraft: stableClearDraft,
    getDraft: stableGetDraft,
  }),
}));

beforeEach(() => {
  for (const key of Object.keys(mockDrafts)) {
    delete mockDrafts[key];
  }
});

function makeDraftEntry(): AnyDraftEntry {
  return {
    entityType: "property",
    propertyType: "object",
    labels: [{ value: "MyProp", lang: "en" }],
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
  };
}

const BASE_OPTIONS = {
  projectId: "proj-1",
  branch: "main",
  entityIri: "http://example.org/myProp",
  canEdit: true,
  buildDraftEntry: () => makeDraftEntry(),
};

describe("useEntityAutoSave", () => {
  it("triggerSave does nothing when canEdit is false", () => {
    const { result } = renderHook(() =>
      useEntityAutoSave({ ...BASE_OPTIONS, canEdit: false }),
    );

    act(() => {
      result.current.triggerSave();
    });

    expect(result.current.saveStatus).toBe("idle");
  });

  it("triggerSave does nothing when entityIri is null", () => {
    const { result } = renderHook(() =>
      useEntityAutoSave({ ...BASE_OPTIONS, entityIri: null }),
    );

    act(() => {
      result.current.triggerSave();
    });

    expect(result.current.saveStatus).toBe("idle");
  });

  it("triggerSave stores draft and sets status to draft", () => {
    const { result } = renderHook(() => useEntityAutoSave(BASE_OPTIONS));

    act(() => {
      result.current.triggerSave();
    });

    expect(result.current.saveStatus).toBe("draft");
    expect(result.current.saveError).toBeNull();

    const key = "proj-1:main:http://example.org/myProp";
    expect(mockDrafts[key]).toBeDefined();
  });

  it("triggerSave sets validation error and aborts when validate returns error", () => {
    const validate = vi.fn().mockReturnValue("Name is required");
    const { result } = renderHook(() =>
      useEntityAutoSave({ ...BASE_OPTIONS, validate }),
    );

    act(() => {
      result.current.triggerSave();
    });

    expect(result.current.validationError).toBe("Name is required");
    expect(result.current.saveStatus).toBe("idle");
  });

  it("triggerSave clears validation error when validate passes", () => {
    const validate = vi.fn()
      .mockReturnValueOnce("Error")
      .mockReturnValueOnce(null);

    const { result } = renderHook(() =>
      useEntityAutoSave({ ...BASE_OPTIONS, validate }),
    );

    act(() => {
      result.current.triggerSave();
    });
    expect(result.current.validationError).toBe("Error");

    act(() => {
      result.current.triggerSave();
    });
    expect(result.current.validationError).toBeNull();
    expect(result.current.saveStatus).toBe("draft");
  });

  it("flushToGit calls onFlush and clears draft on success", async () => {
    const onFlush = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useEntityAutoSave({ ...BASE_OPTIONS, onFlush }),
    );

    act(() => {
      result.current.triggerSave();
    });

    let success = false;
    await act(async () => {
      success = await result.current.flushToGit();
    });

    expect(success).toBe(true);
    expect(onFlush).toHaveBeenCalledWith("http://example.org/myProp");
    expect(result.current.saveStatus).toBe("saved");

    const key = "proj-1:main:http://example.org/myProp";
    expect(mockDrafts[key]).toBeUndefined();
  });

  it("flushToGit handles errors gracefully", async () => {
    const onFlush = vi.fn().mockRejectedValue(new Error("Save failed"));
    const onError = vi.fn();
    const { result } = renderHook(() =>
      useEntityAutoSave({ ...BASE_OPTIONS, onFlush, onError }),
    );

    act(() => {
      result.current.triggerSave();
    });

    let success = true;
    await act(async () => {
      success = await result.current.flushToGit();
    });

    expect(success).toBe(false);
    expect(result.current.saveStatus).toBe("error");
    expect(result.current.saveError).toBe("Save failed");
    expect(onError).toHaveBeenCalledWith("Save failed");
  });

  it("flushToGit returns false when no draft exists", async () => {
    const onFlush = vi.fn();
    const { result } = renderHook(() =>
      useEntityAutoSave({ ...BASE_OPTIONS, onFlush }),
    );

    let success = true;
    await act(async () => {
      success = await result.current.flushToGit();
    });

    expect(success).toBe(false);
    expect(onFlush).not.toHaveBeenCalled();
  });

  it("flushToGit returns false when validation fails", async () => {
    const onFlush = vi.fn();
    const validate = vi.fn().mockReturnValue("Still invalid");
    const { result } = renderHook(() =>
      useEntityAutoSave({ ...BASE_OPTIONS, onFlush, validate }),
    );

    // Manually place a draft in the store
    const key = "proj-1:main:http://example.org/myProp";
    mockDrafts[key] = makeDraftEntry();

    let success = true;
    await act(async () => {
      success = await result.current.flushToGit();
    });

    expect(success).toBe(false);
    expect(result.current.validationError).toBe("Still invalid");
    expect(onFlush).not.toHaveBeenCalled();
  });

  it("discardDraft clears draft and resets state", () => {
    const { result } = renderHook(() => useEntityAutoSave(BASE_OPTIONS));

    act(() => {
      result.current.triggerSave();
    });
    expect(result.current.saveStatus).toBe("draft");

    act(() => {
      result.current.discardDraft();
    });

    expect(result.current.saveStatus).toBe("idle");
    expect(result.current.saveError).toBeNull();
    expect(result.current.validationError).toBeNull();
    expect(result.current.restoredDraft).toBeNull();
  });

  it("restores draft on mount when one exists in the store", () => {
    const key = "proj-1:main:http://example.org/myProp";
    mockDrafts[key] = makeDraftEntry();

    const { result } = renderHook(() => useEntityAutoSave(BASE_OPTIONS));

    expect(result.current.restoredDraft).not.toBeNull();
  });

  it("resets state when entityIri changes", () => {
    const key = "proj-1:main:http://example.org/myProp";
    mockDrafts[key] = makeDraftEntry();

    const { result, rerender } = renderHook(
      ({ entityIri }) => useEntityAutoSave({ ...BASE_OPTIONS, entityIri }),
      { initialProps: { entityIri: "http://example.org/myProp" as string | null } },
    );

    expect(result.current.restoredDraft).not.toBeNull();

    rerender({ entityIri: "http://example.org/otherProp" });
    expect(result.current.restoredDraft).toBeNull();
    expect(result.current.saveStatus).toBe("idle");
  });

  it("clearRestoredDraft clears the restored draft", () => {
    const key = "proj-1:main:http://example.org/myProp";
    mockDrafts[key] = makeDraftEntry();

    const { result } = renderHook(() => useEntityAutoSave(BASE_OPTIONS));

    expect(result.current.restoredDraft).not.toBeNull();

    // Remove from store before clearing so re-render effect doesn't re-read it
    delete mockDrafts[key];

    act(() => {
      result.current.clearRestoredDraft();
    });

    expect(result.current.restoredDraft).toBeNull();
  });
});
