import { describe, expect, it, vi, beforeEach } from "vitest";
import { ApiError } from "@/lib/api/client";
import { revisionsApi, branchesApi } from "@/lib/api/revisions";

const mockFetch = vi.fn();
global.fetch = mockFetch;

function mockOk(data: unknown) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    text: () => Promise.resolve(JSON.stringify(data)),
  });
}

function mockEmpty() {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    text: () => Promise.resolve(""),
  });
}

function mockError(status: number, statusText: string, body: string) {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    statusText,
    text: () => Promise.resolve(body),
  });
}

describe("revisionsApi", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  // --- getHistory ---

  describe("getHistory", () => {
    it("calls GET /api/v1/projects/:id/revisions with default limit", async () => {
      const response = { project_id: "p1", commits: [], total: 0 };
      mockOk(response);

      const result = await revisionsApi.getHistory("p1", "tok");
      expect(result).toEqual(response);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/projects/p1/revisions");
      expect(url).toContain("limit=50");
      expect(options.method).toBe("GET");
      expect(options.headers.get("Authorization")).toBe("Bearer tok");
    });

    it("passes custom limit", async () => {
      mockOk({ project_id: "p1", commits: [], total: 0 });

      await revisionsApi.getHistory("p1", undefined, 10);

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("limit=10");
    });

    it("omits auth header when no token", async () => {
      mockOk({ project_id: "p1", commits: [], total: 0 });

      await revisionsApi.getHistory("p1");

      const [, options] = mockFetch.mock.calls[0];
      expect(options.headers.has("Authorization")).toBe(false);
    });

    it("throws ApiError on 404", async () => {
      mockError(404, "Not Found", "Project not found");

      await expect(revisionsApi.getHistory("bad")).rejects.toThrow(ApiError);
    });
  });

  // --- getFileAtVersion ---

  describe("getFileAtVersion", () => {
    it("calls GET with version and default filename", async () => {
      const response = { project_id: "p1", version: "abc123", filename: "ontology.ttl", content: "@prefix..." };
      mockOk(response);

      const result = await revisionsApi.getFileAtVersion("p1", "abc123", "tok");
      expect(result).toEqual(response);

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/projects/p1/revisions/file");
      expect(url).toContain("version=abc123");
      expect(url).toContain("filename=ontology.ttl");
    });

    it("passes custom filename", async () => {
      mockOk({ project_id: "p1", version: "abc", filename: "other.owl", content: "" });

      await revisionsApi.getFileAtVersion("p1", "abc", undefined, "other.owl");

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("filename=other.owl");
    });

    it("omits auth header when no token", async () => {
      mockOk({ project_id: "p1", version: "abc", filename: "ontology.ttl", content: "" });

      await revisionsApi.getFileAtVersion("p1", "abc");

      const [, options] = mockFetch.mock.calls[0];
      expect(options.headers.has("Authorization")).toBe(false);
    });
  });

  // --- getDiff ---

  describe("getDiff", () => {
    it("calls GET with from_version and default to_version", async () => {
      const response = { project_id: "p1", from_version: "a", to_version: "HEAD", files_changed: 0, changes: [] };
      mockOk(response);

      const result = await revisionsApi.getDiff("p1", "a", undefined, "tok");
      expect(result).toEqual(response);

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/projects/p1/revisions/diff");
      expect(url).toContain("from_version=a");
      expect(url).toContain("to_version=HEAD");
    });

    it("passes custom to_version", async () => {
      mockOk({ project_id: "p1", from_version: "a", to_version: "b", files_changed: 0, changes: [] });

      await revisionsApi.getDiff("p1", "a", "b");

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("to_version=b");
    });
  });
});

describe("branchesApi", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  // --- list ---

  describe("list", () => {
    it("calls GET /api/v1/projects/:id/branches", async () => {
      const response = {
        items: [],
        current_branch: "main",
        default_branch: "main",
        preferred_branch: null,
        has_github_remote: false,
        last_sync_at: null,
        sync_status: null,
      };
      mockOk(response);

      const result = await branchesApi.list("p1", "tok");
      expect(result).toEqual(response);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/projects/p1/branches");
      expect(options.method).toBe("GET");
      expect(options.headers.get("Authorization")).toBe("Bearer tok");
    });

    it("omits auth header when no token", async () => {
      mockOk({ items: [], current_branch: "main", default_branch: "main", preferred_branch: null, has_github_remote: false, last_sync_at: null, sync_status: null });

      await branchesApi.list("p1");

      const [, options] = mockFetch.mock.calls[0];
      expect(options.headers.has("Authorization")).toBe(false);
    });
  });

  // --- create ---

  describe("create", () => {
    it("calls POST /api/v1/projects/:id/branches", async () => {
      const branch = { name: "feature", is_current: false, is_default: false, commits_ahead: 0, commits_behind: 0, remote_commits_ahead: null, remote_commits_behind: null, can_delete: true, has_open_pr: false, has_delete_permission: true };
      mockOk(branch);

      const result = await branchesApi.create("p1", { name: "feature", from_branch: "main" }, "tok");
      expect(result).toEqual(branch);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/projects/p1/branches");
      expect(options.method).toBe("POST");
      expect(JSON.parse(options.body)).toEqual({ name: "feature", from_branch: "main" });
      expect(options.headers.get("Authorization")).toBe("Bearer tok");
    });
  });

  // --- switch ---

  describe("switch", () => {
    it("calls POST with URL-encoded branch name", async () => {
      mockOk({ name: "feat/my-branch" });

      await branchesApi.switch("p1", "feat/my-branch", "tok");

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/projects/p1/branches/feat%2Fmy-branch/checkout");
      expect(options.method).toBe("POST");
    });
  });

  // --- delete ---

  describe("delete", () => {
    it("calls DELETE with URL-encoded branch name and force param", async () => {
      mockEmpty();

      await branchesApi.delete("p1", "feat/old", "tok", true);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/projects/p1/branches/feat%2Fold");
      expect(url).toContain("force=true");
      expect(options.method).toBe("DELETE");
    });

    it("passes force=false by default", async () => {
      mockEmpty();

      await branchesApi.delete("p1", "old-branch", "tok");

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("force=false");
    });
  });

  // --- savePreference ---

  describe("savePreference", () => {
    it("calls PUT /api/v1/projects/:id/branch-preference", async () => {
      mockEmpty();

      await branchesApi.savePreference("p1", "develop", "tok");

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/projects/p1/branch-preference");
      expect(url).toContain("branch=develop");
      expect(options.method).toBe("PUT");
      expect(options.headers.get("Authorization")).toBe("Bearer tok");
    });
  });
});
