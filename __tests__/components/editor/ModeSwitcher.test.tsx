import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock the editorModeStore
const mockSetEditorMode = vi.fn();
let mockEditorMode = "standard";

vi.mock("@/lib/stores/editorModeStore", () => ({
  useEditorModeStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      editorMode: mockEditorMode,
      setEditorMode: mockSetEditorMode,
    }),
}));

import { ModeSwitcher } from "@/components/editor/ModeSwitcher";

describe("ModeSwitcher", () => {
  beforeEach(() => {
    mockEditorMode = "standard";
    mockSetEditorMode.mockClear();
  });

  it("renders both mode buttons", () => {
    render(<ModeSwitcher />);
    expect(screen.getByRole("button", { name: "Standard" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Developer" })).toBeDefined();
  });

  it("marks the current mode as pressed", () => {
    render(<ModeSwitcher />);
    expect(screen.getByRole("button", { name: "Standard" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Developer" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("marks developer mode as pressed when active", () => {
    mockEditorMode = "developer";
    render(<ModeSwitcher />);
    expect(screen.getByRole("button", { name: "Standard" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("button", { name: "Developer" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("calls setEditorMode with 'developer' when Developer button is clicked", async () => {
    render(<ModeSwitcher />);
    await userEvent.click(screen.getByRole("button", { name: "Developer" }));
    expect(mockSetEditorMode).toHaveBeenCalledWith("developer");
  });

  it("calls setEditorMode with 'standard' when Standard button is clicked", async () => {
    mockEditorMode = "developer";
    render(<ModeSwitcher />);
    await userEvent.click(screen.getByRole("button", { name: "Standard" }));
    expect(mockSetEditorMode).toHaveBeenCalledWith("standard");
  });

  it("renders with a group role and label", () => {
    render(<ModeSwitcher />);
    const group = screen.getByRole("group");
    expect(group.getAttribute("aria-label")).toBe("Editor mode");
  });

  it("applies custom className", () => {
    render(<ModeSwitcher className="my-class" />);
    const group = screen.getByRole("group");
    expect(group.className).toContain("my-class");
  });

  it("applies active styling to the current mode button", () => {
    render(<ModeSwitcher />);
    const standardBtn = screen.getByRole("button", { name: "Standard" });
    const developerBtn = screen.getByRole("button", { name: "Developer" });
    expect(standardBtn.className).toContain("bg-white");
    expect(developerBtn.className).not.toContain("bg-white");
  });
});
