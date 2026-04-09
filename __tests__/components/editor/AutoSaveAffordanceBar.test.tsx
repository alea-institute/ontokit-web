import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock dependencies
vi.mock("@/lib/stores/editorModeStore", () => ({
  useEditorModeStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ hideSaveButton: false }),
}));

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { AutoSaveAffordanceBar } from "@/components/editor/AutoSaveAffordanceBar";

describe("AutoSaveAffordanceBar", () => {
  it("renders idle state with 'Auto-save on' text", () => {
    render(<AutoSaveAffordanceBar status="idle" />);
    expect(screen.getByText("Auto-save on")).toBeDefined();
  });

  it("renders saving state with 'Saving...' text", () => {
    render(<AutoSaveAffordanceBar status="saving" />);
    expect(screen.getByText("Saving...")).toBeDefined();
  });

  it("renders saved state with 'Saved' text", () => {
    render(<AutoSaveAffordanceBar status="saved" />);
    expect(screen.getByText("Saved")).toBeDefined();
  });

  it("renders draft state with 'Draft saved' text", () => {
    render(<AutoSaveAffordanceBar status="draft" />);
    expect(screen.getByText("Draft saved")).toBeDefined();
  });

  it("renders error state with error message", () => {
    render(<AutoSaveAffordanceBar status="error" error="Connection lost" />);
    expect(screen.getByText("Connection lost")).toBeDefined();
  });

  it("renders error state with default error message", () => {
    render(<AutoSaveAffordanceBar status="error" />);
    expect(screen.getByText("Failed to save")).toBeDefined();
  });

  it("shows Retry button in error state when onRetry is provided", () => {
    const onRetry = vi.fn();
    render(<AutoSaveAffordanceBar status="error" onRetry={onRetry} />);
    expect(screen.getByText("Retry")).toBeDefined();
  });

  it("calls onRetry when Retry is clicked", async () => {
    const onRetry = vi.fn();
    render(<AutoSaveAffordanceBar status="error" onRetry={onRetry} />);
    await userEvent.click(screen.getByText("Retry"));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("renders validationError when provided", () => {
    render(
      <AutoSaveAffordanceBar
        status="draft"
        validationError="Invalid Turtle syntax"
      />
    );
    expect(screen.getByText("Invalid Turtle syntax")).toBeDefined();
  });

  it("has role='status' for accessibility", () => {
    render(<AutoSaveAffordanceBar status="idle" />);
    expect(screen.getByRole("status")).toBeDefined();
  });

  it("uses assertive aria-live for error states", () => {
    const { container } = render(
      <AutoSaveAffordanceBar status="error" error="Err" />
    );
    const statusEl = container.querySelector("[role='status']");
    expect(statusEl?.getAttribute("aria-live")).toBe("assertive");
  });

  it("uses polite aria-live for non-error states", () => {
    const { container } = render(<AutoSaveAffordanceBar status="saved" />);
    const statusEl = container.querySelector("[role='status']");
    expect(statusEl?.getAttribute("aria-live")).toBe("polite");
  });

  it("renders Cancel button when onCancel is provided", () => {
    const onCancel = vi.fn();
    render(<AutoSaveAffordanceBar status="draft" onCancel={onCancel} />);
    expect(screen.getByText("Cancel")).toBeDefined();
  });

  it("calls onCancel when Cancel button is clicked", async () => {
    const onCancel = vi.fn();
    render(<AutoSaveAffordanceBar status="draft" onCancel={onCancel} />);
    await userEvent.click(screen.getByText("Cancel"));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("renders Save button in draft state", () => {
    render(
      <AutoSaveAffordanceBar status="draft" onManualSave={() => {}} />
    );
    expect(screen.getByText("Save")).toBeDefined();
  });
});
