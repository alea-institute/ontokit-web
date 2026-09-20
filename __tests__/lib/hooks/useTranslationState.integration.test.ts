import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useTranslationState } from '@/lib/hooks/useTranslationState';
import type { TranslationEntityStateItem } from '@/lib/api/translations';
import { jsonResponse, llmHookHarness } from '../../fixtures/llm-hook-harness';

const iri = 'http://example.org/Person#Name';
const item = (state: TranslationEntityStateItem['state'], value: string | null, predicate = 'skos:definition'): TranslationEntityStateItem => ({ predicate, language: 'fr', state, value, record_id: value === null ? null : 'record-1' });
function setup() {
  let items: TranslationEntityStateItem[] = [];
  let postStatus = 200;
  const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    if (init?.method === 'POST') return jsonResponse(postStatus === 200 ? { job_id: 'job' } : { detail: 'Translation unavailable' }, postStatus);
    return jsonResponse({ entity_iri: url.searchParams.get('entity_iri'), branch: url.searchParams.get('branch'), items });
  });
  vi.stubGlobal('fetch', fetcher);
  const { wrapper, client } = llmHookHarness();
  const hook = renderHook(({ entity, branch, token }: { entity: string | null; branch: string; token?: string }) => useTranslationState('project', entity, branch, token), { wrapper, initialProps: { entity: iri, branch: 'main', token: 'token' } });
  return { ...hook, client, fetcher, setItems: (next: TranslationEntityStateItem[]) => { items = next; }, failPost: () => { postStatus = 403; } };
}
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('translation state through the HTTP client and query cache', () => {
  it.each(['verified', 'provisional', 'empty'] as const)('stops server-initiated polling and cancels its timeout when the result becomes %s', async state => {
    const { result, fetcher, setItems } = setup();
    await waitFor(() => expect(result.current.state?.items).toEqual([]));
    vi.useFakeTimers();
    setItems([item('pending', null)]);
    await act(() => result.current.refetch());
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(result.current.state?.items[0].state).toBe('pending');
    const before = fetcher.mock.calls.length;
    setItems(state === 'empty' ? [] : [item(state, 'Une personne')]);
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(result.current.state?.items).toEqual(state === 'empty' ? [] : [item(state, 'Une personne')]);
    expect(fetcher).toHaveBeenCalledTimes(before + 1);
    await act(async () => { await vi.advanceTimersByTimeAsync(5 * 60_000); });
    expect(fetcher).toHaveBeenCalledTimes(before + 1);
    expect(fetcher.mock.calls.every(([, init]) => init?.method === 'GET')).toBe(true);
    expect(result.current.pendingNotice).toBeNull();
    expect(result.current.isTranslationPending).toBe(false);
  });

  it('encodes the entity and branch and completes a request from a real refetch', async () => {
    const { result, fetcher, setItems } = setup();
    await waitFor(() => expect(result.current.state?.items).toEqual([]));
    const url = new URL(String(fetcher.mock.calls[0][0]));
    expect(url.searchParams.get('entity_iri')).toBe(iri);
    expect(url.searchParams.get('branch')).toBe('main');
    await act(() => result.current.translateField('skos:definition'));
    expect(result.current.isTranslationPending).toBe(true);
    const post = fetcher.mock.calls.find(([, init]) => init?.method === 'POST')!;
    expect(JSON.parse(String(post[1]?.body))).toEqual({ entity_iri: iri, predicate: 'skos:definition', branch: 'main' });
    expect(new Headers(post[1]?.headers).get('Authorization')).toBe('Bearer token');
    setItems([item('verified', 'Une personne')]);
    await act(() => result.current.refetch());
    await waitFor(() => expect(result.current.isTranslationPending).toBe(false));
    expect(result.current.state?.items[0].value).toBe('Une personne');
    expect(result.current.pendingNotice).toBeNull();
  });

  it.each([
    ['missing', null, 'skos:definition'],
    ['provisional', null, 'skos:definition'],
    ['verified', 'An example', 'skos:example'],
  ] as const)('does not resolve the request with %s state for %s on %s', async (state, value, predicate) => {
    const { result, setItems } = setup();
    await waitFor(() => expect(result.current.state).toBeDefined());
    await act(() => result.current.translateField('skos:definition'));
    setItems([item(state, value, predicate)]);
    await act(() => result.current.refetch());
    expect(result.current.isTranslationPending).toBe(true);
    act(() => result.current.resetTranslation());
    expect(result.current.isTranslationPending).toBe(false);
  });

  it('accepts a non-null empty provisional value as a completed result', async () => {
    const { result, setItems } = setup();
    await waitFor(() => expect(result.current.state).toBeDefined());
    await act(() => result.current.translateField('skos:example'));
    setItems([item('provisional', '', 'skos:example')]);
    await act(() => result.current.refetch());
    await waitFor(() => expect(result.current.isTranslationPending).toBe(false));
  });

  it('surfaces a rejected request without retry and clears its mutation error on reset', async () => {
    const { result, fetcher, failPost } = setup();
    await waitFor(() => expect(result.current.state).toBeDefined());
    failPost();
    await act(async () => { await expect(result.current.translateField('skos:example')).rejects.toThrow(); });
    await waitFor(() => expect(result.current.translateError).toBeInstanceOf(Error));
    expect(fetcher.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1);
    expect(result.current.isTranslationPending).toBe(false);
    act(() => result.current.resetTranslation());
    await waitFor(() => expect(result.current.translateError).toBeNull());
  });

  it('isolates pending work when the selected branch or entity changes', async () => {
    const { result, rerender } = setup();
    await waitFor(() => expect(result.current.state).toBeDefined());
    await act(() => result.current.translateField('skos:definition'));
    rerender({ entity: 'http://example.org/Other', branch: 'review/one', token: 'second-token' });
    await waitFor(() => expect(result.current.state?.branch).toBe('review/one'));
    expect(result.current.state?.entity_iri).toBe('http://example.org/Other');
    expect(result.current.isTranslationPending).toBe(false);
    expect(result.current.pendingNotice).toBeNull();
  });

  it('does not fetch when the entity or credentials are absent', async () => {
    const { wrapper } = llmHookHarness();
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    const { result, rerender } = renderHook(({ entity, token }: { entity: string | null; token?: string }) => useTranslationState('project', entity, 'main', token), { wrapper, initialProps: { entity: null as string | null, token: 'token' as string | undefined } });
    expect(result.current.isLoading).toBe(false);
    rerender({ entity: iri, token: undefined });
    await act(async () => {});
    expect(fetcher).not.toHaveBeenCalled();
  });
});
