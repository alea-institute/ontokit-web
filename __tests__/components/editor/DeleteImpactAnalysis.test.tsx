import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/lib/api/quality", () => ({
  qualityApi: {
    getCrossReferences: vi.fn(),
  },
}));

import { DeleteImpactAnalysis } from "@/components/editor/DeleteImpactAnalysis";
import { qualityApi } from "@/lib/api/quality";

const mockGetCrossReferences = vi.mocked(qualityApi.getCrossReferences);

describe("DeleteImpactAnalysis", () => {
  const onAcknowledge = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state while fetching", () => {
    mockGetCrossReferences.mockReturnValue(new Promise(() => {})); // never resolves
    render(
      <DeleteImpactAnalysis
        projectId="p1"
        entityIri="http://example.org/A"
        onAcknowledge={onAcknowledge}
      />
    );
    expect(screen.getByText("Checking references...")).toBeDefined();
  });

  it("returns null when total is 0", async () => {
    mockGetCrossReferences.mockResolvedValue({ target_iri: "http://example.org/A", total: 0, groups: [] });
    const { container } = render(
      <DeleteImpactAnalysis
        projectId="p1"
        entityIri="http://example.org/A"
        onAcknowledge={onAcknowledge}
      />
    );
    await waitFor(() => {
      expect(container.querySelector(".animate-spin")).toBeNull();
    });
    // After loading is done and total is 0, component returns null
    expect(container.textContent).toBe("");
  });

  it("shows error state on fetch failure", async () => {
    mockGetCrossReferences.mockRejectedValue(new Error("Network error"));
    render(
      <DeleteImpactAnalysis
        projectId="p1"
        entityIri="http://example.org/A"
        onAcknowledge={onAcknowledge}
      />
    );
    await waitFor(() => {
      expect(screen.getByText("Failed to check references. Proceed with caution.")).toBeDefined();
    });
  });

  it("shows impact warning when references exist", async () => {
    mockGetCrossReferences.mockResolvedValue({
      target_iri: "http://example.org/A",
      total: 2,
      groups: [
        {
          context: "parent_iris",
          context_label: "As parent class",
          references: [
            { source_iri: "http://example.org/B", source_label: "B", source_type: "class", reference_context: "parent_iris" },
            { source_iri: "http://example.org/C", source_label: "C", source_type: "class", reference_context: "parent_iris" },
          ],
        },
      ],
    });
    render(
      <DeleteImpactAnalysis
        projectId="p1"
        entityIri="http://example.org/A"
        onAcknowledge={onAcknowledge}
      />
    );
    await waitFor(() => {
      expect(screen.getByText("This entity is referenced by 2 other entities")).toBeDefined();
    });
  });

  it("expands references and allows acknowledgement", async () => {
    mockGetCrossReferences.mockResolvedValue({
      target_iri: "http://example.org/A",
      total: 1,
      groups: [
        {
          context: "parent_iris",
          context_label: "As parent class",
          references: [
            { source_iri: "http://example.org/B", source_label: "ClassB", source_type: "class", reference_context: "parent_iris" },
          ],
        },
      ],
    });
    render(
      <DeleteImpactAnalysis
        projectId="p1"
        entityIri="http://example.org/A"
        onAcknowledge={onAcknowledge}
      />
    );
    await waitFor(() => {
      expect(screen.getByText("Show references")).toBeDefined();
    });
    await userEvent.click(screen.getByText("Show references"));
    expect(screen.getByText("ClassB")).toBeDefined();

    await userEvent.click(screen.getByRole("checkbox"));
    expect(onAcknowledge).toHaveBeenCalledWith(true);
  });

  it("resets state when entityIri is null", () => {
    mockGetCrossReferences.mockResolvedValue({ target_iri: "http://example.org/A", total: 0, groups: [] });
    const { container } = render(
      <DeleteImpactAnalysis
        projectId="p1"
        entityIri={null}
        onAcknowledge={onAcknowledge}
      />
    );
    expect(container.textContent).toBe("");
    expect(onAcknowledge).toHaveBeenCalledWith(false);
  });
});
