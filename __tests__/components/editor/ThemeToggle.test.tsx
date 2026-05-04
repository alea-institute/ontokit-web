import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockSetTheme = vi.fn();
let mockTheme = "system";

vi.mock("@/lib/stores/editorModeStore", () => ({
  useEditorModeStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      theme: mockTheme,
      setTheme: mockSetTheme,
    }),
}));

import { ThemeToggle } from "@/components/editor/ThemeToggle";

describe("ThemeToggle", () => {
  beforeEach(() => {
    mockTheme = "system";
    mockSetTheme.mockClear();
  });

  it("renders all three theme buttons", () => {
    render(<ThemeToggle />);
    expect(screen.getByRole("button", { name: "Light" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Dark" })).toBeDefined();
    expect(screen.getByRole("button", { name: "System" })).toBeDefined();
  });

  it("marks system as pressed by default", () => {
    render(<ThemeToggle />);
    expect(screen.getByRole("button", { name: "System" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Light" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("marks dark as pressed when theme is dark", () => {
    mockTheme = "dark";
    render(<ThemeToggle />);
    expect(screen.getByRole("button", { name: "Dark" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("calls setTheme with 'light' when Light is clicked", async () => {
    render(<ThemeToggle />);
    await userEvent.click(screen.getByRole("button", { name: "Light" }));
    expect(mockSetTheme).toHaveBeenCalledWith("light");
  });

  it("renders with group role and label", () => {
    render(<ThemeToggle />);
    const group = screen.getByRole("group");
    expect(group.getAttribute("aria-label")).toBe("Theme");
  });

  it("applies custom className", () => {
    render(<ThemeToggle className="my-class" />);
    const group = screen.getByRole("group");
    expect(group.className).toContain("my-class");
  });
});
