import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import type { ReactNode } from "react";
import { useGraphData } from "@/lib/hooks/useGraphData";
import { graphApi, type EntityGraphResponse } from "@/lib/api/graph";

vi.mock("@/lib/api/graph", () => ({
  graphApi: {
    getEntityGraph: vi.fn(),
  },
}));

const mockGetEntityGraph = vi.mocked(graphApi.getEntityGraph);

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
  Wrapper.displayName = "QueryWrapper";
  return Wrapper;
}

function makeGraphResponse(overrides: Partial<EntityGraphResponse> = {}): EntityGraphResponse {
  return {
    focus_iri: "urn:focus",
    focus_label: "Focus",
    nodes: [
      {
        id: "urn:focus",
        label: "Focus",
        iri: "urn:focus",
        definition: null,
        is_focus: true,
        is_root: false,
        depth: 0,
        node_type: "focus",
        child_count: 2,
      },
      {
        id: "urn:parent",
        label: "Parent",
        iri: "urn:parent",
        definition: null,
        is_focus: false,
        is_root: true,
        depth: 1,
        node_type: "root",
        child_count: 5,
      },
    ],
    edges: [
      {
        id: "subClassOf:urn:focus:urn:parent",
        source: "urn:focus",
        target: "urn:parent",
        edge_type: "subClassOf",
        label: null,
      },
    ],
    truncated: false,
    total_concept_count: 2,
    ...overrides,
  };
}

describe("useGraphData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null graphData when focusIri is null", () => {
    const { result } = renderHook(
      () => useGraphData({ focusIri: null, projectId: "proj-1" }),
      { wrapper: createWrapper() },
    );

    expect(result.current.graphData).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(mockGetEntityGraph).not.toHaveBeenCalled();
  });

  it("fetches graph data when focusIri is provided", async () => {
    const response = makeGraphResponse();
    mockGetEntityGraph.mockResolvedValue(response);

    const { result } = renderHook(
      () => useGraphData({ focusIri: "urn:focus", projectId: "proj-1", branch: "main" }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.graphData).toEqual(response);
    });

    expect(mockGetEntityGraph).toHaveBeenCalledWith("proj-1", "urn:focus", {
      branch: "main",
      ancestorsDepth: 5,
      descendantsDepth: 0,
    }, undefined);
  });

  it("passes descendantsDepth=2 when showDescendants is toggled", async () => {
    const response = makeGraphResponse();
    mockGetEntityGraph.mockResolvedValue(response);

    const { result } = renderHook(
      () => useGraphData({ focusIri: "urn:focus", projectId: "proj-1" }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.graphData).not.toBeNull();
    });

    act(() => {
      result.current.setShowDescendants(true);
    });

    await waitFor(() => {
      expect(mockGetEntityGraph).toHaveBeenCalledWith("proj-1", "urn:focus", {
        branch: undefined,
        ancestorsDepth: 5,
        descendantsDepth: 2,
      }, undefined);
    });
  });

  it("sets graphData to null on API error", async () => {
    mockGetEntityGraph.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(
      () => useGraphData({ focusIri: "urn:focus", projectId: "proj-1" }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.graphData).toBeNull();
  });

  it("merges expanded node data into existing graph", async () => {
    const initial = makeGraphResponse();
    const expansion = makeGraphResponse({
      focus_iri: "urn:parent",
      focus_label: "Parent",
      nodes: [
        {
          id: "urn:parent",
          label: "Parent",
          iri: "urn:parent",
          definition: null,
          is_focus: true,
          is_root: true,
          depth: 0,
          node_type: "focus",
          child_count: 5,
        },
        {
          id: "urn:grandparent",
          label: "GrandParent",
          iri: "urn:grandparent",
          definition: null,
          is_focus: false,
          is_root: true,
          depth: 1,
          node_type: "root",
          child_count: 0,
        },
      ],
      edges: [
        {
          id: "subClassOf:urn:parent:urn:grandparent",
          source: "urn:parent",
          target: "urn:grandparent",
          edge_type: "subClassOf",
          label: null,
        },
      ],
      total_concept_count: 2,
    });

    mockGetEntityGraph
      .mockResolvedValueOnce(initial)
      .mockResolvedValueOnce(expansion);

    const { result } = renderHook(
      () => useGraphData({ focusIri: "urn:focus", projectId: "proj-1" }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.graphData).not.toBeNull();
    });

    act(() => {
      result.current.expandNode("urn:parent");
    });

    await waitFor(() => {
      const nodes = result.current.graphData!.nodes;
      expect(nodes.some((n) => n.id === "urn:grandparent")).toBe(true);
    });

    // Should not duplicate existing nodes
    const nodeIds = result.current.graphData!.nodes.map((n) => n.id);
    const parentCount = nodeIds.filter((id) => id === "urn:parent").length;
    expect(parentCount).toBe(1);
  });

  it("resetGraph clears data and re-fetches baseline", async () => {
    const response = makeGraphResponse();
    mockGetEntityGraph.mockResolvedValue(response);

    const { result } = renderHook(
      () => useGraphData({ focusIri: "urn:focus", projectId: "proj-1" }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.graphData).not.toBeNull();
    });

    const callCountBefore = mockGetEntityGraph.mock.calls.length;

    act(() => {
      result.current.resetGraph();
    });

    expect(result.current.graphData).toBeNull();

    // Should re-fetch the baseline graph
    await waitFor(() => {
      expect(mockGetEntityGraph.mock.calls.length).toBeGreaterThan(callCountBefore);
      expect(result.current.graphData).not.toBeNull();
    });
  });

  it("preserves truncated flag when merging expansion", async () => {
    const initial = makeGraphResponse({ truncated: false });
    const expansion = makeGraphResponse({
      focus_iri: "urn:parent",
      focus_label: "Parent",
      truncated: true,
      nodes: [
        {
          id: "urn:new-node",
          label: "New",
          iri: "urn:new-node",
          definition: null,
          is_focus: false,
          is_root: false,
          depth: 1,
          node_type: "class",
          child_count: 0,
        },
      ],
      edges: [],
      total_concept_count: 1,
    });

    mockGetEntityGraph
      .mockResolvedValueOnce(initial)
      .mockResolvedValueOnce(expansion);

    const { result } = renderHook(
      () => useGraphData({ focusIri: "urn:focus", projectId: "proj-1" }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.graphData).not.toBeNull();
    });

    act(() => {
      result.current.expandNode("urn:parent");
    });

    await waitFor(() => {
      expect(result.current.graphData!.truncated).toBe(true);
    });
  });

  it("skips expandNode when node was already expanded", async () => {
    const initial = makeGraphResponse();
    const expansion = makeGraphResponse({
      focus_iri: "urn:parent",
      nodes: [
        { id: "urn:new", label: "New", iri: "urn:new", definition: null, is_focus: false, is_root: false, depth: 1, node_type: "class", child_count: 0 },
      ],
      edges: [],
      total_concept_count: 1,
    });

    mockGetEntityGraph
      .mockResolvedValueOnce(initial)
      .mockResolvedValueOnce(expansion);

    const { result } = renderHook(
      () => useGraphData({ focusIri: "urn:focus", projectId: "proj-1" }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.graphData).not.toBeNull();
    });

    const callsBefore = mockGetEntityGraph.mock.calls.length;

    // First expand
    act(() => { result.current.expandNode("urn:parent"); });
    await waitFor(() => {
      expect(mockGetEntityGraph.mock.calls.length).toBe(callsBefore + 1);
    });

    // Second expand of same node — should be skipped because expandedNodes.current
    // was updated in the .then() callback, which has resolved by the time waitFor above passed.
    act(() => { result.current.expandNode("urn:parent"); });
    expect(mockGetEntityGraph.mock.calls.length).toBe(callsBefore + 1);
  });

  it("expandNode does nothing when graphData is null", async () => {
    mockGetEntityGraph.mockRejectedValue(new Error("fail"));

    const { result } = renderHook(
      () => useGraphData({ focusIri: "urn:focus", projectId: "proj-1" }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.graphData).toBeNull();
    const callsBefore = mockGetEntityGraph.mock.calls.length;
    act(() => { result.current.expandNode("urn:parent"); });
    expect(mockGetEntityGraph.mock.calls.length).toBe(callsBefore);
  });

  it("reports resolvedCount from node count", async () => {
    const response = makeGraphResponse();
    mockGetEntityGraph.mockResolvedValue(response);

    const { result } = renderHook(
      () => useGraphData({ focusIri: "urn:focus", projectId: "proj-1" }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.resolvedCount).toBe(2);
    });
  });
});
