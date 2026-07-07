import { describe, it, expect } from "vitest";
import { provenanceFromSuggestion } from "@/lib/ontology/suggestionProvenance";

describe("provenanceFromSuggestion", () => {
  it("stamps llm-proposed suggestions with model and prompt template", () => {
    expect(
      provenanceFromSuggestion({
        provenance: "llm-proposed",
        model: "openai/gpt-4o",
        prompt_template: "children",
      }),
    ).toEqual({ model: "openai/gpt-4o", promptTemplate: "children" });
  });

  it("keeps the AI origin for user-edited-from-llm suggestions", () => {
    expect(
      provenanceFromSuggestion({
        provenance: "user-edited-from-llm",
        model: "claude-sonnet-4-5",
        prompt_template: "siblings",
      }),
    ).toEqual({ model: "claude-sonnet-4-5", promptTemplate: "siblings" });
  });

  it("never stamps user-written suggestions", () => {
    expect(
      provenanceFromSuggestion({
        provenance: "user-written",
        model: "openai/gpt-4o",
        prompt_template: "children",
      }),
    ).toBeUndefined();
  });

  it("skips persistence when the model id is missing (no anonymous agents)", () => {
    expect(
      provenanceFromSuggestion({ provenance: "llm-proposed", model: null, prompt_template: "children" }),
    ).toBeUndefined();
    expect(
      provenanceFromSuggestion({ provenance: "llm-proposed", model: "", prompt_template: "children" }),
    ).toBeUndefined();
    expect(
      provenanceFromSuggestion({ provenance: "llm-proposed" }),
    ).toBeUndefined();
  });

  it("omits promptTemplate when absent instead of emitting null", () => {
    expect(
      provenanceFromSuggestion({ provenance: "llm-proposed", model: "m", prompt_template: null }),
    ).toEqual({ model: "m", promptTemplate: undefined });
  });
});
