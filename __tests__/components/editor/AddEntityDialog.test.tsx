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
  describe("derived props arriving while open (namespace detected after indexing)", () => {
    const LATE_NS = "https://example.test/";

    it("preserves a typed label when the namespace prop changes", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const { rerender } = render(
        <AddEntityDialog {...defaultProps} iriPattern="named" ontologyNamespace="" />
      );

      const labelInput = screen.getByPlaceholderText("e.g., Privileged Altar");
      await user.type(labelInput, "Red Blood Cell");

      rerender(
        <AddEntityDialog {...defaultProps} iriPattern="named" ontologyNamespace={LATE_NS} />
      );

      expect((labelInput as HTMLInputElement).value).toBe("Red Blood Cell");
      expect(screen.getByRole("button", { name: "Create" })).not.toHaveProperty("disabled", true);
    });

    it("keeps Advanced expanded and the chosen type when the namespace changes", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const { rerender } = render(<AddEntityDialog {...defaultProps} ontologyNamespace="" />);

      await user.selectOptions(screen.getByLabelText("Type"), "objectProperty");
      await user.click(screen.getByText("Advanced"));

      rerender(<AddEntityDialog {...defaultProps} ontologyNamespace={LATE_NS} />);

      expect(screen.getByLabelText("IRI")).toBeDefined();
      expect((screen.getByLabelText("Type") as HTMLSelectElement).value).toBe("objectProperty");
    });

    it("lets an untouched named IRI follow the new namespace", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const { rerender } = render(
        <AddEntityDialog {...defaultProps} iriPattern="named" ontologyNamespace="" />
      );

      await user.click(screen.getByText("Advanced"));
      await user.type(screen.getByPlaceholderText("e.g., Privileged Altar"), "Red Blood Cell");

      rerender(
        <AddEntityDialog {...defaultProps} iriPattern="named" ontologyNamespace={LATE_NS} />
      );

      expect((screen.getByLabelText("IRI") as HTMLInputElement).value).toBe(
        "https://example.test/RedBloodCell"
      );
    });

    it("lets an untouched UUID IRI follow the new namespace, keeping its local name", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const { rerender } = render(<AddEntityDialog {...defaultProps} ontologyNamespace="" />);

      await user.click(screen.getByText("Advanced"));
      expect((screen.getByLabelText("IRI") as HTMLInputElement).value).toBe("TestBase62Uuid");

      rerender(<AddEntityDialog {...defaultProps} ontologyNamespace={LATE_NS} />);

      expect((screen.getByLabelText("IRI") as HTMLInputElement).value).toBe(
        "https://example.test/TestBase62Uuid"
      );
    });

    it("preserves a hand-edited IRI when the namespace changes", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const { rerender } = render(
        <AddEntityDialog {...defaultProps} iriPattern="named" ontologyNamespace="" />
      );

      await user.type(screen.getByPlaceholderText("e.g., Privileged Altar"), "Thing");
      await user.click(screen.getByText("Advanced"));
      const iriInput = screen.getByLabelText("IRI");
      await user.clear(iriInput);
      await user.type(iriInput, "http://custom.iri/Foo");

      rerender(
        <AddEntityDialog {...defaultProps} iriPattern="named" ontologyNamespace={LATE_NS} />
      );

      expect((screen.getByLabelText("IRI") as HTMLInputElement).value).toBe(
        "http://custom.iri/Foo"
      );
      expect(
        (screen.getByPlaceholderText("e.g., Privileged Altar") as HTMLInputElement).value
      ).toBe("Thing");
    });

    it("submits the label typed before the namespace arrived, with the derived IRI", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const { rerender } = render(
        <AddEntityDialog {...defaultProps} iriPattern="named" ontologyNamespace="" />
      );

      await user.type(screen.getByPlaceholderText("e.g., Privileged Altar"), "Red Blood Cell");
      rerender(
        <AddEntityDialog {...defaultProps} iriPattern="named" ontologyNamespace={LATE_NS} />
      );
      await user.click(screen.getByRole("button", { name: "Create" }));

      expect(defaultProps.onConfirm).toHaveBeenCalledWith({
        iri: "https://example.test/RedBloodCell",
        label: "Red Blood Cell",
        entityType: "class",
        parentIri: undefined,
      });
    });

    it("locks the type to Class when a parent arrives after the user chose another type", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const { rerender } = render(<AddEntityDialog {...defaultProps} />);

      await user.type(screen.getByPlaceholderText("e.g., Privileged Altar"), "Child");
      await user.selectOptions(screen.getByLabelText("Type"), "objectProperty");

      rerender(<AddEntityDialog {...defaultProps} parentIri="http://example.org/ontology#Animal" />);

      expect((screen.getByLabelText("Type") as HTMLSelectElement).value).toBe("class");
      expect(
        (screen.getByPlaceholderText("e.g., Privileged Altar") as HTMLInputElement).value
      ).toBe("Child");
      await user.click(screen.getByRole("button", { name: "Create" }));
      expect(defaultProps.onConfirm).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: "class",
          parentIri: "http://example.org/ontology#Animal",
        })
      );
    });

    it("still resets the form when the dialog is closed and reopened", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const { rerender } = render(<AddEntityDialog {...defaultProps} iriPattern="named" />);

      await user.type(screen.getByPlaceholderText("e.g., Privileged Altar"), "Stale");
      await user.click(screen.getByText("Advanced"));
      const iriInput = screen.getByLabelText("IRI");
      await user.clear(iriInput);
      await user.type(iriInput, "http://custom.iri/Stale");

      rerender(<AddEntityDialog {...defaultProps} iriPattern="named" open={false} />);
      rerender(<AddEntityDialog {...defaultProps} iriPattern="named" open />);

      expect(
        (screen.getByPlaceholderText("e.g., Privileged Altar") as HTMLInputElement).value
      ).toBe("");
      expect(screen.queryByLabelText("IRI")).toBeNull();
      await user.click(screen.getByText("Advanced"));
      expect((screen.getByLabelText("IRI") as HTMLInputElement).value).toBe(
        "http://example.org/ontology#..."
      );
    });
  });
});
