import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { ResizablePanelDivider } from "@/components/editor/ResizablePanelDivider";

describe("ResizablePanelDivider", () => {
  const defaultProps = {
    width: 320,
    onWidthChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with drag-to-resize title", () => {
    render(<ResizablePanelDivider {...defaultProps} />);
    expect(screen.getByTitle("Drag to resize")).toBeDefined();
  });

  it("renders with cursor-col-resize class", () => {
    const { container } = render(<ResizablePanelDivider {...defaultProps} />);
    const divider = container.querySelector(".cursor-col-resize");
    expect(divider).not.toBeNull();
  });

  it("calls onWidthChange during mouse drag", () => {
    render(<ResizablePanelDivider {...defaultProps} />);
    const divider = screen.getByTitle("Drag to resize");

    fireEvent.mouseDown(divider, { clientX: 320 });
    fireEvent.mouseMove(document, { clientX: 400 });

    expect(defaultProps.onWidthChange).toHaveBeenCalledWith(400);
  });

  it("clamps width to minWidth", () => {
    render(<ResizablePanelDivider {...defaultProps} minWidth={200} />);
    const divider = screen.getByTitle("Drag to resize");

    fireEvent.mouseDown(divider, { clientX: 320 });
    fireEvent.mouseMove(document, { clientX: 120 });

    expect(defaultProps.onWidthChange).toHaveBeenCalledWith(200);
  });

  it("clamps width to maxWidth", () => {
    render(<ResizablePanelDivider {...defaultProps} maxWidth={600} />);
    const divider = screen.getByTitle("Drag to resize");

    fireEvent.mouseDown(divider, { clientX: 320 });
    fireEvent.mouseMove(document, { clientX: 720 });

    expect(defaultProps.onWidthChange).toHaveBeenCalledWith(600);
  });

  it("stops dragging on mouseup", () => {
    render(<ResizablePanelDivider {...defaultProps} />);
    const divider = screen.getByTitle("Drag to resize");

    fireEvent.mouseDown(divider, { clientX: 320 });
    fireEvent.mouseUp(document);

    defaultProps.onWidthChange.mockClear();
    fireEvent.mouseMove(document, { clientX: 500 });
    expect(defaultProps.onWidthChange).not.toHaveBeenCalled();
  });

  it("sets cursor and userSelect during drag", () => {
    render(<ResizablePanelDivider {...defaultProps} />);
    const divider = screen.getByTitle("Drag to resize");

    fireEvent.mouseDown(divider, { clientX: 320 });
    expect(document.body.style.cursor).toBe("col-resize");
    expect(document.body.style.userSelect).toBe("none");

    fireEvent.mouseUp(document);
    expect(document.body.style.cursor).toBe("");
    expect(document.body.style.userSelect).toBe("");
  });

  it("uses default minWidth of 200 and maxWidth of 600", () => {
    render(<ResizablePanelDivider width={300} onWidthChange={defaultProps.onWidthChange} />);
    const divider = screen.getByTitle("Drag to resize");

    fireEvent.mouseDown(divider, { clientX: 300 });
    fireEvent.mouseMove(document, { clientX: 0 });
    expect(defaultProps.onWidthChange).toHaveBeenCalledWith(200);

    fireEvent.mouseUp(document);
    defaultProps.onWidthChange.mockClear();

    fireEvent.mouseDown(divider, { clientX: 300 });
    fireEvent.mouseMove(document, { clientX: 1000 });
    expect(defaultProps.onWidthChange).toHaveBeenCalledWith(600);
  });
});
