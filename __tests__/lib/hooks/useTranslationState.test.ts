import React, { type ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { translationsApi } from "@/lib/api/translations";
import { translationQueryKeys } from "@/lib/hooks/useTranslationConfig";
import { useTranslationState } from "@/lib/hooks/useTranslationState";

vi.mock("@/lib/api/translations", () => ({
  translationsApi: { getEntityState: vi.fn(), translateField: vi.fn() },
}));

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => React.createElement(QueryClientProvider, { client }, children);
  const hook = renderHook(() => useTranslationState("project-1", "ex:Person", "main", "token"), { wrapper });
  return { client, ...hook };
}

describe("useTranslationState on-demand polling", () => {
  beforeEach(() => {
    vi.mocked(translationsApi.getEntityState).mockResolvedValue({ entity_iri: "ex:Person", branch: "main", items: [] });
    vi.mocked(translationsApi.translateField).mockResolvedValue({ job_id: "job-1" });
  });
  afterEach(() => vi.useRealTimers());

  it("keeps polling pending until the requested translation arrives", async () => {
    const { client, result } = setup();
    await waitFor(() => expect(result.current.state).toBeDefined());
    await act(() => result.current.translateField("skos:definition"));
    expect(result.current.isTranslationPending).toBe(true);
    act(() => client.setQueryData(
      [...translationQueryKeys.entityState("project-1", "ex:Person", "main"), "token"],
      { entity_iri: "ex:Person", branch: "main", items: [{ predicate: "skos:definition", language: "fr", state: "provisional", value: "Définition", record_id: "r1" }] },
    ));
    await waitFor(() => expect(result.current.isTranslationPending).toBe(false));
    expect(result.current.pendingNotice).toBeNull();
  });

  it("terminates pending polling when entity-state errors", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.state).toBeDefined());
    await act(() => result.current.translateField("skos:definition"));
    vi.mocked(translationsApi.getEntityState).mockRejectedValue(new Error("status unavailable"));
    await act(() => result.current.refetch());
    await waitFor(() => expect(result.current.isTranslationPending).toBe(false));
    expect(result.current.pendingNotice).toMatch(/could not be checked/i);
  });

  it("stops after five minutes with a retryable timeout notice", async () => {
    vi.useFakeTimers();
    const { result } = setup();
    await act(async () => { await vi.runOnlyPendingTimersAsync(); });
    await act(() => result.current.translateField("skos:definition"));
    expect(result.current.isTranslationPending).toBe(true);
    act(() => { vi.advanceTimersByTime(5 * 60_000); });
    expect(result.current.isTranslationPending).toBe(false);
    expect(result.current.pendingNotice).toMatch(/you can retry/i);
  });
});
