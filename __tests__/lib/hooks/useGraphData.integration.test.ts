import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { useGraphData } from "@/lib/hooks/useGraphData";
import type { OWLClassDetail } from "@/lib/api/client";
import { computeLayout } from "@/lib/graph/elkLayout";

const ns = "https://example.test/";
const iri = (name: string) => ns + name;
const detail = (name: string, overrides: Partial<OWLClassDetail> = {}): OWLClassDetail => ({
  iri: iri(name), labels: [{ value: name, lang: "en" }], comments: [],
  parent_iris: [], annotations: [], deprecated: false, equivalent_iris: [], disjoint_iris: [],
  ...overrides,
} as OWLClassDetail);
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

function serveGraph(
  details: OWLClassDetail[],
  options: { ancestors?: Record<string, string[]>; search?: Record<string, { iri: string; label: string; entity_type: string }[]>; failSearch?: boolean; failAncestors?: boolean } = {},
) {
  const byIri = new Map(details.map((entry) => [entry.iri, entry]));
  const calls: URL[] = [];
  vi.stubGlobal("fetch", async (input: string, init: RequestInit) => {
    const url = new URL(input);
    calls.push(url);
    expect(url.searchParams.get("branch")).toBe("work/graph");
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer test-token");
    if (url.pathname.includes("/classes/")) {
      const target = decodeURIComponent(url.pathname.split("/classes/")[1]);
      return byIri.has(target) ? response(byIri.get(target)) : response({ detail: "Not a class" }, 404);
    }
    if (url.pathname.endsWith("/ancestors")) {
      if (options.failAncestors) return response({ detail: "Forbidden" }, 403);
      const target = decodeURIComponent(url.pathname.split("/tree/")[1].replace(/\/ancestors$/, ""));
      return response({ nodes: (options.ancestors?.[target] ?? []).map((value) => ({ iri: value })) });
    }
    if (url.pathname.endsWith("/search")) {
      if (options.failSearch) return response({ detail: "Forbidden" }, 403);
      return response({ results: options.search?.[url.searchParams.get("q")!] ?? [] });
    }
    throw new Error(`Unexpected test request ${url.pathname}`);
  });
  return calls;
}
const options = { projectId: "graph-project", accessToken: "test-token", branch: "work/graph" };
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("graph loading with the real API client, graph builder and layout engine", () => {
  it("resolves a root discovered only by ancestry beyond the initial detail passes", async () => {
    const calls = serveGraph([
      detail("Focus", { parent_iris: [iri("Parent")] }),
      detail("Parent", { parent_iris: [iri("Grandparent")] }),
      detail("Grandparent", { parent_iris: [iri("Root")] }),
      detail("Root"),
    ], { ancestors: { [iri("Focus")]: [iri("Parent"), iri("Grandparent"), iri("Root")] } });
    const { result } = renderHook(() => useGraphData({ ...options, focusIri: iri("Focus"), initialDepth: 1 }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.resolvedCount).toBe(4);
    expect(result.current.graphData?.nodes).toContainEqual(expect.objectContaining({ id: iri("Root"), label: "Root", nodeType: "root" }));
    expect(result.current.graphData?.edges).toContainEqual(expect.objectContaining({ source: iri("Grandparent"), target: iri("Root"), edgeType: "subClassOf" }));
    const rootRequest = calls.findIndex(url => url.pathname.endsWith(`/classes/${encodeURIComponent(iri("Root"))}`));
    const ancestryRequest = calls.findIndex(url => url.pathname.endsWith("/ancestors"));
    expect(ancestryRequest).toBeGreaterThan(-1);
    expect(rootRequest).toBeGreaterThan(ancestryRequest);
    expect(calls.filter(url => url.pathname.endsWith(`/classes/${encodeURIComponent(iri("Root"))}`))).toHaveLength(1);
  });

  it("loads ancestry and all relationship types, then produces an actual ELK layout", async () => {
    serveGraph([
      detail("Focus", { parent_iris: [iri("Parent")], equivalent_iris: [iri("Equivalent")], disjoint_iris: [iri("Disjoint")], annotations: [{ property_iri: "http://www.w3.org/2000/01/rdf-schema#seeAlso", property_label: "see also", values: [{ value: iri("Reference"), lang: "" }] }] }),
      detail("Parent", { parent_iris: [iri("Root")] }), detail("Root"), detail("Equivalent"), detail("Disjoint"), detail("Reference"),
    ]);
    const { result } = renderHook(() => useGraphData({ ...options, focusIri: iri("Focus") }));
    await waitFor(() => expect(result.current.resolvedCount).toBe(6));
    const graph = result.current.graphData!;
    expect(graph.edges.map((edge) => edge.edgeType)).toEqual(expect.arrayContaining(["subClassOf", "equivalentClass", "disjointWith", "seeAlso"]));
    expect(graph.nodes.find((node) => node.id === iri("Root"))?.nodeType).toBe("root");
    const positions = await computeLayout(graph.nodes, graph.edges);
    expect(positions.size).toBe(6);
    for (const point of positions.values()) {
      expect(Number.isFinite(point.x)).toBe(true);
      expect(Number.isFinite(point.y)).toBe(true);
    }
    expect(positions.get(iri("Root"))!.y).toBeLessThan(positions.get(iri("Focus"))!.y);
  });

  it("reuses already resolved targets across reciprocal and overlapping relationships", async () => {
    const reference = [{ property_iri: "http://www.w3.org/2000/01/rdf-schema#seeAlso", property_label: "see also", values: [{ value: iri("Reference"), lang: "" }] }];
    const calls = serveGraph([
      detail("Focus", { parent_iris: [iri("Parent")], equivalent_iris: [iri("Equivalent")], disjoint_iris: [iri("Disjoint")], annotations: reference }),
      detail("Equivalent", { parent_iris: [iri("Parent")], equivalent_iris: [iri("Focus")], disjoint_iris: [iri("Disjoint")], annotations: reference }),
      detail("Parent"), detail("Disjoint"), detail("Reference"),
    ]);
    const { result } = renderHook(() => useGraphData({ ...options, focusIri: iri("Focus") }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.resolvedCount).toBe(5);
    expect(result.current.graphData?.nodes.map(node => node.id).sort()).toEqual(["Focus", "Equivalent", "Parent", "Disjoint", "Reference"].map(iri).sort());
    expect(result.current.graphData?.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: iri("Equivalent"), target: iri("Parent"), edgeType: "subClassOf" }),
      expect.objectContaining({ source: iri("Equivalent"), target: iri("Reference"), edgeType: "seeAlso" }),
    ]));
    await act(async () => { await result.current.expandNode(iri("Equivalent")); });
    const detailRequests = calls.filter(url => url.pathname.includes("/classes/"));
    expect(detailRequests).toHaveLength(5);
    expect(new Set(detailRequests.map(url => url.pathname)).size).toBe(5);
    expect(result.current.graphData?.nodes).toHaveLength(5);
  });

  it("resolves non-class targets by exact IRI and keeps caller label hints", async () => {
    const hints = new Map([[iri("Property"), "Preferred label"]]);
    const calls = serveGraph([detail("Focus", { equivalent_iris: [iri("Property"), iri("Individual")] }), detail("Expansion", { parent_iris: [iri("Focus")] })], {
      search: {
        Property: [{ iri: iri("Other"), label: "Wrong hit", entity_type: "class" }, { iri: iri("Property"), label: "Server label", entity_type: "property" }],
        Individual: [{ iri: iri("Individual"), label: "", entity_type: "individual" }],
      },
    });
    const { result } = renderHook(() => useGraphData({ ...options, focusIri: iri("Focus"), labelHints: hints }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.graphData?.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: iri("Property"), label: "Preferred label", nodeType: "property" }),
      expect.objectContaining({ id: iri("Individual"), label: "Individual", nodeType: "individual" }),
    ]));
    expect(hints.size).toBe(1);
    const searches = calls.filter(url => url.pathname.endsWith("/search")).map(url => url.toString());
    expect(searches).toHaveLength(2);
    await act(async () => { await result.current.expandNode(iri("Expansion")); });
    expect(result.current.graphData?.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: iri("Expansion"), nodeType: "class" }),
      expect.objectContaining({ id: iri("Property"), label: "Preferred label", nodeType: "property" }),
      expect.objectContaining({ id: iri("Individual"), label: "Individual", nodeType: "individual" }),
    ]));
    expect(calls.filter(url => url.pathname.endsWith("/search")).map(url => url.toString())).toEqual(searches);
    expect(calls.filter(url => url.pathname.endsWith(`/classes/${encodeURIComponent(iri("Property"))}`))).toHaveLength(1);
    expect(calls.filter(url => url.pathname.endsWith(`/classes/${encodeURIComponent(iri("Individual"))}`))).toHaveLength(1);
  });

  it("keeps useful unresolved nodes when ancestry and search fail", async () => {
    serveGraph([detail("Focus", { parent_iris: [iri("Missing")] })], { failSearch: true, failAncestors: true });
    const { result } = renderHook(() => useGraphData({ ...options, focusIri: iri("Focus") }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.resolvedCount).toBe(1);
    expect(result.current.graphData?.nodes).toContainEqual(expect.objectContaining({ id: iri("Missing"), label: "Missing", nodeType: "unexplored" }));
  });

  it("fetches ancestors beyond the initial neighbor pass and resets the graph", async () => {
    serveGraph([detail("Focus", { parent_iris: [iri("Parent")] }), detail("Parent", { parent_iris: [iri("Root")] }), detail("Root")], { ancestors: { [iri("Focus")]: [iri("Root")] } });
    const { result } = renderHook(() => useGraphData({ ...options, focusIri: iri("Focus"), initialDepth: 1 }));
    await waitFor(() => expect(result.current.resolvedCount).toBe(3));
    act(() => result.current.resetGraph());
    expect(result.current.graphData).toBeNull();
    expect(result.current.resolvedCount).toBe(0);
    await waitFor(() => expect(result.current.resolvedCount).toBe(3));
  });

  it("retries a failed class lookup only on explicit expansion", async () => {
    const calls = serveGraph([
      detail("Focus"), detail("Expansion", { parent_iris: [iri("Root")], disjoint_iris: [iri("Missing")] }), detail("Root"),
    ]);
    const { result } = renderHook(() => useGraphData({ ...options, focusIri: iri("Focus") }));
    await waitFor(() => expect(result.current.resolvedCount).toBe(1));
    await act(async () => { await result.current.expandNode(iri("Expansion")); });
    expect(result.current.resolvedCount).toBe(3);
    await act(async () => { await result.current.expandNode(iri("Missing")); });
    expect(calls.filter((url) => url.pathname.endsWith(`/classes/${encodeURIComponent(iri("Missing"))}`))).toHaveLength(2);
    expect(result.current.graphData?.edges).toContainEqual(expect.objectContaining({ source: iri("Expansion"), target: iri("Root"), edgeType: "subClassOf" }));
  });

  it("supports the empty lifecycle without mocks or a transport", async () => {
    const { result } = renderHook(() => useGraphData({ projectId: "empty", focusIri: null }));
    await act(async () => { await result.current.expandNode(iri("Anything")); });
    act(() => result.current.resetGraph());
    expect(result.current).toMatchObject({ graphData: null, resolvedCount: 0, isLoading: false });
  });

  it("follows secondary equivalence, disjoint and reference targets without losing relationship labels", async () => {
    serveGraph([
      detail("Focus", { parent_iris: [iri("Parent")] }),
      detail("Parent", { equivalent_iris: [iri("Equivalent")], disjoint_iris: [iri("Disjoint")], annotations: [{ property_iri: "http://www.w3.org/2000/01/rdf-schema#seeAlso", property_label: "see also", values: [{ value: iri("Reference"), lang: "" }] }] }),
      detail("Equivalent"), detail("Disjoint"), detail("Reference"),
    ]);
    const { result } = renderHook(() => useGraphData({ ...options, focusIri: iri("Focus") }));
    await waitFor(() => expect(result.current.resolvedCount).toBe(5));
    expect(result.current.graphData?.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: iri("Parent"), target: iri("Equivalent"), edgeType: "equivalentClass" }),
      expect.objectContaining({ source: iri("Parent"), target: iri("Disjoint"), edgeType: "disjointWith" }),
      expect.objectContaining({ source: iri("Parent"), target: iri("Reference"), edgeType: "seeAlso" }),
    ]));
  });

  it("reuses a cached class on expansion and resolves new second-order targets", async () => {
    const calls = serveGraph([
      detail("Focus"), detail("Expansion", { parent_iris: [iri("Parent")] }),
      detail("Parent", { parent_iris: [iri("Root")] }), detail("Root"),
    ]);
    const { result } = renderHook(() => useGraphData({ ...options, focusIri: iri("Focus") }));
    await waitFor(() => expect(result.current.resolvedCount).toBe(1));
    await act(async () => { await result.current.expandNode(iri("Expansion")); });
    expect(result.current.resolvedCount).toBe(4);
    await act(async () => { await result.current.expandNode(iri("Expansion")); });
    expect(calls.filter(url => url.pathname.endsWith(`/classes/${encodeURIComponent(iri("Expansion"))}`))).toHaveLength(1);
  });

  it("bounds ancestry requests and refuses additional expansion once one hundred classes are resolved", async () => {
    const names = Array.from({ length: 99 }, (_, index) => `Parent${index}`);
    const calls = serveGraph([detail("Focus", { parent_iris: names.map(iri) }), ...names.map(name => detail(name))]);
    const { result } = renderHook(() => useGraphData({ ...options, focusIri: iri("Focus") }));
    await waitFor(() => expect(result.current.resolvedCount).toBe(100));
    expect(calls.filter(url => url.pathname.endsWith('/ancestors'))).toHaveLength(50);
    await act(async () => { await result.current.expandNode(iri("OverLimit")); });
    expect(result.current.resolvedCount).toBe(100);
    expect(calls.some(url => url.pathname.endsWith(`/classes/${encodeURIComponent(iri("OverLimit"))}`))).toBe(false);
  });

});
