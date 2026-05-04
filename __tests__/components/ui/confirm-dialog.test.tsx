import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

describe("ConfirmDialog", () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    onConfirm: vi.fn().mockResolvedValue(undefined),
    title: "Delete Item",
    description: "Are you sure you want to delete this?",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders title and description when open", () => {
    render(<ConfirmDialog {...defaultProps} />);
    expect(screen.getByText("Delete Item")).toBeDefined();
    expect(screen.getByText("Are you sure you want to delete this?")).toBeDefined();
  });

  it("does not render when closed", () => {
    render(<ConfirmDialog {...defaultProps} open={false} />);
    expect(screen.queryByText("Delete Item")).toBeNull();
  });

  it("renders default button labels", () => {
    render(<ConfirmDialog {...defaultProps} />);
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Confirm" })).toBeDefined();
  });

  it("renders custom button labels", () => {
    render(
      <ConfirmDialog
        {...defaultProps}
        confirmLabel="Yes, delete"
        cancelLabel="No, keep it"
      />
    );
    expect(screen.getByRole("button", { name: "No, keep it" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Yes, delete" })).toBeDefined();
  });

  it("calls onConfirm and closes dialog on confirm click", async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const onOpenChange = vi.fn();
    render(
      <ConfirmDialog
        {...defaultProps}
        onConfirm={onConfirm}
        onOpenChange={onOpenChange}
      />
    );
    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: "Confirm" }));
    });
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("calls onOpenChange(false) on cancel click", async () => {
    const onOpenChange = vi.fn();
    render(<ConfirmDialog {...defaultProps} onOpenChange={onOpenChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows error message when onConfirm rejects", async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error("Server error"));
    render(<ConfirmDialog {...defaultProps} onConfirm={onConfirm} />);
    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: "Confirm" }));
    });
    expect(screen.getByText("Server error")).toBeDefined();
  });

  it("shows generic error when non-Error is thrown", async () => {
    const onConfirm = vi.fn().mockRejectedValue("something bad");
    render(<ConfirmDialog {...defaultProps} onConfirm={onConfirm} />);
    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: "Confirm" }));
    });
    expect(screen.getByText("An error occurred")).toBeDefined();
  });

  it("disables confirm button when confirmDisabled is true", () => {
    render(<ConfirmDialog {...defaultProps} confirmDisabled />);
    expect(
      (screen.getByRole("button", { name: "Confirm" }) as HTMLButtonElement).disabled
    ).toBe(true);
  });

  it("renders children content", () => {
    render(
      <ConfirmDialog {...defaultProps}>
        <p>Extra content here</p>
      </ConfirmDialog>
    );
    expect(screen.getByText("Extra content here")).toBeDefined();
  });

  it("shows Processing... text while submitting", async () => {
    let resolveConfirm: () => void;
    const onConfirm = vi.fn(
      () => new Promise<void>((resolve) => { resolveConfirm = resolve; })
    );
    render(<ConfirmDialog {...defaultProps} onConfirm={onConfirm} />);
    // Click confirm but don't await resolution
    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: "Confirm" }));
    });
    // Wait for "Processing..." to appear
    await screen.findByText("Processing...");
    // Resolve the promise
    await act(async () => {
      resolveConfirm!();
    });
  });
});
