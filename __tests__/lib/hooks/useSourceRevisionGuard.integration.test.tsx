import { useState } from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useSourceRevisionGuard, SourceRevisionConflictError } from '@/lib/hooks/useSourceRevisionGuard';
import { revisionsApi } from '@/lib/api/revisions';
import { ApiError } from '@/lib/api/client';
import { jsonResponse } from '../../fixtures/llm-hook-harness';

function setup() {
  let status = 200;
  const fetcher = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
    if (init?.method === 'PUT') {
      if (status === 409) return jsonResponse({ detail: { code: 'SOURCE_REVISION_CONFLICT', message: 'Branch advanced', base_revision: 'r1', current_revision: 'r2', branch: 'main' } }, 409);
      if (status !== 200) return jsonResponse({ detail: 'Save rejected' }, status);
      return jsonResponse({ success: true, commit_hash: 'r3', commit_message: 'Edit', branch: 'main' });
    }
    return jsonResponse({ project_id: 'project', content: 'latest source', revision: 'r2', filename: 'ontology.ttl', version: 'main' });
  });
  vi.stubGlobal('fetch', fetcher);
  const onLoadLatest = vi.fn();
  const hook = renderHook(({ token, branch, revision }: { token?: string; branch?: string; revision: string | null }) => {
    const [snapshot, setSnapshot] = useState({ content: 'original', revision });
    const guard = useSourceRevisionGuard({ projectId: 'project', accessToken: token, activeBranch: branch, sourceRevision: snapshot.revision, setSourceSnapshot: (content, next) => setSnapshot({ content, revision: next }), reloadSourceContent: async () => { const data = await revisionsApi.getFileAtVersion('project', branch!, token); setSnapshot({ content: data.content, revision: data.revision }); return data; }, onLoadLatest });
    return { ...guard, snapshot };
  }, { initialProps: { token: 'token' as string | undefined, branch: 'main' as string | undefined, revision: 'r1' as string | null } });
  return { ...hook, fetcher, onLoadLatest, respond: (next: number) => { status = next; } };
}
function deferredResponse() {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>(finish => { resolve = finish; });
  return { promise, resolve };
}
function scopedSetup() {
  const fetcher = vi.fn<typeof fetch>();
  vi.stubGlobal('fetch', fetcher);
  const setSourceSnapshot = vi.fn();
  const onLoadLatest = vi.fn();
  const hook = renderHook(({ projectId, branch }) => useSourceRevisionGuard({
    projectId, activeBranch: branch, accessToken: 'token', sourceRevision: 'r1', setSourceSnapshot, onLoadLatest,
    reloadSourceContent: () => revisionsApi.getFileAtVersion(projectId, branch, 'token'),
  }), { initialProps: { projectId: 'project', branch: 'main' } });
  return { ...hook, fetcher, setSourceSnapshot, onLoadLatest };
}
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('source revision guard HTTP reconciliation', () => {
  it('preserves a conflicted draft, blocks repeats, reloads and saves against the new revision', async () => {
    const { result, respond, fetcher, onLoadLatest } = setup();
    respond(409);
    await act(async () => { await expect(result.current.saveSource('draft', 'Edit')).rejects.toBeInstanceOf(SourceRevisionConflictError); });
    expect(result.current.conflict?.draftContent).toBe('draft');
    expect(result.current.snapshot).toEqual({ content: 'original', revision: 'r1' });
    await act(async () => { await expect(result.current.saveSource('retry', 'Edit')).rejects.toThrow('draft is preserved'); });
    expect(fetcher).toHaveBeenCalledTimes(1);
    await act(() => result.current.loadLatest());
    expect(onLoadLatest).toHaveBeenCalledExactlyOnceWith('latest source');
    expect(result.current.conflict).toBeNull();
    respond(200);
    await act(() => result.current.saveSource('rebased draft', 'Edit'));
    const finalCall = fetcher.mock.calls.at(-1)!;
    expect(JSON.parse(String(finalCall[1]?.body))).toMatchObject({ content: 'rebased draft', base_revision: 'r2' });
    expect(result.current.snapshot).toEqual({ content: 'rebased draft', revision: 'r3' });
  });

  it.each(['branch', 'project'] as const)('does not install an old save conflict after switching %s', async scope => {
    const { result, rerender, fetcher, setSourceSnapshot } = scopedSetup();
    const old = deferredResponse();
    fetcher.mockReturnValueOnce(old.promise);
    let observed!: Promise<unknown>;
    act(() => { observed = result.current.saveSource('old draft', 'Old edit').catch(error => error); });
    const current = { projectId: scope === 'project' ? 'other-project' : 'project', branch: scope === 'branch' ? 'feature' : 'main' };
    rerender(current);
    fetcher.mockResolvedValueOnce(jsonResponse({ success: true, commit_hash: 'fresh-commit', commit_message: 'New edit', branch: current.branch }));
    await act(() => result.current.saveSource('current draft', 'New edit', 'fresh-base'));
    await act(async () => {
      old.resolve(jsonResponse({ detail: { code: 'SOURCE_REVISION_CONFLICT', message: 'Old branch advanced', base_revision: 'r1', current_revision: 'r2', branch: 'main' } }, 409));
      expect(await observed).toBeInstanceOf(SourceRevisionConflictError);
    });
    expect(result.current.conflict).toBeNull();
    expect(setSourceSnapshot).toHaveBeenCalledExactlyOnceWith('current draft', 'fresh-commit');
    expect(fetcher).toHaveBeenCalledTimes(2);
    const [url, init] = fetcher.mock.calls[1];
    expect(new URL(String(url)).pathname).toBe(`/api/v1/projects/${current.projectId}/source`);
    expect(new URL(String(url)).searchParams.get('branch')).toBe(current.branch);
    expect(JSON.parse(String(init?.body))).toMatchObject({ content: 'current draft', base_revision: 'fresh-base' });
  });

  it.each(['branch', 'project', 'newer request'].flatMap(change => [200, 403].map(status => ({ change, status }))))('keeps the latest reload pending after an obsolete HTTP $status response and $change change', async ({ change, status }) => {
    const { result, rerender, fetcher, onLoadLatest } = scopedSetup();
    const old = deferredResponse();
    const latest = deferredResponse();
    fetcher.mockReturnValueOnce(old.promise).mockReturnValueOnce(latest.promise);
    let first!: Promise<unknown>;
    let second!: ReturnType<typeof result.current.loadLatest>;
    act(() => { first = result.current.loadLatest().catch(error => error); });
    const current = { projectId: change === 'project' ? 'other-project' : 'project', branch: change === 'branch' ? 'feature' : 'main' };
    rerender(current);
    act(() => { second = result.current.loadLatest(); });
    expect(result.current.isLoadingLatest).toBe(true);
    await act(async () => {
      old.resolve(status === 200
        ? jsonResponse({ project_id: 'project', content: 'obsolete content', revision: 'old-revision', filename: 'ontology.ttl', version: 'main' })
        : jsonResponse({ detail: 'Obsolete read denied' }, status));
      const outcome = await first;
      if (status === 403) expect(outcome).toBeInstanceOf(ApiError);
      else expect(outcome).toMatchObject({ content: 'obsolete content' });
    });
    expect(result.current.isLoadingLatest).toBe(true);
    expect(onLoadLatest).not.toHaveBeenCalled();
    await act(async () => {
      latest.resolve(jsonResponse({ project_id: current.projectId, content: 'current content', revision: 'new-revision', filename: 'ontology.ttl', version: current.branch }));
      await second;
    });
    expect(result.current.isLoadingLatest).toBe(false);
    expect(onLoadLatest).toHaveBeenCalledExactlyOnceWith('current content');
    expect(fetcher).toHaveBeenCalledTimes(2);
    const [url, init] = fetcher.mock.calls[1];
    expect(new URL(String(url)).pathname).toBe(`/api/v1/projects/${current.projectId}/revisions/file`);
    expect(new URL(String(url)).searchParams.get('version')).toBe(current.branch);
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer token');
  });

  it('uses an explicit immutable base revision override', async () => {
    const { result, fetcher } = setup();
    await act(() => result.current.saveSource('draft', 'Edit', 'chosen-revision'));
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toMatchObject({ base_revision: 'chosen-revision' });
  });

  it('propagates ordinary API rejection without inventing a revision conflict', async () => {
    const { result, respond } = setup(); respond(403);
    await act(async () => { await expect(result.current.saveSource('draft', 'Edit')).rejects.toBeInstanceOf(ApiError); });
    expect(result.current.conflict).toBeNull();
    expect(result.current.snapshot.content).toBe('original');
    expect(result.current.captureConflict(new Error('ordinary error'), 'draft')).toBeNull();
  });

  it.each(['credentials', 'branch'] as const)('rejects a save with missing %s before HTTP', async missing => {
    const { result, rerender, fetcher } = setup();
    rerender({ token: missing === 'credentials' ? undefined : 'token', branch: missing === 'branch' ? undefined : 'main', revision: 'r1' });
    await act(async () => { await expect(result.current.saveSource('draft', 'Edit')).rejects.toThrow(missing === 'credentials' ? 'Not authenticated' : 'No branch selected'); });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('clears loading state when reconciliation yields no source', async () => {
    const { result } = renderHook(() => useSourceRevisionGuard({ projectId: 'project', accessToken: 'token', activeBranch: 'main', sourceRevision: null, setSourceSnapshot: vi.fn(), reloadSourceContent: async () => undefined }));
    await act(async () => { await expect(result.current.loadLatest()).rejects.toThrow('No source snapshot'); });
    expect(result.current.isLoadingLatest).toBe(false);
    await act(async () => { await expect(result.current.saveSource('draft', 'Edit')).rejects.toThrow('source revision is unavailable'); });
  });
});
