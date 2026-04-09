import { describe, expect, it, beforeEach } from "vitest";
import {
  mockFetch,
  mockOk,
  resetFetch,
} from "@/__tests__/helpers/mockFetch";
import { analyticsApi } from "@/lib/api/analytics";

describe("analyticsApi", () => {
  beforeEach(() => {
    resetFetch();
  });

  describe("getActivity", () => {
    it("fetches project activity with default days", async () => {
      const data = { daily_counts: [], total_events: 0, top_editors: [] };
      mockOk(data);

      const result = await analyticsApi.getActivity("proj-1");
      expect(result).toEqual(data);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/projects/proj-1/analytics/activity");
      expect(url).toContain("days=30");
      expect(options.method).toBe("GET");
    });

    it("includes token and custom days", async () => {
      mockOk({ daily_counts: [], total_events: 0, top_editors: [] });

      await analyticsApi.getActivity("proj-1", "tok", 7);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("days=7");
      const headers = new Headers(options.headers);
      expect(headers.get("Authorization")).toBe("Bearer tok");
    });

    it("omits auth header when no token", async () => {
      mockOk({ daily_counts: [], total_events: 0, top_editors: [] });

      await analyticsApi.getActivity("proj-1");

      const [, options] = mockFetch.mock.calls[0];
      const headers = new Headers(options.headers);
      expect(headers.get("Authorization")).toBeNull();
    });
  });

  describe("getEntityHistory", () => {
    it("fetches entity history", async () => {
      const data = {
        entity_iri: "http://example.org/Foo",
        events: [],
        total: 0,
      };
      mockOk(data);

      const result = await analyticsApi.getEntityHistory(
        "proj-1",
        "http://example.org/Foo"
      );
      expect(result).toEqual(data);

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain(
        "/api/v1/projects/proj-1/analytics/entity/" +
          encodeURIComponent("http://example.org/Foo") +
          "/history"
      );
      expect(url).toContain("limit=50");
    });

    it("passes branch and custom limit", async () => {
      mockOk({ entity_iri: "x", events: [], total: 0 });

      await analyticsApi.getEntityHistory(
        "proj-1",
        "http://example.org/Foo",
        "tok",
        "dev",
        10
      );

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("branch=dev");
      expect(url).toContain("limit=10");
    });
  });

  describe("getHotEntities", () => {
    it("fetches hot entities with default limit", async () => {
      const data = [
        {
          entity_iri: "http://example.org/Foo",
          entity_type: "class",
          edit_count: 5,
          editor_count: 2,
          last_edited_at: "2025-01-01T00:00:00Z",
        },
      ];
      mockOk(data);

      const result = await analyticsApi.getHotEntities("proj-1");
      expect(result).toEqual(data);

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/projects/proj-1/analytics/hot-entities");
      expect(url).toContain("limit=20");
    });

    it("passes custom limit", async () => {
      mockOk([]);

      await analyticsApi.getHotEntities("proj-1", "tok", 5);

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("limit=5");
    });
  });

  describe("getContributors", () => {
    it("fetches contributors with default days", async () => {
      mockOk([]);

      const result = await analyticsApi.getContributors("proj-1");
      expect(result).toEqual([]);

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain(
        "/api/v1/projects/proj-1/analytics/contributors"
      );
      expect(url).toContain("days=30");
    });

    it("passes custom days and token", async () => {
      mockOk([]);

      await analyticsApi.getContributors("proj-1", "tok", 14);

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("days=14");
    });
  });
});
