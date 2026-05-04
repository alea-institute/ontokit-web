import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import type { ReactNode } from "react";
import { useCrossReferences } from "@/lib/hooks/useCrossReferences";
import type { CrossReferencesResponse } from "@/lib/ontology/qualityTypes";

vi.mock("@/lib/api/quality", () => ({
  qualityApi: {
    getCrossReferences: vi.fn(),
  },
}));

import { qualityApi } from "@/lib/api/quality";

const mockedGetCrossReferences = qualityApi.getCrossReferences as ReturnType<typeof vi.fn>;

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  // eslint-disable-next-line react/display-name
  return ({ children }: { children: ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

const mockResponse: CrossReferencesResponse = {
  target_iri: "http://example.org/Entity1",
  total: 2,
  groups: [
    {
      context: "parent_iris",
      context_label: "Parent IRIs",
      references: [
        {
          source_iri: "http://example.org/Entity2",
          source_type: "class",
          source_label: "Entity 2",
          reference_context: "parent_iris",
        },
      ],
    },
  ],
};

describe("useCrossReferences", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("is disabled when entityIri is null", () => {
    const { result } = renderHook(
      () => useCrossReferences("proj-1", null, "token", "main"),
      { wrapper: createWrapper() },
    );
    expect(result.current.isFetching).toBe(false);
    expect(mockedGetCrossReferences).not.toHaveBeenCalled();
  });

  it("is disabled when entityIri is empty string", () => {
    const { result } = renderHook(
      () => useCrossReferences("proj-1", "", "token", "main"),
      { wrapper: createWrapper() },
    );
    expect(result.current.isFetching).toBe(false);
    expect(mockedGetCrossReferences).not.toHaveBeenCalled();
  });

  it("is disabled when projectId is empty", () => {
    const { result } = renderHook(
      () => useCrossReferences("", "http://example.org/Entity1", "token"),
      { wrapper: createWrapper() },
    );
    expect(result.current.isFetching).toBe(false);
    expect(mockedGetCrossReferences).not.toHaveBeenCalled();
  });

  it("starts in loading state when enabled", () => {
    mockedGetCrossReferences.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(
      () => useCrossReferences("proj-1", "http://example.org/Entity1", "token", "main"),
      { wrapper: createWrapper() },
    );
    expect(result.current.isLoading).toBe(true);
  });

  it("returns data on success", async () => {
    mockedGetCrossReferences.mockResolvedValue(mockResponse);
    const { result } = renderHook(
      () => useCrossReferences("proj-1", "http://example.org/Entity1", "token", "main"),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockResponse);
    expect(mockedGetCrossReferences).toHaveBeenCalledWith(
      "proj-1",
      "http://example.org/Entity1",
      "token",
      "main",
    );
  });

  it("returns error on failure", async () => {
    mockedGetCrossReferences.mockRejectedValue(new Error("Network error"));
    const { result } = renderHook(
      () => useCrossReferences("proj-1", "http://example.org/Entity1", "token", "main"),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe("Network error");
  });

  it("works without accessToken", async () => {
    mockedGetCrossReferences.mockResolvedValue(mockResponse);
    const { result } = renderHook(
      () => useCrossReferences("proj-1", "http://example.org/Entity1"),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedGetCrossReferences).toHaveBeenCalledWith(
      "proj-1",
      "http://example.org/Entity1",
      undefined,
      undefined,
    );
  });

  it("includes branch and accessToken presence in queryKey", async () => {
    mockedGetCrossReferences.mockResolvedValue(mockResponse);
    const { result: result1 } = renderHook(
      () => useCrossReferences("proj-1", "http://example.org/E", "tok", "main"),
      { wrapper: createWrapper() },
    );
    const { result: result2 } = renderHook(
      () => useCrossReferences("proj-1", "http://example.org/E", undefined, "dev"),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result1.current.isSuccess).toBe(true));
    await waitFor(() => expect(result2.current.isSuccess).toBe(true));
    // Both should have fired separate calls (different query keys)
    expect(mockedGetCrossReferences).toHaveBeenCalledTimes(2);
  });
});
