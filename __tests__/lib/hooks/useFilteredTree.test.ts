import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { mergePathsIntoTree, useFilteredTree, type AncestorPath } from "@/lib/hooks/useFilteredTree";
import type { EntitySearchResult } from "@/lib/api/client";

// Mock the API client
vi.mock("@/lib/api/client", () => ({
  projectOntologyApi: {
    getClassAncestors: vi.fn(),
  },
}));

import { projectOntologyApi } from "@/lib/api/client";

const mockedGetClassAncestors = projectOntologyApi.getClassAncestors as ReturnType<typeof vi.fn>;

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

  it("returns empty array for empty paths input", () => {
    const tree = mergePathsIntoTree([]);
    expect(tree).toHaveLength(0);
  });

  it("assigns entityType 'class' to all nodes", () => {
    const paths: AncestorPath[] = [
      {
        matchIri: "urn:leaf",
        matchLabel: "Leaf",
        ancestors: [{ iri: "urn:root", label: "Root", child_count: 1 }],
      },
    ];

    const tree = mergePathsIntoTree(paths);
    expect(tree[0].entityType).toBe("class");
    expect(tree[0].children[0].entityType).toBe("class");
  });

  it("builds a deep chain of 4 ancestors correctly", () => {
    const paths: AncestorPath[] = [
      {
        matchIri: "urn:d",
        matchLabel: "D",
        ancestors: [
          { iri: "urn:a", label: "A", child_count: 1 },
          { iri: "urn:b", label: "B", child_count: 1 },
          { iri: "urn:c", label: "C", child_count: 1 },
        ],
      },
    ];

    const tree = mergePathsIntoTree(paths);

    expect(tree).toHaveLength(1);
    expect(tree[0].iri).toBe("urn:a");
    expect(tree[0].children[0].iri).toBe("urn:b");
    expect(tree[0].children[0].children[0].iri).toBe("urn:c");
    expect(tree[0].children[0].children[0].children[0].iri).toBe("urn:d");
    expect(tree[0].children[0].children[0].children[0].isSearchMatch).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// useFilteredTree hook
// ---------------------------------------------------------------------------

function makeClassResult(iri: string, label: string): EntitySearchResult {
  return { iri, label, entity_type: "class", deprecated: false };
}

function makePropertyResult(iri: string, label: string): EntitySearchResult {
  return { iri, label, entity_type: "property", deprecated: false };
}

describe("useFilteredTree", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null filteredNodes when searchResults is null", () => {
    const { result } = renderHook(() =>
      useFilteredTree({
        searchResults: null,
        projectId: "p1",
        accessToken: "tok",
      })
    );

    expect(result.current.filteredNodes).toBeNull();
    expect(result.current.isBuilding).toBe(false);
    expect(result.current.firstMatchIri).toBeNull();
    expect(result.current.truncated).toBe(false);
  });

  it("returns null filteredNodes when searchResults has no class results", () => {
    const { result } = renderHook(() =>
      useFilteredTree({
        searchResults: [makePropertyResult("urn:prop", "Prop")],
        projectId: "p1",
      })
    );

    expect(result.current.filteredNodes).toBeNull();
    expect(result.current.isBuilding).toBe(false);
    expect(result.current.firstMatchIri).toBeNull();
  });

  it("returns null filteredNodes for empty search results array", () => {
    const { result } = renderHook(() =>
      useFilteredTree({
        searchResults: [],
        projectId: "p1",
      })
    );

    expect(result.current.filteredNodes).toBeNull();
    expect(result.current.isBuilding).toBe(false);
  });

  it("builds a filtered tree from class search results", async () => {
    mockedGetClassAncestors.mockResolvedValue({
      nodes: [{ iri: "urn:root", label: "Root", child_count: 1 }],
      total_classes: 2,
    });

    const { result } = renderHook(() =>
      useFilteredTree({
        searchResults: [makeClassResult("urn:leaf", "Leaf")],
        projectId: "p1",
        accessToken: "tok",
        branch: "main",
      })
    );

    await waitFor(() => expect(result.current.isBuilding).toBe(false));

    expect(result.current.filteredNodes).not.toBeNull();
    expect(result.current.filteredNodes).toHaveLength(1);
    expect(result.current.filteredNodes![0].iri).toBe("urn:root");
    expect(result.current.filteredNodes![0].children[0].iri).toBe("urn:leaf");
    expect(result.current.firstMatchIri).toBe("urn:leaf");
    expect(result.current.truncated).toBe(false);
  });

  it("handles ancestor fetch failure gracefully (empty ancestors)", async () => {
    mockedGetClassAncestors.mockRejectedValue(new Error("fetch failed"));

    const { result } = renderHook(() =>
      useFilteredTree({
        searchResults: [makeClassResult("urn:orphan", "Orphan")],
        projectId: "p1",
      })
    );

    await waitFor(() => expect(result.current.isBuilding).toBe(false));

    // Should still build a tree with the orphan as a root node
    expect(result.current.filteredNodes).not.toBeNull();
    expect(result.current.filteredNodes).toHaveLength(1);
    expect(result.current.filteredNodes![0].iri).toBe("urn:orphan");
    expect(result.current.filteredNodes![0].isSearchMatch).toBe(true);
  });

  it("filters out non-class results and only processes classes", async () => {
    mockedGetClassAncestors.mockResolvedValue({
      nodes: [],
      total_classes: 1,
    });

    const searchResults = [
      makePropertyResult("urn:prop", "Property"),
      makeClassResult("urn:cls", "Class"),
    ];

    const { result } = renderHook(() =>
      useFilteredTree({
        searchResults,
        projectId: "p1",
      })
    );

    await waitFor(() => expect(result.current.isBuilding).toBe(false));

    // Only the class result should be fetched
    expect(mockedGetClassAncestors).toHaveBeenCalledTimes(1);
    expect(mockedGetClassAncestors).toHaveBeenCalledWith("p1", "urn:cls", undefined, undefined);
  });

  it("sets truncated when results exceed MAX_MATCHES (20)", async () => {
    // Create 21 class results
    const results: EntitySearchResult[] = Array.from({ length: 21 }, (_, i) =>
      makeClassResult(`urn:cls${i}`, `Class ${i}`)
    );

    mockedGetClassAncestors.mockResolvedValue({
      nodes: [],
      total_classes: 21,
    });

    const { result } = renderHook(() =>
      useFilteredTree({
        searchResults: results,
        projectId: "p1",
      })
    );

    await waitFor(() => expect(result.current.isBuilding).toBe(false));

    expect(result.current.truncated).toBe(true);
    // Should only fetch ancestors for 20 results (MAX_MATCHES)
    expect(mockedGetClassAncestors).toHaveBeenCalledTimes(20);
  });

  it("does not set truncated when results are at MAX_MATCHES exactly", async () => {
    const results: EntitySearchResult[] = Array.from({ length: 20 }, (_, i) =>
      makeClassResult(`urn:cls${i}`, `Class ${i}`)
    );

    mockedGetClassAncestors.mockResolvedValue({
      nodes: [],
      total_classes: 20,
    });

    const { result } = renderHook(() =>
      useFilteredTree({
        searchResults: results,
        projectId: "p1",
      })
    );

    await waitFor(() => expect(result.current.isBuilding).toBe(false));

    expect(result.current.truncated).toBe(false);
  });

  it("resets state when searchResults changes to null", async () => {
    mockedGetClassAncestors.mockResolvedValue({
      nodes: [],
      total_classes: 1,
    });

    const { result, rerender } = renderHook(
      ({ searchResults }) =>
        useFilteredTree({ searchResults, projectId: "p1" }),
      {
        initialProps: {
          searchResults: [makeClassResult("urn:cls", "Class")] as EntitySearchResult[] | null,
        },
      }
    );

    await waitFor(() => expect(result.current.isBuilding).toBe(false));
    expect(result.current.filteredNodes).not.toBeNull();

    // Change to null
    rerender({ searchResults: null });

    expect(result.current.filteredNodes).toBeNull();
    expect(result.current.firstMatchIri).toBeNull();
    expect(result.current.truncated).toBe(false);
  });

  it("cancels stale builds when searchResults change rapidly", async () => {
    let resolveFirst: ((value: unknown) => void) | undefined;
    const firstPromise = new Promise((resolve) => {
      resolveFirst = resolve;
    });

    mockedGetClassAncestors
      .mockReturnValueOnce(firstPromise)
      .mockResolvedValue({
        nodes: [],
        total_classes: 1,
      });

    const { result, rerender } = renderHook(
      ({ searchResults }) =>
        useFilteredTree({ searchResults, projectId: "p1" }),
      {
        initialProps: {
          searchResults: [makeClassResult("urn:first", "First")] as EntitySearchResult[] | null,
        },
      }
    );

    // Should be building the first query
    expect(result.current.isBuilding).toBe(true);

    // Now change the search results before the first resolves
    rerender({
      searchResults: [makeClassResult("urn:second", "Second")],
    });

    // Resolve the first (stale) request
    resolveFirst!({
      nodes: [{ iri: "urn:stale-root", label: "Stale", child_count: 0 }],
      total_classes: 1,
    });

    await waitFor(() => expect(result.current.isBuilding).toBe(false));

    // The result should be from the second search, not the stale first
    expect(result.current.firstMatchIri).toBe("urn:second");
  });
});
