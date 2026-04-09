import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

// ── Hoisted mock data (shared references for .includes() checks) ──

const { mockRdfsLabel, mockSkosPrefLabel, mockSkosDefinition } = vi.hoisted(() => ({
  mockRdfsLabel: {
    iri: "http://www.w3.org/2000/01/rdf-schema#label",
    curie: "rdfs:label",
    displayLabel: "Label",
    vocabulary: "RDFS",
  },
  mockSkosPrefLabel: {
    iri: "http://www.w3.org/2004/02/skos/core#prefLabel",
    curie: "skos:prefLabel",
    displayLabel: "Preferred Label",
    vocabulary: "SKOS",
  },
  mockSkosDefinition: {
    iri: "http://www.w3.org/2004/02/skos/core#definition",
    curie: "skos:definition",
    displayLabel: "Definition",
    vocabulary: "SKOS",
  },
}));

vi.mock("@/lib/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

vi.mock("@/components/editor/LanguageFlag", () => ({
  LanguageFlag: ({ lang }: { lang: string }) => (
    <span data-testid="lang-flag">{lang}</span>
  ),
}));

vi.mock("@/lib/ontology/annotationProperties", () => ({
  ANNOTATION_PROPERTIES: [mockRdfsLabel, mockSkosPrefLabel, mockSkosDefinition],
  getAnnotationPropertiesByVocabulary: () => ({
    RDFS: [mockRdfsLabel],
    SKOS: [mockSkosPrefLabel, mockSkosDefinition],
  }),
}));

import { InlineAnnotationAdder } from "@/components/editor/standard/InlineAnnotationAdder";

// ── Tests ──────────────────────────────────────────────────────────

describe("InlineAnnotationAdder", () => {
  const defaultProps = {
    excludeIris: [] as string[],
    onAdd: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the property selector input", () => {
    render(<InlineAnnotationAdder {...defaultProps} />);
    expect(screen.getByPlaceholderText("Select property...")).toBeDefined();
  });

  it("renders disabled value input initially", () => {
    render(<InlineAnnotationAdder {...defaultProps} />);
    const valueInput = screen.getByLabelText("Annotation value") as HTMLInputElement;
    expect(valueInput.disabled).toBe(true);
    expect(valueInput.placeholder).toBe("Select a property first");
  });

  it("renders language input defaulting to 'en'", () => {
    render(<InlineAnnotationAdder {...defaultProps} />);
    const langInput = screen.getByLabelText("Language tag") as HTMLInputElement;
    expect(langInput.value).toBe("en");
  });

  it("opens dropdown when property input is focused", () => {
    render(<InlineAnnotationAdder {...defaultProps} />);
    const input = screen.getByPlaceholderText("Select property...");
    fireEvent.focus(input);
    // Should show vocabulary groups
    expect(screen.getByText("RDFS")).toBeDefined();
    expect(screen.getByText("SKOS")).toBeDefined();
  });

  it("shows all properties in dropdown", () => {
    render(<InlineAnnotationAdder {...defaultProps} />);
    fireEvent.focus(screen.getByPlaceholderText("Select property..."));
    expect(screen.getByText("Label")).toBeDefined();
    expect(screen.getByText("Preferred Label")).toBeDefined();
    expect(screen.getByText("Definition")).toBeDefined();
  });

  it("filters properties when typing in the property input", async () => {
    const user = userEvent.setup();
    render(<InlineAnnotationAdder {...defaultProps} />);
    const input = screen.getByPlaceholderText("Select property...");
    await user.type(input, "Def");
    expect(screen.getByText("Definition")).toBeDefined();
    expect(screen.queryByText("Label")).toBeNull();
    expect(screen.queryByText("Preferred Label")).toBeNull();
  });

  it("shows 'No matching properties' when filter has no results", async () => {
    const user = userEvent.setup();
    render(<InlineAnnotationAdder {...defaultProps} />);
    const input = screen.getByPlaceholderText("Select property...");
    await user.type(input, "zzzzz");
    expect(screen.getByText("No matching properties")).toBeDefined();
  });

  it("excludes properties listed in excludeIris", () => {
    render(
      <InlineAnnotationAdder
        {...defaultProps}
        excludeIris={[mockRdfsLabel.iri]}
      />
    );
    fireEvent.focus(screen.getByPlaceholderText("Select property..."));
    expect(screen.queryByText("Label")).toBeNull();
    expect(screen.getByText("Preferred Label")).toBeDefined();
  });

  it("selects a property when clicked in dropdown", () => {
    render(<InlineAnnotationAdder {...defaultProps} />);
    fireEvent.focus(screen.getByPlaceholderText("Select property..."));
    fireEvent.click(screen.getByText("Preferred Label"));

    // Property button should show the selected label
    expect(screen.getByText("Preferred Label")).toBeDefined();
    // Value input should now be enabled
    const valueInput = screen.getByLabelText("Annotation value") as HTMLInputElement;
    expect(valueInput.disabled).toBe(false);
    expect(valueInput.placeholder).toBe("Enter value...");
  });

  it("enables value and lang inputs after property selection", () => {
    render(<InlineAnnotationAdder {...defaultProps} />);
    fireEvent.focus(screen.getByPlaceholderText("Select property..."));
    fireEvent.click(screen.getByText("Definition"));

    expect((screen.getByLabelText("Annotation value") as HTMLInputElement).disabled).toBe(false);
    expect((screen.getByLabelText("Language tag") as HTMLInputElement).disabled).toBe(false);
  });

  it("calls onAdd when Enter is pressed with a value", async () => {
    const onAdd = vi.fn();
    const user = userEvent.setup();
    render(<InlineAnnotationAdder {...defaultProps} onAdd={onAdd} />);

    // Select property
    fireEvent.focus(screen.getByPlaceholderText("Select property..."));
    fireEvent.click(screen.getByText("Label"));

    // Type a value and press Enter
    const valueInput = screen.getByLabelText("Annotation value");
    await user.type(valueInput, "Test Value{Enter}");

    expect(onAdd).toHaveBeenCalledWith(
      mockRdfsLabel.iri,
      "Test Value",
      "en"
    );
  });

  it("calls onSaveNeeded after committing", async () => {
    const onAdd = vi.fn();
    const onSaveNeeded = vi.fn();
    const user = userEvent.setup();
    render(
      <InlineAnnotationAdder
        excludeIris={[]}
        onAdd={onAdd}
        onSaveNeeded={onSaveNeeded}
      />
    );

    fireEvent.focus(screen.getByPlaceholderText("Select property..."));
    fireEvent.click(screen.getByText("Label"));

    const valueInput = screen.getByLabelText("Annotation value");
    await user.type(valueInput, "Hello{Enter}");

    expect(onSaveNeeded).toHaveBeenCalledTimes(1);
  });

  it("does not call onAdd when Enter is pressed with empty value", async () => {
    const onAdd = vi.fn();
    const user = userEvent.setup();
    render(<InlineAnnotationAdder {...defaultProps} onAdd={onAdd} />);

    fireEvent.focus(screen.getByPlaceholderText("Select property..."));
    fireEvent.click(screen.getByText("Label"));

    const valueInput = screen.getByLabelText("Annotation value");
    await user.type(valueInput, "{Enter}");

    expect(onAdd).not.toHaveBeenCalled();
  });

  it("resets form after successful commit", async () => {
    const onAdd = vi.fn();
    const user = userEvent.setup();
    render(<InlineAnnotationAdder {...defaultProps} onAdd={onAdd} />);

    fireEvent.focus(screen.getByPlaceholderText("Select property..."));
    fireEvent.click(screen.getByText("Label"));

    const valueInput = screen.getByLabelText("Annotation value");
    await user.type(valueInput, "Test{Enter}");

    // After commit, should reset to initial state
    expect(screen.getByPlaceholderText("Select property...")).toBeDefined();
    const newValueInput = screen.getByLabelText("Annotation value") as HTMLInputElement;
    expect(newValueInput.disabled).toBe(true);
  });

  it("commits value on blur when property and value are set", async () => {
    const onAdd = vi.fn();
    const user = userEvent.setup();
    render(<InlineAnnotationAdder {...defaultProps} onAdd={onAdd} />);

    fireEvent.focus(screen.getByPlaceholderText("Select property..."));
    fireEvent.click(screen.getByText("Label"));

    const valueInput = screen.getByLabelText("Annotation value");
    await user.type(valueInput, "Blur value");
    fireEvent.blur(valueInput);

    expect(onAdd).toHaveBeenCalledWith(mockRdfsLabel.iri, "Blur value", "en");
  });

  it("closes dropdown when Escape is pressed", async () => {
    const user = userEvent.setup();
    render(<InlineAnnotationAdder {...defaultProps} />);

    const input = screen.getByPlaceholderText("Select property...");
    await user.type(input, "L");
    expect(screen.getByText("RDFS")).toBeDefined();

    await user.type(input, "{Escape}");
    // Dropdown should close
    expect(screen.queryByText("RDFS")).toBeNull();
  });

  it("re-opens property selector when selected property button is clicked", () => {
    render(<InlineAnnotationAdder {...defaultProps} />);

    // Select a property
    fireEvent.focus(screen.getByPlaceholderText("Select property..."));
    fireEvent.click(screen.getByText("Label"));

    // Click the selected property button to change it
    fireEvent.click(screen.getByText("Label"));

    // Dropdown should be open again
    expect(screen.getByText("RDFS")).toBeDefined();
    expect(screen.getByText("SKOS")).toBeDefined();
  });
});
