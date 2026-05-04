import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTreeDragDrop } from "@/lib/hooks/useTreeDragDrop";
import type { ClassTreeNode } from "@/lib/ontology/types";
import type { DragStartEvent, DragEndEvent, DragOverEvent } from "@dnd-kit/core";

function makeNode(
  iri: string,
  label: string,
  children: ClassTreeNode[] = [],
): ClassTreeNode {
  return {
    iri,
    label,
    children,
    isExpanded: children.length > 0,
    isLoading: false,
    hasChildren: children.length > 0,
  };
}

// Helper to build minimal dnd-kit events
function makeDragStartEvent(id: string): DragStartEvent {
  return { active: { id } } as unknown as DragStartEvent;
}

function makeDragOverEvent(
  overId: string | null,
): DragOverEvent {
  return { over: overId ? { id: overId } : null } as unknown as DragOverEvent;
}

function makeDragEndEvent(overId: string | null): DragEndEvent {
  return { over: overId ? { id: overId } : null } as unknown as DragEndEvent;
}

const BASE_TREE: ClassTreeNode[] = [
  makeNode("http://ex.org/A", "A", [
    makeNode("http://ex.org/B", "B", [
      makeNode("http://ex.org/C", "C"),
    ]),
  ]),
  makeNode("http://ex.org/D", "D"),
];

const BASE_OPTIONS = {
  nodes: BASE_TREE,
  canEdit: true,
  expandNode: vi.fn(),
  onReparent: vi.fn().mockResolvedValue(undefined),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useTreeDragDrop", () => {
  it("starts with inactive drag state", () => {
    const { result } = renderHook(() => useTreeDragDrop(BASE_OPTIONS));

    expect(result.current.dragState.isDragActive).toBe(false);
    expect(result.current.dragState.draggedIri).toBeNull();
    expect(result.current.dragState.dropTargetIri).toBeNull();
    expect(result.current.dragState.dragMode).toBe("move");
    expect(result.current.undoAction).toBeNull();
  });

  it("handleDragStart sets drag state", () => {
    const { result } = renderHook(() => useTreeDragDrop(BASE_OPTIONS));

    act(() => {
      result.current.handleDragStart(makeDragStartEvent("http://ex.org/B"));
    });

    expect(result.current.dragState.isDragActive).toBe(true);
    expect(result.current.dragState.draggedIri).toBe("http://ex.org/B");
    expect(result.current.dragState.draggedLabel).toBe("B");
  });

  it("handleDragStart does nothing when canEdit is false", () => {
    const { result } = renderHook(() =>
      useTreeDragDrop({ ...BASE_OPTIONS, canEdit: false }),
    );

    act(() => {
      result.current.handleDragStart(makeDragStartEvent("http://ex.org/B"));
    });

    expect(result.current.dragState.isDragActive).toBe(false);
  });

  it("handleDragStart does nothing for the editing node", () => {
    const { result } = renderHook(() =>
      useTreeDragDrop({ ...BASE_OPTIONS, editingIri: "http://ex.org/B" }),
    );

    act(() => {
      result.current.handleDragStart(makeDragStartEvent("http://ex.org/B"));
    });

    expect(result.current.dragState.isDragActive).toBe(false);
  });

  it("handleDragOver validates drop target - cannot drop on self", () => {
    const { result } = renderHook(() => useTreeDragDrop(BASE_OPTIONS));

    act(() => {
      result.current.handleDragStart(makeDragStartEvent("http://ex.org/B"));
    });

    act(() => {
      result.current.handleDragOver(makeDragOverEvent("http://ex.org/B"));
    });

    expect(result.current.dragState.isValidDropTarget).toBe(false);
  });

  it("handleDragOver validates drop target - cannot drop on descendant", () => {
    const { result } = renderHook(() => useTreeDragDrop(BASE_OPTIONS));

    // Drag A (parent of B which is parent of C)
    act(() => {
      result.current.handleDragStart(makeDragStartEvent("http://ex.org/A"));
    });

    // Try to drop on B (descendant of A)
    act(() => {
      result.current.handleDragOver(makeDragOverEvent("http://ex.org/B"));
    });

    expect(result.current.dragState.isValidDropTarget).toBe(false);
  });

  it("handleDragOver validates drop target - cannot drop on current parent", () => {
    const { result } = renderHook(() => useTreeDragDrop(BASE_OPTIONS));

    // B's parent is A
    act(() => {
      result.current.handleDragStart(makeDragStartEvent("http://ex.org/B"));
    });

    // Drop on A (current parent) should be invalid
    act(() => {
      result.current.handleDragOver(makeDragOverEvent("http://ex.org/A"));
    });

    expect(result.current.dragState.isValidDropTarget).toBe(false);
  });

  it("handleDragOver marks valid drop target", () => {
    const { result } = renderHook(() => useTreeDragDrop(BASE_OPTIONS));

    // Drag D
    act(() => {
      result.current.handleDragStart(makeDragStartEvent("http://ex.org/D"));
    });

    // Drop on A (not self, not descendant, not current parent)
    act(() => {
      result.current.handleDragOver(makeDragOverEvent("http://ex.org/A"));
    });

    expect(result.current.dragState.isValidDropTarget).toBe(true);
    expect(result.current.dragState.dropTargetIri).toBe("http://ex.org/A");
  });

  it("handleDragEnd calls onReparent for valid drop", async () => {
    const onReparent = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useTreeDragDrop({ ...BASE_OPTIONS, onReparent }),
    );

    // Drag D and drop on A
    act(() => {
      result.current.handleDragStart(makeDragStartEvent("http://ex.org/D"));
    });

    await act(async () => {
      await result.current.handleDragEnd(makeDragEndEvent("http://ex.org/A"));
    });

    expect(onReparent).toHaveBeenCalledWith(
      "http://ex.org/D",
      [], // D is a root node, no current parent
      ["http://ex.org/A"],
      "move",
    );
    expect(result.current.dragState.isDragActive).toBe(false);
  });

  it("handleDragEnd sets undo action after successful drop", async () => {
    const onReparent = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useTreeDragDrop({ ...BASE_OPTIONS, onReparent }),
    );

    act(() => {
      result.current.handleDragStart(makeDragStartEvent("http://ex.org/D"));
    });

    await act(async () => {
      await result.current.handleDragEnd(makeDragEndEvent("http://ex.org/A"));
    });

    expect(result.current.undoAction).not.toBeNull();
    expect(result.current.undoAction!.classIri).toBe("http://ex.org/D");
    expect(result.current.undoAction!.oldParentIris).toEqual([]);
    expect(result.current.undoAction!.newParentIris).toEqual(["http://ex.org/A"]);
  });

  it("handleDragEnd resets state when dropping on invalid target", async () => {
    const onReparent = vi.fn();
    const { result } = renderHook(() =>
      useTreeDragDrop({ ...BASE_OPTIONS, onReparent }),
    );

    // Drag B
    act(() => {
      result.current.handleDragStart(makeDragStartEvent("http://ex.org/B"));
    });

    // Drop on self (invalid)
    await act(async () => {
      await result.current.handleDragEnd(makeDragEndEvent("http://ex.org/B"));
    });

    expect(onReparent).not.toHaveBeenCalled();
    expect(result.current.dragState.isDragActive).toBe(false);
  });

  it("handleDragEnd resets state when dropping with no target", async () => {
    const onReparent = vi.fn();
    const { result } = renderHook(() =>
      useTreeDragDrop({ ...BASE_OPTIONS, onReparent }),
    );

    act(() => {
      result.current.handleDragStart(makeDragStartEvent("http://ex.org/B"));
    });

    await act(async () => {
      await result.current.handleDragEnd(makeDragEndEvent(null));
    });

    expect(onReparent).not.toHaveBeenCalled();
    expect(result.current.dragState.isDragActive).toBe(false);
  });

  it("handleDragCancel resets drag state", () => {
    const { result } = renderHook(() => useTreeDragDrop(BASE_OPTIONS));

    act(() => {
      result.current.handleDragStart(makeDragStartEvent("http://ex.org/B"));
    });
    expect(result.current.dragState.isDragActive).toBe(true);

    act(() => {
      result.current.handleDragCancel();
    });

    expect(result.current.dragState.isDragActive).toBe(false);
    expect(result.current.dragState.draggedIri).toBeNull();
  });

  it("handleUndo calls onReparent with swapped parent arrays", async () => {
    const onReparent = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useTreeDragDrop({ ...BASE_OPTIONS, onReparent }),
    );

    act(() => {
      result.current.handleDragStart(makeDragStartEvent("http://ex.org/D"));
    });

    await act(async () => {
      await result.current.handleDragEnd(makeDragEndEvent("http://ex.org/A"));
    });

    expect(result.current.undoAction).not.toBeNull();

    onReparent.mockClear();

    act(() => {
      result.current.handleUndo();
    });

    expect(onReparent).toHaveBeenCalledWith(
      "http://ex.org/D",
      ["http://ex.org/A"], // new becomes old
      [], // old becomes new
      "move",
    );
    expect(result.current.undoAction).toBeNull();
  });

  it("handleUndo does nothing when no undo action exists", () => {
    const onReparent = vi.fn();
    const { result } = renderHook(() =>
      useTreeDragDrop({ ...BASE_OPTIONS, onReparent }),
    );

    act(() => {
      result.current.handleUndo();
    });

    expect(onReparent).not.toHaveBeenCalled();
  });

  it("clearUndo clears the undo action", async () => {
    const onReparent = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useTreeDragDrop({ ...BASE_OPTIONS, onReparent }),
    );

    act(() => {
      result.current.handleDragStart(makeDragStartEvent("http://ex.org/D"));
    });

    await act(async () => {
      await result.current.handleDragEnd(makeDragEndEvent("http://ex.org/A"));
    });

    expect(result.current.undoAction).not.toBeNull();

    act(() => {
      result.current.clearUndo();
    });

    expect(result.current.undoAction).toBeNull();
  });

  it("handleDragEnd clears undo when onReparent throws", async () => {
    const onReparent = vi.fn().mockRejectedValue(new Error("Failed"));
    const { result } = renderHook(() =>
      useTreeDragDrop({ ...BASE_OPTIONS, onReparent }),
    );

    act(() => {
      result.current.handleDragStart(makeDragStartEvent("http://ex.org/D"));
    });

    await act(async () => {
      await result.current.handleDragEnd(makeDragEndEvent("http://ex.org/A"));
    });

    expect(result.current.undoAction).toBeNull();
  });

  it("handleDragEnd handles root-drop-zone", async () => {
    const onReparent = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useTreeDragDrop({ ...BASE_OPTIONS, onReparent }),
    );

    // Drag B (which has parent A)
    act(() => {
      result.current.handleDragStart(makeDragStartEvent("http://ex.org/B"));
    });

    await act(async () => {
      await result.current.handleDragEnd(makeDragEndEvent("root-drop-zone"));
    });

    expect(onReparent).toHaveBeenCalledWith(
      "http://ex.org/B",
      ["http://ex.org/A"],
      [],
      "move",
    );
  });

  it("handleDragEnd ignores root-drop-zone for already-root nodes", async () => {
    const onReparent = vi.fn();
    const { result } = renderHook(() =>
      useTreeDragDrop({ ...BASE_OPTIONS, onReparent }),
    );

    // Drag D (already a root node)
    act(() => {
      result.current.handleDragStart(makeDragStartEvent("http://ex.org/D"));
    });

    await act(async () => {
      await result.current.handleDragEnd(makeDragEndEvent("root-drop-zone"));
    });

    // Should be a no-op
    expect(onReparent).not.toHaveBeenCalled();
  });

  it("calls onAnnounce after successful reparent", async () => {
    const onReparent = vi.fn().mockResolvedValue(undefined);
    const onAnnounce = vi.fn();
    const { result } = renderHook(() =>
      useTreeDragDrop({ ...BASE_OPTIONS, onReparent, onAnnounce }),
    );

    act(() => {
      result.current.handleDragStart(makeDragStartEvent("http://ex.org/D"));
    });

    await act(async () => {
      await result.current.handleDragEnd(makeDragEndEvent("http://ex.org/A"));
    });

    expect(onAnnounce).toHaveBeenCalledWith("Moved D under A");
  });
});
