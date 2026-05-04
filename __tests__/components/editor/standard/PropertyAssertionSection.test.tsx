import { describe, expect, it, vi, beforeEach, type Mock } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PropertyAssertionSection } from "@/components/editor/standard/PropertyAssertionSection";
import type { PropertyAssertion } from "@/lib/ontology/entityDetailExtractors";
import { projectOntologyApi } from "@/lib/api/client";

vi.mock("@/lib/api/client", () => ({
  projectOntologyApi: {
    searchEntities: vi.fn().mockResolvedValue({ results: [], total: 0 }),
  },
}));

vi.mock("@/lib/utils", () => ({
  getLocalName: (iri: string) => {
    if (iri.includes("#")) return iri.split("#").pop() || iri;
    return iri.split("/").pop() || iri;
  },
  langToFlag: (lang: string) => (lang === "en" ? "\u{1F1EC}\u{1F1E7}" : null),
}));

vi.mock("@/components/editor/LanguageFlag", () => ({
  LanguageFlag: ({ lang }: { lang: string }) => (
    <span data-testid={`lang-flag-${lang}`}>{lang}</span>
  ),
}));

const searchMock = projectOntologyApi.searchEntities as Mock;

describe("PropertyAssertionSection", () => {
  const baseProps = {
    assertions: [] as PropertyAssertion[],
    assertionType: "object" as const,
    isEditing: false,
    projectId: "proj-1",
    accessToken: "token",
    branch: "main",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    searchMock.mockReset();
  });

  it("returns null when not editing and no assertions", () => {
    const { container } = render(<PropertyAssertionSection {...baseProps} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders object assertions with navigation buttons", () => {
    const onNavigate = vi.fn();
    const assertions: PropertyAssertion[] = [
      {
        propertyIri: "http://example.org/ontology#hasPart",
        targetIri: "http://example.org/ontology#Wheel",
      },
    ];

    render(
      <PropertyAssertionSection
        {...baseProps}
        assertions={assertions}
        onNavigateToEntity={onNavigate}
      />
    );

    expect(screen.getByText("hasPart")).not.toBeNull();
    expect(screen.getByText("Wheel")).not.toBeNull();

    fireEvent.click(screen.getByText("Wheel"));
    expect(onNavigate).toHaveBeenCalledWith(
      "http://example.org/ontology#Wheel"
    );
  });

  it("renders data assertions with value and language flag", () => {
    const assertions: PropertyAssertion[] = [
      {
        propertyIri: "http://example.org/ontology#label",
        value: "Hello World",
        lang: "en",
      },
    ];

    render(
      <PropertyAssertionSection
        {...baseProps}
        assertionType="data"
        assertions={assertions}
      />
    );

    expect(screen.getByText("label")).not.toBeNull();
    expect(screen.getByText("Hello World")).not.toBeNull();
    expect(screen.getByTestId("lang-flag-en")).not.toBeNull();
  });

  it("renders datatype badge when present", () => {
    const assertions: PropertyAssertion[] = [
      {
        propertyIri: "http://example.org/ontology#age",
        value: "42",
        datatype: "http://www.w3.org/2001/XMLSchema#integer",
      },
    ];

    render(
      <PropertyAssertionSection
        {...baseProps}
        assertionType="data"
        assertions={assertions}
      />
    );

    expect(screen.getByText("42")).not.toBeNull();
    expect(screen.getByText("integer")).not.toBeNull();
  });

  it("uses resolved labels when available", () => {
    const assertions: PropertyAssertion[] = [
      {
        propertyIri: "http://example.org/ontology#hasPart",
        targetIri: "http://example.org/ontology#Wheel",
      },
    ];

    render(
      <PropertyAssertionSection
        {...baseProps}
        assertions={assertions}
        resolvedLabels={{
          "http://example.org/ontology#hasPart": "Has Part",
          "http://example.org/ontology#Wheel": "Wheel Component",
        }}
      />
    );

    expect(screen.getByText("Has Part")).not.toBeNull();
    expect(screen.getByText("Wheel Component")).not.toBeNull();
  });

  it("shows remove button when editing", () => {
    const onRemove = vi.fn();
    const onSaveNeeded = vi.fn();
    const assertions: PropertyAssertion[] = [
      {
        propertyIri: "http://example.org/ontology#hasPart",
        targetIri: "http://example.org/ontology#Wheel",
      },
    ];

    render(
      <PropertyAssertionSection
        {...baseProps}
        assertions={assertions}
        isEditing={true}
        onRemove={onRemove}
        onSaveNeeded={onSaveNeeded}
      />
    );

    const removeBtn = screen.getByTitle("Remove");
    fireEvent.click(removeBtn);
    expect(onRemove).toHaveBeenCalledWith(0);
    expect(onSaveNeeded).toHaveBeenCalled();
  });

  it("does not show remove button when not editing", () => {
    const assertions: PropertyAssertion[] = [
      {
        propertyIri: "http://example.org/ontology#hasPart",
        targetIri: "http://example.org/ontology#Wheel",
      },
    ];

    render(
      <PropertyAssertionSection
        {...baseProps}
        assertions={assertions}
        isEditing={false}
      />
    );

    expect(screen.queryByTitle("Remove")).toBeNull();
  });

  it("renders adder row when editing with onAdd", () => {
    render(
      <PropertyAssertionSection
        {...baseProps}
        isEditing={true}
        onAdd={vi.fn()}
      />
    );

    expect(screen.getByPlaceholderText("Select property...")).not.toBeNull();
  });

  it("renders object value input placeholder when no property selected", () => {
    render(
      <PropertyAssertionSection
        {...baseProps}
        isEditing={true}
        onAdd={vi.fn()}
      />
    );

    const valueInput = screen.getByPlaceholderText("Select a property first");
    expect((valueInput as HTMLInputElement).disabled).toBe(true);
  });

  it("renders data assertion adder when assertionType is data", () => {
    render(
      <PropertyAssertionSection
        {...baseProps}
        assertionType="data"
        isEditing={true}
        onAdd={vi.fn()}
      />
    );

    expect(screen.getByPlaceholderText("Select property...")).not.toBeNull();
    expect(screen.getByPlaceholderText("Select a property first")).not.toBeNull();
  });

  it("does not show adder when editing but no onAdd callback", () => {
    render(
      <PropertyAssertionSection
        {...baseProps}
        isEditing={true}
      />
    );

    expect(screen.queryByPlaceholderText("Select property...")).toBeNull();
  });

  it("does not show remove button when onRemove is not provided", () => {
    const assertions: PropertyAssertion[] = [
      {
        propertyIri: "http://example.org/ontology#hasPart",
        targetIri: "http://example.org/ontology#Wheel",
      },
    ];

    render(
      <PropertyAssertionSection
        {...baseProps}
        assertions={assertions}
        isEditing={true}
      />
    );

    expect(screen.queryByTitle("Remove")).toBeNull();
  });

  it("renders multiple assertions", () => {
    const assertions: PropertyAssertion[] = [
      {
        propertyIri: "http://example.org/ontology#hasPart",
        targetIri: "http://example.org/ontology#Wheel",
      },
      {
        propertyIri: "http://example.org/ontology#hasPart",
        targetIri: "http://example.org/ontology#Engine",
      },
    ];

    render(
      <PropertyAssertionSection
        {...baseProps}
        assertions={assertions}
      />
    );

    expect(screen.getByText("Wheel")).not.toBeNull();
    expect(screen.getByText("Engine")).not.toBeNull();
  });

  it("renders data assertion without lang flag when lang is absent", () => {
    const assertions: PropertyAssertion[] = [
      {
        propertyIri: "http://example.org/ontology#code",
        value: "ABC123",
      },
    ];

    render(
      <PropertyAssertionSection
        {...baseProps}
        assertionType="data"
        assertions={assertions}
      />
    );

    expect(screen.getByText("ABC123")).not.toBeNull();
    expect(screen.queryByTestId("lang-flag-en")).toBeNull();
  });

  it("shows property IRI as title attribute on property label", () => {
    const assertions: PropertyAssertion[] = [
      {
        propertyIri: "http://example.org/ontology#hasPart",
        targetIri: "http://example.org/ontology#Wheel",
      },
    ];

    render(
      <PropertyAssertionSection
        {...baseProps}
        assertions={assertions}
      />
    );

    expect(screen.getByTitle("http://example.org/ontology#hasPart")).not.toBeNull();
  });

  it("shows target IRI as title attribute on object navigation button", () => {
    const assertions: PropertyAssertion[] = [
      {
        propertyIri: "http://example.org/ontology#hasPart",
        targetIri: "http://example.org/ontology#Wheel",
      },
    ];

    render(
      <PropertyAssertionSection
        {...baseProps}
        assertions={assertions}
      />
    );

    expect(screen.getByTitle("http://example.org/ontology#Wheel")).not.toBeNull();
  });

  // Helper to trigger a property search and wait for results to appear
  async function triggerPropSearch(query: string) {
    const propInput = screen.getByPlaceholderText("Select property...");
    fireEvent.focus(propInput);
    fireEvent.change(propInput, { target: { value: query } });
    // Wait for 300ms debounce + API resolution
    await waitFor(() => {
      expect(searchMock).toHaveBeenCalled();
    });
  }

  // Helper to select a property from search results
  async function selectProperty(
    label: string,
    iri: string,
    query = "has"
  ) {
    searchMock.mockResolvedValueOnce({
      results: [{ iri, label }],
      total: 1,
    });

    await triggerPropSearch(query);

    await waitFor(() => {
      expect(screen.getByText(label)).not.toBeNull();
    });

    fireEvent.click(screen.getByText(label));

    await waitFor(() => {
      expect(screen.queryByPlaceholderText("Select property...")).toBeNull();
    });
  }

  describe("AssertionAdder - property search", () => {
    it("searches for properties when typing in property input", async () => {
      searchMock.mockResolvedValue({
        results: [
          { iri: "http://example.org/ontology#hasPart", label: "has part" },
        ],
        total: 1,
      });

      render(
        <PropertyAssertionSection
          {...baseProps}
          isEditing={true}
          onAdd={vi.fn()}
        />
      );

      await triggerPropSearch("has");

      expect(searchMock).toHaveBeenCalledWith(
        "proj-1",
        "has",
        "token",
        "main",
        "property"
      );

      await waitFor(() => {
        expect(screen.getByText("has part")).not.toBeNull();
      });
    });

    it("shows spinner while searching properties", async () => {
      let resolveSearch: ((value: { results: never[]; total: number }) => void) | undefined;
      searchMock.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveSearch = resolve;
          })
      );

      const { container } = render(
        <PropertyAssertionSection
          {...baseProps}
          isEditing={true}
          onAdd={vi.fn()}
        />
      );

      const propInput = screen.getByPlaceholderText("Select property...");
      fireEvent.focus(propInput);
      fireEvent.change(propInput, { target: { value: "has" } });

      // Wait for spinner to appear (after 300ms debounce triggers the search)
      await waitFor(() => {
        const spinner = container.querySelector(".animate-spin");
        expect(spinner).not.toBeNull();
      });

      // Resolve the pending promise to clean up
      if (resolveSearch) {
        resolveSearch({ results: [], total: 0 });
      }
    });

    it("shows 'No properties found' when search returns empty", async () => {
      searchMock.mockResolvedValue({ results: [], total: 0 });

      render(
        <PropertyAssertionSection
          {...baseProps}
          isEditing={true}
          onAdd={vi.fn()}
        />
      );

      await triggerPropSearch("nonexistent");

      await waitFor(() => {
        expect(screen.getByText("No properties found")).not.toBeNull();
      });
    });

    it("selects a property and shows it as a button", async () => {
      render(
        <PropertyAssertionSection
          {...baseProps}
          isEditing={true}
          onAdd={vi.fn()}
        />
      );

      await selectProperty("has part", "http://example.org/ontology#hasPart");

      // The selected property label should be visible as a button
      expect(screen.getByText("has part")).not.toBeNull();
    });

    it("clears selected property when clicking the property button", async () => {
      render(
        <PropertyAssertionSection
          {...baseProps}
          isEditing={true}
          onAdd={vi.fn()}
        />
      );

      await selectProperty("has part", "http://example.org/ontology#hasPart");

      // Click the property button to deselect
      fireEvent.click(screen.getByText("has part"));

      await waitFor(() => {
        expect(screen.getByPlaceholderText("Select property...")).not.toBeNull();
      });
    });

    it("uses getLocalName when property result has no label", async () => {
      searchMock.mockResolvedValue({
        results: [
          { iri: "http://example.org/ontology#hasPart" },
        ],
        total: 1,
      });

      render(
        <PropertyAssertionSection
          {...baseProps}
          isEditing={true}
          onAdd={vi.fn()}
        />
      );

      await triggerPropSearch("has");

      await waitFor(() => {
        expect(screen.getByText("hasPart")).not.toBeNull();
      });
    });

    it("handles search API errors gracefully", async () => {
      searchMock.mockRejectedValue(new Error("Network error"));

      render(
        <PropertyAssertionSection
          {...baseProps}
          isEditing={true}
          onAdd={vi.fn()}
        />
      );

      const propInput = screen.getByPlaceholderText("Select property...");
      fireEvent.focus(propInput);
      fireEvent.change(propInput, { target: { value: "fail" } });

      await waitFor(() => {
        expect(screen.getByText("No properties found")).not.toBeNull();
      });
    });

    it("clears property results when query is emptied", async () => {
      searchMock.mockResolvedValue({
        results: [
          { iri: "http://example.org/ontology#hasPart", label: "has part" },
        ],
        total: 1,
      });

      render(
        <PropertyAssertionSection
          {...baseProps}
          isEditing={true}
          onAdd={vi.fn()}
        />
      );

      await triggerPropSearch("has");

      await waitFor(() => {
        expect(screen.getByText("has part")).not.toBeNull();
      });

      // Clear the input
      const propInput = screen.getByPlaceholderText("Select property...");
      fireEvent.change(propInput, { target: { value: "" } });

      await waitFor(() => {
        expect(screen.queryByText("has part")).toBeNull();
      });
    });
  });

  describe("AssertionAdder - object value search", () => {
    it("enables value input after property is selected", async () => {
      render(
        <PropertyAssertionSection
          {...baseProps}
          isEditing={true}
          onAdd={vi.fn()}
        />
      );

      await selectProperty("has part", "http://example.org/ontology#hasPart");

      const valueInput = screen.getByPlaceholderText("Search entity...");
      expect((valueInput as HTMLInputElement).disabled).toBe(false);
    });

    it("searches entities for object values", async () => {
      render(
        <PropertyAssertionSection
          {...baseProps}
          isEditing={true}
          onAdd={vi.fn()}
        />
      );

      await selectProperty("has part", "http://example.org/ontology#hasPart");

      searchMock.mockResolvedValueOnce({
        results: [
          { iri: "http://example.org/ontology#Wheel", label: "Wheel" },
        ],
        total: 1,
      });

      const valueInput = screen.getByPlaceholderText("Search entity...");
      fireEvent.focus(valueInput);
      fireEvent.change(valueInput, { target: { value: "Whe" } });

      await waitFor(() => {
        expect(screen.getByText("Wheel")).not.toBeNull();
      });
    });

    it("adds an object assertion when clicking a value result", async () => {
      const onAdd = vi.fn();
      const onSaveNeeded = vi.fn();

      render(
        <PropertyAssertionSection
          {...baseProps}
          isEditing={true}
          onAdd={onAdd}
          onSaveNeeded={onSaveNeeded}
        />
      );

      await selectProperty("has part", "http://example.org/ontology#hasPart");

      searchMock.mockResolvedValueOnce({
        results: [
          { iri: "http://example.org/ontology#Wheel", label: "Wheel" },
        ],
        total: 1,
      });

      const valueInput = screen.getByPlaceholderText("Search entity...");
      fireEvent.focus(valueInput);
      fireEvent.change(valueInput, { target: { value: "Whe" } });

      await waitFor(() => {
        expect(screen.getByText("Wheel")).not.toBeNull();
      });

      fireEvent.click(screen.getByText("Wheel"));

      expect(onAdd).toHaveBeenCalledWith({
        propertyIri: "http://example.org/ontology#hasPart",
        targetIri: "http://example.org/ontology#Wheel",
      });
      expect(onSaveNeeded).toHaveBeenCalled();
    });

    it("shows 'No results' when entity search returns empty", async () => {
      searchMock.mockResolvedValue({ results: [], total: 0 });

      render(
        <PropertyAssertionSection
          {...baseProps}
          isEditing={true}
          onAdd={vi.fn()}
        />
      );

      await selectProperty("has part", "http://example.org/ontology#hasPart");

      const valueInput = screen.getByPlaceholderText("Search entity...");
      fireEvent.focus(valueInput);
      fireEvent.change(valueInput, { target: { value: "nonexistent" } });

      await waitFor(() => {
        expect(screen.getByText("No results")).not.toBeNull();
      });
    });

    it("shows entity IRI below label in value search results", async () => {
      render(
        <PropertyAssertionSection
          {...baseProps}
          isEditing={true}
          onAdd={vi.fn()}
        />
      );

      await selectProperty("has part", "http://example.org/ontology#hasPart");

      searchMock.mockResolvedValueOnce({
        results: [
          { iri: "http://example.org/ontology#Wheel", label: "Wheel" },
        ],
        total: 1,
      });

      const valueInput = screen.getByPlaceholderText("Search entity...");
      fireEvent.focus(valueInput);
      fireEvent.change(valueInput, { target: { value: "Whe" } });

      await waitFor(() => {
        expect(screen.getByText("http://example.org/ontology#Wheel")).not.toBeNull();
      });
    });

    it("resets adder state after adding an object assertion", async () => {
      const onAdd = vi.fn();

      render(
        <PropertyAssertionSection
          {...baseProps}
          isEditing={true}
          onAdd={onAdd}
        />
      );

      await selectProperty("has part", "http://example.org/ontology#hasPart");

      searchMock.mockResolvedValueOnce({
        results: [
          { iri: "http://example.org/ontology#Wheel", label: "Wheel" },
        ],
        total: 1,
      });

      const valueInput = screen.getByPlaceholderText("Search entity...");
      fireEvent.focus(valueInput);
      fireEvent.change(valueInput, { target: { value: "Whe" } });

      await waitFor(() => {
        expect(screen.getByText("Wheel")).not.toBeNull();
      });

      fireEvent.click(screen.getByText("Wheel"));

      // After adding, the property input should reappear
      await waitFor(() => {
        expect(screen.getByPlaceholderText("Select property...")).not.toBeNull();
      });
    });

    it("handles value search API errors gracefully", async () => {
      render(
        <PropertyAssertionSection
          {...baseProps}
          isEditing={true}
          onAdd={vi.fn()}
        />
      );

      await selectProperty("has part", "http://example.org/ontology#hasPart");

      searchMock.mockRejectedValueOnce(new Error("Network error"));

      const valueInput = screen.getByPlaceholderText("Search entity...");
      fireEvent.focus(valueInput);
      fireEvent.change(valueInput, { target: { value: "fail" } });

      await waitFor(() => {
        expect(screen.getByText("No results")).not.toBeNull();
      });
    });
  });

  describe("AssertionAdder - data value input", () => {
    async function selectPropertyForData() {
      await selectProperty("label", "http://example.org/ontology#label", "lab");
    }

    it("adds data assertion on Enter key press", async () => {
      const onAdd = vi.fn();
      const onSaveNeeded = vi.fn();

      render(
        <PropertyAssertionSection
          {...baseProps}
          assertionType="data"
          isEditing={true}
          onAdd={onAdd}
          onSaveNeeded={onSaveNeeded}
        />
      );

      await selectPropertyForData();

      const valueInput = screen.getByPlaceholderText("Enter value...");
      fireEvent.change(valueInput, { target: { value: "Hello" } });
      fireEvent.keyDown(valueInput, { key: "Enter" });

      expect(onAdd).toHaveBeenCalledWith({
        propertyIri: "http://example.org/ontology#label",
        value: "Hello",
        lang: "en",
      });
      expect(onSaveNeeded).toHaveBeenCalled();
    });

    it("adds data assertion on blur when value is non-empty", async () => {
      const onAdd = vi.fn();

      render(
        <PropertyAssertionSection
          {...baseProps}
          assertionType="data"
          isEditing={true}
          onAdd={onAdd}
        />
      );

      await selectPropertyForData();

      const valueInput = screen.getByPlaceholderText("Enter value...");
      fireEvent.change(valueInput, { target: { value: "World" } });
      fireEvent.blur(valueInput);

      expect(onAdd).toHaveBeenCalledWith({
        propertyIri: "http://example.org/ontology#label",
        value: "World",
        lang: "en",
      });
    });

    it("does not add data assertion when value is empty", async () => {
      const onAdd = vi.fn();

      render(
        <PropertyAssertionSection
          {...baseProps}
          assertionType="data"
          isEditing={true}
          onAdd={onAdd}
        />
      );

      await selectPropertyForData();

      const valueInput = screen.getByPlaceholderText("Enter value...");
      fireEvent.keyDown(valueInput, { key: "Enter" });

      expect(onAdd).not.toHaveBeenCalled();
    });

    it("does not add data assertion when only whitespace", async () => {
      const onAdd = vi.fn();

      render(
        <PropertyAssertionSection
          {...baseProps}
          assertionType="data"
          isEditing={true}
          onAdd={onAdd}
        />
      );

      await selectPropertyForData();

      const valueInput = screen.getByPlaceholderText("Enter value...");
      fireEvent.change(valueInput, { target: { value: "   " } });
      fireEvent.keyDown(valueInput, { key: "Enter" });

      expect(onAdd).not.toHaveBeenCalled();
    });

    it("respects custom language tag", async () => {
      const onAdd = vi.fn();

      render(
        <PropertyAssertionSection
          {...baseProps}
          assertionType="data"
          isEditing={true}
          onAdd={onAdd}
        />
      );

      await selectPropertyForData();

      const valueInput = screen.getByPlaceholderText("Enter value...");
      const langInput = screen.getByTitle("Language tag");

      fireEvent.change(langInput, { target: { value: "fr" } });
      fireEvent.change(valueInput, { target: { value: "Bonjour" } });
      fireEvent.keyDown(valueInput, { key: "Enter" });

      expect(onAdd).toHaveBeenCalledWith({
        propertyIri: "http://example.org/ontology#label",
        value: "Bonjour",
        lang: "fr",
      });
    });

    it("omits lang when language tag is empty", async () => {
      const onAdd = vi.fn();

      render(
        <PropertyAssertionSection
          {...baseProps}
          assertionType="data"
          isEditing={true}
          onAdd={onAdd}
        />
      );

      await selectPropertyForData();

      const valueInput = screen.getByPlaceholderText("Enter value...");
      const langInput = screen.getByTitle("Language tag");

      fireEvent.change(langInput, { target: { value: "" } });
      fireEvent.change(valueInput, { target: { value: "42" } });
      fireEvent.keyDown(valueInput, { key: "Enter" });

      expect(onAdd).toHaveBeenCalledWith({
        propertyIri: "http://example.org/ontology#label",
        value: "42",
        lang: undefined,
      });
    });

    it("resets adder state after adding a data assertion", async () => {
      const onAdd = vi.fn();

      render(
        <PropertyAssertionSection
          {...baseProps}
          assertionType="data"
          isEditing={true}
          onAdd={onAdd}
        />
      );

      await selectPropertyForData();

      const valueInput = screen.getByPlaceholderText("Enter value...");
      fireEvent.change(valueInput, { target: { value: "test" } });
      fireEvent.keyDown(valueInput, { key: "Enter" });

      // After adding, property input should reappear
      await waitFor(() => {
        expect(screen.getByPlaceholderText("Select property...")).not.toBeNull();
      });
    });

    it("shows language flag in data adder", () => {
      render(
        <PropertyAssertionSection
          {...baseProps}
          assertionType="data"
          isEditing={true}
          onAdd={vi.fn()}
        />
      );

      // Default language is "en"
      expect(screen.getByTestId("lang-flag-en")).not.toBeNull();
    });

    it("disables value input when no property is selected", () => {
      render(
        <PropertyAssertionSection
          {...baseProps}
          assertionType="data"
          isEditing={true}
          onAdd={vi.fn()}
        />
      );

      const valueInput = screen.getByPlaceholderText("Select a property first");
      expect((valueInput as HTMLInputElement).disabled).toBe(true);
    });

    it("disables language input when no property is selected", () => {
      render(
        <PropertyAssertionSection
          {...baseProps}
          assertionType="data"
          isEditing={true}
          onAdd={vi.fn()}
        />
      );

      const langInput = screen.getByTitle("Language tag");
      expect((langInput as HTMLInputElement).disabled).toBe(true);
    });
  });

  describe("AssertionAdder - click outside", () => {
    it("closes property dropdown on click outside", async () => {
      searchMock.mockResolvedValue({
        results: [
          { iri: "http://example.org/ontology#hasPart", label: "has part" },
        ],
        total: 1,
      });

      render(
        <div>
          <div data-testid="outside">Outside</div>
          <PropertyAssertionSection
            {...baseProps}
            isEditing={true}
            onAdd={vi.fn()}
          />
        </div>
      );

      await triggerPropSearch("has");

      await waitFor(() => {
        expect(screen.getByText("has part")).not.toBeNull();
      });

      // Click outside the property container
      fireEvent.mouseDown(screen.getByTestId("outside"));

      await waitFor(() => {
        expect(screen.queryByText("has part")).toBeNull();
      });
    });
  });

  describe("AssertionAdder - value search does not trigger for data type", () => {
    it("does not search entities when assertionType is data", async () => {
      render(
        <PropertyAssertionSection
          {...baseProps}
          assertionType="data"
          isEditing={true}
          onAdd={vi.fn()}
        />
      );

      await selectProperty("label", "http://example.org/ontology#label", "lab");

      // Clear mock call count after property selection
      searchMock.mockClear();

      // The data value input does not trigger entity search
      const valueInput = screen.getByPlaceholderText("Enter value...");
      fireEvent.change(valueInput, { target: { value: "some value" } });

      // Wait a bit to ensure no search is triggered
      await new Promise((resolve) => setTimeout(resolve, 500));

      // searchEntities should not be called for data type values
      expect(searchMock).not.toHaveBeenCalled();
    });
  });
});
