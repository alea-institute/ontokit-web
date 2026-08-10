import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  trustApi,
  type SuggestionOutcomeItem,
  type TrustTier,
} from "@/lib/api/trust";

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

const capabilities = {
  tier: "untrusted",
  can_suggest: true,
  can_mint_entities: false,
  promotion_threshold: 5,
  accepted_count: 2,
  auto_accept_enabled: false,
  auto_accept_quiet_days: 7,
  verification_required: false,
};

describe("trustApi", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe("getCapabilities", () => {
    it("calls the capabilities endpoint with a bearer token", async () => {
      mockOk(capabilities);

      const result = await trustApi.getCapabilities("p1", "tok");
      expect(result).toEqual(capabilities);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/projects/p1/suggestions/capabilities");
      expect(options.method).toBe("GET");
      expect(new Headers(options.headers).get("Authorization")).toBe("Bearer tok");
    });

    it("omits the Authorization header when unauthenticated", async () => {
      // Anonymous visitors read capabilities on public projects (R1).
      mockOk({ ...capabilities, tier: "anonymous" });

      await trustApi.getCapabilities("p1");

      const [, options] = mockFetch.mock.calls[0];
      expect(new Headers(options.headers).get("Authorization")).toBeNull();
    });
  });

  describe("listMemberTrust", () => {
    it("calls the member trust endpoint", async () => {
      mockOk([]);
      await trustApi.listMemberTrust("p1", "tok");

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/projects/p1/trust/members");
      expect(options.method).toBe("GET");
    });
  });

  describe("listOutcomes", () => {
    it("calls the outcomes endpoint with cursor, limit, and bearer token", async () => {
      mockOk({ items: [], total: 0, next_cursor: null });

      await trustApi.listOutcomes(
        "p1",
        { cursor: "opaque/cursor+value", limit: 50 },
        "tok",
      );

      const [url, options] = mockFetch.mock.calls[0];
      const requestUrl = new URL(url);
      expect(requestUrl.pathname).toBe("/api/v1/projects/p1/trust/outcomes");
      expect(requestUrl.searchParams.get("cursor")).toBe("opaque/cursor+value");
      expect(requestUrl.searchParams.get("limit")).toBe("50");
      expect(options.method).toBe("GET");
      expect(new Headers(options.headers).get("Authorization")).toBe("Bearer tok");
    });

    it("passes nullable snapshot fields through untransformed", async () => {
      const item: SuggestionOutcomeItem = {
        user_id: "u1",
        is_anonymous: false,
        submitter_name: null,
        submitter_email: null,
        snapshot_tier: null,
        snapshot_role: null,
        snapshot_captured_at: null,
        outcome: "accepted",
        decided_by: null,
        decided_by_name: null,
        created_at: "2026-08-10T12:00:00Z",
      };
      mockOk({ items: [item], total: 1, next_cursor: null });

      const result = await trustApi.listOutcomes("p1", { limit: 25 }, "tok");

      expect(result.items[0]).toEqual(item);
      expect(result.items[0].snapshot_tier).toBeNull();
      expect(result.items[0].snapshot_role).toBeNull();
    });

    it("types snapshot_tier as TrustTier or null", () => {
      type SnapshotTier = SuggestionOutcomeItem["snapshot_tier"];
      const tier: SnapshotTier = "trusted";
      const nullableTier: TrustTier | null = tier;
      const noTier: SnapshotTier = null;

      expect(nullableTier).toBe("trusted");
      expect(noTier).toBeNull();
    });
  });

  describe("setMemberTrust", () => {
    it("PATCHes the override for a member", async () => {
      mockOk({ user_id: "u2", trust_override: "granted" });

      await trustApi.setMemberTrust("p1", "u2", "granted", "tok");

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/projects/p1/trust/members/u2");
      expect(options.method).toBe("PATCH");
      expect(JSON.parse(options.body)).toEqual({ trust_override: "granted" });
    });

    it("encodes user IDs that contain URL characters", async () => {
      mockOk({});
      await trustApi.setMemberTrust("p1", "user@example.com", "revoked", "tok");

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("user%40example.com");
    });

    it("does not replay a privilege change after a 5xx response", async () => {
      mockError(500, "Internal Server Error", "ambiguous trust update");
      mockOk({ user_id: "u2", trust_override: "granted" });

      await expect(
        trustApi.setMemberTrust("p1", "u2", "granted", "tok"),
      ).rejects.toThrow();
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("settings", () => {
    it("reads the project ladder settings", async () => {
      mockOk({
        trust_promotion_threshold: 5,
        auto_accept_enabled: false,
        auto_accept_quiet_days: 7,
      });

      await trustApi.getSettings("p1", "tok");

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/projects/p1/trust/settings");
      expect(options.method).toBe("GET");
    });

    it("sends only the fields being changed", async () => {
      mockOk({});
      await trustApi.updateSettings("p1", { auto_accept_enabled: true }, "tok");

      const [, options] = mockFetch.mock.calls[0];
      expect(options.method).toBe("PATCH");
      expect(JSON.parse(options.body)).toEqual({ auto_accept_enabled: true });
    });
  });
});
