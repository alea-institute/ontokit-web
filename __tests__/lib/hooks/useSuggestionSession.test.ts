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
  vi.clearAllMocks();
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
    });

    const { result } = renderHook(() => useSuggestionSession(BASE_OPTIONS));

    await act(async () => {
      await result.current.startSession();
    });

    expect(result.current.status).toBe("active");
    expect(result.current.sessionId).toBe("sess-1");
    expect(result.current.branch).toBe("suggest/sess-1");
    expect(result.current.beaconToken).toBe("sess-1");
    expect(result.current.isActive).toBe(true);
    expect(mockedCreateSession).toHaveBeenCalledWith("proj-1", "token-123");
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

  it("resumeSession sets session state from external data", () => {
    const { result } = renderHook(() => useSuggestionSession(BASE_OPTIONS));

    act(() => {
      result.current.resumeSession("sess-2", "suggest/sess-2");
    });

    expect(result.current.sessionId).toBe("sess-2");
    expect(result.current.branch).toBe("suggest/sess-2");
    expect(result.current.status).toBe("active");
    expect(result.current.isResumed).toBe(true);
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
      result.current.resumeSession("sess-2", "suggest/sess-2");
    });

    await act(async () => {
      await result.current.resubmitSession("Updated summary");
    });

    expect(result.current.status).toBe("submitted");
    expect(onSubmitted).toHaveBeenCalledWith(43, null);
    expect(result.current.sessionId).toBeNull();
    expect(result.current.isResumed).toBe(false);
  });

  it("auto-resumes session when resumeSessionId is provided and session is changes-requested", async () => {
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
    expect(result.current.isResumed).toBe(true);
  });

  it("does not auto-resume when session is not changes-requested", async () => {
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
    expect(result.current.status).toBe("idle");
  });
});
