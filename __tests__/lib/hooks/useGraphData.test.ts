import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useGraphData } from "@/lib/hooks/useGraphData";

// Mock API and graph builder
vi.mock("@/lib/api/client", () => ({
  projectOntologyApi: {
    getClassDetail: vi.fn(),
    getClassAncestors: vi.fn(),
    searchEntities: vi.fn(),
  },
}));

vi.mock("@/lib/graph/buildGraphData", () => ({
  buildGraphFromClassDetail: vi.fn(),
  getSeeAlsoIris: vi.fn().mockReturnValue([]),
}));

vi.mock("@/lib/utils", () => ({
  getLocalName: vi.fn((iri: string) => {
    const hash = iri.lastIndexOf("#");
    if (hash >= 0) return iri.slice(hash + 1);
    const slash = iri.lastIndexOf("/");
    if (slash >= 0) return iri.slice(slash + 1);
    return iri;
  }),
}));

import { projectOntologyApi } from "@/lib/api/client";
import { buildGraphFromClassDetail } from "@/lib/graph/buildGraphData";

const mockedGetClassDetail = projectOntologyApi.getClassDetail as ReturnType<typeof vi.fn>;
const mockedGetClassAncestors = projectOntologyApi.getClassAncestors as ReturnType<typeof vi.fn>;
const mockedBuildGraph = buildGraphFromClassDetail as ReturnType<typeof vi.fn>;

function makeDetail(iri: string, parentIris: string[] = []) {
  return {
    iri,
    labels: [{ value: iri.split("/").pop() || iri, lang: "en" }],
    comments: [],
    parent_iris: parentIris,
    annotations: [],
    deprecated: false,
    equivalent_iris: [],
    disjoint_iris: [],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedBuildGraph.mockReturnValue({
    nodes: [{ id: "http://example.org/A", label: "A", nodeType: "focus" }],
    edges: [],
  });
  mockedGetClassAncestors.mockResolvedValue({ nodes: [] });
});

describe("useGraphData", () => {
  it("returns null graphData when focusIri is null", () => {
    const { result } = renderHook(() =>
      useGraphData({
        focusIri: null,
        projectId: "proj-1",
        accessToken: "token",
      }),
    );

    expect(result.current.graphData).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it("returns null graphData when accessToken is missing", () => {
    const { result } = renderHook(() =>
      useGraphData({
        focusIri: "http://example.org/A",
        projectId: "proj-1",
      }),
    );

    expect(result.current.graphData).toBeNull();
  });

  it("fetches focus node and builds graph", async () => {
    const detail = makeDetail("http://example.org/A");
    mockedGetClassDetail.mockResolvedValue(detail);

    const { result } = renderHook(() =>
      useGraphData({
        focusIri: "http://example.org/A",
        projectId: "proj-1",
        accessToken: "token",
      }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockedGetClassDetail).toHaveBeenCalledWith(
      "proj-1",
      "http://example.org/A",
      "token",
      undefined,
    );
    expect(mockedBuildGraph).toHaveBeenCalled();
    expect(result.current.graphData).not.toBeNull();
  });

  it("fetches parent nodes at depth 1", async () => {
    const detailA = makeDetail("http://example.org/A", ["http://example.org/B"]);
    const detailB = makeDetail("http://example.org/B");

    mockedGetClassDetail
      .mockResolvedValueOnce(detailA) // focus node
      .mockResolvedValueOnce(detailB); // parent node

    const { result } = renderHook(() =>
      useGraphData({
        focusIri: "http://example.org/A",
        projectId: "proj-1",
        accessToken: "token",
      }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockedGetClassDetail).toHaveBeenCalledTimes(2);
  });

  it("handles fetch errors for focus node gracefully", async () => {
    mockedGetClassDetail.mockRejectedValue(new Error("Not found"));

    const { result } = renderHook(() =>
      useGraphData({
        focusIri: "http://example.org/A",
        projectId: "proj-1",
        accessToken: "token",
      }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Should still build a graph (single-node graph fallback)
    expect(mockedBuildGraph).toHaveBeenCalled();
  });

  it("expandNode fetches detail and rebuilds graph", async () => {
    const detailA = makeDetail("http://example.org/A");
    const detailB = makeDetail("http://example.org/B");

    mockedGetClassDetail
      .mockResolvedValueOnce(detailA) // initial load
      .mockResolvedValueOnce(detailB); // expand node

    const { result } = renderHook(() =>
      useGraphData({
        focusIri: "http://example.org/A",
        projectId: "proj-1",
        accessToken: "token",
      }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    mockedBuildGraph.mockClear();

    await act(async () => {
      result.current.expandNode("http://example.org/B");
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockedBuildGraph).toHaveBeenCalled();
  });

  it("resetGraph clears the graph data", async () => {
    mockedGetClassDetail.mockResolvedValue(
      makeDetail("http://example.org/A"),
    );

    const { result } = renderHook(() =>
      useGraphData({
        focusIri: "http://example.org/A",
        projectId: "proj-1",
        accessToken: "token",
      }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.graphData).not.toBeNull();

    act(() => {
      result.current.resetGraph();
    });

    expect(result.current.graphData).toBeNull();
    expect(result.current.resolvedCount).toBe(0);
  });

  it("passes branch to API calls", async () => {
    mockedGetClassDetail.mockResolvedValue(
      makeDetail("http://example.org/A"),
    );

    const { result } = renderHook(() =>
      useGraphData({
        focusIri: "http://example.org/A",
        projectId: "proj-1",
        accessToken: "token",
        branch: "dev",
      }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockedGetClassDetail).toHaveBeenCalledWith(
      "proj-1",
      "http://example.org/A",
      "token",
      "dev",
    );
  });
});
