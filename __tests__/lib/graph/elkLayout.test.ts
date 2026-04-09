import { describe, expect, it, vi, beforeEach } from "vitest";

// Define the mock fn at module scope so it's available when the factory runs
const mockLayout = vi.fn();

vi.mock("elkjs/lib/elk.bundled.js", () => ({
  default: class MockELK {
    layout(...args: unknown[]) {
      return mockLayout(...args);
    }
  },
}));

import { computeLayout } from "@/lib/graph/elkLayout";
import type {
  OntologyGraphNode,
  OntologyGraphEdge,
} from "@/lib/graph/types";

describe("computeLayout", () => {
  beforeEach(() => {
    mockLayout.mockReset();
  });

  it("returns positions for each node", async () => {
    const nodes: OntologyGraphNode[] = [
      { id: "A", label: "A", nodeType: "class" },
      { id: "B", label: "B", nodeType: "class" },
    ];
    const edges: OntologyGraphEdge[] = [
      { id: "e1", source: "A", target: "B", edgeType: "subClassOf" },
    ];

    mockLayout.mockResolvedValueOnce({
      children: [
        { id: "A", x: 10, y: 20 },
        { id: "B", x: 30, y: 40 },
      ],
    });

    const positions = await computeLayout(nodes, edges);
    expect(positions.get("A")).toEqual({ x: 10, y: 20 });
    expect(positions.get("B")).toEqual({ x: 30, y: 40 });
  });

  it("defaults to 0 when coordinates are undefined", async () => {
    const nodes: OntologyGraphNode[] = [
      { id: "A", label: "A", nodeType: "class" },
    ];

    mockLayout.mockResolvedValueOnce({
      children: [{ id: "A", x: undefined, y: undefined }],
    });

    const positions = await computeLayout(nodes, []);
    expect(positions.get("A")).toEqual({ x: 0, y: 0 });
  });

  it("returns empty map when no children", async () => {
    mockLayout.mockResolvedValueOnce({ children: undefined });

    const positions = await computeLayout([], []);
    expect(positions.size).toBe(0);
  });

  it("passes correct direction for TB", async () => {
    mockLayout.mockResolvedValueOnce({ children: [] });

    await computeLayout([], [], "TB");

    const graph = mockLayout.mock.calls[0][0];
    expect(graph.layoutOptions["elk.direction"]).toBe("UP");
  });

  it("passes correct direction for LR", async () => {
    mockLayout.mockResolvedValueOnce({ children: [] });

    await computeLayout([], [], "LR");

    const graph = mockLayout.mock.calls[0][0];
    expect(graph.layoutOptions["elk.direction"]).toBe("LEFT");
  });

  it("propagates ELK layout errors", async () => {
    mockLayout.mockRejectedValueOnce(new Error("ELK layout failed"));

    await expect(computeLayout([], [])).rejects.toThrow("ELK layout failed");
  });

  it("maps node and edge properties to ELK format", async () => {
    const nodes: OntologyGraphNode[] = [
      { id: "N1", label: "Node 1", nodeType: "focus" },
    ];
    const edges: OntologyGraphEdge[] = [
      { id: "E1", source: "N1", target: "N1", edgeType: "subClassOf" },
    ];

    mockLayout.mockResolvedValueOnce({ children: [{ id: "N1", x: 0, y: 0 }] });

    await computeLayout(nodes, edges);

    const graph = mockLayout.mock.calls[0][0];
    expect(graph.children[0]).toMatchObject({
      id: "N1",
      width: 180,
      height: 44,
    });
    expect(graph.edges[0]).toMatchObject({
      id: "E1",
      sources: ["N1"],
      targets: ["N1"],
    });
  });
});
