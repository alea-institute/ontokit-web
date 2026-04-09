import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastContainer } from "@/components/ui/toast-container";
import type { Toast } from "@/lib/context/ToastContext";

// Mock ToastContext
const mockRemoveToast = vi.fn();
let mockToasts: Toast[] = [];

vi.mock("@/lib/context/ToastContext", () => ({
  useToast: () => ({
    toasts: mockToasts,
    removeToast: mockRemoveToast,
  }),
}));

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  X: (props: Record<string, unknown>) => <span data-testid="x-icon" {...props} />,
  CheckCircle2: (props: Record<string, unknown>) => (
    <span data-testid="check-icon" {...props} />
  ),
  AlertTriangle: (props: Record<string, unknown>) => (
    <span data-testid="alert-icon" {...props} />
  ),
  XCircle: (props: Record<string, unknown>) => (
    <span data-testid="xcircle-icon" {...props} />
  ),
  Info: (props: Record<string, unknown>) => <span data-testid="info-icon" {...props} />,
}));

beforeEach(() => {
  mockToasts = [];
  mockRemoveToast.mockClear();
});

describe("ToastContainer", () => {
  it("renders nothing when there are no toasts", () => {
    const { container } = render(<ToastContainer />);
    expect(container.innerHTML).toBe("");
  });

  it("renders a success toast with title", () => {
    mockToasts = [
      { id: "1", type: "success", title: "Saved successfully" },
    ];
    render(<ToastContainer />);
    expect(screen.getByRole("alert")).toBeDefined();
    expect(screen.getByText("Saved successfully")).toBeDefined();
  });

  it("renders a toast with description", () => {
    mockToasts = [
      {
        id: "1",
        type: "info",
        title: "Info",
        description: "Some details here",
      },
    ];
    render(<ToastContainer />);
    expect(screen.getByText("Some details here")).toBeDefined();
  });

  it("renders multiple toasts", () => {
    mockToasts = [
      { id: "1", type: "success", title: "First" },
      { id: "2", type: "error", title: "Second" },
    ];
    render(<ToastContainer />);
    expect(screen.getAllByRole("alert")).toHaveLength(2);
    expect(screen.getByText("First")).toBeDefined();
    expect(screen.getByText("Second")).toBeDefined();
  });

  it("renders dismiss button and calls removeToast on click", async () => {
    const user = userEvent.setup();
    mockToasts = [{ id: "t1", type: "warning", title: "Warning" }];
    render(<ToastContainer />);

    const dismissBtn = screen.getByRole("button", {
      name: "Dismiss notification",
    });
    expect(dismissBtn).toBeDefined();

    await user.click(dismissBtn);
    // removeToast is called after a 150ms timeout
    await vi.waitFor(() => {
      expect(mockRemoveToast).toHaveBeenCalledWith("t1");
    });
  });

  it("renders toast action button and invokes action onClick", async () => {
    const user = userEvent.setup();
    const actionClick = vi.fn();
    mockToasts = [
      {
        id: "a1",
        type: "error",
        title: "Error",
        action: { label: "Retry", onClick: actionClick },
      },
    ];
    render(<ToastContainer />);

    const actionBtn = screen.getByRole("button", { name: "Retry" });
    expect(actionBtn).toBeDefined();

    await user.click(actionBtn);
    expect(actionClick).toHaveBeenCalled();
    await vi.waitFor(() => {
      expect(mockRemoveToast).toHaveBeenCalledWith("a1");
    });
  });

  it("applies correct border style classes per toast type", () => {
    mockToasts = [{ id: "e1", type: "error", title: "Err" }];
    render(<ToastContainer />);
    const alert = screen.getByRole("alert");
    expect(alert.className).toContain("border-red-200");
  });
});
