import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { createQueryWrapper } from "../../helpers/renderWithProviders";
import type { PRPartyMe } from "@/lib/api/prParty";

vi.mock("next-auth/react", () => ({ useSession: vi.fn() }));

vi.mock("@/lib/api/prParty", () => ({
  prPartyApi: {
    getMe: vi.fn(),
    getQueue: vi.fn(),
    getCard: vi.fn(),
    submitAction: vi.fn(),
    unpark: vi.fn(),
    askQuestion: vi.fn(),
    addNote: vi.fn(),
    rerunReview: vi.fn(),
  },
}));

import { useSession } from "next-auth/react";
import { prPartyApi } from "@/lib/api/prParty";
import { usePRPartyCapabilities } from "@/lib/hooks/usePRPartyCapabilities";

const mockedUseSession = useSession as unknown as ReturnType<typeof vi.fn>;
const mockedGetMe = prPartyApi.getMe as unknown as ReturnType<typeof vi.fn>;

function session(email = "reviewer@example.com") {
  return {
    data: { user: { email }, accessToken: "tok" },
    status: "authenticated",
  };
}

function me(overrides: Partial<PRPartyMe> = {}): PRPartyMe {
  return {
    is_reviewer: true,
    degraded: false,
    github_login: "reviewer",
    credential: null,
    generation_token: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedUseSession.mockReturnValue(session());
});

describe("usePRPartyCapabilities", () => {
  it("reports a designated reviewer", async () => {
    mockedGetMe.mockResolvedValue(me());
    const { result } = renderHook(() => usePRPartyCapabilities(), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isReviewer).toBe(true));
    expect(result.current.githubLogin).toBe("reviewer");
    expect(result.current.degraded).toBe(false);
  });

  it("is fail-closed while the capability read is in flight", () => {
    // A nav entry that appears before its permission is known walks the user
    // into a 403 (the useTrustCapabilities invariant).
    mockedGetMe.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => usePRPartyCapabilities(), {
      wrapper: createQueryWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isReviewer).toBe(false);
  });

  it("is fail-closed when the capability read errors", async () => {
    mockedGetMe.mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => usePRPartyCapabilities(), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.isReviewer).toBe(false);
  });

  it("reports a non-reviewer answered with 200", async () => {
    mockedGetMe.mockResolvedValue(me({ is_reviewer: false, github_login: null }));
    const { result } = renderHook(() => usePRPartyCapabilities(), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.capabilities).not.toBeNull());
    expect(result.current.isReviewer).toBe(false);
  });

  it("does not call the API for an unauthenticated visitor", () => {
    mockedUseSession.mockReturnValue({ data: null, status: "unauthenticated" });
    const { result } = renderHook(() => usePRPartyCapabilities(), {
      wrapper: createQueryWrapper(),
    });

    expect(mockedGetMe).not.toHaveBeenCalled();
    expect(result.current.isReviewer).toBe(false);
  });

  it("surfaces the degraded posture and credential health", async () => {
    mockedGetMe.mockResolvedValue(
      me({
        degraded: true,
        credential: {
          expires_at: "2026-08-20T00:00:00Z",
          last_validated_at: "2026-07-26T00:00:00Z",
          last_error: "401 from GitHub",
          expired: false,
          expires_soon: true,
        },
        generation_token: { expires_at: null, last_error: "quota" },
      }),
    );
    const { result } = renderHook(() => usePRPartyCapabilities(), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.degraded).toBe(true));
    expect(result.current.credentialExpiringSoon).toBe(true);
    expect(result.current.credentialExpired).toBe(false);
    expect(result.current.generationToken?.last_error).toBe("quota");
  });

  it("scopes the cache key to the signed-in user", async () => {
    // A cached reviewer posture must not survive a user switch in the same tab.
    mockedGetMe.mockResolvedValue(me());
    const wrapper = createQueryWrapper();
    const first = renderHook(() => usePRPartyCapabilities(), { wrapper });
    await waitFor(() => expect(first.result.current.isReviewer).toBe(true));

    mockedUseSession.mockReturnValue(session("someone-else@example.com"));
    mockedGetMe.mockResolvedValue(me({ is_reviewer: false }));
    const second = renderHook(() => usePRPartyCapabilities(), { wrapper });

    await waitFor(() => expect(second.result.current.capabilities).not.toBeNull());
    expect(second.result.current.isReviewer).toBe(false);
    expect(mockedGetMe).toHaveBeenCalledTimes(2);
  });
});
