import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

// Track onSelect callbacks to simulate menu item clicks
let capturedItems: Array<{
  text: string;
  onSelect?: () => void;
  destructive?: boolean;
}> = [];
let _separatorCount = 0;

vi.mock("@/components/ui/context-menu", () => ({
  ContextMenuContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="context-menu-content">{children}</div>
  ),
  ContextMenuItem: ({
    children,
    onSelect,
    destructive,
    disabled,
  }: {
    children: React.ReactNode;
    onSelect?: () => void;
    destructive?: boolean;
    disabled?: boolean;
  }) => {
    const text =
      typeof children === "string"
        ? children
        : React.Children.toArray(children)
            .filter((c) => typeof c === "string")
            .join("");
    capturedItems.push({ text, onSelect, destructive });
    return (
      <button
        data-testid={`menu-item-${text.trim()}`}
        data-destructive={destructive ? "true" : undefined}
        disabled={disabled}
        onClick={onSelect}
      >
        {children}
      </button>
    );
  },
  ContextMenuSeparator: () => {
    _separatorCount++;
    return <hr data-testid="separator" />;
  },
  ContextMenuLabel: ({ children }: { children: React.ReactNode }) => (
    <p data-testid="menu-label">{children}</p>
  ),
}));

vi.mock("lucide-react", () => ({
  Plus: () => <span data-testid="icon-plus" />,
  Copy: () => <span data-testid="icon-copy" />,
  Code: () => <span data-testid="icon-code" />,
  Trash2: () => <span data-testid="icon-trash" />,
  Sparkles: () => <span />,
  Lock: () => <span data-testid="icon-lock" />,
}));

import { BulkExpansionMenuContext, TreeNodeContextMenu } from "@/components/editor/TreeNodeContextMenu";

const baseNode = { iri: "http://example.org/ontology#Person", label: "Person" };

describe("TreeNodeContextMenu", () => {
  beforeEach(() => {
    capturedItems = [];
    _separatorCount = 0;
  });

  it("gates bulk expansion on AI access and loaded subclasses", () => {
    const open = vi.fn();
    const child = { iri: "https://example.org/Child", label: "Child" };
    const renderMenu = (targets: typeof child[], reason?: string) => (
      <BulkExpansionMenuContext.Provider value={{ getTargets: () => targets, open }}>
        <TreeNodeContextMenu node={baseNode} onSuggest={vi.fn()} suggestLockedReason={reason} />
      </BulkExpansionMenuContext.Provider>
    );
    const item = () => screen.getByRole<HTMLButtonElement>("button", { name: "Suggest subclasses for each subclass…" });

    const { rerender } = render(renderMenu([child], "Your project role does not allow AI suggestions."));
    expect(item().disabled).toBe(true);
    expect(screen.getByText("Your project role does not allow AI suggestions.")).toBeDefined();
    rerender(renderMenu([]));
    expect(item().disabled).toBe(true);
    expect(screen.getByText("This class has no subclasses.")).toBeDefined();
    rerender(
      <BulkExpansionMenuContext.Provider value={{ getTargets: () => [], open }}>
        <TreeNodeContextMenu node={{ ...baseNode, hasChildren: true }} onSuggest={vi.fn()} />
      </BulkExpansionMenuContext.Provider>,
    );
    expect(item().disabled).toBe(true);
    expect(screen.getByText("Expand this class in the tree to choose its subclasses.")).toBeDefined();
    rerender(renderMenu([child]));
    expect(item().disabled).toBe(false);
    fireEvent.click(item());
    expect(open).toHaveBeenCalledExactlyOnceWith(baseNode.iri, [child]);
  });

  it("offers generation only when a callback is provided and passes the selected kind", () => {
    const onSuggest = vi.fn();
    const { rerender } = render(<TreeNodeContextMenu node={baseNode} />);
    expect(screen.queryByRole("button", { name: "Suggest Subclasses" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Suggest Siblings" })).toBeNull();
    rerender(<TreeNodeContextMenu node={baseNode} onSuggest={onSuggest} />);
    fireEvent.click(screen.getByRole("button", { name: "Suggest Subclasses" }));
    fireEvent.click(screen.getByRole("button", { name: "Suggest Siblings" }));
    expect(onSuggest.mock.calls).toEqual([[baseNode.iri, "children"], [baseNode.iri, "siblings"]]);
  });

  it("locks both generation items and shows the reason", () => {
    const onSuggest = vi.fn();
    render(<TreeNodeContextMenu node={baseNode} onSuggest={onSuggest} suggestLockedReason="AI budget exhausted." />);
    for (const name of ["Suggest Subclasses", "Suggest Siblings"]) {
      const item = screen.getByRole("button", { name }) as HTMLButtonElement;
      expect(item.disabled).toBe(true);
      fireEvent.click(item);
    }
    expect(screen.getByText("AI budget exhausted.")).toBeDefined();
    expect(onSuggest).not.toHaveBeenCalled();
  });

  // ── Rendering with all callbacks ─────────────────────────────────
  describe("with all callbacks provided", () => {
    it("renders all menu items", () => {
      render(
        <TreeNodeContextMenu
          node={baseNode}
          onAddChild={vi.fn()}
          onCopyIri={vi.fn()}
          onViewInSource={vi.fn()}
          onDelete={vi.fn()}
        />
      );
      expect(screen.getByTestId("context-menu-content")).not.toBeNull();
      expect(screen.getByTestId("menu-item-Add Subclass")).not.toBeNull();
      expect(screen.getByTestId("menu-item-Copy IRI")).not.toBeNull();
      expect(screen.getByTestId("menu-item-View in Source")).not.toBeNull();
      expect(screen.getByTestId("menu-item-Delete")).not.toBeNull();
    });

    it("renders two separators", () => {
      render(
        <TreeNodeContextMenu
          node={baseNode}
          onAddChild={vi.fn()}
          onCopyIri={vi.fn()}
          onViewInSource={vi.fn()}
          onDelete={vi.fn()}
        />
      );
      const seps = screen.getAllByTestId("separator");
      expect(seps).toHaveLength(2);
    });

    it("renders correct icons", () => {
      render(
        <TreeNodeContextMenu
          node={baseNode}
          onAddChild={vi.fn()}
          onCopyIri={vi.fn()}
          onViewInSource={vi.fn()}
          onDelete={vi.fn()}
        />
      );
      expect(screen.getByTestId("icon-plus")).not.toBeNull();
      expect(screen.getByTestId("icon-copy")).not.toBeNull();
      expect(screen.getByTestId("icon-code")).not.toBeNull();
      expect(screen.getByTestId("icon-trash")).not.toBeNull();
  });
});


  // ── Conditional rendering ────────────────────────────────────────
  describe("conditional rendering", () => {
    it("hides Add Subclass when onAddChild is not provided", () => {
      render(
        <TreeNodeContextMenu
          node={baseNode}
          onCopyIri={vi.fn()}
          onViewInSource={vi.fn()}
        />
      );
      expect(screen.queryByTestId("menu-item-Add Subclass")).toBeNull();
    });

    it("hides Copy IRI when onCopyIri is not provided", () => {
      render(
        <TreeNodeContextMenu
          node={baseNode}
          onAddChild={vi.fn()}
          onViewInSource={vi.fn()}
        />
      );
      expect(screen.queryByTestId("menu-item-Copy IRI")).toBeNull();
    });

    it("hides View in Source when onViewInSource is not provided", () => {
      render(
        <TreeNodeContextMenu
          node={baseNode}
          onAddChild={vi.fn()}
          onCopyIri={vi.fn()}
        />
      );
      expect(screen.queryByTestId("menu-item-View in Source")).toBeNull();
    });

    it("hides Delete when onDelete is not provided", () => {
      render(
        <TreeNodeContextMenu
          node={baseNode}
          onAddChild={vi.fn()}
          onCopyIri={vi.fn()}
        />
      );
      expect(screen.queryByTestId("menu-item-Delete")).toBeNull();
    });

    it("renders no items when no callbacks are provided", () => {
      render(<TreeNodeContextMenu node={baseNode} />);
      expect(screen.getByTestId("context-menu-content")).not.toBeNull();
      expect(screen.queryByTestId("menu-item-Add Subclass")).toBeNull();
      expect(screen.queryByTestId("menu-item-Copy IRI")).toBeNull();
      expect(screen.queryByTestId("menu-item-View in Source")).toBeNull();
      expect(screen.queryByTestId("menu-item-Delete")).toBeNull();
    });

    it("renders no separators when only middle items are provided", () => {
      render(
        <TreeNodeContextMenu
          node={baseNode}
          onCopyIri={vi.fn()}
          onViewInSource={vi.fn()}
        />
      );
      expect(screen.queryByTestId("separator")).toBeNull();
    });
  });

  // ── Callback invocations ─────────────────────────────────────────
  describe("callback invocations", () => {
    it("calls onAddChild with the node IRI", () => {
      const onAddChild = vi.fn();
      render(
        <TreeNodeContextMenu node={baseNode} onAddChild={onAddChild} />
      );
      fireEvent.click(screen.getByTestId("menu-item-Add Subclass"));
      expect(onAddChild).toHaveBeenCalledWith(baseNode.iri);
    });

    it("calls onCopyIri with the node IRI", () => {
      const onCopyIri = vi.fn();
      render(
        <TreeNodeContextMenu node={baseNode} onCopyIri={onCopyIri} />
      );
      fireEvent.click(screen.getByTestId("menu-item-Copy IRI"));
      expect(onCopyIri).toHaveBeenCalledWith(baseNode.iri);
    });

    it("calls onViewInSource with the node IRI", () => {
      const onViewInSource = vi.fn();
      render(
        <TreeNodeContextMenu node={baseNode} onViewInSource={onViewInSource} />
      );
      fireEvent.click(screen.getByTestId("menu-item-View in Source"));
      expect(onViewInSource).toHaveBeenCalledWith(baseNode.iri);
    });

    it("calls onDelete with the node IRI and label", () => {
      const onDelete = vi.fn();
      render(
        <TreeNodeContextMenu node={baseNode} onDelete={onDelete} />
      );
      fireEvent.click(screen.getByTestId("menu-item-Delete"));
      expect(onDelete).toHaveBeenCalledWith(baseNode.iri, "Person");
    });
  });

  // ── Label fallback ───────────────────────────────────────────────
  describe("label fallback", () => {
    it("uses IRI as label when node.label is empty", () => {
      const onDelete = vi.fn();
      const nodeWithoutLabel = { iri: "http://example.org#Thing", label: "" };
      render(
        <TreeNodeContextMenu node={nodeWithoutLabel} onDelete={onDelete} />
      );
      fireEvent.click(screen.getByTestId("menu-item-Delete"));
      expect(onDelete).toHaveBeenCalledWith(
        "http://example.org#Thing",
        "http://example.org#Thing"
      );
    });
  });

  // ── Delete is marked destructive ─────────────────────────────────
  describe("destructive styling", () => {
    it("marks Delete menu item as destructive", () => {
      render(
        <TreeNodeContextMenu node={baseNode} onDelete={vi.fn()} />
      );
      const deleteItem = screen.getByTestId("menu-item-Delete");
      expect(deleteItem.getAttribute("data-destructive")).toBe("true");
    });

    it("does not mark non-delete items as destructive", () => {
      render(
        <TreeNodeContextMenu
          node={baseNode}
          onAddChild={vi.fn()}
          onCopyIri={vi.fn()}
          onViewInSource={vi.fn()}
        />
      );
      const addItem = screen.getByTestId("menu-item-Add Subclass");
      expect(addItem.getAttribute("data-destructive")).toBeNull();
      const copyItem = screen.getByTestId("menu-item-Copy IRI");
      expect(copyItem.getAttribute("data-destructive")).toBeNull();
      const viewItem = screen.getByTestId("menu-item-View in Source");
      expect(viewItem.getAttribute("data-destructive")).toBeNull();
    });
  });
});
