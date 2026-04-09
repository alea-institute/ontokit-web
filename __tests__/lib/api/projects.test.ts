import { describe, expect, it, vi, beforeEach } from "vitest";
import { ApiError } from "@/lib/api/client";
import { projectApi } from "@/lib/api/projects";

const mockFetch = vi.fn();
global.fetch = mockFetch;

function mockOk(data: unknown) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    text: () => Promise.resolve(JSON.stringify(data)),
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

describe("projectApi", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  // --- list ---

  describe("list", () => {
    it("calls GET /api/v1/projects with default params", async () => {
      const response = { items: [], total: 0, unfiltered_total: 0, skip: 0, limit: 20 };
      mockOk(response);

      const result = await projectApi.list();
      expect(result).toEqual(response);

      const [url, options] = mockFetch.mock.calls[0];
      expect(options.method).toBe("GET");
      expect(url).toContain("/api/v1/projects");
      expect(url).toContain("skip=0");
      expect(url).toContain("limit=20");
    });

    it("passes filter and search params", async () => {
      mockOk({ items: [], total: 0, unfiltered_total: 0, skip: 0, limit: 10 });

      await projectApi.list(5, 10, "public", undefined, "test");

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("skip=5");
      expect(url).toContain("limit=10");
      expect(url).toContain("filter=public");
      expect(url).toContain("search=test");
    });

    it("passes Authorization header when token provided", async () => {
      mockOk({ items: [], total: 0, unfiltered_total: 0, skip: 0, limit: 20 });

      await projectApi.list(0, 20, undefined, "my-token");

      const [, options] = mockFetch.mock.calls[0];
      const headers = options.headers;
      expect(headers.get("Authorization")).toBe("Bearer my-token");
    });

    it("omits Authorization header when no token", async () => {
      mockOk({ items: [], total: 0, unfiltered_total: 0, skip: 0, limit: 20 });

      await projectApi.list();

      const [, options] = mockFetch.mock.calls[0];
      const headers = options.headers;
      expect(headers.has("Authorization")).toBe(false);
    });

    it("omits search param when empty string", async () => {
      mockOk({ items: [], total: 0, unfiltered_total: 0, skip: 0, limit: 20 });

      await projectApi.list(0, 20, undefined, undefined, "");

      const [url] = mockFetch.mock.calls[0];
      expect(url).not.toContain("search=");
    });

    it("throws ApiError on failure after retrying", async () => {
      // 500 errors trigger retries (up to 3 attempts), so mock all 3
      mockError(500, "Internal Server Error", "Server error");
      mockError(500, "Internal Server Error", "Server error");
      mockError(500, "Internal Server Error", "Server error");

      await expect(projectApi.list()).rejects.toThrow(ApiError);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  // --- get ---

  describe("get", () => {
    it("calls GET /api/v1/projects/:id", async () => {
      const project = { id: "p1", name: "Test" };
      mockOk(project);

      const result = await projectApi.get("p1", "tok");
      expect(result).toEqual(project);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/projects/p1");
      expect(options.method).toBe("GET");
      expect(options.headers.get("Authorization")).toBe("Bearer tok");
    });

    it("omits auth header without token", async () => {
      mockOk({ id: "p1" });

      await projectApi.get("p1");

      const [, options] = mockFetch.mock.calls[0];
      expect(options.headers.has("Authorization")).toBe(false);
    });
  });

  // --- create ---

  describe("create", () => {
    it("calls POST /api/v1/projects with body and auth", async () => {
      const project = { id: "p1", name: "New" };
      mockOk(project);

      const result = await projectApi.create({ name: "New" }, "tok");
      expect(result).toEqual(project);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/projects");
      expect(options.method).toBe("POST");
      expect(JSON.parse(options.body)).toEqual({ name: "New" });
      expect(options.headers.get("Authorization")).toBe("Bearer tok");
    });
  });

  // --- update ---

  describe("update", () => {
    it("calls PATCH /api/v1/projects/:id", async () => {
      const updated = { id: "p1", name: "Updated" };
      mockOk(updated);

      const result = await projectApi.update("p1", { name: "Updated" }, "tok");
      expect(result).toEqual(updated);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/projects/p1");
      expect(options.method).toBe("PATCH");
      expect(JSON.parse(options.body)).toEqual({ name: "Updated" });
    });
  });

  // --- delete ---

  describe("delete", () => {
    it("calls DELETE /api/v1/projects/:id with auth", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(""),
      });

      await projectApi.delete("p1", "tok");

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/projects/p1");
      expect(options.method).toBe("DELETE");
      expect(options.headers.get("Authorization")).toBe("Bearer tok");
    });
  });

  // --- import (without progress) ---

  describe("import", () => {
    it("calls POST /api/v1/projects/import with FormData", async () => {
      const importResp = { id: "p1", name: "Imported", file_path: "/tmp/ont.ttl" };
      mockOk(importResp);

      const file = new File(["content"], "ontology.ttl", { type: "text/turtle" });
      const result = await projectApi.import(
        { file, is_public: true, name: "My Ont" },
        "tok"
      );
      expect(result).toEqual(importResp);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/projects/import");
      expect(options.method).toBe("POST");
      expect(options.body).toBeInstanceOf(FormData);

      const formData = options.body as FormData;
      const fileEntry = formData.get("file") as File;
      expect(fileEntry).toBeInstanceOf(File);
      expect(fileEntry.name).toBe("ontology.ttl");
      expect(fileEntry.type).toBe("text/turtle");
      expect(formData.get("is_public")).toBe("true");
      expect(formData.get("name")).toBe("My Ont");
    });
  });

  // --- scanGitHubRepoFiles ---

  describe("scanGitHubRepoFiles", () => {
    it("calls GET with owner, repo, and ref params", async () => {
      mockOk({ items: [], total: 0 });

      await projectApi.scanGitHubRepoFiles("myorg", "myrepo", "tok", "main");

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/projects/github/scan-files");
      expect(url).toContain("owner=myorg");
      expect(url).toContain("repo=myrepo");
      expect(url).toContain("ref=main");
      expect(options.headers.get("Authorization")).toBe("Bearer tok");
    });
  });

  // --- createFromGitHub ---

  describe("createFromGitHub", () => {
    it("calls POST /api/v1/projects/from-github", async () => {
      mockOk({ id: "p2", name: "GH Project" });

      await projectApi.createFromGitHub(
        {
          repo_owner: "org",
          repo_name: "repo",
          ontology_file_path: "ont.owl",
          is_public: false,
        },
        "tok"
      );

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/projects/from-github");
      expect(options.method).toBe("POST");
      expect(JSON.parse(options.body).repo_owner).toBe("org");
    });
  });

  // --- listMembers ---

  describe("listMembers", () => {
    it("calls GET /api/v1/projects/:id/members", async () => {
      mockOk({ items: [], total: 0 });

      await projectApi.listMembers("p1", "tok");

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/projects/p1/members");
    });
  });

  // --- addMember ---

  describe("addMember", () => {
    it("calls POST with member data", async () => {
      const member = { id: "m1", project_id: "p1", user_id: "u1", role: "editor" };
      mockOk(member);

      const result = await projectApi.addMember("p1", { user_id: "u1", role: "editor" }, "tok");
      expect(result).toEqual(member);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/projects/p1/members");
      expect(options.method).toBe("POST");
    });
  });

  // --- updateMember ---

  describe("updateMember", () => {
    it("calls PATCH /api/v1/projects/:id/members/:userId", async () => {
      mockOk({ id: "m1", role: "admin" });

      await projectApi.updateMember("p1", "u1", { role: "admin" }, "tok");

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/projects/p1/members/u1");
      expect(options.method).toBe("PATCH");
    });
  });

  // --- removeMember ---

  describe("removeMember", () => {
    it("calls DELETE /api/v1/projects/:id/members/:userId", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(""),
      });

      await projectApi.removeMember("p1", "u1", "tok");

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/projects/p1/members/u1");
      expect(options.method).toBe("DELETE");
    });
  });

  // --- transferOwnership ---

  describe("transferOwnership", () => {
    it("calls POST with force param", async () => {
      mockOk({ items: [], total: 0 });

      await projectApi.transferOwnership("p1", { new_owner_id: "u2" }, "tok", true);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/projects/p1/transfer-ownership");
      expect(url).toContain("force=true");
      expect(options.method).toBe("POST");
    });

    it("omits force when not provided", async () => {
      mockOk({ items: [], total: 0 });

      await projectApi.transferOwnership("p1", { new_owner_id: "u2" }, "tok");

      const [url] = mockFetch.mock.calls[0];
      expect(url).not.toContain("force=true");
    });
  });
});
