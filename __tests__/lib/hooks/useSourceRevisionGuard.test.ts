import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, projectOntologyApi } from "@/lib/api/client";
import { useSourceRevisionGuard } from "@/lib/hooks/useSourceRevisionGuard";

vi.mock("@/lib/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/client")>()),
  projectOntologyApi: { saveSource: vi.fn() },
}));

const saveSource = vi.mocked(projectOntologyApi.saveSource);

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function conflictError() {
  return new ApiError(409, "Conflict", JSON.stringify({
    detail: {
      code: "SOURCE_REVISION_CONFLICT",
      message: "The branch changed after this editor loaded.",
      base_revision: "revision-1",
      current_revision: "revision-2",
      branch: "main",
    },
  }));
}

describe("useSourceRevisionGuard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    saveSource.mockResolvedValue({
      success: true,
      commit_hash: "revision-2",
      commit_message: "Update ontology",
      branch: "main",
    });
  });

  it("sends the paired base revision and advances it only after a successful direct save", async () => {
    const setSourceSnapshot = vi.fn();
    const { result } = renderHook(() => useSourceRevisionGuard({
      projectId: "project-1",
      accessToken: "token",
      activeBranch: "main",
      sourceRevision: "revision-1",
      setSourceSnapshot,
      reloadSourceContent: vi.fn(),
    }));

    await act(async () => {
      await result.current.saveSource("draft source", "Update ontology");
    });

    expect(saveSource).toHaveBeenCalledWith(
      "project-1", "draft source", "Update ontology", "token", "main", "revision-1",
    );
    expect(setSourceSnapshot).toHaveBeenCalledWith("draft source", "revision-2");
    expect(result.current.conflict).toBeNull();
  });

  it("preserves the draft and exposes reconciliation state without retrying a stale save", async () => {
    saveSource.mockRejectedValueOnce(conflictError());
    const setSourceSnapshot = vi.fn();
    const { result } = renderHook(() => useSourceRevisionGuard({
      projectId: "project-1",
      accessToken: "token",
      activeBranch: "main",
      sourceRevision: "revision-1",
      setSourceSnapshot,
      reloadSourceContent: vi.fn(),
    }));

    await act(async () => {
      await expect(result.current.saveSource("preserved draft", "Update ontology"))
        .rejects.toThrow(/draft is preserved/i);
    });

    expect(saveSource).toHaveBeenCalledTimes(1);
    expect(setSourceSnapshot).not.toHaveBeenCalled();
    expect(result.current.conflict?.draftContent).toBe("preserved draft");
    expect(result.current.conflict?.detail.current_revision).toBe("revision-2");

    await act(async () => {
      await expect(result.current.saveSource("preserved draft", "Retry stale edit"))
        .rejects.toThrow(/draft is preserved/i);
    });
    expect(saveSource).toHaveBeenCalledTimes(1);
  });

  it("does not let an earlier successful completion erase a later save conflict", async () => {
    type SaveResponse = Awaited<ReturnType<typeof projectOntologyApi.saveSource>>;
    const successfulRequest = deferred<SaveResponse>();
    const conflictingRequest = deferred<SaveResponse>();
    saveSource
      .mockImplementationOnce(() => successfulRequest.promise)
      .mockImplementationOnce(() => conflictingRequest.promise);
    const setSourceSnapshot = vi.fn();
    const { result } = renderHook(() => useSourceRevisionGuard({
      projectId: "project-1",
      accessToken: "token",
      activeBranch: "main",
      sourceRevision: "revision-1",
      setSourceSnapshot,
      reloadSourceContent: vi.fn(),
    }));

    let successfulSave!: Promise<SaveResponse>;
    let conflictingSave!: Promise<SaveResponse>;
    act(() => {
      successfulSave = result.current.saveSource("winning source", "Winning edit");
      conflictingSave = result.current.saveSource("preserved draft", "Stale edit");
    });
    const observedConflict = conflictingSave.catch((error) => error);

    await act(async () => {
      conflictingRequest.reject(conflictError());
      await observedConflict;
    });
    expect(result.current.conflict?.draftContent).toBe("preserved draft");

    await act(async () => {
      successfulRequest.resolve({
        success: true,
        commit_hash: "revision-2",
        commit_message: "Winning edit",
        branch: "main",
      });
      await successfulSave;
    });

    expect(setSourceSnapshot).toHaveBeenCalledWith("winning source", "revision-2");
    expect(result.current.conflict?.draftContent).toBe("preserved draft");
  });

  it("does not install a completed save snapshot after switching branches", async () => {
    type SaveResponse = Awaited<ReturnType<typeof projectOntologyApi.saveSource>>;
    const request = deferred<SaveResponse>();
    saveSource.mockImplementationOnce(() => request.promise);
    const setSourceSnapshot = vi.fn();
    const { result, rerender } = renderHook(
      ({ branch }) => useSourceRevisionGuard({
        projectId: "project-1",
        accessToken: "token",
        activeBranch: branch,
        sourceRevision: "revision-1",
        setSourceSnapshot,
        reloadSourceContent: vi.fn(),
      }),
      { initialProps: { branch: "main" } },
    );

    let pendingSave!: Promise<SaveResponse>;
    act(() => {
      pendingSave = result.current.saveSource("main source", "Main edit");
    });
    rerender({ branch: "feature" });

    await act(async () => {
      request.resolve({
        success: true,
        commit_hash: "main-revision-2",
        commit_message: "Main edit",
        branch: "main",
      });
      await pendingSave;
    });

    expect(setSourceSnapshot).not.toHaveBeenCalled();
    expect(result.current.conflict).toBeNull();
  });

  it("loads the latest paired snapshot explicitly and uses it for the next save", async () => {
    saveSource.mockRejectedValueOnce(conflictError()).mockResolvedValueOnce({
      success: true,
      commit_hash: "revision-3",
      commit_message: "Reconciled edit",
      branch: "main",
    });
    const reloadSourceContent = vi.fn().mockResolvedValue({
      project_id: "project-1",
      version: "main",
      revision: "revision-2",
      filename: "ontology.ttl",
      content: "latest source",
    });
    const onLoadLatest = vi.fn();
    const { result, rerender } = renderHook(
      ({ revision }) => useSourceRevisionGuard({
        projectId: "project-1",
        accessToken: "token",
        activeBranch: "main",
        sourceRevision: revision,
        setSourceSnapshot: vi.fn(),
        reloadSourceContent,
        onLoadLatest,
      }),
      { initialProps: { revision: "revision-1" } },
    );

    await act(async () => {
      await expect(result.current.saveSource("stale draft", "Stale edit")).rejects.toThrow();
      await result.current.loadLatest();
    });

    expect(onLoadLatest).toHaveBeenCalledWith("latest source");
    expect(result.current.conflict).toBeNull();

    rerender({ revision: "revision-2" });
    await act(async () => {
      await result.current.saveSource("reconciled source", "Reconciled edit");
    });
    expect(saveSource).toHaveBeenLastCalledWith(
      "project-1", "reconciled source", "Reconciled edit", "token", "main", "revision-2",
    );
  });
});
