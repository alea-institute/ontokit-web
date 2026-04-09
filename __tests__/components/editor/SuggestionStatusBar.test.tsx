import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SuggestionStatusBar } from "@/components/editor/SuggestionStatusBar";

describe("SuggestionStatusBar", () => {
  const defaultProps = {
    status: "active" as const,
    changesCount: 0,
    onSubmit: vi.fn(),
    onDiscard: vi.fn(),
  };

  it("returns null for idle status", () => {
    const { container } = render(
      <SuggestionStatusBar {...defaultProps} status="idle" />
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders 'Suggestion mode active' when active with 0 changes", () => {
    render(<SuggestionStatusBar {...defaultProps} status="active" changesCount={0} />);
    expect(screen.getByText("Suggestion mode active")).toBeDefined();
  });

  it("renders change count text for singular change", () => {
    render(<SuggestionStatusBar {...defaultProps} status="active" changesCount={1} />);
    expect(screen.getByText("1 unsaved change")).toBeDefined();
  });

  it("renders change count text for plural changes", () => {
    render(<SuggestionStatusBar {...defaultProps} status="active" changesCount={3} />);
    expect(screen.getByText("3 unsaved changes")).toBeDefined();
  });

  it("shows Discard button in active state", () => {
    render(<SuggestionStatusBar {...defaultProps} status="active" />);
    expect(screen.getByText("Discard")).toBeDefined();
  });

  it("calls onDiscard when Discard is clicked", async () => {
    const onDiscard = vi.fn();
    render(
      <SuggestionStatusBar {...defaultProps} status="active" onDiscard={onDiscard} />
    );
    await userEvent.click(screen.getByText("Discard"));
    expect(onDiscard).toHaveBeenCalledOnce();
  });

  it("shows Submit button when active with changes > 0", () => {
    render(
      <SuggestionStatusBar {...defaultProps} status="active" changesCount={2} />
    );
    expect(screen.getByText("Submit (2)")).toBeDefined();
  });

  it("does not show Submit button when active with 0 changes", () => {
    render(
      <SuggestionStatusBar {...defaultProps} status="active" changesCount={0} />
    );
    expect(screen.queryByText(/Submit/)).toBeNull();
  });

  it("calls onSubmit when Submit button is clicked", async () => {
    const onSubmit = vi.fn();
    render(
      <SuggestionStatusBar
        {...defaultProps}
        status="active"
        changesCount={1}
        onSubmit={onSubmit}
      />
    );
    await userEvent.click(screen.getByText("Submit (1)"));
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it("renders saving state with spinner text", () => {
    render(<SuggestionStatusBar {...defaultProps} status="saving" changesCount={1} />);
    expect(screen.getByText("Saving suggestion...")).toBeDefined();
  });

  it("renders submitting state", () => {
    render(
      <SuggestionStatusBar {...defaultProps} status="submitting" changesCount={1} />
    );
    expect(
      screen.getByText("Submitting suggestions for review...")
    ).toBeDefined();
  });

  it("renders submitted state", () => {
    render(
      <SuggestionStatusBar {...defaultProps} status="submitted" changesCount={0} />
    );
    expect(
      screen.getByText("Suggestions submitted for review")
    ).toBeDefined();
  });

  it("renders error state with error message", () => {
    render(
      <SuggestionStatusBar
        {...defaultProps}
        status="error"
        error="Network failure"
      />
    );
    expect(screen.getByText("Network failure")).toBeDefined();
  });

  it("renders error state with default message", () => {
    render(
      <SuggestionStatusBar {...defaultProps} status="error" />
    );
    expect(screen.getByText("Failed to save suggestion")).toBeDefined();
  });

  it("shows Retry button in error state when onRetry is provided", async () => {
    const onRetry = vi.fn();
    render(
      <SuggestionStatusBar {...defaultProps} status="error" onRetry={onRetry} />
    );
    await userEvent.click(screen.getByText("Retry"));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("does not show Retry button when onRetry is not provided", () => {
    render(
      <SuggestionStatusBar {...defaultProps} status="error" />
    );
    expect(screen.queryByText("Retry")).toBeNull();
  });
});
