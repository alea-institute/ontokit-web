import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import {
  useKeyboardShortcuts,
  formatShortcut,
  isMac,
  type ShortcutDefinition,
} from "@/lib/hooks/useKeyboardShortcuts";

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function fireKeydown(opts: Partial<KeyboardEventInit> = {}) {
  const event = new KeyboardEvent("keydown", {
    bubbles: true,
    cancelable: true,
    ...opts,
  });
  document.dispatchEvent(event);
  return event;
}

describe("useKeyboardShortcuts", () => {
  it("registers keydown event listener", () => {
    const addSpy = vi.spyOn(document, "addEventListener");
    const action = vi.fn();

    const shortcuts: ShortcutDefinition[] = [
      {
        id: "test",
        key: "s",
        modifiers: { ctrl: true },
        description: "Save",
        category: "General",
        action,
      },
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    expect(addSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
  });

  it("cleans up event listener on unmount", () => {
    const removeSpy = vi.spyOn(document, "removeEventListener");
    const action = vi.fn();

    const shortcuts: ShortcutDefinition[] = [
      {
        id: "test",
        key: "s",
        modifiers: { ctrl: true },
        description: "Save",
        category: "General",
        action,
      },
    ];

    const { unmount } = renderHook(() => useKeyboardShortcuts(shortcuts));
    unmount();

    expect(removeSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
  });

  it("does not register listener when shortcuts array is empty", () => {
    const addSpy = vi.spyOn(document, "addEventListener");

    renderHook(() => useKeyboardShortcuts([]));

    const keydownCalls = addSpy.mock.calls.filter((c) => c[0] === "keydown");
    expect(keydownCalls).toHaveLength(0);
  });

  it("calls action on matching Ctrl+key press", () => {
    const action = vi.fn();

    const shortcuts: ShortcutDefinition[] = [
      {
        id: "save",
        key: "s",
        modifiers: { ctrl: true },
        description: "Save",
        category: "General",
        action,
      },
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    fireKeydown({ key: "s", ctrlKey: true });

    expect(action).toHaveBeenCalledTimes(1);
  });

  it("calls action on matching Meta+key press (Mac-style)", () => {
    const action = vi.fn();

    const shortcuts: ShortcutDefinition[] = [
      {
        id: "save",
        key: "s",
        modifiers: { ctrl: true },
        description: "Save",
        category: "General",
        action,
      },
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    fireKeydown({ key: "s", metaKey: true });

    expect(action).toHaveBeenCalledTimes(1);
  });

  it("does not call action when modifier does not match", () => {
    const action = vi.fn();

    const shortcuts: ShortcutDefinition[] = [
      {
        id: "save",
        key: "s",
        modifiers: { ctrl: true },
        description: "Save",
        category: "General",
        action,
      },
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    // Press 's' without Ctrl
    fireKeydown({ key: "s" });

    expect(action).not.toHaveBeenCalled();
  });

  it("does not call action when key does not match", () => {
    const action = vi.fn();

    const shortcuts: ShortcutDefinition[] = [
      {
        id: "save",
        key: "s",
        modifiers: { ctrl: true },
        description: "Save",
        category: "General",
        action,
      },
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    fireKeydown({ key: "d", ctrlKey: true });

    expect(action).not.toHaveBeenCalled();
  });

  it("handles Shift modifier correctly", () => {
    const action = vi.fn();

    const shortcuts: ShortcutDefinition[] = [
      {
        id: "test",
        key: "z",
        modifiers: { ctrl: true, shift: true },
        description: "Redo",
        category: "General",
        action,
      },
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    // Without shift should not match
    fireKeydown({ key: "z", ctrlKey: true });
    expect(action).not.toHaveBeenCalled();

    // With shift should match
    fireKeydown({ key: "z", ctrlKey: true, shiftKey: true });
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("handles Alt modifier correctly", () => {
    const action = vi.fn();

    const shortcuts: ShortcutDefinition[] = [
      {
        id: "test",
        key: "p",
        modifiers: { alt: true },
        description: "Preview",
        category: "General",
        action,
      },
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    fireKeydown({ key: "p", altKey: true });
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("skips shortcut when input element is focused and shortcut is not global", () => {
    const action = vi.fn();

    const shortcuts: ShortcutDefinition[] = [
      {
        id: "test",
        key: "s",
        modifiers: { ctrl: true },
        description: "Save",
        category: "General",
        action,
        global: false,
      },
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    // Create and focus an input
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();

    fireKeydown({ key: "s", ctrlKey: true });

    expect(action).not.toHaveBeenCalled();

    document.body.removeChild(input);
  });

  it("fires shortcut when input is focused and shortcut is global", () => {
    const action = vi.fn();

    const shortcuts: ShortcutDefinition[] = [
      {
        id: "test",
        key: "s",
        modifiers: { ctrl: true },
        description: "Save",
        category: "General",
        action,
        global: true,
      },
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();

    fireKeydown({ key: "s", ctrlKey: true });

    expect(action).toHaveBeenCalledTimes(1);

    document.body.removeChild(input);
  });

  it("suppresses shortcuts when a Radix dialog is open", () => {
    const action = vi.fn();

    const shortcuts: ShortcutDefinition[] = [
      {
        id: "test",
        key: "s",
        modifiers: { ctrl: true },
        description: "Save",
        category: "General",
        action,
      },
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    // Create a fake Radix dialog element
    const dialog = document.createElement("div");
    dialog.setAttribute("data-state", "open");
    dialog.setAttribute("role", "dialog");
    document.body.appendChild(dialog);

    fireKeydown({ key: "s", ctrlKey: true });

    expect(action).not.toHaveBeenCalled();

    document.body.removeChild(dialog);
  });
});

describe("formatShortcut", () => {
  it("formats Ctrl+S shortcut", () => {
    const def: ShortcutDefinition = {
      id: "save",
      key: "s",
      modifiers: { ctrl: true },
      description: "Save",
      category: "General",
      action: () => {},
    };

    // In jsdom, navigator.userAgent does not contain "Mac"
    const formatted = formatShortcut(def);
    expect(formatted).toBe("Ctrl+S");
  });

  it("formats shortcut with multiple modifiers", () => {
    const def: ShortcutDefinition = {
      id: "redo",
      key: "z",
      modifiers: { ctrl: true, shift: true },
      description: "Redo",
      category: "General",
      action: () => {},
    };

    const formatted = formatShortcut(def);
    expect(formatted).toBe("Ctrl+Shift+Z");
  });

  it("formats shortcut with no modifiers", () => {
    const def: ShortcutDefinition = {
      id: "escape",
      key: "Escape",
      description: "Close",
      category: "General",
      action: () => {},
    };

    const formatted = formatShortcut(def);
    expect(formatted).toBe("Escape");
  });
});

describe("isMac", () => {
  it("returns false in jsdom (no Mac user agent)", () => {
    expect(isMac()).toBe(false);
  });
});
