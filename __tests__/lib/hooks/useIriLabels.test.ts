import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useIriLabels } from "@/lib/hooks/useIriLabels";

vi.mock("@/lib/api/client", () => ({
  projectOntologyApi: {
    getClassDetail: vi.fn(),
    searchEntities: vi.fn(),
  },
}));

import { projectOntologyApi } from "@/lib/api/client";

const mockedGetClassDetail = projectOntologyApi.getClassDetail as ReturnType<typeof vi.fn>;
const mockedSearchEntities = projectOntologyApi.searchEntities as ReturnType<typeof vi.fn>;

describe("useIriLabels", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns empty object when iris array is empty", () => {
    const { result } = renderHook(() =>
      useIriLabels([], { projectId: "proj-1", accessToken: "token" }),
    );
    expect(result.current).toEqual({});
    expect(mockedGetClassDetail).not.toHaveBeenCalled();
  });

  it("resolves labels via searchEntities (primary path)", async () => {
    mockedSearchEntities.mockResolvedValue({
      results: [
        { iri: "http://example.org/hasPart", label: "has Part" },
      ],
    });

    const { result } = renderHook(() =>
      useIriLabels(["http://example.org/hasPart"], {
        projectId: "proj-1",
        accessToken: "token",
      }),
    );

    await waitFor(() => {
      expect(result.current["http://example.org/hasPart"]).toBe("has Part");
    });
    // Search alone resolved it — no class probe needed.
    expect(mockedSearchEntities).toHaveBeenCalled();
    expect(mockedGetClassDetail).not.toHaveBeenCalled();
  });

  it("falls back to getClassDetail when search returns no match", async () => {
    // Search returns an empty result set — IRI isn't in the search index.
    mockedSearchEntities.mockResolvedValue({ results: [] });
    mockedGetClassDetail.mockResolvedValue({
      labels: [{ value: "Person", lang: "en" }],
    });

    const { result } = renderHook(() =>
      useIriLabels(["http://example.org/Person"], {
        projectId: "proj-1",
        accessToken: "token",
        branch: "main",
      }),
    );

    await waitFor(() => {
      expect(result.current["http://example.org/Person"]).toBe("Person");
    });
    expect(mockedSearchEntities).toHaveBeenCalled();
    expect(mockedGetClassDetail).toHaveBeenCalledWith(
      "proj-1",
      "http://example.org/Person",
      "token",
      "main",
    );
  });

  it("falls back to getClassDetail when search throws", async () => {
    mockedSearchEntities.mockRejectedValue(new Error("search down"));
    mockedGetClassDetail.mockResolvedValue({
      labels: [{ value: "Person", lang: "en" }],
    });

    const { result } = renderHook(() =>
      useIriLabels(["http://example.org/Person"], {
        projectId: "proj-1",
        accessToken: "token",
      }),
    );

    await waitFor(() => {
      expect(result.current["http://example.org/Person"]).toBe("Person");
    });
    expect(mockedGetClassDetail).toHaveBeenCalled();
  });

  it("returns labelHints for known IRIs without fetching", () => {
    const hints = { "http://example.org/Known": "Known Label" };
    const { result } = renderHook(() =>
      useIriLabels(["http://example.org/Known"], {
        projectId: "proj-1",
        accessToken: "token",
        labelHints: hints,
      }),
    );

    // labelHints are returned immediately, no fetch needed
    expect(result.current["http://example.org/Known"]).toBe("Known Label");
    expect(mockedGetClassDetail).not.toHaveBeenCalled();
    expect(mockedSearchEntities).not.toHaveBeenCalled();
  });

  it("merges labelHints with fetched labels", async () => {
    const hints = { "http://example.org/Known": "Known Label" };
    mockedGetClassDetail.mockResolvedValue({
      labels: [{ value: "Fetched", lang: "en" }],
    });

    const { result } = renderHook(() =>
      useIriLabels(
        ["http://example.org/Known", "http://example.org/Unknown"],
        {
          projectId: "proj-1",
          accessToken: "token",
          labelHints: hints,
        },
      ),
    );

    expect(result.current["http://example.org/Known"]).toBe("Known Label");

    await waitFor(() => {
      expect(result.current["http://example.org/Unknown"]).toBe("Fetched");
    });
    expect(result.current["http://example.org/Known"]).toBe("Known Label");
  });

  it("filters out falsy IRIs", () => {
    const { result } = renderHook(() =>
      useIriLabels(["", ""], { projectId: "proj-1", accessToken: "token" }),
    );
    expect(result.current).toEqual({});
    expect(mockedGetClassDetail).not.toHaveBeenCalled();
  });

  it("resets cache when projectId changes", async () => {
    mockedGetClassDetail.mockResolvedValue({
      labels: [{ value: "Label1", lang: "en" }],
    });

    const { result, rerender } = renderHook(
      ({ projectId, iris }: { projectId: string; iris: string[] }) =>
        useIriLabels(iris, {
          projectId,
          accessToken: "token",
        }),
      { initialProps: { projectId: "proj-1", iris: ["http://example.org/E"] } },
    );

    await waitFor(() => {
      expect(result.current["http://example.org/E"]).toBe("Label1");
    });

    mockedGetClassDetail.mockResolvedValue({
      labels: [{ value: "Label2", lang: "en" }],
    });

    // Change projectId AND iris to trigger both the context reset and the IRI effect
    rerender({ projectId: "proj-2", iris: ["http://example.org/F"] });

    await waitFor(
      () => {
        expect(result.current["http://example.org/F"]).toBe("Label2");
      },
      { timeout: 3000 },
    );
    // Old label should be cleared
    expect(result.current["http://example.org/E"]).toBeUndefined();
  });

  it("handles case where both class detail and search fail gracefully", async () => {
    mockedGetClassDetail.mockRejectedValue(new Error("fail"));
    mockedSearchEntities.mockRejectedValue(new Error("search fail"));

    const { result } = renderHook(() =>
      useIriLabels(["http://example.org/Unknown"], {
        projectId: "proj-1",
        accessToken: "token",
      }),
    );

    // Wait for both API paths to complete (getClassDetail fails, searchEntities fallback runs)
    await waitFor(() => {
      expect(mockedSearchEntities).toHaveBeenCalled();
    });

    // No label resolved, but no crash
    expect(result.current["http://example.org/Unknown"]).toBeUndefined();
  });

  it.each([
    "http://www.w3.org/2004/02/skos/core#prefLabel",
    "http://www.w3.org/2000/01/rdf-schema#label",
    "http://www.w3.org/2002/07/owl#topObjectProperty",
    "http://purl.org/dc/terms/hasVersion",
    "http://www.w3.org/2001/XMLSchema#string",
    // https:// variants of the same vocabularies must also be skipped
    "https://www.w3.org/2004/02/skos/core#prefLabel",
    "https://purl.org/dc/terms/title",
    "https://www.w3.org/2002/07/owl#sameAs",
  ])("skips both class probe and search for external-vocabulary IRI %s", async (iri) => {
    mockedGetClassDetail.mockResolvedValue({ labels: [{ value: "should-not", lang: "en" }] });
    mockedSearchEntities.mockResolvedValue({ results: [] });

    const { result } = renderHook(() =>
      useIriLabels([iri], { projectId: "proj-1", accessToken: "token" }),
    );

    // Give the effect a chance to run
    await new Promise((r) => setTimeout(r, 50));

    expect(mockedGetClassDetail).not.toHaveBeenCalled();
    expect(mockedSearchEntities).not.toHaveBeenCalled();
    expect(result.current[iri]).toBeUndefined();
  });

  it.each([
    "urn:uuid:550e8400-e29b-41d4-a716-446655440000",
    "tel:+1-555-0100",
    "bare-string-no-scheme",
  ])("does not short-circuit non-http(s) IRIs: %s", async (iri) => {
    // Non-http(s) IRIs aren't in the external-vocabulary skip-list, so the
    // hook should fall through to its normal probe path. Configure both
    // mocks to return empty results — we just want to assert that the hook
    // ATTEMPTED to resolve (i.e., did not silently skip).
    mockedSearchEntities.mockResolvedValue({ results: [] });
    mockedGetClassDetail.mockRejectedValue(new Error("not found"));

    renderHook(() =>
      useIriLabels([iri], { projectId: "proj-1", accessToken: "token" }),
    );

    await waitFor(() => {
      expect(mockedSearchEntities).toHaveBeenCalled();
    });
  });

  it("still resolves project-internal IRIs that aren't in the external skip-list", async () => {
    mockedGetClassDetail.mockResolvedValue({ labels: [{ value: "Person", lang: "en" }] });
    mockedSearchEntities.mockResolvedValue({ results: [] });

    const { result } = renderHook(() =>
      useIriLabels(["https://ontology.example.org/Person"], {
        projectId: "proj-1",
        accessToken: "token",
      }),
    );

    await waitFor(() => {
      expect(result.current["https://ontology.example.org/Person"]).toBe("Person");
    });
    expect(mockedGetClassDetail).toHaveBeenCalled();
  });
});
