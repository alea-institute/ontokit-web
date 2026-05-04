import React, { type ReactNode } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useIndexStatus } from "@/lib/hooks/useIndexStatus";

// Mock the projectOntologyApi
vi.mock("@/lib/api/client", () => ({
  projectOntologyApi: {
    getIndexStatus: vi.fn(),
  },
}));

import { projectOntologyApi } from "@/lib/api/client";

const mockedGetIndexStatus = projectOntologyApi.getIndexStatus as ReturnType<typeof vi.fn>;

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  // eslint-disable-next-line react/display-name
  return ({ children }: { children: ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useIndexStatus", () => {
  it("fetches index status when projectId and accessToken are provided", async () => {
    const statusData = { status: "idle", entity_count: 42 };
    mockedGetIndexStatus.mockResolvedValueOnce(statusData);

    const { result } = renderHook(
      () => useIndexStatus("proj-1", "token-123"),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(statusData);
    expect(mockedGetIndexStatus).toHaveBeenCalledWith("proj-1", "token-123");
  });

  it("does not fetch when projectId is empty", () => {
    renderHook(
      () => useIndexStatus("", "token-123"),
      { wrapper: createWrapper() }
    );

    expect(mockedGetIndexStatus).not.toHaveBeenCalled();
  });

  it("does not fetch when accessToken is undefined", () => {
    renderHook(
      () => useIndexStatus("proj-1", undefined),
      { wrapper: createWrapper() }
    );

    expect(mockedGetIndexStatus).not.toHaveBeenCalled();
  });

  it("does not fetch when enabled option is false", () => {
    renderHook(
      () => useIndexStatus("proj-1", "token-123", { enabled: false }),
      { wrapper: createWrapper() }
    );

    expect(mockedGetIndexStatus).not.toHaveBeenCalled();
  });

  it("fetches when enabled option is true", async () => {
    const statusData = { status: "indexing" };
    mockedGetIndexStatus.mockResolvedValueOnce(statusData);

    const { result } = renderHook(
      () => useIndexStatus("proj-1", "token-123", { enabled: true }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(statusData);
  });

  it("returns error state when API call fails", async () => {
    mockedGetIndexStatus.mockRejectedValueOnce(new Error("Network error"));

    const { result } = renderHook(
      () => useIndexStatus("proj-1", "token-123"),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(Error);
    expect((result.current.error as Error).message).toBe("Network error");
  });
});
