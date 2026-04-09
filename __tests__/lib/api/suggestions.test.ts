import { describe, expect, it, vi, beforeEach } from "vitest";
import { ApiError } from "@/lib/api/client";
import { suggestionsApi } from "@/lib/api/suggestions";

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

describe("suggestionsApi", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  // --- createSession ---

  describe("createSession", () => {
    it("calls POST /api/v1/projects/:id/suggestions/sessions", async () => {
      const session = { session_id: "s1", branch: "suggest/s1", created_at: "2024-01-01" };
      mockOk(session);

      const result = await suggestionsApi.createSession("p1", "tok");
      expect(result).toEqual(session);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/projects/p1/suggestions/sessions");
      expect(options.method).toBe("POST");
      expect(options.headers.get("Authorization")).toBe("Bearer tok");
    });

    it("throws ApiError on 403", async () => {
      mockError(403, "Forbidden", "Not authorized");

      await expect(suggestionsApi.createSession("p1", "tok")).rejects.toThrow(ApiError);
    });
  });

  // --- save ---

  describe("save", () => {
    it("calls PUT /sessions/:sessionId/save with payload", async () => {
      const response = { commit_hash: "abc", branch: "suggest/s1", changes_count: 1 };
      mockOk(response);

      const result = await suggestionsApi.save(
        "p1",
        "s1",
        { content: "<turtle>", entity_iri: "http://ex.org/C1", entity_label: "Class1" },
        "tok"
      );
      expect(result).toEqual(response);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/projects/p1/suggestions/sessions/s1/save");
      expect(options.method).toBe("PUT");
      expect(JSON.parse(options.body).entity_iri).toBe("http://ex.org/C1");
      expect(options.headers.get("Authorization")).toBe("Bearer tok");
    });
  });

  // --- submit ---

  describe("submit", () => {
    it("calls POST /sessions/:sessionId/submit", async () => {
      const response = { pr_number: 5, pr_url: null, status: "submitted" };
      mockOk(response);

      const result = await suggestionsApi.submit("p1", "s1", { summary: "My changes" }, "tok");
      expect(result).toEqual(response);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/projects/p1/suggestions/sessions/s1/submit");
      expect(options.method).toBe("POST");
      expect(JSON.parse(options.body).summary).toBe("My changes");
    });
  });

  // --- listSessions ---

  describe("listSessions", () => {
    it("calls GET /api/v1/projects/:id/suggestions/sessions", async () => {
      mockOk({ items: [] });

      const result = await suggestionsApi.listSessions("p1", "tok");
      expect(result).toEqual({ items: [] });

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/projects/p1/suggestions/sessions");
      expect(options.method).toBe("GET");
      expect(options.headers.get("Authorization")).toBe("Bearer tok");
    });
  });

  // --- discard ---

  describe("discard", () => {
    it("calls POST /sessions/:sessionId/discard", async () => {
      mockEmpty();

      await suggestionsApi.discard("p1", "s1", "tok");

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/projects/p1/suggestions/sessions/s1/discard");
      expect(options.method).toBe("POST");
    });
  });

  // --- beacon ---

  describe("beacon", () => {
    it("calls navigator.sendBeacon with correct URL and payload", async () => {
      const mockBeacon = vi.fn().mockReturnValue(true);
      Object.defineProperty(navigator, "sendBeacon", {
        value: mockBeacon,
        writable: true,
        configurable: true,
      });

      const result = suggestionsApi.beacon("p1", "s1", "turtle content", "beacon tok+/%");
      expect(result).toBe(true);

      expect(mockBeacon).toHaveBeenCalledTimes(1);
      const [url, blob] = mockBeacon.mock.calls[0];
      expect(url).toContain("/api/v1/projects/p1/suggestions/beacon");
      expect(url).toContain("token=" + encodeURIComponent("beacon tok+/%"));
      expect(blob).toBeInstanceOf(Blob);

      // Parse the Blob payload and verify JSON contents
      const text = await (blob as Blob).text();
      const parsed = JSON.parse(text);
      expect(parsed.session_id).toBe("s1");
      expect(parsed.content).toBe("turtle content");
    });
  });

  // --- listPending ---

  describe("listPending", () => {
    it("calls GET /api/v1/projects/:id/suggestions/pending", async () => {
      mockOk({ items: [{ session_id: "s2", status: "submitted" }] });

      const result = await suggestionsApi.listPending("p1", "tok");
      expect(result.items).toHaveLength(1);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/projects/p1/suggestions/pending");
      expect(options.headers.get("Authorization")).toBe("Bearer tok");
    });
  });

  // --- approve ---

  describe("approve", () => {
    it("calls POST /sessions/:sessionId/approve", async () => {
      mockEmpty();

      await suggestionsApi.approve("p1", "s1", "tok");

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/projects/p1/suggestions/sessions/s1/approve");
      expect(options.method).toBe("POST");
      expect(options.headers.get("Authorization")).toBe("Bearer tok");
    });
  });

  // --- reject ---

  describe("reject", () => {
    it("calls POST /sessions/:sessionId/reject with reason", async () => {
      mockEmpty();

      await suggestionsApi.reject("p1", "s1", { reason: "Not aligned" }, "tok");

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/projects/p1/suggestions/sessions/s1/reject");
      expect(options.method).toBe("POST");
      expect(JSON.parse(options.body).reason).toBe("Not aligned");
    });
  });

  // --- requestChanges ---

  describe("requestChanges", () => {
    it("calls POST /sessions/:sessionId/request-changes with feedback", async () => {
      mockEmpty();

      await suggestionsApi.requestChanges("p1", "s1", { feedback: "Please fix label" }, "tok");

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/projects/p1/suggestions/sessions/s1/request-changes");
      expect(options.method).toBe("POST");
      expect(JSON.parse(options.body).feedback).toBe("Please fix label");
      expect(options.headers.get("Authorization")).toBe("Bearer tok");
    });
  });

  // --- resubmit ---

  describe("resubmit", () => {
    it("calls POST /sessions/:sessionId/resubmit", async () => {
      const response = { pr_number: 5, pr_url: null, status: "submitted" };
      mockOk(response);

      const result = await suggestionsApi.resubmit("p1", "s1", { summary: "Fixed" }, "tok");
      expect(result).toEqual(response);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/projects/p1/suggestions/sessions/s1/resubmit");
      expect(options.method).toBe("POST");
      expect(JSON.parse(options.body).summary).toBe("Fixed");
    });

    it("throws ApiError on 404", async () => {
      mockError(404, "Not Found", "Session not found");

      await expect(suggestionsApi.resubmit("p1", "bad", {}, "tok")).rejects.toThrow(ApiError);
    });
  });
});
