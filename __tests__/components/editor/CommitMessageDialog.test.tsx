import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommitMessageDialog } from "@/components/editor/CommitMessageDialog";

describe("CommitMessageDialog", () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    onConfirm: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders dialog title and description when open", () => {
    render(<CommitMessageDialog {...defaultProps} />);
    expect(screen.getByText("Save Changes")).toBeDefined();
    expect(
      screen.getByText("Enter a commit message describing your changes.")
    ).toBeDefined();
  });

  it("does not render when closed", () => {
    render(<CommitMessageDialog {...defaultProps} open={false} />);
    expect(screen.queryByText("Save Changes")).toBeNull();
  });

  it("shows default message in input", () => {
    render(<CommitMessageDialog {...defaultProps} />);
    const input = screen.getByPlaceholderText("Describe your changes...");
    expect((input as HTMLInputElement).value).toBe("Update ontology");
  });

  it("shows custom default message", () => {
    render(
      <CommitMessageDialog {...defaultProps} defaultMessage="Add new class" />
    );
    const input = screen.getByPlaceholderText("Describe your changes...");
    expect((input as HTMLInputElement).value).toBe("Add new class");
  });

  it("renders Save & Commit and Cancel buttons", () => {
    render(<CommitMessageDialog {...defaultProps} />);
    expect(screen.getByRole("button", { name: "Save & Commit" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDefined();
  });

  it("shows character count", () => {
    render(<CommitMessageDialog {...defaultProps} />);
    // "Update ontology" is 15 chars
    expect(screen.getByText("15/500 characters")).toBeDefined();
  });

  it("calls onConfirm with the message on form submit", async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(<CommitMessageDialog {...defaultProps} onConfirm={onConfirm} />);
    const input = screen.getByPlaceholderText("Describe your changes...");
    await userEvent.clear(input);
    await userEvent.type(input, "Fix label typo");
    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: "Save & Commit" }));
    });
    expect(onConfirm).toHaveBeenCalledWith("Fix label typo");
  });

  it("disables submit button when commit message is only whitespace", async () => {
    render(<CommitMessageDialog {...defaultProps} defaultMessage="   " />);
    // With only whitespace, message.trim() is empty, so button is disabled
    const submitBtn = screen.getByRole("button", { name: "Save & Commit" });
    expect((submitBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it("disables Save & Commit button when input is empty", async () => {
    render(<CommitMessageDialog {...defaultProps} />);
    const input = screen.getByPlaceholderText("Describe your changes...");
    await userEvent.clear(input);
    const submitBtn = screen.getByRole("button", { name: "Save & Commit" });
    expect((submitBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it("calls onOpenChange(false) on cancel click", async () => {
    const onOpenChange = vi.fn();
    render(
      <CommitMessageDialog {...defaultProps} onOpenChange={onOpenChange} />
    );
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows error when onConfirm rejects", async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error("Network error"));
    render(<CommitMessageDialog {...defaultProps} onConfirm={onConfirm} />);
    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: "Save & Commit" }));
    });
    expect(screen.getByText("Network error")).toBeDefined();
  });

  it("has maxLength 500 on input", () => {
    render(<CommitMessageDialog {...defaultProps} />);
    const input = screen.getByPlaceholderText("Describe your changes...");
    expect((input as HTMLInputElement).maxLength).toBe(500);
  });
});
