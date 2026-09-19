import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useSuggestionSession } from '@/lib/hooks/useSuggestionSession';
import { saveSuggestionUpdate } from '@/lib/editor/suggestionSessionPersistence';
import { jsonResponse } from '../../fixtures/llm-hook-harness';

function setup(resumeStatus?: string, initialFailure = '') {
  let failure = initialFailure;
  const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const path = new URL(String(input)).pathname;
    if (failure && path.endsWith(failure)) return new Response('Session unavailable', { status: 403 });
    if (path.endsWith('/save')) return jsonResponse({ commit_hash: 'commit', branch: 'suggestions/one', changes_count: 2 });
    if (path.endsWith('/submit') || path.endsWith('/resubmit')) return jsonResponse({ pr_number: 7, pr_url: '/review/7', status: 'submitted' });
    if (path.endsWith('/discard')) return new Response(null, { status: 204 });
    if (init?.method === 'POST') return jsonResponse({ session_id: 'session', branch: 'suggestions/one', beacon_token: 'synthetic-beacon', created_at: '2026-01-01T00:00:00Z' });
    return jsonResponse({ items: [{ session_id: 'session', status: resumeStatus }] });
  });
  vi.stubGlobal('fetch', fetcher);
  const onSubmitted = vi.fn(); const onError = vi.fn();
  return { fetcher, onSubmitted, onError, fail: (suffix: string) => { failure = suffix; }, ...renderHook(({ token }: { token?: string }) => useSuggestionSession({ projectId: 'project', accessToken: token, resumeSessionId: resumeStatus ? 'session' : undefined, resumeBranch: resumeStatus ? 'suggestions/one' : undefined, onSubmitted, onError }), { initialProps: { token: 'token' as string | undefined } }) };
}
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('authenticated suggestion session persistence chain', () => {
  it('coalesces simultaneous starts through the real API into one authenticated session', async () => {
    const { result, fetcher } = setup();
    await act(async () => {
      const first = result.current.startSession();
      const second = result.current.startSession();
      expect(first).toBe(second);
      expect(await Promise.all([first, second])).toEqual(['suggestions/one', 'suggestions/one']);
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(new Headers(fetcher.mock.calls[0][1]?.headers).get('Authorization')).toBe('Bearer token');
    expect(result.current.sessionId).toBe('session');
    await act(() => result.current.startSession());
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('does not create a session without credentials and starts after authentication returns', async () => {
    const { result, fetcher, rerender } = setup();
    rerender({ token: undefined });
    await act(async () => { expect(await result.current.startSession()).toBeNull(); });
    expect(fetcher).not.toHaveBeenCalled();
    rerender({ token: 'renewed' });
    await act(() => result.current.startSession());
    expect(new Headers(fetcher.mock.calls[0][1]?.headers).get('Authorization')).toBe('Bearer renewed');
    expect(result.current.isActive).toBe(true);
  });

  it('reports verification failure without restoring or writing the unverified session', async () => {
    const { result, onError, fetcher, rerender, fail } = setup('changes-requested', '/sessions');
    await waitFor(() => expect(onError).toHaveBeenCalledExactlyOnceWith('Failed to verify suggestion session status.'));
    expect(result.current).toMatchObject({ sessionId: null, branch: null, isResumed: false, status: 'idle' });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][1]?.method).toBe('GET');
    expect(new Headers(fetcher.mock.calls[0][1]?.headers).get('Authorization')).toBe('Bearer token');
    fail('');
    rerender({ token: 'token' });
    await act(async () => {});
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result.current.sessionId).toBeNull();
  });

  it('starts and saves through the real editor persistence helper before reporting success', async () => {
    const { result, fetcher, onSubmitted } = setup(); const onSaved = vi.fn();
    await act(() => saveSuggestionUpdate({ isSessionActive: false, session: result.current, content: 'draft source', entityIri: 'http://example.org/Person', entityLabel: 'Person', onSaved }));
    expect(onSaved).toHaveBeenCalledOnce();
    expect(result.current).toMatchObject({ status: 'active', changesCount: 2, entitiesModified: ['Person'], beaconToken: 'synthetic-beacon' });
    const save = fetcher.mock.calls.find(([input]) => String(input).endsWith('/save'))!;
    expect(new Headers(save[1]?.headers).get('Authorization')).toBe('Bearer token');
    expect(JSON.parse(String(save[1]?.body))).toEqual({ content: 'draft source', entity_iri: 'http://example.org/Person', entity_label: 'Person' });
    await act(() => result.current.submitSession('Reviewed changes'));
    expect(onSubmitted).toHaveBeenCalledExactlyOnceWith(7, '/review/7');
    expect(result.current).toMatchObject({ status: 'submitted', sessionId: null, branch: null, changesCount: 0, entitiesModified: [], beaconToken: null });
  });

  it('never reports editor persistence success for a rejected save', async () => {
    const { result, fail } = setup(); const onSaved = vi.fn();
    await act(() => result.current.startSession()); fail('/save');
    await act(async () => { await expect(saveSuggestionUpdate({ isSessionActive: true, session: result.current, content: 'draft', entityIri: 'iri', entityLabel: 'Label', onSaved })).rejects.toThrow('was not saved'); });
    expect(onSaved).not.toHaveBeenCalled();
    expect(result.current.error).toBe('Session unavailable');
    expect(result.current.sessionId).toBe('session');
  });

  it('verifies a resumable session, edits it and resubmits without creating a new branch', async () => {
    const { result, fetcher, onSubmitted } = setup('changes-requested');
    await waitFor(() => expect(result.current.isResumed).toBe(true));
    expect(result.current.beaconToken).toBeNull();
    await act(() => result.current.saveToSession('revised', 'iri', 'Label'));
    await act(() => result.current.resubmitSession('Addressed feedback'));
    expect(fetcher.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1);
    expect(String(fetcher.mock.calls.at(-1)![0])).toContain('/resubmit');
    expect(onSubmitted).toHaveBeenCalledExactlyOnceWith(7, '/review/7');
    expect(result.current.isResumed).toBe(false);
  });

  it.each(['submitted', 'merged', 'discarded'])('does not restore a session whose authoritative status is %s', async status => {
    const { result, onError } = setup(status);
    await waitFor(() => expect(onError).toHaveBeenCalledWith('This suggestion session is no longer available for editing.'));
    expect(result.current.sessionId).toBeNull(); expect(result.current.isResumed).toBe(false);
  });

  it('keeps a resumed draft active for retry after resubmission is rejected', async () => {
    const { result, fail, onSubmitted } = setup('changes-requested');
    await waitFor(() => expect(result.current.isResumed).toBe(true)); fail('/resubmit');
    await act(() => result.current.resubmitSession());
    expect(result.current.status).toBe('error'); expect(result.current.sessionId).toBe('session');
    expect(onSubmitted).not.toHaveBeenCalled();
    fail(''); await act(() => result.current.resubmitSession());
    expect(result.current.status).toBe('submitted');
  });

  it('does not write or submit after credentials disappear', async () => {
    const { result, rerender, fetcher } = setup();
    await act(() => result.current.startSession()); rerender({ token: undefined });
    await act(async () => { expect(await result.current.saveToSession('draft', 'iri', 'Label')).toBe(false); await result.current.submitSession(); await result.current.resubmitSession(); await result.current.discardSession(); });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('clears resumed state even when best-effort discard is rejected', async () => {
    const { result, fail } = setup('changes-requested');
    await waitFor(() => expect(result.current.isResumed).toBe(true)); fail('/discard');
    await act(() => result.current.discardSession());
    expect(result.current).toMatchObject({ status: 'idle', sessionId: null, branch: null, isResumed: false, error: null });
  });
});
