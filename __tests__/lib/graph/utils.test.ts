import { describe, expect, it } from "vitest";
import { extractTreeLabelMap } from "@/lib/graph/utils";
import type { ClassTreeNode } from "@/lib/ontology/types";

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

  it("returns empty map for empty input", () => {
    const map = extractTreeLabelMap([]);
    expect(map.size).toBe(0);
  });
});
