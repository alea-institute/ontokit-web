import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RejectSuggestionDialog } from "@/components/suggestions/RejectSuggestionDialog";

// Mock lucide-react
vi.mock("lucide-react", () => ({
  XCircle: (props: Record<string, unknown>) => (
    <span data-testid="xcircle-icon" {...props} />
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

describe("RejectSuggestionDialog", () => {
  it("does not render when closed", () => {
    render(
      <RejectSuggestionDialog
        open={false}
        onOpenChange={mockOnOpenChange}
        onConfirm={mockOnConfirm}
      />,
    );
    expect(screen.queryByTestId("dialog")).toBeNull();
  });

  it("renders dialog title and description when open", () => {
    render(
      <RejectSuggestionDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onConfirm={mockOnConfirm}
      />,
    );
    expect(screen.getByText("Reject Suggestion")).toBeDefined();
    expect(
      screen.getByText(/Provide a reason for rejecting/),
    ).toBeDefined();
  });

  it("shows character count", () => {
    render(
      <RejectSuggestionDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onConfirm={mockOnConfirm}
      />,
    );
    expect(screen.getByText("0/1000 characters")).toBeDefined();
  });

  it("disables Reject button when reason is empty", () => {
    render(
      <RejectSuggestionDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onConfirm={mockOnConfirm}
      />,
    );
    const rejectBtn = screen.getByRole("button", { name: "Reject" });
    expect(rejectBtn.hasAttribute("disabled")).toBe(true);
  });

  it("updates character count as user types", async () => {
    const user = userEvent.setup();
    render(
      <RejectSuggestionDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onConfirm={mockOnConfirm}
      />,
    );
    await user.type(
      screen.getByLabelText("Reason for rejection"),
      "Bad naming",
    );
    expect(screen.getByText("10/1000 characters")).toBeDefined();
  });

  it("calls onConfirm with trimmed reason on submit", async () => {
    const user = userEvent.setup();
    mockOnConfirm.mockResolvedValue(undefined);
    render(
      <RejectSuggestionDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onConfirm={mockOnConfirm}
      />,
    );

    await user.type(
      screen.getByLabelText("Reason for rejection"),
      "Not aligned  ",
    );
    await user.click(screen.getByRole("button", { name: "Reject" }));

    await waitFor(() => {
      expect(mockOnConfirm).toHaveBeenCalledWith("Not aligned");
      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("shows error when onConfirm fails", async () => {
    const user = userEvent.setup();
    mockOnConfirm.mockRejectedValue(new Error("Rejection failed"));
    render(
      <RejectSuggestionDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onConfirm={mockOnConfirm}
      />,
    );

    await user.type(
      screen.getByLabelText("Reason for rejection"),
      "Reason",
    );
    await user.click(screen.getByRole("button", { name: "Reject" }));

    await waitFor(() => {
      expect(screen.getByText("Rejection failed")).toBeDefined();
    });
  });

  it("calls onOpenChange(false) on Cancel click", async () => {
    const user = userEvent.setup();
    render(
      <RejectSuggestionDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onConfirm={mockOnConfirm}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });
});
