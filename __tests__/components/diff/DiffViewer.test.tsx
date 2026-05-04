import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DiffViewer } from "@/components/diff/DiffViewer";
import type { RevisionDiffResponse } from "@/lib/api/revisions";

// Mock revisionsApi
const mockGetDiff = vi.fn();
vi.mock("@/lib/api/revisions", () => ({
  revisionsApi: {
    getDiff: (...args: unknown[]) => mockGetDiff(...args),
  },
}));

// Mock lucide-react
vi.mock("lucide-react", () => ({
  FileCode: (props: Record<string, unknown>) => <span data-testid="file-code" {...props} />,
  FilePlus: (props: Record<string, unknown>) => <span data-testid="file-plus" {...props} />,
  FileX: (props: Record<string, unknown>) => <span data-testid="file-x" {...props} />,
  FileDiff: (props: Record<string, unknown>) => <span data-testid="file-diff" {...props} />,
  ChevronDown: (props: Record<string, unknown>) => <span data-testid="chevron-down" {...props} />,
  ChevronRight: (props: Record<string, unknown>) => (
    <span data-testid="chevron-right" {...props} />
  ),
}));

beforeEach(() => {
  mockGetDiff.mockReset();
});

const baseDiff: RevisionDiffResponse = {
  project_id: "p1",
  from_version: "abc12345abcdef",
  to_version: "HEAD",
  files_changed: 2,
  changes: [
    {
      path: "ontology.ttl",
      change_type: "M",
      additions: 5,
      deletions: 2,
    },
    {
      path: "new-file.ttl",
      change_type: "A",
      additions: 10,
      deletions: 0,
    },
  ],
};

describe("DiffViewer", () => {
  it("shows loading spinner initially", () => {
    mockGetDiff.mockReturnValue(new Promise(() => {})); // never resolves
    const { container } = render(
      <DiffViewer projectId="p1" fromVersion="abc12345" />,
    );
    const spinner = container.querySelector(".animate-spin");
    expect(spinner).toBeTruthy();
  });

  it("renders error state when API fails", async () => {
    mockGetDiff.mockRejectedValue(new Error("Network error"));
    render(
      <DiffViewer projectId="p1" fromVersion="abc12345" />,
    );
    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeDefined();
    });
  });

  it("renders empty state when no changes", async () => {
    mockGetDiff.mockResolvedValue({
      ...baseDiff,
      changes: [],
    });
    render(
      <DiffViewer projectId="p1" fromVersion="abc12345" />,
    );
    await waitFor(() => {
      expect(
        screen.getByText("No changes between these versions"),
      ).toBeDefined();
    });
  });

  it("renders file list with change labels", async () => {
    mockGetDiff.mockResolvedValue(baseDiff);
    render(
      <DiffViewer projectId="p1" fromVersion="abc12345abcdef" />,
    );
    await waitFor(() => {
      expect(screen.getByText("ontology.ttl")).toBeDefined();
    });
    expect(screen.getByText("new-file.ttl")).toBeDefined();
    expect(screen.getByText("Modified")).toBeDefined();
    expect(screen.getByText("Added")).toBeDefined();
    expect(screen.getByText(/2 files? changed/)).toBeDefined();
  });

  it("toggles file expansion on click", async () => {
    const user = userEvent.setup();
    mockGetDiff.mockResolvedValue(baseDiff);
    render(
      <DiffViewer projectId="p1" fromVersion="abc12345abcdef" />,
    );
    await waitFor(() => {
      expect(screen.getByText("ontology.ttl")).toBeDefined();
    });

    // Click file button to expand
    await user.click(screen.getByText("ontology.ttl").closest("button")!);
    expect(
      screen.getByText("Detailed diff view coming soon"),
    ).toBeDefined();

    // Click again to collapse
    await user.click(screen.getByText("ontology.ttl").closest("button")!);
    expect(
      screen.queryByText("Detailed diff view coming soon"),
    ).toBeNull();
  });

  it("renders Deleted and Renamed labels", async () => {
    mockGetDiff.mockResolvedValue({
      ...baseDiff,
      files_changed: 2,
      changes: [
        { path: "old.ttl", change_type: "D", additions: 0, deletions: 5 },
        { path: "renamed.ttl", change_type: "R", additions: 0, deletions: 0 },
      ],
    });
    render(
      <DiffViewer projectId="p1" fromVersion="abc12345abcdef" />,
    );
    await waitFor(() => {
      expect(screen.getByText("Deleted")).toBeDefined();
    });
    expect(screen.getByText("Renamed")).toBeDefined();
  });

  it("passes accessToken to the API", async () => {
    mockGetDiff.mockResolvedValue(baseDiff);
    render(
      <DiffViewer
        projectId="p1"
        fromVersion="abc"
        toVersion="def"
        accessToken="tok123"
      />,
    );
    await waitFor(() => {
      expect(mockGetDiff).toHaveBeenCalledWith("p1", "abc", "def", "tok123");
    });
  });
});
