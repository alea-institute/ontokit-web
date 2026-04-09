import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

// --- Mocks ---

const mockSearchEntities = vi.fn().mockResolvedValue({ results: [], total: 0 });

vi.mock("@/lib/api/client", () => ({
  projectOntologyApi: {
    searchEntities: (...args: unknown[]) => mockSearchEntities(...args),
  },
}));

vi.mock("@/lib/ontology/annotationProperties", () => ({
  SEE_ALSO_IRI: "http://www.w3.org/2000/01/rdf-schema#seeAlso",
  IS_DEFINED_BY_IRI: "http://www.w3.org/2000/01/rdf-schema#isDefinedBy",
  getAnnotationPropertyInfo: vi.fn((iri: string) => {
    if (iri === "http://www.w3.org/2000/01/rdf-schema#seeAlso") {
      return { curie: "rdfs:seeAlso", label: "See Also" };
    }
    if (iri === "http://www.w3.org/2000/01/rdf-schema#isDefinedBy") {
      return { curie: "rdfs:isDefinedBy", label: "Defined By" };
    }
    return { curie: iri, label: iri };
  }),
}));

import {
  RelationshipSection,
  type RelationshipGroup,
} from "@/components/editor/standard/RelationshipSection";

// --- Helpers ---

const seeAlsoGroup: RelationshipGroup = {
  property_iri: "http://www.w3.org/2000/01/rdf-schema#seeAlso",
  property_label: "See Also",
  targets: [
    { iri: "http://example.org/ClassB", label: "Class B" },
  ],
};

const multiTargetGroup: RelationshipGroup = {
  property_iri: "http://www.w3.org/2000/01/rdf-schema#seeAlso",
  property_label: "See Also",
  targets: [
    { iri: "http://example.org/ClassB", label: "Class B" },
    { iri: "http://example.org/ClassC", label: "Class C" },
  ],
};

const emptyGroup: RelationshipGroup = {
  property_iri: "http://www.w3.org/2000/01/rdf-schema#seeAlso",
  property_label: "See Also",
  targets: [],
};

const baseProps = {
  projectId: "proj-1",
  accessToken: "token-123",
  branch: "main",
};

// --- Tests ---

describe("RelationshipSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchEntities.mockResolvedValue({ results: [], total: 0 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // --- Read mode ---

  describe("read mode (isEditing=false)", () => {
    it("returns null when no groups have targets", () => {
      const { container } = render(
        <RelationshipSection
          {...baseProps}
          groups={[emptyGroup]}
          isEditing={false}
        />
      );
      expect(container.innerHTML).toBe("");
    });

    it("returns null when groups array is empty", () => {
      const { container } = render(
        <RelationshipSection {...baseProps} groups={[]} isEditing={false} />
      );
      expect(container.innerHTML).toBe("");
    });

    it("renders targets as clickable links", () => {
      const onNavigate = vi.fn();
      render(
        <RelationshipSection
          {...baseProps}
          groups={[seeAlsoGroup]}
          isEditing={false}
          onNavigateToClass={onNavigate}
        />
      );
      expect(screen.getByText("Class B")).toBeDefined();
      expect(screen.getByText("See Also")).toBeDefined();
    });

    it("calls onNavigateToClass when clicking a target", () => {
      const onNavigate = vi.fn();
      render(
        <RelationshipSection
          {...baseProps}
          groups={[seeAlsoGroup]}
          isEditing={false}
          onNavigateToClass={onNavigate}
        />
      );
      fireEvent.click(screen.getByText("Class B"));
      expect(onNavigate).toHaveBeenCalledWith("http://example.org/ClassB");
    });

    it("renders multiple targets", () => {
      render(
        <RelationshipSection
          {...baseProps}
          groups={[multiTargetGroup]}
          isEditing={false}
        />
      );
      expect(screen.getByText("Class B")).toBeDefined();
      expect(screen.getByText("Class C")).toBeDefined();
    });

    it("disables target button when onNavigateToClass not provided", () => {
      render(
        <RelationshipSection
          {...baseProps}
          groups={[seeAlsoGroup]}
          isEditing={false}
        />
      );
      const btn = screen.getByText("Class B");
      expect(btn.closest("button")?.disabled).toBe(true);
    });
  });

  // --- Edit mode ---

  describe("edit mode (isEditing=true)", () => {
    it("renders groups including those with no targets", () => {
      render(
        <RelationshipSection
          {...baseProps}
          groups={[emptyGroup]}
          isEditing={true}
        />
      );
      // Should render the add relationship button and the empty group
      expect(screen.getByText("Add relationship")).toBeDefined();
    });

    it("renders target with delete button", () => {
      render(
        <RelationshipSection
          {...baseProps}
          groups={[seeAlsoGroup]}
          isEditing={true}
        />
      );
      expect(screen.getByText("Class B")).toBeDefined();
      expect(screen.getByTitle("Remove")).toBeDefined();
    });

    it("calls onRemoveTarget and onSaveNeeded when delete clicked", () => {
      const onRemove = vi.fn();
      const onSave = vi.fn();
      render(
        <RelationshipSection
          {...baseProps}
          groups={[seeAlsoGroup]}
          isEditing={true}
          onRemoveTarget={onRemove}
          onSaveNeeded={onSave}
        />
      );
      fireEvent.click(screen.getByTitle("Remove"));
      expect(onRemove).toHaveBeenCalledWith(0, 0);
      expect(onSave).toHaveBeenCalled();
    });

    it("calls onNavigateToClass when clicking target in edit mode", () => {
      const onNavigate = vi.fn();
      render(
        <RelationshipSection
          {...baseProps}
          groups={[seeAlsoGroup]}
          isEditing={true}
          onNavigateToClass={onNavigate}
        />
      );
      fireEvent.click(screen.getByText("Class B"));
      expect(onNavigate).toHaveBeenCalledWith("http://example.org/ClassB");
    });

    it("calls onAddGroup when add relationship button clicked", () => {
      const onAdd = vi.fn();
      render(
        <RelationshipSection
          {...baseProps}
          groups={[seeAlsoGroup]}
          isEditing={true}
          onAddGroup={onAdd}
        />
      );
      fireEvent.click(screen.getByText("Add relationship"));
      expect(onAdd).toHaveBeenCalled();
    });

    it("renders entity search input for adding targets", () => {
      render(
        <RelationshipSection
          {...baseProps}
          groups={[seeAlsoGroup]}
          isEditing={true}
        />
      );
      expect(screen.getByPlaceholderText("Search entities to add...")).toBeDefined();
    });

    it("renders property picker button with current label", () => {
      render(
        <RelationshipSection
          {...baseProps}
          groups={[seeAlsoGroup]}
          isEditing={true}
        />
      );
      // The property picker shows the current label in a button
      expect(screen.getByText("See Also")).toBeDefined();
    });

    // --- Entity search integration ---

    it("calls searchEntities when typing in entity search", async () => {
      vi.useFakeTimers();
      mockSearchEntities.mockResolvedValue({
        results: [
          { iri: "http://example.org/ClassD", label: "Class D", entity_type: "class" },
        ],
        total: 1,
      });

      render(
        <RelationshipSection
          {...baseProps}
          groups={[seeAlsoGroup]}
          isEditing={true}
        />
      );

      const input = screen.getByPlaceholderText("Search entities to add...");
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: "Class" } });

      // Debounce timer
      vi.advanceTimersByTime(300);
      await vi.waitFor(() => {
        expect(mockSearchEntities).toHaveBeenCalledWith("proj-1", "Class", "token-123", "main");
      });

      vi.useRealTimers();
    });

    it("calls onAddTarget when selecting from entity search", async () => {
      vi.useFakeTimers();
      const onAddTarget = vi.fn();
      const onSave = vi.fn();
      mockSearchEntities.mockResolvedValue({
        results: [
          { iri: "http://example.org/ClassD", label: "Class D", entity_type: "class" },
        ],
        total: 1,
      });

      render(
        <RelationshipSection
          {...baseProps}
          groups={[seeAlsoGroup]}
          isEditing={true}
          onAddTarget={onAddTarget}
          onSaveNeeded={onSave}
        />
      );

      const input = screen.getByPlaceholderText("Search entities to add...");
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: "Class" } });

      vi.advanceTimersByTime(300);

      await vi.waitFor(() => {
        expect(mockSearchEntities).toHaveBeenCalled();
      });

      // Wait for results to render
      await vi.waitFor(() => {
        expect(screen.getByText("Class D")).toBeDefined();
      });

      fireEvent.click(screen.getByText("Class D"));
      expect(onAddTarget).toHaveBeenCalledWith(0, {
        iri: "http://example.org/ClassD",
        label: "Class D",
      });
      expect(onSave).toHaveBeenCalled();

      vi.useRealTimers();
    });

    // --- Property picker ---

    it("opens property picker dropdown on click", () => {
      render(
        <RelationshipSection
          {...baseProps}
          groups={[seeAlsoGroup]}
          isEditing={true}
        />
      );

      // Click the property picker button (contains "See Also" label)
      const pickerButton = screen.getByText("See Also").closest("button")!;
      fireEvent.click(pickerButton);

      // Dropdown should show search input and built-in properties
      expect(screen.getByPlaceholderText("Search properties...")).toBeDefined();
      expect(screen.getByText("RDFS")).toBeDefined();
    });

    it("calls onChangeProperty when selecting from property picker", () => {
      const onChangeProperty = vi.fn();
      render(
        <RelationshipSection
          {...baseProps}
          groups={[seeAlsoGroup]}
          isEditing={true}
          onChangeProperty={onChangeProperty}
        />
      );

      const pickerButton = screen.getByText("See Also").closest("button")!;
      fireEvent.click(pickerButton);

      // Click "Defined By" option
      fireEvent.click(screen.getByText("Defined By"));
      expect(onChangeProperty).toHaveBeenCalledWith(
        0,
        "http://www.w3.org/2000/01/rdf-schema#isDefinedBy",
        "Defined By"
      );
    });

    it("handles multiple groups with remove on second group", () => {
      const onRemove = vi.fn();
      const groups: RelationshipGroup[] = [
        seeAlsoGroup,
        {
          property_iri: "http://www.w3.org/2000/01/rdf-schema#isDefinedBy",
          property_label: "Defined By",
          targets: [{ iri: "http://example.org/ClassX", label: "Class X" }],
        },
      ];
      render(
        <RelationshipSection
          {...baseProps}
          groups={groups}
          isEditing={true}
          onRemoveTarget={onRemove}
        />
      );

      const removeButtons = screen.getAllByTitle("Remove");
      expect(removeButtons).toHaveLength(2);
      fireEvent.click(removeButtons[1]);
      expect(onRemove).toHaveBeenCalledWith(1, 0);
    });
  });
});
