import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCollaborationStatus } from "@/lib/hooks/useCollaborationStatus";

// Mock WebSocket
class MockWebSocket {
  static instances: MockWebSocket[] = [];
  url: string;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  close = vi.fn(() => {
    this.onclose?.();
  });

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  MockWebSocket.instances = [];
  vi.stubGlobal("WebSocket", MockWebSocket);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("useCollaborationStatus", () => {
  it("returns disconnected status when not enabled", () => {
    const { result } = renderHook(() =>
      useCollaborationStatus({ projectId: "proj-1", enabled: false }),
    );

    expect(result.current.status).toBe("disconnected");
    expect(result.current.isConnected).toBe(false);
  });

  it("returns the correct endpoint path", () => {
    const { result } = renderHook(() =>
      useCollaborationStatus({ projectId: "proj-1", enabled: false }),
    );

    expect(result.current.endpoint).toBe("/api/v1/projects/proj-1/lint/ws");
  });

  it("returns the purpose description", () => {
    const { result } = renderHook(() =>
      useCollaborationStatus({ projectId: "proj-1", enabled: false }),
    );

    expect(result.current.purpose).toBe("Real-time lint status updates");
  });

  it("constructs correct WebSocket URL", () => {
    renderHook(() =>
      useCollaborationStatus({ projectId: "proj-1", enabled: true }),
    );

    // The hook has a 100ms delay before connecting
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(MockWebSocket.instances.length).toBeGreaterThan(0);
    const ws = MockWebSocket.instances[MockWebSocket.instances.length - 1];
    expect(ws.url).toBe("ws://localhost:8000/api/v1/projects/proj-1/lint/ws");
  });

  it("transitions to connecting then connected on open", () => {
    const { result } = renderHook(() =>
      useCollaborationStatus({ projectId: "proj-1", enabled: true }),
    );

    act(() => {
      vi.advanceTimersByTime(100);
    });

    // Should be connecting after timer
    expect(result.current.status).toBe("connecting");

    const ws = MockWebSocket.instances[MockWebSocket.instances.length - 1];
    act(() => {
      ws.onopen?.();
    });

    expect(result.current.status).toBe("connected");
    expect(result.current.isConnected).toBe(true);
  });

  it("transitions to disconnected on close", () => {
    const { result } = renderHook(() =>
      useCollaborationStatus({ projectId: "proj-1", enabled: true }),
    );

    act(() => {
      vi.advanceTimersByTime(100);
    });

    const ws = MockWebSocket.instances[MockWebSocket.instances.length - 1];
    act(() => {
      ws.onopen?.();
    });
    expect(result.current.status).toBe("connected");

    // Simulate a close (not initiated by disconnect())
    act(() => {
      ws.onclose?.();
    });

    expect(result.current.status).toBe("disconnected");
  });

  it("cleans up WebSocket on unmount", () => {
    const { unmount } = renderHook(() =>
      useCollaborationStatus({ projectId: "proj-1", enabled: true }),
    );

    act(() => {
      vi.advanceTimersByTime(100);
    });

    const ws = MockWebSocket.instances[MockWebSocket.instances.length - 1];
    act(() => {
      ws.onopen?.();
    });

    unmount();

    expect(ws.close).toHaveBeenCalled();
  });

  it("does not create WebSocket when projectId is empty", () => {
    renderHook(() =>
      useCollaborationStatus({ projectId: "", enabled: true }),
    );

    act(() => {
      vi.advanceTimersByTime(200);
    });

    // No WebSocket should have been created (or only from cleanup)
    const connectedInstances = MockWebSocket.instances.filter(
      (ws) => ws.url.includes("/lint/ws"),
    );
    expect(connectedInstances).toHaveLength(0);
  });
});
