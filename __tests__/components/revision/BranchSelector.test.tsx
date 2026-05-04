import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ---- BranchContext mock ----
const mockSwitchBranch = vi.fn().mockResolvedValue(undefined);
const mockCreateBranch = vi.fn().mockResolvedValue({ name: "feature/new", is_default: false });
const mockDeleteBranch = vi.fn().mockResolvedValue(undefined);

let mockBranchState = {
  branches: [
    {
      name: "main",
      is_current: true,
      is_default: true,
      commit_hash: "abc1234567890",
      commit_message: "init",
      commit_date: new Date().toISOString(),
      commits_ahead: 0,
      commits_behind: 0,
      remote_commits_ahead: null,
      remote_commits_behind: null,
      can_delete: false,
      has_open_pr: false,
      has_delete_permission: false,
    },
    {
      name: "feature/test",
      is_current: false,
      is_default: false,
      commit_hash: "def4567890123",
      commit_message: "feat",
      commit_date: new Date().toISOString(),
      commits_ahead: 2,
      commits_behind: 0,
      remote_commits_ahead: null,
      remote_commits_behind: null,
      can_delete: true,
      has_open_pr: false,
      has_delete_permission: true,
    },
  ],
  currentBranch: "main",
  defaultBranch: "main",
  isLoading: false,
  isFeatureBranch: false,
  switchBranch: mockSwitchBranch,
  createBranch: mockCreateBranch,
  deleteBranch: mockDeleteBranch,
  hasGitHubRemote: false,
  lastSyncAt: null as string | null,
  syncStatus: null as string | null,
  error: null,
  pendingChanges: false,
  refreshBranches: vi.fn(),
  setPendingChanges: vi.fn(),
};

vi.mock("@/lib/context/BranchContext", () => ({
  useBranch: () => mockBranchState,
}));

import { BranchSelector } from "@/components/revision/BranchSelector";

beforeEach(() => {
  mockSwitchBranch.mockClear().mockResolvedValue(undefined);
  mockCreateBranch.mockClear().mockResolvedValue({ name: "feature/new", is_default: false });
  mockDeleteBranch.mockClear().mockResolvedValue(undefined);

  mockBranchState = {
    ...mockBranchState,
    branches: [
      {
        name: "main",
        is_current: true,
        is_default: true,
        commit_hash: "abc1234567890",
        commit_message: "init",
        commit_date: new Date().toISOString(),
        commits_ahead: 0,
        commits_behind: 0,
        remote_commits_ahead: null,
        remote_commits_behind: null,
        can_delete: false,
        has_open_pr: false,
        has_delete_permission: false,
      },
      {
        name: "feature/test",
        is_current: false,
        is_default: false,
        commit_hash: "def4567890123",
        commit_message: "feat",
        commit_date: new Date().toISOString(),
        commits_ahead: 2,
        commits_behind: 0,
        remote_commits_ahead: null,
        remote_commits_behind: null,
        can_delete: true,
        has_open_pr: false,
        has_delete_permission: true,
      },
    ],
    currentBranch: "main",
    defaultBranch: "main",
    isLoading: false,
    isFeatureBranch: false,
    hasGitHubRemote: false,
    lastSyncAt: null,
    syncStatus: null,
  };
});

describe("BranchSelector", () => {
  it("renders the current branch name", () => {
    render(<BranchSelector />);
    expect(screen.getByText("main")).toBeDefined();
  });

  it("renders the abbreviated commit hash", () => {
    render(<BranchSelector />);
    expect(screen.getByText("abc1234")).toBeDefined();
  });

  it("does not show dropdown initially", () => {
    render(<BranchSelector />);
    // The branch list items are not visible before opening
    expect(screen.queryByRole("option")).toBeNull();
  });

  it("opens dropdown on button click", async () => {
    const user = userEvent.setup();
    render(<BranchSelector />);

    const trigger = screen.getByRole("button");
    await user.click(trigger);

    // Branch list should now be visible
    const options = screen.getAllByRole("option");
    expect(options.length).toBe(2);
  });

  it("shows branch names in dropdown", async () => {
    const user = userEvent.setup();
    render(<BranchSelector />);

    await user.click(screen.getByRole("button"));

    expect(screen.getByText("feature/test")).toBeDefined();
  });

  it("shows 'default' badge on default branch", async () => {
    const user = userEvent.setup();
    render(<BranchSelector />);
    await user.click(screen.getByRole("button"));

    expect(screen.getByText("default")).toBeDefined();
  });

  it("marks current branch as selected", async () => {
    const user = userEvent.setup();
    render(<BranchSelector />);
    await user.click(screen.getByRole("button"));

    const mainOption = screen.getAllByRole("option").find(
      (o) => o.getAttribute("aria-selected") === "true"
    );
    expect(mainOption).toBeDefined();
    expect(within(mainOption!).getByText("main")).toBeDefined();
  });

  it("calls switchBranch when selecting a different branch", async () => {
    const user = userEvent.setup();
    render(<BranchSelector />);
    await user.click(screen.getByRole("button"));

    const featureOption = screen.getAllByRole("option").find(
      (o) => within(o).queryByText("feature/test") !== null
    );
    await user.click(featureOption!);

    expect(mockSwitchBranch).toHaveBeenCalledWith("feature/test");
  });

  it("does not call switchBranch when clicking the current branch", async () => {
    const user = userEvent.setup();
    render(<BranchSelector />);
    await user.click(screen.getByRole("button"));

    const mainOption = screen.getAllByRole("option").find(
      (o) => o.getAttribute("aria-selected") === "true"
    );
    await user.click(mainOption!);

    expect(mockSwitchBranch).not.toHaveBeenCalled();
  });

  it("closes dropdown after selecting a branch", async () => {
    const user = userEvent.setup();
    render(<BranchSelector />);
    await user.click(screen.getByRole("button"));

    const featureOption = screen.getAllByRole("option").find(
      (o) => within(o).queryByText("feature/test") !== null
    );
    await user.click(featureOption!);

    // Dropdown should be closed after the async switchBranch resolves
    await waitFor(() => {
      expect(screen.queryByRole("option")).toBeNull();
    });
  });

  it("shows 'Create new branch' button when canCreateBranch is true", async () => {
    const user = userEvent.setup();
    render(<BranchSelector canCreateBranch />);
    await user.click(screen.getByRole("button"));

    expect(screen.getByText("Create new branch")).toBeDefined();
  });

  it("hides 'Create new branch' when canCreateBranch is false", async () => {
    const user = userEvent.setup();
    render(<BranchSelector canCreateBranch={false} />);
    await user.click(screen.getByRole("button"));

    expect(screen.queryByText("Create new branch")).toBeNull();
  });

  it("does not open dropdown when readOnly", async () => {
    const user = userEvent.setup();
    render(<BranchSelector readOnly />);

    const trigger = screen.getByRole("button");
    await user.click(trigger);

    expect(screen.queryByRole("option")).toBeNull();
  });

  it("disables trigger button when readOnly", () => {
    render(<BranchSelector readOnly />);
    const trigger = screen.getByRole("button");
    expect(trigger.hasAttribute("disabled")).toBe(true);
  });

  it("does not show chevron when readOnly", () => {
    render(<BranchSelector readOnly />);
    // ChevronDown is only rendered when !readOnly
    // The non-readOnly version has 3 SVGs (GitBranch + ChevronDown), readOnly has 1 (GitBranch only)
    const button = screen.getByRole("button");
    const svgs = button.querySelectorAll("svg");
    // GitBranch icon only (no ChevronDown)
    expect(svgs.length).toBe(1);
  });

  it("shows create branch input when clicking 'Create new branch'", async () => {
    const user = userEvent.setup();
    render(<BranchSelector canCreateBranch />);
    await user.click(screen.getByRole("button"));
    await user.click(screen.getByText("Create new branch"));

    expect(screen.getByPlaceholderText("feature/my-changes")).toBeDefined();
  });

  it("calls createBranch with the typed name", async () => {
    const user = userEvent.setup();
    render(<BranchSelector canCreateBranch />);
    await user.click(screen.getByRole("button"));
    await user.click(screen.getByText("Create new branch"));

    const input = screen.getByPlaceholderText("feature/my-changes");
    await user.type(input, "feature/new-branch");
    await user.click(screen.getByText("Create"));

    expect(mockCreateBranch).toHaveBeenCalledWith("feature/new-branch");
  });

  it("does not call createBranch with empty name", async () => {
    const user = userEvent.setup();
    render(<BranchSelector canCreateBranch />);
    await user.click(screen.getByRole("button"));
    await user.click(screen.getByText("Create new branch"));

    await user.click(screen.getByText("Create"));

    expect(mockCreateBranch).not.toHaveBeenCalled();
  });

  it("hides create form when Cancel is clicked", async () => {
    const user = userEvent.setup();
    render(<BranchSelector canCreateBranch />);
    await user.click(screen.getByRole("button"));
    await user.click(screen.getByText("Create new branch"));

    expect(screen.getByPlaceholderText("feature/my-changes")).toBeDefined();

    await user.click(screen.getByText("Cancel"));

    expect(screen.queryByPlaceholderText("feature/my-changes")).toBeNull();
  });

  it("creates branch on Enter key", async () => {
    const user = userEvent.setup();
    render(<BranchSelector canCreateBranch />);
    await user.click(screen.getByRole("button"));
    await user.click(screen.getByText("Create new branch"));

    const input = screen.getByPlaceholderText("feature/my-changes");
    await user.type(input, "feature/enter-branch{Enter}");

    expect(mockCreateBranch).toHaveBeenCalledWith("feature/enter-branch");
  });

  it("cancels create on Escape key", async () => {
    const user = userEvent.setup();
    render(<BranchSelector canCreateBranch />);
    await user.click(screen.getByRole("button"));
    await user.click(screen.getByText("Create new branch"));

    const input = screen.getByPlaceholderText("feature/my-changes");
    await user.type(input, "test");
    await user.keyboard("{Escape}");

    expect(screen.queryByPlaceholderText("feature/my-changes")).toBeNull();
  });

  it("shows delete button for non-default, non-current branch with permission", async () => {
    const user = userEvent.setup();
    render(<BranchSelector />);
    await user.click(screen.getByRole("button"));

    // feature/test should have a delete button (has_delete_permission=true, can_delete=true)
    const featureOption = screen.getAllByRole("option").find(
      (o) => within(o).queryByText("feature/test") !== null
    );
    const deleteBtn = featureOption!.querySelector("button");
    expect(deleteBtn).not.toBeNull();
  });

  it("shows loading state when isLoading is true", () => {
    mockBranchState = { ...mockBranchState, isLoading: true };
    render(<BranchSelector />);

    const trigger = screen.getByRole("button");
    expect(trigger.hasAttribute("disabled")).toBe(true);
  });

  it("displays commits ahead count", () => {
    // feature/test has commits_ahead: 2 but it's not currentBranch
    // Set currentBranch to feature/test to see commits_ahead on trigger
    mockBranchState = {
      ...mockBranchState,
      currentBranch: "feature/test",
      isFeatureBranch: true,
    };
    render(<BranchSelector />);

    expect(screen.getByText("+2")).toBeDefined();
  });

  it("shows GitHub sync status when hasGitHubRemote is true", async () => {
    mockBranchState = {
      ...mockBranchState,
      hasGitHubRemote: true,
      lastSyncAt: new Date().toISOString(),
      syncStatus: "synced",
    };
    const user = userEvent.setup();
    render(<BranchSelector />);
    await user.click(screen.getByRole("button"));

    expect(screen.getByText(/Last synced/)).toBeDefined();
  });

  it("shows 'Syncing...' when syncStatus is syncing", async () => {
    mockBranchState = {
      ...mockBranchState,
      hasGitHubRemote: true,
      syncStatus: "syncing",
    };
    const user = userEvent.setup();
    render(<BranchSelector />);
    await user.click(screen.getByRole("button"));

    expect(screen.getByText("Syncing...")).toBeDefined();
  });

  it("shows 'Sync error' when syncStatus is error", async () => {
    mockBranchState = {
      ...mockBranchState,
      hasGitHubRemote: true,
      syncStatus: "error",
    };
    const user = userEvent.setup();
    render(<BranchSelector />);
    await user.click(screen.getByRole("button"));

    expect(screen.getByText("Sync error")).toBeDefined();
  });

  it("shows 'Sync conflict' when syncStatus is conflict", async () => {
    mockBranchState = {
      ...mockBranchState,
      hasGitHubRemote: true,
      syncStatus: "conflict",
    };
    const user = userEvent.setup();
    render(<BranchSelector />);
    await user.click(screen.getByRole("button"));

    expect(screen.getByText("Sync conflict")).toBeDefined();
  });

  it("shows 'GitHub connected' when no lastSyncAt", async () => {
    mockBranchState = {
      ...mockBranchState,
      hasGitHubRemote: true,
      syncStatus: null,
      lastSyncAt: null,
    };
    const user = userEvent.setup();
    render(<BranchSelector />);
    await user.click(screen.getByRole("button"));

    expect(screen.getByText("GitHub connected")).toBeDefined();
  });

  it("calls onBranchChange callback when switching branches", async () => {
    const onBranchChange = vi.fn();
    const user = userEvent.setup();
    render(<BranchSelector onBranchChange={onBranchChange} />);
    await user.click(screen.getByRole("button"));

    const featureOption = screen.getAllByRole("option").find(
      (o) => within(o).queryByText("feature/test") !== null
    );
    await user.click(featureOption!);

    await waitFor(() => {
      expect(onBranchChange).toHaveBeenCalledWith("feature/test");
    });
  });

  it("shows error message when switchBranch fails", async () => {
    mockSwitchBranch.mockRejectedValueOnce(new Error("Network error"));
    const user = userEvent.setup();
    render(<BranchSelector />);
    await user.click(screen.getByRole("button"));

    const featureOption = screen.getAllByRole("option").find(
      (o) => within(o).queryByText("feature/test") !== null
    );
    await user.click(featureOption!);

    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeDefined();
    });
  });

  it("shows 'No branches found' when branch list is empty", async () => {
    mockBranchState = { ...mockBranchState, branches: [] };
    const user = userEvent.setup();
    render(<BranchSelector />);
    await user.click(screen.getByRole("button"));

    expect(screen.getByText("No branches found")).toBeDefined();
  });
});

describe("formatSyncTime", () => {
  // We test formatSyncTime indirectly through the component since it's not exported
  it("shows 'just now' for recent sync", async () => {
    mockBranchState = {
      ...mockBranchState,
      hasGitHubRemote: true,
      syncStatus: null,
      lastSyncAt: new Date().toISOString(),
    };
    const user = userEvent.setup();
    render(<BranchSelector />);
    await user.click(screen.getByRole("button"));

    expect(screen.getByText("Last synced just now")).toBeDefined();
  });

  it("shows minutes ago for sync within the hour", async () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60_000).toISOString();
    mockBranchState = {
      ...mockBranchState,
      hasGitHubRemote: true,
      syncStatus: null,
      lastSyncAt: fiveMinAgo,
    };
    const user = userEvent.setup();
    render(<BranchSelector />);
    await user.click(screen.getByRole("button"));

    expect(screen.getByText("Last synced 5 min ago")).toBeDefined();
  });

  it("shows hours ago for sync within the day", async () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60_000).toISOString();
    mockBranchState = {
      ...mockBranchState,
      hasGitHubRemote: true,
      syncStatus: null,
      lastSyncAt: twoHoursAgo,
    };
    const user = userEvent.setup();
    render(<BranchSelector />);
    await user.click(screen.getByRole("button"));

    expect(screen.getByText("Last synced 2h ago")).toBeDefined();
  });

  it("shows days ago for older syncs", async () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60_000).toISOString();
    mockBranchState = {
      ...mockBranchState,
      hasGitHubRemote: true,
      syncStatus: null,
      lastSyncAt: threeDaysAgo,
    };
    const user = userEvent.setup();
    render(<BranchSelector />);
    await user.click(screen.getByRole("button"));

    expect(screen.getByText("Last synced 3d ago")).toBeDefined();
  });
});
