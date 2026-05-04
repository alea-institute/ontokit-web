import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  CollaborationClient,
  type CollaborationClientOptions,
  type Operation,
  type User,
} from "@/lib/collab/client";

// --- MockWebSocket -----------------------------------------------------------

const mockWsInstances: MockWebSocket[] = [];

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.OPEN;
  onopen: ((ev: Event) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;

  send = vi.fn();
  close = vi.fn();

  constructor(public url: string) {
    mockWsInstances.push(this);
  }
}

// Patch global WebSocket so the production code uses our mock.
vi.stubGlobal("WebSocket", MockWebSocket);

// --- helpers -----------------------------------------------------------------

function defaultOptions(
  overrides: Partial<CollaborationClientOptions> = {}
): CollaborationClientOptions {
  return {
    url: "ws://localhost:8000/ws",
    token: "test-token",
    userId: "user-1",
    displayName: "Test User",
    ...overrides,
  };
}

/** Connects and returns the underlying MockWebSocket instance. */
async function connectClient(
  client: CollaborationClient
): Promise<MockWebSocket> {
  const promise = client.connect();
  const ws = mockWsInstances[mockWsInstances.length - 1];
  ws.onopen?.(new Event("open"));
  await promise;
  return ws;
}

/** Simulate a server message arriving on the given socket. */
function receiveMessage(ws: MockWebSocket, data: unknown): void {
  ws.onmessage?.(new MessageEvent("message", { data: JSON.stringify(data) }));
}

// --- tests -------------------------------------------------------------------

describe("CollaborationClient", () => {
  beforeEach(() => {
    mockWsInstances.length = 0;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------- connect() ----------------------------------------------------

  describe("connect()", () => {
    it("resolves on successful open and fires onConnectionChange(true)", async () => {
      const onConnectionChange = vi.fn();
      const client = new CollaborationClient(
        defaultOptions({ onConnectionChange })
      );

      const ws = await connectClient(client);

      expect(ws.url).toBe("ws://localhost:8000/ws?token=test-token");
      expect(onConnectionChange).toHaveBeenCalledWith(true);
    });

    it("rejects when onerror fires", async () => {
      const onError = vi.fn();
      const client = new CollaborationClient(defaultOptions({ onError }));

      const promise = client.connect();
      const ws = mockWsInstances[mockWsInstances.length - 1];
      ws.onerror?.(new Event("error"));

      await expect(promise).rejects.toThrow("WebSocket connection failed");
      expect(onError).toHaveBeenCalledWith("WebSocket error");
    });

    it("fires onConnectionChange(false) on close", async () => {
      const onConnectionChange = vi.fn();
      const onError = vi.fn();
      const client = new CollaborationClient(
        defaultOptions({ onConnectionChange, onError })
      );

      const ws = await connectClient(client);
      // Prevent reconnect from actually running
      ws.readyState = MockWebSocket.CLOSED;
      ws.onclose?.(new CloseEvent("close"));

      expect(onConnectionChange).toHaveBeenCalledWith(false);
    });

    it("resets reconnectAttempts on successful open", async () => {
      const client = new CollaborationClient(defaultOptions());
      // Access private field to set reconnectAttempts > 0
      (client as unknown as { reconnectAttempts: number }).reconnectAttempts = 3;

      await connectClient(client);

      expect(
        (client as unknown as { reconnectAttempts: number }).reconnectAttempts
      ).toBe(0);
    });
  });

  // ---------- handleMessage ------------------------------------------------

  describe("handleMessage", () => {
    it("handles 'authenticated' without throwing", async () => {
      const client = new CollaborationClient(defaultOptions());
      const ws = await connectClient(client);

      expect(() =>
        receiveMessage(ws, { type: "authenticated", payload: {} })
      ).not.toThrow();
    });

    it("handles 'user_list' and calls onUsersChanged", async () => {
      const onUsersChanged = vi.fn();
      const client = new CollaborationClient(
        defaultOptions({ onUsersChanged })
      );
      const ws = await connectClient(client);

      const users: User[] = [
        {
          user_id: "u1",
          display_name: "Alice",
          client_type: "web",
          client_version: "1.0.0",
        },
      ];

      receiveMessage(ws, { type: "user_list", payload: { users } });

      expect(onUsersChanged).toHaveBeenCalledWith(users);
    });

    it("handles 'operation' — calls onOperationReceived and updates serverVersion", async () => {
      const onOperationReceived = vi.fn();
      const client = new CollaborationClient(
        defaultOptions({ onOperationReceived })
      );
      const ws = await connectClient(client);

      const op: Operation = {
        id: "op-1",
        type: "add",
        path: "/some/path",
        timestamp: "2025-01-01T00:00:00Z",
        user_id: "u2",
        version: 5,
      };

      receiveMessage(ws, { type: "operation", payload: op });

      expect(onOperationReceived).toHaveBeenCalledWith(op);
      expect(
        (client as unknown as { serverVersion: number }).serverVersion
      ).toBe(5);
    });

    it("handles 'operation_ack' — removes pending op and updates serverVersion", async () => {
      const client = new CollaborationClient(defaultOptions());
      const ws = await connectClient(client);

      // Seed a pending op
      const pendingOps = (
        client as unknown as { pendingOps: Map<string, Operation> }
      ).pendingOps;
      pendingOps.set("op-1", {
        id: "op-1",
        type: "add",
        path: "/p",
        timestamp: "",
        user_id: "user-1",
        version: 0,
      });

      receiveMessage(ws, {
        type: "operation_ack",
        payload: { operation_id: "op-1", version: 7 },
      });

      expect(pendingOps.has("op-1")).toBe(false);
      expect(
        (client as unknown as { serverVersion: number }).serverVersion
      ).toBe(7);
    });

    it("handles 'operation_reject' — removes pending op and calls onError", async () => {
      const onError = vi.fn();
      const client = new CollaborationClient(defaultOptions({ onError }));
      const ws = await connectClient(client);

      const pendingOps = (
        client as unknown as { pendingOps: Map<string, Operation> }
      ).pendingOps;
      pendingOps.set("op-2", {
        id: "op-2",
        type: "add",
        path: "/p",
        timestamp: "",
        user_id: "user-1",
        version: 0,
      });

      receiveMessage(ws, {
        type: "operation_reject",
        payload: { operation_id: "op-2", reason: "conflict" },
      });

      expect(pendingOps.has("op-2")).toBe(false);
      expect(onError).toHaveBeenCalledWith("Operation rejected: conflict");
    });

    it("handles 'cursor_move' — calls onCursorMoved", async () => {
      const onCursorMoved = vi.fn();
      const client = new CollaborationClient(
        defaultOptions({ onCursorMoved })
      );
      const ws = await connectClient(client);

      receiveMessage(ws, {
        type: "cursor_move",
        payload: { user_id: "u3", path: "/classes/Foo" },
      });

      expect(onCursorMoved).toHaveBeenCalledWith("u3", "/classes/Foo");
    });

    it("handles 'sync_response' — calls onOperationReceived for each op and updates version", async () => {
      const onOperationReceived = vi.fn();
      const client = new CollaborationClient(
        defaultOptions({ onOperationReceived })
      );
      const ws = await connectClient(client);

      const ops: Operation[] = [
        {
          id: "op-a",
          type: "add",
          path: "/a",
          timestamp: "",
          user_id: "u1",
          version: 1,
        },
        {
          id: "op-b",
          type: "add",
          path: "/b",
          timestamp: "",
          user_id: "u1",
          version: 2,
        },
      ];

      receiveMessage(ws, {
        type: "sync_response",
        payload: { operations: ops, current_version: 10 },
      });

      expect(onOperationReceived).toHaveBeenCalledTimes(2);
      expect(onOperationReceived).toHaveBeenCalledWith(ops[0]);
      expect(onOperationReceived).toHaveBeenCalledWith(ops[1]);
      expect(
        (client as unknown as { serverVersion: number }).serverVersion
      ).toBe(10);
    });

    it("handles 'error' — calls onError", async () => {
      const onError = vi.fn();
      const client = new CollaborationClient(defaultOptions({ onError }));
      const ws = await connectClient(client);

      receiveMessage(ws, {
        type: "error",
        payload: { message: "something went wrong" },
      });

      expect(onError).toHaveBeenCalledWith("something went wrong");
    });
  });

  // ---------- joinRoom / leaveRoom -----------------------------------------

  describe("joinRoom / leaveRoom", () => {
    it("sends a join message with user info", async () => {
      const client = new CollaborationClient(defaultOptions());
      const ws = await connectClient(client);

      client.joinRoom("room-1");

      expect(ws.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: "join",
          room: "room-1",
          payload: {
            user_id: "user-1",
            display_name: "Test User",
            client_type: "web",
            client_version: "1.0.0",
          },
        })
      );
    });

    it("sends a leave message and clears currentRoom", async () => {
      const client = new CollaborationClient(defaultOptions());
      const ws = await connectClient(client);

      client.joinRoom("room-1");
      ws.send.mockClear();

      client.leaveRoom("room-1");

      expect(ws.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: "leave",
          room: "room-1",
          payload: { user_id: "user-1" },
        })
      );

      expect(
        (client as unknown as { currentRoom: string | null }).currentRoom
      ).toBeNull();
    });
  });

  // ---------- sendOperation ------------------------------------------------

  describe("sendOperation", () => {
    it("attaches serverVersion, tracks in pendingOps, and sends", async () => {
      const client = new CollaborationClient(defaultOptions());
      const ws = await connectClient(client);

      // Set serverVersion to a known value
      (client as unknown as { serverVersion: number }).serverVersion = 3;

      const operation: Omit<Operation, "version"> = {
        id: "op-99",
        type: "update",
        path: "/classes/Bar",
        timestamp: "2025-06-01T00:00:00Z",
        user_id: "user-1",
      };

      client.sendOperation("room-1", operation);

      const pendingOps = (
        client as unknown as { pendingOps: Map<string, Operation> }
      ).pendingOps;
      expect(pendingOps.has("op-99")).toBe(true);
      expect(pendingOps.get("op-99")?.version).toBe(3);

      const sentPayload = JSON.parse(ws.send.mock.calls[0][0]);
      expect(sentPayload.type).toBe("operation");
      expect(sentPayload.room).toBe("room-1");
      expect(sentPayload.seq).toBe(1);
      expect(sentPayload.payload.version).toBe(3);
    });

    it("increments seq for each operation sent", async () => {
      const client = new CollaborationClient(defaultOptions());
      const ws = await connectClient(client);

      const baseOp: Omit<Operation, "version"> = {
        id: "op-a",
        type: "add",
        path: "/p",
        timestamp: "",
        user_id: "user-1",
      };

      client.sendOperation("room-1", { ...baseOp, id: "op-a" });
      client.sendOperation("room-1", { ...baseOp, id: "op-b" });

      const first = JSON.parse(ws.send.mock.calls[0][0]);
      const second = JSON.parse(ws.send.mock.calls[1][0]);
      expect(first.seq).toBe(1);
      expect(second.seq).toBe(2);
    });
  });

  // ---------- updateCursor / requestSync -----------------------------------

  describe("updateCursor", () => {
    it("sends cursor_move message", async () => {
      const client = new CollaborationClient(defaultOptions());
      const ws = await connectClient(client);

      client.updateCursor("room-1", "/classes/Baz");

      expect(ws.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: "cursor_move",
          room: "room-1",
          payload: { user_id: "user-1", path: "/classes/Baz" },
        })
      );
    });
  });

  describe("requestSync", () => {
    it("sends sync_request message with current serverVersion", async () => {
      const client = new CollaborationClient(defaultOptions());
      const ws = await connectClient(client);

      (client as unknown as { serverVersion: number }).serverVersion = 12;

      client.requestSync("room-1");

      expect(ws.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: "sync_request",
          room: "room-1",
          payload: { last_version: 12 },
        })
      );
    });
  });

  // ---------- disconnect ---------------------------------------------------

  describe("disconnect", () => {
    it("leaves the current room, closes WS, and nulls the reference", async () => {
      const client = new CollaborationClient(defaultOptions());
      const ws = await connectClient(client);

      client.joinRoom("room-1");
      ws.send.mockClear();

      client.disconnect();

      // Should have sent a leave message
      expect(ws.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"leave"')
      );
      expect(ws.close).toHaveBeenCalled();
      expect((client as unknown as { ws: WebSocket | null }).ws).toBeNull();
    });

    it("does not send leave if no room is joined", async () => {
      const client = new CollaborationClient(defaultOptions());
      const ws = await connectClient(client);

      client.disconnect();

      // Only close, no leave
      expect(ws.send).not.toHaveBeenCalled();
      expect(ws.close).toHaveBeenCalled();
    });
  });

  // ---------- isConnected --------------------------------------------------

  describe("isConnected", () => {
    it("returns true when readyState is OPEN", async () => {
      const client = new CollaborationClient(defaultOptions());
      const ws = await connectClient(client);

      ws.readyState = MockWebSocket.OPEN;
      expect(client.isConnected).toBe(true);
    });

    it("returns false when readyState is not OPEN", async () => {
      const client = new CollaborationClient(defaultOptions());
      const ws = await connectClient(client);

      ws.readyState = MockWebSocket.CLOSED;
      expect(client.isConnected).toBe(false);
    });

    it("returns false when ws is null (before connect)", () => {
      const client = new CollaborationClient(defaultOptions());
      expect(client.isConnected).toBe(false);
    });
  });

  // ---------- attemptReconnect ---------------------------------------------

  describe("attemptReconnect", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("uses exponential backoff delays", async () => {
      const client = new CollaborationClient(defaultOptions());

      // Initial connect
      await connectClient(client);

      // Trigger onclose to start reconnect cycle (attempt 1, delay = 1000ms)
      const ws1 = mockWsInstances[mockWsInstances.length - 1];
      ws1.onclose?.(new CloseEvent("close"));

      // At 999ms, no new WebSocket should have been created
      const countBefore = mockWsInstances.length;
      vi.advanceTimersByTime(999);
      expect(mockWsInstances.length).toBe(countBefore);

      // At 1000ms, a new connection attempt happens (attempt 1)
      vi.advanceTimersByTime(1);
      expect(mockWsInstances.length).toBe(countBefore + 1);

      // Don't open ws2 — trigger its close so it retries again
      // (reconnectAttempts stays at 1, increments to 2, delay = 2000ms)
      const ws2 = mockWsInstances[mockWsInstances.length - 1];
      ws2.onclose?.(new CloseEvent("close"));

      const countBefore2 = mockWsInstances.length;
      vi.advanceTimersByTime(1999);
      expect(mockWsInstances.length).toBe(countBefore2);

      vi.advanceTimersByTime(1);
      expect(mockWsInstances.length).toBe(countBefore2 + 1);
    });

    it("stops after maxReconnectAttempts (5) and calls onError", async () => {
      const onError = vi.fn();
      const client = new CollaborationClient(defaultOptions({ onError }));

      await connectClient(client);

      // Exhaust all 5 attempts
      (
        client as unknown as { reconnectAttempts: number }
      ).reconnectAttempts = 5;

      const ws = mockWsInstances[mockWsInstances.length - 1];
      ws.onclose?.(new CloseEvent("close"));

      // Should not schedule any reconnect, just call onError
      vi.advanceTimersByTime(100_000);
      expect(onError).toHaveBeenCalledWith(
        "Max reconnection attempts reached"
      );
    });

    it("re-joins currentRoom after successful reconnect", async () => {
      const client = new CollaborationClient(defaultOptions());
      const ws1 = await connectClient(client);

      client.joinRoom("my-room");
      ws1.send.mockClear();

      // Trigger close to start reconnect
      ws1.onclose?.(new CloseEvent("close"));
      vi.advanceTimersByTime(1000);

      // A new WS was created — simulate successful open
      const ws2 = mockWsInstances[mockWsInstances.length - 1];
      ws2.onopen?.(new Event("open"));

      // Allow the .then() callback to run
      await vi.advanceTimersByTimeAsync(0);

      // The client should have sent a join for the current room
      expect(ws2.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"join"')
      );
      expect(ws2.send).toHaveBeenCalledWith(
        expect.stringContaining('"room":"my-room"')
      );
    });
  });
});
