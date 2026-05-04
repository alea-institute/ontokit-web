import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";

// Mock dnd-kit
vi.mock("@dnd-kit/core", () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dnd-context">{children}</div>
  ),
  PointerSensor: class {},
  KeyboardSensor: class {},
  useSensor: () => ({}),
  useSensors: () => [],
}));

// Mock RootDropZone
vi.mock("@/components/editor/shared/RootDropZone", () => ({
  RootDropZone: (props: Record<string, unknown>) => (
    <div data-testid="root-drop-zone" data-active={String(props.isActive)} />
  ),
}));

// Mock createPortal to render inline for testing
vi.mock("react-dom", async () => {
  const actual = await vi.importActual("react-dom");
  return {
    ...actual,
    createPortal: (node: React.ReactNode) => node,
  };
});

import { DraggableTreeWrapper } from "@/components/editor/shared/DraggableTreeWrapper";

describe("DraggableTreeWrapper", () => {
  const defaultProps = {
    isDragActive: false,
    draggedLabel: null as string | null,
    dragMode: "move" as const,
    onDragStart: vi.fn(),
    onDragOver: vi.fn(),
    onDragEnd: vi.fn(),
    onDragCancel: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders children inside DndContext", () => {
    render(
      <DraggableTreeWrapper {...defaultProps}>
        <div data-testid="child-content">Hello</div>
      </DraggableTreeWrapper>,
    );
    expect(screen.getByTestId("dnd-context")).toBeDefined();
    expect(screen.getByTestId("child-content")).toBeDefined();
  });

  it("renders RootDropZone with isActive=true when drag active", () => {
    render(
      <DraggableTreeWrapper {...defaultProps} isDragActive={true} draggedLabel="MyClass">
        <div>Child</div>
      </DraggableTreeWrapper>,
    );
    expect(screen.getByTestId("root-drop-zone").getAttribute("data-active")).toBe("true");
  });

  it("does not render overlay when drag is not active", () => {
    render(
      <DraggableTreeWrapper {...defaultProps}>
        <div>Child</div>
      </DraggableTreeWrapper>,
    );
    // No overlay label should be present
    expect(screen.queryByText("MyClass")).toBeNull();
  });

  it("renders overlay label after pointer move when drag is active", () => {
    render(
      <DraggableTreeWrapper {...defaultProps} isDragActive={true} draggedLabel="MyClass">
        <div>Child</div>
      </DraggableTreeWrapper>,
    );
    // PointerOverlay won't render until pointermove fires (pos starts at 0,0)
    act(() => {
      window.dispatchEvent(new PointerEvent("pointermove", { clientX: 100, clientY: 100 }));
    });
    expect(screen.getByText("MyClass")).toBeDefined();
  });

  it("does not render overlay when draggedLabel is null even if active", () => {
    const { container } = render(
      <DraggableTreeWrapper {...defaultProps} isDragActive={true} draggedLabel={null}>
        <div>Child</div>
      </DraggableTreeWrapper>,
    );
    // PointerOverlay (div.tree-drag-overlay) must not be rendered when draggedLabel is null
    expect(container.querySelector(".tree-drag-overlay")).toBeNull();
  });

  it("passes isActive=false to RootDropZone when not dragging", () => {
    render(
      <DraggableTreeWrapper {...defaultProps}>
        <div>Child</div>
      </DraggableTreeWrapper>,
    );
    expect(screen.getByTestId("root-drop-zone").getAttribute("data-active")).toBe("false");
  });
});
