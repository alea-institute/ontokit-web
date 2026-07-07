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
      undefined,
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
        undefined,
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
        undefined,
      ),
    );
  });

  // Regression: the graph endpoint is OptionalUser — private-project graphs
  // 401/403 without the Bearer token. The pre-port code passed accessToken; the
  // ported client dropped it (/ce:review MEDIUM). The hook must thread the token
  // to getEntityGraph on both the focus fetch and progressive expansion.
  it("threads the access token to the focus fetch", async () => {
    renderHook(() =>
      useGraphData({
        focusIri: "http://example.org/A",
        projectId: "proj-1",
        token: "tok-123",
      }),
    );

    await waitFor(() =>
      expect(mockedGetEntityGraph).toHaveBeenCalledWith(
        "proj-1",
        "http://example.org/A",
        expect.any(Object),
        "tok-123",
      ),
    );
  });

  it("threads the access token to progressive expansion", async () => {
    const { result } = renderHook(() =>
      useGraphData({
        focusIri: "http://example.org/A",
        projectId: "proj-1",
        token: "tok-123",
      }),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    mockedGetEntityGraph.mockClear();

    await act(async () => {
      result.current.expandNode("http://example.org/B");
    });

    expect(mockedGetEntityGraph).toHaveBeenCalledWith(
      "proj-1",
      "http://example.org/B",
      expect.any(Object),
      "tok-123",
    );
  });

  it("omits the token argument for anonymous (public-project) reads", async () => {
    renderHook(() =>
      useGraphData({ focusIri: "http://example.org/A", projectId: "proj-1" }),
    );

    await waitFor(() =>
      expect(mockedGetEntityGraph).toHaveBeenCalledWith(
        "proj-1",
        "http://example.org/A",
        expect.any(Object),
        undefined,
      ),
    );
  });

  it("discards an in-flight expansion after the focus changes (no stale merge)", async () => {
    const { result, rerender } = renderHook(
      ({ focus }: { focus: string }) =>
        useGraphData({ focusIri: focus, projectId: "proj-1" }),
      { initialProps: { focus: "http://example.org/A" } },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // The expand call returns a promise we control, so it stays in flight.
    let resolveExpand!: (v: EntityGraphResponse) => void;
    mockedGetEntityGraph.mockReturnValueOnce(
      new Promise<EntityGraphResponse>((r) => {
        resolveExpand = r;
      }),
    );
    act(() => {
      result.current.expandNode("http://example.org/X");
    });

    // Focus changes to C before the expansion resolves.
    mockedGetEntityGraph.mockResolvedValue(makeGraph("http://example.org/C"));
    rerender({ focus: "http://example.org/C" });
    await waitFor(() =>
      expect(result.current.graphData?.focus_iri).toBe("http://example.org/C"),
    );

    // The stale expansion resolves — it must NOT merge into the new C graph.
    await act(async () => {
      resolveExpand(makeGraph("http://example.org/X", ["http://example.org/C"]));
      await Promise.resolve();
    });

    expect(result.current.graphData?.nodes.map((n) => n.id)).toEqual([
      "http://example.org/C",
    ]);
  });
});
