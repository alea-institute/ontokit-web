import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

// Mock the anonymousSuggestionsApi module — X-Anonymous-Token header
// threading itself lives inside lib/api/suggestions.ts (already covered by
// reading the client code); here we verify the hook passes the right
// arguments (including the anonymous token) into that API surface.
vi.mock("@/lib/api/suggestions", () => ({
  anonymousSuggestionsApi: {
    createSession: vi.fn(),
    save: vi.fn(),
    submit: vi.fn(),
    discard: vi.fn(),
    beacon: vi.fn(),
  },
}));

import { anonymousSuggestionsApi } from "@/lib/api/suggestions";
import { useAnonymousSuggestion } from "@/lib/hooks/useAnonymousSuggestion";
import { useAnonymousTokenStore } from "@/lib/stores/anonymousCreditStore";

const mockedCreateSession = anonymousSuggestionsApi.createSession as ReturnType<typeof vi.fn>;
const mockedSave = anonymousSuggestionsApi.save as ReturnType<typeof vi.fn>;
const mockedSubmit = anonymousSuggestionsApi.submit as ReturnType<typeof vi.fn>;
const mockedDiscard = anonymousSuggestionsApi.discard as ReturnType<typeof vi.fn>;

const PROJECT_ID = "proj-1";

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  useAnonymousTokenStore.setState({ tokens: {} });
  localStorage.clear();
  sessionStorage.clear();
});

describe("useAnonymousSuggestion", () => {
  it("starts idle with no session when nothing is persisted", () => {
    const { result } = renderHook(() => useAnonymousSuggestion({ projectId: PROJECT_ID }));

    expect(result.current.status).toBe("idle");
    expect(result.current.sessionId).toBeNull();
    expect(result.current.branch).toBeNull();
    expect(result.current.anonymousToken).toBeNull();
    expect(result.current.isActive).toBe(false);
    expect(result.current.changesCount).toBe(0);
  });

  it("restores an active session from the persisted token store on mount", async () => {
    useAnonymousTokenStore.getState().setToken(PROJECT_ID, "tok-restored", "sess-restored", "anon/sess-restored");

    const { result } = renderHook(() => useAnonymousSuggestion({ projectId: PROJECT_ID }));

    await waitFor(() => expect(result.current.status).toBe("active"));
    expect(result.current.sessionId).toBe("sess-restored");
    expect(result.current.branch).toBe("anon/sess-restored");
    expect(result.current.anonymousToken).toBe("tok-restored");
    expect(result.current.isActive).toBe(true);
    // Restoring from localStorage must not call the API
    expect(mockedCreateSession).not.toHaveBeenCalled();
  });

  it("refuses an expired restored session and clears its persisted entry", async () => {
    vi.setSystemTime(new Date("2026-08-24T12:00:00Z"));
    useAnonymousTokenStore.setState({
      tokens: {
        [PROJECT_ID]: {
          token: "tok-expired",
          sessionId: "sess-expired",
          branch: "anon/sess-expired",
          issuedAt: Date.now() - 86_400_001,
          expiresAt: Date.now() - 1,
        },
      },
    });

    const { result } = renderHook(() => useAnonymousSuggestion({ projectId: PROJECT_ID }));

    await waitFor(() => expect(result.current.status).toBe("idle"));
    expect(result.current.sessionId).toBeNull();
    expect(result.current.anonymousToken).toBeNull();
    expect(useAnonymousTokenStore.getState().getToken(PROJECT_ID)).toBeNull();
  });

  it("startSession creates a session, persists the token, and activates", async () => {
    vi.setSystemTime(new Date("2026-08-24T12:00:00Z"));
    mockedCreateSession.mockResolvedValue({
      session_id: "sess-1",
      branch: "anon/sess-1",
      created_at: "2026-08-24T11:59:00Z",
      anonymous_token: "tok-1",
    });

    const { result } = renderHook(() => useAnonymousSuggestion({ projectId: PROJECT_ID }));

    await act(async () => {
      await result.current.startSession();
    });

    expect(mockedCreateSession).toHaveBeenCalledWith(PROJECT_ID);
    expect(result.current.status).toBe("active");
    expect(result.current.sessionId).toBe("sess-1");
    expect(result.current.branch).toBe("anon/sess-1");
    expect(result.current.anonymousToken).toBe("tok-1");
    expect(result.current.isActive).toBe(true);

    // Token must be persisted so the session survives navigation/reload
    expect(useAnonymousTokenStore.getState().getToken(PROJECT_ID)).toEqual({
      token: "tok-1",
      sessionId: "sess-1",
      branch: "anon/sess-1",
      issuedAt: Date.parse("2026-08-24T11:59:00Z"),
      expiresAt: Date.parse("2026-08-25T11:59:00Z"),
    });
    expect(sessionStorage.getItem("ontokit-anonymous-token")).toContain("tok-1");
    expect(localStorage.getItem("ontokit-anonymous-token")).toBeNull();
  });

  it("startSession does nothing if a session is already active", async () => {
    mockedCreateSession.mockResolvedValue({
      session_id: "sess-1",
      branch: "anon/sess-1",
      created_at: "2024-01-01T00:00:00Z",
      anonymous_token: "tok-1",
    });

    const { result } = renderHook(() => useAnonymousSuggestion({ projectId: PROJECT_ID }));

    await act(async () => {
      await result.current.startSession();
    });
    await act(async () => {
      await result.current.startSession();
    });

    expect(mockedCreateSession).toHaveBeenCalledTimes(1);
  });

  it("startSession surfaces errors via onError and status", async () => {
    mockedCreateSession.mockRejectedValue(new Error("network down"));
    const onError = vi.fn();

    const { result } = renderHook(() =>
      useAnonymousSuggestion({ projectId: PROJECT_ID, onError }),
    );

    await act(async () => {
      await result.current.startSession();
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("network down");
    expect(onError).toHaveBeenCalledWith("network down");
  });

  it("saveToSession threads the anonymous token and updates changes/entities", async () => {
    mockedCreateSession.mockResolvedValue({
      session_id: "sess-1",
      branch: "anon/sess-1",
      created_at: "2024-01-01T00:00:00Z",
      anonymous_token: "tok-1",
    });
    mockedSave.mockResolvedValue({
      commit_hash: "abc123",
      branch: "anon/sess-1",
      changes_count: 1,
    });

    const { result } = renderHook(() => useAnonymousSuggestion({ projectId: PROJECT_ID }));

    await act(async () => {
      await result.current.startSession();
    });
    await act(async () => {
      await result.current.saveToSession("ttl content", "http://ex.org/A", "A");
    });

    expect(mockedSave).toHaveBeenCalledWith(
      PROJECT_ID,
      "sess-1",
      { content: "ttl content", entity_iri: "http://ex.org/A", entity_label: "A" },
      "tok-1",
    );
    expect(result.current.changesCount).toBe(1);
    expect(result.current.entitiesModified).toEqual(["A"]);
    expect(result.current.status).toBe("active");
  });

  it("saveToSession deduplicates entity labels", async () => {
    mockedCreateSession.mockResolvedValue({
      session_id: "sess-1",
      branch: "anon/sess-1",
      created_at: "2024-01-01T00:00:00Z",
      anonymous_token: "tok-1",
    });
    mockedSave.mockResolvedValue({ commit_hash: "c", branch: "anon/sess-1", changes_count: 2 });

    const { result } = renderHook(() => useAnonymousSuggestion({ projectId: PROJECT_ID }));

    await act(async () => {
      await result.current.startSession();
    });
    await act(async () => {
      await result.current.saveToSession("c1", "http://ex.org/A", "A");
    });
    await act(async () => {
      await result.current.saveToSession("c2", "http://ex.org/A", "A");
    });

    expect(result.current.entitiesModified).toEqual(["A"]);
  });

  it("saveToSession does nothing without an active session", async () => {
    const { result } = renderHook(() => useAnonymousSuggestion({ projectId: PROJECT_ID }));

    await act(async () => {
      await result.current.saveToSession("content", "http://ex.org/A", "A");
    });

    expect(mockedSave).not.toHaveBeenCalled();
  });

  it("saveToSession surfaces errors via onError and status", async () => {
    mockedCreateSession.mockResolvedValue({
      session_id: "sess-1",
      branch: "anon/sess-1",
      created_at: "2024-01-01T00:00:00Z",
      anonymous_token: "tok-1",
    });
    mockedSave.mockRejectedValue(new Error("save failed"));
    const onError = vi.fn();

    const { result } = renderHook(() =>
      useAnonymousSuggestion({ projectId: PROJECT_ID, onError }),
    );

    await act(async () => {
      await result.current.startSession();
    });
    await act(async () => {
      await result.current.saveToSession("content", "http://ex.org/A", "A");
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("save failed");
    expect(onError).toHaveBeenCalledWith("save failed");
  });

  it("submitSession sends credit fields, defaults the honeypot to empty, and clears the persisted token", async () => {
    mockedCreateSession.mockResolvedValue({
      session_id: "sess-1",
      branch: "anon/sess-1",
      created_at: "2024-01-01T00:00:00Z",
      anonymous_token: "tok-1",
    });
    mockedSubmit.mockResolvedValue({
      pr_number: 7,
      pr_url: "http://example.org/pr/7",
      status: "submitted",
    });
    const onSubmitted = vi.fn();

    const { result } = renderHook(() =>
      useAnonymousSuggestion({ projectId: PROJECT_ID, onSubmitted }),
    );

    await act(async () => {
      await result.current.startSession();
    });
    await act(async () => {
      await result.current.submitSession("My summary", "Ada Lovelace", "ada@example.org");
    });

    expect(mockedSubmit).toHaveBeenCalledWith(
      PROJECT_ID,
      "sess-1",
      {
        summary: "My summary",
        submitter_name: "Ada Lovelace",
        submitter_email: "ada@example.org",
        website: "", // honeypot — defaults to empty when no value was captured
      },
      "tok-1",
    );

    expect(result.current.status).toBe("submitted");
    expect(onSubmitted).toHaveBeenCalledWith(7, "http://example.org/pr/7");

    // Session state resets so a new proposal can start
    expect(result.current.sessionId).toBeNull();
    expect(result.current.branch).toBeNull();
    expect(result.current.anonymousToken).toBeNull();
    expect(result.current.changesCount).toBe(0);

    // Persisted token must be cleared on successful submit
    expect(useAnonymousTokenStore.getState().getToken(PROJECT_ID)).toBeNull();
  });

  it("submitSession omits credit fields when name/email are not provided, still defaulting the honeypot to empty", async () => {
    mockedCreateSession.mockResolvedValue({
      session_id: "sess-1",
      branch: "anon/sess-1",
      created_at: "2024-01-01T00:00:00Z",
      anonymous_token: "tok-1",
    });
    mockedSubmit.mockResolvedValue({ pr_number: 8, pr_url: null, status: "submitted" });

    const { result } = renderHook(() => useAnonymousSuggestion({ projectId: PROJECT_ID }));

    await act(async () => {
      await result.current.startSession();
    });
    await act(async () => {
      await result.current.submitSession();
    });

    expect(mockedSubmit).toHaveBeenCalledWith(
      PROJECT_ID,
      "sess-1",
      { summary: undefined, submitter_name: undefined, submitter_email: undefined, website: "" },
      "tok-1",
    );
  });

  it("submitSession surfaces errors via onError and status", async () => {
    mockedCreateSession.mockResolvedValue({
      session_id: "sess-1",
      branch: "anon/sess-1",
      created_at: "2024-01-01T00:00:00Z",
      anonymous_token: "tok-1",
    });
    mockedSubmit.mockRejectedValue(new Error("submit failed"));
    const onError = vi.fn();

    const { result } = renderHook(() =>
      useAnonymousSuggestion({ projectId: PROJECT_ID, onError }),
    );

    await act(async () => {
      await result.current.startSession();
    });
    await act(async () => {
      await result.current.submitSession();
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("submit failed");
    expect(onError).toHaveBeenCalledWith("submit failed");
  });

  it("discardSession clears state and the persisted token even when the API call fails (best-effort)", async () => {
    mockedCreateSession.mockResolvedValue({
      session_id: "sess-1",
      branch: "anon/sess-1",
      created_at: "2024-01-01T00:00:00Z",
      anonymous_token: "tok-1",
    });
    mockedDiscard.mockRejectedValue(new Error("network error"));

    const { result } = renderHook(() => useAnonymousSuggestion({ projectId: PROJECT_ID }));

    await act(async () => {
      await result.current.startSession();
    });
    await act(async () => {
      await result.current.discardSession();
    });

    expect(mockedDiscard).toHaveBeenCalledWith(PROJECT_ID, "sess-1", "tok-1");
    expect(result.current.status).toBe("idle");
    expect(result.current.sessionId).toBeNull();
    expect(useAnonymousTokenStore.getState().getToken(PROJECT_ID)).toBeNull();
  });

  it("discardSession does nothing without an active session", async () => {
    const { result } = renderHook(() => useAnonymousSuggestion({ projectId: PROJECT_ID }));

    await act(async () => {
      await result.current.discardSession();
    });

    expect(mockedDiscard).not.toHaveBeenCalled();
  });

  it("submitSession forwards a captured honeypot value VERBATIM (server-side control needs the bot signal)", async () => {
    mockedCreateSession.mockResolvedValue({
      session_id: "sess-1",
      branch: "anon/sess-1",
      created_at: "2024-01-01T00:00:00Z",
      anonymous_token: "tok-1",
    });
    mockedSubmit.mockResolvedValue({ pr_number: 7, pr_url: "http://example.org/pr/7", status: "submitted" });

    const { result } = renderHook(() => useAnonymousSuggestion({ projectId: PROJECT_ID }));
    await act(async () => {
      await result.current.startSession();
    });
    await act(async () => {
      await result.current.submitSession(undefined, undefined, undefined, "http://spam.example");
    });

    expect(mockedSubmit).toHaveBeenCalledWith(
      PROJECT_ID,
      "sess-1",
      expect.objectContaining({ website: "http://spam.example" }),
      "tok-1",
    );
  });

  it("submitSession guards against double-submit while a submit is in flight", async () => {
    mockedCreateSession.mockResolvedValue({
      session_id: "sess-1",
      branch: "anon/sess-1",
      created_at: "2024-01-01T00:00:00Z",
      anonymous_token: "tok-1",
    });
    let resolveSubmit: (v: unknown) => void = () => {};
    mockedSubmit.mockImplementation(
      () => new Promise((resolve) => { resolveSubmit = resolve; }),
    );

    const { result } = renderHook(() => useAnonymousSuggestion({ projectId: PROJECT_ID }));
    await act(async () => {
      await result.current.startSession();
    });

    let first: Promise<void>;
    act(() => {
      first = result.current.submitSession();
      // second call while the first is still pending must be a no-op
      void result.current.submitSession();
    });
    await act(async () => {
      resolveSubmit({ pr_number: 7, pr_url: null, status: "submitted" });
      await first!;
    });

    expect(mockedSubmit).toHaveBeenCalledTimes(1);
  });

});
