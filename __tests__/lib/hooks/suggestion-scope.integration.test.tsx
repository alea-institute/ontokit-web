import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useAnonymousSuggestion } from '@/lib/hooks/useAnonymousSuggestion';
import { useSuggestionSession } from '@/lib/hooks/useSuggestionSession';
import { useAnonymousTokenStore } from '@/lib/stores/anonymousCreditStore';
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
function deferred() { let resolve!: (r: Response) => void; const promise = new Promise<Response>(r => { resolve = r; }); return { promise, resolve }; }
beforeEach(() => { sessionStorage.clear(); useAnonymousTokenStore.setState({ tokens: {} }); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('restores anonymous credentials separately for each project without remounting', async () => {
  for (const id of ['a', 'b']) useAnonymousTokenStore.getState().setToken(id, `token-${id}`, `session-${id}`, `branch-${id}`, Date.now());
  const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => json({ changes_count: 1 })); vi.stubGlobal('fetch', fetcher);
  const { result, rerender } = renderHook(({ projectId }) => useAnonymousSuggestion({ projectId }), { initialProps: { projectId: 'a' } });
  rerender({ projectId: 'b' });
  expect(result.current.sessionId).toBe('session-b');
  await act(() => result.current.saveToSession('retained source', 'iri', 'Label'));
  expect(String(fetcher.mock.calls[0]?.[0])).toContain('/b/');
});
it('keeps failed anonymous submission actionable and retries the same session', async () => {
  useAnonymousTokenStore.getState().setToken('a', 'token-a', 'session-a', 'branch-a', Date.now());
  const fetcher = vi.fn().mockResolvedValueOnce(json({ detail: 'Forbidden' }, 403)).mockResolvedValueOnce(json({ pr_number: 1, pr_url: null })); vi.stubGlobal('fetch', fetcher);
  const { result } = renderHook(() => useAnonymousSuggestion({ projectId: 'a' }));
  await act(() => result.current.submitSession('Retained summary'));
  expect(result.current.isActive).toBe(true);
  await act(() => result.current.startSession());
  expect(result.current.status).toBe('active'); expect(result.current.error).toBeNull();
  await act(() => result.current.submitSession('Retained summary'));
  expect(fetcher.mock.calls.map(([url]) => String(url))).toEqual([expect.stringContaining('/session-a/submit'), expect.stringContaining('/session-a/submit')]);
  expect(result.current.status).toBe('submitted');
});
it.each(['create', 'save', 'submit', 'discard'])('ignores late anonymous %s across a project round trip', async operation => {
  if (operation !== 'create') useAnonymousTokenStore.getState().setToken('a', 'old-token', 'old-session', 'old-branch', Date.now());
  const gate = deferred(); vi.stubGlobal('fetch', vi.fn(() => gate.promise)); const onSubmitted = vi.fn(); const onError = vi.fn();
  const { result, rerender } = renderHook(({ projectId }) => useAnonymousSuggestion({ projectId, onSubmitted, onError }), { initialProps: { projectId: 'a' } });
  let pending!: Promise<unknown>;
  act(() => { pending = operation === 'create' ? result.current.startSession() : operation === 'save' ? result.current.saveToSession('old source', 'iri', 'Old') : operation === 'submit' ? result.current.submitSession() : result.current.discardSession(); });
  rerender({ projectId: 'b' });
  act(() => useAnonymousTokenStore.getState().setToken('a', 'new-token', 'new-session', 'new-branch', Date.now()));
  rerender({ projectId: 'a' });
  await act(async () => { gate.resolve(json({ session_id: 'late', branch: 'late', anonymous_token: 'late', created_at: new Date().toISOString(), changes_count: 9, pr_number: 9, pr_url: null })); await pending; });
  expect(result.current).toMatchObject({ sessionId: 'new-session', branch: 'new-branch', changesCount: 0, status: 'active', entitiesModified: [] });
  expect(useAnonymousTokenStore.getState().getToken('a')?.sessionId).toBe('new-session'); expect(onSubmitted).not.toHaveBeenCalled(); expect(onError).not.toHaveBeenCalled();
});
it('does not attach a late authenticated session to another project', async () => {
  const gate = deferred(); vi.stubGlobal('fetch', vi.fn(() => gate.promise));
  const { result, rerender } = renderHook(({ projectId }) => useSuggestionSession({ projectId, accessToken: 'token' }), { initialProps: { projectId: 'a' } });
  let pending!: Promise<unknown>; act(() => { pending = result.current.startSession(); }); rerender({ projectId: 'b' });
  await act(async () => { gate.resolve(json({ session_id: 'old', branch: 'old', beacon_token: 'old' })); await pending; });
  expect(result.current).toMatchObject({ sessionId: null, branch: null, status: 'idle' });
});

it.each(['save', 'submit', 'discard', 'resubmit'])('ignores a late authenticated %s after switching projects', async operation => {
  const gate = deferred(); vi.stubGlobal('fetch', vi.fn(() => gate.promise)); const onSubmitted = vi.fn();
  const { result, rerender } = renderHook(({ projectId }) => useSuggestionSession({ projectId, accessToken: 'token', onSubmitted }), { initialProps: { projectId: 'a' } });
  act(() => result.current.resumeSession('old-session', 'old-branch'));
  let pending!: Promise<unknown>;
  act(() => { pending = operation === 'save' ? result.current.saveToSession('old', 'iri', 'Old') : operation === 'submit' ? result.current.submitSession() : operation === 'resubmit' ? result.current.resubmitSession() : result.current.discardSession(); });
  rerender({ projectId: 'b' }); act(() => result.current.resumeSession('current-session', 'current-branch'));
  await act(async () => { gate.resolve(json({ changes_count: 9, pr_number: 9, pr_url: null })); await pending; });
  expect(result.current).toMatchObject({ sessionId: 'current-session', branch: 'current-branch', changesCount: 0, status: 'active', isResumed: true });
  expect(onSubmitted).not.toHaveBeenCalled();
});
it('ignores old credential errors and keeps a newer save locked until its own completion', async () => {
  const old = deferred(); const current = deferred(); const fetcher = vi.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise); vi.stubGlobal('fetch', fetcher);
  const onError = vi.fn();
  const { result, rerender } = renderHook(({ accessToken }) => useSuggestionSession({ projectId: 'a', accessToken, onError }), { initialProps: { accessToken: 'old' } });
  act(() => result.current.resumeSession('session', 'branch'));
  let first!: Promise<boolean>; act(() => { first = result.current.saveToSession('old', 'iri', 'Old'); });
  rerender({ accessToken: 'renewed' });
  let second!: Promise<boolean>; act(() => { second = result.current.saveToSession('new', 'iri', 'New'); });
  await act(async () => { old.resolve(json({ detail: 'Expired' }, 401)); expect(await first).toBe(false); });
  await act(async () => { expect(await result.current.saveToSession('duplicate', 'iri', 'Duplicate')).toBe(false); });
  expect(result.current.status).toBe('saving'); expect(onError).not.toHaveBeenCalled(); expect(fetcher).toHaveBeenCalledTimes(2);
  await act(async () => { current.resolve(json({ changes_count: 2 })); expect(await second).toBe(true); });
  expect(result.current.entitiesModified).toEqual(['New']);
});
it('does not resume an old project after its verification finishes', async () => {
  const old = deferred(); vi.stubGlobal('fetch', vi.fn(() => old.promise));
  const { result, rerender } = renderHook(({ projectId, resumeSessionId }) => useSuggestionSession({ projectId, accessToken: 'token', resumeSessionId, resumeBranch: 'old-branch' }), { initialProps: { projectId: 'a', resumeSessionId: 'old-session' as string | undefined } });
  rerender({ projectId: 'b', resumeSessionId: undefined });
  await act(async () => { old.resolve(json({ items: [{ session_id: 'old-session', status: 'changes-requested' }] })); });
  expect(result.current).toMatchObject({ sessionId: null, branch: null, isResumed: false });
});
it('clears authenticated session ownership when the viewer changes without signing out', async () => {
  const { result, rerender } = renderHook(({ viewerId }) => useSuggestionSession({ projectId: 'a', accessToken: 'token', viewerId }), { initialProps: { viewerId: 'first-user' } });
  act(() => result.current.resumeSession('first-session', 'first-branch'));
  rerender({ viewerId: 'second-user' });
  expect(result.current).toMatchObject({ sessionId: null, branch: null, beaconToken: null, status: 'idle', isResumed: false });
});
