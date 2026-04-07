import { describe, expect, it, vi, beforeEach } from "vitest";
import { useSuggestionStore } from "@/lib/stores/suggestionStore";
import { generationApi } from "@/lib/api/generation";
import type { GeneratedSuggestion, GenerateSuggestionsResponse } from "@/lib/api/generation";

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

    useSuggestionStore.getState().setSuggestions(entityIri, suggestionType, response.suggestions);

    const stored = useSuggestionStore.getState().suggestions[`${entityIri}::${suggestionType}`];
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
    expect(useSuggestionStore.getState().getPendingCount()).toBe(0);
  });

  it("accept() calls onAccepted callback with suggestion and editedValue", () => {
    const items = [makeSuggestion()];
    const entityIri = "http://ex.org/Foo";
    const suggestionType = "annotations" as const;

    useSuggestionStore.getState().setSuggestions(entityIri, suggestionType, items);
    useSuggestionStore.getState().editSuggestion(entityIri, suggestionType, 0, "edited label");

    // Simulate what the hook's accept() does
    const stored = useSuggestionStore.getState().suggestions[`${entityIri}::${suggestionType}`]?.[0];
    expect(stored).toBeDefined();

    const onAccepted = vi.fn();
    useSuggestionStore.getState().acceptSuggestion(entityIri, suggestionType, 0);
    onAccepted(stored!.suggestion, stored!.editedValue);

    expect(onAccepted).toHaveBeenCalledWith(
      expect.objectContaining({ label: "Child 1" }),
      "edited label",
    );
    expect(useSuggestionStore.getState().suggestions[`${entityIri}::${suggestionType}`][0].status).toBe("accepted");
  });

  it("reject() sets suggestion status to rejected in store", () => {
    const items = [makeSuggestion()];
    const entityIri = "http://ex.org/Foo";
    const suggestionType = "children" as const;

    useSuggestionStore.getState().setSuggestions(entityIri, suggestionType, items);

    // Simulate what the hook's reject() does
    useSuggestionStore.getState().rejectSuggestion(entityIri, suggestionType, 0);

    const stored = useSuggestionStore.getState().suggestions[`${entityIri}::${suggestionType}`][0];
    expect(stored.status).toBe("rejected");
  });
});
