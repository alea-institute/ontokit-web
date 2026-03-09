import { describe, expect, it } from "vitest";
import { mergePathsIntoTree, type AncestorPath } from "@/lib/hooks/useFilteredTree";

describe("mergePathsIntoTree", () => {
  it("builds correct parent→child chain from a single path", () => {
    const paths: AncestorPath[] = [
      {
        matchIri: "urn:leaf",
        matchLabel: "Leaf",
        ancestors: [
          { iri: "urn:root", label: "Root", child_count: 1 },
          { iri: "urn:mid", label: "Mid", child_count: 1 },
        ],
      },
    ];

    const tree = mergePathsIntoTree(paths);

    expect(tree).toHaveLength(1);
    expect(tree[0].iri).toBe("urn:root");
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].iri).toBe("urn:mid");
    expect(tree[0].children[0].children).toHaveLength(1);
    expect(tree[0].children[0].children[0].iri).toBe("urn:leaf");
  });

  it("marks match node with isSearchMatch and ancestors without", () => {
    const paths: AncestorPath[] = [
      {
        matchIri: "urn:match",
        matchLabel: "Match",
        ancestors: [{ iri: "urn:ancestor", label: "Ancestor", child_count: 1 }],
      },
    ];

    const tree = mergePathsIntoTree(paths);

    expect(tree[0].isSearchMatch).toBeFalsy();
    expect(tree[0].children[0].isSearchMatch).toBe(true);
  });

  it("sets all nodes as expanded", () => {
    const paths: AncestorPath[] = [
      {
        matchIri: "urn:leaf",
        matchLabel: "Leaf",
        ancestors: [{ iri: "urn:root", label: "Root", child_count: 1 }],
      },
    ];

    const tree = mergePathsIntoTree(paths);

    expect(tree[0].isExpanded).toBe(true);
    expect(tree[0].children[0].isExpanded).toBe(true);
  });

  it("merges hasChildren when a node reappears as an ancestor", () => {
    // First path: urn:node is the match (hasChildren defaults to false)
    // Second path: urn:node is an ancestor (child_count > 0 → hasChildren: true)
    const paths: AncestorPath[] = [
      {
        matchIri: "urn:node",
        matchLabel: "Node",
        ancestors: [{ iri: "urn:root", label: "Root", child_count: 2 }],
      },
      {
        matchIri: "urn:child",
        matchLabel: "Child",
        ancestors: [
          { iri: "urn:root", label: "Root", child_count: 2 },
          { iri: "urn:node", label: "Node", child_count: 3 },
        ],
      },
    ];

    const tree = mergePathsIntoTree(paths);

    // urn:node should have hasChildren: true (merged from the second path)
    const nodeEntry = tree[0].children.find((c) => c.iri === "urn:node");
    expect(nodeEntry).toBeDefined();
    expect(nodeEntry!.hasChildren).toBe(true);
    // It should also be marked as a search match
    expect(nodeEntry!.isSearchMatch).toBe(true);
  });

  it("deduplicates nodes across overlapping ancestor paths", () => {
    const paths: AncestorPath[] = [
      {
        matchIri: "urn:a",
        matchLabel: "A",
        ancestors: [{ iri: "urn:root", label: "Root", child_count: 2 }],
      },
      {
        matchIri: "urn:b",
        matchLabel: "B",
        ancestors: [{ iri: "urn:root", label: "Root", child_count: 2 }],
      },
    ];

    const tree = mergePathsIntoTree(paths);

    // Single root with two children
    expect(tree).toHaveLength(1);
    expect(tree[0].iri).toBe("urn:root");
    expect(tree[0].children).toHaveLength(2);
    const childIris = tree[0].children.map((c) => c.iri).sort();
    expect(childIris).toEqual(["urn:a", "urn:b"]);
  });

  it("makes the first node in each path a root", () => {
    const paths: AncestorPath[] = [
      {
        matchIri: "urn:leaf1",
        matchLabel: "L1",
        ancestors: [{ iri: "urn:root1", label: "R1", child_count: 1 }],
      },
      {
        matchIri: "urn:leaf2",
        matchLabel: "L2",
        ancestors: [{ iri: "urn:root2", label: "R2", child_count: 1 }],
      },
    ];

    const tree = mergePathsIntoTree(paths);

    expect(tree).toHaveLength(2);
    const rootIris = tree.map((n) => n.iri).sort();
    expect(rootIris).toEqual(["urn:root1", "urn:root2"]);
  });

  it("treats a match with no ancestors as a root node", () => {
    const paths: AncestorPath[] = [
      {
        matchIri: "urn:orphan",
        matchLabel: "Orphan",
        ancestors: [],
      },
    ];

    const tree = mergePathsIntoTree(paths);

    expect(tree).toHaveLength(1);
    expect(tree[0].iri).toBe("urn:orphan");
    expect(tree[0].isSearchMatch).toBe(true);
    expect(tree[0].children).toHaveLength(0);
  });

  it("does not duplicate a node as root when ancestor fetch fails but another path attaches it as child", () => {
    // Path 1: urn:child has ancestors (attached under urn:root)
    // Path 2: urn:child has empty ancestors (failed fetch) — should NOT become a second root
    const paths: AncestorPath[] = [
      {
        matchIri: "urn:child",
        matchLabel: "Child",
        ancestors: [{ iri: "urn:root", label: "Root", child_count: 1 }],
      },
      {
        matchIri: "urn:child",
        matchLabel: "Child",
        ancestors: [],
      },
    ];

    const tree = mergePathsIntoTree(paths);

    // urn:child should appear only as a child of urn:root, not as a separate root
    expect(tree).toHaveLength(1);
    expect(tree[0].iri).toBe("urn:root");
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].iri).toBe("urn:child");
  });
});
