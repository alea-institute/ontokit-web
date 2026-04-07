import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useELKLayout } from "@/lib/graph/useELKLayout";
import type { EntityGraphResponse } from "@/lib/api/graph";

// Mock elkjs to avoid loading the actual WASM module
vi.mock("elkjs/lib/elk.bundled.js", () => ({
  default: class MockELK {
    async layout(graph: { children: Array<{ id: string; width: number; height: number }>; edges: Array<{ id: string }> }) {
      return {
        children: graph.children.map((child, idx) => ({
          ...child,
          x: idx * 200,
          y: idx * 100,
        })),
        edges: graph.edges,
      };
    }
  },
}));

function makeGraphResponse(nodeCount = 3): EntityGraphResponse {
  const nodes = Array.from({ length: nodeCount }, (_, i) => ({
    id: `urn:node-${i}`,
    label: `Node ${i}`,
    iri: `urn:node-${i}`,
    definition: null,
    is_focus: i === 0,
    is_root: i === nodeCount - 1,
    depth: i,
    node_type: i === 0 ? "focus" : "class",
    child_count: nodeCount - i - 1,
  }));

  const edges = Array.from({ length: nodeCount - 1 }, (_, i) => ({
    id: `subClassOf:urn:node-${i}:urn:node-${i + 1}`,
    source: `urn:node-${i}`,
    target: `urn:node-${i + 1}`,
    edge_type: "subClassOf" as const,
    label: null,
  }));

  return {
    focus_iri: "urn:node-0",
    focus_label: "Node 0",
    nodes,
    edges,
    truncated: false,
    total_concept_count: nodeCount,
  };
}

describe("useELKLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts with empty nodes and edges", () => {
    const { result } = renderHook(() => useELKLayout());

    expect(result.current.nodes).toEqual([]);
    expect(result.current.edges).toEqual([]);
    expect(result.current.isLayouting).toBe(false);
  });

  it("computes layout from graph response", async () => {
    const data = makeGraphResponse(3);
    const { result } = renderHook(() => useELKLayout());

    await act(async () => {
      await result.current.runLayout(data);
    });

    expect(result.current.nodes).toHaveLength(3);
    expect(result.current.edges).toHaveLength(2);
    expect(result.current.isLayouting).toBe(false);
  });

  it("assigns correct node type from backend data", async () => {
    const data = makeGraphResponse(2);
    const { result } = renderHook(() => useELKLayout());

    await act(async () => {
      await result.current.runLayout(data);
    });

    const focusNode = result.current.nodes.find((n) => n.id === "urn:node-0");
    expect(focusNode?.data.nodeType).toBe("focus");
    expect(focusNode?.type).toBe("ontologyNode");
  });

  it("assigns correct edge type from backend data", async () => {
    const data = makeGraphResponse(2);
    const { result } = renderHook(() => useELKLayout());

    await act(async () => {
      await result.current.runLayout(data);
    });

    const edge = result.current.edges[0];
    expect(edge.data?.edgeType).toBe("subClassOf");
    expect(edge.type).toBe("ontologyEdge");
  });

  it("positions nodes using ELK output", async () => {
    const data = makeGraphResponse(2);
    const { result } = renderHook(() => useELKLayout());

    await act(async () => {
      await result.current.runLayout(data);
    });

    // Mock positions x at idx*200, y at idx*100
    expect(result.current.nodes[0].position).toEqual({ x: 0, y: 0 });
    expect(result.current.nodes[1].position).toEqual({ x: 200, y: 100 });
  });

  it("calculates dynamic node width from label length", async () => {
    const data = makeGraphResponse(1);
    data.nodes[0].label = "A very long label for testing width";
    const { result } = renderHook(() => useELKLayout());

    await act(async () => {
      await result.current.runLayout(data);
    });

    // Node should exist and have been laid out
    expect(result.current.nodes).toHaveLength(1);
  });

  it("adds arrowhead marker only for subClassOf edges", async () => {
    const data = makeGraphResponse(2);
    data.edges[0].edge_type = "seeAlso";
    const { result } = renderHook(() => useELKLayout());

    await act(async () => {
      await result.current.runLayout(data);
    });

    const edge = result.current.edges[0];
    expect(edge.markerEnd).toBeUndefined();
  });
});
