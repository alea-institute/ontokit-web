import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useSuggestionSession } from "@/lib/hooks/useSuggestionSession";

// Mock the suggestionsApi module
vi.mock("@/lib/api/suggestions", () => ({
  suggestionsApi: {
    createSession: vi.fn(),
    save: vi.fn(),
    submit: vi.fn(),
    discard: vi.fn(),
    listSessions: vi.fn(),
    resubmit: vi.fn(),
    reopen: vi.fn(),
  },
}));

import { suggestionsApi } from "@/lib/api/suggestions";

const mockedCreateSession = suggestionsApi.createSession as ReturnType<typeof vi.fn>;
const mockedSave = suggestionsApi.save as ReturnType<typeof vi.fn>;
const mockedSubmit = suggestionsApi.submit as ReturnType<typeof vi.fn>;
const mockedDiscard = suggestionsApi.discard as ReturnType<typeof vi.fn>;
const mockedListSessions = suggestionsApi.listSessions as ReturnType<typeof vi.fn>;
const mockedResubmit = suggestionsApi.resubmit as ReturnType<typeof vi.fn>;

const BASE_OPTIONS = {
  projectId: "proj-1",
  accessToken: "token-123",
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("useSuggestionSession", () => {
  it("starts with idle status and no session", () => {
    const { result } = renderHook(() => useSuggestionSession(BASE_OPTIONS));

    expect(result.current.status).toBe("idle");
    expect(result.current.sessionId).toBeNull();
    expect(result.current.branch).toBeNull();
    expect(result.current.isActive).toBe(false);
    expect(result.current.changesCount).toBe(0);
    expect(result.current.entitiesModified).toEqual([]);
  });

  it("startSession creates a session and transitions to active", async () => {
    mockedCreateSession.mockResolvedValue({
      session_id: "sess-1",
      branch: "suggest/sess-1",
      created_at: "2024-01-01T00:00:00Z",
      beacon_token: "signed-beacon-token",
    });

    const { result } = renderHook(() => useSuggestionSession(BASE_OPTIONS));

    await act(async () => {
      await result.current.startSession();
    });

    expect(result.current.status).toBe("active");
    expect(result.current.sessionId).toBe("sess-1");
    expect(result.current.branch).toBe("suggest/sess-1");
    expect(result.current.beaconToken).toBe("signed-beacon-token");
    expect(result.current.isActive).toBe(true);
    expect(mockedCreateSession).toHaveBeenCalledWith("proj-1", "token-123");
  });

  it("does not issue another save while a save is in flight", async () => {
    mockedCreateSession.mockResolvedValue({
      session_id: "sess-1",
      branch: "suggest/sess-1",
      created_at: "2024-01-01T00:00:00Z",
    });
    let resolveSave!: (value: {
      commit_hash: string;
      branch: string;
      changes_count: number;
    }) => void;
    mockedSave.mockImplementation(
      () => new Promise((resolve) => { resolveSave = resolve; }),
    );
    const { result } = renderHook(() => useSuggestionSession(BASE_OPTIONS));
    await act(async () => {
      await result.current.startSession();
    });

    let firstSave!: Promise<boolean>;
    await act(async () => {
      firstSave = result.current.saveToSession("one", "http://ex.org/A", "A");
      await expect(
        result.current.saveToSession("two", "http://ex.org/B", "B"),
      ).resolves.toBe(false);
    });
    expect(mockedSave).toHaveBeenCalledTimes(1);

    resolveSave({ commit_hash: "abc", branch: "suggest/sess-1", changes_count: 1 });
    await act(async () => { await firstSave; });
  });

  it("startSession does nothing when session already exists", async () => {
    mockedCreateSession.mockResolvedValue({
      session_id: "sess-1",
      branch: "suggest/sess-1",
      created_at: "2024-01-01T00:00:00Z",
    });

    const { result } = renderHook(() => useSuggestionSession(BASE_OPTIONS));

    await act(async () => {
      await result.current.startSession();
    });

    // Try to start again
    await act(async () => {
      await result.current.startSession();
    });

    expect(mockedCreateSession).toHaveBeenCalledTimes(1);
  });

  it("startSession does nothing without accessToken", async () => {
    const { result } = renderHook(() =>
      useSuggestionSession({ projectId: "proj-1" }),
    );

    await act(async () => {
      await result.current.startSession();
    });

    expect(mockedCreateSession).not.toHaveBeenCalled();
    expect(result.current.status).toBe("idle");
  });

  it("startSession handles errors", async () => {
    mockedCreateSession.mockRejectedValue(new Error("Failed to create"));
    const onError = vi.fn();

    const { result } = renderHook(() =>
      useSuggestionSession({ ...BASE_OPTIONS, onError }),
    );

    await act(async () => {
      await result.current.startSession();
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("Failed to create");
    expect(onError).toHaveBeenCalledWith("Failed to create");
  });

  it("saveToSession saves content and updates changes count", async () => {
    mockedCreateSession.mockResolvedValue({
      session_id: "sess-1",
      branch: "suggest/sess-1",
      created_at: "2024-01-01T00:00:00Z",
    });
    mockedSave.mockResolvedValue({
      commit_hash: "abc123",
      branch: "suggest/sess-1",
      changes_count: 1,
    });

    const { result } = renderHook(() => useSuggestionSession(BASE_OPTIONS));

    await act(async () => {
      await result.current.startSession();
    });

    await act(async () => {
      await result.current.saveToSession("content", "http://ex.org/A", "A");
    });

    expect(result.current.changesCount).toBe(1);
    expect(result.current.entitiesModified).toEqual(["A"]);
    expect(result.current.status).toBe("active");
  });

  it("can save immediately after starting with callbacks from the same render", async () => {
    mockedCreateSession.mockResolvedValue({
      session_id: "sess-immediate",
      branch: "suggest/sess-immediate",
      created_at: "2024-01-01T00:00:00Z",
    });
    mockedSave.mockResolvedValue({
      commit_hash: "abc123",
      branch: "suggest/sess-immediate",
      changes_count: 1,
    });
    const { result } = renderHook(() => useSuggestionSession(BASE_OPTIONS));
    const { startSession, saveToSession } = result.current;

    await act(async () => {
      expect(await startSession()).toBe("suggest/sess-immediate");
      expect(await saveToSession("content", "http://ex.org/A", "A")).toBe(true);
    });

    expect(mockedSave).toHaveBeenCalledTimes(1);
  });

  it("saveToSession deduplicates entity labels", async () => {
    mockedCreateSession.mockResolvedValue({
      session_id: "sess-1",
      branch: "suggest/sess-1",
      created_at: "2024-01-01T00:00:00Z",
    });
    mockedSave.mockResolvedValue({
      commit_hash: "abc",
      branch: "suggest/sess-1",
      changes_count: 2,
    });

    const { result } = renderHook(() => useSuggestionSession(BASE_OPTIONS));

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
    const { result } = renderHook(() => useSuggestionSession(BASE_OPTIONS));

    await act(async () => {
      await result.current.saveToSession("content", "http://ex.org/A", "A");
    });

    expect(mockedSave).not.toHaveBeenCalled();
  });

  it("saveToSession handles errors", async () => {
    mockedCreateSession.mockResolvedValue({
      session_id: "sess-1",
      branch: "suggest/sess-1",
      created_at: "2024-01-01T00:00:00Z",
    });
    mockedSave.mockRejectedValue(new Error("Save failed"));
    const onError = vi.fn();

    const { result } = renderHook(() =>
      useSuggestionSession({ ...BASE_OPTIONS, onError }),
    );

    await act(async () => {
      await result.current.startSession();
    });

    await act(async () => {
      await result.current.saveToSession("content", "http://ex.org/A", "A");
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("Save failed");
    expect(onError).toHaveBeenCalledWith("Save failed");
  });

  it("submitSession creates PR and resets state", async () => {
    mockedCreateSession.mockResolvedValue({
      session_id: "sess-1",
      branch: "suggest/sess-1",
      created_at: "2024-01-01T00:00:00Z",
    });
    mockedSubmit.mockResolvedValue({
      pr_number: 42,
      pr_url: "http://example.org/pr/42",
      status: "submitted",
    });
    const onSubmitted = vi.fn();

    const { result } = renderHook(() =>
      useSuggestionSession({ ...BASE_OPTIONS, onSubmitted }),
    );

    await act(async () => {
      await result.current.startSession();
    });

    await act(async () => {
      await result.current.submitSession("My summary");
    });

    expect(result.current.status).toBe("submitted");
    expect(onSubmitted).toHaveBeenCalledWith(42, "http://example.org/pr/42");
    expect(result.current.sessionId).toBeNull();
    expect(result.current.branch).toBeNull();
    expect(result.current.changesCount).toBe(0);
  });

  it("submitSession handles errors", async () => {
    mockedCreateSession.mockResolvedValue({
      session_id: "sess-1",
      branch: "suggest/sess-1",
      created_at: "2024-01-01T00:00:00Z",
    });
    mockedSubmit.mockRejectedValue(new Error("Submit failed"));
    const onError = vi.fn();

    const { result } = renderHook(() =>
      useSuggestionSession({ ...BASE_OPTIONS, onError }),
    );

    await act(async () => {
      await result.current.startSession();
    });

    await act(async () => {
      await result.current.submitSession();
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("Submit failed");
  });

  it("discardSession resets all state", async () => {
    mockedCreateSession.mockResolvedValue({
      session_id: "sess-1",
      branch: "suggest/sess-1",
      created_at: "2024-01-01T00:00:00Z",
    });
    mockedDiscard.mockResolvedValue(undefined);

    const { result } = renderHook(() => useSuggestionSession(BASE_OPTIONS));

    await act(async () => {
      await result.current.startSession();
    });
    expect(result.current.sessionId).toBe("sess-1");

    await act(async () => {
      await result.current.discardSession();
    });

    expect(result.current.status).toBe("idle");
    expect(result.current.sessionId).toBeNull();
    expect(result.current.branch).toBeNull();
    expect(result.current.changesCount).toBe(0);
    expect(result.current.entitiesModified).toEqual([]);
    expect(result.current.isResumed).toBe(false);
  });

  it("discardSession still resets state when API call fails", async () => {
    mockedCreateSession.mockResolvedValue({
      session_id: "sess-1",
      branch: "suggest/sess-1",
      created_at: "2024-01-01T00:00:00Z",
    });
    mockedDiscard.mockRejectedValue(new Error("Discard failed"));

    const { result } = renderHook(() => useSuggestionSession(BASE_OPTIONS));

    await act(async () => {
      await result.current.startSession();
    });

    await act(async () => {
      await result.current.discardSession();
    });

    // State should still be reset (best-effort discard)
    expect(result.current.status).toBe("idle");
    expect(result.current.sessionId).toBeNull();
  });

  it("resumeSession adopts the full verified session snapshot", () => {
    const { result } = renderHook(() => useSuggestionSession(BASE_OPTIONS));

    act(() => {
      result.current.resumeSession({ sessionId: "sess-2", branch: "suggest/sess-2", beaconToken: "fresh-beacon", changesCount: 3, entitiesModified: ["Person"] });
    });

    expect(result.current.sessionId).toBe("sess-2");
    expect(result.current.branch).toBe("suggest/sess-2");
    expect(result.current.beaconToken).toBe("fresh-beacon");
    expect(result.current.changesCount).toBe(3);
    expect(result.current.entitiesModified).toEqual(["Person"]);
    expect(result.current.status).toBe("active");
    expect(result.current.isResumed).toBe(true);
  });

  it("clears a previous session's beacon token on resume", async () => {
    mockedCreateSession.mockResolvedValue({
      session_id: "sess-1",
      branch: "suggest/sess-1",
      created_at: "2024-01-01T00:00:00Z",
      beacon_token: "signed-beacon-token",
    });
    const { result } = renderHook(() => useSuggestionSession(BASE_OPTIONS));
    await act(async () => { await result.current.startSession(); });
    expect(result.current.beaconToken).toBe("signed-beacon-token");

    act(() => { result.current.resumeSession({ sessionId: "sess-2", branch: "suggest/sess-2", beaconToken: null }); });

    expect(result.current.beaconToken).toBeNull();
  });

  it("saves through a resumed session id", async () => {
    mockedSave.mockResolvedValue({
      commit_hash: "abc",
      branch: "suggest/sess-2",
      changes_count: 1,
    });
    const { result } = renderHook(() => useSuggestionSession(BASE_OPTIONS));

    act(() => {
      result.current.resumeSession({ sessionId: "sess-2", branch: "suggest/sess-2", beaconToken: null });
    });
    await act(async () => {
      await result.current.saveToSession("content", "http://ex.org/A", "A");
    });

    expect(mockedSave).toHaveBeenCalledWith(
      "proj-1",
      "sess-2",
      expect.any(Object),
      "token-123",
    );
  });

  it("resubmitSession submits and resets state", async () => {
    mockedResubmit.mockResolvedValue({
      pr_number: 43,
      pr_url: null,
      status: "submitted",
    });
    const onSubmitted = vi.fn();

    const { result } = renderHook(() =>
      useSuggestionSession({ ...BASE_OPTIONS, onSubmitted }),
    );

    act(() => {
      result.current.resumeSession({ sessionId: "sess-2", branch: "suggest/sess-2", beaconToken: null });
    });

    await act(async () => {
      await result.current.resubmitSession("Updated summary");
    });

    expect(result.current.status).toBe("submitted");
    expect(onSubmitted).toHaveBeenCalledWith(43, null);
    expect(result.current.sessionId).toBeNull();
    expect(result.current.isResumed).toBe(false);
  });

  it("reopens a changes-requested session before enabling edits and restores its saved state", async () => {
    vi.mocked(suggestionsApi.reopen).mockResolvedValue({
      session_id: "sess-resume",
      branch: "suggest/sess-resume",
      created_at: "2024-01-01",
      beacon_token: "fresh-resume-beacon",
    });
    mockedListSessions.mockResolvedValue({
      items: [
        {
          session_id: "sess-resume",
          branch: "suggest/sess-resume",
          status: "changes-requested",
          changes_count: 3,
          last_activity: "2024-01-01",
          entities_modified: [],
        },
      ],
    });

    const { result } = renderHook(() =>
      useSuggestionSession({
        ...BASE_OPTIONS,
        resumeSessionId: "sess-resume",
        resumeBranch: "suggest/sess-resume",
      }),
    );

    await waitFor(() => expect(result.current.status).toBe("active"));
    expect(result.current.sessionId).toBe("sess-resume");
    expect(suggestionsApi.reopen).toHaveBeenCalledExactlyOnceWith("proj-1", "sess-resume", "token-123");
    expect(result.current.beaconToken).toBe("fresh-resume-beacon");
    expect(result.current.changesCount).toBe(3);
    expect(result.current.isResumed).toBe(true);
  });

  it.each(["resume", "different-session"])("reloads an active resume only when createSession returns the requested id (%s)", async returnedId => {
    mockedListSessions.mockResolvedValue({ items: [{
      session_id: "resume", branch: "suggest/resume", status: "active",
      changes_count: 3, entities_modified: ["Person"],
    }] });
    mockedCreateSession.mockResolvedValue({ session_id: returnedId, branch: "suggest/resume", beacon_token: "renewed-beacon", created_at: "2026-01-01" });
    const onError = vi.fn();
    const { result } = renderHook(() => useSuggestionSession({
      ...BASE_OPTIONS, viewerId: "viewer", resumeSessionId: "resume", resumeBranch: "stale-branch", onError,
    }));
    await waitFor(() => expect(mockedCreateSession).toHaveBeenCalledExactlyOnceWith("proj-1", "token-123"));
    expect(suggestionsApi.reopen).not.toHaveBeenCalled();
    if (returnedId === "resume") {
      await waitFor(() => expect(result.current).toMatchObject({ status: "active", sessionId: "resume", branch: "suggest/resume", beaconToken: "renewed-beacon", changesCount: 3, entitiesModified: ["Person"], isResumed: true }));
      expect(onError).not.toHaveBeenCalled();
    } else {
      await waitFor(() => expect(result.current.status).toBe("error"));
      expect(result.current).toMatchObject({ sessionId: null, beaconToken: null, isActive: false, isResumed: false });
      expect(onError).toHaveBeenCalledOnce();
      await act(async () => {
        expect(await result.current.startSession()).toBeNull();
        expect(await result.current.saveToSession("draft", "iri", "Person")).toBe(false);
        await result.current.resubmitSession();
      });
      expect(mockedSave).not.toHaveBeenCalled();
      expect(mockedResubmit).not.toHaveBeenCalled();
    }
  });

  it("does not auto-resume when session is not editable", async () => {
    mockedListSessions.mockResolvedValue({
      items: [
        {
          session_id: "sess-other",
          branch: "suggest/sess-other",
          status: "submitted",
          changes_count: 1,
          last_activity: "2024-01-01",
          entities_modified: [],
        },
      ],
    });
    const onError = vi.fn();

    const { result } = renderHook(() =>
      useSuggestionSession({
        ...BASE_OPTIONS,
        resumeSessionId: "sess-other",
        resumeBranch: "suggest/sess-other",
        onError,
      }),
    );

    await waitFor(() =>
      expect(onError).toHaveBeenCalledWith(
        "This suggestion session is no longer available for editing.",
      ),
    );
    expect(result.current.status).toBe("error");
    expect(result.current.isActive).toBe(false);
  });
  it.each(["Not owner", "Wrong status", "Another session is active"])("keeps a failed reopen read-only: %s", async message => {
    mockedListSessions.mockResolvedValue({ items: [{
      session_id: "resume", branch: "suggest/resume", status: "changes-requested",
      changes_count: 2, entities_modified: ["Person"],
    }] });
    vi.mocked(suggestionsApi.reopen).mockRejectedValue(new Error(message));
    const onError = vi.fn();
    const { result } = renderHook(() => useSuggestionSession({
      ...BASE_OPTIONS, resumeSessionId: "resume", resumeBranch: "suggest/resume", onError,
    }));
    await waitFor(() => expect(result.current.error).toBe(message));
    expect(result.current).toMatchObject({ status: "error", sessionId: null, beaconToken: null, isActive: false });
    await act(async () => {
      expect(await result.current.startSession()).toBeNull();
      expect(await result.current.saveToSession("draft", "iri", "Person")).toBe(false);
      await result.current.resubmitSession();
    });
    expect(mockedCreateSession).not.toHaveBeenCalled();
    expect(mockedSave).not.toHaveBeenCalled();
    expect(mockedResubmit).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledExactlyOnceWith(message);
  });

  it.each(["before", "after"])("recovers when obsolete credentials fail %s token renewal during reopen", async timing => {
    mockedListSessions.mockResolvedValue({ items: [{ session_id: "resume", status: "changes-requested", branch: "branch", changes_count: 2, entities_modified: ["Person"] }] });
    let reject!: (reason: Error) => void;
    vi.mocked(suggestionsApi.reopen).mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; }))
      .mockResolvedValueOnce({ session_id: "resume", branch: "branch", beacon_token: "fresh", created_at: "2026-01-01" });
    const { result, rerender } = renderHook(({ token }) => useSuggestionSession({ ...BASE_OPTIONS, accessToken: token, viewerId: "viewer", resumeSessionId: "resume", resumeBranch: "branch" }), { initialProps: { token: "old" } });
    await waitFor(() => expect(suggestionsApi.reopen).toHaveBeenCalledOnce());
    if (timing === "after") rerender({ token: "renewed" });
    await act(async () => reject(new Error("Expired")));
    if (timing === "before") rerender({ token: "renewed" });
    await waitFor(() => expect(result.current).toMatchObject({ isActive: true, beaconToken: "fresh", changesCount: 2 }));
    expect(suggestionsApi.reopen).toHaveBeenLastCalledWith("proj-1", "resume", "renewed");
  });

  it("waits for reopen and preserves its fresh token across credential renewal without reopening twice", async () => {
    mockedListSessions.mockResolvedValue({ items: [{
      session_id: "resume", branch: "suggest/resume", status: "changes-requested",
      changes_count: 3, entities_modified: ["Person"],
    }] });
    let finish!: (value: Awaited<ReturnType<typeof suggestionsApi.reopen>>) => void;
    vi.mocked(suggestionsApi.reopen).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const { result, rerender } = renderHook(({ token }) => useSuggestionSession({
      ...BASE_OPTIONS, accessToken: token, viewerId: "viewer", resumeSessionId: "resume", resumeBranch: "stale-url-branch",
    }), { initialProps: { token: "old" } });
    await waitFor(() => expect(suggestionsApi.reopen).toHaveBeenCalledOnce());
    expect(result.current).toMatchObject({ status: "resuming", isActive: false, sessionId: null });
    await act(async () => {
      expect(await result.current.startSession()).toBeNull();
      expect(await result.current.saveToSession("draft", "iri", "Person")).toBe(false);
    });
    rerender({ token: "renewed" });
    await act(async () => finish({ session_id: "resume", branch: "suggest/resume", beacon_token: "fresh", created_at: "2026-01-01" }));
    expect(result.current).toMatchObject({ isActive: true, isResumed: true, branch: "suggest/resume", changesCount: 3, entitiesModified: ["Person"], beaconToken: "fresh" });
    rerender({ token: "renewed-again" });
    expect(suggestionsApi.reopen).toHaveBeenCalledOnce();
    expect(mockedListSessions).toHaveBeenCalledOnce();
  });

});
