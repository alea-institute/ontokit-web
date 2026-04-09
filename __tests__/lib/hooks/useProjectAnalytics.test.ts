import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import type { ReactNode } from "react";
import {
  useProjectActivity,
  useHotEntities,
  useContributors,
} from "@/lib/hooks/useProjectAnalytics";
import type {
  ProjectActivity,
  HotEntity,
  ContributorStats,
} from "@/lib/api/analytics";

vi.mock("@/lib/api/analytics", () => ({
  analyticsApi: {
    getActivity: vi.fn(),
    getHotEntities: vi.fn(),
    getContributors: vi.fn(),
  },
}));

import { analyticsApi } from "@/lib/api/analytics";

const mockedGetActivity = analyticsApi.getActivity as ReturnType<typeof vi.fn>;
const mockedGetHotEntities = analyticsApi.getHotEntities as ReturnType<typeof vi.fn>;
const mockedGetContributors = analyticsApi.getContributors as ReturnType<typeof vi.fn>;

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  // eslint-disable-next-line react/display-name
  return ({ children }: { children: ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

const mockActivity: ProjectActivity = {
  daily_counts: [{ date: "2024-06-01", count: 5 }],
  total_events: 5,
  top_editors: [{ user_id: "u1", user_name: "Alice", edit_count: 5 }],
};

const mockHotEntities: HotEntity[] = [
  {
    entity_iri: "http://example.org/E",
    entity_type: "class",
    label: "Entity",
    edit_count: 10,
    editor_count: 2,
    last_edited_at: "2024-06-01T00:00:00Z",
  },
];

const mockContributors: ContributorStats[] = [
  {
    user_id: "u1",
    user_name: "Alice",
    create_count: 3,
    update_count: 5,
    delete_count: 1,
    total_count: 9,
    last_active_at: "2024-06-01T00:00:00Z",
  },
];

describe("useProjectActivity", () => {
  beforeEach(() => vi.resetAllMocks());

  it("is disabled when projectId is empty", () => {
    const { result } = renderHook(
      () => useProjectActivity("", "token"),
      { wrapper: createWrapper() },
    );
    expect(result.current.isFetching).toBe(false);
    expect(mockedGetActivity).not.toHaveBeenCalled();
  });

  it("starts in loading state when enabled", () => {
    mockedGetActivity.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(
      () => useProjectActivity("proj-1", "token"),
      { wrapper: createWrapper() },
    );
    expect(result.current.isLoading).toBe(true);
  });

  it("returns data on success", async () => {
    mockedGetActivity.mockResolvedValue(mockActivity);
    const { result } = renderHook(
      () => useProjectActivity("proj-1", "token", 7),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockActivity);
    expect(mockedGetActivity).toHaveBeenCalledWith("proj-1", "token", 7);
  });

  it("returns error on failure", async () => {
    mockedGetActivity.mockRejectedValue(new Error("fail"));
    const { result } = renderHook(
      () => useProjectActivity("proj-1", "token"),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("uses default days parameter of 30", async () => {
    mockedGetActivity.mockResolvedValue(mockActivity);
    const { result } = renderHook(
      () => useProjectActivity("proj-1", "token"),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedGetActivity).toHaveBeenCalledWith("proj-1", "token", 30);
  });
});

describe("useHotEntities", () => {
  beforeEach(() => vi.resetAllMocks());

  it("is disabled when projectId is empty", () => {
    const { result } = renderHook(
      () => useHotEntities("", "token"),
      { wrapper: createWrapper() },
    );
    expect(result.current.isFetching).toBe(false);
    expect(mockedGetHotEntities).not.toHaveBeenCalled();
  });

  it("returns data on success", async () => {
    mockedGetHotEntities.mockResolvedValue(mockHotEntities);
    const { result } = renderHook(
      () => useHotEntities("proj-1", "token"),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockHotEntities);
    expect(mockedGetHotEntities).toHaveBeenCalledWith("proj-1", "token", 20);
  });

  it("returns error on failure", async () => {
    mockedGetHotEntities.mockRejectedValue(new Error("fail"));
    const { result } = renderHook(
      () => useHotEntities("proj-1", "token"),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("passes custom limit parameter", async () => {
    mockedGetHotEntities.mockResolvedValue(mockHotEntities);
    const { result } = renderHook(
      () => useHotEntities("proj-1", "token", 5),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedGetHotEntities).toHaveBeenCalledWith("proj-1", "token", 5);
  });

  it("works without accessToken", async () => {
    mockedGetHotEntities.mockResolvedValue(mockHotEntities);
    const { result } = renderHook(
      () => useHotEntities("proj-1"),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedGetHotEntities).toHaveBeenCalledWith("proj-1", undefined, 20);
  });
});

describe("useContributors", () => {
  beforeEach(() => vi.resetAllMocks());

  it("is disabled when projectId is empty", () => {
    const { result } = renderHook(
      () => useContributors("", "token"),
      { wrapper: createWrapper() },
    );
    expect(result.current.isFetching).toBe(false);
    expect(mockedGetContributors).not.toHaveBeenCalled();
  });

  it("returns data on success", async () => {
    mockedGetContributors.mockResolvedValue(mockContributors);
    const { result } = renderHook(
      () => useContributors("proj-1", "token"),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockContributors);
    expect(mockedGetContributors).toHaveBeenCalledWith("proj-1", "token", 30);
  });

  it("returns error on failure", async () => {
    mockedGetContributors.mockRejectedValue(new Error("fail"));
    const { result } = renderHook(
      () => useContributors("proj-1", "token"),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("passes custom days parameter", async () => {
    mockedGetContributors.mockResolvedValue(mockContributors);
    const { result } = renderHook(
      () => useContributors("proj-1", "token", 14),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedGetContributors).toHaveBeenCalledWith("proj-1", "token", 14);
  });

  it("works without accessToken", async () => {
    mockedGetContributors.mockResolvedValue(mockContributors);
    const { result } = renderHook(
      () => useContributors("proj-1"),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedGetContributors).toHaveBeenCalledWith("proj-1", undefined, 30);
  });
});
