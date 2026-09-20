import type { ReactNode } from 'react';
import { act, cleanup, render, renderHook, screen, waitFor } from '@testing-library/react';
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
  it('keeps a newly created branch selected when saving its preference fails', async () => {
    const { result, fetcher } = setup();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    fetcher.mockImplementation(async (_input, init) => {
      if (init?.method === 'POST') return jsonResponse({ name: 'new-review', commit_hash: 'created', is_default: false });
      if (init?.method === 'PUT') return jsonResponse({ detail: 'Preference unavailable' }, 403);
      return jsonResponse({ items: [{ name: 'main' }, { name: 'review' }, { name: 'new-review' }], current_branch: 'main', default_branch: 'main', preferred_branch: 'review', has_github_remote: true, last_sync_at: null, sync_status: 'idle' });
    });
    await act(async () => {
      const branch = await result.current.createBranch('new-review', 'main');
      expect(branch.name).toBe('new-review');
    });
    await waitFor(() => expect(fetcher.mock.calls.filter(([, init]) => init?.method === 'PUT')).toHaveLength(1));
    expect(result.current.currentBranch).toBe('new-review');
    expect(result.current.error).toBeNull();
    expect(result.current.branches.some(branch => branch.name === 'new-review')).toBe(true);
    expect(sessionStorage.getItem('ontokit:branch:storage-project')).toBe('new-review');
    const created = fetcher.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(JSON.parse(String(created?.[1]?.body))).toEqual({ name: 'new-review', from_branch: 'main' });
  });

  it('restores the requested feature branch when authentication arrives after the public branch response', async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(new URL(String(input)).pathname).toBe('/api/v1/projects/storage-project/branches');
      expect(init?.method).toBe('GET');
      return jsonResponse({ items: [{ name: 'main' }, { name: 'review' }], current_branch: 'main', default_branch: 'main', preferred_branch: null, has_github_remote: false, last_sync_at: null, sync_status: 'idle' });
    });
    vi.stubGlobal('fetch', fetcher);
    const { wrapper: QueryWrapper } = llmHookHarness();
    function Selection() { return <output aria-label="Current branch">{useBranch().currentBranch}</output>; }
    const tree = (token?: string) => <QueryWrapper><BranchProvider projectId="storage-project" accessToken={token} initialBranch="review"><Selection /></BranchProvider></QueryWrapper>;
    const view = render(tree());
    await waitFor(() => expect(screen.getByLabelText('Current branch').textContent).toBe('main'));
    view.rerender(tree('token'));
    await waitFor(() => expect(screen.getByLabelText('Current branch').textContent).toBe('review'));
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(new Headers(fetcher.mock.calls[0][1]?.headers).has('Authorization')).toBe(false);
    expect(new Headers(fetcher.mock.calls[1][1]?.headers).get('Authorization')).toBe('Bearer token');
  });

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
