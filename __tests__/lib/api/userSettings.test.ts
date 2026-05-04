import { describe, expect, it, beforeEach } from "vitest";
import {
  mockFetch,
  mockOk,
  mockEmpty,
  resetFetch,
} from "@/__tests__/helpers/mockFetch";
import { userSettingsApi } from "@/lib/api/userSettings";

describe("userSettingsApi", () => {
  beforeEach(() => {
    resetFetch();
  });

  describe("getGitHubTokenStatus", () => {
    it("fetches token status", async () => {
      const data = { has_token: true, github_username: "user1" };
      mockOk(data);

      const result = await userSettingsApi.getGitHubTokenStatus("tok");
      expect(result).toEqual(data);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/users/me/github-token");
      expect(options.method).toBe("GET");
      const headers = new Headers(options.headers);
      expect(headers.get("Authorization")).toBe("Bearer tok");
    });
  });

  describe("saveGitHubToken", () => {
    it("saves a GitHub PAT", async () => {
      const data = {
        github_username: "user1",
        created_at: "2025-01-01T00:00:00Z",
      };
      mockOk(data);

      const result = await userSettingsApi.saveGitHubToken(
        "ghp_abc123",
        "tok"
      );
      expect(result).toEqual(data);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/users/me/github-token");
      expect(options.method).toBe("POST");
      expect(JSON.parse(options.body)).toEqual({ token: "ghp_abc123" });
    });
  });

  describe("deleteGitHubToken", () => {
    it("deletes the stored token", async () => {
      mockEmpty();

      await userSettingsApi.deleteGitHubToken("tok");

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/users/me/github-token");
      expect(options.method).toBe("DELETE");
    });
  });

  describe("searchUsers", () => {
    it("searches users with query and default limit", async () => {
      const data = { items: [], total: 0 };
      mockOk(data);

      const result = await userSettingsApi.searchUsers("tok", "john");
      expect(result).toEqual(data);

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/users/search");
      expect(url).toContain("q=john");
      expect(url).toContain("limit=10");
    });

    it("passes custom limit", async () => {
      mockOk({ items: [], total: 0 });

      await userSettingsApi.searchUsers("tok", "john", 25);

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("limit=25");
    });
  });

  describe("listGitHubRepos", () => {
    it("lists repos with default params", async () => {
      const data = { items: [], total: 0 };
      mockOk(data);

      const result = await userSettingsApi.listGitHubRepos("tok");
      expect(result).toEqual(data);

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/users/me/github-repos");
      expect(url).toContain("page=1");
      expect(url).toContain("per_page=30");
    });

    it("passes query and pagination params", async () => {
      mockOk({ items: [], total: 0 });

      await userSettingsApi.listGitHubRepos("tok", "onto", 2, 10);

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("q=onto");
      expect(url).toContain("page=2");
      expect(url).toContain("per_page=10");
    });
  });
});
