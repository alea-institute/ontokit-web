import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import type { ReactNode } from "react";
import { useSimilarEntities } from "@/lib/hooks/useSimilarEntities";
import type { SimilarEntity } from "@/lib/api/embeddings";

vi.mock("@/lib/api/embeddings", () => ({
  embeddingsApi: {
    getSimilarEntities: vi.fn(),
  },
}));

import { embeddingsApi } from "@/lib/api/embeddings";

const mockedGetSimilar = embeddingsApi.getSimilarEntities as ReturnType<typeof vi.fn>;

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  // eslint-disable-next-line react/display-name
  return ({ children }: { children: ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

const mockResponse: SimilarEntity[] = [
  {
    iri: "http://example.org/Entity2",
    label: "Entity 2",
    entity_type: "class",
    score: 0.92,
    deprecated: false,
  },
  {
    iri: "http://example.org/Entity3",
    label: "Entity 3",
    entity_type: "class",
    score: 0.85,
    deprecated: false,
  },
];

describe("useSimilarEntities", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("is disabled when entityIri is null", () => {
    const { result } = renderHook(
      () => useSimilarEntities("proj-1", null, "token", "main"),
      { wrapper: createWrapper() },
    );
    expect(result.current.isFetching).toBe(false);
    expect(mockedGetSimilar).not.toHaveBeenCalled();
  });

  it("is disabled when projectId is empty", () => {
    const { result } = renderHook(
      () => useSimilarEntities("", "http://example.org/E", "token"),
      { wrapper: createWrapper() },
    );
    expect(result.current.isFetching).toBe(false);
    expect(mockedGetSimilar).not.toHaveBeenCalled();
  });

  it("starts in loading state when enabled", () => {
    mockedGetSimilar.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(
      () => useSimilarEntities("proj-1", "http://example.org/E", "token"),
      { wrapper: createWrapper() },
    );
    expect(result.current.isLoading).toBe(true);
  });

  it("returns data on success", async () => {
    mockedGetSimilar.mockResolvedValue(mockResponse);
    const { result } = renderHook(
      () => useSimilarEntities("proj-1", "http://example.org/E", "token", "main"),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockResponse);
    expect(mockedGetSimilar).toHaveBeenCalledWith(
      "proj-1",
      "http://example.org/E",
      "token",
      "main",
      10,
    );
  });

  it("returns error on failure", async () => {
    mockedGetSimilar.mockRejectedValue(new Error("Embeddings unavailable"));
    const { result } = renderHook(
      () => useSimilarEntities("proj-1", "http://example.org/E", "token"),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Embeddings unavailable");
  });

  it("passes custom limit parameter", async () => {
    mockedGetSimilar.mockResolvedValue(mockResponse);
    const { result } = renderHook(
      () => useSimilarEntities("proj-1", "http://example.org/E", "token", "main", 5),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedGetSimilar).toHaveBeenCalledWith(
      "proj-1",
      "http://example.org/E",
      "token",
      "main",
      5,
    );
  });

  it("works without accessToken or branch", async () => {
    mockedGetSimilar.mockResolvedValue(mockResponse);
    const { result } = renderHook(
      () => useSimilarEntities("proj-1", "http://example.org/E"),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedGetSimilar).toHaveBeenCalledWith(
      "proj-1",
      "http://example.org/E",
      undefined,
      undefined,
      10,
    );
  });

  it("is disabled when entityIri is empty string", () => {
    const { result } = renderHook(
      () => useSimilarEntities("proj-1", "", "token"),
      { wrapper: createWrapper() },
    );
    expect(result.current.isFetching).toBe(false);
    expect(mockedGetSimilar).not.toHaveBeenCalled();
  });
});
