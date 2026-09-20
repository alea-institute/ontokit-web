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
it('verifies a new resume selection and ignores the previous selection response', async () => {
  const old = deferred(); const next = deferred(); vi.stubGlobal('fetch', vi.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise));
  const { result, rerender } = renderHook(({ resumeSessionId }) => useSuggestionSession({ projectId: 'a', accessToken: 'token', resumeSessionId, resumeBranch: `branch-${resumeSessionId}` }), { initialProps: { resumeSessionId: 'old' } });
  rerender({ resumeSessionId: 'current' });
  await act(async () => { next.resolve(json({ items: [{ session_id: 'current', status: 'changes-requested' }] })); });
  expect(result.current.sessionId).toBe('current');
  await act(async () => { old.resolve(json({ items: [{ session_id: 'old', status: 'changes-requested' }] })); });
  expect(result.current.sessionId).toBe('current');
});

it.each(['submit', 'resubmit', 'discard'])('completes authenticated %s across same-viewer credential renewal', async operation => {
  const gate = deferred(); vi.stubGlobal('fetch', vi.fn(() => gate.promise)); const onSubmitted = vi.fn();
  const { result, rerender } = renderHook(({ accessToken }) => useSuggestionSession({ projectId: 'a', viewerId: 'viewer', accessToken, onSubmitted }), { initialProps: { accessToken: 'old' } });
  act(() => result.current.resumeSession('session', 'branch'));
  let pending!: Promise<void>;
  act(() => { pending = operation === 'submit' ? result.current.submitSession() : operation === 'resubmit' ? result.current.resubmitSession() : result.current.discardSession(); });
  rerender({ accessToken: 'renewed' });
  if (operation !== 'discard') expect(result.current.status).toBe('submitting');
  await act(async () => { gate.resolve(json({ pr_number: 9, pr_url: null })); await pending; });
  expect(result.current.sessionId).toBeNull();
  expect(result.current.status).toBe(operation === 'discard' ? 'idle' : 'submitted');
  if (operation !== 'discard') expect(onSubmitted).toHaveBeenCalledExactlyOnceWith(9, null);
});

it.each(['submit', 'resubmit'])('unlocks a renewed credential retry after an older %s is denied', async operation => {
  const gate = deferred(); const onError = vi.fn(); const onSubmitted = vi.fn();
  const fetcher = vi.fn().mockReturnValueOnce(gate.promise).mockResolvedValueOnce(json({ pr_number: 10, pr_url: null })); vi.stubGlobal('fetch', fetcher);
  const { result, rerender } = renderHook(({ accessToken }) => useSuggestionSession({ projectId: 'a', viewerId: 'viewer', accessToken, onError, onSubmitted }), { initialProps: { accessToken: 'old' } });
  act(() => result.current.resumeSession('session', 'branch'));
  let pending!: Promise<void>;
  act(() => { pending = operation === 'submit' ? result.current.submitSession() : result.current.resubmitSession(); });
  rerender({ accessToken: 'renewed' });
  await act(async () => { gate.resolve(json({ detail: 'Expired' }, 401)); await pending; });
  expect(onError).not.toHaveBeenCalled();
  expect(result.current.status).toBe('active');
  await act(() => operation === 'submit' ? result.current.submitSession() : result.current.resubmitSession());
  expect(result.current.status).toBe('submitted');
  expect(onSubmitted).toHaveBeenCalledExactlyOnceWith(10, null);
  expect(fetcher.mock.calls[1][1].headers.get('Authorization')).toBe('Bearer renewed');
});

it.each(['submit', 'resubmit', 'discard'])('blocks duplicate terminal actions and saves while %s settles across renewal', async operation => {
  const gate = deferred(); const fetcher = vi.fn(() => gate.promise); vi.stubGlobal('fetch', fetcher);
  const { result, rerender } = renderHook(({ accessToken }) => useSuggestionSession({ projectId: 'a', viewerId: 'viewer', accessToken }), { initialProps: { accessToken: 'old' } });
  act(() => result.current.resumeSession('session', 'branch'));
  let pending!: Promise<void>;
  act(() => { pending = operation === 'submit' ? result.current.submitSession() : operation === 'resubmit' ? result.current.resubmitSession() : result.current.discardSession(); });
  rerender({ accessToken: 'renewed' });
  await act(async () => {
    await result.current.submitSession(); await result.current.resubmitSession(); await result.current.discardSession();
    expect(await result.current.saveToSession('duplicate', 'iri', 'Label')).toBe(false);
    expect(await result.current.startSession()).toBeNull();
  });
  expect(fetcher).toHaveBeenCalledTimes(1);
  await act(async () => { gate.resolve(json({ pr_number: 9, pr_url: null })); await pending; });
  expect(result.current.sessionId).toBeNull();
});

it.each(['viewer', 'project', 'session', 'unmount'])('rejects terminal completion after a %s ownership round trip', async transition => {
  const gate = deferred(); vi.stubGlobal('fetch', vi.fn(() => gate.promise)); const onSubmitted = vi.fn();
  const initial = { projectId: 'a', viewerId: 'viewer' };
  const { result, rerender, unmount } = renderHook(props => useSuggestionSession({ ...props, accessToken: 'token', onSubmitted }), { initialProps: initial });
  act(() => result.current.resumeSession('session', 'branch'));
  let pending!: Promise<void>; act(() => { pending = result.current.submitSession(); });
  if (transition === 'unmount') unmount();
  else {
    if (transition === 'session') act(() => result.current.resumeSession('other', 'other-branch'));
    else { rerender({ ...initial, ...(transition === 'viewer' ? { viewerId: 'other' } : { projectId: 'b' }) }); rerender(initial); }
    act(() => result.current.resumeSession('session', 'branch'));
  }
  await act(async () => { gate.resolve(json({ pr_number: 9, pr_url: null })); await pending; });
  expect(onSubmitted).not.toHaveBeenCalled();
  if (transition !== 'unmount') expect(result.current).toMatchObject({ sessionId: 'session', status: 'active' });
});

it('does not reverify and reopen a resumed session during credential renewal and submission', async () => {
  const gate = deferred(); const fetcher = vi.fn().mockResolvedValueOnce(json({ items: [{ session_id: 'session', status: 'changes-requested' }] })).mockReturnValueOnce(gate.promise); vi.stubGlobal('fetch', fetcher);
  const { result, rerender } = renderHook(({ accessToken }) => useSuggestionSession({ projectId: 'a', viewerId: 'viewer', accessToken, resumeSessionId: 'session', resumeBranch: 'branch', onError: () => {} }), { initialProps: { accessToken: 'old' } });
  await act(async () => {});
  expect(result.current.sessionId).toBe('session');
  let pending!: Promise<void>; act(() => { pending = result.current.resubmitSession(); });
  rerender({ accessToken: 'renewed' });
  expect(result.current.status).toBe('submitting');
  await act(async () => { gate.resolve(json({ pr_number: 9, pr_url: null })); await pending; });
  expect(result.current).toMatchObject({ sessionId: null, status: 'submitted' });
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it('ignores verification that began before the same session was submitted', async () => {
  const verification = deferred(); const submission = deferred();
  vi.stubGlobal('fetch', vi.fn().mockReturnValueOnce(verification.promise).mockReturnValueOnce(submission.promise));
  const { result } = renderHook(() => useSuggestionSession({ projectId: 'a', accessToken: 'token', resumeSessionId: 'session', resumeBranch: 'branch' }));
  act(() => result.current.resumeSession('session', 'branch'));
  let pending!: Promise<void>; act(() => { pending = result.current.submitSession(); });
  await act(async () => { submission.resolve(json({ pr_number: 9, pr_url: null })); await pending; });
  await act(async () => { verification.resolve(json({ items: [{ session_id: 'session', status: 'changes-requested' }] })); });
  expect(result.current).toMatchObject({ sessionId: null, status: 'submitted' });
});

it('finishes cleanup before a submission callback selects the next session', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ pr_number: 9, pr_url: null })));
  const onSubmitted = vi.fn(() => result.current.resumeSession('next-session', 'next-branch'));
  const { result } = renderHook(() => useSuggestionSession({ projectId: 'a', accessToken: 'token', onSubmitted }));
  act(() => result.current.resumeSession('session', 'branch'));
  await act(() => result.current.submitSession());
  expect(result.current).toMatchObject({ sessionId: 'next-session', branch: 'next-branch', status: 'active' });
  expect(onSubmitted).toHaveBeenCalledExactlyOnceWith(9, null);
});

it('retains discard recovery after an obsolete credential is rejected', async () => {
  const gate = deferred(); const fetcher = vi.fn().mockReturnValueOnce(gate.promise).mockResolvedValueOnce(json({})); vi.stubGlobal('fetch', fetcher);
  const { result, rerender } = renderHook(({ accessToken }) => useSuggestionSession({ projectId: 'a', viewerId: 'viewer', accessToken }), { initialProps: { accessToken: 'old' } });
  act(() => result.current.resumeSession('session', 'branch'));
  let pending!: Promise<void>; act(() => { pending = result.current.discardSession(); });
  rerender({ accessToken: 'renewed' });
  await act(async () => { gate.resolve(json({ detail: 'Expired' }, 401)); await pending; });
  expect(result.current).toMatchObject({ sessionId: 'session', status: 'active', error: null });
  await act(() => result.current.discardSession());
  expect(result.current.sessionId).toBeNull(); expect(fetcher).toHaveBeenCalledTimes(2);
});

it.each(['save-first', 'discard-first'])('closes a session discarded during autosave (%s)', async order => {
  const save = deferred(); const discard = deferred(); const fetcher = vi.fn().mockReturnValueOnce(save.promise).mockReturnValueOnce(discard.promise); vi.stubGlobal('fetch', fetcher);
  const { result } = renderHook(() => useSuggestionSession({ projectId: 'a', accessToken: 'token' }));
  act(() => result.current.resumeSession('session', 'branch'));
  let saving!: Promise<boolean>; let discarding!: Promise<void>;
  act(() => { saving = result.current.saveToSession('source', 'iri', 'Label'); });
  await act(() => result.current.submitSession());
  expect(fetcher).toHaveBeenCalledTimes(1);
  act(() => { discarding = result.current.discardSession(); });
  expect(fetcher).toHaveBeenCalledTimes(2);
  const finishSave = () => act(async () => { save.resolve(json({ changes_count: 5 })); expect(await saving).toBe(false); });
  const finishDiscard = () => act(async () => { discard.resolve(json({})); await discarding; });
  if (order === 'save-first') { await finishSave(); await finishDiscard(); }
  else { await finishDiscard(); await finishSave(); }
  expect(result.current).toMatchObject({ sessionId: null, branch: null, status: 'idle', changesCount: 0, entitiesModified: [] });
});
