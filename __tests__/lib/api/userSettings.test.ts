import { describe, expect, it, beforeEach } from "vitest";
import {
  mockFetch,
  mockOk,
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

  describe("commit identity", () => {
    const identity = {
      display_name: "Maria Gonzalez",
      noreply_alias: "maria-gonzalez-a1b2c3d4@users.noreply.ontokit.local",
      commit_email: null,
      commit_email_verified: false,
      use_verified_email: false,
      effective_email: "maria-gonzalez-a1b2c3d4@users.noreply.ontokit.local",
    };

    it("reads how commits are credited", async () => {
      mockOk(identity);

      const result = await userSettingsApi.getCommitIdentity("tok");
      expect(result).toEqual(identity);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/users/me/commit-identity");
      expect(options.method).toBe("GET");
    });

    it("updates the opt-in preference", async () => {
      mockOk({ ...identity, use_verified_email: true });

      await userSettingsApi.updateCommitIdentity({ use_verified_email: true }, "tok");

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/users/me/commit-identity");
      expect(options.method).toBe("PATCH");
      expect(JSON.parse(options.body)).toEqual({ use_verified_email: true });
    });
  });

  describe("retired PAT write surface", () => {
    it("no longer exposes token write methods", () => {
      // Per-user PATs are retired (R3/KD6): a lay contributor should never be
      // asked for a GitHub credential. Pinned so they cannot quietly return.
      expect("saveGitHubToken" in userSettingsApi).toBe(false);
      expect("deleteGitHubToken" in userSettingsApi).toBe(false);
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
