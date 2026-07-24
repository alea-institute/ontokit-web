import React, { type ReactNode } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { SuggestionCapabilities } from "@/lib/api/trust";

vi.mock("next-auth/react", () => ({
  useSession: vi.fn(),
}));

vi.mock("@/lib/api/trust", () => ({
  trustApi: {
    getCapabilities: vi.fn(),
  },
}));

import { useSession } from "next-auth/react";
import { trustApi } from "@/lib/api/trust";
import { useTrustCapabilities } from "@/lib/hooks/useTrustCapabilities";

const mockedUseSession = useSession as unknown as ReturnType<typeof vi.fn>;
const mockedGetCapabilities = trustApi.getCapabilities as unknown as ReturnType<
  typeof vi.fn
>;

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  // eslint-disable-next-line react/display-name
  return ({ children }: { children: ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

function authedSession() {
  return {
    data: { user: { email: "c@example.com" }, accessToken: "tok" },
    status: "authenticated",
  };
}

function caps(overrides: Partial<SuggestionCapabilities> = {}): SuggestionCapabilities {
  return {
    tier: "untrusted",
    can_suggest: true,
    can_mint_entities: false,
    promotion_threshold: 5,
    accepted_count: 2,
    auto_accept_enabled: false,
    auto_accept_quiet_days: 7,
    verification_required: false,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedUseSession.mockReturnValue(authedSession());
});

describe("useTrustCapabilities", () => {
  it("reports the untrusted tier and blocks minting", async () => {
    mockedGetCapabilities.mockResolvedValue(caps());
    const { result } = renderHook(() => useTrustCapabilities("p1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.tier).toBe("untrusted");
    expect(result.current.canMintEntities).toBe(false);
    expect(result.current.isTrusted).toBe(false);
  });

  it("allows minting for a trusted contributor", async () => {
    mockedGetCapabilities.mockResolvedValue(
      caps({ tier: "trusted", can_mint_entities: true }),
    );
    const { result } = renderHook(() => useTrustCapabilities("p1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.canMintEntities).toBe(true));
    expect(result.current.isTrusted).toBe(true);
  });

  it("treats reviewers as trusted", async () => {
    // KTD4: the ladder never demotes staff.
    mockedGetCapabilities.mockResolvedValue(
      caps({ tier: "reviewer", can_mint_entities: true }),
    );
    const { result } = renderHook(() => useTrustCapabilities("p1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isTrusted).toBe(true));
  });

  it("disables minting while capabilities are loading", () => {
    // Fail-safe: an affordance that appears before its permission is known
    // invites a contributor into an action the server will refuse.
    mockedGetCapabilities.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useTrustCapabilities("p1"), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.canMintEntities).toBe(false);
  });

  it("disables minting when the request fails", async () => {
    mockedGetCapabilities.mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useTrustCapabilities("p1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.canMintEntities).toBe(false);
  });

  it("reports progress toward the next rung", async () => {
    mockedGetCapabilities.mockResolvedValue(
      caps({ accepted_count: 3, promotion_threshold: 5 }),
    );
    const { result } = renderHook(() => useTrustCapabilities("p1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.promotionProgress).not.toBeNull());
    expect(result.current.promotionProgress).toEqual({
      accepted: 3,
      threshold: 5,
      remaining: 2,
    });
  });

  it("never reports negative remaining progress", async () => {
    mockedGetCapabilities.mockResolvedValue(
      caps({ accepted_count: 9, promotion_threshold: 5 }),
    );
    const { result } = renderHook(() => useTrustCapabilities("p1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.promotionProgress).not.toBeNull());
    expect(result.current.promotionProgress?.remaining).toBe(0);
  });

  it("has no progress to show once trusted", async () => {
    mockedGetCapabilities.mockResolvedValue(caps({ tier: "trusted" }));
    const { result } = renderHook(() => useTrustCapabilities("p1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isTrusted).toBe(true));
    expect(result.current.promotionProgress).toBeNull();
  });

  it("flags an anonymous visitor", async () => {
    mockedUseSession.mockReturnValue({ data: null, status: "unauthenticated" });
    mockedGetCapabilities.mockResolvedValue(caps({ tier: "anonymous" }));
    const { result } = renderHook(() => useTrustCapabilities("p1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isAnonymous).toBe(true));
    expect(result.current.canMintEntities).toBe(false);
  });

  it("surfaces the verification requirement", async () => {
    mockedGetCapabilities.mockResolvedValue(caps({ verification_required: true }));
    const { result } = renderHook(() => useTrustCapabilities("p1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.verificationRequired).toBe(true));
  });

  it("does not fetch without a project", () => {
    renderHook(() => useTrustCapabilities(undefined), { wrapper: createWrapper() });
    expect(mockedGetCapabilities).not.toHaveBeenCalled();
  });

  it("scopes the cache key to the signed-in user", async () => {
    // A cached tier readout must not survive a user switch in the same tab.
    mockedGetCapabilities.mockResolvedValue(caps());
    const wrapper = createWrapper();
    const first = renderHook(() => useTrustCapabilities("p1"), { wrapper });
    await waitFor(() => expect(first.result.current.isLoading).toBe(false));

    mockedUseSession.mockReturnValue({
      data: { user: { email: "other@example.com" }, accessToken: "tok2" },
      status: "authenticated",
    });
    mockedGetCapabilities.mockResolvedValue(caps({ tier: "trusted" }));
    const second = renderHook(() => useTrustCapabilities("p1"), { wrapper });

    await waitFor(() => expect(second.result.current.tier).toBe("trusted"));
    expect(mockedGetCapabilities).toHaveBeenCalledTimes(2);
  });
});
