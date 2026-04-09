import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import type { ReactNode } from "react";
import { useEntityHistory } from "@/lib/hooks/useEntityHistory";
import type { EntityHistoryResponse } from "@/lib/api/analytics";

vi.mock("@/lib/api/analytics", () => ({
  analyticsApi: {
    getEntityHistory: vi.fn(),
  },
}));

import { analyticsApi } from "@/lib/api/analytics";

const mockedGetEntityHistory = analyticsApi.getEntityHistory as ReturnType<typeof vi.fn>;

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  // eslint-disable-next-line react/display-name
  return ({ children }: { children: ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

const mockResponse: EntityHistoryResponse = {
  entity_iri: "http://example.org/Entity1",
  events: [
    {
      id: "evt-1",
      project_id: "proj-1",
      branch: "main",
      entity_iri: "http://example.org/Entity1",
      entity_type: "class",
      event_type: "update",
      user_id: "user-1",
      user_name: "Alice",
      changed_fields: ["label"],
      created_at: "2024-06-01T00:00:00Z",
    },
  ],
  total: 1,
};

describe("useEntityHistory", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("is disabled when entityIri is null", () => {
    const { result } = renderHook(
      () => useEntityHistory("proj-1", null, "token", "main"),
      { wrapper: createWrapper() },
    );
    expect(result.current.isFetching).toBe(false);
    expect(mockedGetEntityHistory).not.toHaveBeenCalled();
  });

  it("is disabled when projectId is empty", () => {
    const { result } = renderHook(
      () => useEntityHistory("", "http://example.org/E", "token"),
      { wrapper: createWrapper() },
    );
    expect(result.current.isFetching).toBe(false);
    expect(mockedGetEntityHistory).not.toHaveBeenCalled();
  });

  it("starts in loading state when enabled", () => {
    mockedGetEntityHistory.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(
      () => useEntityHistory("proj-1", "http://example.org/E", "token", "main"),
      { wrapper: createWrapper() },
    );
    expect(result.current.isLoading).toBe(true);
  });

  it("returns data on success", async () => {
    mockedGetEntityHistory.mockResolvedValue(mockResponse);
    const { result } = renderHook(
      () => useEntityHistory("proj-1", "http://example.org/Entity1", "token", "main"),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockResponse);
    expect(mockedGetEntityHistory).toHaveBeenCalledWith(
      "proj-1",
      "http://example.org/Entity1",
      "token",
      "main",
      50,
    );
  });

  it("returns error on failure", async () => {
    mockedGetEntityHistory.mockRejectedValue(new Error("Server error"));
    const { result } = renderHook(
      () => useEntityHistory("proj-1", "http://example.org/E", "token"),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Server error");
  });

  it("passes custom limit parameter", async () => {
    mockedGetEntityHistory.mockResolvedValue(mockResponse);
    const { result } = renderHook(
      () => useEntityHistory("proj-1", "http://example.org/E", "token", "main", 10),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedGetEntityHistory).toHaveBeenCalledWith(
      "proj-1",
      "http://example.org/E",
      "token",
      "main",
      10,
    );
  });

  it("works without accessToken or branch", async () => {
    mockedGetEntityHistory.mockResolvedValue(mockResponse);
    const { result } = renderHook(
      () => useEntityHistory("proj-1", "http://example.org/E"),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedGetEntityHistory).toHaveBeenCalledWith(
      "proj-1",
      "http://example.org/E",
      undefined,
      undefined,
      50,
    );
  });

  it("is disabled when entityIri is empty string", () => {
    const { result } = renderHook(
      () => useEntityHistory("proj-1", "", "token"),
      { wrapper: createWrapper() },
    );
    expect(result.current.isFetching).toBe(false);
  });
});
