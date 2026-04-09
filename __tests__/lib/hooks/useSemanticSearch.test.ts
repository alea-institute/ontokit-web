import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import type { ReactNode } from "react";
import { useSemanticSearch } from "@/lib/hooks/useSemanticSearch";
import type { SemanticSearchResponse } from "@/lib/api/embeddings";

vi.mock("@/lib/api/embeddings", () => ({
  embeddingsApi: {
    semanticSearch: vi.fn(),
  },
}));

vi.mock("@/lib/api/client", () => ({
  projectOntologyApi: {
    searchEntities: vi.fn(),
  },
}));

import { embeddingsApi } from "@/lib/api/embeddings";
import { projectOntologyApi } from "@/lib/api/client";

const mockedSemanticSearch = embeddingsApi.semanticSearch as ReturnType<typeof vi.fn>;
const mockedSearchEntities = projectOntologyApi.searchEntities as ReturnType<typeof vi.fn>;

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  // eslint-disable-next-line react/display-name
  return ({ children }: { children: ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

const semanticResponse: SemanticSearchResponse = {
  results: [
    { iri: "http://example.org/A", label: "A", entity_type: "class", score: 0.95, deprecated: false },
  ],
  search_mode: "semantic",
};

const textSearchResponse = {
  results: [
    { iri: "http://example.org/B", label: "B", entity_type: "class", deprecated: false },
  ],
  total: 1,
};

describe("useSemanticSearch", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("is disabled when enabled flag is false", () => {
    const { result } = renderHook(
      () => useSemanticSearch("proj-1", "test", false, "token", "main"),
      { wrapper: createWrapper() },
    );
    expect(result.current.isFetching).toBe(false);
    expect(mockedSemanticSearch).not.toHaveBeenCalled();
  });

  it("is disabled when query is empty", () => {
    const { result } = renderHook(
      () => useSemanticSearch("proj-1", "", true, "token"),
      { wrapper: createWrapper() },
    );
    expect(result.current.isFetching).toBe(false);
  });

  it("is disabled when query is whitespace only", () => {
    const { result } = renderHook(
      () => useSemanticSearch("proj-1", "   ", true, "token"),
      { wrapper: createWrapper() },
    );
    expect(result.current.isFetching).toBe(false);
  });

  it("is disabled when projectId is empty", () => {
    const { result } = renderHook(
      () => useSemanticSearch("", "test", true, "token"),
      { wrapper: createWrapper() },
    );
    expect(result.current.isFetching).toBe(false);
  });

  it("performs semantic search in semantic mode", async () => {
    mockedSemanticSearch.mockResolvedValue(semanticResponse);
    const { result } = renderHook(
      () => useSemanticSearch("proj-1", "test query", true, "token", "main", "semantic"),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(semanticResponse);
    expect(mockedSemanticSearch).toHaveBeenCalledWith(
      "proj-1",
      "test query",
      "token",
      "main",
      20,
    );
  });

  it("falls back to text search when semantic search fails", async () => {
    mockedSemanticSearch.mockRejectedValue(new Error("Embeddings not configured"));
    mockedSearchEntities.mockResolvedValue(textSearchResponse);

    const { result } = renderHook(
      () => useSemanticSearch("proj-1", "test query", true, "token", "main", "semantic"),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.search_mode).toBe("text_fallback");
    expect(result.current.data?.results[0].score).toBe(1);
    expect(mockedSearchEntities).toHaveBeenCalledWith(
      "proj-1",
      "test query",
      "token",
      "main",
    );
  });

  it("uses text search directly in text mode", async () => {
    mockedSearchEntities.mockResolvedValue(textSearchResponse);

    const { result } = renderHook(
      () => useSemanticSearch("proj-1", "test", true, "token", "main", "text"),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.search_mode).toBe("text_fallback");
    expect(result.current.data?.results[0].score).toBe(1);
    expect(mockedSemanticSearch).not.toHaveBeenCalled();
  });

  it("returns error when both semantic and text search fail in semantic mode", async () => {
    mockedSemanticSearch.mockRejectedValue(new Error("fail"));
    mockedSearchEntities.mockRejectedValue(new Error("also fail"));

    const { result } = renderHook(
      () => useSemanticSearch("proj-1", "test", true, "token"),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("returns error when text search fails in text mode", async () => {
    mockedSearchEntities.mockRejectedValue(new Error("text fail"));

    const { result } = renderHook(
      () => useSemanticSearch("proj-1", "test", true, "token", undefined, "text"),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
