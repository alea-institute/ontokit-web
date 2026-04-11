import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Position } from "@xyflow/react";

vi.mock("@/lib/stores/editorModeStore", () => ({
  useEditorModeStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ graphEdgeStyle: "smoothstep" }),
}));

import { OntologyEdge } from "@/components/graph/OntologyEdge";

vi.mock("@xyflow/react", () => ({
  BaseEdge: ({ id, path, style, markerEnd }: { id: string; path: string; style?: React.CSSProperties; markerEnd?: string }) => (
    <path
      data-testid={`base-edge-${id}`}
      d={path}
      style={style}
      data-marker-end={markerEnd || ""}
    />
  ),
  EdgeLabelRenderer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="edge-label-renderer">{children}</div>
  ),
  getSmoothStepPath: (): [string, number, number] => ["M0,0 L10,10 L20,20 L30,30", 15, 15],
  Position: { Top: "top", Bottom: "bottom", Left: "left", Right: "right" },
}));

describe("OntologyEdge", () => {
  const baseProps = {
    id: "edge-1",
    sourceX: 0,
    sourceY: 0,
    targetX: 100,
    targetY: 100,
    sourcePosition: Position.Top,
    targetPosition: Position.Bottom,
    source: "node-a",
    target: "node-b",
    animated: false,
    selected: false,
    sourceHandleId: null,
    targetHandleId: null,
    interactionWidth: 20,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the base edge with subClassOf style by default", () => {
    render(
      <svg>
        <OntologyEdge {...baseProps} />
      </svg>
    );
    const edge = screen.getByTestId("base-edge-edge-1");
    expect(edge).toBeDefined();
    // Marker is now applied at the React Flow edge level, not inside OntologyEdge
    expect(edge).toBeDefined();
  });

  it("passes markerEnd prop through to BaseEdge", () => {
    render(
      <svg>
        <OntologyEdge {...baseProps} markerEnd="url(#test-marker)" />
      </svg>
    );
    const edge = screen.getByTestId("base-edge-edge-1");
    expect(edge.getAttribute("data-marker-end")).toBe("url(#test-marker)");
  });

  it("renders with equivalentClass edge type", () => {
    render(
      <svg>
        <OntologyEdge
          {...baseProps}
          data={{ edgeType: "equivalentClass" }}
        />
      </svg>
    );
    const edge = screen.getByTestId("base-edge-edge-1");
    expect(edge.style.strokeDasharray).toBe("5 3");
  });

  it("renders with disjointWith edge type", () => {
    render(
      <svg>
        <OntologyEdge
          {...baseProps}
          data={{ edgeType: "disjointWith" }}
        />
      </svg>
    );
    const edge = screen.getByTestId("base-edge-edge-1");
    // jsdom converts hex to rgb
    expect(edge.style.stroke).toBe("rgb(239, 68, 68)");
  });

  it("renders with seeAlso edge type", () => {
    render(
      <svg>
        <OntologyEdge {...baseProps} data={{ edgeType: "seeAlso" }} />
      </svg>
    );
    const edge = screen.getByTestId("base-edge-edge-1");
    expect(edge.style.strokeDasharray).toBe("6 3");
  });

  it("does not show label by default (not hovered)", () => {
    render(
      <svg>
        <OntologyEdge {...baseProps} />
      </svg>
    );
    expect(screen.queryByText("subClassOf")).toBeNull();
  });

  it("shows label on hover", () => {
    const { container } = render(
      <svg>
        <OntologyEdge {...baseProps} />
      </svg>
    );

    // The invisible hover path is the first <path> in the rendered output
    const paths = container.querySelectorAll("path");
    // Find the transparent hover path (stroke="transparent")
    const hoverPath = Array.from(paths).find(
      (p) => p.getAttribute("stroke") === "transparent"
    );
    expect(hoverPath).toBeDefined();

    fireEvent.mouseEnter(hoverPath!);
    expect(screen.getByText("subClassOf")).toBeDefined();

    fireEvent.mouseLeave(hoverPath!);
    expect(screen.queryByText("subClassOf")).toBeNull();
  });

  it("shows equivalentTo label on hover for equivalentClass type", () => {
    const { container } = render(
      <svg>
        <OntologyEdge
          {...baseProps}
          data={{ edgeType: "equivalentClass" }}
        />
      </svg>
    );

    const paths = container.querySelectorAll("path");
    const hoverPath = Array.from(paths).find(
      (p) => p.getAttribute("stroke") === "transparent"
    );

    fireEvent.mouseEnter(hoverPath!);
    expect(screen.getByText("equivalentTo")).toBeDefined();
  });

  it("defaults to subClassOf when no data provided", () => {
    render(
      <svg>
        <OntologyEdge {...baseProps} data={undefined} />
      </svg>
    );
    const edge = screen.getByTestId("base-edge-edge-1");
    // Marker is applied at React Flow edge level, not inside OntologyEdge
    expect(edge).toBeDefined();
  });

  it("renders invisible hover detection path with strokeWidth 16", () => {
    const { container } = render(
      <svg>
        <OntologyEdge {...baseProps} />
      </svg>
    );

    const paths = container.querySelectorAll("path");
    const hoverPath = Array.from(paths).find(
      (p) => p.getAttribute("stroke") === "transparent"
    );
    expect(hoverPath?.getAttribute("stroke-width")).toBe("16");
  });
});
