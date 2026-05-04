import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";

// Mock API modules
vi.mock("@/lib/api/client", () => ({
  projectOntologyApi: {
    searchEntities: vi.fn().mockResolvedValue({ results: [], total: 0 }),
  },
}));

vi.mock("@/lib/api/embeddings", () => ({
  embeddingsApi: {
    rankSuggestions: vi.fn().mockResolvedValue([]),
  },
}));

import { ParentClassPicker } from "@/components/editor/ParentClassPicker";
import { projectOntologyApi } from "@/lib/api/client";
import { embeddingsApi } from "@/lib/api/embeddings";

describe("ParentClassPicker", () => {
  const defaultProps = {
    projectId: "proj-1",
    accessToken: "token-123",
    branch: "main",
    excludeIris: [] as string[],
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

  it("renders search input with placeholder", () => {
    render(<ParentClassPicker {...defaultProps} />);
    expect(screen.getByPlaceholderText("Search for a class...")).toBeDefined();
  });

  it("shows initial message", () => {
    render(<ParentClassPicker {...defaultProps} />);
    expect(screen.getByText("Type to search for classes")).toBeDefined();
  });

  it("calls onClose when close button is clicked", () => {
    render(<ParentClassPicker {...defaultProps} />);
    // The X button is the one inside the search bar
    const buttons = screen.getAllByRole("button");
    const closeButton = buttons[0];
    fireEvent.click(closeButton);
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("calls onClose on Escape key", () => {
    render(<ParentClassPicker {...defaultProps} />);
    const input = screen.getByPlaceholderText("Search for a class...");
    fireEvent.keyDown(input, { key: "Escape" });
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("calls onClose when clicking outside", () => {
    render(
      <div>
        <div data-testid="outside">Outside</div>
        <ParentClassPicker {...defaultProps} />
      </div>,
    );
    fireEvent.mouseDown(screen.getByTestId("outside"));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("performs search after debounce and shows results", async () => {
    vi.mocked(projectOntologyApi.searchEntities).mockResolvedValue({
      results: [
        { iri: "http://example.org/Animal", label: "Animal", entity_type: "class", deprecated: false },
      ],
      total: 1,
    });

    render(<ParentClassPicker {...defaultProps} />);
    const input = screen.getByPlaceholderText("Search for a class...");
    fireEvent.change(input, { target: { value: "ani" } });

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    await waitFor(() => {
      expect(screen.getByText("Animal")).toBeDefined();
    });
  });

  it("filters out excluded IRIs from results", async () => {
    vi.mocked(projectOntologyApi.searchEntities).mockResolvedValue({
      results: [
        { iri: "http://example.org/A", label: "ClassAResult", entity_type: "class", deprecated: false },
        { iri: "http://example.org/B", label: "ClassBResult", entity_type: "class", deprecated: false },
      ],
      total: 2,
    });

    render(
      <ParentClassPicker
        {...defaultProps}
        excludeIris={["http://example.org/A"]}
      />,
    );
    const input = screen.getByPlaceholderText("Search for a class...");
    fireEvent.change(input, { target: { value: "test" } });

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    await waitFor(() => {
      expect(screen.getByText("ClassBResult")).toBeDefined();
      expect(screen.queryByText("ClassAResult")).toBeNull();
    });
  });

  it("shows no-results message for empty search with query", async () => {
    vi.mocked(projectOntologyApi.searchEntities).mockResolvedValue({
      results: [],
      total: 0,
    });

    render(<ParentClassPicker {...defaultProps} />);
    const input = screen.getByPlaceholderText("Search for a class...");
    fireEvent.change(input, { target: { value: "xyz" } });

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    await waitFor(() => {
      expect(screen.getByText("No classes found")).toBeDefined();
    });
  });

  it("calls onSelect and onClose when a result is clicked", async () => {
    vi.mocked(projectOntologyApi.searchEntities).mockResolvedValue({
      results: [
        { iri: "http://example.org/Animal", label: "Animal", entity_type: "class", deprecated: false },
      ],
      total: 1,
    });

    render(<ParentClassPicker {...defaultProps} />);
    const input = screen.getByPlaceholderText("Search for a class...");
    fireEvent.change(input, { target: { value: "ani" } });

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    await waitFor(() => {
      expect(screen.getByText("Animal")).toBeDefined();
    });

    const animalButton = screen.getByRole("button", { name: /Animal/ });
    fireEvent.click(animalButton);
    expect(defaultProps.onSelect).toHaveBeenCalledWith("http://example.org/Animal", "Animal");
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("shows IRI below label in results", async () => {
    vi.mocked(projectOntologyApi.searchEntities).mockResolvedValue({
      results: [
        { iri: "http://example.org/Animal", label: "Animal", entity_type: "class", deprecated: false },
      ],
      total: 1,
    });

    render(<ParentClassPicker {...defaultProps} />);
    const input = screen.getByPlaceholderText("Search for a class...");
    fireEvent.change(input, { target: { value: "ani" } });

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    await waitFor(() => {
      expect(screen.getByText("http://example.org/Animal")).toBeDefined();
    });
  });

  it("shows suggestions when contextIri is provided and ranking succeeds", async () => {
    vi.mocked(projectOntologyApi.searchEntities).mockResolvedValue({
      results: [
        { iri: "http://example.org/A", label: "ClassA", entity_type: "class", deprecated: false },
      ],
      total: 1,
    });
    vi.mocked(embeddingsApi.rankSuggestions).mockResolvedValue([
      { iri: "http://example.org/A", label: "ClassA", score: 0.95 },
    ]);

    render(
      <ParentClassPicker {...defaultProps} contextIri="http://example.org/Current" />,
    );
    const input = screen.getByPlaceholderText("Search for a class...");
    fireEvent.change(input, { target: { value: "class" } });

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    await waitFor(() => {
      expect(screen.getByText("Suggested")).toBeDefined();
      expect(screen.getByText("95%")).toBeDefined();
    });
  });
});
