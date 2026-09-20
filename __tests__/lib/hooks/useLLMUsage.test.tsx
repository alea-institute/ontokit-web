import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { useLLMUsage } from "@/lib/hooks/useLLMUsage";
import { ApiError } from "@/lib/api/client";
import { jsonResponse, llmHookHarness } from "../../fixtures/llm-hook-harness";

const emptyUsage = { total_calls: 0, total_cost_usd: 0, budget_consumed_pct: null, burn_rate_daily_usd: 0, users: [] };
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });
describe("useLLMUsage real query and API chain", () => {
  it("fetches authenticated usage, exposes empty state, and refetches changed usage", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(jsonResponse(emptyUsage)).mockResolvedValueOnce(jsonResponse({ ...emptyUsage, total_calls: 2 }));
    vi.stubGlobal("fetch", fetch);
    const { wrapper, client } = llmHookHarness();
    const { result } = renderHook(() => useLLMUsage("project", "token"), { wrapper });
    await waitFor(() => expect(result.current.usage).toEqual(emptyUsage));
    expect(new URL(fetch.mock.calls[0][0]).pathname).toBe("/api/v1/projects/project/llm/usage");
    expect(fetch.mock.calls[0][1].headers.get("Authorization")).toBe("Bearer token");
    await act(async () => { await result.current.refetch(); });
    await waitFor(() => expect(result.current.usage?.total_calls).toBe(2));
    expect(client.getQueryData(["llm-usage", "project", "token"])).toEqual({ ...emptyUsage, total_calls: 2 });
    client.clear();
  });
  it.each([["", "token"], ["project", undefined], ["project", ""]])("does not request with project %s and credential %s", (project, token) => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    const { wrapper, client } = llmHookHarness();
    const { result } = renderHook(() => useLLMUsage(project!, token), { wrapper });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.usage).toBeUndefined();
    expect(fetch).not.toHaveBeenCalled(); client.clear();
  });
  it("surfaces API permission failures without inventing empty usage", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ detail: "Forbidden" }, 403)));
    const { wrapper, client } = llmHookHarness();
    const { result } = renderHook(() => useLLMUsage("project", "token"), { wrapper });
    await waitFor(() => expect(result.current.error).toBeInstanceOf(ApiError));
    expect(result.current.error).toMatchObject({ status: 403 });
    expect(result.current.usage).toBeUndefined(); client.clear();
  });
  it("uses fresh seeded cache and separates usage when credentials change", () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    const { wrapper, client } = llmHookHarness();
    client.setQueryData(["llm-usage", "project", "a"], emptyUsage);
    client.setQueryData(["llm-usage", "project", "b"], { ...emptyUsage, total_calls: 5 });
    const { result, rerender } = renderHook(({ token }) => useLLMUsage("project", token), { wrapper, initialProps: { token: "a" } });
    expect(result.current.usage?.total_calls).toBe(0);
    rerender({ token: "b" });
    expect(result.current.usage?.total_calls).toBe(5);
    expect(fetch).not.toHaveBeenCalled(); client.clear();
  });
  it("refreshes cached usage at the one-minute polling boundary", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn().mockResolvedValue(jsonResponse({ ...emptyUsage, total_calls: 9 })); vi.stubGlobal("fetch", fetch);
    const { wrapper, client } = llmHookHarness();
    client.setQueryData(["llm-usage", "project", "token"], emptyUsage);
    const { result, unmount } = renderHook(() => useLLMUsage("project", "token"), { wrapper });
    await act(async () => { await vi.advanceTimersByTimeAsync(59_999); });
    expect(fetch).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(2); });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result.current.usage?.total_calls).toBe(9);
    unmount(); client.clear();
  });

});
