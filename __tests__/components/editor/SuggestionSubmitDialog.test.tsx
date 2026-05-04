import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SuggestionSubmitDialog } from "@/components/editor/SuggestionSubmitDialog";

describe("SuggestionSubmitDialog", () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    onConfirm: vi.fn().mockResolvedValue(undefined),
    entitiesModified: ["Person", "Animal"],
    changesCount: 3,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders dialog title and description when open", () => {
    render(<SuggestionSubmitDialog {...defaultProps} />);
    expect(screen.getByText("Submit Suggestions")).toBeDefined();
    expect(
      screen.getByText(
        "Your changes will be submitted for review by a project editor."
      )
    ).toBeDefined();
  });

  it("does not render when closed", () => {
    render(<SuggestionSubmitDialog {...defaultProps} open={false} />);
    expect(screen.queryByText("Submit Suggestions")).toBeNull();
  });

  it("shows modified entities and changes count", () => {
    render(<SuggestionSubmitDialog {...defaultProps} />);
    expect(screen.getByText("Person")).toBeDefined();
    expect(screen.getByText("Animal")).toBeDefined();
    expect(screen.getByText(/3 changes/)).toBeDefined();
  });

  it("shows singular 'change' for count of 1", () => {
    render(
      <SuggestionSubmitDialog {...defaultProps} changesCount={1} />
    );
    expect(screen.getByText(/1 change\b/)).toBeDefined();
  });

  it("does not show entities section when empty", () => {
    render(
      <SuggestionSubmitDialog
        {...defaultProps}
        entitiesModified={[]}
        changesCount={0}
      />
    );
    expect(screen.queryByText("Modified items")).toBeNull();
  });

  it("shows character count", () => {
    render(<SuggestionSubmitDialog {...defaultProps} />);
    expect(screen.getByText("0/1000 characters")).toBeDefined();
  });

  it("updates character count when typing", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<SuggestionSubmitDialog {...defaultProps} />);

    const textarea = screen.getByPlaceholderText(
      /Updated labels for FamilyRelation/
    );
    await user.type(textarea, "Some changes");

    expect(screen.getByText("12/1000 characters")).toBeDefined();
  });

  it("calls onConfirm with summary on submit", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<SuggestionSubmitDialog {...defaultProps} />);

    const textarea = screen.getByPlaceholderText(
      /Updated labels for FamilyRelation/
    );
    await user.type(textarea, "My changes");
    await user.click(screen.getByText("Submit for Review"));

    await waitFor(() => {
      expect(defaultProps.onConfirm).toHaveBeenCalledWith("My changes");
    });
  });

  it("calls onConfirm with undefined when summary is empty", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<SuggestionSubmitDialog {...defaultProps} />);

    await user.click(screen.getByText("Submit for Review"));

    await waitFor(() => {
      expect(defaultProps.onConfirm).toHaveBeenCalledWith(undefined);
    });
  });

  it("calls onOpenChange(false) on Cancel", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<SuggestionSubmitDialog {...defaultProps} />);

    await user.click(screen.getByText("Cancel"));
    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows error message when onConfirm rejects", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const failingConfirm = vi
      .fn()
      .mockRejectedValue(new Error("Network error"));

    render(
      <SuggestionSubmitDialog {...defaultProps} onConfirm={failingConfirm} />
    );

    await user.click(screen.getByText("Submit for Review"));

    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeDefined();
    });
  });

  it("shows generic error for non-Error rejections", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const failingConfirm = vi.fn().mockRejectedValue("string error");

    render(
      <SuggestionSubmitDialog {...defaultProps} onConfirm={failingConfirm} />
    );

    await user.click(screen.getByText("Submit for Review"));

    await waitFor(() => {
      expect(screen.getByText("Failed to submit")).toBeDefined();
    });
  });

  it("shows Submitting state during async submit", async () => {
    let resolveConfirm: () => void;
    const slowConfirm = vi.fn(
      () => new Promise<void>((resolve) => { resolveConfirm = resolve; })
    );

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <SuggestionSubmitDialog {...defaultProps} onConfirm={slowConfirm} />
    );

    await user.click(screen.getByText("Submit for Review"));

    expect(screen.getByText("Submitting...")).toBeDefined();

    // Resolve to clean up
    await waitFor(() => { resolveConfirm!(); });
  });
});
