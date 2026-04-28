import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock dnd-kit with configurable isOver
let mockIsOver = false;
vi.mock("@dnd-kit/core", () => ({
  useDraggable: () => ({ attributes: {}, listeners: {}, setNodeRef: vi.fn() }),
  useDroppable: () => ({ setNodeRef: vi.fn(), isOver: mockIsOver }),
}));

// Mock TreeNodeContextMenu to keep test simple
vi.mock("@/components/editor/TreeNodeContextMenu", () => ({
  TreeNodeContextMenu: () => <div data-testid="context-menu" />,
}));

// Mock context-menu to render children directly
vi.mock("@/components/ui/context-menu", () => ({
  ContextMenu: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  ContextMenuTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => <>{children}</>,
}));

import { EntityTreeNodeRow } from "@/components/editor/shared/EntityTreeNode";
import type { EntityTreeNode } from "@/lib/ontology/types";

function makeNode(overrides: Partial<EntityTreeNode> = {}): EntityTreeNode {
  return {
    iri: "http://example.org/Class1",
    label: "Class1",
    children: [],
    isExpanded: false,
    isLoading: false,
    hasChildren: false,
    ...overrides,
  };
}

describe("EntityTreeNodeRow", () => {
  const baseProps = {
    depth: 0,
    onSelect: vi.fn(),
    onExpand: vi.fn(),
    onCollapse: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the node label", () => {
    render(<EntityTreeNodeRow {...baseProps} node={makeNode({ label: "Person" })} />);
    expect(screen.getByText("Person")).toBeDefined();
  });

  it("renders with treeitem role", () => {
    render(<EntityTreeNodeRow {...baseProps} node={makeNode()} />);
    expect(screen.getByRole("treeitem")).toBeDefined();
  });

  it("sets aria-selected when node is selected", () => {
    render(
      <EntityTreeNodeRow
        {...baseProps}
        node={makeNode({ iri: "http://ex.org/A" })}
        selectedIri="http://ex.org/A"
      />,
    );
    expect(screen.getByRole("treeitem").getAttribute("aria-selected")).toBe("true");
  });

  it("sets aria-selected to false when not selected", () => {
    render(
      <EntityTreeNodeRow
        {...baseProps}
        node={makeNode({ iri: "http://ex.org/A" })}
        selectedIri="http://ex.org/B"
      />,
    );
    expect(screen.getByRole("treeitem").getAttribute("aria-selected")).toBe("false");
  });

  it("calls onSelect when clicked", async () => {
    const onSelect = vi.fn();
    render(
      <EntityTreeNodeRow
        {...baseProps}
        node={makeNode({ iri: "http://ex.org/A", label: "Alpha" })}
        onSelect={onSelect}
      />,
    );
    await userEvent.click(screen.getByText("Alpha"));
    expect(onSelect).toHaveBeenCalledWith("http://ex.org/A");
  });

  it("shows chevron for nodes with children", () => {
    render(
      <EntityTreeNodeRow
        {...baseProps}
        node={makeNode({ hasChildren: true })}
      />,
    );
    const btn = screen.getByTestId("toggle-chevron");
    expect(btn).toBeDefined();
  });

  it("shows leaf dot for nodes without children", () => {
    const { container } = render(
      <EntityTreeNodeRow
        {...baseProps}
        node={makeNode({ hasChildren: false })}
      />,
    );
    expect(container.querySelector(".tree-leaf-dot")).toBeDefined();
  });

  it("calls onExpand when toggle button clicked on collapsed node", async () => {
    const onExpand = vi.fn();
    render(
      <EntityTreeNodeRow
        {...baseProps}
        node={makeNode({ hasChildren: true, isExpanded: false })}
        onExpand={onExpand}
      />,
    );
    const toggleBtn = screen.getByTestId("toggle-chevron");
    await userEvent.click(toggleBtn);
    expect(onExpand).toHaveBeenCalledWith("http://example.org/Class1");
  });

  it("calls onCollapse when toggle button clicked on expanded node", async () => {
    const onCollapse = vi.fn();
    render(
      <EntityTreeNodeRow
        {...baseProps}
        node={makeNode({ hasChildren: true, isExpanded: true })}
        onCollapse={onCollapse}
      />,
    );
    const toggleBtn = screen.getByTestId("toggle-chevron");
    await userEvent.click(toggleBtn);
    expect(onCollapse).toHaveBeenCalledWith("http://example.org/Class1");
  });

  it("shows draft indicator when IRI is in draftIris set", () => {
    render(
      <EntityTreeNodeRow
        {...baseProps}
        node={makeNode({ iri: "http://ex.org/A" })}
        draftIris={new Set(["http://ex.org/A"])}
      />,
    );
    expect(screen.getByLabelText("Unsaved draft")).toBeDefined();
  });

  it("does not show draft indicator when IRI is not in draftIris", () => {
    render(
      <EntityTreeNodeRow
        {...baseProps}
        node={makeNode({ iri: "http://ex.org/A" })}
        draftIris={new Set(["http://ex.org/B"])}
      />,
    );
    expect(screen.queryByLabelText("Unsaved draft")).toBeNull();
  });

  it("shows Add subclass button when onAddChild is provided", () => {
    render(
      <EntityTreeNodeRow
        {...baseProps}
        node={makeNode()}
        onAddChild={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Add subclass")).toBeDefined();
  });

  it("applies line-through for deprecated nodes", () => {
    render(
      <EntityTreeNodeRow
        {...baseProps}
        node={makeNode({ deprecated: true, label: "OldClass" })}
      />,
    );
    const label = screen.getByText("OldClass");
    expect(label.className).toContain("line-through");
  });

  it("highlights search matches", () => {
    render(
      <EntityTreeNodeRow
        {...baseProps}
        node={makeNode({ label: "PersonEntity", isSearchMatch: true })}
        searchQuery="Person"
      />,
    );
    const mark = screen.getByText("Person");
    expect(mark.tagName).toBe("MARK");
  });

  it("renders group header differently", () => {
    render(
      <EntityTreeNodeRow
        {...baseProps}
        node={makeNode({
          isGroupHeader: true,
          label: "Object Properties",
          isExpanded: true,
          children: [makeNode({ iri: "http://ex.org/prop", label: "hasPart" })],
        })}
      />,
    );
    expect(screen.getByText("Object Properties")).toBeDefined();
    expect(screen.getByText("hasPart")).toBeDefined();
  });

  it("renders child count for group headers", () => {
    render(
      <EntityTreeNodeRow
        {...baseProps}
        node={makeNode({
          isGroupHeader: true,
          label: "Properties",
          isExpanded: false,
          children: [
            makeNode({ iri: "http://ex.org/a", label: "a" }),
            makeNode({ iri: "http://ex.org/b", label: "b" }),
          ],
        })}
      />,
    );
    expect(screen.getByText("2")).toBeDefined();
  });

  it("calls onExpand on double-click when collapsed with children", async () => {
    const onExpand = vi.fn();
    render(
      <EntityTreeNodeRow
        {...baseProps}
        node={makeNode({
          iri: "http://ex.org/A",
          label: "Alpha",
          hasChildren: true,
          isExpanded: false,
        })}
        onExpand={onExpand}
      />,
    );
    const row = screen.getByRole("treeitem");
    await userEvent.dblClick(row);
    expect(onExpand).toHaveBeenCalledWith("http://ex.org/A");
  });

  it("calls onCollapse on double-click when expanded with children", async () => {
    const onCollapse = vi.fn();
    render(
      <EntityTreeNodeRow
        {...baseProps}
        node={makeNode({
          iri: "http://ex.org/A",
          label: "Alpha",
          hasChildren: true,
          isExpanded: true,
          children: [makeNode({ iri: "http://ex.org/B", label: "Beta" })],
        })}
        onCollapse={onCollapse}
      />,
    );
    const items = screen.getAllByRole("treeitem");
    // Double-click the parent (first treeitem)
    await userEvent.dblClick(items[0]);
    expect(onCollapse).toHaveBeenCalledWith("http://ex.org/A");
  });

  it("does not toggle on double-click for leaf nodes", async () => {
    const onExpand = vi.fn();
    const onCollapse = vi.fn();
    render(
      <EntityTreeNodeRow
        {...baseProps}
        node={makeNode({
          iri: "http://ex.org/A",
          label: "Alpha",
          hasChildren: false,
          isExpanded: false,
        })}
        onExpand={onExpand}
        onCollapse={onCollapse}
      />,
    );
    const row = screen.getByRole("treeitem");
    await userEvent.dblClick(row);
    expect(onExpand).not.toHaveBeenCalled();
    expect(onCollapse).not.toHaveBeenCalled();
  });

  it("calls onAddChild when add button is clicked", async () => {
    const onAddChild = vi.fn();
    render(
      <EntityTreeNodeRow
        {...baseProps}
        node={makeNode({ iri: "http://ex.org/A", label: "Alpha" })}
        onAddChild={onAddChild}
      />,
    );
    await userEvent.click(screen.getByLabelText("Add subclass"));
    expect(onAddChild).toHaveBeenCalledWith("http://ex.org/A");
  });

  it("shows loading indicator when node isLoading", () => {
    const { container } = render(
      <EntityTreeNodeRow
        {...baseProps}
        node={makeNode({ hasChildren: true, isLoading: true })}
      />,
    );
    // The loading circle should have animate-pulse
    const pulse = container.querySelector(".animate-pulse");
    expect(pulse).not.toBeNull();
  });

  it("applies focused class when focusedIri matches", () => {
    const { container } = render(
      <EntityTreeNodeRow
        {...baseProps}
        node={makeNode({ iri: "http://ex.org/A" })}
        focusedIri="http://ex.org/A"
      />,
    );
    const focused = container.querySelector(".tree-item-focused");
    expect(focused).not.toBeNull();
  });

  it("applies search match class when isSearchMatch is true", () => {
    const { container } = render(
      <EntityTreeNodeRow
        {...baseProps}
        node={makeNode({ iri: "http://ex.org/A", isSearchMatch: true })}
      />,
    );
    const matched = container.querySelector(".tree-search-match");
    expect(matched).not.toBeNull();
  });

  it("does not highlight when searchQuery is empty", () => {
    render(
      <EntityTreeNodeRow
        {...baseProps}
        node={makeNode({ label: "PersonEntity", isSearchMatch: true })}
        searchQuery=""
      />,
    );
    // Should render plain text, no <mark>
    expect(screen.getByText("PersonEntity").tagName).not.toBe("MARK");
  });

  it("does not highlight when query does not match label text", () => {
    render(
      <EntityTreeNodeRow
        {...baseProps}
        node={makeNode({ label: "PersonEntity", isSearchMatch: true })}
        searchQuery="zzz"
      />,
    );
    expect(screen.getByText("PersonEntity").tagName).not.toBe("MARK");
  });

  it("renders expanded children for non-group normal nodes", () => {
    render(
      <EntityTreeNodeRow
        {...baseProps}
        node={makeNode({
          iri: "http://ex.org/A",
          label: "Alpha",
          hasChildren: true,
          isExpanded: true,
          children: [
            makeNode({ iri: "http://ex.org/B", label: "Beta" }),
            makeNode({ iri: "http://ex.org/C", label: "Gamma" }),
          ],
        })}
      />,
    );
    expect(screen.getByText("Beta")).not.toBeNull();
    expect(screen.getByText("Gamma")).not.toBeNull();
  });

  it("does not render children when node is collapsed", () => {
    render(
      <EntityTreeNodeRow
        {...baseProps}
        node={makeNode({
          iri: "http://ex.org/A",
          label: "Alpha",
          hasChildren: true,
          isExpanded: false,
          children: [makeNode({ iri: "http://ex.org/B", label: "Beta" })],
        })}
      />,
    );
    expect(screen.queryByText("Beta")).toBeNull();
  });

  it("renders context menu when onCopyIri is provided", () => {
    render(
      <EntityTreeNodeRow
        {...baseProps}
        node={makeNode()}
        onCopyIri={vi.fn()}
      />,
    );
    // Context menu wrapper is rendered (via mock)
    expect(screen.getByTestId("context-menu")).not.toBeNull();
  });

  it("does not render context menu when no context actions are provided", () => {
    render(
      <EntityTreeNodeRow
        {...baseProps}
        node={makeNode()}
      />,
    );
    expect(screen.queryByTestId("context-menu")).toBeNull();
  });

  it("group header calls onCollapse when clicking expanded header", async () => {
    const onCollapse = vi.fn();
    render(
      <EntityTreeNodeRow
        {...baseProps}
        node={makeNode({
          isGroupHeader: true,
          label: "Classes",
          isExpanded: true,
          children: [makeNode({ iri: "http://ex.org/a", label: "a" })],
        })}
        onCollapse={onCollapse}
      />,
    );
    // The group header button
    await userEvent.click(screen.getByText("Classes"));
    expect(onCollapse).toHaveBeenCalled();
  });

  it("group header calls onExpand when clicking collapsed header", async () => {
    const onExpand = vi.fn();
    render(
      <EntityTreeNodeRow
        {...baseProps}
        node={makeNode({
          isGroupHeader: true,
          label: "Classes",
          isExpanded: false,
          children: [makeNode({ iri: "http://ex.org/a", label: "a" })],
        })}
        onExpand={onExpand}
      />,
    );
    await userEvent.click(screen.getByText("Classes"));
    expect(onExpand).toHaveBeenCalled();
  });

  it("sets up drag refs when dragState is provided", () => {
    const dragState = {
      draggedIri: null,
      draggedLabel: null,
      dropTargetIri: null,
      isValidDropTarget: false,
      isDragActive: false,
      dragMode: "move" as const,
    };
    const { container } = render(
      <EntityTreeNodeRow
        {...baseProps}
        node={makeNode({ iri: "http://ex.org/A", label: "Alpha" })}
        dragState={dragState}
      />,
    );
    // The treeitem should still render
    const item = container.querySelector(".tree-item");
    expect(item).not.toBeNull();
  });

  it("fires onDragEnterNode when isOver is true and dragState is set", () => {
    mockIsOver = true;
    const onDragEnterNode = vi.fn();
    const dragState = {
      draggedIri: "http://ex.org/Other",
      draggedLabel: "Other",
      dropTargetIri: null,
      isValidDropTarget: false,
      isDragActive: true,
      dragMode: "move" as const,
    };
    const { container } = render(
      <EntityTreeNodeRow
        {...baseProps}
        node={makeNode({ iri: "http://ex.org/A", label: "Alpha" })}
        dragState={dragState}
        onDragEnterNode={onDragEnterNode}
      />,
    );
    const item = container.querySelector(".tree-item");
    expect(item).not.toBeNull();
    // The pointerEnter handler should be set since isOver=true and isDndEnabled=true
    fireEvent.pointerEnter(item!);
    expect(onDragEnterNode).toHaveBeenCalledWith("http://ex.org/A");
    mockIsOver = false;
  });

  it("fires onDragLeaveNode when drag is active", () => {
    const onDragLeaveNode = vi.fn();
    const dragState = {
      draggedIri: "http://ex.org/Other",
      draggedLabel: "Other",
      dropTargetIri: "http://ex.org/A",
      isValidDropTarget: true,
      isDragActive: true,
      dragMode: "move" as const,
    };
    const { container } = render(
      <EntityTreeNodeRow
        {...baseProps}
        node={makeNode({ iri: "http://ex.org/A", label: "Alpha" })}
        dragState={dragState}
        onDragLeaveNode={onDragLeaveNode}
      />,
    );
    const item = container.querySelector(".tree-item");
    expect(item).not.toBeNull();
    fireEvent.pointerLeave(item!);
    expect(onDragLeaveNode).toHaveBeenCalled();
  });

  it("sets correct paddingLeft based on depth", () => {
    const { container } = render(
      <EntityTreeNodeRow
        {...baseProps}
        node={makeNode({ iri: "http://ex.org/A", label: "Alpha" })}
        depth={3}
      />,
    );
    const treeItem = container.querySelector(".tree-item");
    expect(treeItem).not.toBeNull();
    expect(treeItem!.getAttribute("style")).toContain("padding-left: 68px");
  });
});
