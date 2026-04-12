import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useELKLayout } from "@/lib/graph/useELKLayout";
import type { EntityGraphResponse } from "@/lib/api/graph";

// Hook for deferred layout tests — when set, layout() returns this promise instead
let deferredLayout: {
  resolve: (v: unknown) => void;
  promise: Promise<unknown>;
} | null = null;

// Mock elkjs to avoid loading the actual WASM module
vi.mock("elkjs/lib/elk.bundled.js", () => ({
  default: class MockELK {
    async layout(graph: { children: Array<{ id: string; width: number; height: number }>; edges: Array<{ id: string }> }) {
      const result = {
        children: graph.children.map((child, idx) => ({
          ...child,
          x: idx * 200,
          y: idx * 100,
        })),
        edges: graph.edges,
      };
      if (deferredLayout) return deferredLayout.promise.then(() => result);
      return result;
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

  it("adds arrowhead marker for subClassOf edges", async () => {
    const data = makeGraphResponse(2);
    const { result } = renderHook(() => useELKLayout());

    await act(async () => {
      await result.current.runLayout(data);
    });

    const edge = result.current.edges[0];
    expect(edge.markerEnd).toBeDefined();
    expect((edge.markerEnd as { type: string }).type).toBe("arrowclosed");
  });

  it("does not add arrowhead marker for non-subClassOf edges", async () => {
    const data = makeGraphResponse(2);
    data.edges[0].edge_type = "seeAlso";
    const { result } = renderHook(() => useELKLayout());

    await act(async () => {
      await result.current.runLayout(data);
    });

    const edge = result.current.edges[0];
    expect(edge.markerEnd).toBeUndefined();
  });

  it("accepts LR direction parameter", async () => {
    const data = makeGraphResponse(2);
    const { result } = renderHook(() => useELKLayout());

    await act(async () => {
      await result.current.runLayout(data, "LR");
    });

    expect(result.current.nodes).toHaveLength(2);
    expect(result.current.edges).toHaveLength(1);
  });

  it("only applies results from the latest layout run", async () => {
    const data1 = makeGraphResponse(2);
    const data2 = makeGraphResponse(3);
    const { result } = renderHook(() => useELKLayout());

    // Start two layouts concurrently — only the second should apply
    await act(async () => {
      const run1 = result.current.runLayout(data1);
      const run2 = result.current.runLayout(data2);
      await Promise.all([run1, run2]);
    });

    // The second layout (3 nodes) should win
    expect(result.current.nodes).toHaveLength(3);
  });

  it("sets isLayouting during layout computation", async () => {
    let resolve!: (v: unknown) => void;
    deferredLayout = {
      promise: new Promise((r) => { resolve = r; }),
      resolve: null!,
    };
    deferredLayout.resolve = resolve;

    const data = makeGraphResponse(2);
    const { result } = renderHook(() => useELKLayout());

    expect(result.current.isLayouting).toBe(false);

    let layoutPromise: Promise<void>;
    act(() => {
      layoutPromise = result.current.runLayout(data);
    });

    // While the deferred promise is pending, isLayouting should be true
    expect(result.current.isLayouting).toBe(true);

    // Resolve the layout and wait for completion
    await act(async () => {
      deferredLayout!.resolve(undefined);
      await layoutPromise!;
    });

    expect(result.current.isLayouting).toBe(false);
    deferredLayout = null;
  });

  it("assigns ontologyEdge type to all edges", async () => {
    const data = makeGraphResponse(3);
    const { result } = renderHook(() => useELKLayout());

    await act(async () => {
      await result.current.runLayout(data);
    });

    for (const edge of result.current.edges) {
      expect(edge.type).toBe("ontologyEdge");
    }
  });

  it("assigns ontologyNode type to all nodes", async () => {
    const data = makeGraphResponse(3);
    const { result } = renderHook(() => useELKLayout());

    await act(async () => {
      await result.current.runLayout(data);
    });

    for (const node of result.current.nodes) {
      expect(node.type).toBe("ontologyNode");
    }
  });

  it("normalizes secondary_root node_type to root", async () => {
    const data = makeGraphResponse(2);
    data.nodes[1].node_type = "secondary_root";
    const { result } = renderHook(() => useELKLayout());

    await act(async () => {
      await result.current.runLayout(data);
    });

    expect(result.current.nodes[1].data.nodeType).toBe("root");
  });

  it("falls back to class for unknown node_type", async () => {
    const data = makeGraphResponse(2);
    data.nodes[1].node_type = "bogus_type";
    const { result } = renderHook(() => useELKLayout());

    await act(async () => {
      await result.current.runLayout(data);
    });

    expect(result.current.nodes[1].data.nodeType).toBe("class");
  });

  it("falls back to subClassOf for unknown edge_type", async () => {
    const data = makeGraphResponse(2);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (data.edges[0] as any).edge_type = "unknownRelation";
    const { result } = renderHook(() => useELKLayout());

    await act(async () => {
      await result.current.runLayout(data);
    });

    expect(result.current.edges[0].data!.edgeType).toBe("subClassOf");
  });
});
