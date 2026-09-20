import { describe, expect, it } from "vitest";
import { buildGraphFromClassDetail, extractTreeLabelMap } from "@/lib/graph/buildGraphData";
import { computeLayout } from "@/lib/graph/elkLayout";
import type { OWLClassDetail } from "@/lib/api/client";
import type { ClassTreeNode } from "@/lib/ontology/types";

const owl = "http://www.w3.org/2002/07/owl#";
const ns = "https://example.test/";
const detail = (id: string, fields: Partial<OWLClassDetail> = {}): OWLClassDetail => ({
  iri: id, labels: [], comments: [], deprecated: false, parent_iris: [], parent_labels: {},
  equivalent_iris: [], disjoint_iris: [], child_count: 0, instance_count: 0, is_defined: true,
  annotations: [], ...fields,
});
const treeNode = (iri: string, label: string, children: ClassTreeNode[] = []): ClassTreeNode => ({
  iri, label, children, hasChildren: !!children.length, isExpanded: false, isLoading: false,
});

describe("graph builder with actual label and layout dependencies", () => {
  it("resolves labels from details, parent labels, nested trees and local names in precedence order", async () => {
    const hints = extractTreeLabelMap([treeNode(ns + "parent", "Tree parent", [treeNode(ns + "hint", "Nested hint")])]);
    const focus = detail(ns + "focus", {
      labels: [{ value: "Own label", lang: "en" }],
      parent_iris: [ns + "parent", ns + "hint", ns + "fallback"],
      parent_labels: { [ns + "parent"]: "Known parent", [ns + "hint"]: "" },
    });
    const graph = buildGraphFromClassDetail(focus.iri, new Map([[focus.iri, focus]]), hints);
    expect(graph.nodes.map((node) => node.label)).toEqual(["Own label", "Known parent", "Nested hint", "fallback"]);
    const layout = await computeLayout(graph.nodes, graph.edges, "LR");
    expect(layout.size).toBe(4);
    expect(layout.get(ns + "parent")!.x).toBeLessThan(layout.get(focus.iri)!.x);
  });

  it("omits owl:Thing nodes and edges while distinguishing external and typed references", () => {
    const focus = detail(ns + "focus", {
      parent_iris: [owl + "Thing"],
      equivalent_iris: [owl + "Nothing", ns + "property", ns + "individual"],
    });
    const graph = buildGraphFromClassDetail(focus.iri, new Map([[focus.iri, focus]]), undefined,
      new Map([[ns + "property", "property"], [ns + "individual", "individual"]]));
    expect(graph.nodes.map((node) => [node.id, node.nodeType])).toEqual([
      [focus.iri, "focus"], [owl + "Nothing", "external"], [ns + "property", "property"], [ns + "individual", "individual"],
    ]);
    expect(graph.edges.some((edge) => edge.target === owl + "Thing")).toBe(false);
  });

  it("deduplicates repeated edges while preserving different relationship kinds", () => {
    const focus = detail(ns + "focus", {
      parent_iris: [ns + "target", ns + "target"], equivalent_iris: [ns + "target"], disjoint_iris: [ns + "target"],
      // The reader also accepts legacy wire-format strings despite the narrower API type.
      annotations: [
        { property_iri: "http://www.w3.org/2000/01/rdf-schema#seeAlso", property_label: "see also", values: [ns + "target", { value: ns + "target", lang: "" }, "not a URL"] },
        { property_iri: "http://www.w3.org/2000/01/rdf-schema#isDefinedBy", property_label: "defined by", values: [ns + "target"] },
      ] as unknown as OWLClassDetail["annotations"],
    });
    const graph = buildGraphFromClassDetail(focus.iri, new Map([[focus.iri, focus]]));
    expect(graph.nodes).toHaveLength(2);
    expect(graph.edges.map((edge) => edge.edgeType)).toEqual(["subClassOf", "equivalentClass", "disjointWith", "seeAlso"]);
  });

  it("caps sibling fanout without losing the focus or leaving dangling edges", async () => {
    const parent = detail(ns + "parent");
    const siblings = Array.from({ length: 24 }, (_, index) => detail(ns + `child${index}`, { parent_iris: [parent.iri] }));
    const focus = siblings[23];
    const nodes = new Map([parent, ...siblings].map((node) => [node.iri, node]));
    const graph = buildGraphFromClassDetail(focus.iri, nodes);
    expect(graph.edges).toHaveLength(21);
    expect(graph.nodes).toHaveLength(22);
    expect(graph.nodes.some((node) => node.id === focus.iri)).toBe(true);
    expect(graph.nodes.some((node) => node.id === siblings[22].iri)).toBe(false);
    const positions = await computeLayout(graph.nodes, graph.edges);
    expect(positions.size).toBe(graph.nodes.length);
    for (const edge of graph.edges) expect(positions.has(edge.source) && positions.has(edge.target)).toBe(true);
  });

  it("lays out an empty graph and a missing focus without invented relationships", async () => {
    expect(await computeLayout([], [])).toEqual(new Map());
    const graph = buildGraphFromClassDetail(ns + "missing", new Map());
    expect(graph.nodes).toEqual([expect.objectContaining({ id: ns + "missing", nodeType: "focus", label: "missing", isExpanded: false })]);
    expect(graph.edges).toEqual([]);
    expect((await computeLayout(graph.nodes, graph.edges)).size).toBe(1);
  });

  it("propagates a layout error when an edge references an absent node", async () => {
    await expect(computeLayout([{ id: "present", label: "Present", nodeType: "focus" }], [
      { id: "broken", source: "present", target: "missing", edgeType: "subClassOf" },
    ])).rejects.toThrow();
  });
});
