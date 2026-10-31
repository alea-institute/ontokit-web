import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { KeyboardShortcutDialog } from "@/components/editor/KeyboardShortcutDialog";
import type { ShortcutDefinition } from "@/lib/hooks/useKeyboardShortcuts";

const shortcuts: ShortcutDefinition[] = [
  {
    id: "save",
    key: "s",
    modifiers: { ctrl: true },
    description: "Save changes",
    category: "Editing",
    action: vi.fn(),
  },
  {
    id: "search",
    key: "f",
    modifiers: { ctrl: true },
    description: "Search classes",
    category: "Navigation",
    action: vi.fn(),
  },
  {
    id: "undo",
    key: "z",
    modifiers: { ctrl: true },
    description: "Undo",
    category: "Editing",
    action: vi.fn(),
  },
];

describe("KeyboardShortcutDialog", () => {
  it.each(["Escape", "Close"])("returns focus to its opener after %s", async (close) => {
    function Help() {
      const [open, setOpen] = useState(false);
      return <><button onClick={() => setOpen(true)}>Open help</button><KeyboardShortcutDialog open={open} onOpenChange={setOpen} shortcuts={shortcuts} /></>;
    }
    render(<Help />);
    const opener = screen.getByRole("button", { name: "Open help" });
    opener.focus();
    fireEvent.click(opener);
    const dialog = screen.getByRole("dialog", { name: "Keyboard Shortcuts" });
    expect(dialog.contains(document.activeElement)).toBe(true);
    if (close === "Escape") fireEvent.keyDown(dialog, { key: "Escape" });
    else fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });

  it("explains text-field scope and separates field completion from source commits", () => {
    render(<KeyboardShortcutDialog open onOpenChange={vi.fn()} shortcuts={shortcuts} />);
    expect(screen.getByText(/Shortcuts marked.*work in text fields/)).toBeTruthy();
    expect(screen.getByText(/Use Save in the source editor to commit Turtle changes/)).toBeTruthy();
  });

  it("renders title and description when open", () => {
    render(
      <KeyboardShortcutDialog open={true} onOpenChange={vi.fn()} shortcuts={shortcuts} />
    );
    expect(screen.getByText("Keyboard Shortcuts")).toBeDefined();
    expect(screen.getByText("Available keyboard shortcuts in the editor")).toBeDefined();
  });

  it("renders grouped shortcuts by category", () => {
    render(
      <KeyboardShortcutDialog open={true} onOpenChange={vi.fn()} shortcuts={shortcuts} />
    );
    expect(screen.getByText("Editing")).toBeDefined();
    expect(screen.getByText("Navigation")).toBeDefined();
  });

  it("renders shortcut descriptions", () => {
    render(
      <KeyboardShortcutDialog open={true} onOpenChange={vi.fn()} shortcuts={shortcuts} />
    );
    expect(screen.getByText("Save changes")).toBeDefined();
    expect(screen.getByText("Search classes")).toBeDefined();
    expect(screen.getByText("Undo")).toBeDefined();
  });

  it("does not render content when closed", () => {
    render(
      <KeyboardShortcutDialog open={false} onOpenChange={vi.fn()} shortcuts={shortcuts} />
    );
    expect(screen.queryByText("Keyboard Shortcuts")).toBeNull();
  });

  it("renders empty state with no shortcuts", () => {
    render(
      <KeyboardShortcutDialog open={true} onOpenChange={vi.fn()} shortcuts={[]} />
    );
    expect(screen.getByText("Keyboard Shortcuts")).toBeDefined();
  });
});
