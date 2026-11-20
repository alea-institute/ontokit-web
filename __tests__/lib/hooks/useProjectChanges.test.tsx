import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { changesApi, type ProjectChangesResponse } from "@/lib/api/changes";
import { useChangedEntities, useProjectChanges } from "@/lib/hooks/useProjectChanges";

vi.mock("@/lib/api/changes", () => ({
  changesApi: { list: vi.fn(), listChangedEntities: vi.fn() },
}));

const response: ProjectChangesResponse = {
  window: { days: 7, since: "2026-11-13T00:00:00Z", until: "2026-11-20T00:00:00Z", branch: "main" },
  summary: {
    total_events: 0, entities_changed: 0, by_net_change: { added: 0, modified: 0, removed: 0, transient: 0 },
    by_origin: { human: 0, ai: 0, ai_edited: 0, system: 0 }, authors: [],
  },
  items: [],
  next_cursor: null,
};

function createWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe("project change hooks", () => {
  beforeEach(() => vi.resetAllMocks());

  it("passes next_cursor to the next request and starts over for different filters", async () => {
    const list = vi.mocked(changesApi.list);
    list.mockResolvedValueOnce({ ...response, next_cursor: "next+/=" }).mockResolvedValue(response);
    const { result, rerender } = renderHook(
      ({ days }) => useProjectChanges("project-1", undefined, { days, origin: ["ai"] }),
      { wrapper: createWrapper(), initialProps: { days: 7 } },
    );

    await waitFor(() => expect(result.current.hasNextPage).toBe(true));
    await act(async () => { await result.current.fetchNextPage(); });
    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));
    expect(result.current.hasNextPage).toBe(false);
    expect(list).toHaveBeenNthCalledWith(2, "project-1", undefined, {
      days: 7, origin: ["ai"], cursor: "next+/=",
    });

    rerender({ days: 30 });
    await waitFor(() => expect(result.current.data?.pages).toHaveLength(1));
    expect(list).toHaveBeenNthCalledWith(3, "project-1", undefined, {
      days: 30, origin: ["ai"], cursor: undefined,
    });
  });

  it("loads the changed-entity markers for the requested branch and origins", async () => {
    vi.mocked(changesApi.listChangedEntities).mockResolvedValue({ items: [], truncated: false });
    const filters = { branch: "review", origin: ["system"] } as const;
    const { result } = renderHook(
      () => useChangedEntities("project-1", undefined, filters),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.data?.truncated).toBe(false));
    expect(changesApi.listChangedEntities).toHaveBeenCalledWith("project-1", undefined, filters);
  });
});
