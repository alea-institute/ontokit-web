import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import React from "react";
import { createQueryWrapper } from "@/__tests__/helpers/renderWithProviders";
import type { BranchListResponse, BranchInfo } from "@/lib/api/revisions";

// Mock the API before imports
vi.mock("@/lib/api/revisions", () => ({
  branchesApi: {
    list: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    savePreference: vi.fn(),
  },
}));

import { BranchProvider, useBranch } from "@/lib/context/BranchContext";
import { branchesApi } from "@/lib/api/revisions";

const mockedList = branchesApi.list as ReturnType<typeof vi.fn>;
const mockedCreate = branchesApi.create as ReturnType<typeof vi.fn>;
const mockedDelete = branchesApi.delete as ReturnType<typeof vi.fn>;
const mockedSavePreference = branchesApi.savePreference as ReturnType<typeof vi.fn>;

function makeBranch(name: string, overrides?: Partial<BranchInfo>): BranchInfo {
  return {
    name,
    is_current: false,
    is_default: name === "main",
    commits_ahead: 0,
    commits_behind: 0,
    remote_commits_ahead: null,
    remote_commits_behind: null,
    can_delete: name !== "main",
    has_open_pr: false,
    has_delete_permission: name !== "main",
    ...overrides,
  };
}

function makeListResponse(branches: BranchInfo[], overrides?: Partial<BranchListResponse>): BranchListResponse {
  return {
    items: branches,
    current_branch: "main",
    default_branch: "main",
    preferred_branch: null,
    has_github_remote: false,
    last_sync_at: null,
    sync_status: null,
    ...overrides,
  };
}

function createWrapper(props: { projectId: string; accessToken?: string; initialBranch?: string }) {
  const QueryWrapper = createQueryWrapper();
  function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(
      QueryWrapper,
      null,
      React.createElement(
        BranchProvider,
        { projectId: props.projectId, accessToken: props.accessToken, initialBranch: props.initialBranch } as React.ComponentProps<typeof BranchProvider>,
        children,
      ),
    );
  }
  Wrapper.displayName = "BranchQueryWrapper";
  return Wrapper;
}

describe("BranchContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: return a main branch
    mockedList.mockResolvedValue(
      makeListResponse([makeBranch("main"), makeBranch("feature-1")])
    );
    mockedSavePreference.mockResolvedValue(undefined);
    // Clear sessionStorage
    sessionStorage.clear();
  });

  it("throws when useBranch is used outside BranchProvider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useBranch())).toThrow(
      "useBranch must be used within a BranchProvider"
    );
    spy.mockRestore();
  });

  it("provides initial loading state", () => {
    const wrapper = createWrapper({ projectId: "p1", accessToken: "tok" });
    const { result } = renderHook(() => useBranch(), { wrapper });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.branches).toEqual([]);
  });

  it("loads branches and exposes them via the context", async () => {
    const wrapper = createWrapper({ projectId: "p1", accessToken: "tok" });
    const { result } = renderHook(() => useBranch(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.branches).toHaveLength(2);
    expect(result.current.defaultBranch).toBe("main");
    expect(result.current.currentBranch).toBe("main");
    expect(result.current.isFeatureBranch).toBe(false);
  });

  it("exposes hasGitHubRemote, lastSyncAt, and syncStatus from response", async () => {
    mockedList.mockResolvedValue(
      makeListResponse([makeBranch("main")], {
        has_github_remote: true,
        last_sync_at: "2025-01-01T00:00:00Z",
        sync_status: "synced",
      })
    );

    const wrapper = createWrapper({ projectId: "p1", accessToken: "tok" });
    const { result } = renderHook(() => useBranch(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.hasGitHubRemote).toBe(true);
    expect(result.current.lastSyncAt).toBe("2025-01-01T00:00:00Z");
    expect(result.current.syncStatus).toBe("synced");
  });

  describe("switchBranch", () => {
    it("switches to an existing branch", async () => {
      const wrapper = createWrapper({ projectId: "p1", accessToken: "tok" });
      const { result } = renderHook(() => useBranch(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.switchBranch("feature-1");
      });

      expect(result.current.currentBranch).toBe("feature-1");
      expect(result.current.isFeatureBranch).toBe(true);
    });

    it("throws when switching without authentication", async () => {
      const wrapper = createWrapper({ projectId: "p1" }); // no accessToken
      const { result } = renderHook(() => useBranch(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await expect(
        act(async () => {
          await result.current.switchBranch("feature-1");
        })
      ).rejects.toThrow("Authentication required");
    });

    it("throws when switching to a non-existent branch", async () => {
      const wrapper = createWrapper({ projectId: "p1", accessToken: "tok" });
      const { result } = renderHook(() => useBranch(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await expect(
        act(async () => {
          await result.current.switchBranch("nonexistent");
        })
      ).rejects.toThrow("Branch not found: nonexistent");
    });

    it("throws when there are pending changes", async () => {
      const wrapper = createWrapper({ projectId: "p1", accessToken: "tok" });
      const { result } = renderHook(() => useBranch(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      act(() => {
        result.current.setPendingChanges(true);
      });

      await expect(
        act(async () => {
          await result.current.switchBranch("feature-1");
        })
      ).rejects.toThrow("pending changes");
    });
  });

  describe("createBranch", () => {
    it("creates a branch and switches to it", async () => {
      const newBranch = makeBranch("new-branch");
      mockedCreate.mockResolvedValue(newBranch);

      const wrapper = createWrapper({ projectId: "p1", accessToken: "tok" });
      const { result } = renderHook(() => useBranch(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let created: BranchInfo | undefined;
      await act(async () => {
        created = await result.current.createBranch("new-branch", "main");
      });

      expect(created).toEqual(newBranch);
      expect(mockedCreate).toHaveBeenCalledWith(
        "p1",
        { name: "new-branch", from_branch: "main" },
        "tok"
      );
      expect(result.current.currentBranch).toBe("new-branch");
    });

    it("throws without authentication", async () => {
      const wrapper = createWrapper({ projectId: "p1" });
      const { result } = renderHook(() => useBranch(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await expect(
        act(async () => {
          await result.current.createBranch("new");
        })
      ).rejects.toThrow("Authentication required");
    });
  });

  describe("deleteBranch", () => {
    it("deletes a branch", async () => {
      mockedDelete.mockResolvedValue(undefined);

      const wrapper = createWrapper({ projectId: "p1", accessToken: "tok" });
      const { result } = renderHook(() => useBranch(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.deleteBranch("feature-1");
      });

      expect(mockedDelete).toHaveBeenCalledWith("p1", "feature-1", "tok", false);
    });

    it("throws when deleting the current branch", async () => {
      const wrapper = createWrapper({ projectId: "p1", accessToken: "tok" });
      const { result } = renderHook(() => useBranch(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await expect(
        act(async () => {
          await result.current.deleteBranch("main");
        })
      ).rejects.toThrow("Cannot delete the current branch");
    });

    it("throws when deleting the default branch", async () => {
      const wrapper = createWrapper({ projectId: "p1", accessToken: "tok" });
      const { result } = renderHook(() => useBranch(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Switch to feature-1 first so main is not current but is still default
      await act(async () => {
        await result.current.switchBranch("feature-1");
      });

      await expect(
        act(async () => {
          await result.current.deleteBranch("main");
        })
      ).rejects.toThrow("Cannot delete the default branch");
    });

    it("throws without authentication", async () => {
      const wrapper = createWrapper({ projectId: "p1" });
      const { result } = renderHook(() => useBranch(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await expect(
        act(async () => {
          await result.current.deleteBranch("feature-1");
        })
      ).rejects.toThrow("Authentication required");
    });
  });

  describe("sessionStorage persistence", () => {
    it("persists branch selection to sessionStorage on switch", async () => {
      const wrapper = createWrapper({ projectId: "p1", accessToken: "tok" });
      const { result } = renderHook(() => useBranch(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.switchBranch("feature-1");
      });

      expect(sessionStorage.getItem("ontokit:branch:p1")).toBe("feature-1");
    });
  });

  describe("error state", () => {
    it("exposes error message when branch loading fails", async () => {
      mockedList.mockRejectedValue(new Error("Network failure"));

      const wrapper = createWrapper({ projectId: "p1", accessToken: "tok" });
      const { result } = renderHook(() => useBranch(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBe("Network failure");
    });
  });

  describe("pendingChanges", () => {
    it("starts as false and can be toggled", async () => {
      const wrapper = createWrapper({ projectId: "p1", accessToken: "tok" });
      const { result } = renderHook(() => useBranch(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.pendingChanges).toBe(false);

      act(() => {
        result.current.setPendingChanges(true);
      });
      expect(result.current.pendingChanges).toBe(true);

      act(() => {
        result.current.setPendingChanges(false);
      });
      expect(result.current.pendingChanges).toBe(false);
    });
  });
});
