import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import { useState } from "react";
import userEvent from "@testing-library/user-event";
import { api } from "@/lib/api/client";
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
    const processing = await screen.findByRole("button", { name: "Processing..." });
    expect((processing as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Cancel" }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(processing);
    await userEvent.keyboard("{Escape}");
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(defaultProps.onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeDefined();
    // Resolve the promise
    await act(async () => {
      resolveConfirm!();
    });
    expect(defaultProps.onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
  });
  it("keeps a failed confirmation open, then closes after a successful retry", async () => {
    const confirm = vi.fn().mockRejectedValueOnce(new Error("Please retry")).mockResolvedValueOnce(undefined);
    function Harness() {
      const [open, setOpen] = useState(true);
      return <ConfirmDialog {...defaultProps} open={open} onOpenChange={setOpen} onConfirm={confirm} />;
    }
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await screen.findByText("Please retry");
    expect(screen.getByRole("dialog")).toBeDefined();
    expect((screen.getByRole("button", { name: "Confirm" }) as HTMLButtonElement).disabled).toBe(false);
    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(screen.queryByText("Please retry")).toBeNull();
  });

});

it("renders a structured API rejection and retries through the HTTP client", async () => {
  let fail = true;
  vi.stubGlobal("fetch", vi.fn(async () => fail ? new Response(JSON.stringify({ detail: "Deletion forbidden" }), { status: 403, headers: { "Content-Type": "application/json" } }) : new Response(null, { status: 204 })));
  try {
    const close = vi.fn();
    render(<ConfirmDialog open onOpenChange={close} title="Delete" description="Delete this item" onConfirm={() => api.delete("/fixture")} />);
    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await screen.findByText("Deletion forbidden"); expect(close).not.toHaveBeenCalled();
    fail = false; await userEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(close).toHaveBeenCalledWith(false));
  } finally { vi.unstubAllGlobals(); }
});
