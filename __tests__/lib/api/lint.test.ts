import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { ApiError } from "@/lib/api/client";
import {
  lintApi,
  createLintWebSocket,
  LintWebSocketManager,
} from "@/lib/api/lint";

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

describe("lintApi", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  // --- triggerLint ---

  describe("triggerLint", () => {
    it("calls POST /api/v1/projects/:id/lint/run with auth", async () => {
      const response = { job_id: "j1", status: "queued", message: "Lint started" };
      mockOk(response);

      const result = await lintApi.triggerLint("p1", "tok");
      expect(result).toEqual(response);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/projects/p1/lint/run");
      expect(options.method).toBe("POST");
      expect(options.headers.get("Authorization")).toBe("Bearer tok");
    });

    it("throws ApiError on 403 with correct status", async () => {
      mockError(403, "Forbidden", "Not authorized");

      try {
        await lintApi.triggerLint("p1", "tok");
        expect.unreachable("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(403);
      }
    });
  });

  // --- getStatus ---

  describe("getStatus", () => {
    it("calls GET /api/v1/projects/:id/lint/status", async () => {
      const summary = {
        project_id: "p1",
        last_run: null,
        error_count: 0,
        warning_count: 0,
        info_count: 0,
        total_issues: 0,
      };
      mockOk(summary);

      const result = await lintApi.getStatus("p1", "tok");
      expect(result).toEqual(summary);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/projects/p1/lint/status");
      expect(options.headers.get("Authorization")).toBe("Bearer tok");
    });

    it("omits auth header when no token", async () => {
      mockOk({ project_id: "p1", last_run: null, error_count: 0, warning_count: 0, info_count: 0, total_issues: 0 });

      await lintApi.getStatus("p1");

      const [, options] = mockFetch.mock.calls[0];
      expect(options.headers.has("Authorization")).toBe(false);
    });
  });

  // --- listRuns ---

  describe("listRuns", () => {
    it("calls GET /api/v1/projects/:id/lint/runs with pagination", async () => {
      mockOk({ items: [], total: 0, skip: 5, limit: 10 });

      await lintApi.listRuns("p1", "tok", { skip: 5, limit: 10 });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/projects/p1/lint/runs");
      expect(url).toContain("skip=5");
      expect(url).toContain("limit=10");
    });

    it("works without options", async () => {
      mockOk({ items: [], total: 0, skip: 0, limit: 20 });

      await lintApi.listRuns("p1");

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/projects/p1/lint/runs");
    });
  });

  // --- getRun ---

  describe("getRun", () => {
    it("calls GET /api/v1/projects/:id/lint/runs/:runId", async () => {
      const run = { id: "r1", project_id: "p1", status: "completed", issues: [] };
      mockOk(run);

      const result = await lintApi.getRun("p1", "r1", "tok");
      expect(result).toEqual(run);

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/projects/p1/lint/runs/r1");
    });

    it("omits auth header when no token", async () => {
      mockOk({ id: "r1" });

      await lintApi.getRun("p1", "r1");

      const [, options] = mockFetch.mock.calls[0];
      expect(options.headers.has("Authorization")).toBe(false);
    });
  });

  // --- getIssues ---

  describe("getIssues", () => {
    it("calls GET /api/v1/projects/:id/lint/issues with filters", async () => {
      mockOk({ items: [], total: 0, skip: 0, limit: 50 });

      await lintApi.getIssues("p1", "tok", {
        issue_type: "error",
        rule_id: "R001",
        include_resolved: true,
        skip: 0,
        limit: 50,
      });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/projects/p1/lint/issues");
      expect(url).toContain("issue_type=error");
      expect(url).toContain("rule_id=R001");
      expect(url).toContain("include_resolved=true");
    });

    it("works without options", async () => {
      mockOk({ items: [], total: 0, skip: 0, limit: 20 });

      await lintApi.getIssues("p1");

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/projects/p1/lint/issues");
    });

    it("passes subject_iri filter with full encoded value", async () => {
      mockOk({ items: [], total: 0, skip: 0, limit: 20 });

      await lintApi.getIssues("p1", "tok", { subject_iri: "http://example.org/Class1" });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("subject_iri=" + encodeURIComponent("http://example.org/Class1"));
    });
  });

  // --- dismissIssue ---

  describe("dismissIssue", () => {
    it("calls DELETE /api/v1/projects/:id/lint/issues/:issueId", async () => {
      mockEmpty();

      await lintApi.dismissIssue("p1", "i1", "tok");

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/projects/p1/lint/issues/i1");
      expect(options.method).toBe("DELETE");
      expect(options.headers.get("Authorization")).toBe("Bearer tok");
    });
  });

  // --- getRules ---

  describe("getRules", () => {
    it("calls GET /api/v1/projects/lint/rules without auth", async () => {
      const rules = {
        rules: [
          { rule_id: "R001", name: "Missing label", description: "Class has no label", severity: "warning", scope: ["class", "property", "individual"] },
        ],
      };
      mockOk(rules);

      const result = await lintApi.getRules();
      expect(result).toEqual(rules);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/projects/lint/rules");
      expect(options.method).toBe("GET");
    });
  });

  // --- getLintConfig ---

  describe("getLintConfig", () => {
    it("calls GET /api/v1/projects/:id/lint/config with auth", async () => {
      const config = { config: { lint_level: 2, enabled_rules: ["R001", "R002"] } };
      mockOk(config);

      const result = await lintApi.getLintConfig("p1", "tok");
      expect(result).toEqual(config);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/projects/p1/lint/config");
      expect(options.method).toBe("GET");
      expect(options.headers.get("Authorization")).toBe("Bearer tok");
    });

    it("omits auth header when no token", async () => {
      mockOk({ config: { lint_level: 2, enabled_rules: [] } });

      await lintApi.getLintConfig("p1");

      const [, options] = mockFetch.mock.calls[0];
      expect(options.headers.has("Authorization")).toBe(false);
    });
  });

  // --- updateLintConfig ---

  describe("updateLintConfig", () => {
    it("calls PUT /api/v1/projects/:id/lint/config with config body", async () => {
      const config = { lint_level: 0, enabled_rules: ["R001"] };
      const response = { config };
      mockOk(response);

      const result = await lintApi.updateLintConfig("p1", config, "tok");
      expect(result).toEqual(response);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/projects/p1/lint/config");
      expect(options.method).toBe("PUT");
      expect(options.headers.get("Authorization")).toBe("Bearer tok");

      const body = JSON.parse(options.body);
      expect(body).toEqual(config);
    });

    it("omits auth header when no token", async () => {
      const config = { lint_level: 2, enabled_rules: [] };
      mockOk({ config });

      await lintApi.updateLintConfig("p1", config);

      const [, options] = mockFetch.mock.calls[0];
      expect(options.headers.has("Authorization")).toBe(false);
    });

    it("throws ApiError on 404", async () => {
      mockError(404, "Not Found", "Endpoint not available");

      try {
        await lintApi.updateLintConfig("p1", { lint_level: 2, enabled_rules: [] }, "tok");
        expect.unreachable("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(404);
      }
    });
  });

  // --- getLevels ---

  describe("getLevels", () => {
    it("calls GET /api/v1/projects/lint/levels", async () => {
      const levels = {
        levels: [
          { level: 1, name: "Critical", description: "Structural errors", rule_ids: ["R001"] },
          { level: 2, name: "Consistency", description: "Orphan classes", rule_ids: ["R001", "R002"] },
        ],
      };
      mockOk(levels);

      const result = await lintApi.getLevels();
      expect(result).toEqual(levels);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/projects/lint/levels");
      expect(options.method).toBe("GET");
    });
  });

  // --- clearResults ---

  describe("clearResults", () => {
    it("calls DELETE /api/v1/projects/:id/lint/results with auth", async () => {
      mockEmpty();

      await lintApi.clearResults("p1", "tok");

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/projects/p1/lint/results");
      expect(options.method).toBe("DELETE");
      expect(options.headers.get("Authorization")).toBe("Bearer tok");
    });
  });
});

// --- WebSocket mock ---

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.OPEN;
  onopen: (() => void) | null = null;
  onclose: ((ev: { code: number }) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;

  close = vi.fn();
  send = vi.fn();

  constructor(public url: string) {}
}

// --- createLintWebSocket ---

describe("createLintWebSocket", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    global.WebSocket = MockWebSocket as unknown as typeof WebSocket;
    delete process.env.NEXT_PUBLIC_WS_URL;
    delete process.env.NEXT_PUBLIC_API_URL;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("creates WebSocket with NEXT_PUBLIC_WS_URL when set", () => {
    process.env.NEXT_PUBLIC_WS_URL = "ws://custom:9000";
    const onMessage = vi.fn();

    const ws = createLintWebSocket("p1", onMessage);

    expect(ws.url).toBe("ws://custom:9000/api/v1/projects/p1/lint/ws");
  });

  it("falls back to NEXT_PUBLIC_API_URL with ws:// replacement", () => {
    process.env.NEXT_PUBLIC_API_URL = "http://api-host:8080";
    const onMessage = vi.fn();

    const ws = createLintWebSocket("p1", onMessage);

    expect(ws.url).toBe("ws://api-host:8080/api/v1/projects/p1/lint/ws");
  });

  it("falls back to ws://localhost:8000 when no env vars set", () => {
    const onMessage = vi.fn();

    const ws = createLintWebSocket("p1", onMessage);

    expect(ws.url).toBe("ws://localhost:8000/api/v1/projects/p1/lint/ws");
  });

  it("calls onMessage with parsed JSON data on ws.onmessage", () => {
    const onMessage = vi.fn();
    const ws = createLintWebSocket("p1", onMessage);

    const msg = { type: "lint_started", project_id: "p1", run_id: "r1" };
    ws.onmessage!({ data: JSON.stringify(msg) } as MessageEvent);

    expect(onMessage).toHaveBeenCalledWith(msg);
  });

  it("handles JSON parse error in onmessage gracefully", () => {
    const onMessage = vi.fn();
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const ws = createLintWebSocket("p1", onMessage);
    ws.onmessage!({ data: "not-json" } as MessageEvent);

    expect(onMessage).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(
      "Failed to parse WebSocket message:",
      expect.any(Error)
    );

    consoleSpy.mockRestore();
  });

  it("calls onError when ws.onerror fires", () => {
    const onMessage = vi.fn();
    const onError = vi.fn();
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const ws = createLintWebSocket("p1", onMessage, onError);
    const errorEvent = new Event("error");
    ws.onerror!(errorEvent);

    expect(onError).toHaveBeenCalledWith(errorEvent);

    consoleSpy.mockRestore();
  });

  it("calls onClose when ws.onclose fires", () => {
    const onMessage = vi.fn();
    const onClose = vi.fn();

    const ws = createLintWebSocket("p1", onMessage, undefined, onClose);
    const closeEvent = { code: 1000 } as CloseEvent;
    ws.onclose!(closeEvent);

    expect(onClose).toHaveBeenCalledWith(closeEvent);
  });
});

// --- LintWebSocketManager ---

describe("LintWebSocketManager", () => {
  let constructedInstances: MockWebSocket[];

  beforeEach(() => {
    vi.useFakeTimers();
    constructedInstances = [];

    const OrigMock = MockWebSocket;
    global.WebSocket = class extends OrigMock {
      constructor(url: string) {
        super(url);
        constructedInstances.push(this);
      }
    } as unknown as typeof WebSocket;

    // Suppress console.error from onerror handler
    vi.spyOn(console, "error").mockImplementation(() => {});

    delete process.env.NEXT_PUBLIC_WS_URL;
    delete process.env.NEXT_PUBLIC_API_URL;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("connect() creates a WebSocket", () => {
    const mgr = new LintWebSocketManager("p1", vi.fn());
    mgr.connect();

    expect(constructedInstances).toHaveLength(1);
    expect(constructedInstances[0].url).toBe(
      "ws://localhost:8000/api/v1/projects/p1/lint/ws"
    );
  });

  it("connect() does not create duplicate if already OPEN", () => {
    const mgr = new LintWebSocketManager("p1", vi.fn());
    mgr.connect();

    // First WebSocket is OPEN by default (MockWebSocket.readyState = OPEN)
    mgr.connect();

    expect(constructedInstances).toHaveLength(1);
  });

  it("disconnect() closes WebSocket and resets state", () => {
    const mgr = new LintWebSocketManager("p1", vi.fn());
    mgr.connect();

    const ws = constructedInstances[0];
    mgr.disconnect();

    expect(ws.close).toHaveBeenCalledWith(1000, "Client closing connection");
  });

  it("reconnects on error with exponential backoff up to 5 attempts", () => {
    const mgr = new LintWebSocketManager("p1", vi.fn());
    mgr.connect();

    // Simulate error on each connection to trigger reconnect
    for (let attempt = 1; attempt <= 5; attempt++) {
      const ws = constructedInstances[constructedInstances.length - 1];
      // Set readyState to CLOSED so next connect() creates a new one
      ws.readyState = MockWebSocket.CLOSED;

      // Fire onerror to trigger handleReconnect
      ws.onerror!(new Event("error"));

      // Advance timer by the expected backoff delay: 1000 * 2^(attempt-1)
      const delay = 1000 * Math.pow(2, attempt - 1);
      vi.advanceTimersByTime(delay);
    }

    // 1 initial + 5 reconnect attempts = 6 total
    expect(constructedInstances).toHaveLength(6);
  });

  it("does not exceed maxReconnectAttempts (5)", () => {
    const mgr = new LintWebSocketManager("p1", vi.fn());
    mgr.connect();

    // Exhaust 5 reconnect attempts
    for (let attempt = 1; attempt <= 5; attempt++) {
      const ws = constructedInstances[constructedInstances.length - 1];
      ws.readyState = MockWebSocket.CLOSED;
      ws.onerror!(new Event("error"));
      vi.advanceTimersByTime(1000 * Math.pow(2, attempt - 1));
    }

    // 6th error should not trigger another reconnect
    const ws = constructedInstances[constructedInstances.length - 1];
    ws.readyState = MockWebSocket.CLOSED;
    ws.onerror!(new Event("error"));
    vi.advanceTimersByTime(100000);

    // Still 6 total (1 initial + 5 reconnects), no 7th
    expect(constructedInstances).toHaveLength(6);
  });

  it("does NOT reconnect after disconnect() is called", () => {
    const mgr = new LintWebSocketManager("p1", vi.fn());
    mgr.connect();

    mgr.disconnect();

    // Simulate error after disconnect
    const ws = constructedInstances[0];
    ws.readyState = MockWebSocket.CLOSED;
    ws.onerror!(new Event("error"));
    vi.advanceTimersByTime(10000);

    // No new connections created after the initial one
    expect(constructedInstances).toHaveLength(1);
  });

  it("does NOT reconnect on normal close (code 1000)", () => {
    const mgr = new LintWebSocketManager("p1", vi.fn());
    mgr.connect();

    const ws = constructedInstances[0];
    ws.readyState = MockWebSocket.CLOSED;

    // Fire onclose with code 1000 (normal)
    ws.onclose!({ code: 1000 } as CloseEvent);
    vi.advanceTimersByTime(10000);

    // No reconnect
    expect(constructedInstances).toHaveLength(1);
  });

  it("reconnects on abnormal close (code !== 1000)", () => {
    const mgr = new LintWebSocketManager("p1", vi.fn());
    mgr.connect();

    const ws = constructedInstances[0];
    ws.readyState = MockWebSocket.CLOSED;

    // Fire onclose with abnormal code
    ws.onclose!({ code: 1006 } as CloseEvent);
    vi.advanceTimersByTime(1000);

    expect(constructedInstances).toHaveLength(2);
  });
});
