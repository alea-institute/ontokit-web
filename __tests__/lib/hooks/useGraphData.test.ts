import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useGraphData } from "@/lib/hooks/useGraphData";
import type { EntityGraphResponse } from "@/lib/api/graph";

// The hook now fetches from the server-side BFS endpoint via graphApi.
vi.mock("@/lib/api/graph", () => ({
  graphApi: {
    getEntityGraph: vi.fn(),
  },
}));

import { graphApi } from "@/lib/api/graph";

const mockedGetEntityGraph = graphApi.getEntityGraph as ReturnType<typeof vi.fn>;

function makeGraph(
  focusIri: string,
  extraNodeIris: string[] = [],
): EntityGraphResponse {
  const nodes = [focusIri, ...extraNodeIris].map((iri, i) => ({
    id: iri,
    label: iri.split("/").pop() || iri,
    iri,
    definition: null,
    is_focus: i === 0,
    is_root: false,
    depth: i === 0 ? 0 : 1,
    node_type: i === 0 ? "focus" : "class",
    child_count: null,
  }));
  const edges = extraNodeIris.map((iri) => ({
    id: `${focusIri}->${iri}`,
    source: focusIri,
    target: iri,
    edge_type: "subClassOf" as const,
    label: null,
  }));
  return {
    focus_iri: focusIri,
    focus_label: nodes[0].label,
    nodes,
    edges,
    truncated: false,
    total_concept_count: nodes.length,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedGetEntityGraph.mockResolvedValue(makeGraph("http://example.org/A"));
});

describe("useGraphData", () => {
  it("returns null graphData and does not fetch when focusIri is null", () => {
    const { result } = renderHook(() =>
      useGraphData({ focusIri: null, projectId: "proj-1" }),
    );

    expect(result.current.graphData).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(mockedGetEntityGraph).not.toHaveBeenCalled();
  });

  it("fetches the BFS graph for the focus entity on mount", async () => {
    const { result } = renderHook(() =>
      useGraphData({ focusIri: "http://example.org/A", projectId: "proj-1" }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockedGetEntityGraph).toHaveBeenCalledWith(
      "proj-1",
      "http://example.org/A",
      expect.objectContaining({ ancestorsDepth: 5, descendantsDepth: 0 }),
    );
    expect(result.current.graphData).not.toBeNull();
    expect(result.current.resolvedCount).toBe(1);
  });

  it("clears graphData when the focus fetch fails", async () => {
    mockedGetEntityGraph.mockRejectedValueOnce(new Error("boom"));

    const { result } = renderHook(() =>
      useGraphData({ focusIri: "http://example.org/A", projectId: "proj-1" }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.graphData).toBeNull();
  });

  it("expandNode fetches a 1-hop neighborhood and merges new nodes/edges", async () => {
    const { result } = renderHook(() =>
      useGraphData({ focusIri: "http://example.org/A", projectId: "proj-1" }),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.resolvedCount).toBe(1);

    mockedGetEntityGraph.mockResolvedValueOnce(
      makeGraph("http://example.org/B", ["http://example.org/A"]),
    );

    await act(async () => {
      result.current.expandNode("http://example.org/B");
    });

    await waitFor(() => expect(result.current.resolvedCount).toBe(2));
    // The overlapping node A is de-duplicated, only B is added.
    expect(result.current.graphData?.nodes.map((n) => n.id)).toEqual([
      "http://example.org/A",
      "http://example.org/B",
    ]);
  });

  it("resetGraph clears the graph data", async () => {
    const { result } = renderHook(() =>
      useGraphData({ focusIri: "http://example.org/A", projectId: "proj-1" }),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.graphData).not.toBeNull();

    act(() => {
      result.current.resetGraph();
    });

    expect(result.current.graphData).toBeNull();
    expect(result.current.resolvedCount).toBe(0);
  });

  it("requests descendants when showDescendants is toggled on", async () => {
    const { result } = renderHook(() =>
      useGraphData({ focusIri: "http://example.org/A", projectId: "proj-1" }),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.setShowDescendants(true);
    });

    await waitFor(() =>
      expect(mockedGetEntityGraph).toHaveBeenLastCalledWith(
        "proj-1",
        "http://example.org/A",
        expect.objectContaining({ descendantsDepth: 2 }),
      ),
    );
  });

  it("passes the branch through to the API call", async () => {
    renderHook(() =>
      useGraphData({
        focusIri: "http://example.org/A",
        projectId: "proj-1",
        branch: "dev",
      }),
    );

    await waitFor(() =>
      expect(mockedGetEntityGraph).toHaveBeenCalledWith(
        "proj-1",
        "http://example.org/A",
        expect.objectContaining({ branch: "dev" }),
      ),
    );
  });
});
