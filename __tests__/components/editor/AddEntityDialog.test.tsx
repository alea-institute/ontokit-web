import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AddEntityDialog } from "@/components/editor/AddEntityDialog";

vi.mock("@/lib/ontology/iriGeneration", () => ({
  labelToLocalName: (label: string) => label.replace(/\s+/g, ""),
  uuidToBase62: () => "TestBase62Uuid",
}));

describe("AddEntityDialog", () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    onConfirm: vi.fn(),
    iriPattern: "uuid" as const,
    nextNumeric: 1,
    ontologyNamespace: "http://example.org/ontology#",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders dialog title and description when open", () => {
    render(<AddEntityDialog {...defaultProps} />);
    expect(screen.getByText("Add Entity")).toBeDefined();
    expect(
      screen.getByText("Create a new entity in this ontology")
    ).toBeDefined();
  });

  it("does not render when closed", () => {
    render(<AddEntityDialog {...defaultProps} open={false} />);
    expect(screen.queryByText("Add Entity")).toBeNull();
  });

  it("shows subclass description when parentIri is provided", () => {
    render(
      <AddEntityDialog
        {...defaultProps}
        parentIri="http://example.org/ontology#Animal"
        parentLabel="Animal"
      />
    );
    expect(screen.getByText("Animal")).toBeDefined();
    expect(screen.getByText(/Create a new subclass of/)).toBeDefined();
  });

  it("extracts parent display name from IRI with hash", () => {
    render(
      <AddEntityDialog
        {...defaultProps}
        parentIri="http://example.org/ontology#MyClass"
      />
    );
    expect(screen.getByText("MyClass")).toBeDefined();
  });

  it("extracts parent display name from IRI with slash", () => {
    render(
      <AddEntityDialog
        {...defaultProps}
        parentIri="http://example.org/ontology/SomeClass"
      />
    );
    expect(screen.getByText("SomeClass")).toBeDefined();
  });

  it("disables type select when parentIri is set", () => {
    render(
      <AddEntityDialog
        {...defaultProps}
        parentIri="http://example.org/ontology#Animal"
      />
    );
    const select = screen.getByLabelText("Type");
    expect((select as HTMLSelectElement).disabled).toBe(true);
    expect(
      screen.getByText("Type is locked to Class when creating a subclass.")
    ).toBeDefined();
  });

  it("renders all entity type options", () => {
    render(<AddEntityDialog {...defaultProps} />);
    expect(screen.getByText("Class")).toBeDefined();
    expect(screen.getByText("Object Property")).toBeDefined();
    expect(screen.getByText("Data Property")).toBeDefined();
    expect(screen.getByText("Annotation Property")).toBeDefined();
    expect(screen.getByText("Individual")).toBeDefined();
  });

  it("disables Create button when label is empty", () => {
    render(<AddEntityDialog {...defaultProps} />);
    const createBtn = screen.getByText("Create");
    expect((createBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it("enables Create button when label is typed", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<AddEntityDialog {...defaultProps} />);

    const input = screen.getByPlaceholderText("e.g., Privileged Altar");
    await user.type(input, "NewEntity");

    const createBtn = screen.getByText("Create");
    expect((createBtn as HTMLButtonElement).disabled).toBe(false);
  });

  it("calls onConfirm and closes dialog on submit", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<AddEntityDialog {...defaultProps} />);

    const input = screen.getByPlaceholderText("e.g., Privileged Altar");
    await user.type(input, "NewEntity");
    await user.click(screen.getByText("Create"));

    expect(defaultProps.onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        label: "NewEntity",
        entityType: "class",
        iri: expect.any(String),
      })
    );
    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("includes parentIri in onConfirm payload when creating a subclass", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <AddEntityDialog
        {...defaultProps}
        parentIri="http://example.org/ontology#Animal"
        parentLabel="Animal"
      />
    );

    const input = screen.getByPlaceholderText("e.g., Privileged Altar");
    await user.type(input, "Dog");
    await user.click(screen.getByText("Create"));

    expect(defaultProps.onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        label: "Dog",
        entityType: "class",
        iri: expect.any(String),
        parentIri: "http://example.org/ontology#Animal",
      })
    );
  });

  it("calls onOpenChange(false) on Cancel click", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<AddEntityDialog {...defaultProps} />);

    await user.click(screen.getByText("Cancel"));
    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("toggles Advanced section and shows IRI field", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<AddEntityDialog {...defaultProps} />);

    expect(screen.queryByLabelText("IRI")).toBeNull();
    await user.click(screen.getByText("Advanced"));
    expect(screen.getByLabelText("IRI")).toBeDefined();
    expect(screen.getByText("Auto-generated UUID-based IRI")).toBeDefined();
  });

  it("shows numeric pattern description in Advanced", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<AddEntityDialog {...defaultProps} iriPattern="numeric" nextNumeric={42} />);

    await user.click(screen.getByText("Advanced"));
    expect(screen.getByText("Sequential numeric IRI (next: 42)")).toBeDefined();
  });

  it("shows named pattern description in Advanced", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<AddEntityDialog {...defaultProps} iriPattern="named" />);

    await user.click(screen.getByText("Advanced"));
    expect(screen.getByText("Derived from label")).toBeDefined();
  });

  it("allows changing entity type", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<AddEntityDialog {...defaultProps} />);

    const select = screen.getByLabelText("Type");
    await user.selectOptions(select, "objectProperty");
    expect((select as HTMLSelectElement).value).toBe("objectProperty");
  });

  it("does not submit when label is empty (prevents empty submit)", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<AddEntityDialog {...defaultProps} />);

    // Try to submit form directly via Enter on blank input
    const input = screen.getByPlaceholderText("e.g., Privileged Altar");
    await user.type(input, "{Enter}");

    expect(defaultProps.onConfirm).not.toHaveBeenCalled();
  });

  it("submits on Enter key with label filled", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<AddEntityDialog {...defaultProps} />);

    const input = screen.getByPlaceholderText("e.g., Privileged Altar");
    await user.type(input, "SomeEntity{Enter}");

    expect(defaultProps.onConfirm).toHaveBeenCalled();
  });

  it("allows manual IRI editing in Advanced", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<AddEntityDialog {...defaultProps} />);

    await user.click(screen.getByText("Advanced"));
    const iriInput = screen.getByLabelText("IRI");
    await user.clear(iriInput);
    await user.type(iriInput, "http://custom.iri/Foo");

    expect((iriInput as HTMLInputElement).value).toBe("http://custom.iri/Foo");
  });

  it("generates named IRI from label when iriPattern is named", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<AddEntityDialog {...defaultProps} iriPattern="named" />);

    await user.click(screen.getByText("Advanced"));
    const labelInput = screen.getByPlaceholderText("e.g., Privileged Altar");
    await user.type(labelInput, "Red Blood Cell");

    const iriInput = screen.getByLabelText("IRI");
    expect((iriInput as HTMLInputElement).value).toBe(
      "http://example.org/ontology#RedBloodCell"
    );
  });
});
