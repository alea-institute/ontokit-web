import { describe, expect, it, vi, beforeEach } from "vitest";
import { graphApi } from "@/lib/api/graph";

// Mock the api client
vi.mock("@/lib/api/client", () => ({
  api: {
    get: vi.fn(),
  },
}));

import { api } from "@/lib/api/client";
const mockGet = vi.mocked(api.get);

describe("graphApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getEntityGraph", () => {
    it("calls api.get with correct project-scoped URL", async () => {
      mockGet.mockResolvedValue({ nodes: [], edges: [] });

      await graphApi.getEntityGraph("proj-1", "urn:test:Class1");

      expect(mockGet).toHaveBeenCalledWith(
        `/api/v1/projects/proj-1/ontology/graph/${encodeURIComponent("urn:test:Class1")}`,
        expect.any(Object),
      );
    });

    it("encodes class IRI in the URL", async () => {
      mockGet.mockResolvedValue({ nodes: [], edges: [] });

      const iri = "http://example.org/ontology#MyClass";
      await graphApi.getEntityGraph("proj-1", iri);

      const url = mockGet.mock.calls[0][0];
      expect(url).toContain(encodeURIComponent(iri));
    });

    it("passes branch as query param", async () => {
      mockGet.mockResolvedValue({ nodes: [], edges: [] });

      await graphApi.getEntityGraph("proj-1", "urn:c", { branch: "dev" });

      const config = mockGet.mock.calls[0]?.[1] as { params: Record<string, unknown> };
      expect(config.params.branch).toBe("dev");
    });

    it("passes depth parameters as query params", async () => {
      mockGet.mockResolvedValue({ nodes: [], edges: [] });

      await graphApi.getEntityGraph("proj-1", "urn:c", {
        ancestorsDepth: 3,
        descendantsDepth: 1,
      });

      const config = mockGet.mock.calls[0]?.[1] as { params: Record<string, unknown> };
      expect(config.params.ancestors_depth).toBe(3);
      expect(config.params.descendants_depth).toBe(1);
    });

    it("passes maxNodes and includeSeeAlso params", async () => {
      mockGet.mockResolvedValue({ nodes: [], edges: [] });

      await graphApi.getEntityGraph("proj-1", "urn:c", {
        maxNodes: 100,
        includeSeeAlso: false,
      });

      const config = mockGet.mock.calls[0]?.[1] as { params: Record<string, unknown> };
      expect(config.params.max_nodes).toBe(100);
      expect(config.params.include_see_also).toBe(false);
    });

    it("leaves optional params undefined when not provided", async () => {
      mockGet.mockResolvedValue({ nodes: [], edges: [] });

      await graphApi.getEntityGraph("proj-1", "urn:c");

      const config = mockGet.mock.calls[0]?.[1] as { params: Record<string, unknown> };
      expect(config.params.branch).toBeUndefined();
      expect(config.params.ancestors_depth).toBeUndefined();
      expect(config.params.descendants_depth).toBeUndefined();
      expect(config.params.max_nodes).toBeUndefined();
      expect(config.params.include_see_also).toBeUndefined();
    });

    it("returns the API response", async () => {
      const mockResponse = {
        focus_iri: "urn:c",
        focus_label: "C",
        nodes: [{ id: "urn:c", label: "C" }],
        edges: [],
        truncated: false,
        total_concept_count: 1,
      };
      mockGet.mockResolvedValue(mockResponse);

      const result = await graphApi.getEntityGraph("proj-1", "urn:c");
      expect(result).toEqual(mockResponse);
    });

    it("propagates API errors", async () => {
      mockGet.mockRejectedValue(new Error("Network error"));

      await expect(
        graphApi.getEntityGraph("proj-1", "urn:c"),
      ).rejects.toThrow("Network error");
    });
  });
});
