import { describe, expect, it } from "vitest";
import {
  getSeeAlsoIris,
  extractTreeLabelMap,
  buildGraphFromClassDetail,
} from "@/lib/graph/buildGraphData";
import type { OWLClassDetail } from "@/lib/api/client";
import type { ClassTreeNode } from "@/lib/ontology/types";

/** Helper to build a minimal OWLClassDetail for testing. */
function makeClassDetail(overrides: Partial<OWLClassDetail> = {}): OWLClassDetail {
  return {
    iri: "urn:test",
    labels: [],
    comments: [],
    deprecated: false,
    parent_iris: [],
    parent_labels: {},
    equivalent_iris: [],
    disjoint_iris: [],
    child_count: 0,
    instance_count: 0,
    is_defined: false,
    annotations: [],
    ...overrides,
  };
}

// ─── getSeeAlsoIris ─────────────────────────────────────────────

describe("getSeeAlsoIris", () => {
  it("extracts seeAlso HTTP/HTTPS IRIs from annotations", () => {
    const detail = makeClassDetail({
      annotations: [
        {
          property_iri: "http://www.w3.org/2000/01/rdf-schema#seeAlso",
          property_label: "seeAlso",
          values: [
            { value: "https://example.org/related", lang: "" },
            { value: "http://example.org/other", lang: "" },
          ],
        },
      ],
    });

    expect(getSeeAlsoIris(detail)).toEqual([
      "https://example.org/related",
      "http://example.org/other",
    ]);
  });

  it("ignores non-URL values", () => {
    const detail = makeClassDetail({
      annotations: [
        {
          property_iri: "http://www.w3.org/2000/01/rdf-schema#seeAlso",
          property_label: "seeAlso",
          values: [
            { value: "just some text", lang: "" },
            { value: "urn:not-http", lang: "" },
          ],
        },
      ],
    });

    expect(getSeeAlsoIris(detail)).toEqual([]);
  });

  it("returns empty array when no seeAlso annotations", () => {
    const detail = makeClassDetail({
      annotations: [
        {
          property_iri: "http://www.w3.org/2000/01/rdf-schema#label",
          property_label: "label",
          values: [{ value: "Test", lang: "en" }],
        },
      ],
    });

    expect(getSeeAlsoIris(detail)).toEqual([]);
  });
});

// ─── extractTreeLabelMap ────────────────────────────────────────

describe("extractTreeLabelMap", () => {
  it("builds IRI→label map from flat list", () => {
    const nodes: ClassTreeNode[] = [
      {
        iri: "urn:a",
        label: "Alpha",
        children: [],
        isExpanded: false,
        isLoading: false,
        hasChildren: false,
      },
      {
        iri: "urn:b",
        label: "Beta",
        children: [],
        isExpanded: false,
        isLoading: false,
        hasChildren: false,
      },
    ];

    const map = extractTreeLabelMap(nodes);

    expect(map.get("urn:a")).toBe("Alpha");
    expect(map.get("urn:b")).toBe("Beta");
    expect(map.size).toBe(2);
  });

  it("walks nested children recursively", () => {
    const nodes: ClassTreeNode[] = [
      {
        iri: "urn:parent",
        label: "Parent",
        children: [
          {
            iri: "urn:child",
            label: "Child",
            children: [
              {
                iri: "urn:grandchild",
                label: "GrandChild",
                children: [],
                isExpanded: false,
                isLoading: false,
                hasChildren: false,
              },
            ],
            isExpanded: false,
            isLoading: false,
            hasChildren: true,
          },
        ],
        isExpanded: false,
        isLoading: false,
        hasChildren: true,
      },
    ];

    const map = extractTreeLabelMap(nodes);

    expect(map.size).toBe(3);
    expect(map.get("urn:grandchild")).toBe("GrandChild");
  });

  it("skips nodes without labels", () => {
    const nodes: ClassTreeNode[] = [
      {
        iri: "urn:labelled",
        label: "Has Label",
        children: [],
        isExpanded: false,
        isLoading: false,
        hasChildren: false,
      },
      {
        iri: "urn:unlabelled",
        label: "",
        children: [],
        isExpanded: false,
        isLoading: false,
        hasChildren: false,
      },
    ];

    const map = extractTreeLabelMap(nodes);

    expect(map.has("urn:labelled")).toBe(true);
    expect(map.has("urn:unlabelled")).toBe(false);
  });
});

// ─── buildGraphFromClassDetail ──────────────────────────────────

describe("buildGraphFromClassDetail", () => {
  it("always includes the focus node in output", () => {
    const focusIri = "urn:focus";
    const resolved = new Map([
      [focusIri, makeClassDetail({ iri: focusIri, labels: [{ value: "Focus", lang: "" }] })],
    ]);

    const result = buildGraphFromClassDetail(focusIri, resolved);

    const focusNode = result.nodes.find((n) => n.id === focusIri);
    expect(focusNode).toBeDefined();
    expect(focusNode!.nodeType).toBe("focus");
  });

  it("preserves nodes connected by edges", () => {
    const focusIri = "urn:focus";
    const parentIri = "urn:parent";
    const resolved = new Map([
      [
        focusIri,
        makeClassDetail({
          iri: focusIri,
          parent_iris: [parentIri],
          labels: [{ value: "Focus", lang: "" }],
        }),
      ],
    ]);

    const result = buildGraphFromClassDetail(focusIri, resolved);

    expect(result.nodes.some((n) => n.id === parentIri)).toBe(true);
    expect(result.edges.some((e) => e.source === focusIri && e.target === parentIri)).toBe(true);
  });

  it("prunes nodes orphaned by child-cap filtering", () => {
    const focusIri = "urn:focus";
    const parentIri = "urn:parent";

    // Create a parent with more than 20 children (child-cap = 20)
    // The focus + 20 other children = 21 total → last one gets pruned
    const childDetails: [string, OWLClassDetail][] = [];
    for (let i = 0; i < 21; i++) {
      const childIri = `urn:child-${i}`;
      childDetails.push([
        childIri,
        makeClassDetail({
          iri: childIri,
          parent_iris: [parentIri],
          labels: [{ value: `Child ${i}`, lang: "" }],
        }),
      ]);
    }

    // Insert focus AFTER the 21 siblings so it's not kept just by insertion order
    const resolved = new Map<string, OWLClassDetail>([
      ...childDetails,
      [
        focusIri,
        makeClassDetail({
          iri: focusIri,
          parent_iris: [parentIri],
          labels: [{ value: "Focus", lang: "" }],
        }),
      ],
    ]);

    const result = buildGraphFromClassDetail(focusIri, resolved);

    // At most 20 capped siblings + the focus edge (always preserved)
    const subClassEdges = result.edges.filter(
      (e) => e.target === parentIri && e.edgeType === "subClassOf",
    );
    expect(subClassEdges.length).toBeLessThanOrEqual(21);

    // Pruned children should not appear in nodes
    const nodeIds = new Set(result.nodes.map((n) => n.id));
    const orphanedChildren = childDetails
      .map(([iri]) => iri)
      .filter((iri) => !subClassEdges.some((e) => e.source === iri));

    for (const orphan of orphanedChildren) {
      // Orphaned children (not connected by any edge) are pruned unless they're the focus
      if (orphan !== focusIri) {
        expect(nodeIds.has(orphan)).toBe(false);
      }
    }

    // The focus node's edge to its parent must survive the cap
    expect(
      result.edges.some((e) => e.source === focusIri && e.target === parentIri),
    ).toBe(true);
  });

  it("excludes owl:Thing from nodes and edges", () => {
    const focusIri = "urn:focus";
    const owlThing = "http://www.w3.org/2002/07/owl#Thing";

    const resolved = new Map([
      [
        focusIri,
        makeClassDetail({
          iri: focusIri,
          parent_iris: [owlThing],
          labels: [{ value: "Focus", lang: "" }],
        }),
      ],
    ]);

    const result = buildGraphFromClassDetail(focusIri, resolved);

    expect(result.nodes.some((n) => n.id === owlThing)).toBe(false);
    expect(result.edges.some((e) => e.source === owlThing || e.target === owlThing)).toBe(false);
  });
});
