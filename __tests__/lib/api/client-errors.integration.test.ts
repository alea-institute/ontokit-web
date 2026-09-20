import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError, getApiErrorMessage, getSourceRevisionConflict, projectOntologyApi } from '@/lib/api/client';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
const conflict = { code: 'SOURCE_REVISION_CONFLICT', message: 'Reload before saving', base_revision: 'old', current_revision: 'new', branch: 'feature/topic' };
const save = () => projectOntologyApi.saveSource('project', ':Person a owl:Class .', 'Edit Person', 'synthetic-token', 'feature/topic', 'old');

describe('HTTP error contracts through the real domain and transport client', () => {
  it('preserves complete conflict metadata from source save through the caller-facing helpers', async () => {
    const fetcher = vi.fn(async () => Response.json({ detail: conflict }, { status: 409 })); vi.stubGlobal('fetch', fetcher);
    const error = await save().catch((value: unknown) => value);
    expect(error).toBeInstanceOf(ApiError); expect(getSourceRevisionConflict(error)).toEqual(conflict);
    expect(getApiErrorMessage(error, 'Fallback')).toBe('Reload before saving');
    const call = vi.mocked(fetch).mock.calls[0];
    expect(new URL(String(call[0])).searchParams.get('branch')).toBe('feature/topic');
    expect(JSON.parse(String(call[1]?.body))).toEqual({ content: ':Person a owl:Class .', commit_message: 'Edit Person', base_revision: 'old' });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it.each(Object.keys(conflict))('rejects incomplete conflict metadata missing %s', async missing => {
    const detail: Record<string, unknown> = { ...conflict }; delete detail[missing];
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ detail }, { status: 409 })));
    const error = await save().catch((value: unknown) => value);
    expect(error).toBeInstanceOf(ApiError); expect(getSourceRevisionConflict(error)).toBeNull();
  });

  it.each([null, 'Concurrent edit', { code: 'DIFFERENT_CONFLICT', message: 123 }])('does not promote untyped server details to a source conflict: %j', async detail => {
    const body = JSON.stringify({ detail }); vi.stubGlobal('fetch', vi.fn(async () => new Response(body, { status: 409 })));
    const error = await save().catch((value: unknown) => value);
    expect(getSourceRevisionConflict(error)).toBeNull();
    expect(getApiErrorMessage(error, 'Fallback')).toBe(typeof detail === 'string' ? detail : body);
  });

  it.each([['Forbidden', 'Forbidden'], ['', 'Request failed']])('uses HTTP status text when a server sends no error body: %s', async (statusText, expected) => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 403, statusText })));
    const error = await save().catch((value: unknown) => value); expect(getApiErrorMessage(error, 'Fallback')).toBe(expected);
  });

  it('uses caller fallback when a network Error has no message', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error(''); }));
    const error = await save().catch((value: unknown) => value); expect(getApiErrorMessage(error, 'Cannot save offline')).toBe('Cannot save offline');
    expect(getSourceRevisionConflict(error)).toBeNull();
  });

  it('forwards an already-aborted signal without losing cancellation or leaking listeners', async () => {
    const controller = new AbortController(); controller.abort();
    const add = vi.spyOn(controller.signal, 'addEventListener');
    const fetcher = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => { init?.signal?.throwIfAborted(); return Response.json({}); });
    vi.stubGlobal('fetch', fetcher);
    await expect(api.get('/api/v1/projects/project', { signal: controller.signal })).rejects.toHaveProperty('name', 'AbortError');
    expect(fetcher).toHaveBeenCalledOnce(); expect(add).not.toHaveBeenCalled();
  });

  it('uploads multipart data with defined query values and leaves the boundary to the browser', async () => {
    const fetcher = vi.fn(async () => Response.json({ accepted: true })); vi.stubGlobal('fetch', fetcher);
    const data = new FormData(); data.set('file', new File([':Person a owl:Class .'], 'ontology.ttl'));
    expect(await api.upload('/api/v1/import', data, { params: { branch: 'feature/a b', dry_run: false, skip: undefined }, headers: { 'Content-Type': 'incorrect/manual', Authorization: 'Bearer synthetic' } })).toEqual({ accepted: true });
    const call = vi.mocked(fetch).mock.calls[0]; const url = new URL(String(call[0]));
    expect([...url.searchParams.entries()]).toEqual([['branch', 'feature/a b'], ['dry_run', 'false']]);
    expect(new Headers(call[1]?.headers).has('Content-Type')).toBe(false); expect(call[1]?.body).toBe(data);
  });

  it('cancels an in-flight request and removes the caller abort listener without retrying', async () => {
    const controller = new AbortController();
    const remove = vi.spyOn(controller.signal, 'removeEventListener');
    let transportSignal: AbortSignal | undefined;
    const fetcher = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      transportSignal = init?.signal ?? undefined;
      transportSignal?.addEventListener('abort', () => reject(transportSignal?.reason), { once: true });
    }));
    vi.stubGlobal('fetch', fetcher);
    const request = api.get('/api/v1/projects/project', { signal: controller.signal });
    const rejected = expect(request).rejects.toHaveProperty('name', 'AbortError');
    expect(transportSignal?.aborted).toBe(false);
    controller.abort();
    await rejected;
    expect(transportSignal?.aborted).toBe(true);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
  });

  it.each(['headers', 'body'] as const)('enforces the deadline while waiting for %s and leaves the next request usable', async phase => {
    vi.useFakeTimers();
    const caller = new AbortController();
    const remove = vi.spyOn(caller.signal, 'removeEventListener');
    const signals: AbortSignal[] = [];
    const fetcher = vi.fn((_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const signal = init!.signal!;
      signals.push(signal);
      if (signals.length > 1) return Promise.resolve(Response.json({ commit_hash: 'saved-after-timeout' }));
      if (phase === 'headers') return new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), { once: true });
      });
      const body = new ReadableStream({
        start(stream) { signal.addEventListener('abort', () => stream.error(signal.reason), { once: true }); },
      });
      return Promise.resolve(new Response(body, { headers: { 'Content-Type': 'application/json' } }));
    });
    vi.stubGlobal('fetch', fetcher);
    let settled = false;
    const request = api.get('/api/v1/projects/project', { signal: caller.signal });
    void request.then(() => { settled = true; }, () => { settled = true; });
    const rejected = expect(request).rejects.toHaveProperty('name', 'AbortError');
    await vi.advanceTimersByTimeAsync(29999);
    expect(settled).toBe(false);
    expect(signals[0].aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await rejected;
    expect(signals[0].aborted).toBe(true);
    expect(caller.signal.aborted).toBe(false);
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    await expect(save()).resolves.toMatchObject({ commit_hash: 'saved-after-timeout' });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(signals[1]).not.toBe(signals[0]);
    expect(new Headers(fetcher.mock.calls[1][1]?.headers).get('Authorization')).toBe('Bearer synthetic-token');
    await vi.advanceTimersByTimeAsync(30000);
    expect(signals[1].aborted).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('detaches cancellation after success so a later caller abort cannot reach the completed transport', async () => {
    const controller = new AbortController();
    let transportSignal: AbortSignal | undefined;
    vi.stubGlobal('fetch', vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      transportSignal = init?.signal ?? undefined;
      return Response.json({ id: 'project' });
    }));
    await expect(api.get('/api/v1/projects/project', { signal: controller.signal })).resolves.toEqual({ id: 'project' });
    expect(transportSignal).toBeInstanceOf(AbortSignal);
    controller.abort();
    expect(controller.signal.aborted).toBe(true);
    expect(transportSignal?.aborted).toBe(false);
  });
});
