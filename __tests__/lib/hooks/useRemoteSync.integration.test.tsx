import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useRemoteSync } from '@/lib/hooks/useRemoteSync';
import type { RemoteSyncConfig, SyncJobStatusResponse } from '@/lib/api/remoteSync';
import { jsonResponse, llmHookHarness } from '../../fixtures/llm-hook-harness';

const config: RemoteSyncConfig = { id: 'config', project_id: 'project', repo_owner: 'owner', repo_name: 'repo', branch: 'main', file_path: 'ontology.ttl', frequency: 'manual', enabled: true, update_mode: 'review_required', status: 'idle', last_check_at: null, last_update_at: null, next_check_at: null, remote_commit_sha: null, pending_pr_id: null, error_message: null };
function setup(initial: RemoteSyncConfig | null = config) {
  let stored = initial;
  let job: SyncJobStatusResponse = { job_id: 'job', status: 'running', result: null, error: null };
  let failure = '';
  let nextJobId = 'job';
  const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? 'GET';
    if (`${method} ${url.pathname}`.endsWith(failure) && failure) return jsonResponse({ detail: 'Forbidden' }, 403);
    if (url.pathname.endsWith('/history')) return jsonResponse({ items: [], total: 0 });
    if (url.pathname.includes('/jobs/')) return jsonResponse(job);
    if (url.pathname.endsWith('/check')) return jsonResponse({ job_id: nextJobId, message: 'Started', status: 'pending' });
    if (method === 'PUT') { stored = { ...config, ...JSON.parse(String(init?.body)) }; return jsonResponse(stored); }
    if (method === 'DELETE') { stored = null; return new Response(null, { status: 204 }); }
    return jsonResponse(stored);
  });
  vi.stubGlobal('fetch', fetcher);
  const { client, wrapper } = llmHookHarness();
  const hook = renderHook(({ token }: { token?: string }) => useRemoteSync({ projectId: 'project', accessToken: token }), { wrapper, initialProps: { token: 'token' as string | undefined } });
  return { ...hook, client, fetcher, setNextJobId: (id: string) => { nextJobId = id; }, setJob: (next: SyncJobStatusResponse) => { job = next; }, fail: (suffix: string) => { failure = suffix; } };
}
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('remote sync HTTP and cache lifecycle', () => {
  it('creates configuration, loads dependent history and clears both on deletion', async () => {
    const { result, fetcher } = setup(null);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(fetcher.mock.calls).toHaveLength(1);
    await act(() => result.current.saveConfig({ repo_owner: 'new-owner', repo_name: 'repo', file_path: 'data.ttl' }));
    await waitFor(() => expect(result.current.config?.repo_owner).toBe('new-owner'));
    await waitFor(() => expect(fetcher.mock.calls.some(([input]) => String(input).includes('/history?limit=20'))).toBe(true));
    const save = fetcher.mock.calls.find(([, init]) => init?.method === 'PUT')!;
    expect(JSON.parse(String(save[1]?.body))).toEqual({ repo_owner: 'new-owner', repo_name: 'repo', file_path: 'data.ttl' });
    expect(new Headers(save[1]?.headers).get('Authorization')).toBe('Bearer token');
    await act(() => result.current.deleteConfig());
    await waitFor(() => expect(result.current.config).toBeNull());
    expect(result.current.history).toEqual([]);
  });

  it.each(['complete', 'failed'] as const)('polls a job to %s and refreshes configuration and history', async status => {
    const { result, setJob, fetcher } = setup();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    vi.useFakeTimers();
    await act(() => result.current.triggerCheck());
    expect(result.current.isChecking).toBe(true);
    await act(() => vi.advanceTimersByTimeAsync(2000));
    expect(result.current.isChecking).toBe(true);
    setJob({ job_id: 'job', status, result: null, error: status === 'failed' ? 'Invalid Turtle upstream' : null });
    await act(() => vi.advanceTimersByTimeAsync(2000));
    expect(result.current.isChecking).toBe(false);
    expect(result.current.error).toBe(status === 'failed' ? 'Invalid Turtle upstream' : null);
    expect(fetcher.mock.calls.filter(([input]) => String(input).includes('/history'))).toHaveLength(2);
    const calls = fetcher.mock.calls.length;
    await act(() => vi.advanceTimersByTimeAsync(6000));
    expect(fetcher).toHaveBeenCalledTimes(calls);
  });

  it('recovers from a failed status poll and authenticates later polling with a renewed token', async () => {
    const { result, fail, fetcher, rerender } = setup();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    vi.useFakeTimers();
    await act(() => result.current.triggerCheck());
    fail('/jobs/job');
    await act(() => vi.advanceTimersByTimeAsync(2000));
    expect(result.current.isChecking).toBe(true);
    fail('');
    rerender({ token: 'renewed' });
    await act(() => vi.advanceTimersByTimeAsync(2000));
    const polls = fetcher.mock.calls.filter(([input]) => String(input).includes('/jobs/'));
    expect(polls).toHaveLength(2);
    expect(new Headers(polls[1][1]?.headers).get('Authorization')).toBe('Bearer renewed');
  });

  it('replaces a scheduled poll when a newer manual check starts', async () => {
    const { result, fetcher, setNextJobId, setJob } = setup();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    vi.useFakeTimers();
    await act(() => result.current.triggerCheck());
    await act(() => vi.advanceTimersByTimeAsync(1000));
    setNextJobId('replacement');
    await act(() => result.current.triggerCheck());
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(fetcher.mock.calls.filter(([input]) => String(input).includes('/jobs/'))).toHaveLength(0);
    setJob({ job_id: 'replacement', status: 'complete', result: null, error: null });
    await act(() => vi.advanceTimersByTimeAsync(1000));
    const polls = fetcher.mock.calls.filter(([input]) => String(input).includes('/jobs/'));
    expect(polls).toHaveLength(1);
    expect(String(polls[0][0])).toContain('/jobs/replacement');
    expect(result.current.isChecking).toBe(false);
    await act(() => vi.advanceTimersByTimeAsync(6000));
    expect(fetcher.mock.calls.filter(([input]) => String(input).includes('/jobs/'))).toHaveLength(1);
  });

  it('cancels scheduled polling on unmount', async () => {
    const { result, fetcher, unmount } = setup();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    vi.useFakeTimers();
    await act(() => result.current.triggerCheck());
    unmount();
    await act(() => vi.advanceTimersByTimeAsync(10000));
    expect(fetcher.mock.calls.some(([input]) => String(input).includes('/jobs/'))).toBe(false);
  });

  it.each(['save', 'delete'] as const)('preserves existing configuration when %s fails', async operation => {
    const { result, fail } = setup();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    fail(`${operation === 'save' ? 'PUT' : 'DELETE'} /api/v1/projects/project/remote-sync`);
    await act(async () => { await expect(operation === 'save' ? result.current.saveConfig({ enabled: false }) : result.current.deleteConfig()).rejects.toThrow(); });
    expect(result.current.config).toEqual(config);
    expect(result.current.error).toContain('Forbidden');
  });

  it('exposes trigger errors and permits a later retry', async () => {
    const { result, fail } = setup();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    fail('/check');
    await act(() => result.current.triggerCheck());
    expect(result.current.isChecking).toBe(false);
    expect(result.current.error).toContain('Forbidden');
    fail('');
    await act(() => result.current.triggerCheck());
    expect(result.current.isChecking).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('does not mutate configuration after credentials are removed', async () => {
    const { result, rerender, fetcher } = setup();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    rerender({ token: undefined });
    const before = fetcher.mock.calls.length;
    await act(async () => { await result.current.saveConfig({ enabled: false }); await result.current.deleteConfig(); await result.current.triggerCheck(); });
    expect(fetcher).toHaveBeenCalledTimes(before);
    expect(result.current.config).toBeNull();
  });
});
