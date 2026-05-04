import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
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

vi.mock("@/components/editor/shared/EntityTree", () => ({
  EntityTree: ({
    nodes,
    selectedIri,
  }: {
    nodes: { iri: string; label: string }[];
    selectedIri: string | null;
  }) => (
    <div data-testid="entity-tree">
      {nodes.map((n) => (
        <div key={n.iri} data-testid="tree-node" data-selected={n.iri === selectedIri}>
          {n.label}
        </div>
      ))}
    </div>
  ),
}));

import { IndividualList } from "@/components/editor/standard/IndividualList";

// ── Tests ──────────────────────────────────────────────────────────

describe("IndividualList", () => {
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
    mockSearchEntities.mockReturnValue(new Promise(() => {})); // never resolves
    const { container } = render(<IndividualList {...defaultProps} />);
    const spinner = container.querySelector(".animate-spin");
    expect(spinner).not.toBeNull();
  });

  it("calls searchEntities with correct params on mount", () => {
    mockSearchEntities.mockResolvedValue({ results: [] });
    render(<IndividualList {...defaultProps} />);
    expect(mockSearchEntities).toHaveBeenCalledWith(
      "proj-1",
      "*",
      "token-abc",
      "main",
      "individual"
    );
  });

  it("renders individuals after loading", async () => {
    mockSearchEntities.mockResolvedValue({
      results: [
        { iri: "http://example.org#Alice", label: "Alice", deprecated: false },
        { iri: "http://example.org#Bob", label: "Bob", deprecated: false },
      ],
    });
    render(<IndividualList {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeDefined();
      expect(screen.getByText("Bob")).toBeDefined();
    });
  });

  it("uses local name when label is missing", async () => {
    mockSearchEntities.mockResolvedValue({
      results: [
        { iri: "http://example.org#MyIndividual", label: "", deprecated: false },
      ],
    });
    render(<IndividualList {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("MyIndividual")).toBeDefined();
    });
  });

  it("shows empty state when no individuals found", async () => {
    mockSearchEntities.mockResolvedValue({ results: [] });
    render(<IndividualList {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("No individuals found in this ontology")).toBeDefined();
    });
  });

  it("shows error message when fetch fails", async () => {
    mockSearchEntities.mockRejectedValue(new Error("Network error"));
    render(<IndividualList {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeDefined();
    });
  });

  it("shows generic error for non-Error rejections", async () => {
    mockSearchEntities.mockRejectedValue("boom");
    render(<IndividualList {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Failed to load individuals")).toBeDefined();
    });
  });

  it("re-fetches when projectId changes", async () => {
    mockSearchEntities.mockResolvedValue({ results: [] });
    const { rerender } = render(<IndividualList {...defaultProps} />);
    await waitFor(() => {
      expect(mockSearchEntities).toHaveBeenCalledTimes(1);
    });
    rerender(<IndividualList {...defaultProps} projectId="proj-2" />);
    await waitFor(() => {
      expect(mockSearchEntities).toHaveBeenCalledTimes(2);
    });
  });

  it("re-fetches when branch changes", async () => {
    mockSearchEntities.mockResolvedValue({ results: [] });
    const { rerender } = render(<IndividualList {...defaultProps} />);
    await waitFor(() => {
      expect(mockSearchEntities).toHaveBeenCalledTimes(1);
    });
    rerender(<IndividualList {...defaultProps} branch="dev" />);
    await waitFor(() => {
      expect(mockSearchEntities).toHaveBeenCalledTimes(2);
    });
  });
});
