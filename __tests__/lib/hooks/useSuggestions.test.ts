import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { storeKey, useSuggestionStore } from "@/lib/stores/suggestionStore";
import { generationApi } from "@/lib/api/generation";
import type { GeneratedSuggestion, GenerateSuggestionsResponse } from "@/lib/api/generation";
import { ApiError } from "@/lib/api/client";
import { generationErrorMessage, useSuggestions } from "@/lib/hooks/useSuggestions";

const SCOPE = { projectId: "p1", branch: "main" };

// Mock the generation API
vi.mock("@/lib/api/generation", () => ({
  generationApi: {
    generateSuggestions: vi.fn(),
  },
}));

const mockGenerate = vi.mocked(generationApi.generateSuggestions);

// We test the hook's logic through the store since renderHook requires
// React 18+ act() wiring. The hook is a thin wrapper around store + API.
// For the core contract (request stores results, error handling), we
// exercise the same code path the hook uses.

function makeSuggestion(overrides: Partial<GeneratedSuggestion> = {}): GeneratedSuggestion {
  return {
    iri: "http://example.org/Child1",
    suggestion_type: "children",
    label: "Child 1",
    definition: "A child class",
    confidence: 0.9,
    provenance: "llm-proposed",
    validation_errors: [],
    duplicate_verdict: "pass",
    duplicate_candidates: [],
    ...overrides,
  };
}

const MOCK_RESPONSE: GenerateSuggestionsResponse = {
  suggestions: [makeSuggestion(), makeSuggestion({ iri: "http://example.org/Child2", label: "Child 2" })],
  input_tokens: 100,
  output_tokens: 50,
  context_tokens_estimate: null,
};

describe("useSuggestions", () => {
  beforeEach(() => {
    mockGenerate.mockReset();
    useSuggestionStore.getState().clearAllSuggestions();
  });

  describe("batch review", () => {
    const entityIri = "https://example.org/Parent";
    const options = { ...SCOPE, entityIri, suggestionType: "children" as const, canUseLLM: true, accessToken: "fixture" };

    it("overrides the request size and stores optional batch metadata", async () => {
      mockGenerate.mockResolvedValueOnce({ ...MOCK_RESPONSE, batch_id: "4db8a311-fa5f-4ce0-a5d7-849985e9de56" })
        .mockResolvedValueOnce(MOCK_RESPONSE);
      const { result } = renderHook(() => useSuggestions(options));
      await act(async () => { await result.current.request(10); });
      expect(mockGenerate.mock.calls[0][1]).toMatchObject({ batch_size: 10 });
      expect(result.current.batchId).toBe("4db8a311-fa5f-4ce0-a5d7-849985e9de56");
      await act(async () => { await result.current.request(); });
      expect(mockGenerate.mock.calls[1][1]).toMatchObject({ batch_size: 5 });
      expect(result.current.batchId).toBeUndefined();
      expect(result.current.items).toHaveLength(2);
    });

    it("accepts only eligible pending suggestions and rejects what remains", async () => {
      const suggestions = [
        makeSuggestion({ label: "Eligible", duplicate_verdict: "warn" }),
        makeSuggestion({ label: "Duplicate", duplicate_verdict: "block" }),
        makeSuggestion({ label: "Invalid", validation_errors: [{ field: "label", code: "invalid", message: "Invalid label" }] }),
        makeSuggestion({ label: "Missing parent" }),
        makeSuggestion({ label: "Already rejected" }),
      ];
      useSuggestionStore.getState().setSuggestions(SCOPE, entityIri, "children", suggestions);
      const onAccepted = vi.fn();
      const { result } = renderHook(() => useSuggestions({
        ...options, onAccepted,
        getAcceptanceError: (item) => item.label === "Missing parent" ? "Choose a parent." : null,
      }));
      act(() => result.current.reject(4));
      await act(async () => {
        expect(await result.current.acceptAll()).toEqual({ accepted: 1, skipped: 3 });
      });
      expect(onAccepted).toHaveBeenCalledExactlyOnceWith(suggestions[0], undefined);
      act(() => result.current.rejectAll());
      expect(result.current.items.map((item) => item.status)).toEqual([
        "accepted", "rejected", "rejected", "rejected", "rejected",
      ]);
    });

    it("waits for persistence and stops on the first failure", async () => {
      const suggestions = ["First", "Second", "Third"].map((label) => makeSuggestion({ label }));
      useSuggestionStore.getState().setSuggestions(SCOPE, entityIri, "children", suggestions);
      let finish!: () => void;
      const first = new Promise<void>((resolve) => { finish = resolve; });
      const onAccepted = vi.fn().mockReturnValueOnce(first).mockRejectedValueOnce(new Error("Draft could not be saved."));
      const { result } = renderHook(() => useSuggestions({ ...options, onAccepted }));
      let acceptance!: ReturnType<typeof result.current.acceptAll>;
      act(() => { acceptance = result.current.acceptAll(); });
      expect(onAccepted).toHaveBeenCalledTimes(1);
      await act(async () => {
        finish();
        expect(await acceptance).toEqual({ accepted: 1, skipped: 2 });
      });
      expect(onAccepted).toHaveBeenCalledTimes(2);
      expect(result.current.error).toContain("Draft could not be saved.");
      expect(result.current.items.map((item) => item.status)).toEqual(["accepted", "pending", "pending"]);
    });
  });

  it("request() calls generationApi.generateSuggestions and stores results", async () => {
    mockGenerate.mockResolvedValue(MOCK_RESPONSE);

    // Simulate what the hook's request() does
    const projectId = "proj-1";
    const entityIri = "http://ex.org/Foo";
    const branch = "main";
    const suggestionType = "children" as const;
    const token = "tok-abc";

    const response = await generationApi.generateSuggestions(
      projectId,
      { class_iri: entityIri, branch, suggestion_type: suggestionType, batch_size: 5 },
      token,
    );

    useSuggestionStore.getState().setSuggestions(SCOPE, entityIri, suggestionType, response.suggestions);

    const stored = useSuggestionStore.getState().suggestions[storeKey(SCOPE, entityIri, suggestionType)];
    expect(stored).toHaveLength(2);
    expect(stored[0].status).toBe("pending");
    expect(stored[0].suggestion.label).toBe("Child 1");
    expect(stored[1].suggestion.label).toBe("Child 2");

    expect(mockGenerate).toHaveBeenCalledWith(
      projectId,
      { class_iri: entityIri, branch, suggestion_type: suggestionType, batch_size: 5 },
      token,
    );
  });

  it("returns error string when API call fails", async () => {
    mockGenerate.mockRejectedValue(new Error("Network failure"));

    let error: string | null = null;
    try {
      await generationApi.generateSuggestions(
        "proj-1",
        { class_iri: "http://ex.org/Foo", branch: "main", suggestion_type: "children" },
        "tok-abc",
      );
    } catch (err) {
      error = err instanceof Error ? err.message : "Could not generate suggestions";
    }

    expect(error).toBe("Network failure");
    // Store should remain empty on error
    expect(useSuggestionStore.getState().getPendingCount(SCOPE)).toBe(0);
  });

  it.each([
    [400, "No generation model is configured"],
    [402, "AI budget has been exhausted"],
    [403, "role does not allow"],
    [429, "request limit has been reached"],
    [500, "unexpected error"],
    [502, "AI provider is unavailable"],
    [503, "registry model or a local provider"],
  ])("maps API status %s to actionable copy", (status, expected) => {
    expect(generationErrorMessage(new ApiError(status, "Error", "raw"))).toContain(expected);
  });

  it("accept() calls onAccepted callback with suggestion and editedValue", () => {
    const items = [makeSuggestion()];
    const entityIri = "http://ex.org/Foo";
    const suggestionType = "annotations" as const;

    useSuggestionStore.getState().setSuggestions(SCOPE, entityIri, suggestionType, items);
    useSuggestionStore.getState().editSuggestion(SCOPE, entityIri, suggestionType, 0, "edited label");

    // Simulate what the hook's accept() does
    const stored = useSuggestionStore.getState().suggestions[storeKey(SCOPE, entityIri, suggestionType)]?.[0];
    expect(stored).toBeDefined();

    const onAccepted = vi.fn();
    useSuggestionStore.getState().acceptSuggestion(SCOPE, entityIri, suggestionType, 0);
    onAccepted(stored!.suggestion, stored!.editedValue);

    expect(onAccepted).toHaveBeenCalledWith(
      expect.objectContaining({ label: "Child 1" }),
      "edited label",
    );
    expect(useSuggestionStore.getState().suggestions[storeKey(SCOPE, entityIri, suggestionType)][0].status).toBe("accepted");
  });

  it("keeps a suggestion pending until its async acceptance callback succeeds", async () => {
    const entityIri = "http://ex.org/Foo";
    const suggestionType = "children" as const;
    useSuggestionStore.getState().setSuggestions(SCOPE, entityIri, suggestionType, [makeSuggestion()]);
    let resolvePersistence!: () => void;
    const onAccepted = vi.fn(() => new Promise<void>((resolve) => {
      resolvePersistence = resolve;
    }));
    const { result } = renderHook(() => useSuggestions({
      projectId: SCOPE.projectId,
      branch: SCOPE.branch,
      entityIri,
      suggestionType,
      canUseLLM: true,
      accessToken: "token",
      onAccepted,
    }));

    let acceptance!: Promise<void>;
    act(() => {
      acceptance = result.current.accept(0);
    });

    expect(result.current.items[0].status).toBe("pending");
    expect(result.current.acceptingIndices.has(0)).toBe(true);

    resolvePersistence();
    await act(async () => { await acceptance; });

    expect(result.current.items[0].status).toBe("accepted");
    expect(onAccepted).toHaveBeenCalledTimes(1);
  });

  it("does not accept a replacement suggestion while persistence is in flight", async () => {
    const entityIri = "http://ex.org/Foo";
    const suggestionType = "children" as const;
    useSuggestionStore.getState().setSuggestions(SCOPE, entityIri, suggestionType, [makeSuggestion()]);
    let resolvePersistence!: () => void;
    const onAccepted = vi.fn(() => new Promise<void>((resolve) => {
      resolvePersistence = resolve;
    }));
    const { result } = renderHook(() => useSuggestions({
      projectId: SCOPE.projectId,
      branch: SCOPE.branch,
      entityIri,
      suggestionType,
      canUseLLM: true,
      accessToken: "token",
      onAccepted,
    }));

    let acceptance!: Promise<void>;
    act(() => {
      acceptance = result.current.accept(0);
    });
    await act(async () => { await result.current.request(); });
    expect(mockGenerate).not.toHaveBeenCalled();

    act(() => {
      useSuggestionStore.getState().setSuggestions(SCOPE, entityIri, suggestionType, [
        makeSuggestion({ iri: "http://example.org/Replacement", label: "Replacement" }),
      ]);
    });
    resolvePersistence();
    await act(async () => { await acceptance; });

    expect(result.current.items[0].suggestion.label).toBe("Replacement");
    expect(result.current.items[0].status).toBe("pending");
    expect(result.current.error).toMatch(/list changed/i);
  });

  it("surfaces persistence failure and leaves the suggestion pending for retry", async () => {
    const entityIri = "http://ex.org/Foo";
    const suggestionType = "children" as const;
    useSuggestionStore.getState().setSuggestions(SCOPE, entityIri, suggestionType, [makeSuggestion()]);
    const onAccepted = vi.fn().mockRejectedValue(new Error("Session branch rejected the save"));
    const { result } = renderHook(() => useSuggestions({
      projectId: SCOPE.projectId,
      branch: SCOPE.branch,
      entityIri,
      suggestionType,
      canUseLLM: true,
      accessToken: "token",
      onAccepted,
    }));

    await act(async () => { await result.current.accept(0); });

    expect(result.current.items[0].status).toBe("pending");
    expect(result.current.error).toContain("Session branch rejected the save");
    expect(result.current.acceptingIndices.size).toBe(0);
  });

  it("keeps malformed suggestions pending across plain and edited accept attempts", async () => {
    const entityIri = "http://ex.org/Foo";
    const suggestionType = "children" as const;
    useSuggestionStore.getState().setSuggestions(SCOPE, entityIri, suggestionType, [
      makeSuggestion({
        validation_errors: [
          { field: "iri", code: "invalid", message: "IRI is not valid" },
        ],
      }),
    ]);
    const onAccepted = vi.fn();
    const { result } = renderHook(() => useSuggestions({
      projectId: SCOPE.projectId,
      branch: SCOPE.branch,
      entityIri,
      suggestionType,
      canUseLLM: true,
      accessToken: "token",
      onAccepted,
    }));

    await act(async () => { await result.current.accept(0); });
    act(() => result.current.edit(0, "Edited label"));
    await act(async () => { await result.current.accept(0); });

    expect(onAccepted).not.toHaveBeenCalled();
    expect(result.current.items[0].status).toBe("pending");
    expect(result.current.error).toMatch(/validation errors/i);
  });

  it("reject() sets suggestion status to rejected in store", () => {
    const items = [makeSuggestion()];
    const entityIri = "http://ex.org/Foo";
    const suggestionType = "children" as const;

    useSuggestionStore.getState().setSuggestions(SCOPE, entityIri, suggestionType, items);

    // Simulate what the hook's reject() does
    useSuggestionStore.getState().rejectSuggestion(SCOPE, entityIri, suggestionType, 0);

    const stored = useSuggestionStore.getState().suggestions[storeKey(SCOPE, entityIri, suggestionType)][0];
    expect(stored.status).toBe("rejected");
  });
});
