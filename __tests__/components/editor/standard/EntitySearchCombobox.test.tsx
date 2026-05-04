import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

// ── Mocks ──────────────────────────────────────────────────────────

const mockSearchEntities = vi.fn();
const mockSemanticSearch = vi.fn();

vi.mock("@/lib/api/client", () => ({
  projectOntologyApi: {
    searchEntities: (...args: unknown[]) => mockSearchEntities(...args),
  },
}));

vi.mock("@/lib/api/embeddings", () => ({
  embeddingsApi: {
    semanticSearch: (...args: unknown[]) => mockSemanticSearch(...args),
  },
}));

vi.mock("@/lib/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
  getLocalName: (iri: string) => {
    const hash = iri.lastIndexOf("#");
    return hash >= 0 ? iri.substring(hash + 1) : iri.substring(iri.lastIndexOf("/") + 1);
  },
}));

import { EntitySearchCombobox } from "@/components/editor/standard/EntitySearchCombobox";

// ── Tests ──────────────────────────────────────────────────────────

describe("EntitySearchCombobox", () => {
  const defaultProps = {
    projectId: "proj-1",
    accessToken: "token-abc",
    branch: "main",
    onSelect: vi.fn(),
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders with placeholder text", () => {
    render(<EntitySearchCombobox {...defaultProps} />);
    expect(screen.getByPlaceholderText("Search entities...")).toBeDefined();
  });

  it("renders with custom placeholder", () => {
    render(<EntitySearchCombobox {...defaultProps} placeholder="Find classes..." />);
    expect(screen.getByPlaceholderText("Find classes...")).toBeDefined();
  });

  it("shows 'Type to search' when query is empty", () => {
    render(<EntitySearchCombobox {...defaultProps} />);
    expect(screen.getByText("Type to search")).toBeDefined();
  });

  it("calls onClose when Escape is pressed", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<EntitySearchCombobox {...defaultProps} />);
    const input = screen.getByPlaceholderText("Search entities...");
    await user.type(input, "{Escape}");
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("calls onClose when X button is clicked", () => {
    const { container } = render(<EntitySearchCombobox {...defaultProps} />);
    // X button is the last button
    const buttons = container.querySelectorAll("button");
    const closeButton = buttons[buttons.length - 1];
    fireEvent.click(closeButton);
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("shows search results after debounced query", async () => {
    mockSearchEntities.mockResolvedValue({
      results: [
        { iri: "http://ex.org#Dog", label: "Dog", entity_type: "class", deprecated: false },
      ],
    });

    render(<EntitySearchCombobox {...defaultProps} />);
    const input = screen.getByPlaceholderText("Search entities...");

    await act(async () => {
      fireEvent.change(input, { target: { value: "Dog" } });
    });

    // Advance past debounce timer
    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    await waitFor(() => {
      expect(screen.getByText("Dog")).toBeDefined();
      expect(screen.getByText("http://ex.org#Dog")).toBeDefined();
    });
  });

  it("shows 'No results found' when search returns empty", async () => {
    mockSearchEntities.mockResolvedValue({ results: [] });

    render(<EntitySearchCombobox {...defaultProps} />);
    const input = screen.getByPlaceholderText("Search entities...");

    await act(async () => {
      fireEvent.change(input, { target: { value: "zzz" } });
    });

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    await waitFor(() => {
      expect(screen.getByText("No results found")).toBeDefined();
    });
  });

  it("excludes IRIs listed in excludeIris", async () => {
    mockSearchEntities.mockResolvedValue({
      results: [
        { iri: "http://ex.org#Dog", label: "Dog", entity_type: "class", deprecated: false },
        { iri: "http://ex.org#Cat", label: "Cat", entity_type: "class", deprecated: false },
      ],
    });

    render(
      <EntitySearchCombobox
        {...defaultProps}
        excludeIris={["http://ex.org#Cat"]}
      />
    );
    const input = screen.getByPlaceholderText("Search entities...");

    await act(async () => {
      fireEvent.change(input, { target: { value: "animal" } });
    });

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    await waitFor(() => {
      expect(screen.getByText("Dog")).toBeDefined();
      expect(screen.queryByText("Cat")).toBeNull();
    });
  });

  it("calls onSelect and onClose when a result is clicked", async () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    const result = { iri: "http://ex.org#Dog", label: "Dog", entity_type: "class", deprecated: false };
    mockSearchEntities.mockResolvedValue({ results: [result] });

    render(
      <EntitySearchCombobox
        {...defaultProps}
        onSelect={onSelect}
        onClose={onClose}
      />
    );

    const input = screen.getByPlaceholderText("Search entities...");
    await act(async () => {
      fireEvent.change(input, { target: { value: "Dog" } });
    });
    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    await waitFor(() => {
      expect(screen.getByText("Dog")).toBeDefined();
    });

    fireEvent.click(screen.getByText("Dog"));
    expect(onSelect).toHaveBeenCalledWith(result);
    expect(onClose).toHaveBeenCalled();
  });

  it("uses local name when result has no label", async () => {
    mockSearchEntities.mockResolvedValue({
      results: [
        { iri: "http://ex.org#MyEntity", label: "", entity_type: "class", deprecated: false },
      ],
    });

    render(<EntitySearchCombobox {...defaultProps} />);
    const input = screen.getByPlaceholderText("Search entities...");

    await act(async () => {
      fireEvent.change(input, { target: { value: "my" } });
    });
    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    await waitFor(() => {
      expect(screen.getByText("MyEntity")).toBeDefined();
    });
  });

  it("toggles semantic search mode", () => {
    render(<EntitySearchCombobox {...defaultProps} />);
    const toggleBtn = screen.getByLabelText("Toggle semantic search");
    // Default is text mode
    expect(toggleBtn.getAttribute("title")).toContain("Switch to semantic search");

    fireEvent.click(toggleBtn);
    expect(toggleBtn.getAttribute("title")).toContain("Semantic search (on)");

    fireEvent.click(toggleBtn);
    expect(toggleBtn.getAttribute("title")).toContain("Switch to semantic search");
  });

  it("shows score badge for semantic search results", async () => {
    mockSemanticSearch.mockResolvedValue({
      results: [
        { iri: "http://ex.org#Dog", label: "Dog", entity_type: "class", deprecated: false, score: 0.85 },
      ],
    });

    render(<EntitySearchCombobox {...defaultProps} />);

    // Switch to semantic mode
    fireEvent.click(screen.getByLabelText("Toggle semantic search"));

    const input = screen.getByPlaceholderText("Search entities...");
    await act(async () => {
      fireEvent.change(input, { target: { value: "Dog" } });
    });
    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    await waitFor(() => {
      expect(screen.getByText("85%")).toBeDefined();
    });
  });

  it("falls back to text search when semantic search fails", async () => {
    mockSemanticSearch.mockRejectedValue(new Error("not available"));
    mockSearchEntities.mockResolvedValue({
      results: [
        { iri: "http://ex.org#Dog", label: "Dog", entity_type: "class", deprecated: false },
      ],
    });

    render(<EntitySearchCombobox {...defaultProps} />);

    // Switch to semantic mode
    fireEvent.click(screen.getByLabelText("Toggle semantic search"));

    const input = screen.getByPlaceholderText("Search entities...");
    await act(async () => {
      fireEvent.change(input, { target: { value: "Dog" } });
    });
    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    await waitFor(() => {
      expect(screen.getByText("Dog")).toBeDefined();
    });
    expect(mockSearchEntities).toHaveBeenCalled();
  });

  it("calls onClose when clicking outside the combobox", () => {
    render(
      <div>
        <div data-testid="outside">Outside</div>
        <EntitySearchCombobox {...defaultProps} />
      </div>
    );
    fireEvent.mouseDown(screen.getByTestId("outside"));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });
});
