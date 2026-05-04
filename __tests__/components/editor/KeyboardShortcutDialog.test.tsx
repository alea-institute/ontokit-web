import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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
