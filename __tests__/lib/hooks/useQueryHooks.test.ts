/**
 * Tests for the standalone React Query data-fetching hooks:
 *   useOpenPRCount, useLintSummary, useMembers,
 *   useNormalizationStatus, useIndexStatus, usePendingSuggestionCount
 *
 * Each hook is a thin useQuery wrapper — tests verify:
 *   1. Data is returned when the query resolves
 *   2. The query is disabled when required params are missing
 *   3. The enabled option (where applicable) is respected
 */

import React, { type ReactNode } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ---- Mocks ----

vi.mock("@/lib/api/pullRequests", () => ({
  pullRequestsApi: { list: vi.fn() },
}));
vi.mock("@/lib/api/lint", () => ({
  lintApi: { getStatus: vi.fn() },
}));
vi.mock("@/lib/api/projects", () => ({
  projectApi: { listMembers: vi.fn() },
}));
vi.mock("@/lib/api/normalization", () => ({
  normalizationApi: { getStatus: vi.fn() },
}));
vi.mock("@/lib/api/client", () => ({
  projectOntologyApi: { getIndexStatus: vi.fn() },
}));
vi.mock("@/lib/api/suggestions", () => ({
  suggestionsApi: { listPending: vi.fn() },
}));

import { pullRequestsApi } from "@/lib/api/pullRequests";
import { lintApi } from "@/lib/api/lint";
import { projectApi } from "@/lib/api/projects";
import { normalizationApi } from "@/lib/api/normalization";
import { projectOntologyApi } from "@/lib/api/client";
import { suggestionsApi } from "@/lib/api/suggestions";

import { useOpenPRCount } from "@/lib/hooks/useOpenPRCount";
import { useLintSummary } from "@/lib/hooks/useLintSummary";
import { useMembers } from "@/lib/hooks/useMembers";
import { useNormalizationStatus } from "@/lib/hooks/useNormalizationStatus";
import { useIndexStatus } from "@/lib/hooks/useIndexStatus";
import { usePendingSuggestionCount } from "@/lib/hooks/usePendingSuggestionCount";

const mockedPRList = pullRequestsApi.list as ReturnType<typeof vi.fn>;
const mockedLintStatus = lintApi.getStatus as ReturnType<typeof vi.fn>;
const mockedListMembers = projectApi.listMembers as ReturnType<typeof vi.fn>;
const mockedNormStatus = normalizationApi.getStatus as ReturnType<typeof vi.fn>;
const mockedIndexStatus = projectOntologyApi.getIndexStatus as ReturnType<typeof vi.fn>;
const mockedListPending = suggestionsApi.listPending as ReturnType<typeof vi.fn>;

// ---- Helpers ----

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---- useOpenPRCount ----

describe("useOpenPRCount", () => {
  it("returns the total open PR count", async () => {
    mockedPRList.mockResolvedValue({ total: 7, items: [] });

    const { result } = renderHook(() => useOpenPRCount("p1", "tok"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(7);
    expect(mockedPRList).toHaveBeenCalledWith("p1", "tok", "open", undefined, 0, 1);
  });

  it("does not fetch when accessToken is missing", () => {
    const { result } = renderHook(() => useOpenPRCount("p1", undefined), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockedPRList).not.toHaveBeenCalled();
  });

  it("does not fetch when projectId is empty", () => {
    const { result } = renderHook(() => useOpenPRCount("", "tok"), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockedPRList).not.toHaveBeenCalled();
  });
});

// ---- useLintSummary ----

describe("useLintSummary", () => {
  const summary = { project_id: "p1", error_count: 2, warning_count: 1, info_count: 0, total_issues: 3, last_run: null };

  it("returns lint summary data", async () => {
    mockedLintStatus.mockResolvedValue(summary);

    const { result } = renderHook(() => useLintSummary("p1", "tok"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(summary);
    expect(mockedLintStatus).toHaveBeenCalledWith("p1", "tok");
  });

  it("does not fetch when accessToken is missing", () => {
    const { result } = renderHook(() => useLintSummary("p1", undefined), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockedLintStatus).not.toHaveBeenCalled();
  });
});

// ---- useMembers ----

describe("useMembers", () => {
  const membersResponse = { items: [{ user_id: "u1", role: "editor" }], total: 1 };

  it("returns member list", async () => {
    mockedListMembers.mockResolvedValue(membersResponse);

    const { result } = renderHook(() => useMembers("p1", "tok"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(membersResponse);
    expect(mockedListMembers).toHaveBeenCalledWith("p1", "tok");
  });

  it("does not fetch when accessToken is missing", () => {
    const { result } = renderHook(() => useMembers("p1", undefined), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockedListMembers).not.toHaveBeenCalled();
  });

  it("does not fetch when projectId is empty", () => {
    const { result } = renderHook(() => useMembers("", "tok"), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockedListMembers).not.toHaveBeenCalled();
  });
});

// ---- useNormalizationStatus ----

describe("useNormalizationStatus", () => {
  const normStatus = { needs_normalization: false, last_run: null, last_run_id: null, last_check: null, preview_report: null, checking: false, error: null };

  it("returns normalization status", async () => {
    mockedNormStatus.mockResolvedValue(normStatus);

    const { result } = renderHook(() => useNormalizationStatus("p1", "tok"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(normStatus);
    expect(mockedNormStatus).toHaveBeenCalledWith("p1", "tok");
  });

  it("does not fetch when projectId is empty", () => {
    const { result } = renderHook(() => useNormalizationStatus("", "tok"), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockedNormStatus).not.toHaveBeenCalled();
  });

  it("respects enabled: false option", () => {
    const { result } = renderHook(
      () => useNormalizationStatus("p1", "tok", { enabled: false }),
      { wrapper: createWrapper() },
    );

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockedNormStatus).not.toHaveBeenCalled();
  });
});

// ---- useIndexStatus ----

describe("useIndexStatus", () => {
  const idxStatus = { status: "ready", entity_count: 42, last_indexed: "2026-01-01T00:00:00Z" };

  it("returns index status", async () => {
    mockedIndexStatus.mockResolvedValue(idxStatus);

    const { result } = renderHook(() => useIndexStatus("p1", "tok"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(idxStatus);
    expect(mockedIndexStatus).toHaveBeenCalledWith("p1", "tok");
  });

  it("does not fetch when projectId is empty", () => {
    const { result } = renderHook(() => useIndexStatus("", "tok"), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockedIndexStatus).not.toHaveBeenCalled();
  });

  it("respects enabled: false option", () => {
    const { result } = renderHook(
      () => useIndexStatus("p1", "tok", { enabled: false }),
      { wrapper: createWrapper() },
    );

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockedIndexStatus).not.toHaveBeenCalled();
  });
});

// ---- usePendingSuggestionCount ----

describe("usePendingSuggestionCount", () => {
  it("returns pending suggestion count", async () => {
    mockedListPending.mockResolvedValue({ items: [{ id: "s1" }, { id: "s2" }] });

    const { result } = renderHook(() => usePendingSuggestionCount("p1", "tok"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(2);
    expect(mockedListPending).toHaveBeenCalledWith("p1", "tok");
  });

  it("does not fetch when accessToken is missing", () => {
    const { result } = renderHook(() => usePendingSuggestionCount("p1", undefined), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockedListPending).not.toHaveBeenCalled();
  });

  it("respects enabled: false option", () => {
    const { result } = renderHook(
      () => usePendingSuggestionCount("p1", "tok", { enabled: false }),
      { wrapper: createWrapper() },
    );

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockedListPending).not.toHaveBeenCalled();
  });

  it("does not fetch when projectId is empty", () => {
    const { result } = renderHook(() => usePendingSuggestionCount("", "tok"), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockedListPending).not.toHaveBeenCalled();
  });
});
