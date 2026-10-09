import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLintWebSocket, LintWebSocketManager } from '@/lib/api/lint';
import { createIndexWebSocket, IndexWebSocketManager } from '@/lib/api/indexStatus';
import { createQualityWebSocket } from '@/lib/api/quality';

class Socket {
  static OPEN = 1; static CONNECTING = 0; static CLOSED = 3;
  static instances: Socket[] = [];
  readyState = 0;
  onopen: (() => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  addEventListener(type: string, callback: () => void) { if (type === "open") this.onopen = callback; }
  close = vi.fn(() => { this.readyState = 3; });
  constructor(public url: string) { Socket.instances.push(this); }
  open() { this.readyState = 1; this.onopen?.(); }
  restart() { this.readyState = 3; this.onerror?.(Object.assign(new Event('error'), { url: this.url })); this.onclose?.({ code: 1001 } as CloseEvent); }
}
beforeEach(() => { vi.useFakeTimers(); Socket.instances = []; vi.stubGlobal('WebSocket', Socket); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('notification socket transport boundaries', () => {
  it.each([['lint', LintWebSocketManager], ['index', IndexWebSocketManager]] as const)(
    '%s stops retries on auth refusal and keeps independent clients isolated', (_name, Manager) => {
      const firstMessages = vi.fn(); const secondMessages = vi.fn();
      const first = new Manager('first', firstMessages, 'first-token');
      const second = new Manager('second', secondMessages, 'second-token');
      first.connect(); second.connect();
      const [a, b] = Socket.instances; a.open(); b.open();
      a.onerror?.(new Event('error')); a.readyState = 3;
      a.onclose?.({ code: 1008 } as CloseEvent);
      vi.advanceTimersByTime(60_000);
      expect(Socket.instances).toHaveLength(2);
      b.onmessage?.({ data: JSON.stringify({ type: 'index_complete', project_id: 'second' }) } as MessageEvent);
      expect(firstMessages).not.toHaveBeenCalled(); expect(secondMessages).toHaveBeenCalledOnce();
      first.disconnect(); second.disconnect();
    },
  );

  it.each([
    ['lint', createLintWebSocket], ['index', createIndexWebSocket], ['quality', createQualityWebSocket],
  ] as const)('%s authenticates at connect and never logs token-bearing events or malformed payloads', (_name, factory) => {
    const logs = [vi.spyOn(console, 'error'), vi.spyOn(console, 'warn'), vi.spyOn(console, 'log')];
    const token = 'sensitive+token &?';
    const ws = factory('project', vi.fn(), undefined, undefined, token);
    expect(new URL(ws.url).searchParams.get('token')).toBe(token);
    ws.onerror?.(Object.assign(new Event('error'), { url: ws.url }));
    ws.onmessage?.({ data: token } as MessageEvent);
    ws.onmessage?.({ data: JSON.stringify({ type: token }) } as MessageEvent);
    const output = logs.flatMap(log => log.mock.calls).map(call => call.map(String).join(' ')).join('\n');
    expect(output).not.toContain(token);
    expect(output).not.toContain(encodeURIComponent(token));
  });
  it.each([['lint', LintWebSocketManager], ['index', IndexWebSocketManager]] as const)(
    '%s reconnects once after restart, refreshes on open and ignores retired sockets', (_name, Manager) => {
      const message = vi.fn(); const recover = vi.fn();
      const manager = new Manager('project', message, 'token', recover);
      manager.connect(); manager.connect();
      expect(Socket.instances).toHaveLength(1);
      const first = Socket.instances[0]; first.open(); expect(recover).toHaveBeenCalledTimes(1);
      first.restart(); vi.advanceTimersByTime(1000);
      expect(Socket.instances).toHaveLength(2);
      const second = Socket.instances[1]; second.open(); expect(recover).toHaveBeenCalledTimes(2);
      expect(new URL(second.url).searchParams.get('token')).toBe('token');
      first.onmessage?.({ data: JSON.stringify({ type: 'lint_complete' }) } as MessageEvent);
      first.restart(); vi.advanceTimersByTime(1000);
      expect(message).not.toHaveBeenCalled(); expect(Socket.instances).toHaveLength(2);
      second.restart(); manager.disconnect(); vi.advanceTimersByTime(60_000);
      expect(Socket.instances).toHaveLength(2);
    },
  );
});
