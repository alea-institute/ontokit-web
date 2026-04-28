import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import React from "react";

// ── Mocks ──────────────────────────────────────────────────────────

const mockSearchEntities = vi.fn();

vi.mock("@/lib/api/client", () => ({
  projectOntologyApi: {
    searchEntities: (...args: unknown[]) => mockSearchEntities(...args),
  },
}));

vi.mock("@/lib/utils", () => ({
  getLocalName: (iri: string) => {
    const hash = iri.lastIndexOf("#");
    return hash >= 0 ? iri.substring(hash + 1) : iri.substring(iri.lastIndexOf("/") + 1);
  },
}));

const _mockOnExpand = vi.fn();
const _mockOnCollapse = vi.fn();
const _mockOnSelect = vi.fn();

vi.mock("@/components/editor/shared/EntityTree", () => ({
  EntityTree: ({
    nodes,
    selectedIri: _selectedIri,
    onSelect,
    onExpand,
    onCollapse,
  }: {
    nodes: { iri: string; label: string; children?: { iri: string; label: string }[]; isExpanded?: boolean }[];
    selectedIri: string | null;
    onSelect: (iri: string) => void;
    onExpand: (iri: string) => void;
    onCollapse: (iri: string) => void;
  }) => (
    <div data-testid="entity-tree">
      {nodes.map((n) => (
        <div key={n.iri} data-testid="tree-group">
          <span data-testid="group-label">{n.label}</span>
          <span data-testid="group-expanded">{String(n.isExpanded)}</span>
          <button data-testid={`expand-${n.iri}`} onClick={() => onExpand(n.iri)}>
            Expand
          </button>
          <button data-testid={`collapse-${n.iri}`} onClick={() => onCollapse(n.iri)}>
            Collapse
          </button>
          {n.children?.map((c) => (
            <button key={c.iri} data-testid="tree-child" onClick={() => onSelect(c.iri)}>
              {c.label}
            </button>
          ))}
        </div>
      ))}
    </div>
  ),
}));

import { PropertyTree } from "@/components/editor/standard/PropertyTree";

// ── Tests ──────────────────────────────────────────────────────────

describe("PropertyTree", () => {
  const defaultProps = {
    projectId: "proj-1",
    accessToken: "token-abc",
    branch: "main",
    selectedIri: null,
    onSelect: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading spinner initially", () => {
    mockSearchEntities.mockReturnValue(new Promise(() => {}));
    const { container } = render(<PropertyTree {...defaultProps} />);
    expect(container.querySelector(".animate-spin")).not.toBeNull();
  });

  it("calls searchEntities with property type on mount", () => {
    mockSearchEntities.mockResolvedValue({ results: [] });
    render(<PropertyTree {...defaultProps} />);
    expect(mockSearchEntities).toHaveBeenCalledWith(
      "proj-1",
      "*",
      "token-abc",
      "main",
      "property"
    );
  });

  it("shows empty state when no properties found", async () => {
    mockSearchEntities.mockResolvedValue({ results: [] });
    render(<PropertyTree {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("No properties found in this ontology")).toBeDefined();
    });
  });

  it("shows error message when fetch fails", async () => {
    mockSearchEntities.mockRejectedValue(new Error("Server error"));
    render(<PropertyTree {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Server error")).toBeDefined();
    });
  });

  it("shows generic error for non-Error rejections", async () => {
    mockSearchEntities.mockRejectedValue("fail");
    render(<PropertyTree {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Failed to load properties")).toBeDefined();
    });
  });

  it("groups properties into Object Properties via property_kind=object", async () => {
    // Note: the IRI here intentionally has no "objectproperty" substring —
    // grouping must come from the backend-supplied property_kind, not from
    // pattern-matching the IRI string.
    mockSearchEntities.mockResolvedValue({
      results: [
        { iri: "http://ex.org/hasPart", label: "hasPart", entity_type: "property", property_kind: "object", deprecated: false },
      ],
    });
    render(<PropertyTree {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Object Properties")).toBeDefined();
      expect(screen.getByText("hasPart")).toBeDefined();
    });
  });

  it("groups data properties via property_kind=data", async () => {
    mockSearchEntities.mockResolvedValue({
      results: [
        { iri: "http://ex.org/hasAge", label: "hasAge", entity_type: "property", property_kind: "data", deprecated: false },
      ],
    });
    render(<PropertyTree {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Data Properties")).toBeDefined();
    });
  });

  it("groups annotation properties via property_kind=annotation", async () => {
    mockSearchEntities.mockResolvedValue({
      results: [
        { iri: "http://ex.org/seeAlso", label: "seeAlso", entity_type: "property", property_kind: "annotation", deprecated: false },
      ],
    });
    render(<PropertyTree {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Annotation Properties")).toBeDefined();
    });
  });

  it("groups properties without property_kind into 'Other Properties'", async () => {
    // Covers both edge cases (rdf:Property without OWL subtype) and older
    // backends that haven't started populating property_kind yet.
    mockSearchEntities.mockResolvedValue({
      results: [
        { iri: "http://ex.org/someProp", label: "someProp", entity_type: "property", deprecated: false },
        { iri: "http://ex.org/otherProp", label: "otherProp", entity_type: "property", property_kind: null, deprecated: false },
      ],
    });
    render(<PropertyTree {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Other Properties")).toBeDefined();
      expect(screen.getByText("someProp")).toBeDefined();
      expect(screen.getByText("otherProp")).toBeDefined();
    });
  });

  it("renders all four groups when properties of every kind are present", async () => {
    mockSearchEntities.mockResolvedValue({
      results: [
        { iri: "http://ex.org/hasPart", label: "hasPart", entity_type: "property", property_kind: "object", deprecated: false },
        { iri: "http://ex.org/hasAge", label: "hasAge", entity_type: "property", property_kind: "data", deprecated: false },
        { iri: "http://ex.org/seeAlso", label: "seeAlso", entity_type: "property", property_kind: "annotation", deprecated: false },
        { iri: "http://ex.org/raw", label: "raw", entity_type: "property", deprecated: false },
      ],
    });
    render(<PropertyTree {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Object Properties")).toBeDefined();
      expect(screen.getByText("Data Properties")).toBeDefined();
      expect(screen.getByText("Annotation Properties")).toBeDefined();
      expect(screen.getByText("Other Properties")).toBeDefined();
    });
  });

  it("uses local name when label is empty", async () => {
    mockSearchEntities.mockResolvedValue({
      results: [
        { iri: "http://ex.org/myProp", label: "", entity_type: "property", property_kind: "object", deprecated: false },
      ],
    });
    render(<PropertyTree {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("myProp")).toBeDefined();
    });
  });

  it("supports expand/collapse of property groups", async () => {
    mockSearchEntities.mockResolvedValue({
      results: [
        { iri: "http://ex.org/hasPart", label: "hasPart", entity_type: "property", property_kind: "object", deprecated: false },
      ],
    });
    const onSelect = vi.fn();
    render(<PropertyTree {...defaultProps} onSelect={onSelect} />);

    await waitFor(() => {
      expect(screen.getByText("Object Properties")).toBeDefined();
    });

    // Click collapse
    const collapseBtn = screen.getByTestId("collapse-__group__object");
    fireEvent.click(collapseBtn);

    // After collapse, the group should update (re-render)
    await waitFor(() => {
      const expanded = screen.getByTestId("group-expanded");
      expect(expanded.textContent).toBe("false");
    });

    // Click expand
    const expandBtn = screen.getByTestId("expand-__group__object");
    fireEvent.click(expandBtn);

    await waitFor(() => {
      const expanded = screen.getByTestId("group-expanded");
      expect(expanded.textContent).toBe("true");
    });
  });

  it("re-fetches when branch changes", async () => {
    mockSearchEntities.mockResolvedValue({ results: [] });
    const { rerender } = render(<PropertyTree {...defaultProps} />);
    await waitFor(() => {
      expect(mockSearchEntities).toHaveBeenCalledTimes(1);
    });
    rerender(<PropertyTree {...defaultProps} branch="dev" />);
    await waitFor(() => {
      expect(mockSearchEntities).toHaveBeenCalledTimes(2);
    });
  });
});
