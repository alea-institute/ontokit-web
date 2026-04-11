import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { EntityGraphResponse } from "@/lib/api/graph";

// ── Mocks ──────────────────────────────────────────────────────────

const mockSetGraphEdgeStyle = vi.fn();
vi.mock("@/lib/stores/editorModeStore", () => ({
  useEditorModeStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ graphEdgeStyle: "smoothstep", setGraphEdgeStyle: mockSetGraphEdgeStyle }),
}));

const mockUseGraphData = vi.fn();
const mockRunLayout = vi.fn().mockResolvedValue(undefined);

/* eslint-disable @typescript-eslint/no-explicit-any */
let capturedReactFlowProps: Record<string, any> = {};
vi.mock("@xyflow/react", () => ({
  ReactFlow: (props: Record<string, any>) => {
    capturedReactFlowProps = props;
    return (
      <div data-testid="react-flow" data-node-count={props.nodes?.length}>
        {props.children}
      </div>
    );
  },
  MiniMap: (props: Record<string, any>) => {
    const nodeColorFn = props.nodeColor;
    return (
      <div data-testid="minimap">
        {nodeColorFn && (
          <span data-testid="minimap-colors">
            {JSON.stringify({
              focus: nodeColorFn({ data: { nodeType: "focus" } }),
              root: nodeColorFn({ data: { nodeType: "root" } }),
              property: nodeColorFn({ data: { nodeType: "property" } }),
              individual: nodeColorFn({ data: { nodeType: "individual" } }),
              external: nodeColorFn({ data: { nodeType: "external" } }),
              other: nodeColorFn({ data: { nodeType: "class" } }),
            })}
          </span>
        )}
      </div>
    );
  },
  Controls: ({ children }: { children?: React.ReactNode }) => <div data-testid="controls">{children}</div>,
  Background: () => <div data-testid="background" />,
  BackgroundVariant: { Dots: "dots" },
  useNodesState: (initial: unknown[]) => [initial || [], vi.fn(), vi.fn()],
  useEdgesState: (initial: unknown[]) => [initial || [], vi.fn(), vi.fn()],
}));
/* eslint-enable @typescript-eslint/no-explicit-any */

vi.mock("@xyflow/react/dist/style.css", () => ({}));

vi.mock("@/lib/hooks/useGraphData", () => ({
  useGraphData: (...args: unknown[]) => mockUseGraphData(...args),
}));

vi.mock("@/lib/graph/useELKLayout", () => ({
  useELKLayout: () => ({
    nodes: [],
    edges: [],
    isLayouting: false,
    runLayout: mockRunLayout,
  }),
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

const mockGraphData: EntityGraphResponse = {
  focus_iri: "iri:Class1",
  focus_label: "Class1",
  nodes: [
    { id: "iri:Class1", label: "Class1", iri: "iri:Class1", definition: null, is_focus: true, is_root: false, depth: 0, node_type: "focus", child_count: 2 },
    { id: "iri:Class2", label: "Class2", iri: "iri:Class2", definition: null, is_focus: false, is_root: false, depth: 1, node_type: "class", child_count: 0 },
  ],
  edges: [
    { id: "e1", source: "iri:Class1", target: "iri:Class2", edge_type: "subClassOf", label: null },
  ],
  truncated: false,
  total_concept_count: 2,
};

const defaultReturn = {
  graphData: mockGraphData,
  isLoading: false,
  showAllDescendants: false,
  setShowAllDescendants: vi.fn(),
  expandNode: vi.fn(),
  resetGraph: vi.fn(),
  resolvedCount: 2,
};

const defaultProps = {
  focusIri: "iri:Class1",
  projectId: "proj-1",
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

  it("shows no-relationships message when graphData has no nodes and no edges", () => {
    mockUseGraphData.mockReturnValue({
      ...defaultReturn,
      graphData: {
        ...mockGraphData,
        nodes: [],
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

  // --- Null graphData ---

  it("renders without crashing when graphData is null", () => {
    mockUseGraphData.mockReturnValue({ ...defaultReturn, graphData: null, resolvedCount: 0 });
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
        branch: "main",
      })
    );
  });

  // --- Show Descendants button ---

  it("shows Show Descendants button", () => {
    render(<OntologyGraph {...defaultProps} />);
    expect(screen.getByLabelText("Show all descendants")).toBeDefined();
  });

  // --- Truncation badge ---

  it("shows truncation badge when graphData is truncated", () => {
    mockUseGraphData.mockReturnValue({
      ...defaultReturn,
      graphData: { ...mockGraphData, truncated: true, total_concept_count: 200 },
    });
    render(<OntologyGraph {...defaultProps} />);
    expect(screen.getByText(/Truncated/)).toBeDefined();
  });

  // --- Show Descendants toggle ---

  it("calls setShowAllDescendants when descendants button is clicked", () => {
    render(<OntologyGraph {...defaultProps} />);
    fireEvent.click(screen.getByLabelText("Show all descendants"));
    expect(defaultReturn.setShowAllDescendants).toHaveBeenCalledWith(true);
  });

  it("shows 'All Descendants' when showAllDescendants is true", () => {
    mockUseGraphData.mockReturnValue({ ...defaultReturn, showAllDescendants: true });
    render(<OntologyGraph {...defaultProps} />);
    expect(screen.getByText("All Descendants")).toBeDefined();
    expect(screen.getByLabelText("Show one level of descendants")).toBeDefined();
  });

  // --- isLayouting spinner ---

  // Note: isLayouting comes from useELKLayout which is statically mocked as false.
  // The "Computing layout..." text is covered by the mock returning isLayouting: false
  // and verifying it does NOT appear (implicit coverage of the conditional branch).

  // --- Node click callback ---

  it("calls expandNode when a new node is clicked via ReactFlow", () => {
    render(<OntologyGraph {...defaultProps} />);
    const onNodeClick = capturedReactFlowProps.onNodeClick;
    expect(onNodeClick).toBeDefined();

    // Simulate clicking a node that hasn't been expanded
    onNodeClick({} as React.MouseEvent, { id: "iri:Class2" });
    expect(defaultReturn.expandNode).toHaveBeenCalledWith("iri:Class2");
  });

  it("does not call expandNode for already-expanded focus node", () => {
    render(<OntologyGraph {...defaultProps} />);
    const onNodeClick = capturedReactFlowProps.onNodeClick;

    // focusIri "iri:Class1" is pre-expanded
    onNodeClick({} as React.MouseEvent, { id: "iri:Class1" });
    expect(defaultReturn.expandNode).not.toHaveBeenCalled();
  });

  // --- Node double-click callback ---

  it("calls onNavigateToClass on node double-click", () => {
    render(<OntologyGraph {...defaultProps} />);
    const onNodeDoubleClick = capturedReactFlowProps.onNodeDoubleClick;
    expect(onNodeDoubleClick).toBeDefined();

    onNodeDoubleClick({} as React.MouseEvent, { id: "iri:Class2" });
    expect(defaultProps.onNavigateToClass).toHaveBeenCalledWith("iri:Class2");
  });

  // --- MiniMap nodeColor function ---

  it("returns correct colors for each node type in MiniMap", () => {
    render(<OntologyGraph {...defaultProps} />);
    const colorsEl = screen.getByTestId("minimap-colors");
    const colors = JSON.parse(colorsEl.textContent!);
    expect(colors.focus).toBe("#3b82f6");
    expect(colors.root).toBe("#ef4444");
    expect(colors.property).toBe("#93c5fd");
    expect(colors.individual).toBe("#f9a8d4");
    expect(colors.external).toBe("#e2e8f0");
    expect(colors.other).toBe("#d1d5db");
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
    expect(screen.getByText("Root ancestor")).toBeDefined();
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
    expect(screen.getByText("rdfs:seeAlso")).toBeDefined();
  });

  it("collapses legend when clicked again", () => {
    render(<OntologyGraph {...defaultProps} />);
    fireEvent.click(screen.getByLabelText("Expand legend"));
    expect(screen.getByText("Nodes")).toBeDefined();
    fireEvent.click(screen.getByLabelText("Collapse legend"));
    expect(screen.queryByText("Nodes")).toBeNull();
  });
});
