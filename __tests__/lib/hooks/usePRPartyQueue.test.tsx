import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { createQueryWrapper } from "../../helpers/renderWithProviders";
import type { PRPartyQueueCard } from "@/lib/api/prParty";

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
import {
  usePRPartyQueue,
  usePRPartyCard,
  prPartyQueryKeys,
  prPartyUserKey,
  PR_PARTY_POLL_INTERVAL_MS,
} from "@/lib/hooks/usePRPartyQueue";

const mocked = {
  useSession: useSession as unknown as ReturnType<typeof vi.fn>,
  getQueue: prPartyApi.getQueue as unknown as ReturnType<typeof vi.fn>,
  getCard: prPartyApi.getCard as unknown as ReturnType<typeof vi.fn>,
  submitAction: prPartyApi.submitAction as unknown as ReturnType<typeof vi.fn>,
  unpark: prPartyApi.unpark as unknown as ReturnType<typeof vi.fn>,
  askQuestion: prPartyApi.askQuestion as unknown as ReturnType<typeof vi.fn>,
  addNote: prPartyApi.addNote as unknown as ReturnType<typeof vi.fn>,
  rerunReview: prPartyApi.rerunReview as unknown as ReturnType<typeof vi.fn>,
};

function session(email = "reviewer@example.com") {
  return { data: { user: { email }, accessToken: "tok" }, status: "authenticated" };
}

function card(overrides: Partial<PRPartyQueueCard> = {}): PRPartyQueueCard {
  return {
    card_id: "card-1",
    repo_full_name: "alea-institute/ontokit-api",
    pr_number: 42,
    title: "Add the thing",
    author_kind: "counterpart",
    author_github_login: "counterpart",
    read_only: false,
    state: "open",
    head_sha: "abc123",
    mergeable_state: "clean",
    checks_rollup: "success",
    brief_status: "ready",
    brief_truncated: false,
    ready_at: "2026-07-26T00:00:00Z",
    updated_at_github: "2026-07-26T00:00:00Z",
    pr_url: "https://github.com/alea-institute/ontokit-api/pull/42",
    diff_url: "https://github.com/alea-institute/ontokit-api/pull/42.diff",
    readiness: { ready: true, reason: null },
    actions: [],
    other_reviewer: { has_approved: false, has_pending_intent: false },
    stale: false,
    parked: false,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocked.useSession.mockReturnValue(session());
  mocked.getQueue.mockResolvedValue({
    generated_at: "2026-07-26T00:00:00Z",
    cards: [card()],
  });
});

describe("prPartyQueryKeys", () => {
  it("changes with user identity", () => {
    expect(prPartyQueryKeys.queue("a@example.com")).not.toEqual(
      prPartyQueryKeys.queue("b@example.com"),
    );
    expect(prPartyQueryKeys.capabilities("a@example.com")).not.toEqual(
      prPartyQueryKeys.capabilities(null),
    );
    expect(prPartyQueryKeys.card("a@example.com", "c1")).not.toEqual(
      prPartyQueryKeys.card("a@example.com", "c2"),
    );
  });

  it("nests every key under the same user-scoped root, so one invalidation clears them all", () => {
    const root: readonly unknown[] = prPartyQueryKeys.root("a@example.com");
    const keys: readonly (readonly unknown[])[] = [
      prPartyQueryKeys.queue("a@example.com"),
      prPartyQueryKeys.capabilities("a@example.com"),
      prPartyQueryKeys.card("a@example.com", "c1"),
      prPartyQueryKeys.settings("a@example.com"),
    ];
    for (const key of keys) {
      expect(key.slice(0, root.length)).toEqual(root);
    }
  });

  it("derives the user key from the session identity", () => {
    expect(prPartyUserKey({ user: { email: "a@example.com" } })).toBe("a@example.com");
    expect(prPartyUserKey({ user: { id: "u-1" } })).toBe("u-1");
    expect(prPartyUserKey(null)).toBeNull();
    expect(prPartyUserKey(undefined)).toBeNull();
  });
});

describe("usePRPartyQueue liveness", () => {
  it("polls on the fixed foreground interval", () => {
    // The app defaults (60s stale, no focus refetch) are wrong for a live queue.
    expect(PR_PARTY_POLL_INTERVAL_MS).toBe(25_000);
  });

  it("loads cards for the signed-in reviewer", async () => {
    const { result } = renderHook(() => usePRPartyQueue(), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.cards.length).toBe(1));
    expect(result.current.cards[0].card_id).toBe("card-1");
    expect(result.current.generatedAt).toBe("2026-07-26T00:00:00Z");
    expect(mocked.getQueue).toHaveBeenCalledWith("tok");
  });

  it("does not fetch without a session token", () => {
    mocked.useSession.mockReturnValue({ data: null, status: "unauthenticated" });
    const { result } = renderHook(() => usePRPartyQueue(), {
      wrapper: createQueryWrapper(),
    });

    expect(mocked.getQueue).not.toHaveBeenCalled();
    expect(result.current.cards).toEqual([]);
  });

  it("stays quiet when explicitly disabled (non-reviewers)", () => {
    renderHook(() => usePRPartyQueue({ enabled: false }), {
      wrapper: createQueryWrapper(),
    });
    expect(mocked.getQueue).not.toHaveBeenCalled();
  });

  it("refetches from scratch for a different user", async () => {
    const wrapper = createQueryWrapper();
    const first = renderHook(() => usePRPartyQueue(), { wrapper });
    await waitFor(() => expect(first.result.current.cards.length).toBe(1));

    mocked.useSession.mockReturnValue(session("other@example.com"));
    mocked.getQueue.mockResolvedValue({ generated_at: "later", cards: [] });
    const second = renderHook(() => usePRPartyQueue(), { wrapper });

    await waitFor(() => expect(second.result.current.generatedAt).toBe("later"));
    expect(mocked.getQueue).toHaveBeenCalledTimes(2);
  });
});

describe("usePRPartyQueue mutations", () => {
  it("submits a verdict and refreshes the queue", async () => {
    mocked.submitAction.mockResolvedValue({ action: {}, card: card() });
    const { result } = renderHook(() => usePRPartyQueue(), {
      wrapper: createQueryWrapper(),
    });
    await waitFor(() => expect(result.current.cards.length).toBe(1));

    await act(async () => {
      await result.current.submitAction({
        cardId: "card-1",
        actionKind: "review",
        verdict: "approve",
        headSha: "abc123",
        body: "lgtm",
      });
    });

    expect(mocked.submitAction).toHaveBeenCalledTimes(1);
    const [cardId, input, token] = mocked.submitAction.mock.calls[0];
    expect(cardId).toBe("card-1");
    expect(token).toBe("tok");
    expect(input).toMatchObject({
      action_kind: "review",
      verdict: "approve",
      head_sha: "abc123",
      body: "lgtm",
    });
  });

  it("never retries a failed verdict at the React Query layer", async () => {
    mocked.submitAction.mockRejectedValue(new Error("500"));
    const { result } = renderHook(() => usePRPartyQueue(), {
      wrapper: createQueryWrapper(),
    });

    await act(async () => {
      await result.current
        .submitAction({
          cardId: "card-1",
          actionKind: "review",
          verdict: "approve",
          headSha: "abc123",
        })
        .catch(() => undefined);
    });

    expect(mocked.submitAction).toHaveBeenCalledTimes(1);
  });

  it("submits a merge with the reviewer's merge method", async () => {
    mocked.submitAction.mockResolvedValue({ action: {}, card: card() });
    const { result } = renderHook(() => usePRPartyQueue(), {
      wrapper: createQueryWrapper(),
    });

    await act(async () => {
      await result.current.submitAction({
        cardId: "card-1",
        actionKind: "merge",
        headSha: "abc123",
        mergeMethod: "squash",
        override: true,
      });
    });

    const [, input] = mocked.submitAction.mock.calls[0];
    expect(input).toMatchObject({
      action_kind: "merge",
      merge_method: "squash",
      override: true,
    });
  });

  it("unparks a card", async () => {
    mocked.unpark.mockResolvedValue(card({ parked: false }));
    const { result } = renderHook(() => usePRPartyQueue(), {
      wrapper: createQueryWrapper(),
    });

    await act(async () => {
      await result.current.unparkCard({ cardId: "card-1" });
    });
    expect(mocked.unpark).toHaveBeenCalledWith("card-1", "tok");
  });

  it("asks a question, adds a note, and re-runs the review", async () => {
    mocked.askQuestion.mockResolvedValue({ posted: true });
    mocked.addNote.mockResolvedValue({ posted: true });
    mocked.rerunReview.mockResolvedValue({ posted: true });
    const { result } = renderHook(() => usePRPartyQueue(), {
      wrapper: createQueryWrapper(),
    });

    await act(async () => {
      await result.current.askQuestion({ cardId: "card-1", question: "why?" });
      await result.current.addNote({ cardId: "card-1", note: "parking" });
      await result.current.rerunReview({ cardId: "card-1" });
    });

    expect(mocked.askQuestion).toHaveBeenCalledWith("card-1", "why?", "tok");
    expect(mocked.addNote).toHaveBeenCalledWith("card-1", "parking", "tok");
    expect(mocked.rerunReview).toHaveBeenCalledWith("card-1", "tok");
  });
});

describe("usePRPartyCard", () => {
  it("reads one card's detail", async () => {
    mocked.getCard.mockResolvedValue({
      ...card(),
      brief_what: "what",
      brief_why: "why",
      brief_decisions: [],
      brief_links: [],
      truncated_note: null,
      brewing_since: null,
      created_at: "2026-07-26T00:00:00Z",
      updated_at: "2026-07-26T00:00:00Z",
      qa_thread: [],
    });

    const { result } = renderHook(() => usePRPartyCard("card-1"), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.card).not.toBeNull());
    expect(result.current.card?.brief_what).toBe("what");
    expect(mocked.getCard).toHaveBeenCalledWith("card-1", "tok");
  });

  it("does not fetch without a card id", () => {
    renderHook(() => usePRPartyCard(undefined), { wrapper: createQueryWrapper() });
    expect(mocked.getCard).not.toHaveBeenCalled();
  });
});
