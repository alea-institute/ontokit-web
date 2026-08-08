import React, { type ReactNode } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { LLMStatusResponse } from "@/lib/api/llm";
import type { ProjectRole } from "@/lib/api/projects";

vi.mock("next-auth/react", () => ({
  useSession: vi.fn(),
}));

vi.mock("@/lib/api/llm", () => ({
  LLM_STATUS_INVALIDATION_EVENT: "ontokit:llm-status-invalidated",
  llmApi: {
    getStatus: vi.fn(),
  },
}));

import { useSession } from "next-auth/react";
import { llmApi } from "@/lib/api/llm";
import { useLLMGate } from "@/lib/hooks/useLLMGate";

const mockedUseSession = useSession as unknown as ReturnType<typeof vi.fn>;
const mockedGetStatus = llmApi.getStatus as unknown as ReturnType<typeof vi.fn>;

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  // eslint-disable-next-line react/display-name
  return ({ children }: { children: ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

function authedSession() {
  return {
    data: {
      user: { id: "u1", name: "Test User" },
      accessToken: "token-123",
    },
    status: "authenticated",
  };
}

function statusResponse(
  overrides: Partial<LLMStatusResponse> = {}
): LLMStatusResponse {
  return {
    configured: true,
    provider: "anthropic",
    budget_exhausted: false,
    daily_remaining: 500,
    monthly_budget_usd: 100,
    monthly_spent_usd: 12.5,
    burn_rate_daily_usd: 1.25,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useLLMGate", () => {
  it("returns canUseLLM=false for anonymous users and does not fetch status", () => {
    mockedUseSession.mockReturnValue({ data: null, status: "unauthenticated" });

    const { result } = renderHook(() => useLLMGate("proj-1", "editor"), {
      wrapper: createWrapper(),
    });

    expect(result.current.isAnonymous).toBe(true);
    expect(result.current.canUseLLM).toBe(false);
    expect(result.current.hasRoleAccess).toBe(false);
    expect(mockedGetStatus).not.toHaveBeenCalled();
  });

  it("returns canUseLLM=true for an editor with configured provider and budget headroom", async () => {
    mockedUseSession.mockReturnValue(authedSession());
    mockedGetStatus.mockResolvedValueOnce(statusResponse());

    const { result } = renderHook(() => useLLMGate("proj-1", "editor"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.canUseLLM).toBe(true));

    expect(mockedGetStatus).toHaveBeenCalledWith("proj-1", "token-123");
    expect(result.current.budgetExhausted).toBe(false);
    expect(result.current.notConfigured).toBe(false);
    expect(result.current.monthlySpentUsd).toBe(12.5);
    expect(result.current.monthlyBudgetUsd).toBe(100);
  });

  it("returns canUseLLM=false when budget is exhausted", async () => {
    mockedUseSession.mockReturnValue(authedSession());
    mockedGetStatus.mockResolvedValueOnce(
      statusResponse({ budget_exhausted: true })
    );

    const { result } = renderHook(() => useLLMGate("proj-1", "editor"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.budgetExhausted).toBe(true));
    expect(result.current.canUseLLM).toBe(false);
    expect(result.current.hasRoleAccess).toBe(true);
  });

  it("returns canUseLLM=false when no provider is configured", async () => {
    mockedUseSession.mockReturnValue(authedSession());
    mockedGetStatus.mockResolvedValueOnce(
      statusResponse({ configured: false, provider: null })
    );

    const { result } = renderHook(() => useLLMGate("proj-1", "editor"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.notConfigured).toBe(true);
    expect(result.current.canUseLLM).toBe(false);
  });

  it("denies role access for viewers even when configured", async () => {
    mockedUseSession.mockReturnValue(authedSession());
    mockedGetStatus.mockResolvedValueOnce(statusResponse());

    const { result } = renderHook(() => useLLMGate("proj-1", "viewer"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasRoleAccess).toBe(false);
    expect(result.current.canUseLLM).toBe(false);
  });

  it("treats a null/undefined role as no access", async () => {
    mockedUseSession.mockReturnValue(authedSession());
    mockedGetStatus.mockResolvedValueOnce(statusResponse());

    const { result } = renderHook(() => useLLMGate("proj-1", null), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasRoleAccess).toBe(false);
    expect(result.current.canUseLLM).toBe(false);
  });

  it("reports unlimited budget when monthly_budget_usd is null", async () => {
    mockedUseSession.mockReturnValue(authedSession());
    mockedGetStatus.mockResolvedValueOnce(
      statusResponse({ monthly_budget_usd: null })
    );

    const { result } = renderHook(() => useLLMGate("proj-1", "admin"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isBudgetUnlimited).toBe(true);
  });

  it.each<[ProjectRole | null | undefined, string | null]>([
    ["owner", "Admin — unlimited"],
    ["admin", "Admin — unlimited"],
    ["editor", "Editor — 500/day"],
    ["suggester", "Suggester — 100/day"],
    ["viewer", null],
    [null, null],
    [undefined, null],
  ])("returns correct roleLimitLabel for role %s", (role, expected) => {
    mockedUseSession.mockReturnValue({ data: null, status: "unauthenticated" });

    const { result } = renderHook(() => useLLMGate("proj-1", role), {
      wrapper: createWrapper(),
    });

    expect(result.current.roleLimitLabel).toBe(expected);
  });

  it("does not treat the API's static daily allowance as live exhaustion", async () => {
    mockedUseSession.mockReturnValue(authedSession());
    mockedGetStatus.mockResolvedValueOnce(
      statusResponse({ daily_remaining: 0 })
    );

    const { result } = renderHook(() => useLLMGate("proj-1", "suggester"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.canUseLLM).toBe(true));
    expect(result.current.hasRoleAccess).toBe(true);
    expect(result.current.budgetExhausted).toBe(false);
  });

  it("does not claim notConfigured while loading or on fetch error", async () => {
    mockedUseSession.mockReturnValue(authedSession());
    let rejectFetch: (err: Error) => void = () => {};
    mockedGetStatus.mockReturnValueOnce(
      new Promise((_resolve, reject) => {
        rejectFetch = reject;
      })
    );

    const { result } = renderHook(() => useLLMGate("proj-1", "editor"), {
      wrapper: createWrapper(),
    });

    // While loading: unknown, not "unconfigured"
    expect(result.current.isLoading).toBe(true);
    expect(result.current.notConfigured).toBe(false);
    expect(result.current.canUseLLM).toBe(false); // fail closed

    rejectFetch(new Error("500 Internal Server Error"));
    await waitFor(() => expect(result.current.isError).toBe(true));

    // On error: still not "unconfigured" — the server never said that
    expect(result.current.notConfigured).toBe(false);
    expect(result.current.canUseLLM).toBe(false);
    expect(result.current.error).toBeInstanceOf(Error);
  });

  it("invalidateStatus triggers a status refetch (post-402 recovery path)", async () => {
    mockedUseSession.mockReturnValue(authedSession());
    mockedGetStatus.mockResolvedValue(statusResponse());

    const { result } = renderHook(() => useLLMGate("proj-1", "editor"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.canUseLLM).toBe(true));
    expect(mockedGetStatus).toHaveBeenCalledTimes(1);

    result.current.invalidateStatus();

    await waitFor(() => expect(mockedGetStatus).toHaveBeenCalledTimes(2));
  });
});
