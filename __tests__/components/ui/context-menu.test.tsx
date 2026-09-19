import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuLabel,
} from "@/components/ui/context-menu";

// Radix context menus open on right-click (contextmenu event)
function rightClick(element: Element) {
  fireEvent.contextMenu(element);
}

describe("ContextMenu", () => {
  it("renders the trigger content", () => {
    render(
      <ContextMenu>
        <ContextMenuTrigger>Right-click me</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem>Action</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
    expect(screen.getByText("Right-click me")).toBeDefined();
  });

  it("does not show menu content before right-click", () => {
    render(
      <ContextMenu>
        <ContextMenuTrigger>Trigger</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem>Edit</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
    expect(screen.queryByText("Edit")).toBeNull();
  });

  it("renders ContextMenuItem with text", () => {
    render(
      <ContextMenu>
        <ContextMenuTrigger>Trigger</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem>Copy</ContextMenuItem>
          <ContextMenuItem>Paste</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
    rightClick(screen.getByText("Trigger"));
    expect(screen.getAllByRole("menuitem").map(item => item.textContent)).toEqual(["Copy", "Paste"]);
  });

  it("renders ContextMenuLabel", () => {
    render(
      <ContextMenu>
        <ContextMenuTrigger>Trigger</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuLabel>Actions</ContextMenuLabel>
          <ContextMenuItem>Do thing</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
    rightClick(screen.getByText("Trigger"));
    expect(screen.getByText("Actions")).toBeDefined();
    expect(screen.getByRole("menuitem", { name: "Do thing" })).toBeDefined();
  });

  it("renders ContextMenuSeparator without crashing", () => {
    render(
      <ContextMenu>
        <ContextMenuTrigger>Trigger</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem>One</ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem>Two</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
    rightClick(screen.getByText("Trigger"));
    expect(screen.getByRole("separator")).toBeDefined();
    expect(screen.getAllByRole("menuitem")).toHaveLength(2);
  });

  it("applies destructive styling class to destructive items", () => {
    render(
      <ContextMenu>
        <ContextMenuTrigger>Trigger</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem destructive>Delete</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
    rightClick(screen.getByText("Trigger"));
    expect(screen.getByRole("menuitem", { name: "Delete" }).className).toContain("text-red-600");
  });

  it("renders multiple items without errors", () => {
    render(
      <ContextMenu>
        <ContextMenuTrigger>Trigger</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuLabel>File</ContextMenuLabel>
          <ContextMenuItem>Open</ContextMenuItem>
          <ContextMenuItem>Save</ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem destructive>Delete</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
    rightClick(screen.getByText("Trigger"));
    expect(screen.getByText("File")).toBeDefined();
    expect(screen.getAllByRole("menuitem").map(item => item.textContent)).toEqual(["Open", "Save", "Delete"]);
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("selects an enabled action once and closes the portal", () => {
    const select = vi.fn();
    render(<ContextMenu><ContextMenuTrigger>Trigger</ContextMenuTrigger><ContextMenuContent><ContextMenuItem onSelect={select}>Copy</ContextMenuItem></ContextMenuContent></ContextMenu>);
    rightClick(screen.getByText("Trigger"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Copy" }));
    expect(select).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).toBeNull();
  });
});
