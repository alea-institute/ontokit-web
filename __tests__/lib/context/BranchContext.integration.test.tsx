import type { ReactNode } from 'react';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BranchProvider, useBranch } from '@/lib/context/BranchContext';
import { jsonResponse, llmHookHarness } from '../../fixtures/llm-hook-harness';

function setup(initialBranch?: string) {
  const fetcher = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
    if (init?.method === 'PUT') return jsonResponse({ detail: 'Preference unavailable' }, 403);
    return jsonResponse({ items: [{ name: 'main' }, { name: 'review' }], current_branch: 'main', default_branch: 'main', preferred_branch: 'review', has_github_remote: true, last_sync_at: null, sync_status: 'idle' });
  });
  vi.stubGlobal('fetch', fetcher);
  const { wrapper: QueryWrapper } = llmHookHarness();
  const wrapper = ({ children }: { children: ReactNode }) => <QueryWrapper><BranchProvider projectId="storage-project" accessToken="token" initialBranch={initialBranch}>{children}</BranchProvider></QueryWrapper>;
  return { fetcher, ...renderHook(() => useBranch(), { wrapper }) };
}
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); sessionStorage.clear(); });

describe('branch provider storage and API integration', () => {
  it('keeps branch selection functional when session storage reads and writes are denied', async () => {
    vi.spyOn(sessionStorage, 'getItem').mockImplementation(() => { throw new DOMException('Blocked', 'SecurityError'); });
    vi.spyOn(sessionStorage, 'setItem').mockImplementation(() => { throw new DOMException('Blocked', 'SecurityError'); });
    const { result, fetcher } = setup();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(() => result.current.switchBranch('review'));
    expect(result.current.currentBranch).toBe('review');
    expect(result.current.isFeatureBranch).toBe(true);
    await waitFor(() => expect(fetcher.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(true));
    expect(result.current.error).toBeNull();
  });

  it('recovers a deleted stored branch using the valid server preference even when removal fails', async () => {
    sessionStorage.setItem('ontokit:branch:storage-project', 'deleted');
    vi.spyOn(sessionStorage, 'removeItem').mockImplementation(() => { throw new DOMException('Blocked', 'SecurityError'); });
    const { result } = setup();
    await waitFor(() => expect(result.current.currentBranch).toBe('review'));
    expect(result.current.error).toBeNull();
  });

  it('retains an explicit valid branch instead of a different stored preference', async () => {
    sessionStorage.setItem('ontokit:branch:storage-project', 'review');
    const { result } = setup('main');
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.currentBranch).toBe('main');
    expect(result.current.hasGitHubRemote).toBe(true);
  });

  it('keeps locally selected branch when server preference persistence is rejected', async () => {
    const { result, fetcher } = setup();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(() => result.current.switchBranch('review'));
    await waitFor(() => expect(fetcher.mock.calls.filter(([, init]) => init?.method === 'PUT')).toHaveLength(1));
    expect(result.current.currentBranch).toBe('review');
    expect(sessionStorage.getItem('ontokit:branch:storage-project')).toBe('review');
    expect(result.current.error).toBeNull();
    await act(() => result.current.refreshBranches());
    expect(result.current.currentBranch).toBe('review');
  });
});
