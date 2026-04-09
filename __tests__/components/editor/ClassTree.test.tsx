import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// Mock EntityTree
vi.mock("@/components/editor/shared/EntityTree", () => ({
  EntityTree: (props: Record<string, unknown>) => (
    <div
      data-testid="entity-tree"
      data-selected={props.selectedIri as string}
      data-search-query={props.searchQuery as string}
    />
  ),
}));

import { ClassTree } from "@/components/editor/ClassTree";
import type { ClassTreeNode } from "@/lib/ontology/types";
import type { EntitySearchResult } from "@/lib/api/client";

function makeTreeNode(overrides: Partial<ClassTreeNode> = {}): ClassTreeNode {
  return {
    iri: "http://example.org/Class1",
    label: "Class1",
    children: [],
    isExpanded: false,
    isLoading: false,
    hasChildren: false,
    ...overrides,
  };
}

function makeSearchResult(overrides: Partial<EntitySearchResult> = {}): EntitySearchResult {
  return {
    iri: "http://example.org/Result1",
    label: "Result1",
    entity_type: "class",
    deprecated: false,
    ...overrides,
  };
}

describe("ClassTree", () => {
  const defaultProps = {
    nodes: [] as ClassTreeNode[],
    onSelect: vi.fn(),
    onExpand: vi.fn(),
    onCollapse: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders EntityTree in normal mode when no search results", () => {
    render(<ClassTree {...defaultProps} nodes={[makeTreeNode()]} />);
    expect(screen.getByTestId("entity-tree")).toBeDefined();
  });

  it("passes selectedIri to EntityTree", () => {
    render(
      <ClassTree
        {...defaultProps}
        nodes={[makeTreeNode()]}
        selectedIri="http://example.org/Class1"
      />,
    );
    expect(screen.getByTestId("entity-tree").getAttribute("data-selected")).toBe(
      "http://example.org/Class1",
    );
  });

  it("passes draftIris to EntityTree", () => {
    const draftIris = new Set(["http://example.org/Class1"]);
    render(
      <ClassTree {...defaultProps} nodes={[makeTreeNode()]} draftIris={draftIris} />,
    );
    expect(screen.getByTestId("entity-tree")).toBeDefined();
  });

  // Search results mode
  it("does not render EntityTree when isSearching is true", () => {
    render(
      <ClassTree
        {...defaultProps}
        searchResults={[]}
        isSearching={true}
      />,
    );
    expect(screen.queryByTestId("entity-tree")).toBeNull();
  });

  it("shows 'No results found' for empty search results", () => {
    render(
      <ClassTree
        {...defaultProps}
        searchResults={[]}
        isSearching={false}
      />,
    );
    expect(screen.getByText("No results found")).toBeDefined();
  });

  it("does not show results when isFilteredTreeBuilding is true", () => {
    render(
      <ClassTree
        {...defaultProps}
        searchResults={[makeSearchResult()]}
        isSearching={false}
        isFilteredTreeBuilding={true}
      />,
    );
    expect(screen.queryByText("Result1")).toBeNull();
  });

  it("renders flat list of class search results when no filtered tree", () => {
    const results = [
      makeSearchResult({ iri: "http://example.org/A", label: "Alpha" }),
      makeSearchResult({ iri: "http://example.org/B", label: "Beta" }),
    ];
    render(
      <ClassTree
        {...defaultProps}
        searchResults={results}
        isSearching={false}
      />,
    );
    expect(screen.getByText("Alpha")).toBeDefined();
    expect(screen.getByText("Beta")).toBeDefined();
  });

  it("calls onSearchSelect when clicking a search result", () => {
    const onSearchSelect = vi.fn();
    const results = [makeSearchResult({ iri: "http://example.org/A", label: "Alpha" })];
    render(
      <ClassTree
        {...defaultProps}
        searchResults={results}
        isSearching={false}
        onSearchSelect={onSearchSelect}
      />,
    );
    fireEvent.click(screen.getByText("Alpha"));
    expect(onSearchSelect).toHaveBeenCalledWith("http://example.org/A");
  });

  it("falls back to onSelect when onSearchSelect is not provided", () => {
    const results = [makeSearchResult({ iri: "http://example.org/A", label: "Alpha" })];
    render(
      <ClassTree
        {...defaultProps}
        searchResults={results}
        isSearching={false}
      />,
    );
    fireEvent.click(screen.getByText("Alpha"));
    expect(defaultProps.onSelect).toHaveBeenCalledWith("http://example.org/A");
  });

  it("renders non-class results with type badge", () => {
    const results = [
      makeSearchResult({ iri: "http://example.org/P", label: "hasPart", entity_type: "property" }),
    ];
    render(
      <ClassTree
        {...defaultProps}
        searchResults={results}
        isSearching={false}
      />,
    );
    expect(screen.getByText("hasPart")).toBeDefined();
    expect(screen.getByText("property")).toBeDefined();
  });

  it("shows local name when different from label", () => {
    const results = [
      makeSearchResult({ iri: "http://example.org/MyClass", label: "My Class" }),
    ];
    render(
      <ClassTree
        {...defaultProps}
        searchResults={results}
        isSearching={false}
      />,
    );
    expect(screen.getByText("My Class")).toBeDefined();
    expect(screen.getByText("MyClass")).toBeDefined();
  });

  it("does not show local name when same as label", () => {
    const results = [
      makeSearchResult({ iri: "http://example.org/Alpha", label: "Alpha" }),
    ];
    render(
      <ClassTree
        {...defaultProps}
        searchResults={results}
        isSearching={false}
      />,
    );
    const alphaTexts = screen.getAllByText("Alpha");
    // Only the label, not a duplicate local name
    expect(alphaTexts.length).toBe(1);
  });

  it("applies line-through for deprecated results", () => {
    const results = [
      makeSearchResult({ iri: "http://example.org/Old", label: "OldClass", deprecated: true }),
    ];
    render(
      <ClassTree
        {...defaultProps}
        searchResults={results}
        isSearching={false}
      />,
    );
    const label = screen.getByText("OldClass");
    expect(label.className).toContain("line-through");
  });

  it("shows truncation message when filteredTreeTruncated is true", () => {
    const results = [makeSearchResult()];
    const filteredTree = [
      {
        iri: "http://example.org/Class1",
        label: "Class1",
        children: [],
        isExpanded: false,
        isLoading: false,
        hasChildren: false,
      },
    ];
    render(
      <ClassTree
        {...defaultProps}
        searchResults={results}
        isSearching={false}
        filteredTree={filteredTree}
        filteredTreeTruncated={true}
      />,
    );
    expect(screen.getByText(/Showing top/)).toBeDefined();
  });

  it("renders both class and non-class results with divider", () => {
    const results = [
      makeSearchResult({ iri: "http://example.org/A", label: "ClassA", entity_type: "class" }),
      makeSearchResult({ iri: "http://example.org/P", label: "PropP", entity_type: "property" }),
    ];
    render(
      <ClassTree
        {...defaultProps}
        searchResults={results}
        isSearching={false}
      />,
    );
    expect(screen.getByText("ClassA")).toBeDefined();
    expect(screen.getByText("PropP")).toBeDefined();
  });

  it("renders individual results with I badge", () => {
    const results = [
      makeSearchResult({ iri: "http://example.org/ind1", label: "Individual1", entity_type: "individual" }),
    ];
    render(
      <ClassTree
        {...defaultProps}
        searchResults={results}
        isSearching={false}
      />,
    );
    expect(screen.getByText("I")).toBeDefined();
    expect(screen.getByText("individual")).toBeDefined();
  });
});
