import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import type { RevisionCommit, RevisionDiffResponse } from "@/lib/api/revisions";

// ── Mocks ──────────────────────────────────────────────────────────

const mockGetDiff = vi.fn();

vi.mock("@/lib/api/revisions", () => ({
  revisionsApi: {
    getDiff: (...args: unknown[]) => mockGetDiff(...args),
  },
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: React.ComponentProps<"button">) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock("@/lib/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

// Import after mocks
import { CommitDetailView } from "@/components/revision/CommitDetailView";

// ── Fixtures ───────────────────────────────────────────────────────

const mockCommit: RevisionCommit = {
  hash: "abc123def456789012345678901234567890abcd",
  short_hash: "abc123d",
  message: "Add new ontology class",
  author_name: "Test User",
  author_email: "test@example.com",
  timestamp: "2025-06-01T12:00:00Z",
  parent_hashes: ["parent123abc456def789012345678901234567890"],
  is_merge: false,
};

const mockMergeCommit: RevisionCommit = {
  hash: "merge123def456",
  short_hash: "merge12",
  message: "Merge branch 'feature/foo'",
  author_name: "Merger",
  author_email: "merger@example.com",
  timestamp: "2025-07-01T10:00:00Z",
  parent_hashes: ["parentA", "parentB"],
  is_merge: true,
  merged_branch: "feature/foo",
};

const mockInitialCommit: RevisionCommit = {
  hash: "initial000",
  short_hash: "initial",
  message: "Initial commit",
  author_name: "Init User",
  author_email: "init@example.com",
  timestamp: "2025-01-01T00:00:00Z",
  parent_hashes: [],
};

const parentCommit: RevisionCommit = {
  hash: "parent123abc456def789012345678901234567890",
  short_hash: "parent1",
  message: "Parent commit message",
  author_name: "Parent Author",
  author_email: "parent@example.com",
  timestamp: "2025-05-30T12:00:00Z",
  parent_hashes: [],
};

const mockDiffResponse: RevisionDiffResponse = {
  project_id: "proj-1",
  from_version: "parent123",
  to_version: "abc123",
  files_changed: 2,
  changes: [
    {
      path: "ontology.ttl",
      change_type: "M",
      additions: 10,
      deletions: 3,
      patch: "@@ -1,3 +1,10 @@\n-old line\n+new line\n context",
    },
    {
      path: "new-file.ttl",
      change_type: "A",
      additions: 5,
      deletions: 0,
      patch: "@@ -0,0 +1,5 @@\n+line1\n+line2",
    },
  ],
};

const allCommits = [mockCommit, parentCommit, mockInitialCommit, mockMergeCommit];

const defaultProps = {
  commit: mockCommit,
  projectId: "proj-1",
  accessToken: "tok",
  onBack: vi.fn(),
  commits: allCommits,
};

// ── Tests ──────────────────────────────────────────────────────────

describe("CommitDetailView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDiff.mockResolvedValue(mockDiffResponse);
    // clipboard mock
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  // --- Basic rendering ---

  it("renders commit message", async () => {
    await act(async () => {
      render(<CommitDetailView {...defaultProps} />);
    });
    expect(screen.getByText("Add new ontology class")).toBeDefined();
  });

  it("renders author name and email", async () => {
    await act(async () => {
      render(<CommitDetailView {...defaultProps} />);
    });
    expect(screen.getByText("Test User")).toBeDefined();
    expect(screen.getByText("test@example.com")).toBeDefined();
  });

  it("renders the full commit hash", async () => {
    await act(async () => {
      render(<CommitDetailView {...defaultProps} />);
    });
    expect(screen.getByText(mockCommit.hash)).toBeDefined();
  });

  it("renders formatted date", async () => {
    await act(async () => {
      render(<CommitDetailView {...defaultProps} />);
    });
    // The date should be rendered with toLocaleString - just verify some text is present
    const dateElement = screen.getByText(/2025/);
    expect(dateElement).toBeDefined();
  });

  // --- Back button ---

  it("calls onBack when Back button is clicked", async () => {
    const onBack = vi.fn();
    await act(async () => {
      render(<CommitDetailView {...defaultProps} onBack={onBack} />);
    });
    fireEvent.click(screen.getByText("Back"));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  // --- Copy hash ---

  it("copies hash to clipboard on click", async () => {
    await act(async () => {
      render(<CommitDetailView {...defaultProps} />);
    });
    const copyButton = screen.getByTitle("Copy full hash");
    await act(async () => {
      fireEvent.click(copyButton);
    });
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(mockCommit.hash);
  });

  // --- Diff loading ---

  it("loads diff when commit has parent hashes", async () => {
    await act(async () => {
      render(<CommitDetailView {...defaultProps} />);
    });
    await waitFor(() => {
      expect(mockGetDiff).toHaveBeenCalledWith(
        "proj-1",
        mockCommit.parent_hashes[0],
        mockCommit.hash,
        "tok"
      );
    });
  });

  it("shows file changes with additions and deletions", async () => {
    await act(async () => {
      render(<CommitDetailView {...defaultProps} />);
    });
    await waitFor(() => {
      expect(screen.getByText("ontology.ttl")).toBeDefined();
      expect(screen.getByText("new-file.ttl")).toBeDefined();
    });
    // Check summary line
    expect(screen.getByText(/2 files changed/)).toBeDefined();
    // Addition/deletion counts
    expect(screen.getByText("+10")).toBeDefined();
    expect(screen.getByText("-3")).toBeDefined();
  });

  it("shows change type labels", async () => {
    await act(async () => {
      render(<CommitDetailView {...defaultProps} />);
    });
    await waitFor(() => {
      expect(screen.getByText("Modified")).toBeDefined();
      expect(screen.getByText("Added")).toBeDefined();
    });
  });

  // --- Diff error ---

  it("shows error message when diff loading fails", async () => {
    mockGetDiff.mockRejectedValue(new Error("Network error"));
    await act(async () => {
      render(<CommitDetailView {...defaultProps} />);
    });
    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeDefined();
    });
  });

  it("shows generic error when non-Error is thrown", async () => {
    mockGetDiff.mockRejectedValue("something broke");
    await act(async () => {
      render(<CommitDetailView {...defaultProps} />);
    });
    await waitFor(() => {
      expect(screen.getByText("Failed to load diff")).toBeDefined();
    });
  });

  // --- Initial commit (no parents) ---

  it("shows initial commit message when no parent hashes", async () => {
    await act(async () => {
      render(
        <CommitDetailView
          {...defaultProps}
          commit={mockInitialCommit}
        />
      );
    });
    expect(screen.getByText("Initial commit - no parent to compare")).toBeDefined();
    expect(mockGetDiff).not.toHaveBeenCalled();
  });

  // --- Merge badge ---

  it("shows merge badge for merge commits", async () => {
    mockGetDiff.mockResolvedValue({
      ...mockDiffResponse,
      changes: [],
      files_changed: 0,
    });
    await act(async () => {
      render(
        <CommitDetailView {...defaultProps} commit={mockMergeCommit} />
      );
    });
    expect(screen.getByText(/Merged from feature\/foo/)).toBeDefined();
  });

  // --- Parent commit display ---

  it("shows parent commit message when parent exists in commits list", async () => {
    await act(async () => {
      render(<CommitDetailView {...defaultProps} />);
    });
    // The parent hash should be sliced to 8 chars
    expect(
      screen.getByText(parentCommit.hash.slice(0, 8))
    ).toBeDefined();
    // Parent message should be shown
    expect(screen.getByText("Parent commit message")).toBeDefined();
  });

  it("shows 'Parents' label for merge commits with multiple parents", async () => {
    mockGetDiff.mockResolvedValue({ ...mockDiffResponse, changes: [], files_changed: 0 });
    await act(async () => {
      render(
        <CommitDetailView {...defaultProps} commit={mockMergeCommit} />
      );
    });
    expect(screen.getByText("Parents")).toBeDefined();
  });

  it("shows 'Parent' label for single parent", async () => {
    await act(async () => {
      render(<CommitDetailView {...defaultProps} />);
    });
    expect(screen.getByText("Parent")).toBeDefined();
  });

  // --- Expand / collapse file diffs ---

  it("collapses a file diff when its header is clicked", async () => {
    await act(async () => {
      render(<CommitDetailView {...defaultProps} />);
    });
    await waitFor(() => {
      expect(screen.getByText("ontology.ttl")).toBeDefined();
    });
    // Files are expanded by default - patch content should be visible
    expect(screen.getByText("+new line")).toBeDefined();

    // Click the file header to collapse
    fireEvent.click(screen.getByText("ontology.ttl"));
    // Patch content should no longer be visible
    expect(screen.queryByText("+new line")).toBeNull();

    // Click again to re-expand
    fireEvent.click(screen.getByText("ontology.ttl"));
    expect(screen.getByText("+new line")).toBeDefined();
  });

  // --- Multiline commit message ---

  it("renders multiline commit messages with body", async () => {
    const multilineCommit: RevisionCommit = {
      ...mockCommit,
      message: "Subject line\n\nDetailed body\nwith multiple lines",
      parent_hashes: [],
    };
    await act(async () => {
      render(
        <CommitDetailView {...defaultProps} commit={multilineCommit} />
      );
    });
    expect(screen.getByText("Subject line")).toBeDefined();
    expect(screen.getByText(/Detailed body/)).toBeDefined();
  });

  // --- No file changes ---

  it("shows 'No file changes' when diff has empty changes", async () => {
    mockGetDiff.mockResolvedValue({
      ...mockDiffResponse,
      changes: [],
      files_changed: 0,
    });
    await act(async () => {
      render(<CommitDetailView {...defaultProps} />);
    });
    await waitFor(() => {
      expect(screen.getByText("No file changes")).toBeDefined();
    });
  });

  // --- Diff line highlighting ---

  it("renders diff patch lines with correct styling classes", async () => {
    await act(async () => {
      render(<CommitDetailView {...defaultProps} />);
    });
    await waitFor(() => {
      expect(screen.getByText("ontology.ttl")).toBeDefined();
    });
    // The hunk header line @@...@@
    const hunkHeader = screen.getByText("@@ -1,3 +1,10 @@");
    expect(hunkHeader.className).toContain("bg-blue-50");

    // Addition line
    const addLine = screen.getByText("+new line");
    expect(addLine.className).toContain("bg-green-50");

    // Deletion line
    const delLine = screen.getByText("-old line");
    expect(delLine.className).toContain("bg-red-50");
  });

  // --- Change type labels ---

  it("handles all change type labels including delete and rename", async () => {
    mockGetDiff.mockResolvedValue({
      ...mockDiffResponse,
      files_changed: 4,
      changes: [
        { path: "a.ttl", change_type: "A", additions: 1, deletions: 0 },
        { path: "d.ttl", change_type: "D", additions: 0, deletions: 1 },
        { path: "m.ttl", change_type: "M", additions: 1, deletions: 1 },
        { path: "r.ttl", change_type: "R", old_path: "old.ttl", additions: 0, deletions: 0 },
      ],
    });
    await act(async () => {
      render(<CommitDetailView {...defaultProps} />);
    });
    await waitFor(() => {
      expect(screen.getByText("Added")).toBeDefined();
      expect(screen.getByText("Deleted")).toBeDefined();
      expect(screen.getByText("Modified")).toBeDefined();
      expect(screen.getByText("Renamed")).toBeDefined();
    });
  });

  it("shows renamed-from path for renamed files", async () => {
    mockGetDiff.mockResolvedValue({
      ...mockDiffResponse,
      files_changed: 1,
      changes: [
        { path: "r.ttl", change_type: "R", old_path: "old.ttl", additions: 0, deletions: 0 },
      ],
    });
    await act(async () => {
      render(<CommitDetailView {...defaultProps} />);
    });
    await waitFor(() => {
      expect(screen.getByText(/renamed from old\.ttl/)).toBeDefined();
    });
  });
});
