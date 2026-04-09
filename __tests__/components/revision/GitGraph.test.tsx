import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import type { RevisionCommit } from "@/lib/api/revisions";
import type { GraphLayout } from "@/lib/git-graph/types";

// ── Mocks ──────────────────────────────────────────────────────────

const mockBuildGraphLayout = vi.fn<(commits: RevisionCommit[], refs?: Record<string, string[]>, defaultBranch?: string) => GraphLayout>();

vi.mock("@/lib/git-graph/graph-builder", () => ({
  buildGraphLayout: (commits: RevisionCommit[], refs?: Record<string, string[]>, defaultBranch?: string) =>
    mockBuildGraphLayout(commits, refs, defaultBranch),
}));

vi.mock("@/lib/git-graph/types", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/git-graph/types")>();
  return {
    ...actual,
    DEFAULT_GRAPH_CONFIG: actual.DEFAULT_GRAPH_CONFIG,
  };
});

// Import after mocks
import { GitGraph } from "@/components/revision/GitGraph";

// ── Fixtures ───────────────────────────────────────────────────────

const makeCommit = (overrides: Partial<RevisionCommit> = {}): RevisionCommit => ({
  hash: "abc123def456789012345678901234567890abcd",
  short_hash: "abc123d",
  message: "Test commit",
  author_name: "Test User",
  author_email: "test@example.com",
  timestamp: "2025-06-01T12:00:00Z",
  parent_hashes: [],
  ...overrides,
});

const singleVertexLayout: GraphLayout = {
  vertices: [
    {
      id: 0,
      hash: "abc123def456789012345678901234567890abcd",
      parentIndices: [],
      childIndices: [],
      lane: 0,
      color: 0,
      isMerge: false,
      refs: [],
    },
  ],
  segments: [],
  width: 1,
  height: 1,
};

const mergeLayout: GraphLayout = {
  vertices: [
    {
      id: 0,
      hash: "child123",
      parentIndices: [1],
      childIndices: [],
      lane: 0,
      color: 0,
      isMerge: false,
      refs: [],
    },
    {
      id: 1,
      hash: "parent456",
      parentIndices: [],
      childIndices: [0],
      lane: 0,
      color: 0,
      isMerge: true,
      refs: ["main"],
    },
  ],
  segments: [
    {
      from: { x: 0, y: 0 },
      to: { x: 0, y: 1 },
      isMergeLine: false,
      colorIndex: 0,
    },
  ],
  width: 1,
  height: 2,
};

const multiLaneLayout: GraphLayout = {
  vertices: [
    {
      id: 0,
      hash: "commit-a",
      parentIndices: [2],
      childIndices: [],
      lane: 0,
      color: 0,
      isMerge: false,
      refs: ["main"],
    },
    {
      id: 1,
      hash: "commit-b",
      parentIndices: [2],
      childIndices: [],
      lane: 1,
      color: 1,
      isMerge: false,
      refs: ["feature"],
    },
    {
      id: 2,
      hash: "commit-c",
      parentIndices: [],
      childIndices: [0, 1],
      lane: 0,
      color: 0,
      isMerge: false,
      refs: [],
    },
  ],
  segments: [
    { from: { x: 0, y: 0 }, to: { x: 0, y: 2 }, isMergeLine: false, colorIndex: 0 },
    { from: { x: 1, y: 1 }, to: { x: 0, y: 2 }, isMergeLine: true, colorIndex: 1 },
  ],
  width: 2,
  height: 3,
};

// ── Tests ──────────────────────────────────────────────────────────

describe("GitGraph", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBuildGraphLayout.mockReturnValue(singleVertexLayout);
  });

  // --- Returns null for empty commits ---

  it("returns null when commits array is empty", () => {
    mockBuildGraphLayout.mockReturnValue({ vertices: [], segments: [], width: 0, height: 0 });
    const { container } = render(<GitGraph commits={[]} />);
    expect(container.innerHTML).toBe("");
  });

  // --- Basic SVG rendering ---

  it("renders an SVG element when commits are provided", () => {
    const commits = [makeCommit()];
    const { container } = render(<GitGraph commits={commits} />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
  });

  it("passes className to the SVG element", () => {
    const commits = [makeCommit()];
    const { container } = render(<GitGraph commits={commits} className="my-graph" />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("class")).toBe("my-graph");
  });

  it("calculates SVG dimensions from layout and config", () => {
    // singleVertexLayout: width=1, height=1; default cellWidth=20, cellHeight=50
    const commits = [makeCommit()];
    const { container } = render(<GitGraph commits={commits} />);
    const svg = container.querySelector("svg");
    // svgWidth = 1 * 20 + 20 = 40, svgHeight = 1 * 50 = 50
    expect(svg?.getAttribute("width")).toBe("40");
    expect(svg?.getAttribute("height")).toBe("50");
  });

  // --- Commit nodes ---

  it("renders a circle for each commit vertex", () => {
    const commits = [makeCommit()];
    const { container } = render(<GitGraph commits={commits} />);
    const circles = container.querySelectorAll(".commit-nodes .commit-node circle");
    // One main circle per vertex
    expect(circles.length).toBeGreaterThanOrEqual(1);
  });

  it("renders merge commit with inner dot", () => {
    mockBuildGraphLayout.mockReturnValue(mergeLayout);
    const commits = [
      makeCommit({ hash: "child123" }),
      makeCommit({ hash: "parent456", is_merge: true }),
    ];
    const { container } = render(<GitGraph commits={commits} />);
    // Merge node has 2 circles (outer ring + inner dot)
    const mergeNodes = container.querySelectorAll(".commit-node");
    const mergeNode = mergeNodes[1]; // second vertex is the merge
    const circles = mergeNode.querySelectorAll("circle");
    expect(circles.length).toBe(2);
  });

  // --- Selection ---

  it("renders selection ring when a commit is selected", () => {
    const commits = [makeCommit()];
    const hash = "abc123def456789012345678901234567890abcd";
    const { container } = render(<GitGraph commits={commits} selectedHash={hash} />);
    const commitNode = container.querySelector(".commit-node");
    const circles = commitNode?.querySelectorAll("circle");
    // selected node: highlight ring + main circle = 2 circles
    expect(circles?.length).toBe(2);
  });

  it("does not render selection ring when commit is not selected", () => {
    const commits = [makeCommit()];
    const { container } = render(<GitGraph commits={commits} selectedHash={null} />);
    const commitNode = container.querySelector(".commit-node");
    const circles = commitNode?.querySelectorAll("circle");
    // non-merge, non-selected: just 1 circle
    expect(circles?.length).toBe(1);
  });

  // --- Click handling ---

  it("calls onSelectCommit with hash when a node is clicked", () => {
    const onSelect = vi.fn();
    const commits = [makeCommit()];
    const { container } = render(
      <GitGraph commits={commits} onSelectCommit={onSelect} />
    );
    const node = container.querySelector(".commit-node");
    fireEvent.click(node!);
    expect(onSelect).toHaveBeenCalledWith("abc123def456789012345678901234567890abcd");
  });

  it("does not crash when onSelectCommit is not provided", () => {
    const commits = [makeCommit()];
    const { container } = render(<GitGraph commits={commits} />);
    const node = container.querySelector(".commit-node");
    expect(() => fireEvent.click(node!)).not.toThrow();
  });

  // --- Branch segments ---

  it("renders path elements for branch segments", () => {
    mockBuildGraphLayout.mockReturnValue(mergeLayout);
    const commits = [
      makeCommit({ hash: "child123" }),
      makeCommit({ hash: "parent456" }),
    ];
    const { container } = render(<GitGraph commits={commits} />);
    const paths = container.querySelectorAll(".branch-lines path");
    expect(paths.length).toBe(1);
  });

  it("renders merge lines with dashed stroke and reduced opacity", () => {
    mockBuildGraphLayout.mockReturnValue(multiLaneLayout);
    const commits = [
      makeCommit({ hash: "commit-a" }),
      makeCommit({ hash: "commit-b" }),
      makeCommit({ hash: "commit-c" }),
    ];
    const { container } = render(<GitGraph commits={commits} />);
    const paths = container.querySelectorAll(".branch-lines path");
    // Second segment is a merge line
    const mergePath = paths[1];
    expect(mergePath.getAttribute("stroke-dasharray")).toBe("4,2");
    expect(mergePath.getAttribute("opacity")).toBe("0.6");
  });

  it("renders non-merge lines as solid with full opacity", () => {
    mockBuildGraphLayout.mockReturnValue(multiLaneLayout);
    const commits = [
      makeCommit({ hash: "commit-a" }),
      makeCommit({ hash: "commit-b" }),
      makeCommit({ hash: "commit-c" }),
    ];
    const { container } = render(<GitGraph commits={commits} />);
    const paths = container.querySelectorAll(".branch-lines path");
    const solidPath = paths[0];
    expect(solidPath.getAttribute("stroke-dasharray")).toBeNull();
    expect(solidPath.getAttribute("opacity")).toBe("1");
  });

  // --- Config overrides ---

  it("applies custom config overrides", () => {
    mockBuildGraphLayout.mockReturnValue(singleVertexLayout);
    const commits = [makeCommit()];
    const { container } = render(
      <GitGraph commits={commits} config={{ cellWidth: 40, cellHeight: 80 }} />
    );
    const svg = container.querySelector("svg");
    // svgWidth = 1 * 40 + 40 = 80, svgHeight = 1 * 80 = 80
    expect(svg?.getAttribute("width")).toBe("80");
    expect(svg?.getAttribute("height")).toBe("80");
  });

  // --- buildGraphLayout args ---

  it("passes commits, refs, and defaultBranch to buildGraphLayout", () => {
    const commits = [makeCommit()];
    const refs = { abc123: ["main"] };
    render(<GitGraph commits={commits} refs={refs} defaultBranch="main" />);
    expect(mockBuildGraphLayout).toHaveBeenCalledWith(commits, refs, "main");
  });

  // --- Diagonal branch lines (multi-lane) ---

  it("renders diagonal paths for cross-lane segments", () => {
    mockBuildGraphLayout.mockReturnValue(multiLaneLayout);
    const commits = [
      makeCommit({ hash: "commit-a" }),
      makeCommit({ hash: "commit-b" }),
      makeCommit({ hash: "commit-c" }),
    ];
    const { container } = render(<GitGraph commits={commits} />);
    const paths = container.querySelectorAll(".branch-lines path");
    // The merge segment goes from lane 1 to lane 0 - path should contain curve commands
    const mergePath = paths[1];
    const d = mergePath.getAttribute("d") ?? "";
    expect(d).toContain("C"); // cubic bezier curve
  });
});
