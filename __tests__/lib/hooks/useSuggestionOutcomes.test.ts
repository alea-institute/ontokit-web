import React, { type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/lib/api/trust", () => ({
  trustApi: {
    listOutcomes: vi.fn(),
  },
}));

import { trustApi } from "@/lib/api/trust";
import { useSuggestionOutcomes } from "@/lib/hooks/useSuggestionOutcomes";

const mockedListOutcomes = trustApi.listOutcomes as ReturnType<typeof vi.fn>;

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  // eslint-disable-next-line react/display-name
  return ({ children }: { children: ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useSuggestionOutcomes", () => {
  it.each([
    { canManage: false, accessToken: "tok" },
    { canManage: true, accessToken: undefined },
  ])("is disabled without management access and a token: %o", (options) => {
    renderHook(
      () => useSuggestionOutcomes("p1", options.accessToken, options.canManage),
      { wrapper: createWrapper() },
    );

    expect(mockedListOutcomes).not.toHaveBeenCalled();
  });

  it("accumulates cursor pages and exposes the next cursor", async () => {
    mockedListOutcomes
      .mockResolvedValueOnce({
        items: [{ user_id: "u1", snapshot_tier: null }],
        total: 2,
        next_cursor: "cursor-2",
      })
      .mockResolvedValueOnce({
        items: [{ user_id: "u2", snapshot_tier: "trusted" }],
        total: 2,
        next_cursor: null,
      });

    const { result } = renderHook(
      () => useSuggestionOutcomes("p1", "tok", true),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.items).toHaveLength(1));
    expect(result.current.next_cursor).toBe("cursor-2");
    expect(result.current.hasNextPage).toBe(true);

    await act(async () => {
      await result.current.fetchNextPage();
    });

    expect(mockedListOutcomes).toHaveBeenNthCalledWith(1, "p1", { limit: 25 }, "tok");
    expect(mockedListOutcomes).toHaveBeenNthCalledWith(
      2,
      "p1",
      { cursor: "cursor-2", limit: 25 },
      "tok",
    );
    await waitFor(() =>
      expect(result.current.items.map((item) => item.user_id)).toEqual(["u1", "u2"]),
    );
    expect(result.current.next_cursor).toBeNull();
    expect(result.current.hasNextPage).toBe(false);
  });
});
