import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockSetContinuousEditing = vi.fn();
let mockContinuousEditing = false;

vi.mock("@/lib/stores/editorModeStore", () => ({
  useEditorModeStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      continuousEditing: mockContinuousEditing,
      setContinuousEditing: mockSetContinuousEditing,
    }),
}));

import { ContinuousEditingToggle } from "@/components/editor/ContinuousEditingToggle";

describe("ContinuousEditingToggle", () => {
  beforeEach(() => {
    mockContinuousEditing = false;
    mockSetContinuousEditing.mockClear();
  });

  it("renders the toggle button", () => {
    render(<ContinuousEditingToggle />);
    expect(screen.getByRole("button")).toBeDefined();
  });

  it("shows aria-pressed false when continuous editing is off", () => {
    render(<ContinuousEditingToggle />);
    expect(screen.getByRole("button").getAttribute("aria-pressed")).toBe("false");
  });

  it("shows aria-pressed true when continuous editing is on", () => {
    mockContinuousEditing = true;
    render(<ContinuousEditingToggle />);
    expect(screen.getByRole("button").getAttribute("aria-pressed")).toBe("true");
  });

  it("toggles continuous editing on click", async () => {
    render(<ContinuousEditingToggle />);
    await userEvent.click(screen.getByRole("button"));
    expect(mockSetContinuousEditing).toHaveBeenCalledWith(true);
  });

  it("has correct aria-label when off", () => {
    render(<ContinuousEditingToggle />);
    expect(screen.getByRole("button").getAttribute("aria-label")).toBe(
      "Continuous editing OFF \u2014 classes open read-only"
    );
  });

  it("has correct aria-label when on", () => {
    mockContinuousEditing = true;
    render(<ContinuousEditingToggle />);
    expect(screen.getByRole("button").getAttribute("aria-label")).toBe(
      "Continuous editing ON \u2014 classes open in edit mode"
    );
  });
});
