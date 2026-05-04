import { describe, expect, it, beforeEach } from "vitest";
import {
  mockFetch,
  mockOk,
  mockEmpty,
  mockError,
  resetFetch,
} from "@/__tests__/helpers/mockFetch";
import { remoteSyncApi } from "@/lib/api/remoteSync";
import { ApiError } from "@/lib/api/client";

describe("remoteSyncApi", () => {
  beforeEach(() => {
    resetFetch();
  });

  describe("getConfig", () => {
    it("fetches sync config for a project", async () => {
      const data = {
        id: "cfg-1",
        project_id: "proj-1",
        repo_owner: "org",
        repo_name: "repo",
        branch: "main",
        file_path: "ontology.ttl",
        frequency: "24h",
        enabled: true,
        update_mode: "auto_apply",
        status: "idle",
      };
      mockOk(data);

      const result = await remoteSyncApi.getConfig("proj-1");
      expect(result).toEqual(data);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/projects/proj-1/remote-sync");
      expect(options.method).toBe("GET");
    });

    it("includes auth header when token provided", async () => {
      mockOk(null);

      await remoteSyncApi.getConfig("proj-1", "my-token");

      const [, options] = mockFetch.mock.calls[0];
      const headers = new Headers(options.headers);
      expect(headers.get("Authorization")).toBe("Bearer my-token");
    });

    it("omits auth header when no token", async () => {
      mockOk(null);

      await remoteSyncApi.getConfig("proj-1");

      const [, options] = mockFetch.mock.calls[0];
      const headers = new Headers(options.headers);
      expect(headers.get("Authorization")).toBeNull();
    });
  });

  describe("saveConfig", () => {
    it("sends PUT with config data", async () => {
      const configData = {
        repo_owner: "org",
        repo_name: "repo",
        file_path: "ontology.ttl",
      };
      const response = { id: "cfg-1", ...configData };
      mockOk(response);

      const result = await remoteSyncApi.saveConfig(
        "proj-1",
        configData,
        "tok"
      );
      expect(result).toEqual(response);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/projects/proj-1/remote-sync");
      expect(options.method).toBe("PUT");
      expect(JSON.parse(options.body)).toEqual(configData);
    });
  });

  describe("deleteConfig", () => {
    it("sends DELETE request", async () => {
      mockEmpty();

      await remoteSyncApi.deleteConfig("proj-1", "tok");

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/projects/proj-1/remote-sync");
      expect(options.method).toBe("DELETE");
    });
  });

  describe("triggerCheck", () => {
    it("sends POST to check endpoint", async () => {
      const data = {
        message: "Check queued",
        job_id: "job-1",
        status: "pending",
      };
      mockOk(data);

      const result = await remoteSyncApi.triggerCheck("proj-1", "tok");
      expect(result).toEqual(data);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/projects/proj-1/remote-sync/check");
      expect(options.method).toBe("POST");
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

      const result = await remoteSyncApi.getJobStatus(
        "proj-1",
        "job-1",
        "tok"
      );
      expect(result).toEqual(data);

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain(
        "/api/v1/projects/proj-1/remote-sync/jobs/job-1"
      );
    });
  });

  describe("errors", () => {
    it("throws ApiError on server failure", async () => {
      // The client retries 5xx errors up to 2 times (3 attempts total)
      mockError(500, "Internal Server Error", "Server error");
      mockError(500, "Internal Server Error", "Server error");
      mockError(500, "Internal Server Error", "Server error");

      await expect(remoteSyncApi.getConfig("proj-1")).rejects.toThrow(ApiError);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  describe("getHistory", () => {
    it("fetches sync history with default limit", async () => {
      const data = { items: [], total: 0 };
      mockOk(data);

      const result = await remoteSyncApi.getHistory("proj-1");
      expect(result).toEqual(data);

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/projects/proj-1/remote-sync/history");
      expect(url).toContain("limit=20");
    });

    it("passes custom limit", async () => {
      mockOk({ items: [], total: 0 });

      await remoteSyncApi.getHistory("proj-1", 50, "tok");

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("limit=50");
    });
  });
});
