import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock dnd-kit
let mockIsOver = false;
vi.mock("@dnd-kit/core", () => ({
  useDroppable: () => ({
    setNodeRef: vi.fn(),
    get isOver() { return mockIsOver; },
  }),
}));

import { RootDropZone } from "@/components/editor/shared/RootDropZone";

describe("RootDropZone", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsOver = false;
  });

  it("returns null when not active", () => {
    const { container } = render(<RootDropZone isActive={false} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders drop zone text when active", () => {
    render(<RootDropZone isActive={true} />);
    expect(screen.getByText("Drop here to make root class")).toBeDefined();
  });

  it("applies default styling when not hovered", () => {
    render(<RootDropZone isActive={true} />);
    const text = screen.getByText("Drop here to make root class");
    expect(text.className).toContain("text-slate-400");
  });

  it("applies highlight styling when isOver is true", () => {
    mockIsOver = true;
    render(<RootDropZone isActive={true} />);
    const text = screen.getByText("Drop here to make root class");
    expect(text.className).toContain("text-primary-600");
  });
});
