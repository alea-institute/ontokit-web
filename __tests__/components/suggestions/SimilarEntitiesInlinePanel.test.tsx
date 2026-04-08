import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { SimilarEntitiesInlinePanel } from "@/components/suggestions/SimilarEntitiesInlinePanel";

// Mock the API client to prevent real API calls from DuplicateComparisonExpander
vi.mock("@/lib/api/client", () => ({
  projectOntologyApi: {
    getClassDetail: vi.fn().mockResolvedValue({
      iri: "http://example.org/Existing1",
      labels: [{ value: "Existing Entity 1", lang: "en" }],
      comments: [],
      deprecated: false,
      parent_iris: [],
      parent_labels: {},
      equivalent_iris: null,
      disjoint_iris: null,
      child_count: 0,
      instance_count: null,
      is_defined: true,
      annotations: [],
    }),
  },
}));

const highScoreCandidates = [
  { iri: "http://example.org/Existing1", label: "Existing Entity 1", score: 0.85 },
  { iri: "http://example.org/Existing2", label: "Existing Entity 2", score: 0.55 },
];

const lowScoreCandidates = [
  { iri: "http://example.org/Low1", label: "Low Score", score: 0.30 },
];

const mixedCandidates = [
  { iri: "http://example.org/High1", label: "High Score Entity", score: 0.85 },
  { iri: "http://example.org/Below1", label: "Below Threshold Entity", score: 0.35 },
];

describe("SimilarEntitiesInlinePanel", () => {
  it("Test 1: Returns null when all candidates have score <= 0.40", () => {
    const { container } = render(
      <SimilarEntitiesInlinePanel
        entityIri="http://example.org/New1"
        entityLabel="New Entity"
        candidates={lowScoreCandidates}
        projectId="project-1"
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("Test 2: Renders 'Similar existing entities (N)' button when candidates above threshold exist", () => {
    render(
      <SimilarEntitiesInlinePanel
        entityIri="http://example.org/New1"
        entityLabel="New Entity"
        candidates={highScoreCandidates}
        projectId="project-1"
      />
    );
    // Both candidates (0.85 and 0.55) are above 0.40, so count is 2
    expect(screen.getByText("Similar existing entities (2)")).toBeDefined();
  });

  it("Test 3: Panel is collapsed by default (candidates not visible)", () => {
    render(
      <SimilarEntitiesInlinePanel
        entityIri="http://example.org/New1"
        entityLabel="New Entity"
        candidates={highScoreCandidates}
        projectId="project-1"
      />
    );
    // Collapsed by default — candidate labels should not be in the document
    expect(screen.queryByText("Existing Entity 1")).toBeNull();
  });

  it("Test 4: Clicking toggle button expands panel and shows candidate labels with scores", () => {
    render(
      <SimilarEntitiesInlinePanel
        entityIri="http://example.org/New1"
        entityLabel="New Entity"
        candidates={highScoreCandidates}
        projectId="project-1"
      />
    );
    // Click the toggle button to expand
    fireEvent.click(screen.getByText("Similar existing entities (2)"));
    // Now candidate labels should be visible
    expect(screen.getByText("Existing Entity 1")).toBeDefined();
    expect(screen.getByText("Existing Entity 2")).toBeDefined();
  });

  it("Test 5: Only candidates with score > 0.40 appear in the expanded list", () => {
    render(
      <SimilarEntitiesInlinePanel
        entityIri="http://example.org/New1"
        entityLabel="New Entity"
        candidates={mixedCandidates}
        projectId="project-1"
      />
    );
    // Click to expand — only 1 above threshold (0.85)
    fireEvent.click(screen.getByText("Similar existing entities (1)"));
    expect(screen.getByText("High Score Entity")).toBeDefined();
    expect(screen.queryByText("Below Threshold Entity")).toBeNull();
  });
});
