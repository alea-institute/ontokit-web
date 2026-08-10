import React, { type ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { translationsApi } from "@/lib/api/translations";
import { translationQueryKeys } from "@/lib/hooks/useTranslationConfig";
import { useTranslationCoverage } from "@/lib/hooks/useTranslationCoverage";

vi.mock("@/lib/api/translations", () => ({
  translationsApi: {
    getCoverage: vi.fn(), getBackfillStatus: vi.fn(), previewBackfill: vi.fn(), launchBackfill: vi.fn(),
  },
}));

describe("useTranslationCoverage", () => {
  it("invalidates coverage on completed-count changes and once on terminal status", async () => {
    vi.mocked(translationsApi.getCoverage).mockResolvedValue({ branch: "main", languages: [], total_entities: 0 });
    vi.mocked(translationsApi.getBackfillStatus).mockResolvedValue({ job_id: "job-1", status: "running", total: 10, completed: 1, error: null });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const wrapper = ({ children }: { children: ReactNode }) => React.createElement(QueryClientProvider, { client }, children);
    const { result } = renderHook(() => useTranslationCoverage("project-1", "main", "token"), { wrapper });
    await waitFor(() => expect(result.current.job?.completed).toBe(1));
    const statusKey = [...translationQueryKeys.backfillStatus("project-1", "main"), "token"];
    const coverageKey = translationQueryKeys.coverage("project-1", "main");
    invalidate.mockClear();

    act(() => client.setQueryData(statusKey, { job_id: "job-1", status: "running", total: 10, completed: 2, error: null }));
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: coverageKey }));
    invalidate.mockClear();
    act(() => client.setQueryData(statusKey, { job_id: "job-1", status: "completed", total: 10, completed: 10, error: null }));
    await waitFor(() => expect(invalidate).toHaveBeenCalledTimes(1));
    invalidate.mockClear();
    act(() => client.setQueryData(statusKey, { job_id: "job-1", status: "completed", total: 10, completed: 10, error: null }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(invalidate).not.toHaveBeenCalled();
  });
});
