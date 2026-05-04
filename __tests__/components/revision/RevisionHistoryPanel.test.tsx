import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import type { RevisionCommit, RevisionHistoryResponse } from "@/lib/api/revisions";

// ── Mocks ──────────────────────────────────────────────────────────

const mockGetHistory = vi.fn<(projectId: string, token?: string) => Promise<RevisionHistoryResponse>>();

vi.mock("@/lib/api/revisions", () => ({
  revisionsApi: {
    getHistory: (projectId: string, token?: string) => mockGetHistory(projectId, token),
  },
}));

vi.mock("@/lib/context/BranchContext", () => ({
  useBranch: () => ({ defaultBranch: "main", currentBranch: "main", branches: [], isLoading: false }),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: React.ComponentProps<"button">) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock("@/lib/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

vi.mock("@/lib/git-graph/types", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/git-graph/types")>();
  return {
    ...actual,
    DEFAULT_GRAPH_CONFIG: actual.DEFAULT_GRAPH_CONFIG,
  };
});

vi.mock("@/components/revision/GitGraph", () => ({
  GitGraph: ({ onSelectCommit }: { onSelectCommit?: (hash: string) => void }) => (
    <div data-testid="git-graph" onClick={() => onSelectCommit?.("abc123")} />
  ),
}));

vi.mock("@/components/revision/CommitDetailView", () => ({
  CommitDetailView: ({ onBack, commit }: { onBack: () => void; commit: RevisionCommit }) => (
    <div data-testid="commit-detail">
      <span>{commit.message}</span>
      <button onClick={onBack}>Back</button>
    </div>
  ),
}));

// Import after mocks
import { RevisionHistoryPanel, HistoryButton } from "@/components/revision/RevisionHistoryPanel";

// ── Fixtures ───────────────────────────────────────────────────────

const makeCommit = (overrides: Partial<RevisionCommit> = {}): RevisionCommit => ({
  hash: "abc123def456789012345678901234567890abcd",
  short_hash: "abc123d",
  message: "Test commit message",
  author_name: "Test User",
  author_email: "test@example.com",
  timestamp: new Date().toISOString(),
  parent_hashes: [],
  ...overrides,
});

const commit1 = makeCommit({
  hash: "abc123",
  short_hash: "abc123d",
  message: "First commit",
  author_name: "Alice",
  timestamp: new Date().toISOString(),
});

const commit2 = makeCommit({
  hash: "def456",
  short_hash: "def456d",
  message: "Merge branch 'feature'",
  author_name: "Bob",
  is_merge: true,
  merged_branch: "feature",
  timestamp: new Date(Date.now() - 86400000).toISOString(), // yesterday
});

const commit3 = makeCommit({
  hash: "ghi789",
  short_hash: "ghi789d",
  message: "Old commit",
  author_name: "Charlie",
  timestamp: new Date(Date.now() - 3 * 86400000).toISOString(), // 3 days ago
});

const mockHistoryResponse: RevisionHistoryResponse = {
  project_id: "proj-1",
  commits: [commit1, commit2, commit3],
  total: 3,
  refs: {
    abc123: ["main"],
    def456: ["feature"],
  },
};

const defaultProps = {
  projectId: "proj-1",
  accessToken: "tok",
  isOpen: true,
  onClose: vi.fn(),
  onSelectRevision: vi.fn(),
};

// ── Tests ──────────────────────────────────────────────────────────

describe("RevisionHistoryPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetHistory.mockResolvedValue(mockHistoryResponse);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // --- Visibility ---

  it("returns null when isOpen is false", () => {
    const { container } = render(
      <RevisionHistoryPanel {...defaultProps} isOpen={false} />
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders the panel when isOpen is true", async () => {
    await act(async () => {
      render(<RevisionHistoryPanel {...defaultProps} />);
    });
    expect(screen.getByText("Revision History")).toBeDefined();
  });

  // --- Loading state ---

  it("shows loading spinner while fetching history", async () => {
    mockGetHistory.mockReturnValue(new Promise(() => {})); // never resolves
    const { container } = render(<RevisionHistoryPanel {...defaultProps} />);
    const spinner = container.querySelector(".animate-spin");
    expect(spinner).not.toBeNull();
  });

  // --- Error state ---

  it("shows error message when API call fails with Error", async () => {
    mockGetHistory.mockRejectedValue(new Error("Network failure"));
    await act(async () => {
      render(<RevisionHistoryPanel {...defaultProps} />);
    });
    await waitFor(() => {
      expect(screen.getByText("Network failure")).toBeDefined();
    });
  });

  it("shows generic error for non-Error failures", async () => {
    mockGetHistory.mockRejectedValue("something broke");
    await act(async () => {
      render(<RevisionHistoryPanel {...defaultProps} />);
    });
    await waitFor(() => {
      expect(screen.getByText("Failed to load history")).toBeDefined();
    });
  });

  // --- Empty state ---

  it("shows empty state when no commits are returned", async () => {
    mockGetHistory.mockResolvedValue({
      project_id: "proj-1",
      commits: [],
      total: 0,
    });
    await act(async () => {
      render(<RevisionHistoryPanel {...defaultProps} />);
    });
    await waitFor(() => {
      expect(screen.getByText("No revision history yet")).toBeDefined();
    });
  });

  // --- Commit list rendering ---

  it("renders commit messages in the list", async () => {
    await act(async () => {
      render(<RevisionHistoryPanel {...defaultProps} />);
    });
    await waitFor(() => {
      expect(screen.getByText("First commit")).toBeDefined();
      expect(screen.getByText("Merge branch 'feature'")).toBeDefined();
      expect(screen.getByText("Old commit")).toBeDefined();
    });
  });

  it("renders short hashes for each commit", async () => {
    await act(async () => {
      render(<RevisionHistoryPanel {...defaultProps} />);
    });
    await waitFor(() => {
      expect(screen.getByText("abc123d")).toBeDefined();
      expect(screen.getByText("def456d")).toBeDefined();
      expect(screen.getByText("ghi789d")).toBeDefined();
    });
  });

  it("renders author names", async () => {
    await act(async () => {
      render(<RevisionHistoryPanel {...defaultProps} />);
    });
    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeDefined();
      expect(screen.getByText("Bob")).toBeDefined();
      expect(screen.getByText("Charlie")).toBeDefined();
    });
  });

  it("renders merge badge for merge commits", async () => {
    await act(async () => {
      render(<RevisionHistoryPanel {...defaultProps} />);
    });
    await waitFor(() => {
      // "feature" appears both as a branch ref badge and merge badge
      expect(screen.getAllByText("feature").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("renders branch ref badges", async () => {
    await act(async () => {
      render(<RevisionHistoryPanel {...defaultProps} />);
    });
    await waitFor(() => {
      expect(screen.getAllByText("main").length).toBeGreaterThanOrEqual(1);
    });
  });

  // --- Close button ---

  it("calls onClose when close button is clicked", async () => {
    const onClose = vi.fn();
    await act(async () => {
      render(<RevisionHistoryPanel {...defaultProps} onClose={onClose} />);
    });
    await waitFor(() => {
      expect(screen.getByText("Revision History")).toBeDefined();
    });
    // The close button is the X icon button in the header
    const buttons = screen.getAllByRole("button");
    // First button in the header area is the close button
    const closeButton = buttons[0];
    fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // --- Selecting a commit ---

  it("calls onSelectRevision when a commit is clicked", async () => {
    const onSelectRevision = vi.fn();
    await act(async () => {
      render(
        <RevisionHistoryPanel {...defaultProps} onSelectRevision={onSelectRevision} />
      );
    });
    await waitFor(() => {
      expect(screen.getByText("First commit")).toBeDefined();
    });
    fireEvent.click(screen.getByText("First commit"));
    expect(onSelectRevision).toHaveBeenCalledWith(commit1);
  });

  it("shows CommitDetailView after selecting a commit", async () => {
    await act(async () => {
      render(<RevisionHistoryPanel {...defaultProps} />);
    });
    await waitFor(() => {
      expect(screen.getByText("First commit")).toBeDefined();
    });
    fireEvent.click(screen.getByText("First commit"));
    // After clicking, the detail view should appear
    expect(screen.getByTestId("commit-detail")).toBeDefined();
  });

  it("returns to list view when Back is clicked in detail view", async () => {
    await act(async () => {
      render(<RevisionHistoryPanel {...defaultProps} />);
    });
    await waitFor(() => {
      expect(screen.getByText("First commit")).toBeDefined();
    });
    // Select a commit to enter detail view
    fireEvent.click(screen.getByText("First commit"));
    expect(screen.getByTestId("commit-detail")).toBeDefined();

    // Click Back to return
    fireEvent.click(screen.getByText("Back"));
    // Detail view should be gone, list should be visible again
    await waitFor(() => {
      expect(screen.queryByTestId("commit-detail")).toBeNull();
      expect(screen.getByText("First commit")).toBeDefined();
    });
  });

  // --- Date formatting ---

  it("formats today's timestamps as time", async () => {
    const now = new Date();
    const todayCommit = makeCommit({
      hash: "today1",
      short_hash: "today1d",
      message: "Today commit",
      author_name: "Dave",
      timestamp: now.toISOString(),
    });
    mockGetHistory.mockResolvedValue({
      project_id: "proj-1",
      commits: [todayCommit],
      total: 1,
    });
    await act(async () => {
      render(<RevisionHistoryPanel {...defaultProps} />);
    });
    await waitFor(() => {
      expect(screen.getByText("Today commit")).toBeDefined();
    });
    // The formatted time should contain AM/PM or HH:MM pattern
    // We just verify it doesn't say "Yesterday" or "days ago"
    expect(screen.queryByText("Yesterday")).toBeNull();
  });

  it("formats yesterday timestamps as 'Yesterday'", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-04-08T12:00:00Z"));
    const yesterday = new Date(Date.now() - 86400000);
    const ydayCommit = makeCommit({
      hash: "yday1",
      short_hash: "yday1d",
      message: "Yesterday commit",
      author_name: "Eve",
      timestamp: yesterday.toISOString(),
    });
    mockGetHistory.mockResolvedValue({
      project_id: "proj-1",
      commits: [ydayCommit],
      total: 1,
    });
    await act(async () => {
      render(<RevisionHistoryPanel {...defaultProps} />);
    });
    await waitFor(() => {
      expect(screen.getByText("Yesterday commit")).toBeDefined();
    });
    expect(screen.getByText("Yesterday")).toBeDefined();
  });

  it("formats recent timestamps as 'N days ago'", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-04-08T12:00:00Z"));
    const threeDaysAgo = new Date(Date.now() - 3 * 86400000);
    const recentCommit = makeCommit({
      hash: "recent1",
      short_hash: "recent1",
      message: "Recent commit",
      author_name: "Frank",
      timestamp: threeDaysAgo.toISOString(),
    });
    mockGetHistory.mockResolvedValue({
      project_id: "proj-1",
      commits: [recentCommit],
      total: 1,
    });
    await act(async () => {
      render(<RevisionHistoryPanel {...defaultProps} />);
    });
    await waitFor(() => {
      expect(screen.getByText("Recent commit")).toBeDefined();
    });
    expect(screen.getByText("3 days ago")).toBeDefined();
  });

  // --- API call args ---

  it("passes projectId and accessToken to revisionsApi.getHistory", async () => {
    await act(async () => {
      render(<RevisionHistoryPanel {...defaultProps} />);
    });
    await waitFor(() => {
      expect(mockGetHistory).toHaveBeenCalled();
      expect(mockGetHistory.mock.calls[0][0]).toBe("proj-1");
      expect(mockGetHistory.mock.calls[0][1]).toBe("tok");
    });
  });

  it("does not load history when projectId is empty", async () => {
    await act(async () => {
      render(<RevisionHistoryPanel {...defaultProps} projectId="" />);
    });
    expect(mockGetHistory).not.toHaveBeenCalled();
  });
});

// ── HistoryButton tests ────────────────────────────────────────────

describe("HistoryButton", () => {
  it("renders the History button with label", () => {
    render(<HistoryButton onClick={vi.fn()} isOpen={false} />);
    expect(screen.getByText("History")).toBeDefined();
  });

  it("calls onClick when clicked", () => {
    const onClick = vi.fn();
    render(<HistoryButton onClick={onClick} isOpen={false} />);
    fireEvent.click(screen.getByText("History"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("applies className prop", () => {
    const { container } = render(
      <HistoryButton onClick={vi.fn()} isOpen={false} className="extra-class" />
    );
    const button = container.querySelector("button");
    expect(button?.className).toContain("extra-class");
  });
});
