import React, { useState } from "react";
import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DragStartEvent, DragEndEvent, DragOverEvent } from "@dnd-kit/core";
import { useTreeDragDrop } from "@/lib/hooks/useTreeDragDrop";
import type { ClassTreeNode } from "@/lib/ontology/types";

function node(iri: string, children: ClassTreeNode[] = [], expanded = true): ClassTreeNode {
  return { iri, label: iri.toUpperCase(), children, hasChildren: children.length > 0, isExpanded: expanded, isLoading: false };
}
const tree = [node("a", [node("b", [node("c")])]), node("d", [node("e")], false), node("f", [node("g")], false)];
const start = (id: string) => ({ active: { id } }) as DragStartEvent;
const over = (id: string | null) => ({ over: id ? { id } : null }) as DragOverEvent;
const end = (id: string | null) => ({ over: id ? { id } : null }) as DragEndEvent;
function setup() {
  const expandNode = vi.fn();
  const onReparent = vi.fn<Parameters<typeof useTreeDragDrop>[0]["onReparent"]>().mockResolvedValue();
  const onAnnounce = vi.fn();
  return { expandNode, onReparent, onAnnounce, ...renderHook(({ canEdit, editingIri }: { canEdit: boolean; editingIri: string | null }) => useTreeDragDrop({ nodes: tree, canEdit, editingIri, expandNode, onReparent, onAnnounce }), { initialProps: { canEdit: true, editingIri: null as string | null } }) };
}
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("useTreeDragDrop state and event integration", () => {
  it("moves a nested node through a real stateful parent and restores the tree on undo", async () => {
    function Tree() {
      const [nodes, setNodes] = useState([node("parent", [node("child")]), node("destination")]);
      const [announcement, setAnnouncement] = useState("");
      const drag = useTreeDragDrop({ nodes, canEdit: true, expandNode: () => {}, onAnnounce: setAnnouncement,
        onReparent: async (iri, _oldParents, newParents) => {
          let moved: ClassTreeNode | undefined;
          function remove(branch: ClassTreeNode[]): ClassTreeNode[] {
            return branch.filter(item => { if (item.iri === iri) { moved = item; return false; } return true; }).map(item => ({ ...item, children: remove(item.children) }));
          }
          const remaining = remove(nodes);
          if (!moved) throw new Error("Missing node");
          const moving = moved;
          function insert(branch: ClassTreeNode[]): ClassTreeNode[] {
            return branch.map(item => ({ ...item, children: item.iri === newParents[0] ? [...item.children, moving] : insert(item.children) }));
          }
          setNodes(newParents.length ? insert(remaining) : [...remaining, moving]);
        } });
      return <><button onClick={() => drag.handleDragStart(start("child"))}>Drag child</button>
        <button onClick={() => drag.handleDragEnd(end("destination"))}>Drop</button>
        <button onClick={drag.handleUndo} disabled={!drag.undoAction}>Undo</button>
        <output>{nodes.map(n => `${n.iri}: ${n.children.map(c => c.iri).join(",")}`).join("; ")}</output><p>{announcement}</p></>;
    }
    render(<Tree />);
    fireEvent.click(screen.getByText("Drag child"));
    await act(async () => fireEvent.click(screen.getByText("Drop")));
    expect(screen.getByText("parent: ; destination: child")).toBeDefined();
    expect(screen.getByText("Moved CHILD under DESTINATION")).toBeDefined();
    await act(async () => fireEvent.click(screen.getByText("Undo")));
    expect(screen.getByText("parent: child; destination:")).toBeDefined();
    expect((screen.getByText("Undo") as HTMLButtonElement).disabled).toBe(true);
  });

  it("tracks Alt during an active drag, passes add mode, and resets after key release", async () => {
    const { result, onReparent } = setup();
    act(() => fireEvent.keyDown(window, { key: "Alt", altKey: true }));
    expect(result.current.dragState.dragMode).toBe("move");
    act(() => result.current.handleDragStart(start("b")));
    act(() => fireEvent.keyDown(window, { key: "Alt", altKey: true }));
    expect(result.current.dragState.dragMode).toBe("add");
    await act(async () => result.current.handleDragEnd(end("d")));
    expect(onReparent).toHaveBeenCalledWith("b", ["a"], ["d"], "add");
    act(() => fireEvent.keyUp(window, { key: "Alt", altKey: false }));
    act(() => result.current.handleDragStart(start("b")));
    expect(result.current.dragState.dragMode).toBe("move");
    act(() => fireEvent.keyDown(window, { key: "Alt", altKey: true }));
    act(() => fireEvent.keyUp(window, { key: "Alt", altKey: false }));
    expect(result.current.dragState.dragMode).toBe("move");
  });

  it("auto-expands only the latest collapsed node after the complete hover delay", () => {
    vi.useFakeTimers();
    const { result, expandNode } = setup();
    act(() => result.current.handleDragEnterNode("d"));
    act(() => vi.advanceTimersByTime(800));
    expect(expandNode).not.toHaveBeenCalled();
    act(() => result.current.handleDragStart(start("b")));
    act(() => result.current.handleDragEnterNode("d"));
    act(() => vi.advanceTimersByTime(799));
    expect(expandNode).not.toHaveBeenCalled();
    act(() => result.current.handleDragEnterNode("f"));
    act(() => vi.advanceTimersByTime(800));
    expect(expandNode).toHaveBeenCalledExactlyOnceWith("f");
  });

  it.each(["leave", "cancel", "drop"])("cancels pending expansion on %s", async action => {
    vi.useFakeTimers();
    const { result, expandNode } = setup();
    act(() => result.current.handleDragStart(start("b")));
    act(() => result.current.handleDragEnterNode("d"));
    await act(async () => {
      if (action === "leave") result.current.handleDragLeaveNode();
      else if (action === "cancel") result.current.handleDragCancel();
      else await result.current.handleDragEnd(end(null));
    });
    act(() => vi.advanceTimersByTime(1000));
    expect(expandNode).not.toHaveBeenCalled();
  });

  it.each(["a", "c", "missing"])("does not expand an expanded, leaf or missing node (%s)", iri => {
    vi.useFakeTimers();
    const { result, expandNode } = setup();
    act(() => result.current.handleDragStart(start("b")));
    act(() => result.current.handleDragEnterNode(iri));
    act(() => vi.advanceTimersByTime(1000));
    expect(expandNode).not.toHaveBeenCalled();
  });

  it.each(["permission", "editing"])("revalidates %s changes between drag start and drop", async change => {
    const { result, rerender, onReparent } = setup();
    act(() => result.current.handleDragStart(start("b")));
    rerender({ canEdit: change !== "permission", editingIri: change === "editing" ? "b" : null });
    act(() => result.current.handleDragOver(over("d")));
    expect(result.current.dragState.isValidDropTarget).toBe(false);
    await act(async () => result.current.handleDragEnd(end("d")));
    expect(onReparent).not.toHaveBeenCalled();
    expect(result.current.dragState.isDragActive).toBe(false);
  });

  it("rejects a deep descendant and clears validity when the pointer leaves all targets", () => {
    const { result } = setup();
    act(() => result.current.handleDragOver(over("d")));
    expect(result.current.dragState.dropTargetIri).toBeNull();
    act(() => result.current.handleDragStart(start("a")));
    act(() => result.current.handleDragOver(over("c")));
    expect(result.current.dragState.isValidDropTarget).toBe(false);
    act(() => result.current.handleDragOver(over("d")));
    expect(result.current.dragState.isValidDropTarget).toBe(true);
    act(() => result.current.handleDragOver(over(null)));
    expect(result.current.dragState.isValidDropTarget).toBe(false);
  });

  it("contains an undo rejection, clears undo once, and does not announce a failed operation", async () => {
    const { result, onReparent, onAnnounce } = setup();
    act(() => result.current.handleDragStart(start("b")));
    await act(async () => result.current.handleDragEnd(end("d")));
    onReparent.mockRejectedValueOnce(new Error("Undo failed"));
    await act(async () => result.current.handleUndo());
    expect(result.current.undoAction).toBeNull();
    act(() => result.current.handleUndo());
    expect(onReparent).toHaveBeenCalledTimes(2);
    onAnnounce.mockClear();
    onReparent.mockRejectedValueOnce(new Error("Move failed"));
    act(() => result.current.handleDragStart(start("b")));
    await act(async () => result.current.handleDragEnd(end("d")));
    expect(onAnnounce).not.toHaveBeenCalled();
    expect(result.current.undoAction).toBeNull();
  });

  it("announces moving a deep child to root with the immediate parent preserved for undo", async () => {
    const { result, onReparent, onAnnounce } = setup();
    act(() => result.current.handleDragStart(start("c")));
    await act(async () => result.current.handleDragEnd(end("root-drop-zone")));
    expect(onReparent).toHaveBeenCalledWith("c", ["b"], [], "move");
    expect(onAnnounce).toHaveBeenCalledWith("Moved C under root");
    expect(result.current.undoAction?.oldParentIris).toEqual(["b"]);
  });
});
