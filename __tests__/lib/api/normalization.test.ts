import { describe, expect, it, beforeEach } from "vitest";
import {
  mockFetch,
  mockOk,
  mockError,
  resetFetch,
} from "@/__tests__/helpers/mockFetch";
import { normalizationApi } from "@/lib/api/normalization";
import { ApiError } from "@/lib/api/client";

describe("normalizationApi", () => {
  beforeEach(() => {
    resetFetch();
  });

  describe("getStatus", () => {
    it("fetches normalization status for a project", async () => {
      const data = {
        needs_normalization: true,
        last_run: null,
        last_run_id: null,
        last_check: "2025-01-01T00:00:00Z",
        preview_report: null,
        checking: false,
        error: null,
      };
      mockOk(data);

      const result = await normalizationApi.getStatus("proj-1");
      expect(result).toEqual(data);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/projects/proj-1/normalization/status");
      expect(options.method).toBe("GET");
    });

    it("includes auth header when token provided", async () => {
      mockOk({ needs_normalization: false });

      await normalizationApi.getStatus("proj-1", "my-token");

      const [, options] = mockFetch.mock.calls[0];
      const headers = new Headers(options.headers);
      expect(headers.get("Authorization")).toBe("Bearer my-token");
    });

    it("omits auth header when no token", async () => {
      mockOk({ needs_normalization: false });

      await normalizationApi.getStatus("proj-1");

      const [, options] = mockFetch.mock.calls[0];
      const headers = new Headers(options.headers);
      expect(headers.get("Authorization")).toBeNull();
    });
  });

  describe("runNormalization", () => {
    it("sends POST with dry_run flag", async () => {
      const data = { id: "run-1", project_id: "proj-1", report: {} };
      mockOk(data);

      const result = await normalizationApi.runNormalization(
        "proj-1",
        true,
        "my-token"
      );
      expect(result).toEqual(data);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/projects/proj-1/normalization");
      expect(options.method).toBe("POST");
      expect(JSON.parse(options.body)).toEqual({ dry_run: true });
    });

    it("defaults dry_run to false", async () => {
      mockOk({ id: "run-1" });

      await normalizationApi.runNormalization("proj-1", undefined as unknown as boolean, "tok");

      const [, options] = mockFetch.mock.calls[0];
      expect(JSON.parse(options.body)).toEqual({ dry_run: false });
    });
  });

  describe("getHistory", () => {
    it("fetches history with default params", async () => {
      const data = { items: [], total: 0 };
      mockOk(data);

      const result = await normalizationApi.getHistory("proj-1");
      expect(result).toEqual(data);

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/projects/proj-1/normalization/history");
      expect(url).toContain("limit=10");
      expect(url).toContain("include_dry_runs=false");
    });

    it("passes custom limit and includeDryRuns", async () => {
      mockOk({ items: [], total: 0 });

      await normalizationApi.getHistory("proj-1", 25, true, "tok");

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("limit=25");
      expect(url).toContain("include_dry_runs=true");
    });
  });

  describe("getRun", () => {
    it("fetches a specific normalization run", async () => {
      const data = { id: "run-1", project_id: "proj-1" };
      mockOk(data);

      const result = await normalizationApi.getRun("proj-1", "run-1", "tok");
      expect(result).toEqual(data);

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain(
        "/api/v1/projects/proj-1/normalization/runs/run-1"
      );
    });
  });

  describe("refreshStatus", () => {
    it("sends POST to refresh endpoint", async () => {
      const data = { message: "Queued", job_id: "job-1" };
      mockOk(data);

      const result = await normalizationApi.refreshStatus("proj-1", "tok");
      expect(result).toEqual(data);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain(
        "/api/v1/projects/proj-1/normalization/refresh"
      );
      expect(options.method).toBe("POST");
    });
  });

  describe("queueNormalization", () => {
    it("sends POST to queue endpoint", async () => {
      const data = { message: "Queued", job_id: "job-1", status: "pending" };
      mockOk(data);

      const result = await normalizationApi.queueNormalization(
        "proj-1",
        true,
        "tok"
      );
      expect(result).toEqual(data);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain(
        "/api/v1/projects/proj-1/normalization/queue"
      );
      expect(options.method).toBe("POST");
      expect(JSON.parse(options.body)).toEqual({ dry_run: true });
    });
  });

  describe("getJobStatus", () => {
    it("fetches job status", async () => {
      const data = {
        job_id: "job-1",
        status: "complete",
        result: null,
        error: null,
      };
      mockOk(data);

      const result = await normalizationApi.getJobStatus(
        "proj-1",
        "job-1",
        "tok"
      );
      expect(result).toEqual(data);

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain(
        "/api/v1/projects/proj-1/normalization/jobs/job-1"
      );
    });

    it("throws ApiError on failure", async () => {
      mockError(500, "Internal Server Error", "Server error");
      // The client retries 5xx errors, so we need to mock all 3 attempts
      mockError(500, "Internal Server Error", "Server error");
      mockError(500, "Internal Server Error", "Server error");

      await expect(
        normalizationApi.getJobStatus("proj-1", "job-1")
      ).rejects.toThrow(ApiError);
    });
  });
});
