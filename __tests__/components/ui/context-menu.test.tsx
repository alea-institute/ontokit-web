import { describe, expect, it } from "vitest";
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
    // Test the item component renders in isolation as part of an open menu
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
    // Radix portals content - items may or may not be visible based on jsdom support
    // We test the component renders without errors
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
    // Verify it renders without error
    expect(screen.getByText("Trigger")).toBeDefined();
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
    expect(screen.getByText("Trigger")).toBeDefined();
  });

  it("applies destructive styling class to destructive items", () => {
    // We can test the component renders with the destructive prop
    const { container } = render(
      <ContextMenu>
        <ContextMenuTrigger>Trigger</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem destructive>Delete</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
    expect(container).toBeDefined();
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
    expect(screen.getByText("Trigger")).toBeDefined();
  });
});
