import { describe, expect, it, beforeEach } from "vitest";
import { useSuggestionStore } from "@/lib/stores/suggestionStore";
import {
  duplicateVerdictForScore,
  type GeneratedSuggestion,
} from "@/lib/api/generation";

const SCOPE = { projectId: "p1", branch: "main" };

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

  it("keeps duplicate verdict thresholds aligned with the API contract", () => {
    expect(duplicateVerdictForScore(0.950001)).toBe("block");
    expect(duplicateVerdictForScore(0.95)).toBe("warn");
    expect(duplicateVerdictForScore(0.800001)).toBe("warn");
    expect(duplicateVerdictForScore(0.8)).toBe("pass");
  });

  it("setSuggestions stores suggestions keyed by entityIri::suggestionType", () => {
    const items = [makeSuggestion(), makeSuggestion({ iri: "http://example.org/Child2", label: "Child 2" })];
    useSuggestionStore.getState().setSuggestions(SCOPE, "http://ex.org/Foo", "annotations", items);

    const stored = useSuggestionStore.getState().suggestions["p1::main::http://ex.org/Foo::annotations"];
    expect(stored).toHaveLength(2);
    expect(stored[0].status).toBe("pending");
    expect(stored[0].suggestion.label).toBe("Child 1");
    expect(stored[1].status).toBe("pending");
    expect(stored[1].suggestion.label).toBe("Child 2");
  });

  it("keeps identical IRIs isolated across projects and branches", () => {
    const otherProject = { projectId: "p2", branch: "main" };
    const otherBranch = { projectId: "p1", branch: "draft" };
    const iri = "http://ex.org/Foo";

    useSuggestionStore.getState().setSuggestions(SCOPE, iri, "children", [makeSuggestion({ label: "P1" })]);
    useSuggestionStore.getState().setSuggestions(otherProject, iri, "children", [makeSuggestion({ label: "P2" })]);
    useSuggestionStore.getState().setSuggestions(otherBranch, iri, "children", [makeSuggestion({ label: "Draft" })]);

    expect(useSuggestionStore.getState().getPendingSuggestions(SCOPE, iri, "children")[0].suggestion.label).toBe("P1");
    expect(useSuggestionStore.getState().getPendingSuggestions(otherProject, iri, "children")[0].suggestion.label).toBe("P2");
    expect(useSuggestionStore.getState().getPendingSuggestions(otherBranch, iri, "children")[0].suggestion.label).toBe("Draft");
  });

  it("acceptSuggestion changes status to accepted", () => {
    const items = [makeSuggestion()];
    useSuggestionStore.getState().setSuggestions(SCOPE, "http://ex.org/Foo", "annotations", items);
    useSuggestionStore.getState().acceptSuggestion(SCOPE, "http://ex.org/Foo", "annotations", 0);

    const stored = useSuggestionStore.getState().suggestions["p1::main::http://ex.org/Foo::annotations"];
    expect(stored[0].status).toBe("accepted");
  });

  it("rejectSuggestion changes status to rejected", () => {
    const items = [makeSuggestion()];
    useSuggestionStore.getState().setSuggestions(SCOPE, "http://ex.org/Foo", "annotations", items);
    useSuggestionStore.getState().rejectSuggestion(SCOPE, "http://ex.org/Foo", "annotations", 0);

    const stored = useSuggestionStore.getState().suggestions["p1::main::http://ex.org/Foo::annotations"];
    expect(stored[0].status).toBe("rejected");
  });

  it("removes a marked-distinct candidate and recalculates the duplicate verdict", () => {
    useSuggestionStore.getState().setSuggestions(SCOPE, "http://ex.org/Foo", "children", [
      makeSuggestion({
        duplicate_verdict: "block",
        duplicate_candidates: [
          { iri: "http://ex.org/Blocker", label: "Blocker", score: 0.98 },
          { iri: "http://ex.org/Warning", label: "Warning", score: 0.9 },
        ],
      }),
    ]);

    useSuggestionStore.getState().removeDuplicateCandidate(
      SCOPE,
      "http://ex.org/Foo",
      "children",
      0,
      { iri: "http://ex.org/Blocker", branch: undefined },
    );

    let suggestion = useSuggestionStore.getState()
      .suggestions["p1::main::http://ex.org/Foo::children"][0].suggestion;
    expect(suggestion.duplicate_candidates.map((candidate) => candidate.iri)).toEqual([
      "http://ex.org/Warning",
    ]);
    expect(suggestion.duplicate_verdict).toBe("warn");

    useSuggestionStore.getState().removeDuplicateCandidate(
      SCOPE,
      "http://ex.org/Foo",
      "children",
      0,
      { iri: "http://ex.org/Warning", branch: undefined },
    );
    suggestion = useSuggestionStore.getState()
      .suggestions["p1::main::http://ex.org/Foo::children"][0].suggestion;
    expect(suggestion.duplicate_candidates).toEqual([]);
    expect(suggestion.duplicate_verdict).toBe("pass");
  });

  it("removes only the reviewed branch occurrence when the same IRI appears on two branches", () => {
    useSuggestionStore.getState().setSuggestions(SCOPE, "http://ex.org/Foo", "children", [
      makeSuggestion({
        duplicate_verdict: "block",
        duplicate_candidates: [
          {
            iri: "http://ex.org/Shared",
            label: "Shared on main",
            score: 0.98,
            branch: "main",
          },
          {
            iri: "http://ex.org/Shared",
            label: "Shared on review",
            score: 0.9,
            branch: "review",
          },
        ],
      }),
    ]);

    useSuggestionStore.getState().removeDuplicateCandidate(
      SCOPE,
      "http://ex.org/Foo",
      "children",
      0,
      { iri: "http://ex.org/Shared", branch: "main" },
    );

    const suggestion = useSuggestionStore.getState()
      .suggestions["p1::main::http://ex.org/Foo::children"][0].suggestion;
    expect(suggestion.duplicate_candidates).toEqual([
      expect.objectContaining({
        iri: "http://ex.org/Shared",
        branch: "review",
        score: 0.9,
      }),
    ]);
    expect(suggestion.duplicate_verdict).toBe("warn");
  });

  it("editSuggestion sets editedValue on the stored suggestion", () => {
    const items = [makeSuggestion()];
    useSuggestionStore.getState().setSuggestions(SCOPE, "http://ex.org/Foo", "annotations", items);
    useSuggestionStore.getState().editSuggestion(SCOPE, "http://ex.org/Foo", "annotations", 0, "new val");

    const stored = useSuggestionStore.getState().suggestions["p1::main::http://ex.org/Foo::annotations"];
    expect(stored[0].editedValue).toBe("new val");
  });

  it("getPendingCount returns count of suggestions with status pending", () => {
    const items = [makeSuggestion(), makeSuggestion({ label: "B" }), makeSuggestion({ label: "C" })];
    useSuggestionStore.getState().setSuggestions(SCOPE, "http://ex.org/Foo", "children", items);
    useSuggestionStore.getState().setSuggestions(SCOPE, "http://ex.org/Bar", "annotations", [makeSuggestion()]);

    // Accept one, reject one
    useSuggestionStore.getState().acceptSuggestion(SCOPE, "http://ex.org/Foo", "children", 0);
    useSuggestionStore.getState().rejectSuggestion(SCOPE, "http://ex.org/Foo", "children", 1);

    // 1 pending in Foo::children + 1 pending in Bar::annotations = 2
    expect(useSuggestionStore.getState().getPendingCount(SCOPE)).toBe(2);
  });

  it("getPendingCount excludes other projects and branches", () => {
    useSuggestionStore.getState().setSuggestions(SCOPE, "http://ex.org/Foo", "children", [makeSuggestion()]);
    useSuggestionStore.getState().setSuggestions({ projectId: "p2", branch: "main" }, "http://ex.org/Foo", "children", [makeSuggestion()]);
    useSuggestionStore.getState().setSuggestions({ projectId: "p1", branch: "draft" }, "http://ex.org/Foo", "children", [makeSuggestion()]);

    expect(useSuggestionStore.getState().getPendingCount(SCOPE)).toBe(1);
    expect(useSuggestionStore.getState().getPendingCount({ projectId: "p2", branch: "main" })).toBe(1);
    expect(useSuggestionStore.getState().getPendingCount({ projectId: "p1", branch: "draft" })).toBe(1);
  });

  it("clearAllSuggestions empties the entire store", () => {
    useSuggestionStore.getState().setSuggestions(SCOPE, "http://ex.org/Foo", "children", [makeSuggestion()]);
    useSuggestionStore.getState().setSuggestions(SCOPE, "http://ex.org/Bar", "annotations", [makeSuggestion()]);

    useSuggestionStore.getState().clearAllSuggestions();

    expect(useSuggestionStore.getState().suggestions).toEqual({});
  });

  it("getFirstPendingRef returns the key of the first entity with pending suggestions", () => {
    useSuggestionStore.getState().setSuggestions(SCOPE, "http://ex.org/Foo", "children", [makeSuggestion()]);
    // Accept all in Foo::children so there are no pending there
    useSuggestionStore.getState().acceptSuggestion(SCOPE, "http://ex.org/Foo", "children", 0);

    useSuggestionStore.getState().setSuggestions(SCOPE, "http://ex.org/Bar", "annotations", [makeSuggestion()]);

    // Foo has no pending, Bar has 1 pending
    const ref = useSuggestionStore.getState().getFirstPendingRef();
    expect(ref).toBe("p1::main::http://ex.org/Bar::annotations");
  });

  it("getFirstPendingRef returns null when no pending suggestions exist", () => {
    expect(useSuggestionStore.getState().getFirstPendingRef()).toBeNull();

    useSuggestionStore.getState().setSuggestions(SCOPE, "http://ex.org/Foo", "children", [makeSuggestion()]);
    useSuggestionStore.getState().acceptSuggestion(SCOPE, "http://ex.org/Foo", "children", 0);

    expect(useSuggestionStore.getState().getFirstPendingRef()).toBeNull();
  });
});

describe("suggestionStore provenance tracking", () => {
  beforeEach(() => {
    useSuggestionStore.getState().clearAllSuggestions();
  });

  it("editSuggestion flips provenance to user-edited-from-llm when the text changes", () => {
    useSuggestionStore.getState().setSuggestions(SCOPE, "http://ex.org/Foo", "children", [makeSuggestion()]);

    useSuggestionStore.getState().editSuggestion(SCOPE, "http://ex.org/Foo", "children", 0, "Renamed Child");

    const item = useSuggestionStore.getState().suggestions["p1::main::http://ex.org/Foo::children"][0];
    expect(item.editedValue).toBe("Renamed Child");
    expect(item.suggestion.provenance).toBe("user-edited-from-llm");
  });

  it("editSuggestion back to the original text restores llm-proposed and clears editedValue", () => {
    useSuggestionStore.getState().setSuggestions(SCOPE, "http://ex.org/Foo", "children", [makeSuggestion()]);
    useSuggestionStore.getState().editSuggestion(SCOPE, "http://ex.org/Foo", "children", 0, "Renamed Child");

    // Restore the exact original label
    useSuggestionStore.getState().editSuggestion(SCOPE, "http://ex.org/Foo", "children", 0, "Child 1");

    const item = useSuggestionStore.getState().suggestions["p1::main::http://ex.org/Foo::children"][0];
    expect(item.editedValue).toBeUndefined();
    expect(item.suggestion.provenance).toBe("llm-proposed");
  });

  it("editSuggestion on an annotation compares against value, not label", () => {
    useSuggestionStore.getState().setSuggestions(SCOPE, "http://ex.org/Foo", "annotations", [
      makeSuggestion({
        suggestion_type: "annotations",
        property_iri: "http://www.w3.org/2000/01/rdf-schema#label",
        value: "Original value",
      }),
    ]);

    // Same as value → no provenance flip
    useSuggestionStore.getState().editSuggestion(SCOPE, "http://ex.org/Foo", "annotations", 0, "Original value");
    let item = useSuggestionStore.getState().suggestions["p1::main::http://ex.org/Foo::annotations"][0];
    expect(item.suggestion.provenance).toBe("llm-proposed");

    // Different from value → flip
    useSuggestionStore.getState().editSuggestion(SCOPE, "http://ex.org/Foo", "annotations", 0, "New value");
    item = useSuggestionStore.getState().suggestions["p1::main::http://ex.org/Foo::annotations"][0];
    expect(item.suggestion.provenance).toBe("user-edited-from-llm");
    expect(item.editedValue).toBe("New value");
  });

  it("model and prompt_template provenance metadata survive the store round-trip", () => {
    useSuggestionStore.getState().setSuggestions(SCOPE, "http://ex.org/Foo", "children", [
      makeSuggestion({ model: "gpt-4o-mini", prompt_template: "children" }),
    ]);
    useSuggestionStore.getState().editSuggestion(SCOPE, "http://ex.org/Foo", "children", 0, "Renamed");

    const item = useSuggestionStore.getState().suggestions["p1::main::http://ex.org/Foo::children"][0];
    expect(item.suggestion.model).toBe("gpt-4o-mini");
    expect(item.suggestion.prompt_template).toBe("children");
  });
});
