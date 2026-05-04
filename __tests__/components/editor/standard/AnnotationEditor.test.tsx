import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import type { AnnotationUpdate } from "@/lib/api/client";

// ── Mocks ──────────────────────────────────────────────────────────

vi.mock("@/lib/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

vi.mock("@/components/editor/LanguageFlag", () => ({
  LanguageFlag: ({ lang }: { lang: string }) => <span data-testid="lang-flag">{lang}</span>,
}));

// Mock AnnotationRow as a simple controlled component
vi.mock("@/components/editor/standard/AnnotationRow", () => ({
  AnnotationRow: ({
    propertyIri,
    value,
    lang,
    onValueChange,
    onLangChange,
    onRemove,
    showPropertyLabel,
  }: {
    propertyIri: string;
    value: string;
    lang: string;
    onValueChange: (v: string) => void;
    onLangChange: (l: string) => void;
    onRemove: () => void;
    showPropertyLabel?: boolean;
  }) => (
    <div data-testid="annotation-row">
      <span data-testid="row-property">{propertyIri}</span>
      <input
        data-testid="row-value-input"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
      />
      <input
        data-testid="row-lang-input"
        value={lang}
        onChange={(e) => onLangChange(e.target.value)}
      />
      {showPropertyLabel && <span data-testid="row-label">label</span>}
      <button data-testid="row-remove" onClick={onRemove}>Remove</button>
    </div>
  ),
}));

// Shared objects so reference equality works in the picker's .includes() check.
// vi.hoisted runs before vi.mock hoisting, making these available in the factory.
const {
  mockRdfsLabel,
  mockRdfsComment,
  mockSkosPrefLabel,
  mockSkosDefinition,
} = vi.hoisted(() => ({
  mockRdfsLabel: {
    iri: "http://www.w3.org/2000/01/rdf-schema#label",
    curie: "rdfs:label",
    displayLabel: "Label",
    vocabulary: "RDFS",
  },
  mockRdfsComment: {
    iri: "http://www.w3.org/2000/01/rdf-schema#comment",
    curie: "rdfs:comment",
    displayLabel: "Comment",
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

vi.mock("@/lib/ontology/annotationProperties", () => ({
  ANNOTATION_PROPERTIES: [mockRdfsLabel, mockRdfsComment, mockSkosPrefLabel, mockSkosDefinition],
  getAnnotationPropertiesByVocabulary: () => ({
    RDFS: [mockRdfsLabel, mockRdfsComment],
    SKOS: [mockSkosPrefLabel, mockSkosDefinition],
  }),
  getAnnotationPropertyInfo: vi.fn((iri: string) => ({ curie: iri, label: iri })),
}));

// Import after mocks
import { AnnotationEditor, AnnotationPropertyPicker } from "@/components/editor/standard/AnnotationEditor";

// ── Fixtures ───────────────────────────────────────────────────────

const rdfsLabel = "http://www.w3.org/2000/01/rdf-schema#label";
const rdfsComment = "http://www.w3.org/2000/01/rdf-schema#comment";

const sampleAnnotations: AnnotationUpdate[] = [
  {
    property_iri: rdfsLabel,
    values: [
      { value: "My Class", lang: "en" },
      { value: "Ma Classe", lang: "fr" },
    ],
  },
  {
    property_iri: rdfsComment,
    values: [{ value: "A description", lang: "en" }],
  },
];

// ── Tests ──────────────────────────────────────────────────────────

describe("AnnotationEditor", () => {
  const onChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Rendering rows ---

  it("renders a row for each annotation value", () => {
    render(<AnnotationEditor annotations={sampleAnnotations} onChange={onChange} />);
    const rows = screen.getAllByTestId("annotation-row");
    // 2 values for rdfs:label + 1 for rdfs:comment = 3
    expect(rows.length).toBe(3);
  });

  it("shows correct values in each row", () => {
    render(<AnnotationEditor annotations={sampleAnnotations} onChange={onChange} />);
    const inputs = screen.getAllByTestId("row-value-input");
    expect((inputs[0] as HTMLInputElement).value).toBe("My Class");
    expect((inputs[1] as HTMLInputElement).value).toBe("Ma Classe");
    expect((inputs[2] as HTMLInputElement).value).toBe("A description");
  });

  it("shows property labels by default", () => {
    render(<AnnotationEditor annotations={sampleAnnotations} onChange={onChange} />);
    const labels = screen.getAllByTestId("row-label");
    expect(labels.length).toBe(3);
  });

  it("hides property labels when showPropertyLabels is false", () => {
    render(
      <AnnotationEditor
        annotations={sampleAnnotations}
        onChange={onChange}
        showPropertyLabels={false}
      />
    );
    expect(screen.queryByTestId("row-label")).toBeNull();
  });

  it("renders empty state with add button when no annotations", () => {
    render(<AnnotationEditor annotations={[]} onChange={onChange} />);
    expect(screen.queryByTestId("annotation-row")).toBeNull();
    expect(screen.getByText("Add annotation")).toBeDefined();
  });

  // --- Property filter ---

  it("filters annotations by propertyFilter whitelist", () => {
    render(
      <AnnotationEditor
        annotations={sampleAnnotations}
        onChange={onChange}
        propertyFilter={[rdfsLabel]}
      />
    );
    const rows = screen.getAllByTestId("annotation-row");
    // Only rdfs:label values (2)
    expect(rows.length).toBe(2);
  });

  // --- Exclude properties ---

  it("excludes annotations by excludeProperties blacklist", () => {
    render(
      <AnnotationEditor
        annotations={sampleAnnotations}
        onChange={onChange}
        excludeProperties={[rdfsLabel]}
      />
    );
    const rows = screen.getAllByTestId("annotation-row");
    // Only rdfs:comment values (1)
    expect(rows.length).toBe(1);
  });

  // --- Updating values ---

  it("calls onChange when a value is updated", () => {
    render(<AnnotationEditor annotations={sampleAnnotations} onChange={onChange} />);
    const inputs = screen.getAllByTestId("row-value-input");
    fireEvent.change(inputs[0], { target: { value: "Updated Class" } });
    expect(onChange).toHaveBeenCalledTimes(1);
    const updated = onChange.mock.calls[0][0] as AnnotationUpdate[];
    expect(updated[0].values[0].value).toBe("Updated Class");
    // Other values should be unchanged
    expect(updated[0].values[1].value).toBe("Ma Classe");
    expect(updated[1].values[0].value).toBe("A description");
  });

  it("calls onChange when a language is updated", () => {
    render(<AnnotationEditor annotations={sampleAnnotations} onChange={onChange} />);
    const langInputs = screen.getAllByTestId("row-lang-input");
    fireEvent.change(langInputs[1], { target: { value: "de" } });
    expect(onChange).toHaveBeenCalledTimes(1);
    const updated = onChange.mock.calls[0][0] as AnnotationUpdate[];
    expect(updated[0].values[1].lang).toBe("de");
  });

  // --- Removing values ---

  it("calls onChange with value removed when remove is clicked", () => {
    render(<AnnotationEditor annotations={sampleAnnotations} onChange={onChange} />);
    const removeButtons = screen.getAllByTestId("row-remove");
    // Remove the second value of rdfs:label ("Ma Classe")
    fireEvent.click(removeButtons[1]);
    expect(onChange).toHaveBeenCalledTimes(1);
    const updated = onChange.mock.calls[0][0] as AnnotationUpdate[];
    // rdfs:label should now have 1 value
    expect(updated[0].values.length).toBe(1);
    expect(updated[0].values[0].value).toBe("My Class");
  });

  it("removes the annotation entry entirely when last value is removed", () => {
    render(<AnnotationEditor annotations={sampleAnnotations} onChange={onChange} />);
    const removeButtons = screen.getAllByTestId("row-remove");
    // Remove the only value of rdfs:comment (index 2)
    fireEvent.click(removeButtons[2]);
    expect(onChange).toHaveBeenCalledTimes(1);
    const updated = onChange.mock.calls[0][0] as AnnotationUpdate[];
    // Only rdfs:label should remain
    expect(updated.length).toBe(1);
    expect(updated[0].property_iri).toBe(rdfsLabel);
  });

  // --- Add annotation picker ---

  it("shows picker when 'Add annotation' button is clicked", () => {
    render(<AnnotationEditor annotations={[]} onChange={onChange} />);
    fireEvent.click(screen.getByText("Add annotation"));
    expect(screen.getByPlaceholderText("Search annotation properties...")).toBeDefined();
  });

  it("adds a new annotation when a property is selected from picker", () => {
    render(<AnnotationEditor annotations={[]} onChange={onChange} />);
    fireEvent.click(screen.getByText("Add annotation"));
    // Click on a property in the picker
    fireEvent.click(screen.getByText("Label"));
    expect(onChange).toHaveBeenCalledTimes(1);
    const updated = onChange.mock.calls[0][0] as AnnotationUpdate[];
    expect(updated.length).toBe(1);
    expect(updated[0].property_iri).toBe(rdfsLabel);
    expect(updated[0].values).toEqual([{ value: "", lang: "en" }]);
  });

  it("appends a value to existing property when selected from picker", () => {
    render(<AnnotationEditor annotations={sampleAnnotations} onChange={onChange} />);
    fireEvent.click(screen.getByText("Add annotation"));
    // Select rdfs:label which already exists
    fireEvent.click(screen.getByText("Label"));
    expect(onChange).toHaveBeenCalledTimes(1);
    const updated = onChange.mock.calls[0][0] as AnnotationUpdate[];
    // rdfs:label should now have 3 values
    expect(updated[0].values.length).toBe(3);
    expect(updated[0].values[2]).toEqual({ value: "", lang: "en" });
  });

  it("hides picker after selecting a property", () => {
    render(<AnnotationEditor annotations={[]} onChange={onChange} />);
    fireEvent.click(screen.getByText("Add annotation"));
    expect(screen.getByPlaceholderText("Search annotation properties...")).toBeDefined();
    fireEvent.click(screen.getByText("Label"));
    // Picker should be hidden after selection
    expect(screen.queryByPlaceholderText("Search annotation properties...")).toBeNull();
  });
});

// ── AnnotationPropertyPicker tests ─────────────────────────────────

describe("AnnotationPropertyPicker", () => {
  const onSelect = vi.fn();
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders grouped properties", () => {
    render(<AnnotationPropertyPicker onSelect={onSelect} onClose={onClose} />);
    expect(screen.getByText("RDFS")).toBeDefined();
    expect(screen.getByText("SKOS")).toBeDefined();
    expect(screen.getByText("Label")).toBeDefined();
    expect(screen.getByText("Comment")).toBeDefined();
    expect(screen.getByText("Preferred Label")).toBeDefined();
    expect(screen.getByText("Definition")).toBeDefined();
  });

  it("shows curie alongside display label", () => {
    render(<AnnotationPropertyPicker onSelect={onSelect} onClose={onClose} />);
    expect(screen.getByText("rdfs:label")).toBeDefined();
    expect(screen.getByText("skos:prefLabel")).toBeDefined();
  });

  it("filters properties by search query", async () => {
    const user = userEvent.setup();
    render(<AnnotationPropertyPicker onSelect={onSelect} onClose={onClose} />);
    const input = screen.getByPlaceholderText("Search annotation properties...");
    await user.type(input, "pref");
    // Only "Preferred Label" should remain
    expect(screen.getByText("Preferred Label")).toBeDefined();
    expect(screen.queryByText("Label")).toBeNull();
    expect(screen.queryByText("Comment")).toBeNull();
  });

  it("shows 'No matching properties' when search has no results", async () => {
    const user = userEvent.setup();
    render(<AnnotationPropertyPicker onSelect={onSelect} onClose={onClose} />);
    const input = screen.getByPlaceholderText("Search annotation properties...");
    await user.type(input, "zzzznonexistent");
    expect(screen.getByText("No matching properties")).toBeDefined();
  });

  it("calls onSelect with IRI when property is clicked", () => {
    render(<AnnotationPropertyPicker onSelect={onSelect} onClose={onClose} />);
    fireEvent.click(screen.getByText("Comment"));
    expect(onSelect).toHaveBeenCalledWith(rdfsComment);
  });

  it("calls onClose when Escape is pressed", async () => {
    const user = userEvent.setup();
    render(<AnnotationPropertyPicker onSelect={onSelect} onClose={onClose} />);
    const input = screen.getByPlaceholderText("Search annotation properties...");
    await user.type(input, "{Escape}");
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when X button is clicked", () => {
    const { container } = render(
      <AnnotationPropertyPicker onSelect={onSelect} onClose={onClose} />
    );
    // The X button is the last button in the search header
    const buttons = container.querySelectorAll("button");
    // First buttons are the property items, the close button is in the header
    // Find the button that is inside the search bar area
    const closeButton = Array.from(buttons).find(
      (btn) => btn.closest(".flex.items-center.gap-2") !== null
    );
    if (closeButton) {
      fireEvent.click(closeButton);
    } else {
      // fallback: click the first button that is not a property
      fireEvent.click(buttons[0]);
    }
    expect(onClose).toHaveBeenCalled();
  });

  it("excludes properties listed in excludeIris", () => {
    render(
      <AnnotationPropertyPicker
        onSelect={onSelect}
        onClose={onClose}
        excludeIris={[rdfsLabel, rdfsComment]}
      />
    );
    expect(screen.queryByText("Label")).toBeNull();
    expect(screen.queryByText("Comment")).toBeNull();
    // SKOS properties should still be shown
    expect(screen.getByText("Preferred Label")).toBeDefined();
    expect(screen.getByText("Definition")).toBeDefined();
  });

  it("hides vocabulary group when all its properties are excluded", () => {
    render(
      <AnnotationPropertyPicker
        onSelect={onSelect}
        onClose={onClose}
        excludeIris={[rdfsLabel, rdfsComment]}
      />
    );
    expect(screen.queryByText("RDFS")).toBeNull();
    expect(screen.getByText("SKOS")).toBeDefined();
  });

  it("calls onClose when clicking outside the picker", () => {
    render(
      <div>
        <div data-testid="outside">Outside</div>
        <AnnotationPropertyPicker onSelect={onSelect} onClose={onClose} />
      </div>
    );
    fireEvent.mouseDown(screen.getByTestId("outside"));
    expect(onClose).toHaveBeenCalled();
  });
});
