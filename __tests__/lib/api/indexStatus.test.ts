import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  createIndexWebSocket,
  IndexWebSocketManager,
} from "@/lib/api/indexStatus";

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

// --- createIndexWebSocket ---

describe("createIndexWebSocket", () => {
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

    const ws = createIndexWebSocket("p1", onMessage);

    expect(ws.url).toBe("ws://custom:9000/api/v1/projects/p1/ontology/index-ws");
  });

  it("falls back to NEXT_PUBLIC_API_URL with ws:// replacement", () => {
    process.env.NEXT_PUBLIC_API_URL = "http://api-host:8080";
    const onMessage = vi.fn();

    const ws = createIndexWebSocket("p1", onMessage);

    expect(ws.url).toBe("ws://api-host:8080/api/v1/projects/p1/ontology/index-ws");
  });

  it("falls back to ws://localhost:8000 when no env vars set", () => {
    const onMessage = vi.fn();

    const ws = createIndexWebSocket("p1", onMessage);

    expect(ws.url).toBe("ws://localhost:8000/api/v1/projects/p1/ontology/index-ws");
  });

  it("calls onMessage with parsed JSON data on ws.onmessage", () => {
    const onMessage = vi.fn();
    const ws = createIndexWebSocket("p1", onMessage);

    const msg = { type: "index_started", project_id: "p1" };
    ws.onmessage!({ data: JSON.stringify(msg) } as MessageEvent);

    expect(onMessage).toHaveBeenCalledWith(msg);
  });

  it("handles JSON parse error in onmessage gracefully", () => {
    const onMessage = vi.fn();
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const ws = createIndexWebSocket("p1", onMessage);
    ws.onmessage!({ data: "not-json" } as MessageEvent);

    expect(onMessage).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(
      "Failed to parse index WebSocket message:",
      expect.any(Error)
    );

    consoleSpy.mockRestore();
  });

  it("calls onError when ws.onerror fires", () => {
    const onMessage = vi.fn();
    const onError = vi.fn();
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const ws = createIndexWebSocket("p1", onMessage, onError);
    const errorEvent = new Event("error");
    ws.onerror!(errorEvent);

    expect(onError).toHaveBeenCalledWith(errorEvent);

    consoleSpy.mockRestore();
  });

  it("calls onClose when ws.onclose fires", () => {
    const onMessage = vi.fn();
    const onClose = vi.fn();

    const ws = createIndexWebSocket("p1", onMessage, undefined, onClose);
    const closeEvent = { code: 1000 } as CloseEvent;
    ws.onclose!(closeEvent);

    expect(onClose).toHaveBeenCalledWith(closeEvent);
  });
});

// --- IndexWebSocketManager ---

describe("IndexWebSocketManager", () => {
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
    const mgr = new IndexWebSocketManager("p1", vi.fn());
    mgr.connect();

    expect(constructedInstances).toHaveLength(1);
    expect(constructedInstances[0].url).toBe(
      "ws://localhost:8000/api/v1/projects/p1/ontology/index-ws"
    );
  });

  it("connect() does not create duplicate if already OPEN", () => {
    const mgr = new IndexWebSocketManager("p1", vi.fn());
    mgr.connect();

    // First WebSocket is OPEN by default (MockWebSocket.readyState = OPEN)
    mgr.connect();

    expect(constructedInstances).toHaveLength(1);
  });

  it("disconnect() closes WebSocket and resets state", () => {
    const mgr = new IndexWebSocketManager("p1", vi.fn());
    mgr.connect();

    const ws = constructedInstances[0];
    mgr.disconnect();

    expect(ws.close).toHaveBeenCalledWith(1000, "Client closing connection");
  });

  it("reconnects on error with exponential backoff up to 5 attempts", () => {
    const mgr = new IndexWebSocketManager("p1", vi.fn());
    mgr.connect();

    for (let attempt = 1; attempt <= 5; attempt++) {
      const ws = constructedInstances[constructedInstances.length - 1];
      ws.readyState = MockWebSocket.CLOSED;

      ws.onerror!(new Event("error"));

      const delay = 1000 * Math.pow(2, attempt - 1);
      vi.advanceTimersByTime(delay);
    }

    // 1 initial + 5 reconnect attempts = 6 total
    expect(constructedInstances).toHaveLength(6);
  });

  it("does not exceed maxReconnectAttempts (5)", () => {
    const mgr = new IndexWebSocketManager("p1", vi.fn());
    mgr.connect();

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
    const mgr = new IndexWebSocketManager("p1", vi.fn());
    mgr.connect();

    mgr.disconnect();

    const ws = constructedInstances[0];
    ws.readyState = MockWebSocket.CLOSED;
    ws.onerror!(new Event("error"));
    vi.advanceTimersByTime(10000);

    expect(constructedInstances).toHaveLength(1);
  });

  it("does NOT reconnect on normal close (code 1000)", () => {
    const mgr = new IndexWebSocketManager("p1", vi.fn());
    mgr.connect();

    const ws = constructedInstances[0];
    ws.readyState = MockWebSocket.CLOSED;

    ws.onclose!({ code: 1000 } as CloseEvent);
    vi.advanceTimersByTime(10000);

    expect(constructedInstances).toHaveLength(1);
  });

  it("reconnects on abnormal close (code !== 1000)", () => {
    const mgr = new IndexWebSocketManager("p1", vi.fn());
    mgr.connect();

    const ws = constructedInstances[0];
    ws.readyState = MockWebSocket.CLOSED;

    ws.onclose!({ code: 1006 } as CloseEvent);
    vi.advanceTimersByTime(1000);

    expect(constructedInstances).toHaveLength(2);
  });
});
