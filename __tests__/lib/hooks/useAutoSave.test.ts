import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAutoSave } from "@/lib/hooks/useAutoSave";
import type { OWLClassDetail } from "@/lib/api/client";
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

function makeClassDetail(overrides: Partial<OWLClassDetail> = {}): OWLClassDetail {
  return {
    iri: "http://example.org/MyClass",
    labels: [{ value: "MyClass", lang: "en" }],
    comments: [],
    parent_iris: [],
    annotations: [],
    deprecated: false,
    equivalent_iris: [],
    disjoint_iris: [],
    ...overrides,
  } as OWLClassDetail;
}

const BASE_OPTIONS = {
  projectId: "proj-1",
  branch: "main",
  classIri: "http://example.org/MyClass",
  classDetail: makeClassDetail(),
  canEdit: true,
};

function setEditState(
  result: { current: ReturnType<typeof useAutoSave> },
  labels: Array<{ value: string; lang: string }>,
) {
  result.current.editStateRef.current = {
    labels,
    comments: [],
    parentIris: [],
    parentLabels: {},
    annotations: [],
    relationships: [],
  };
}

describe("useAutoSave", () => {
  it("triggerSave does nothing when canEdit is false and saveMode is commit", () => {
    const { result } = renderHook(() =>
      useAutoSave({ ...BASE_OPTIONS, canEdit: false }),
    );

    act(() => {
      setEditState(result, [{ value: "Test", lang: "en" }]);
      result.current.triggerSave();
    });

    expect(result.current.saveStatus).toBe("idle");
  });

  it("triggerSave works when canEdit is false but saveMode is suggest", () => {
    const { result } = renderHook(() =>
      useAutoSave({ ...BASE_OPTIONS, canEdit: false, saveMode: "suggest" }),
    );

    act(() => {
      setEditState(result, [{ value: "Test", lang: "en" }]);
      result.current.triggerSave();
    });

    expect(result.current.saveStatus).toBe("draft");
  });

  it("triggerSave sets validation error when labels are empty", () => {
    const { result } = renderHook(() => useAutoSave(BASE_OPTIONS));

    act(() => {
      setEditState(result, [{ value: "", lang: "en" }]);
      result.current.triggerSave();
    });

    expect(result.current.validationError).toBe("At least one label is required");
    expect(result.current.saveStatus).toBe("idle");
  });

  it("triggerSave stores draft and sets status to draft", () => {
    const { result } = renderHook(() => useAutoSave(BASE_OPTIONS));

    act(() => {
      setEditState(result, [{ value: "MyClass", lang: "en" }]);
      result.current.triggerSave();
    });

    expect(result.current.saveStatus).toBe("draft");
    expect(result.current.saveError).toBeNull();

    const key = "proj-1:main:http://example.org/MyClass";
    expect(mockDrafts[key]).toBeDefined();
    expect(mockDrafts[key].labels[0].value).toBe("MyClass");
  });

  it("flushToGit calls onUpdateClass and clears draft on success", async () => {
    const onUpdateClass = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useAutoSave({ ...BASE_OPTIONS, onUpdateClass }),
    );

    act(() => {
      setEditState(result, [{ value: "MyClass", lang: "en" }]);
      result.current.triggerSave();
    });

    let success = false;
    await act(async () => {
      success = await result.current.flushToGit();
    });

    expect(success).toBe(true);
    expect(onUpdateClass).toHaveBeenCalledWith(
      "http://example.org/MyClass",
      expect.objectContaining({
        labels: [{ value: "MyClass", lang: "en" }],
      }),
    );
    expect(result.current.saveStatus).toBe("saved");

    const key = "proj-1:main:http://example.org/MyClass";
    expect(mockDrafts[key]).toBeUndefined();
  });

  it("flushToGit handles errors gracefully", async () => {
    const onUpdateClass = vi.fn().mockRejectedValue(new Error("Network error"));
    const onError = vi.fn();
    const { result } = renderHook(() =>
      useAutoSave({ ...BASE_OPTIONS, onUpdateClass, onError }),
    );

    act(() => {
      setEditState(result, [{ value: "MyClass", lang: "en" }]);
      result.current.triggerSave();
    });

    let success = true;
    await act(async () => {
      success = await result.current.flushToGit();
    });

    expect(success).toBe(false);
    expect(result.current.saveStatus).toBe("error");
    expect(result.current.saveError).toBe("Network error");
    expect(onError).toHaveBeenCalledWith("Network error");
  });

  it("flushToGit returns false when no draft exists", async () => {
    const onUpdateClass = vi.fn();
    const { result } = renderHook(() =>
      useAutoSave({ ...BASE_OPTIONS, onUpdateClass }),
    );

    let success = true;
    await act(async () => {
      success = await result.current.flushToGit();
    });

    expect(success).toBe(false);
    expect(onUpdateClass).not.toHaveBeenCalled();
  });

  it("flushToGit uses onSuggestSave when saveMode is suggest", async () => {
    const onSuggestSave = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useAutoSave({
        ...BASE_OPTIONS,
        saveMode: "suggest",
        onSuggestSave,
      }),
    );

    act(() => {
      setEditState(result, [{ value: "MyClass", lang: "en" }]);
      result.current.triggerSave();
    });

    await act(async () => {
      await result.current.flushToGit();
    });

    expect(onSuggestSave).toHaveBeenCalledWith(
      "http://example.org/MyClass",
      expect.any(Object),
      "MyClass",
    );
  });

  it("discardDraft clears draft and resets state", () => {
    const { result } = renderHook(() => useAutoSave(BASE_OPTIONS));

    act(() => {
      setEditState(result, [{ value: "MyClass", lang: "en" }]);
      result.current.triggerSave();
    });

    expect(result.current.saveStatus).toBe("draft");

    act(() => {
      result.current.discardDraft();
    });

    expect(result.current.saveStatus).toBe("idle");
    expect(result.current.saveError).toBeNull();
    expect(result.current.validationError).toBeNull();

    const key = "proj-1:main:http://example.org/MyClass";
    expect(mockDrafts[key]).toBeUndefined();
  });

  it("restores draft on mount when one exists in the store", () => {
    const key = "proj-1:main:http://example.org/MyClass";
    mockDrafts[key] = {
      labels: [{ value: "Restored", lang: "en" }],
      comments: [],
      parentIris: [],
      parentLabels: {},
      annotations: [],
      relationships: [],
      updatedAt: Date.now(),
    };

    const { result } = renderHook(() => useAutoSave(BASE_OPTIONS));

    expect(result.current.restoredDraft).not.toBeNull();
    expect(result.current.restoredDraft!.labels[0].value).toBe("Restored");
  });

  it("resets state when classIri changes", () => {
    const key = "proj-1:main:http://example.org/MyClass";
    mockDrafts[key] = {
      labels: [{ value: "Draft", lang: "en" }],
      comments: [],
      parentIris: [],
      parentLabels: {},
      annotations: [],
      relationships: [],
      updatedAt: Date.now(),
    };

    const { result, rerender } = renderHook(
      ({ classIri }) => useAutoSave({ ...BASE_OPTIONS, classIri }),
      { initialProps: { classIri: "http://example.org/MyClass" as string | null } },
    );

    expect(result.current.restoredDraft).not.toBeNull();

    rerender({ classIri: "http://example.org/OtherClass" });

    expect(result.current.restoredDraft).toBeNull();
    expect(result.current.saveStatus).toBe("idle");
  });

  it("clearRestoredDraft clears the restored draft", () => {
    const key = "proj-1:main:http://example.org/MyClass";
    mockDrafts[key] = {
      labels: [{ value: "Draft", lang: "en" }],
      comments: [],
      parentIris: [],
      parentLabels: {},
      annotations: [],
      relationships: [],
      updatedAt: Date.now(),
    };

    const { result } = renderHook(() => useAutoSave(BASE_OPTIONS));

    expect(result.current.restoredDraft).not.toBeNull();

    // Clear the store before calling clearRestoredDraft so the
    // re-render effect doesn't re-read it
    delete mockDrafts[key];

    act(() => {
      result.current.clearRestoredDraft();
    });

    expect(result.current.restoredDraft).toBeNull();
  });
});
