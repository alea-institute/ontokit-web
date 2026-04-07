import { describe, expect, it, beforeEach } from "vitest";
import { useSuggestionStore } from "@/lib/stores/suggestionStore";
import type { GeneratedSuggestion } from "@/lib/api/generation";

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

describe("suggestionStore", () => {
  beforeEach(() => {
    // Reset store between tests
    useSuggestionStore.getState().clearAllSuggestions();
  });

  it("setSuggestions stores suggestions keyed by entityIri::suggestionType", () => {
    const items = [makeSuggestion(), makeSuggestion({ iri: "http://example.org/Child2", label: "Child 2" })];
    useSuggestionStore.getState().setSuggestions("http://ex.org/Foo", "annotations", items);

    const stored = useSuggestionStore.getState().suggestions["http://ex.org/Foo::annotations"];
    expect(stored).toHaveLength(2);
    expect(stored[0].status).toBe("pending");
    expect(stored[0].suggestion.label).toBe("Child 1");
    expect(stored[1].status).toBe("pending");
    expect(stored[1].suggestion.label).toBe("Child 2");
  });

  it("acceptSuggestion changes status to accepted", () => {
    const items = [makeSuggestion()];
    useSuggestionStore.getState().setSuggestions("http://ex.org/Foo", "annotations", items);
    useSuggestionStore.getState().acceptSuggestion("http://ex.org/Foo", "annotations", 0);

    const stored = useSuggestionStore.getState().suggestions["http://ex.org/Foo::annotations"];
    expect(stored[0].status).toBe("accepted");
  });

  it("rejectSuggestion changes status to rejected", () => {
    const items = [makeSuggestion()];
    useSuggestionStore.getState().setSuggestions("http://ex.org/Foo", "annotations", items);
    useSuggestionStore.getState().rejectSuggestion("http://ex.org/Foo", "annotations", 0);

    const stored = useSuggestionStore.getState().suggestions["http://ex.org/Foo::annotations"];
    expect(stored[0].status).toBe("rejected");
  });

  it("editSuggestion sets editedValue on the stored suggestion", () => {
    const items = [makeSuggestion()];
    useSuggestionStore.getState().setSuggestions("http://ex.org/Foo", "annotations", items);
    useSuggestionStore.getState().editSuggestion("http://ex.org/Foo", "annotations", 0, "new val");

    const stored = useSuggestionStore.getState().suggestions["http://ex.org/Foo::annotations"];
    expect(stored[0].editedValue).toBe("new val");
  });

  it("getPendingCount returns count of suggestions with status pending", () => {
    const items = [makeSuggestion(), makeSuggestion({ label: "B" }), makeSuggestion({ label: "C" })];
    useSuggestionStore.getState().setSuggestions("http://ex.org/Foo", "children", items);
    useSuggestionStore.getState().setSuggestions("http://ex.org/Bar", "annotations", [makeSuggestion()]);

    // Accept one, reject one
    useSuggestionStore.getState().acceptSuggestion("http://ex.org/Foo", "children", 0);
    useSuggestionStore.getState().rejectSuggestion("http://ex.org/Foo", "children", 1);

    // 1 pending in Foo::children + 1 pending in Bar::annotations = 2
    expect(useSuggestionStore.getState().getPendingCount()).toBe(2);
  });

  it("clearSuggestions removes all suggestions for a given entityIri", () => {
    useSuggestionStore.getState().setSuggestions("http://ex.org/Foo", "children", [makeSuggestion()]);
    useSuggestionStore.getState().setSuggestions("http://ex.org/Foo", "annotations", [makeSuggestion()]);
    useSuggestionStore.getState().setSuggestions("http://ex.org/Bar", "children", [makeSuggestion()]);

    useSuggestionStore.getState().clearSuggestions("http://ex.org/Foo");

    const state = useSuggestionStore.getState().suggestions;
    expect(state["http://ex.org/Foo::children"]).toBeUndefined();
    expect(state["http://ex.org/Foo::annotations"]).toBeUndefined();
    expect(state["http://ex.org/Bar::children"]).toHaveLength(1);
  });

  it("clearAllSuggestions empties the entire store", () => {
    useSuggestionStore.getState().setSuggestions("http://ex.org/Foo", "children", [makeSuggestion()]);
    useSuggestionStore.getState().setSuggestions("http://ex.org/Bar", "annotations", [makeSuggestion()]);

    useSuggestionStore.getState().clearAllSuggestions();

    expect(useSuggestionStore.getState().suggestions).toEqual({});
  });

  it("getFirstPendingRef returns the key of the first entity with pending suggestions", () => {
    useSuggestionStore.getState().setSuggestions("http://ex.org/Foo", "children", [makeSuggestion()]);
    // Accept all in Foo::children so there are no pending there
    useSuggestionStore.getState().acceptSuggestion("http://ex.org/Foo", "children", 0);

    useSuggestionStore.getState().setSuggestions("http://ex.org/Bar", "annotations", [makeSuggestion()]);

    // Foo has no pending, Bar has 1 pending
    const ref = useSuggestionStore.getState().getFirstPendingRef();
    expect(ref).toBe("http://ex.org/Bar::annotations");
  });

  it("getFirstPendingRef returns null when no pending suggestions exist", () => {
    expect(useSuggestionStore.getState().getFirstPendingRef()).toBeNull();

    useSuggestionStore.getState().setSuggestions("http://ex.org/Foo", "children", [makeSuggestion()]);
    useSuggestionStore.getState().acceptSuggestion("http://ex.org/Foo", "children", 0);

    expect(useSuggestionStore.getState().getFirstPendingRef()).toBeNull();
  });
});
