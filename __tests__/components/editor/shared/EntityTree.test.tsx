import { describe, expect, it, vi, beforeEach } from "vitest";

// Polyfill CSS.escape and scrollIntoView for jsdom
if (typeof CSS === "undefined") {
  (globalThis as Record<string, unknown>).CSS = { escape: (s: string) => s };
}
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {});

import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock dnd-kit
vi.mock("@dnd-kit/core", () => ({
  useDraggable: () => ({ attributes: {}, listeners: {}, setNodeRef: vi.fn() }),
  useDroppable: () => ({ setNodeRef: vi.fn(), isOver: false }),
  DndContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PointerSensor: class {},
  KeyboardSensor: class {},
  useSensor: () => ({}),
  useSensors: () => [],
}));

import { EntityTree } from "@/components/editor/shared/EntityTree";
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

describe("EntityTree", () => {
  const defaultProps = {
    nodes: [] as EntityTreeNode[],
    onSelect: vi.fn(),
    onExpand: vi.fn(),
    onCollapse: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with tree role and aria-label", () => {
    render(<EntityTree {...defaultProps} />);
    const tree = screen.getByRole("tree");
    expect(tree).toBeDefined();
    expect(tree.getAttribute("aria-label")).toBe("Ontology class hierarchy");
  });

  it("renders nodes", () => {
    const nodes = [
      makeNode({ iri: "http://ex.org/A", label: "Alpha" }),
      makeNode({ iri: "http://ex.org/B", label: "Beta" }),
    ];
    render(<EntityTree {...defaultProps} nodes={nodes} />);
    expect(screen.getByText("Alpha")).toBeDefined();
    expect(screen.getByText("Beta")).toBeDefined();
  });

  it("renders children when node is expanded", () => {
    const nodes = [
      makeNode({
        iri: "http://ex.org/Parent",
        label: "Parent",
        isExpanded: true,
        hasChildren: true,
        children: [makeNode({ iri: "http://ex.org/Child", label: "Child" })],
      }),
    ];
    render(<EntityTree {...defaultProps} nodes={nodes} />);
    expect(screen.getByText("Parent")).toBeDefined();
    expect(screen.getByText("Child")).toBeDefined();
  });

  it("does not render children when node is collapsed", () => {
    const nodes = [
      makeNode({
        iri: "http://ex.org/Parent",
        label: "Parent",
        isExpanded: false,
        hasChildren: true,
        children: [makeNode({ iri: "http://ex.org/Child", label: "Child" })],
      }),
    ];
    render(<EntityTree {...defaultProps} nodes={nodes} />);
    expect(screen.getByText("Parent")).toBeDefined();
    expect(screen.queryByText("Child")).toBeNull();
  });

  it("calls onSelect when a node is clicked", async () => {
    const onSelect = vi.fn();
    const nodes = [makeNode({ iri: "http://ex.org/A", label: "Alpha" })];
    render(<EntityTree {...defaultProps} nodes={nodes} onSelect={onSelect} />);
    await userEvent.click(screen.getByText("Alpha"));
    expect(onSelect).toHaveBeenCalledWith("http://ex.org/A");
  });

  it("enables keyboard nav when prop is set", () => {
    render(<EntityTree {...defaultProps} enableKeyboardNav />);
    const tree = screen.getByRole("tree");
    expect(tree.getAttribute("tabindex")).toBe("0");
  });

  it("does not have tabIndex when keyboard nav disabled", () => {
    render(<EntityTree {...defaultProps} enableKeyboardNav={false} />);
    const tree = screen.getByRole("tree");
    expect(tree.getAttribute("tabindex")).toBeNull();
  });

  it("handles ArrowDown keyboard navigation", () => {
    const nodes = [
      makeNode({ iri: "http://ex.org/A", label: "Alpha" }),
      makeNode({ iri: "http://ex.org/B", label: "Beta" }),
    ];
    render(
      <EntityTree
        {...defaultProps}
        nodes={nodes}
        selectedIri="http://ex.org/A"
        enableKeyboardNav
      />,
    );
    const tree = screen.getByRole("tree");
    fireEvent.keyDown(tree, { key: "ArrowDown" });
    // Should set focus to Beta (next node)
    expect(tree.getAttribute("aria-activedescendant")).toContain("ex_org_B");
  });

  it("handles ArrowUp keyboard navigation", () => {
    const nodes = [
      makeNode({ iri: "http://ex.org/A", label: "Alpha" }),
      makeNode({ iri: "http://ex.org/B", label: "Beta" }),
    ];
    render(
      <EntityTree
        {...defaultProps}
        nodes={nodes}
        selectedIri="http://ex.org/B"
        enableKeyboardNav
      />,
    );
    const tree = screen.getByRole("tree");
    fireEvent.keyDown(tree, { key: "ArrowUp" });
    expect(tree.getAttribute("aria-activedescendant")).toContain("ex_org_A");
  });

  it("handles Enter key to select focused node", () => {
    const onSelect = vi.fn();
    const nodes = [makeNode({ iri: "http://ex.org/A", label: "Alpha" })];
    render(
      <EntityTree
        {...defaultProps}
        nodes={nodes}
        selectedIri="http://ex.org/A"
        onSelect={onSelect}
        enableKeyboardNav
      />,
    );
    const tree = screen.getByRole("tree");
    fireEvent.keyDown(tree, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith("http://ex.org/A");
  });

  it("handles ArrowRight to expand a collapsed node", () => {
    const onExpand = vi.fn();
    const nodes = [
      makeNode({
        iri: "http://ex.org/A",
        label: "Alpha",
        hasChildren: true,
        isExpanded: false,
      }),
    ];
    render(
      <EntityTree
        {...defaultProps}
        nodes={nodes}
        selectedIri="http://ex.org/A"
        onExpand={onExpand}
        enableKeyboardNav
      />,
    );
    const tree = screen.getByRole("tree");
    fireEvent.keyDown(tree, { key: "ArrowRight" });
    expect(onExpand).toHaveBeenCalledWith("http://ex.org/A");
  });

  it("handles ArrowLeft to collapse an expanded node", () => {
    const onCollapse = vi.fn();
    const nodes = [
      makeNode({
        iri: "http://ex.org/A",
        label: "Alpha",
        hasChildren: true,
        isExpanded: true,
        children: [makeNode({ iri: "http://ex.org/B", label: "Beta" })],
      }),
    ];
    render(
      <EntityTree
        {...defaultProps}
        nodes={nodes}
        selectedIri="http://ex.org/A"
        onCollapse={onCollapse}
        enableKeyboardNav
      />,
    );
    const tree = screen.getByRole("tree");
    fireEvent.keyDown(tree, { key: "ArrowLeft" });
    expect(onCollapse).toHaveBeenCalledWith("http://ex.org/A");
  });

  it("handles ArrowRight to focus first child when node is already expanded", () => {
    const nodes = [
      makeNode({
        iri: "http://ex.org/A",
        label: "Alpha",
        hasChildren: true,
        isExpanded: true,
        children: [makeNode({ iri: "http://ex.org/B", label: "Beta" })],
      }),
    ];
    render(
      <EntityTree
        {...defaultProps}
        nodes={nodes}
        selectedIri="http://ex.org/A"
        enableKeyboardNav
      />,
    );
    const tree = screen.getByRole("tree");
    fireEvent.keyDown(tree, { key: "ArrowRight" });
    // Should focus child Beta
    expect(tree.getAttribute("aria-activedescendant")).toContain("ex_org_B");
  });

  it("handles ArrowLeft to navigate to parent when node is collapsed", () => {
    const nodes = [
      makeNode({
        iri: "http://ex.org/A",
        label: "Alpha",
        hasChildren: true,
        isExpanded: true,
        children: [
          makeNode({ iri: "http://ex.org/B", label: "Beta", hasChildren: false }),
        ],
      }),
    ];
    render(
      <EntityTree
        {...defaultProps}
        nodes={nodes}
        selectedIri="http://ex.org/B"
        enableKeyboardNav
      />,
    );
    const tree = screen.getByRole("tree");
    fireEvent.keyDown(tree, { key: "ArrowLeft" });
    // Beta is not expanded, so should navigate to parent Alpha
    expect(tree.getAttribute("aria-activedescendant")).toContain("ex_org_A");
  });

  it("handles Space key to select focused node", () => {
    const onSelect = vi.fn();
    const nodes = [makeNode({ iri: "http://ex.org/A", label: "Alpha" })];
    render(
      <EntityTree
        {...defaultProps}
        nodes={nodes}
        selectedIri="http://ex.org/A"
        onSelect={onSelect}
        enableKeyboardNav
      />,
    );
    const tree = screen.getByRole("tree");
    fireEvent.keyDown(tree, { key: " " });
    expect(onSelect).toHaveBeenCalledWith("http://ex.org/A");
  });

  it("clears focusedIri on blur", () => {
    const nodes = [
      makeNode({ iri: "http://ex.org/A", label: "Alpha" }),
      makeNode({ iri: "http://ex.org/B", label: "Beta" }),
    ];
    render(
      <EntityTree
        {...defaultProps}
        nodes={nodes}
        selectedIri="http://ex.org/A"
        enableKeyboardNav
      />,
    );
    const tree = screen.getByRole("tree");
    // First ArrowDown to set focusedIri
    fireEvent.keyDown(tree, { key: "ArrowDown" });
    expect(tree.getAttribute("aria-activedescendant")).toContain("ex_org_B");
    // Now blur to clear
    fireEvent.blur(tree);
    expect(tree.getAttribute("aria-activedescendant")).toBeNull();
  });

  it("ignores keyboard events when enableKeyboardNav is false", () => {
    const onExpand = vi.fn();
    const nodes = [
      makeNode({
        iri: "http://ex.org/A",
        label: "Alpha",
        hasChildren: true,
      }),
    ];
    render(
      <EntityTree
        {...defaultProps}
        nodes={nodes}
        selectedIri="http://ex.org/A"
        onExpand={onExpand}
        enableKeyboardNav={false}
      />,
    );
    const tree = screen.getByRole("tree");
    fireEvent.keyDown(tree, { key: "ArrowRight" });
    expect(onExpand).not.toHaveBeenCalled();
  });

  it("does not act on ArrowRight for leaf nodes", () => {
    const onExpand = vi.fn();
    const nodes = [
      makeNode({
        iri: "http://ex.org/A",
        label: "Alpha",
        hasChildren: false,
      }),
    ];
    render(
      <EntityTree
        {...defaultProps}
        nodes={nodes}
        selectedIri="http://ex.org/A"
        onExpand={onExpand}
        enableKeyboardNav
      />,
    );
    const tree = screen.getByRole("tree");
    fireEvent.keyDown(tree, { key: "ArrowRight" });
    expect(onExpand).not.toHaveBeenCalled();
  });

  it("handles ArrowLeft at root with no parent (no-op)", () => {
    const onCollapse = vi.fn();
    const nodes = [
      makeNode({
        iri: "http://ex.org/A",
        label: "Alpha",
        hasChildren: false,
        isExpanded: false,
      }),
    ];
    render(
      <EntityTree
        {...defaultProps}
        nodes={nodes}
        selectedIri="http://ex.org/A"
        onCollapse={onCollapse}
        enableKeyboardNav
      />,
    );
    const tree = screen.getByRole("tree");
    fireEvent.keyDown(tree, { key: "ArrowLeft" });
    // Node is not expanded and has no parent, so nothing should happen
    expect(onCollapse).not.toHaveBeenCalled();
    expect(tree.getAttribute("aria-activedescendant")).toBeNull();
  });

  it("handles keyboard events with no selected or focused node", () => {
    const onSelect = vi.fn();
    const nodes = [makeNode({ iri: "http://ex.org/A", label: "Alpha" })];
    render(
      <EntityTree
        {...defaultProps}
        nodes={nodes}
        onSelect={onSelect}
        enableKeyboardNav
      />,
    );
    const tree = screen.getByRole("tree");
    // ArrowDown with no selection should still move focus
    fireEvent.keyDown(tree, { key: "ArrowDown" });
    expect(tree.getAttribute("aria-activedescendant")).toContain("ex_org_A");
  });

  it("passes draftIris, searchQuery, and dragState props to child nodes", () => {
    const draftIris = new Set(["http://ex.org/A"]);
    const nodes = [makeNode({ iri: "http://ex.org/A", label: "Alpha" })];
    render(
      <EntityTree
        {...defaultProps}
        nodes={nodes}
        draftIris={draftIris}
        searchQuery="Alp"
      />,
    );
    // Draft indicator should be visible
    expect(screen.getByLabelText("Unsaved draft")).not.toBeNull();
  });
});
