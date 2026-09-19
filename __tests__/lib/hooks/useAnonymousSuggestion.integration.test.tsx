import { StrictMode } from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAnonymousSuggestion } from '@/lib/hooks/useAnonymousSuggestion';
import { ANONYMOUS_TOKEN_TTL_MS, useAnonymousTokenStore } from '@/lib/stores/anonymousCreditStore';
import { jsonResponse } from '../../fixtures/llm-hook-harness';

function setup(options: { createdAt?: string; strict?: boolean } = {}) {
  let failure = '';
  const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const path = new URL(String(input)).pathname;
    if (failure && path.endsWith(failure)) return jsonResponse({ detail: 'Session forbidden' }, 403);
    if (path.endsWith('/save')) return jsonResponse({ commit_hash: 'abc', branch: 'anonymous/one', changes_count: 2 });
    if (path.endsWith('/submit')) return jsonResponse({ pr_number: 12, pr_url: null, status: 'submitted' });
    if (path.endsWith('/discard')) return new Response(null, { status: 204 });
    expect(init?.method).toBe('POST');
    return jsonResponse({ session_id: 'session', branch: 'anonymous/one', created_at: options.createdAt ?? new Date().toISOString(), anonymous_token: 'synthetic-anonymous-token' });
  });
  vi.stubGlobal('fetch', fetcher);
  const onSubmitted = vi.fn(); const onError = vi.fn();
  return { fetcher, onSubmitted, onError, fail: (suffix: string) => { failure = suffix; }, ...renderHook(() => useAnonymousSuggestion({ projectId: 'project', onSubmitted, onError }), options.strict ? { wrapper: StrictMode } : undefined) };
}
beforeEach(() => { useAnonymousTokenStore.setState({ tokens: {} }); sessionStorage.clear(); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); useAnonymousTokenStore.setState({ tokens: {} }); });

describe('anonymous suggestion API and persisted session integration', () => {
  it('uses the local clock for an invalid server timestamp and expires the persisted token after 24 hours', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-19T12:00:00Z'));
    const { result } = setup({ createdAt: 'invalid timestamp' });
    await act(() => result.current.startSession());
    expect(useAnonymousTokenStore.getState().getToken('project')).toMatchObject({ issuedAt: Date.now(), expiresAt: Date.now() + ANONYMOUS_TOKEN_TTL_MS });
    vi.setSystemTime(Date.now() + ANONYMOUS_TOKEN_TTL_MS);
    act(() => { expect(useAnonymousTokenStore.getState().getToken('project')).toBeNull(); });
    expect(useAnonymousTokenStore.getState().tokens).toEqual({});
  });

  it('preserves the authoritative server issue time instead of extending a token on receipt', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-19T12:00:00Z'));
    const issuedAt = Date.now() - 60 * 60 * 1000;
    const { result } = setup({ createdAt: new Date(issuedAt).toISOString() });
    await act(() => result.current.startSession());
    expect(useAnonymousTokenStore.getState().getToken('project')).toMatchObject({ issuedAt, expiresAt: issuedAt + ANONYMOUS_TOKEN_TTL_MS });
  });

  it('restores a persisted session under Strict Mode and saves with its existing credential', async () => {
    useAnonymousTokenStore.getState().setToken('project', 'restored-fixture-token', 'restored-session', 'anonymous/restored', Date.now());
    const { result, fetcher } = setup({ strict: true });
    expect(result.current.branch).toBe('anonymous/restored');
    await act(() => result.current.startSession());
    expect(fetcher).not.toHaveBeenCalled();
    await act(() => result.current.saveToSession('content', 'iri', 'Entity'));
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0];
    expect(String(url)).toContain('/restored-session/save');
    expect(new Headers(init?.headers).get('X-Anonymous-Token')).toBe('restored-fixture-token');
  });

  it('starts, saves and submits using anonymous headers and clears the persisted session', async () => {
    const { result, fetcher, onSubmitted } = setup();
    await act(async () => { expect(await result.current.startSession()).toBe('anonymous/one'); });
    expect(useAnonymousTokenStore.getState().getToken('project')?.sessionId).toBe('session');
    await act(async () => { expect(await result.current.saveToSession('@prefix : <http://example.org/> .', 'http://example.org/Person', 'Person')).toBe(true); });
    expect(result.current.changesCount).toBe(2);
    expect(result.current.entitiesModified).toEqual(['Person']);
    const save = fetcher.mock.calls.find(([input]) => String(input).endsWith('/save'))!;
    expect(JSON.parse(String(save[1]?.body))).toMatchObject({ entity_iri: 'http://example.org/Person', entity_label: 'Person' });
    expect(new Headers(save[1]?.headers).get('X-Anonymous-Token')).toBe('synthetic-anonymous-token');
    expect(new Headers(save[1]?.headers).has('Authorization')).toBe(false);
    await act(() => result.current.submitSession('Improved label', 'Test Contributor', undefined, 'honeypot-value'));
    const submit = fetcher.mock.calls.find(([input]) => String(input).endsWith('/submit'))!;
    expect(JSON.parse(String(submit[1]?.body))).toEqual({ summary: 'Improved label', submitter_name: 'Test Contributor', website: 'honeypot-value' });
    expect(onSubmitted).toHaveBeenCalledExactlyOnceWith(12, null);
    expect(result.current.status).toBe('submitted');
    expect(result.current.sessionId).toBeNull();
    expect(useAnonymousTokenStore.getState().getToken('project')).toBeNull();
  });

  it('restores a live session on remount and avoids a second creation request', async () => {
    const first = setup();
    await act(() => first.result.current.startSession());
    first.unmount();
    const next = setup();
    expect(next.result.current.branch).toBe('anonymous/one');
    await act(() => next.result.current.startSession());
    expect(next.fetcher).not.toHaveBeenCalled();
    await act(() => next.result.current.saveToSession('content', 'iri', 'Person'));
    expect(next.fetcher).toHaveBeenCalledTimes(1);
  });

  it('coalesces concurrent session starts and de-duplicates modified entity labels', async () => {
    const { result, fetcher } = setup();
    await act(async () => { expect(await Promise.all([result.current.startSession(), result.current.startSession()])).toEqual(['anonymous/one', 'anonymous/one']); });
    expect(fetcher).toHaveBeenCalledTimes(1);
    await act(() => result.current.saveToSession('first', 'iri', 'Person'));
    await act(() => result.current.saveToSession('second', 'iri', 'Person'));
    expect(result.current.entitiesModified).toEqual(['Person']);
  });

  it('returns failure without sending requests when no session exists', async () => {
    const { result, fetcher } = setup();
    await act(async () => { expect(await result.current.saveToSession('content', 'iri', 'label')).toBe(false); await result.current.submitSession(); await result.current.discardSession(); });
    expect(fetcher).not.toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
  });

  it('reports creation rejection and permits a subsequent successful start', async () => {
    const { result, fail, onError } = setup();
    fail('/sessions');
    await act(async () => { expect(await result.current.startSession()).toBeNull(); });
    expect(result.current.status).toBe('error');
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('Session forbidden'));
    expect(useAnonymousTokenStore.getState().getToken('project')).toBeNull();
    fail('');
    await act(() => result.current.startSession());
    expect(result.current.isActive).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it.each(['save', 'submit'] as const)('retains session credentials after %s fails so the operation can be retried', async operation => {
    const { result, fail, onError } = setup();
    await act(() => result.current.startSession());
    fail(`/${operation}`);
    await act(async () => { if (operation === 'save') expect(await result.current.saveToSession('content', 'iri', 'label')).toBe(false); else await result.current.submitSession(); });
    expect(result.current.status).toBe('error');
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('Session forbidden'));
    expect(useAnonymousTokenStore.getState().getToken('project')?.sessionId).toBe('session');
  });

  it.each([false, true])('clears local session after best-effort discard (HTTP failure: %s)', async fails => {
    const { result, fail } = setup();
    await act(() => result.current.startSession());
    if (fails) fail('/discard');
    await act(() => result.current.discardSession());
    expect(result.current.status).toBe('idle');
    expect(result.current.anonymousToken).toBeNull();
    expect(result.current.entitiesModified).toEqual([]);
    expect(useAnonymousTokenStore.getState().getToken('project')).toBeNull();
  });
});
