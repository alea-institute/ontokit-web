import { describe, expect, it, vi, beforeEach } from "vitest";
import { api } from "@/lib/api/client";

// Mock the api module
vi.mock("@/lib/api/client", () => ({
  api: {
    post: vi.fn(),
  },
}));

const mockPost = vi.mocked(api.post);

import {
  generationApi,
  type GenerateSuggestionsRequest,
  type GenerateSuggestionsResponse,
  type GeneratedSuggestion,
  type SuggestionType,
  type Provenance,
  type ValidationError,
  type DuplicateCandidate,
  type DuplicateVerdict,
} from "@/lib/api/generation";

const MOCK_RESPONSE: GenerateSuggestionsResponse = {
  suggestions: [
    {
      iri: "http://example.org/Foo",
      suggestion_type: "children",
      label: "Foo Child",
      definition: "A child of Foo",
      confidence: 0.85,
      provenance: "llm-proposed",
      validation_errors: [],
      duplicate_verdict: "pass",
      duplicate_candidates: [],
    },
  ],
  input_tokens: 100,
  output_tokens: 50,
  context_tokens_estimate: null,
};

describe("generationApi", () => {
  beforeEach(() => {
    mockPost.mockReset();
  });

  it("generateSuggestions sends POST with correct path and body", async () => {
    mockPost.mockResolvedValue(MOCK_RESPONSE);

    const data: GenerateSuggestionsRequest = {
      class_iri: "http://example.org/Foo",
      branch: "main",
      suggestion_type: "children",
      batch_size: 5,
    };

    await generationApi.generateSuggestions("proj-1", data, "tok-abc");

    expect(mockPost).toHaveBeenCalledTimes(1);
    const [url, body, options] = mockPost.mock.calls[0];
    expect(url).toBe("/api/v1/projects/proj-1/llm/generate-suggestions");
    expect(body).toEqual(data);
    expect(options?.headers).toEqual(
      expect.objectContaining({ Authorization: "Bearer tok-abc" })
    );
  });

  it("generateSuggestions includes X-BYO-API-Key header when byoKey provided", async () => {
    mockPost.mockResolvedValue(MOCK_RESPONSE);

    const data: GenerateSuggestionsRequest = {
      class_iri: "http://example.org/Foo",
      branch: "main",
      suggestion_type: "annotations",
    };

    await generationApi.generateSuggestions(
      "proj-1",
      data,
      "tok-abc",
      "sk-user-key"
    );

    const [, , options] = mockPost.mock.calls[0];
    expect(options?.headers).toEqual(
      expect.objectContaining({ "X-BYO-API-Key": "sk-user-key" })
    );
  });

  it("generateSuggestions omits X-BYO-API-Key header when byoKey is undefined", async () => {
    mockPost.mockResolvedValue(MOCK_RESPONSE);

    const data: GenerateSuggestionsRequest = {
      class_iri: "http://example.org/Bar",
      branch: "main",
      suggestion_type: "siblings",
    };

    await generationApi.generateSuggestions("proj-2", data, "tok-xyz");

    const [, , options] = mockPost.mock.calls[0];
    const headers = options?.headers as Record<string, string>;
    expect(headers).not.toHaveProperty("X-BYO-API-Key");
  });

  it("generateSuggestions returns GenerateSuggestionsResponse shape", async () => {
    mockPost.mockResolvedValue(MOCK_RESPONSE);

    const data: GenerateSuggestionsRequest = {
      class_iri: "http://example.org/Foo",
      branch: "main",
      suggestion_type: "children",
    };

    const result = await generationApi.generateSuggestions(
      "proj-1",
      data,
      "tok-abc"
    );

    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0].iri).toBe("http://example.org/Foo");
    expect(result.suggestions[0].suggestion_type).toBe("children");
    expect(result.suggestions[0].provenance).toBe("llm-proposed");
    expect(result.input_tokens).toBe(100);
    expect(result.output_tokens).toBe(50);
  });
});
