import { describe, expect, it, vi, beforeEach } from "vitest";
import { api } from "@/lib/api/client";

// Mock the api module
vi.mock("@/lib/api/client", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const mockGet = vi.mocked(api.get);
const mockPost = vi.mocked(api.post);

import {
  suggestionsApi,
  type EntityReviewMetadata,
  type ShardReviewInfo,
  type SessionDetailResponse,
  type ShardReviewMark,
  type ShardReviewsRequest,
  type CleanPRRequest,
  type CleanPRResponse,
} from "@/lib/api/suggestions";

const MOCK_SESSION_DETAIL: SessionDetailResponse = {
  session_id: "sess-123",
  entities: [
    {
      entity_iri: "http://example.org/Foo",
      entity_label: "Foo",
      shard_id: "shard-1",
      shard_label: "Foos and Friends",
      provenance: "llm-proposed",
      confidence: 0.87,
      duplicate_candidates: [
        { iri: "http://example.org/FooBar", label: "FooBar", score: 0.72 },
      ],
    },
  ],
  shards: [
    {
      id: "shard-1",
      label: "Foos and Friends",
      entity_iris: ["http://example.org/Foo"],
    },
  ],
};

describe("suggestionsApi — Phase 16 review methods", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
  });

  // Test 1: getSessionDetail
  describe("getSessionDetail", () => {
    it("calls GET /api/v1/projects/{projectId}/suggestions/sessions/{sessionId}/detail", async () => {
      mockGet.mockResolvedValue(MOCK_SESSION_DETAIL);

      await suggestionsApi.getSessionDetail("proj-1", "sess-123", "tok-abc");

      expect(mockGet).toHaveBeenCalledTimes(1);
      const [url, options] = mockGet.mock.calls[0];
      expect(url).toBe(
        "/api/v1/projects/proj-1/suggestions/sessions/sess-123/detail"
      );
      expect(options?.headers).toEqual(
        expect.objectContaining({ Authorization: "Bearer tok-abc" })
      );
    });

    it("returns SessionDetailResponse shape", async () => {
      mockGet.mockResolvedValue(MOCK_SESSION_DETAIL);

      const result = await suggestionsApi.getSessionDetail(
        "proj-1",
        "sess-123",
        "tok-abc"
      );

      expect(result.session_id).toBe("sess-123");
      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].entity_iri).toBe("http://example.org/Foo");
      expect(result.entities[0].provenance).toBe("llm-proposed");
      expect(result.entities[0].confidence).toBe(0.87);
      expect(result.entities[0].duplicate_candidates).toHaveLength(1);
      expect(result.shards).toHaveLength(1);
      expect(result.shards[0].id).toBe("shard-1");
    });
  });

  // Test 2: postShardReviews
  describe("postShardReviews", () => {
    it("calls POST /api/v1/projects/{projectId}/suggestions/sessions/{sessionId}/shard-reviews", async () => {
      mockPost.mockResolvedValue(undefined);

      const data: ShardReviewsRequest = {
        marks: [
          { shard_id: "shard-1", status: "approved" },
          {
            shard_id: "shard-2",
            status: "rejected",
            feedback: "Not needed",
          },
        ],
      };

      await suggestionsApi.postShardReviews("proj-1", "sess-123", data, "tok-abc");

      expect(mockPost).toHaveBeenCalledTimes(1);
      const [url, body, options] = mockPost.mock.calls[0];
      expect(url).toBe(
        "/api/v1/projects/proj-1/suggestions/sessions/sess-123/shard-reviews"
      );
      expect(body).toEqual(data);
      expect(options?.headers).toEqual(
        expect.objectContaining({ Authorization: "Bearer tok-abc" })
      );
    });

    it("sends shard marks array with status and optional feedback", async () => {
      mockPost.mockResolvedValue(undefined);

      const data: ShardReviewsRequest = {
        marks: [
          { shard_id: "shard-1", status: "approved" },
        ],
      };

      await suggestionsApi.postShardReviews("proj-2", "sess-456", data, "tok-xyz");

      const [, body] = mockPost.mock.calls[0];
      const req = body as ShardReviewsRequest;
      expect(req.marks).toHaveLength(1);
      expect(req.marks[0].shard_id).toBe("shard-1");
      expect(req.marks[0].status).toBe("approved");
      expect(req.marks[0].feedback).toBeUndefined();
    });
  });

  // Test 3: createCleanPR
  describe("createCleanPR", () => {
    it("calls POST /api/v1/projects/{projectId}/suggestions/sessions/{sessionId}/clean-pr", async () => {
      const mockPRResponse: CleanPRResponse = {
        pr_number: 42,
        pr_url: "https://example.com/pr/42",
        github_pr_url: "https://github.com/example/repo/pull/42",
      };
      mockPost.mockResolvedValue(mockPRResponse);

      const data: CleanPRRequest = {
        approved_shard_ids: ["shard-1", "shard-3"],
      };

      await suggestionsApi.createCleanPR("proj-1", "sess-123", data, "tok-abc");

      expect(mockPost).toHaveBeenCalledTimes(1);
      const [url, body, options] = mockPost.mock.calls[0];
      expect(url).toBe(
        "/api/v1/projects/proj-1/suggestions/sessions/sess-123/clean-pr"
      );
      expect(body).toEqual(data);
      expect(options?.headers).toEqual(
        expect.objectContaining({ Authorization: "Bearer tok-abc" })
      );
    });

    it("sends approved_shard_ids array in request body", async () => {
      const mockPRResponse: CleanPRResponse = {
        pr_number: 99,
        pr_url: null,
        github_pr_url: null,
      };
      mockPost.mockResolvedValue(mockPRResponse);

      const data: CleanPRRequest = {
        approved_shard_ids: ["shard-a", "shard-b", "shard-c"],
      };

      const result = await suggestionsApi.createCleanPR(
        "proj-1",
        "sess-999",
        data,
        "tok-def"
      );

      const [, body] = mockPost.mock.calls[0];
      const req = body as CleanPRRequest;
      expect(req.approved_shard_ids).toEqual(["shard-a", "shard-b", "shard-c"]);
      expect(result.pr_number).toBe(99);
    });
  });

  // Test 4: EntityReviewMetadata type shape check (via runtime usage)
  describe("EntityReviewMetadata type fields", () => {
    it("EntityReviewMetadata includes all required fields", () => {
      const entity: EntityReviewMetadata = {
        entity_iri: "http://example.org/TestClass",
        entity_label: "Test Class",
        shard_id: "shard-1",
        shard_label: "Test Shard",
        provenance: "user-written",
        confidence: null,
        duplicate_candidates: [],
      };

      expect(entity.entity_iri).toBe("http://example.org/TestClass");
      expect(entity.entity_label).toBe("Test Class");
      expect(entity.shard_id).toBe("shard-1");
      expect(entity.shard_label).toBe("Test Shard");
      expect(entity.provenance).toBe("user-written");
      expect(entity.confidence).toBeNull();
      expect(entity.duplicate_candidates).toEqual([]);
    });

    it("ShardReviewInfo includes id, label, and entity_iris", () => {
      const shard: ShardReviewInfo = {
        id: "shard-x",
        label: "X Shard",
        entity_iris: ["http://example.org/A", "http://example.org/B"],
      };

      expect(shard.id).toBe("shard-x");
      expect(shard.label).toBe("X Shard");
      expect(shard.entity_iris).toHaveLength(2);
    });
  });
});
