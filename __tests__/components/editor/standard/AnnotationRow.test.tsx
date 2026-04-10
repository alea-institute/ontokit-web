import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

// ── Mocks ──────────────────────────────────────────────────────────

vi.mock("@/lib/ontology/annotationProperties", () => ({
  getAnnotationPropertyInfo: vi.fn((iri: string) => {
    if (iri === "http://www.w3.org/2000/01/rdf-schema#label") {
      return { displayLabel: "Label", curie: "rdfs:label" };
    }
    if (iri === "http://www.w3.org/2000/01/rdf-schema#comment") {
      return { displayLabel: "Comment", curie: "rdfs:comment" };
    }
    return { displayLabel: iri.split("#").pop() || iri, curie: iri };
  }),
}));

vi.mock("@/components/editor/LanguagePicker", () => ({
  LanguagePicker: ({
    value,
    onChange,
    disabled,
  }: {
    value: string;
    onChange: (code: string) => void;
    disabled?: boolean;
  }) => (
    <select
      data-testid="lang-picker"
      aria-label="Language tag"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="en">en</option>
      <option value="fr">fr</option>
    </select>
  ),
}));

import { AnnotationRow } from "@/components/editor/standard/AnnotationRow";

// ── Tests ──────────────────────────────────────────────────────────

describe("AnnotationRow", () => {
  const defaultProps = {
    propertyIri: "http://www.w3.org/2000/01/rdf-schema#label",
    value: "Hello",
    lang: "en",
    onValueChange: vi.fn(),
    onLangChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with a text input for short values", () => {
    render(<AnnotationRow {...defaultProps} />);
    const input = screen.getByLabelText("Label value") as HTMLInputElement;
    expect(input.tagName).toBe("INPUT");
    expect(input.value).toBe("Hello");
  });

  it("renders with a textarea for long values (>80 chars)", () => {
    const longValue = "A".repeat(81);
    render(<AnnotationRow {...defaultProps} value={longValue} />);
    const textarea = screen.getByLabelText("Label value") as HTMLTextAreaElement;
    expect(textarea.tagName).toBe("TEXTAREA");
    expect(textarea.value).toBe(longValue);
  });

  it("shows property label chip when showPropertyLabel is true (default)", () => {
    render(<AnnotationRow {...defaultProps} />);
    expect(screen.getByText("Label")).toBeDefined();
  });

  it("hides property label chip when showPropertyLabel is false", () => {
    render(<AnnotationRow {...defaultProps} showPropertyLabel={false} />);
    expect(screen.queryByText("Label")).toBeNull();
  });

  it("displays the curie as title attribute on the property chip", () => {
    render(<AnnotationRow {...defaultProps} />);
    const chip = screen.getByText("Label");
    expect(chip.getAttribute("title")).toBe("rdfs:label");
  });

  it("renders the LanguagePicker with the correct lang", () => {
    render(<AnnotationRow {...defaultProps} />);
    const picker = screen.getByTestId("lang-picker") as HTMLSelectElement;
    expect(picker.value).toBe("en");
  });

  it("renders the language picker with correct value", () => {
    render(<AnnotationRow {...defaultProps} />);
    const langPicker = screen.getByLabelText("Language tag") as HTMLSelectElement;
    expect(langPicker.value).toBe("en");
  });

  it("calls onValueChange when the value input changes", () => {
    const onValueChange = vi.fn();
    render(<AnnotationRow {...defaultProps} onValueChange={onValueChange} />);
    const input = screen.getByLabelText("Label value");
    fireEvent.change(input, { target: { value: "World" } });
    expect(onValueChange).toHaveBeenCalledWith("World");
  });

  it("calls onValueChange when the textarea changes (long value)", () => {
    const onValueChange = vi.fn();
    const longValue = "B".repeat(81);
    render(
      <AnnotationRow {...defaultProps} value={longValue} onValueChange={onValueChange} />
    );
    const textarea = screen.getByLabelText("Label value");
    fireEvent.change(textarea, { target: { value: "Changed" } });
    expect(onValueChange).toHaveBeenCalledWith("Changed");
  });

  it("calls onLangChange when the language picker changes", () => {
    const onLangChange = vi.fn();
    render(<AnnotationRow {...defaultProps} onLangChange={onLangChange} />);
    const langPicker = screen.getByLabelText("Language tag");
    fireEvent.change(langPicker, { target: { value: "fr" } });
    expect(onLangChange).toHaveBeenCalledWith("fr");
  });

  it("renders remove button when onRemove is provided", () => {
    const onRemove = vi.fn();
    render(<AnnotationRow {...defaultProps} onRemove={onRemove} />);
    const removeBtn = screen.getByLabelText("Remove Label annotation");
    expect(removeBtn).toBeDefined();
  });

  it("calls onRemove when remove button is clicked", () => {
    const onRemove = vi.fn();
    render(<AnnotationRow {...defaultProps} onRemove={onRemove} />);
    fireEvent.click(screen.getByLabelText("Remove Label annotation"));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("renders placeholder spacer when onRemove is not provided", () => {
    const { container } = render(<AnnotationRow {...defaultProps} />);
    expect(screen.queryByLabelText("Remove Label annotation")).toBeNull();
    // Should have a spacer div instead
    const spacers = container.querySelectorAll(".h-3\\.5.w-3\\.5");
    expect(spacers.length).toBeGreaterThan(0);
  });

  it("calls onBlur when value input loses focus", () => {
    const onBlur = vi.fn();
    render(<AnnotationRow {...defaultProps} onBlur={onBlur} />);
    const input = screen.getByLabelText("Label value");
    fireEvent.blur(input);
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it("does not crash when language picker is present (onBlur only on value input)", () => {
    const onBlur = vi.fn();
    render(<AnnotationRow {...defaultProps} onBlur={onBlur} />);
    // The LanguagePicker is a combobox, not a plain input, so onBlur
    // is only triggered on the value input. Verify the picker renders.
    expect(screen.getByTestId("lang-picker")).toBeDefined();
  });

  it("uses custom placeholder when provided", () => {
    render(<AnnotationRow {...defaultProps} placeholder="Enter label" />);
    const input = screen.getByPlaceholderText("Enter label");
    expect(input).toBeDefined();
  });

  it("uses default placeholder 'Value' when not provided", () => {
    render(<AnnotationRow {...defaultProps} />);
    const input = screen.getByPlaceholderText("Value");
    expect(input).toBeDefined();
  });
});
