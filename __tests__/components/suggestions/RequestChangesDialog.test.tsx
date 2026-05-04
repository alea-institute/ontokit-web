import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RequestChangesDialog } from "@/components/suggestions/RequestChangesDialog";

// Mock lucide-react
vi.mock("lucide-react", () => ({
  MessageSquareWarning: (props: Record<string, unknown>) => (
    <span data-testid="warning-icon" {...props} />
  ),
  Loader2: (props: Record<string, unknown>) => (
    <span data-testid="loader-icon" {...props} />
  ),
}));

// Mock dialog primitives
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-content">{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children, ...props }: Record<string, unknown>) => (
    <h2 {...props}>{children as React.ReactNode}</h2>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => (
    <p>{children}</p>
  ),
  DialogFooter: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

// Mock Button
vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

const mockOnConfirm = vi.fn();
const mockOnOpenChange = vi.fn();

beforeEach(() => {
  mockOnConfirm.mockReset();
  mockOnOpenChange.mockReset();
});

describe("RequestChangesDialog", () => {
  it("does not render when closed", () => {
    render(
      <RequestChangesDialog
        open={false}
        onOpenChange={mockOnOpenChange}
        onConfirm={mockOnConfirm}
      />,
    );
    expect(screen.queryByTestId("dialog")).toBeNull();
  });

  it("renders when open", () => {
    render(
      <RequestChangesDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onConfirm={mockOnConfirm}
      />,
    );
    expect(screen.getAllByText("Request Changes").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByLabelText("Feedback")).toBeDefined();
  });

  it("shows character count", () => {
    render(
      <RequestChangesDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onConfirm={mockOnConfirm}
      />,
    );
    expect(screen.getByText("0/1000 characters")).toBeDefined();
  });

  it("updates character count as user types", async () => {
    const user = userEvent.setup();
    render(
      <RequestChangesDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onConfirm={mockOnConfirm}
      />,
    );
    const textarea = screen.getByLabelText("Feedback");
    await user.type(textarea, "Hello");
    expect(screen.getByText("5/1000 characters")).toBeDefined();
  });

  it("disables submit when feedback is empty", () => {
    render(
      <RequestChangesDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onConfirm={mockOnConfirm}
      />,
    );
    const submitBtn = screen.getByRole("button", {
      name: "Request Changes",
    });
    expect(submitBtn.hasAttribute("disabled")).toBe(true);
  });

  it("calls onConfirm with trimmed feedback on submit", async () => {
    const user = userEvent.setup();
    mockOnConfirm.mockResolvedValue(undefined);
    render(
      <RequestChangesDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onConfirm={mockOnConfirm}
      />,
    );

    await user.type(screen.getByLabelText("Feedback"), "Fix the labels  ");
    await user.click(
      screen.getByRole("button", { name: "Request Changes" }),
    );

    await waitFor(() => {
      expect(mockOnConfirm).toHaveBeenCalledWith("Fix the labels");
    });
    await waitFor(() => {
      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("shows error when onConfirm rejects", async () => {
    const user = userEvent.setup();
    mockOnConfirm.mockRejectedValue(new Error("Server error"));
    render(
      <RequestChangesDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onConfirm={mockOnConfirm}
      />,
    );

    await user.type(screen.getByLabelText("Feedback"), "Fix it");
    await user.click(
      screen.getByRole("button", { name: "Request Changes" }),
    );

    await waitFor(() => {
      expect(screen.getByText("Server error")).toBeDefined();
    });
  });

  it("calls onOpenChange(false) when Cancel is clicked", async () => {
    const user = userEvent.setup();
    render(
      <RequestChangesDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onConfirm={mockOnConfirm}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });
});
