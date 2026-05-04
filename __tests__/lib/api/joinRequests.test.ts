import { describe, expect, it, beforeEach } from "vitest";
import {
  mockFetch,
  mockOk,
  mockEmpty,
  resetFetch,
} from "@/__tests__/helpers/mockFetch";
import { joinRequestApi } from "@/lib/api/joinRequests";

describe("joinRequestApi", () => {
  beforeEach(() => {
    resetFetch();
  });

  describe("getPendingSummary", () => {
    it("fetches pending summary with auth", async () => {
      const data = { total_pending: 3, by_project: [] };
      mockOk(data);

      const result = await joinRequestApi.getPendingSummary("tok");
      expect(result).toEqual(data);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/projects/join-requests/pending-summary");
      expect(options.method).toBe("GET");
      const headers = new Headers(options.headers);
      expect(headers.get("Authorization")).toBe("Bearer tok");
    });
  });

  describe("create", () => {
    it("creates a join request", async () => {
      const req = { message: "Please let me join" };
      const response = { id: "jr-1", ...req, status: "pending" };
      mockOk(response);

      const result = await joinRequestApi.create("proj-1", req, "tok");
      expect(result).toEqual(response);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/projects/proj-1/join-requests");
      expect(options.method).toBe("POST");
      expect(JSON.parse(options.body)).toEqual(req);
    });
  });

  describe("getMine", () => {
    it("fetches current user join request", async () => {
      const data = { has_pending_request: true, request: { id: "jr-1" } };
      mockOk(data);

      const result = await joinRequestApi.getMine("proj-1", "tok");
      expect(result).toEqual(data);

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/projects/proj-1/join-requests/mine");
    });
  });

  describe("list", () => {
    it("lists join requests without status filter", async () => {
      const data = { items: [], total: 0 };
      mockOk(data);

      const result = await joinRequestApi.list("proj-1", "tok");
      expect(result).toEqual(data);

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/projects/proj-1/join-requests");
    });

    it("lists join requests with status filter", async () => {
      mockOk({ items: [], total: 0 });

      await joinRequestApi.list("proj-1", "tok", "pending");

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("status=pending");
    });
  });

  describe("approve", () => {
    it("approves a join request", async () => {
      const response = { id: "jr-1", status: "approved" };
      mockOk(response);

      const result = await joinRequestApi.approve("proj-1", "jr-1", "tok");
      expect(result).toEqual(response);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain(
        "/api/v1/projects/proj-1/join-requests/jr-1/approve"
      );
      expect(options.method).toBe("POST");
    });

    it("approves with response message", async () => {
      mockOk({ id: "jr-1", status: "approved" });

      await joinRequestApi.approve("proj-1", "jr-1", "tok", {
        response_message: "Welcome!",
      });

      const [, options] = mockFetch.mock.calls[0];
      expect(JSON.parse(options.body)).toEqual({
        response_message: "Welcome!",
      });
    });
  });

  describe("decline", () => {
    it("declines a join request", async () => {
      const response = { id: "jr-1", status: "declined" };
      mockOk(response);

      const result = await joinRequestApi.decline("proj-1", "jr-1", "tok");
      expect(result).toEqual(response);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain(
        "/api/v1/projects/proj-1/join-requests/jr-1/decline"
      );
      expect(options.method).toBe("POST");
    });
  });

  describe("withdraw", () => {
    it("withdraws a join request", async () => {
      mockEmpty();

      await joinRequestApi.withdraw("proj-1", "jr-1", "tok");

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain(
        "/api/v1/projects/proj-1/join-requests/jr-1"
      );
      expect(options.method).toBe("DELETE");
    });
  });
});
