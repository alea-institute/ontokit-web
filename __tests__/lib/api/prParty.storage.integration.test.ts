import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse } from '../../fixtures/llm-hook-harness';

const input = { action_kind: 'review' as const, verdict: 'approve' as const, head_sha: 'reviewed-head', body: 'Reviewed changes' };
function transport() {
  const fetcher = vi.fn()
    .mockResolvedValueOnce(jsonResponse({ detail: 'Outcome unknown' }, 503))
    .mockImplementation(async () => jsonResponse({ action: { status: 'recorded' }, card: { card_id: 'storage-card' } }));
  vi.stubGlobal('fetch', fetcher);
  return fetcher;
}
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); sessionStorage.clear(); vi.resetModules(); });

describe('review attempt replay through real API, hashing and browser storage', () => {
  it('retains replay protection in memory when accessing sessionStorage is forbidden', async () => {
    vi.resetModules();
    const { prPartyApi, IDEMPOTENCY_KEY_PATTERN } = await import('@/lib/api/prParty');
    vi.spyOn(window, 'sessionStorage', 'get').mockImplementation(() => { throw new DOMException('Storage forbidden', 'SecurityError'); });
    const fetcher = transport();
    await expect(prPartyApi.submitAction('restricted-storage', input, 'token')).rejects.toMatchObject({ status: 503 });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const first = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(first).toMatchObject(input);
    expect(first.idempotency_key).toMatch(IDEMPOTENCY_KEY_PATTERN);
    await expect(prPartyApi.submitAction('restricted-storage', input, 'token')).resolves.toMatchObject({ action: { status: 'recorded' } });
    expect(JSON.parse(fetcher.mock.calls[1][1].body).idempotency_key).toBe(first.idempotency_key);
    await prPartyApi.submitAction('restricted-storage', input, 'token');
    expect(JSON.parse(fetcher.mock.calls[2][1].body).idempotency_key).not.toBe(first.idempotency_key);
    for (const [url, init] of fetcher.mock.calls) {
      expect(new URL(url).pathname).toBe('/api/v1/pr-party/cards/restricted-storage/actions');
      expect(init.method).toBe('POST');
      expect(new Headers(init.headers).get('Authorization')).toBe('Bearer token');
    }
  });

  it('reuses a timed-out review attempt on explicit retry without automatically repeating the mutation', async () => {
    vi.resetModules();
    const { prPartyApi } = await import('@/lib/api/prParty');
    vi.useFakeTimers();
    const signals: AbortSignal[] = [];
    const fetcher = vi.fn((_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const signal = init!.signal!;
      signals.push(signal);
      if (signals.length > 1) return Promise.resolve(jsonResponse({ action: { status: 'recorded' }, card: { card_id: 'timeout-card' } }));
      return new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), { once: true });
      });
    });
    vi.stubGlobal('fetch', fetcher);
    const persist = vi.spyOn(sessionStorage, 'setItem');
    const request = prPartyApi.submitAction('timeout-card', input, 'token');
    const rejected = expect(request).rejects.toHaveProperty('name', 'AbortError');
    // Fingerprinting uses real asynchronous Web Crypto before starting the HTTP deadline.
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    const firstKey = JSON.parse(String(fetcher.mock.calls[0][1]?.body)).idempotency_key;
    const pendingEntry = persist.mock.calls.find(([, value]) => value === firstKey)!;
    await vi.advanceTimersByTimeAsync(30000);
    await rejected;
    expect(signals[0].aborted).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(pendingEntry[0])).toBe(firstKey);
    await prPartyApi.submitAction('timeout-card', input, 'token');
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(fetcher.mock.calls[1][1]?.body)).idempotency_key).toBe(firstKey);
    expect(signals[1].aborted).toBe(false);
    expect(sessionStorage.getItem(pendingEntry[0])).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('restores an uncertain attempt after the API module reloads and clears it on success', async () => {
    vi.resetModules();
    const { prPartyApi } = await import('@/lib/api/prParty');
    const fetcher = transport();
    const persist = vi.spyOn(sessionStorage, 'setItem');
    await expect(prPartyApi.submitAction('reloaded-storage', input, 'token')).rejects.toMatchObject({ status: 503 });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const firstKey = JSON.parse(fetcher.mock.calls[0][1].body).idempotency_key;
    const pendingEntry = persist.mock.calls.find(([, value]) => value === firstKey);
    expect(pendingEntry).toBeDefined();
    expect(sessionStorage.getItem(pendingEntry![0])).toBe(firstKey);
    vi.resetModules();
    const reloaded = await import('@/lib/api/prParty');
    await reloaded.prPartyApi.submitAction('reloaded-storage', input, 'fresh-token');
    expect(JSON.parse(fetcher.mock.calls[1][1].body).idempotency_key).toBe(firstKey);
    expect(new Headers(fetcher.mock.calls[1][1].headers).get('Authorization')).toBe('Bearer fresh-token');
    expect(sessionStorage.getItem(pendingEntry![0])).toBeNull();
    await reloaded.prPartyApi.submitAction('reloaded-storage', input, 'fresh-token');
    expect(JSON.parse(fetcher.mock.calls[2][1].body).idempotency_key).not.toBe(firstKey);
  });
});
