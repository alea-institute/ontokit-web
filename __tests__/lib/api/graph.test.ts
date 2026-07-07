import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock the underlying request layer so we can assert the exact options
// (headers/params) graphApi hands to it.
vi.mock("@/lib/api/client", () => ({
  api: {
    get: vi.fn().mockResolvedValue({
      focus_iri: "iri",
      focus_label: "L",
      nodes: [],
      edges: [],
      truncated: false,
      total_concept_count: 0,
    }),
  },
}));

import { api } from "@/lib/api/client";
import { graphApi } from "@/lib/api/graph";

const mockedGet = api.get as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("graphApi.getEntityGraph auth threading", () => {
  const projectId = "proj-1";
  const classIri = "http://example.org/A";
  const endpoint = `/api/v1/projects/${projectId}/ontology/graph/${encodeURIComponent(classIri)}`;

  // Regression (/ce:review MEDIUM): the ported client dropped the Authorization
  // header the pre-port code sent, so private-project graphs (OptionalUser
  // endpoint) 401/403 for authenticated users. A token must produce a Bearer
  // header, matching every other projectOntologyApi call.
  it("sends the Bearer Authorization header when a token is supplied", async () => {
    await graphApi.getEntityGraph(projectId, classIri, { branch: "dev" }, "tok-123");

    expect(mockedGet).toHaveBeenCalledTimes(1);
    const [calledEndpoint, options] = mockedGet.mock.calls[0];
    expect(calledEndpoint).toBe(endpoint);
    expect(options.headers).toEqual({ Authorization: "Bearer tok-123" });
  });

  it("omits the Authorization header for anonymous (public-project) reads", async () => {
    await graphApi.getEntityGraph(projectId, classIri, { branch: "dev" });

    const [, options] = mockedGet.mock.calls[0];
    expect(options.headers).toBeUndefined();
  });

  it("still forwards the query params alongside the auth header", async () => {
    await graphApi.getEntityGraph(
      projectId,
      classIri,
      { branch: "dev", ancestorsDepth: 5, descendantsDepth: 2, maxNodes: 50 },
      "tok-123",
    );

    const [, options] = mockedGet.mock.calls[0];
    expect(options.params).toMatchObject({
      branch: "dev",
      ancestors_depth: 5,
      descendants_depth: 2,
      max_nodes: 50,
    });
    expect(options.headers).toEqual({ Authorization: "Bearer tok-123" });
  });
});
