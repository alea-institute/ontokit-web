import { describe, it, expect, vi, beforeEach } from "vitest";
import { suggestionsApi } from "@/lib/api/suggestions";
import type { ClusterRequest, ClusterResponse, BatchSubmitRequest, BatchSubmitResponse } from "@/lib/api/suggestions";

// Mock the api client
vi.mock("@/lib/api/client", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}));

import { api } from "@/lib/api/client";

const mockedPost = api.post as ReturnType<typeof vi.fn>;

describe("suggestionsApi.cluster", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // CLUSTER-07: cluster API call
  it("cluster() sends POST with session_id and suggestion_items", async () => {
    const mockResponse: ClusterResponse = {
      pr_groups: [
        {
          id: "pr-1",
          shards: [
            {
              id: "shard-1",
              label: "Contract Law",
              ancestor_path: ["Contract Law"],
              entity_iris: ["http://ex.org/A", "http://ex.org/B", "http://ex.org/C"],
              is_misc: false,
              is_cross_cutting: false,
            },
          ],
        },
      ],
      total_suggestions: 3,
      total_shards: 1,
      total_prs: 1,
      skip_clustering: false,
    };

    mockedPost.mockResolvedValueOnce(mockResponse);

    const request: ClusterRequest = {
      suggestion_items: [
        { entity_iri: "http://ex.org/A", suggestion_type: "children", label: "Contract A" },
        { entity_iri: "http://ex.org/B", suggestion_type: "annotations", label: "Contract B" },
      ],
    };

    await suggestionsApi.cluster("proj-123", "sess-456", request, "token-abc");

    expect(mockedPost).toHaveBeenCalledOnce();
    const [url, body, options] = mockedPost.mock.calls[0];
    expect(url).toContain("/api/v1/projects/proj-123/suggestions/sessions/sess-456/cluster");
    expect(body).toEqual(request);
    expect(options?.headers).toMatchObject({ Authorization: "Bearer token-abc" });
  });

  it("cluster() returns ClusterResponse with pr_groups, total counts, skip_clustering flag", async () => {
    const mockResponse: ClusterResponse = {
      pr_groups: [],
      total_suggestions: 0,
      total_shards: 0,
      total_prs: 0,
      skip_clustering: true,
    };

    mockedPost.mockResolvedValueOnce(mockResponse);

    const result = await suggestionsApi.cluster("proj-1", "sess-1", { suggestion_items: [] }, "tok");

    expect(result).toEqual(mockResponse);
    expect(result.skip_clustering).toBe(true);
    expect(result.pr_groups).toBeInstanceOf(Array);
    expect(typeof result.total_suggestions).toBe("number");
    expect(typeof result.total_shards).toBe("number");
    expect(typeof result.total_prs).toBe("number");
  });
});

describe("suggestionsApi.batchSubmit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // CLUSTER-07: batch submit API call
  it("batchSubmit() sends POST with session_id, pr_groups, and optional notes", async () => {
    const mockResponse: BatchSubmitResponse = {
      results: [
        {
          pr_group_index: 0,
          pr_number: 42,
          pr_url: "https://github.com/org/repo/pull/42",
          github_pr_url: "https://github.com/org/repo/pull/42",
          status: "success",
        },
      ],
      succeeded: 1,
      failed: 0,
    };

    mockedPost.mockResolvedValueOnce(mockResponse);

    const request: BatchSubmitRequest = {
      pr_groups: [
        {
          shards: [
            {
              id: "shard-1",
              label: "Contract Law",
              entity_iris: ["http://ex.org/A", "http://ex.org/B", "http://ex.org/C"],
            },
          ],
        },
      ],
      notes: "Batch of contract law improvements",
    };

    await suggestionsApi.batchSubmit("proj-123", "sess-456", request, "token-abc");

    expect(mockedPost).toHaveBeenCalledOnce();
    const [url, body, options] = mockedPost.mock.calls[0];
    expect(url).toContain("/api/v1/projects/proj-123/suggestions/sessions/sess-456/batch-submit");
    expect(body).toEqual(request);
    expect(options?.headers).toMatchObject({ Authorization: "Bearer token-abc" });
  });

  it("batchSubmit() returns BatchSubmitResponse with per-PR results and success/failure counts", async () => {
    const mockResponse: BatchSubmitResponse = {
      results: [
        { pr_group_index: 0, pr_number: 1, pr_url: null, github_pr_url: null, status: "success" },
        { pr_group_index: 1, pr_number: undefined, pr_url: null, github_pr_url: null, status: "failed", error: "Branch conflict" },
      ],
      succeeded: 1,
      failed: 1,
    };

    mockedPost.mockResolvedValueOnce(mockResponse);

    const result = await suggestionsApi.batchSubmit(
      "proj-1",
      "sess-1",
      { pr_groups: [] },
      "tok",
    );

    expect(result).toEqual(mockResponse);
    expect(result.results).toHaveLength(2);
    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.results[1].status).toBe("failed");
    expect(result.results[1].error).toBe("Branch conflict");
  });
});
