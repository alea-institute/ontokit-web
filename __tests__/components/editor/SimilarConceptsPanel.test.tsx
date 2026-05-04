import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/lib/hooks/useSimilarEntities", () => ({
  useSimilarEntities: vi.fn(),
}));

import { SimilarConceptsPanel } from "@/components/editor/SimilarConceptsPanel";
import { useSimilarEntities } from "@/lib/hooks/useSimilarEntities";

const mockUseSimilarEntities = vi.mocked(useSimilarEntities);

describe("SimilarConceptsPanel", () => {
  it("returns null when classIri is null", () => {
    mockUseSimilarEntities.mockReturnValue({ data: undefined, isLoading: false, error: null } as ReturnType<typeof useSimilarEntities>);
    const { container } = render(
      <SimilarConceptsPanel projectId="p1" classIri={null} />
    );
    expect(container.innerHTML).toBe("");
  });

  it("returns null when not loading and no results", () => {
    mockUseSimilarEntities.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useSimilarEntities>);
    const { container } = render(
      <SimilarConceptsPanel projectId="p1" classIri="http://example.org/A" />
    );
    expect(container.innerHTML).toBe("");
  });

  it("shows loading indicator", () => {
    mockUseSimilarEntities.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as ReturnType<typeof useSimilarEntities>);
    render(
      <SimilarConceptsPanel projectId="p1" classIri="http://example.org/A" />
    );
    expect(screen.getByText("Similar (...)")).toBeDefined();
  });

  it("shows 404 embeddings hint when expanded", async () => {
    mockUseSimilarEntities.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: { status: 404, message: "Not found" },
    } as unknown as ReturnType<typeof useSimilarEntities>);
    render(
      <SimilarConceptsPanel projectId="p1" classIri="http://example.org/A" />
    );
    await userEvent.click(screen.getByText("Similar (0)"));
    expect(
      screen.getByText("Generate embeddings in project settings to see similar concepts.")
    ).toBeDefined();
  });

  it("shows error message for non-404 errors", async () => {
    mockUseSimilarEntities.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: { status: 500, message: "Server error" },
    } as unknown as ReturnType<typeof useSimilarEntities>);
    render(
      <SimilarConceptsPanel projectId="p1" classIri="http://example.org/A" />
    );
    await userEvent.click(screen.getByText("Similar (0)"));
    expect(screen.getByText("Failed to load similar concepts.")).toBeDefined();
  });

  it("expands to show similar entities with scores", async () => {
    const onNavigate = vi.fn();
    mockUseSimilarEntities.mockReturnValue({
      data: [
        { iri: "http://example.org/B", label: "ConceptB", entity_type: "class", score: 0.85, deprecated: false },
        { iri: "http://example.org/C", label: "ConceptC", entity_type: "property", score: 0.6, deprecated: false },
      ],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useSimilarEntities>);
    render(
      <SimilarConceptsPanel
        projectId="p1"
        classIri="http://example.org/A"
        onNavigateToClass={onNavigate}
      />
    );
    await userEvent.click(screen.getByText("Similar (2)"));
    expect(screen.getByText("ConceptB")).toBeDefined();
    expect(screen.getByText("85%")).toBeDefined();
    expect(screen.getByText("ConceptC")).toBeDefined();
    expect(screen.getByText("60%")).toBeDefined();

    await userEvent.click(screen.getByText("ConceptB"));
    expect(onNavigate).toHaveBeenCalledWith("http://example.org/B");
  });
});
