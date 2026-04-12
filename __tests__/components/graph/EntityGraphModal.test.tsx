import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// ── Mocks ──────────────────────────────────────────────────────────

let capturedOnNavigateToClass: ((iri: string) => void) | undefined;
vi.mock("@/components/graph/OntologyGraph", () => ({
  OntologyGraph: ({ focusIri, projectId, onNavigateToClass }: { focusIri: string; projectId: string; onNavigateToClass?: (iri: string) => void }) => {
    capturedOnNavigateToClass = onNavigateToClass;
    return (
      <div data-testid="ontology-graph" data-focus-iri={focusIri} data-project-id={projectId}>
        <button data-testid="graph-action">Action</button>
      </div>
    );
  },
}));

import { EntityGraphModal } from "@/components/graph/EntityGraphModal";

// ── Fixtures ───────────────────────────────────────────────────────

const defaultProps = {
  focusIri: "urn:test:Class1",
  label: "Class1",
  projectId: "proj-1",
  branch: "main",
  onNavigateToClass: vi.fn(),
  onClose: vi.fn(),
};

// ── Tests ──────────────────────────────────────────────────────────

describe("EntityGraphModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --- Dialog semantics ---

  it("renders with role=dialog and aria-modal", () => {
    render(<EntityGraphModal {...defaultProps} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeDefined();
    expect(dialog.getAttribute("aria-modal")).toBe("true");
  });

  it("has aria-labelledby pointing to the title", () => {
    render(<EntityGraphModal {...defaultProps} />);
    const dialog = screen.getByRole("dialog");
    const labelId = dialog.getAttribute("aria-labelledby");
    expect(labelId).toBe("entity-graph-title");
    const title = document.getElementById(labelId!);
    expect(title).not.toBeNull();
  });

  // --- Title rendering ---

  it("renders the label in the title", () => {
    render(<EntityGraphModal {...defaultProps} />);
    expect(screen.getByText("Class1")).toBeDefined();
    expect(screen.getByText("Entity Graph")).toBeDefined();
  });

  // --- Close button ---

  it("renders a close button with aria-label", () => {
    render(<EntityGraphModal {...defaultProps} />);
    const closeBtn = screen.getByLabelText("Close graph modal");
    expect(closeBtn).toBeDefined();
  });

  it("calls onClose when close button is clicked", () => {
    render(<EntityGraphModal {...defaultProps} />);
    fireEvent.click(screen.getByLabelText("Close graph modal"));
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  // --- Escape key ---

  it("calls onClose when Escape is pressed", () => {
    render(<EntityGraphModal {...defaultProps} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it("does not call onClose for non-Escape keys", () => {
    render(<EntityGraphModal {...defaultProps} />);
    fireEvent.keyDown(document, { key: "Enter" });
    expect(defaultProps.onClose).not.toHaveBeenCalled();
  });

  // --- Focus management ---

  it("focuses the first focusable element on mount", () => {
    render(<EntityGraphModal {...defaultProps} />);
    // The close button is the first focusable element in the dialog
    const closeBtn = screen.getByLabelText("Close graph modal");
    expect(document.activeElement).toBe(closeBtn);
  });

  it("restores focus on unmount", () => {
    const button = document.createElement("button");
    button.textContent = "Trigger";
    document.body.appendChild(button);
    button.focus();
    expect(document.activeElement).toBe(button);

    const { unmount } = render(<EntityGraphModal {...defaultProps} />);
    // Focus moved to dialog
    expect(document.activeElement).not.toBe(button);

    unmount();
    expect(document.activeElement).toBe(button);

    document.body.removeChild(button);
  });

  // --- Focus trapping ---

  it("traps focus: shift-tab from first focusable wraps to last", () => {
    render(<EntityGraphModal {...defaultProps} />);
    const dialog = screen.getByRole("dialog");
    const focusables = dialog.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );

    expect(focusables.length).toBeGreaterThan(1);
    focusables[0].focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(focusables[focusables.length - 1]);
  });

  it("traps focus: tab from last focusable wraps to first", () => {
    render(<EntityGraphModal {...defaultProps} />);
    const dialog = screen.getByRole("dialog");
    const focusables = dialog.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );

    expect(focusables.length).toBeGreaterThan(1);
    focusables[focusables.length - 1].focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: false });
    expect(document.activeElement).toBe(focusables[0]);
  });

  it("does not trap focus when Tab is pressed but focus is in the middle", () => {
    render(<EntityGraphModal {...defaultProps} />);
    const dialog = screen.getByRole("dialog");
    const focusables = dialog.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );

    expect(focusables.length).toBeGreaterThan(1);
    // Focus the first element and press Tab (not at last) — should not prevent default
    focusables[0].focus();
    const event = new KeyboardEvent("keydown", { key: "Tab", bubbles: true });
    const preventSpy = vi.spyOn(event, "preventDefault");
    document.dispatchEvent(event);
    expect(preventSpy).not.toHaveBeenCalled();
  });

  // --- Esc keyboard hint ---

  it("renders Esc keyboard hint", () => {
    render(<EntityGraphModal {...defaultProps} />);
    expect(screen.getByText("Esc")).toBeDefined();
  });

  // --- Navigate callback ---

  it("calls onNavigateToClass and onClose when graph triggers navigation", () => {
    render(<EntityGraphModal {...defaultProps} />);
    expect(capturedOnNavigateToClass).toBeDefined();
    capturedOnNavigateToClass!("urn:target:Class");
    expect(defaultProps.onNavigateToClass).toHaveBeenCalledWith("urn:target:Class");
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  // --- OntologyGraph rendered ---

  it("renders the OntologyGraph component", () => {
    render(<EntityGraphModal {...defaultProps} />);
    expect(screen.getByTestId("ontology-graph")).toBeDefined();
  });
});
