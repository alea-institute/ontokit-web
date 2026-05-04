import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// ── Mocks ──────────────────────────────────────────────────────────

const mockUseGraphData = vi.fn();

vi.mock("@xyflow/react", () => ({
  ReactFlow: ({ children, nodes }: { children?: React.ReactNode; nodes?: unknown[] }) => (
    <div data-testid="react-flow" data-node-count={nodes?.length}>
      {children}
    </div>
  ),
  MiniMap: () => <div data-testid="minimap" />,
  Controls: ({ children }: { children?: React.ReactNode }) => <div data-testid="controls">{children}</div>,
  Background: () => <div data-testid="background" />,
  BackgroundVariant: { Dots: "dots" },
  useNodesState: (initial: unknown[]) => [initial || [], vi.fn(), vi.fn()],
  useEdgesState: (initial: unknown[]) => [initial || [], vi.fn(), vi.fn()],
}));

vi.mock("@xyflow/react/dist/style.css", () => ({}));

vi.mock("@/lib/hooks/useGraphData", () => ({
  useGraphData: (...args: unknown[]) => mockUseGraphData(...args),
}));

vi.mock("@/lib/graph/elkLayout", () => ({
  computeLayout: vi.fn().mockResolvedValue(new Map()),
}));

vi.mock("@/components/graph/OntologyNode", () => ({
  OntologyNode: () => null,
}));

vi.mock("@/components/graph/OntologyEdge", () => ({
  OntologyEdge: () => null,
}));

vi.mock("@/lib/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

// Import after mocks
import { OntologyGraph } from "@/components/graph/OntologyGraph";

// ── Fixtures ───────────────────────────────────────────────────────

const mockGraphData = {
  nodes: [
    { id: "iri:Class1", label: "Class1", nodeType: "focus" as const, deprecated: false, childCount: 2, isExpanded: true },
    { id: "iri:Class2", label: "Class2", nodeType: "class" as const, deprecated: false, childCount: 0, isExpanded: false },
  ],
  edges: [
    { id: "e1", source: "iri:Class1", target: "iri:Class2", edgeType: "subClassOf" as const },
  ],
};

const defaultReturn = {
  graphData: mockGraphData,
  isLoading: false,
  expandNode: vi.fn(),
  resetGraph: vi.fn(),
  resolvedCount: 2,
};

const defaultProps = {
  focusIri: "iri:Class1",
  projectId: "proj-1",
  accessToken: "tok",
  branch: "main",
  onNavigateToClass: vi.fn(),
};

// ── Tests ──────────────────────────────────────────────────────────

describe("OntologyGraph", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseGraphData.mockReturnValue(defaultReturn);
  });

  // --- Basic rendering ---

  it("renders ReactFlow component", () => {
    render(<OntologyGraph {...defaultProps} />);
    expect(screen.getByTestId("react-flow")).toBeDefined();
  });

  it("renders MiniMap", () => {
    render(<OntologyGraph {...defaultProps} />);
    expect(screen.getByTestId("minimap")).toBeDefined();
  });

  it("renders Controls", () => {
    render(<OntologyGraph {...defaultProps} />);
    expect(screen.getByTestId("controls")).toBeDefined();
  });

  it("renders Background", () => {
    render(<OntologyGraph {...defaultProps} />);
    expect(screen.getByTestId("background")).toBeDefined();
  });

  // --- Empty state (no focusIri) ---

  it("shows empty state when focusIri is null", () => {
    render(<OntologyGraph {...defaultProps} focusIri={null} />);
    expect(
      screen.getByText("Select a class to view its relationship graph")
    ).toBeDefined();
    expect(screen.queryByTestId("react-flow")).toBeNull();
  });

  // --- Loading state ---

  it("shows loading spinner when isLoading is true", () => {
    mockUseGraphData.mockReturnValue({ ...defaultReturn, isLoading: true });
    const { container } = render(<OntologyGraph {...defaultProps} />);
    const spinner = container.querySelector(".animate-spin");
    expect(spinner).toBeDefined();
    expect(spinner).not.toBeNull();
  });

  // --- No relationships state ---

  it("shows no-relationships message when single node and no edges", () => {
    mockUseGraphData.mockReturnValue({
      ...defaultReturn,
      graphData: {
        nodes: [{ id: "iri:Class1", label: "Class1", nodeType: "focus", deprecated: false, childCount: 0, isExpanded: false }],
        edges: [],
      },
    });
    render(<OntologyGraph {...defaultProps} />);
    expect(
      screen.getByText("No relationships found for this class")
    ).toBeDefined();
  });

  // --- Toolbar: node/edge counts ---

  it("shows node and edge counts", () => {
    render(<OntologyGraph {...defaultProps} />);
    expect(screen.getByText(/2 nodes, 1 edges/)).toBeDefined();
  });

  it("shows resolved count when > 0", () => {
    render(<OntologyGraph {...defaultProps} />);
    expect(screen.getByText(/2 resolved/)).toBeDefined();
  });

  it("does not show resolved count when 0", () => {
    mockUseGraphData.mockReturnValue({ ...defaultReturn, resolvedCount: 0 });
    render(<OntologyGraph {...defaultProps} />);
    expect(screen.queryByText(/resolved/)).toBeNull();
  });

  // --- Layout direction toggle ---

  it("defaults to Top-Down layout", () => {
    render(<OntologyGraph {...defaultProps} />);
    expect(screen.getByText("Top-Down")).toBeDefined();
  });

  it("toggles to Left-Right layout on click", () => {
    render(<OntologyGraph {...defaultProps} />);
    const toggleBtn = screen.getByLabelText(/Switch to left-to-right layout/);
    fireEvent.click(toggleBtn);
    expect(screen.getByText("Left-Right")).toBeDefined();
  });

  it("toggles back to Top-Down on second click", () => {
    render(<OntologyGraph {...defaultProps} />);
    const toggleBtn = screen.getByLabelText(/Switch to left-to-right layout/);
    fireEvent.click(toggleBtn);
    const toggleBtn2 = screen.getByLabelText(/Switch to top-to-bottom layout/);
    fireEvent.click(toggleBtn2);
    expect(screen.getByText("Top-Down")).toBeDefined();
  });

  // --- Reset button ---

  it("calls resetGraph when Reset button is clicked", () => {
    render(<OntologyGraph {...defaultProps} />);
    const resetBtn = screen.getByLabelText("Reset graph");
    fireEvent.click(resetBtn);
    expect(defaultReturn.resetGraph).toHaveBeenCalledTimes(1);
  });

  // --- Fit view button ---

  it("renders Fit view button inside controls", () => {
    render(<OntologyGraph {...defaultProps} />);
    expect(screen.getByLabelText("Fit view")).toBeDefined();
  });

  // --- Null graphData ---

  it("renders without crashing when graphData is null", () => {
    mockUseGraphData.mockReturnValue({ ...defaultReturn, graphData: null });
    render(<OntologyGraph {...defaultProps} />);
    expect(screen.getByTestId("react-flow")).toBeDefined();
    expect(screen.getByText(/0 nodes, 0 edges/)).toBeDefined();
  });

  // --- Passes correct options to useGraphData ---

  it("passes correct options to useGraphData", () => {
    render(<OntologyGraph {...defaultProps} />);
    expect(mockUseGraphData).toHaveBeenCalledWith(
      expect.objectContaining({
        focusIri: "iri:Class1",
        projectId: "proj-1",
        accessToken: "tok",
        branch: "main",
      })
    );
  });
});

describe("GraphLegend", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseGraphData.mockReturnValue(defaultReturn);
  });

  it("renders legend button", () => {
    render(<OntologyGraph {...defaultProps} />);
    expect(screen.getByText("Legend")).toBeDefined();
  });

  it("legend is collapsed by default", () => {
    render(<OntologyGraph {...defaultProps} />);
    expect(screen.queryByText("Nodes")).toBeNull();
    expect(screen.queryByText("Edges")).toBeNull();
  });

  it("expands legend when clicked", () => {
    render(<OntologyGraph {...defaultProps} />);
    fireEvent.click(screen.getByLabelText("Expand legend"));
    expect(screen.getByText("Nodes")).toBeDefined();
    expect(screen.getByText("Edges")).toBeDefined();
  });

  it("shows node types in expanded legend", () => {
    render(<OntologyGraph {...defaultProps} />);
    fireEvent.click(screen.getByLabelText("Expand legend"));
    expect(screen.getByText("Focus")).toBeDefined();
    expect(screen.getByText("Class")).toBeDefined();
    expect(screen.getByText("Root")).toBeDefined();
    expect(screen.getByText("Individual")).toBeDefined();
    expect(screen.getByText("Property")).toBeDefined();
    expect(screen.getByText("External")).toBeDefined();
    expect(screen.getByText("Unexplored")).toBeDefined();
  });

  it("shows edge types in expanded legend", () => {
    render(<OntologyGraph {...defaultProps} />);
    fireEvent.click(screen.getByLabelText("Expand legend"));
    expect(screen.getByText("subClassOf")).toBeDefined();
    expect(screen.getByText("equivalentTo")).toBeDefined();
    expect(screen.getByText("disjointWith")).toBeDefined();
    expect(screen.getByText("seeAlso")).toBeDefined();
  });

  it("collapses legend when clicked again", () => {
    render(<OntologyGraph {...defaultProps} />);
    fireEvent.click(screen.getByLabelText("Expand legend"));
    expect(screen.getByText("Nodes")).toBeDefined();
    fireEvent.click(screen.getByLabelText("Collapse legend"));
    expect(screen.queryByText("Nodes")).toBeNull();
  });
});
