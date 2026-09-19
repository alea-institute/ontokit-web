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

  it("resolves non-class targets by exact IRI and keeps caller label hints", async () => {
    const hints = new Map([[iri("Property"), "Preferred label"]]);
    serveGraph([detail("Focus", { equivalent_iris: [iri("Property"), iri("Individual")] })], {
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
  });

  it("expands newly discovered neighbors without retrying failed class lookups", async () => {
    const calls = serveGraph([
      detail("Focus"), detail("Expansion", { parent_iris: [iri("Root")], disjoint_iris: [iri("Missing")] }), detail("Root"),
    ]);
    const { result } = renderHook(() => useGraphData({ ...options, focusIri: iri("Focus") }));
    await waitFor(() => expect(result.current.resolvedCount).toBe(1));
    await act(async () => { await result.current.expandNode(iri("Expansion")); });
    expect(result.current.resolvedCount).toBe(3);
    await act(async () => { await result.current.expandNode(iri("Missing")); });
    expect(calls.filter((url) => url.pathname.endsWith(`/classes/${encodeURIComponent(iri("Missing"))}`))).toHaveLength(1);
    expect(result.current.graphData?.edges).toContainEqual(expect.objectContaining({ source: iri("Expansion"), target: iri("Root"), edgeType: "subClassOf" }));
  });

  it("supports the empty lifecycle without mocks or a transport", async () => {
    const { result } = renderHook(() => useGraphData({ projectId: "empty", focusIri: null }));
    await act(async () => { await result.current.expandNode(iri("Anything")); });
    act(() => result.current.resetGraph());
    expect(result.current).toMatchObject({ graphData: null, resolvedCount: 0, isLoading: false });
  });
});
