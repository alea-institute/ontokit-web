import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

// Mock the API client before importing the hook
vi.mock("@/lib/api/client", () => ({
  projectOntologyApi: {
    getRootClasses: vi.fn(),
    getClassChildren: vi.fn(),
    getClassAncestors: vi.fn(),
  },
}));

import { useOntologyTree } from "@/lib/hooks/useOntologyTree";
import { projectOntologyApi } from "@/lib/api/client";

const mockedGetRootClasses = projectOntologyApi.getRootClasses as ReturnType<typeof vi.fn>;
const mockedGetClassChildren = projectOntologyApi.getClassChildren as ReturnType<typeof vi.fn>;
const mockedGetClassAncestors = projectOntologyApi.getClassAncestors as ReturnType<typeof vi.fn>;

function makeApiNode(iri: string, label: string, childCount = 0) {
  return { iri, label, child_count: childCount, deprecated: false };
}

describe("useOntologyTree", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads root classes on mount", async () => {
    mockedGetRootClasses.mockResolvedValue({
      nodes: [
        makeApiNode("urn:A", "Class A", 2),
        makeApiNode("urn:B", "Class B", 0),
      ],
      total_classes: 5,
    });

    const { result } = renderHook(() =>
      useOntologyTree({ projectId: "p1", accessToken: "tok" })
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.nodes).toHaveLength(2);
    expect(result.current.nodes[0].iri).toBe("urn:A");
    expect(result.current.nodes[0].hasChildren).toBe(true);
    expect(result.current.nodes[0].isExpanded).toBe(false);
    expect(result.current.nodes[1].hasChildren).toBe(false);
    expect(result.current.totalClasses).toBe(5);
    expect(result.current.error).toBeNull();
  });

  it("sets error when loadRootClasses fails", async () => {
    mockedGetRootClasses.mockRejectedValue(new Error("Network down"));

    const { result } = renderHook(() =>
      useOntologyTree({ projectId: "p1" })
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBe("Network down");
    expect(result.current.nodes).toHaveLength(0);
  });

  it("does not fetch when projectId is empty", async () => {
    const { result } = renderHook(() =>
      useOntologyTree({ projectId: "" })
    );

    await new Promise((r) => setTimeout(r, 50));

    expect(mockedGetRootClasses).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
  });

  it("expands a node and loads children", async () => {
    mockedGetRootClasses.mockResolvedValue({
      nodes: [makeApiNode("urn:A", "A", 2)],
      total_classes: 3,
    });
    mockedGetClassChildren.mockResolvedValue({
      nodes: [makeApiNode("urn:C1", "Child 1"), makeApiNode("urn:C2", "Child 2")],
      total_classes: 3,
    });

    const { result } = renderHook(() =>
      useOntologyTree({ projectId: "p1", accessToken: "tok" })
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.expandNode("urn:A");
    });

    expect(result.current.nodes[0].isExpanded).toBe(true);
    expect(result.current.nodes[0].children).toHaveLength(2);
    expect(result.current.nodes[0].children[0].iri).toBe("urn:C1");
  });

  it("handles expandNode failure gracefully", async () => {
    mockedGetRootClasses.mockResolvedValue({
      nodes: [makeApiNode("urn:A", "A", 1)],
      total_classes: 1,
    });
    mockedGetClassChildren.mockRejectedValue(new Error("expand fail"));

    const { result } = renderHook(() =>
      useOntologyTree({ projectId: "p1" })
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.expandNode("urn:A");
    });

    // Node should not be expanded and should not be loading
    expect(result.current.nodes[0].isExpanded).toBe(false);
    expect(result.current.nodes[0].isLoading).toBe(false);
  });

  it("collapses a node", async () => {
    mockedGetRootClasses.mockResolvedValue({
      nodes: [makeApiNode("urn:A", "A", 1)],
      total_classes: 1,
    });
    mockedGetClassChildren.mockResolvedValue({
      nodes: [makeApiNode("urn:C", "Child")],
      total_classes: 1,
    });

    const { result } = renderHook(() =>
      useOntologyTree({ projectId: "p1" })
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Expand, then collapse
    await act(async () => {
      await result.current.expandNode("urn:A");
    });
    expect(result.current.nodes[0].isExpanded).toBe(true);

    act(() => {
      result.current.collapseNode("urn:A");
    });
    expect(result.current.nodes[0].isExpanded).toBe(false);
  });

  it("selects a node", async () => {
    mockedGetRootClasses.mockResolvedValue({
      nodes: [makeApiNode("urn:A", "A")],
      total_classes: 1,
    });

    const { result } = renderHook(() =>
      useOntologyTree({ projectId: "p1" })
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.selectNode("urn:A");
    });
    expect(result.current.selectedIri).toBe("urn:A");
  });

  it("adds an optimistic node to the root", async () => {
    mockedGetRootClasses.mockResolvedValue({
      nodes: [makeApiNode("urn:A", "A")],
      total_classes: 1,
    });

    const { result } = renderHook(() =>
      useOntologyTree({ projectId: "p1" })
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.addOptimisticNode("urn:New", "New Class");
    });

    expect(result.current.nodes).toHaveLength(2);
    expect(result.current.nodes[1].iri).toBe("urn:New");
    expect(result.current.nodes[1].label).toBe("New Class");
    expect(result.current.totalClasses).toBe(2);
    expect(result.current.selectedIri).toBe("urn:New");
  });

  it("adds an optimistic node as a child of a parent", async () => {
    mockedGetRootClasses.mockResolvedValue({
      nodes: [makeApiNode("urn:A", "A", 1)],
      total_classes: 1,
    });
    mockedGetClassChildren.mockResolvedValue({
      nodes: [makeApiNode("urn:C1", "Child 1")],
      total_classes: 1,
    });

    const { result } = renderHook(() =>
      useOntologyTree({ projectId: "p1" })
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Expand parent first
    await act(async () => {
      await result.current.expandNode("urn:A");
    });

    act(() => {
      result.current.addOptimisticNode("urn:New", "New Child", "urn:A");
    });

    expect(result.current.nodes[0].children).toHaveLength(2);
    expect(result.current.nodes[0].children[1].iri).toBe("urn:New");
    expect(result.current.nodes[0].isExpanded).toBe(true);
    expect(result.current.nodes[0].hasChildren).toBe(true);
  });

  it("removes an optimistic node and clears selection if selected", async () => {
    mockedGetRootClasses.mockResolvedValue({
      nodes: [makeApiNode("urn:A", "A"), makeApiNode("urn:B", "B")],
      total_classes: 2,
    });

    const { result } = renderHook(() =>
      useOntologyTree({ projectId: "p1" })
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.selectNode("urn:A");
    });
    expect(result.current.selectedIri).toBe("urn:A");

    act(() => {
      result.current.removeOptimisticNode("urn:A");
    });

    expect(result.current.nodes).toHaveLength(1);
    expect(result.current.nodes[0].iri).toBe("urn:B");
    expect(result.current.totalClasses).toBe(1);
    expect(result.current.selectedIri).toBeNull();
  });

  it("removeOptimisticNode keeps selection if different node removed", async () => {
    mockedGetRootClasses.mockResolvedValue({
      nodes: [makeApiNode("urn:A", "A"), makeApiNode("urn:B", "B")],
      total_classes: 2,
    });

    const { result } = renderHook(() =>
      useOntologyTree({ projectId: "p1" })
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.selectNode("urn:A");
    });

    act(() => {
      result.current.removeOptimisticNode("urn:B");
    });

    expect(result.current.selectedIri).toBe("urn:A");
  });

  it("updates a node label in place", async () => {
    mockedGetRootClasses.mockResolvedValue({
      nodes: [makeApiNode("urn:A", "Old Label")],
      total_classes: 1,
    });

    const { result } = renderHook(() =>
      useOntologyTree({ projectId: "p1" })
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.updateNodeLabel("urn:A", "New Label");
    });

    expect(result.current.nodes[0].label).toBe("New Label");
  });

  it("collapseAll collapses all expanded nodes", async () => {
    mockedGetRootClasses.mockResolvedValue({
      nodes: [makeApiNode("urn:A", "A", 1), makeApiNode("urn:B", "B", 1)],
      total_classes: 4,
    });
    mockedGetClassChildren.mockResolvedValue({
      nodes: [makeApiNode("urn:C", "C")],
      total_classes: 4,
    });

    const { result } = renderHook(() =>
      useOntologyTree({ projectId: "p1" })
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Expand both
    await act(async () => {
      await result.current.expandNode("urn:A");
    });
    await act(async () => {
      await result.current.expandNode("urn:B");
    });

    expect(result.current.nodes[0].isExpanded).toBe(true);
    expect(result.current.nodes[1].isExpanded).toBe(true);

    act(() => {
      result.current.collapseAll();
    });

    expect(result.current.nodes[0].isExpanded).toBe(false);
    expect(result.current.nodes[1].isExpanded).toBe(false);
  });

  it("collapseOneLevel collapses leaf-expanded nodes only", async () => {
    // Setup: A (expanded) -> C (expanded) -> D (leaf)
    mockedGetRootClasses.mockResolvedValue({
      nodes: [makeApiNode("urn:A", "A", 1)],
      total_classes: 3,
    });
    mockedGetClassChildren
      .mockResolvedValueOnce({
        nodes: [makeApiNode("urn:C", "C", 1)],
        total_classes: 3,
      })
      .mockResolvedValueOnce({
        nodes: [makeApiNode("urn:D", "D", 0)],
        total_classes: 3,
      });

    const { result } = renderHook(() =>
      useOntologyTree({ projectId: "p1" })
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Expand A, then C
    await act(async () => {
      await result.current.expandNode("urn:A");
    });
    await act(async () => {
      await result.current.expandNode("urn:C");
    });

    expect(result.current.nodes[0].isExpanded).toBe(true);
    expect(result.current.nodes[0].children[0].isExpanded).toBe(true);

    // Collapse one level should collapse C (leaf-expanded) but not A
    act(() => {
      result.current.collapseOneLevel();
    });

    expect(result.current.nodes[0].isExpanded).toBe(true);
    expect(result.current.nodes[0].children[0].isExpanded).toBe(false);
  });

  it("hasExpandableNodes and hasExpandedNodes compute correctly", async () => {
    mockedGetRootClasses.mockResolvedValue({
      nodes: [makeApiNode("urn:A", "A", 1)],
      total_classes: 2,
    });
    mockedGetClassChildren.mockResolvedValue({
      nodes: [makeApiNode("urn:C", "C", 0)],
      total_classes: 2,
    });

    const { result } = renderHook(() =>
      useOntologyTree({ projectId: "p1" })
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // A has children, is not expanded
    expect(result.current.hasExpandableNodes).toBe(true);
    expect(result.current.hasExpandedNodes).toBe(false);

    await act(async () => {
      await result.current.expandNode("urn:A");
    });

    // A is now expanded, child C has no children
    expect(result.current.hasExpandedNodes).toBe(true);
    expect(result.current.hasExpandableNodes).toBe(false);
  });

  it("navigateToNode expands ancestors and selects target", async () => {
    mockedGetRootClasses.mockResolvedValue({
      nodes: [makeApiNode("urn:Root", "Root", 1)],
      total_classes: 3,
    });
    mockedGetClassAncestors.mockResolvedValue({
      nodes: [makeApiNode("urn:Root", "Root", 1)],
      total_classes: 3,
    });
    mockedGetClassChildren.mockResolvedValue({
      nodes: [makeApiNode("urn:Target", "Target", 0)],
      total_classes: 3,
    });

    const { result } = renderHook(() =>
      useOntologyTree({ projectId: "p1" })
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.navigateToNode("urn:Target");
    });

    expect(result.current.selectedIri).toBe("urn:Target");
    expect(mockedGetClassAncestors).toHaveBeenCalledWith("p1", "urn:Target", undefined, undefined);

    // Verify ancestor "urn:Root" is expanded and target is present as its child
    const rootNode = result.current.nodes.find((n) => n.iri === "urn:Root");
    expect(rootNode).toBeDefined();
    expect(rootNode!.children.length).toBeGreaterThan(0);
    const targetNode = rootNode!.children.find((c) => c.iri === "urn:Target");
    expect(targetNode).toBeDefined();
    expect(targetNode!.label).toBe("Target");
  });

  it("navigateToNode still selects target when ancestor fetch fails", async () => {
    mockedGetRootClasses.mockResolvedValue({
      nodes: [makeApiNode("urn:Root", "Root", 1)],
      total_classes: 1,
    });
    mockedGetClassAncestors.mockRejectedValue(new Error("fail"));

    const { result } = renderHook(() =>
      useOntologyTree({ projectId: "p1" })
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.navigateToNode("urn:Target");
    });

    expect(result.current.selectedIri).toBe("urn:Target");
  });

  it("reparentOptimistic moves a node and rollback restores", async () => {
    mockedGetRootClasses.mockResolvedValue({
      nodes: [
        makeApiNode("urn:A", "A", 1),
        makeApiNode("urn:B", "B", 0),
      ],
      total_classes: 3,
    });
    mockedGetClassChildren.mockResolvedValue({
      nodes: [makeApiNode("urn:C", "Child", 0)],
      total_classes: 3,
    });

    const { result } = renderHook(() =>
      useOntologyTree({ projectId: "p1" })
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Expand A to load child C
    await act(async () => {
      await result.current.expandNode("urn:A");
    });

    expect(result.current.nodes[0].children).toHaveLength(1);
    expect(result.current.nodes[0].children[0].iri).toBe("urn:C");

    // Reparent C from A to B
    let snapshot: ReturnType<typeof result.current.reparentOptimistic>;
    act(() => {
      snapshot = result.current.reparentOptimistic("urn:C", "urn:A", "urn:B");
    });

    // C should be removed from A and added to B
    expect(result.current.nodes[0].children).toHaveLength(0); // A
    const nodeB = result.current.nodes[1];
    expect(nodeB.children).toHaveLength(1);
    expect(nodeB.children[0].iri).toBe("urn:C");

    // Rollback
    act(() => {
      result.current.rollbackReparent(snapshot!);
    });

    // C should be back under A
    expect(result.current.nodes[0].children).toHaveLength(1);
    expect(result.current.nodes[0].children[0].iri).toBe("urn:C");
  });

  it("reparentOptimistic moves a node to root when newParentIri is null", async () => {
    mockedGetRootClasses.mockResolvedValue({
      nodes: [makeApiNode("urn:A", "A", 1)],
      total_classes: 2,
    });
    mockedGetClassChildren.mockResolvedValue({
      nodes: [makeApiNode("urn:C", "Child", 0)],
      total_classes: 2,
    });

    const { result } = renderHook(() =>
      useOntologyTree({ projectId: "p1" })
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.expandNode("urn:A");
    });

    act(() => {
      result.current.reparentOptimistic("urn:C", "urn:A", null);
    });

    // C should now be at root level
    expect(result.current.nodes).toHaveLength(2);
    expect(result.current.nodes[1].iri).toBe("urn:C");
    expect(result.current.nodes[0].children).toHaveLength(0);
  });

  it("resets tree when branchKey changes", async () => {
    mockedGetRootClasses.mockResolvedValue({
      nodes: [makeApiNode("urn:A", "A")],
      total_classes: 1,
    });

    const { result, rerender } = renderHook(
      ({ branchKey }) =>
        useOntologyTree({ projectId: "p1", branchKey }),
      {
        initialProps: { branchKey: "main" },
      }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.nodes).toHaveLength(1);

    // Change branch
    mockedGetRootClasses.mockResolvedValue({
      nodes: [makeApiNode("urn:X", "X"), makeApiNode("urn:Y", "Y")],
      total_classes: 2,
    });

    rerender({ branchKey: "dev" });

    await waitFor(() => expect(result.current.nodes).toHaveLength(2));
    expect(result.current.nodes[0].iri).toBe("urn:X");
  });
});
