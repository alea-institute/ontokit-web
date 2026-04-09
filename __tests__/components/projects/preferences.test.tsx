import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LabelPreferences } from "@/components/projects/label-preferences";

describe("LabelPreferences", () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders info box explaining label preferences", () => {
    render(<LabelPreferences preferences={[]} onChange={mockOnChange} />);

    expect(
      screen.getByText(/Label preferences determine how class names are displayed/)
    ).toBeDefined();
  });

  it("shows default message when no preferences are configured", () => {
    render(<LabelPreferences preferences={[]} onChange={mockOnChange} />);

    expect(
      screen.getByText(/No preferences configured\. Using defaults/)
    ).toBeDefined();
  });

  it("renders preference items when preferences are provided", () => {
    render(
      <LabelPreferences
        preferences={["rdfs:label@en", "skos:prefLabel"]}
        onChange={mockOnChange}
      />
    );

    expect(screen.getAllByText("rdfs:label").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("en")).toBeDefined();
    expect(screen.getAllByText("skos:prefLabel").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("#1")).toBeDefined();
    expect(screen.getByText("#2")).toBeDefined();
  });

  it("does not show 'no preferences' message when preferences exist", () => {
    render(
      <LabelPreferences preferences={["rdfs:label"]} onChange={mockOnChange} />
    );

    expect(
      screen.queryByText(/No preferences configured/)
    ).toBeNull();
  });

  it("adds a preference without language tag", async () => {
    const user = userEvent.setup();
    render(<LabelPreferences preferences={[]} onChange={mockOnChange} />);

    // Default property is rdfs:label, default language is "Any language" (empty)
    await user.click(screen.getByRole("button", { name: /Add/ }));

    expect(mockOnChange).toHaveBeenCalledWith(["rdfs:label"]);
  });

  it("adds a preference with language tag", async () => {
    const user = userEvent.setup();
    render(<LabelPreferences preferences={[]} onChange={mockOnChange} />);

    // Select a language
    const languageSelect = screen.getAllByRole("combobox")[1];
    await user.selectOptions(languageSelect, "en");

    await user.click(screen.getByRole("button", { name: /Add/ }));

    expect(mockOnChange).toHaveBeenCalledWith(["rdfs:label@en"]);
  });

  it("adds a preference with a different property", async () => {
    const user = userEvent.setup();
    render(<LabelPreferences preferences={[]} onChange={mockOnChange} />);

    const propertySelect = screen.getAllByRole("combobox")[0];
    await user.selectOptions(propertySelect, "skos:prefLabel");

    await user.click(screen.getByRole("button", { name: /Add/ }));

    expect(mockOnChange).toHaveBeenCalledWith(["skos:prefLabel"]);
  });

  it("does not add duplicate preferences", async () => {
    const user = userEvent.setup();
    render(
      <LabelPreferences
        preferences={["rdfs:label"]}
        onChange={mockOnChange}
      />
    );

    // Try to add rdfs:label again (default selections)
    await user.click(screen.getByRole("button", { name: /Add/ }));

    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it("removes a preference when remove button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <LabelPreferences
        preferences={["rdfs:label@en", "skos:prefLabel"]}
        onChange={mockOnChange}
      />
    );

    // Click the first remove button
    const removeButtons = screen.getAllByTitle("Remove");
    await user.click(removeButtons[0]);

    expect(mockOnChange).toHaveBeenCalledWith(["skos:prefLabel"]);
  });

  it("moves a preference up when move up button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <LabelPreferences
        preferences={["rdfs:label@en", "skos:prefLabel"]}
        onChange={mockOnChange}
      />
    );

    // Click the second item's "Move up" button
    const moveUpButtons = screen.getAllByTitle("Move up");
    await user.click(moveUpButtons[1]); // Second item's move up

    expect(mockOnChange).toHaveBeenCalledWith(["skos:prefLabel", "rdfs:label@en"]);
  });

  it("moves a preference down when move down button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <LabelPreferences
        preferences={["rdfs:label@en", "skos:prefLabel"]}
        onChange={mockOnChange}
      />
    );

    // Click the first item's "Move down" button
    const moveDownButtons = screen.getAllByTitle("Move down");
    await user.click(moveDownButtons[0]);

    expect(mockOnChange).toHaveBeenCalledWith(["skos:prefLabel", "rdfs:label@en"]);
  });

  it("disables move up for first item", () => {
    render(
      <LabelPreferences
        preferences={["rdfs:label@en", "skos:prefLabel"]}
        onChange={mockOnChange}
      />
    );

    const moveUpButtons = screen.getAllByTitle("Move up");
    expect((moveUpButtons[0] as HTMLButtonElement).disabled).toBe(true);
  });

  it("disables move down for last item", () => {
    render(
      <LabelPreferences
        preferences={["rdfs:label@en", "skos:prefLabel"]}
        onChange={mockOnChange}
      />
    );

    const moveDownButtons = screen.getAllByTitle("Move down");
    expect((moveDownButtons[moveDownButtons.length - 1] as HTMLButtonElement).disabled).toBe(true);
  });

  it("disables all controls when disabled prop is true", () => {
    render(
      <LabelPreferences
        preferences={["rdfs:label"]}
        onChange={mockOnChange}
        disabled={true}
      />
    );

    // Selects should be disabled
    const selects = screen.getAllByRole("combobox");
    selects.forEach((select) => {
      expect((select as HTMLSelectElement).disabled).toBe(true);
    });

    // Add button should be disabled
    expect((screen.getByRole("button", { name: /Add/ }) as HTMLButtonElement).disabled).toBe(true);

    // Remove button should be disabled
    expect((screen.getByTitle("Remove") as HTMLButtonElement).disabled).toBe(true);
  });

  it("renders all label property options in the property select", () => {
    render(<LabelPreferences preferences={[]} onChange={mockOnChange} />);

    const propertySelect = screen.getAllByRole("combobox")[0];
    const options = within(propertySelect).getAllByRole("option");

    expect(options).toHaveLength(5);
    expect(options.map((o) => o.textContent)).toContain("rdfs:label");
    expect(options.map((o) => o.textContent)).toContain("skos:prefLabel");
    expect(options.map((o) => o.textContent)).toContain("dcterms:title");
  });

  it("renders all language options in the language select", () => {
    render(<LabelPreferences preferences={[]} onChange={mockOnChange} />);

    const languageSelect = screen.getAllByRole("combobox")[1];
    const options = within(languageSelect).getAllByRole("option");

    expect(options).toHaveLength(8);
    expect(options.map((o) => o.textContent)).toContain("Any language");
    expect(options.map((o) => o.textContent)).toContain("English (en)");
    expect(options.map((o) => o.textContent)).toContain("Latin (la)");
  });

  it("shows priority numbers for preferences", () => {
    render(
      <LabelPreferences
        preferences={["rdfs:label", "skos:prefLabel", "dcterms:title"]}
        onChange={mockOnChange}
      />
    );

    expect(screen.getByText("#1")).toBeDefined();
    expect(screen.getByText("#2")).toBeDefined();
    expect(screen.getByText("#3")).toBeDefined();
  });
});
