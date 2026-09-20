import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCollaborationStatus } from '@/lib/hooks/useCollaborationStatus';
import { ConnectionStatus } from '@/components/ui/ConnectionStatus';

class Socket {
  static instances: Socket[] = [];
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  closed = false;
  close = vi.fn();
  // Browser close events arrive separately from the request to close.
  deliverClose() { if (!this.closed) { this.closed = true; this.onclose?.(); } }
  constructor(public url: string) { Socket.instances.push(this); }
}
const latest = () => Socket.instances.at(-1)!;
beforeEach(() => { vi.useFakeTimers(); Socket.instances = []; vi.stubGlobal('WebSocket', Socket); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('collaboration socket lifecycle', () => {
  it('ignores obsolete socket events after replacing credentials', () => {
    const { result, rerender } = renderHook(({ token }) => useCollaborationStatus({ projectId: 'project', token }), { initialProps: { token: 'first' } });
    act(() => vi.advanceTimersByTime(100));
    const previous = latest();
    rerender({ token: 'second' });
    act(() => vi.advanceTimersByTime(100));
    const current = latest();
    act(() => previous.onopen?.());
    expect(result.current.status).toBe('connecting');
    act(() => current.onopen?.());
    act(() => previous.deliverClose());
    expect(result.current.isConnected).toBe(true);
    act(() => vi.advanceTimersByTime(60000));
    expect(Socket.instances).toHaveLength(2);
    expect(current.close).not.toHaveBeenCalled();
  });

  it('updates the real status indicator through disconnect and manual reconnection', () => {
    function Consumer() {
      const connection = useCollaborationStatus({ projectId: 'project' });
      return <><ConnectionStatus state={connection.status} endpoint={connection.endpoint} purpose={connection.purpose} showLabel /><button onClick={connection.reconnect}>Reconnect</button></>;
    }
    render(<Consumer />);
    expect(screen.getByText('Disconnected')).toBeDefined();
    act(() => vi.advanceTimersByTime(100));
    expect(screen.getByText('Connecting')).toBeDefined();
    act(() => latest().onopen?.());
    expect(screen.getByText('Connected')).toBeDefined();
    act(() => latest().deliverClose());
    fireEvent.click(screen.getByRole('button', { name: 'Reconnect' }));
    act(() => latest().onopen?.());
    expect(screen.getByText('Connected')).toBeDefined();
    expect(screen.getByTitle(/Endpoint: \/api\/v1\/projects\/project\/lint\/ws/)).toBeDefined();
    act(() => vi.advanceTimersByTime(60000));
    expect(Socket.instances).toHaveLength(2);
    expect(screen.getByText('Connected')).toBeDefined();
  });
  it('uses the real URL resolver and safely encodes credentials', () => {
    vi.stubEnv('NEXT_PUBLIC_WS_URL', 'wss://socket.example.test');
    const { result } = renderHook(() => useCollaborationStatus({ projectId: 'project', token: 'a+b &c?' }));
    act(() => vi.advanceTimersByTime(100));
    expect(latest().url).toBe('wss://socket.example.test/api/v1/projects/project/lint/ws?token=a%2Bb%20%26c%3F');
    act(() => latest().onopen?.());
    expect(result.current.isConnected).toBe(true);
  });

  it('retries five times with exponential delays and stops after exhaustion', () => {
    const { result } = renderHook(() => useCollaborationStatus({ projectId: 'project' }));
    act(() => vi.advanceTimersByTime(100));
    for (const [index, delay] of [1000, 2000, 4000, 8000, 16000].entries()) {
      act(() => latest().deliverClose());
      expect(result.current.status).toBe('disconnected');
      act(() => vi.advanceTimersByTime(delay - 1));
      expect(Socket.instances).toHaveLength(index + 1);
      act(() => vi.advanceTimersByTime(1));
      expect(Socket.instances).toHaveLength(index + 2);
    }
    act(() => latest().deliverClose());
    act(() => vi.advanceTimersByTime(60000));
    expect(Socket.instances).toHaveLength(6);
  });

  it('resets retry delay after a successful connection', () => {
    renderHook(() => useCollaborationStatus({ projectId: 'project' }));
    act(() => vi.advanceTimersByTime(100));
    act(() => latest().deliverClose());
    act(() => vi.advanceTimersByTime(1000));
    act(() => latest().onopen?.());
    act(() => latest().deliverClose());
    act(() => vi.advanceTimersByTime(1000));
    expect(Socket.instances).toHaveLength(3);
  });

  it('cancels pending reconnect on disable and uses fresh credentials when re-enabled', () => {
    const { result, rerender } = renderHook(({ enabled, token }) => useCollaborationStatus({ projectId: 'project', enabled, token }), { initialProps: { enabled: true, token: 'first' } });
    act(() => vi.advanceTimersByTime(100));
    act(() => latest().deliverClose());
    rerender({ enabled: false, token: 'first' });
    act(() => vi.advanceTimersByTime(5000));
    expect(Socket.instances).toHaveLength(1);
    expect(result.current.status).toBe('disconnected');
    rerender({ enabled: true, token: 'second' });
    act(() => vi.advanceTimersByTime(100));
    expect(latest().url).toContain('token=second');
  });

  it('closes an active socket on disable and permits fresh credentials after delayed closure', () => {
    const { result, rerender } = renderHook(({ enabled, token }) => useCollaborationStatus({ projectId: 'project', enabled, token }), { initialProps: { enabled: true, token: 'first' } });
    act(() => vi.advanceTimersByTime(100));
    const previous = latest();
    act(() => previous.onopen?.());
    expect(result.current.isConnected).toBe(true);

    rerender({ enabled: false, token: 'first' });
    expect(previous.close).toHaveBeenCalledOnce();
    expect(previous.closed).toBe(false);
    expect(result.current.status).toBe('disconnected');
    act(() => previous.deliverClose());
    act(() => vi.advanceTimersByTime(60000));
    expect(Socket.instances).toHaveLength(1);

    rerender({ enabled: true, token: 'second' });
    act(() => vi.advanceTimersByTime(100));
    expect(Socket.instances).toHaveLength(2);
    expect(latest().url).toContain('token=second');
    act(() => latest().onopen?.());
    expect(result.current.isConnected).toBe(true);
  });

  it('does not reconnect when an active socket closes after consumer unmount', () => {
    const { unmount } = renderHook(() => useCollaborationStatus({ projectId: 'project' }));
    act(() => vi.advanceTimersByTime(100));
    const previous = latest();
    act(() => previous.onopen?.());
    unmount();
    expect(previous.close).toHaveBeenCalledOnce();
    expect(previous.closed).toBe(false);
    act(() => previous.deliverClose());
    act(() => vi.advanceTimersByTime(60000));
    expect(Socket.instances).toHaveLength(1);
  });

  it('ignores malformed messages and transport error callbacks without corrupting connected state', () => {
    const { result } = renderHook(() => useCollaborationStatus({ projectId: 'project' }));
    act(() => vi.advanceTimersByTime(100));
    act(() => latest().onopen?.());
    act(() => { latest().onmessage?.({ data: '{invalid' }); latest().onerror?.(); });
    expect(result.current.status).toBe('connected');
    act(() => latest().onmessage?.({ data: JSON.stringify({ type: 'lint_complete' }) }));
    expect(result.current.isConnected).toBe(true);
  });

  it('reports disconnected when socket construction throws and permits manual retry', () => {
    vi.stubGlobal('WebSocket', class { constructor() { throw new Error('transport unavailable'); } });
    const { result } = renderHook(() => useCollaborationStatus({ projectId: 'project' }));
    act(() => vi.advanceTimersByTime(100));
    expect(result.current.status).toBe('disconnected');
    vi.stubGlobal('WebSocket', Socket);
    act(() => result.current.reconnect());
    expect(result.current.status).toBe('connecting');
    act(() => latest().onopen?.());
    expect(result.current.isConnected).toBe(true);
  });

  it('cancels pending reconnect when the consumer unmounts', () => {
    const { unmount } = renderHook(() => useCollaborationStatus({ projectId: 'project' }));
    act(() => vi.advanceTimersByTime(100));
    act(() => latest().deliverClose());
    unmount();
    act(() => vi.advanceTimersByTime(60000));
    expect(Socket.instances).toHaveLength(1);
  });
});
