import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useProjectViewer } from '@/lib/hooks/useProjectViewer';
import { jsonResponse, llmHookHarness } from '../../fixtures/llm-hook-harness';

const ns = 'http://example.org/';
function setup(source = '@prefix : <http://example.org/> .\n:Parent a <http://www.w3.org/2002/07/owl#Class> .') {
  let sourceStatus = 200;
  let projectStatus = 200;
  const fetcher = vi.fn(async (input: string | URL | Request) => {
    const url = new URL(String(input));
    const path = url.pathname;
    if (path.endsWith('/revisions/file')) return sourceStatus === 200 ? jsonResponse({ content: source, revision: 'revision-one', filename: 'nested/ontology.ttl', version: url.searchParams.get('version'), project_id: 'project' }) : jsonResponse({ detail: 'Source unavailable' }, sourceStatus);
    if (path.endsWith('/ontology/tree')) return jsonResponse({ nodes: [{ iri: ns + 'Parent', label: 'Parent', has_children: true, children_count: 1 }], total_classes: 2 });
    if (path.endsWith('/children')) return jsonResponse({ nodes: [{ iri: ns + 'Child', label: '', has_children: false, children_count: 0 }], total_classes: 2 });
    if (path.endsWith('/pull-requests')) return jsonResponse({ items: [], total: 3 });
    if (path.endsWith('/suggestions/pending')) return jsonResponse({ items: [{ session_id: 'one' }, { session_id: 'two' }] });
    if (path.endsWith('/lint/status')) return jsonResponse({ status: 'complete', total_issues: 2 });
    if (path.endsWith('/normalization/status')) return jsonResponse({ needs_normalization: false });
    if (path === '/api/v1/projects/project') return projectStatus === 200 ? jsonResponse({ id: 'project', name: 'Example', user_role: 'editor', source_file_path: 'ontology.ttl', git_ontology_path: 'nested/ontology.ttl' }) : jsonResponse({ detail: 'Denied' }, projectStatus);
    throw new Error(`Unexpected request ${url}`);
  });
  vi.stubGlobal('fetch', fetcher);
  const { wrapper } = llmHookHarness();
  return { fetcher, failSource: () => { sourceStatus = 403; }, recover: () => { sourceStatus = 200; }, failProject: () => { projectStatus = 403; }, ...renderHook(({ branch }: { branch?: string }) => useProjectViewer({ projectId: 'project', activeBranch: branch, accessToken: 'token', sessionStatus: 'authenticated' }), { wrapper, initialProps: { branch: 'main' as string | undefined } }) };
}
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('project viewer real data composition', () => {
  it('composes project permissions, counters and lazy tree descendants with fallback labels', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.pendingSuggestionCount).toBe(2));
    expect(result.current.canEdit).toBe(true);
    expect(result.current.canManage).toBe(false);
    expect(result.current.openPRCount).toBe(3);
    expect(result.current.hasValidAccess).toBe(true);
    await act(() => result.current.expandNode(ns + 'Parent'));
    act(() => result.current.selectNode(ns + 'Child'));
    expect(result.current.selectedNodeFallback).toEqual({ iri: ns + 'Child', label: '', parentIri: ns + 'Parent', parentLabel: 'Parent' });
    act(() => result.current.selectNode(ns + 'Missing'));
    expect(result.current.selectedNodeFallback).toBeNull();
  });

  it('loads an immutable source revision and indexes full IRIs, prefixes and continuations', async () => {
    const source = ['@prefix : <http://example.org/> .', '<http://example.org/Full> a :Class ;', ' # continuation comment', '', ':predicate :Object .', ':Parent a :Class .', ':Parent :label "again" .', 'unknown:Ignored a :Class .'].join('\n');
    const { result, fetcher } = setup(source);
    await waitFor(() => expect(result.current.project).not.toBeNull());
    await act(() => result.current.loadSourceContent());
    await waitFor(() => expect(result.current.sourceIriIndex.size).toBe(2));
    expect(result.current.sourceIriIndex.get(ns + 'Full')).toEqual({ line: 2, col: 1, len: '<http://example.org/Full>'.length });
    expect(result.current.sourceIriIndex.get(ns + 'Parent')).toEqual({ line: 6, col: 1, len: 7 });
    expect(result.current.sourceRevision).toBe('revision-one');
    const request = fetcher.mock.calls.find(([input]) => String(input).includes('/revisions/file'))!;
    expect(Object.fromEntries(new URL(String(request[0])).searchParams)).toEqual({ version: 'main', filename: 'nested/ontology.ttl' });
    await act(() => result.current.loadSourceContent());
    expect(fetcher.mock.calls.filter(([input]) => String(input).includes('/revisions/file'))).toHaveLength(1);
  });

  it('yields while indexing a source larger than one chunk without dropping late subjects', async () => {
    const source = ['@prefix : <http://example.org/> .', ':First a :Class .', ...Array.from({ length: 5000 }, () => '# comment'), '  :Last a :Class .'].join('\n');
    const { result } = setup(source);
    await waitFor(() => expect(result.current.project).not.toBeNull());
    await act(() => result.current.loadSourceContent());
    await waitFor(() => expect(result.current.sourceIriIndex.has(ns + 'Last')).toBe(true));
    expect(result.current.sourceIriIndex.get(ns + 'Last')).toEqual({ line: 5003, col: 3, len: 5 });
    expect(result.current.sourceIriIndex.size).toBe(2);
  });

  it('supports direct and functional source edits without changing the revision', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.project).not.toBeNull());
    await act(() => result.current.loadSourceContent());
    act(() => result.current.setSourceContent(previous => previous + '\n# local edit'));
    expect(result.current.sourceContent).toContain('# local edit');
    const edited = result.current.sourceContent;
    act(() => result.current.setSourceContent(edited));
    expect(result.current.sourceContent).toBe(edited);
    expect(result.current.sourceRevision).toBe('revision-one');
  });

  it('exposes explicit source failures and succeeds on retry without losing scope', async () => {
    const { result, failSource, recover } = setup();
    await waitFor(() => expect(result.current.project).not.toBeNull());
    failSource();
    await act(() => result.current.loadSourceContent());
    expect(result.current.sourceError).toContain('Source unavailable');
    expect(result.current.isLoadingSource).toBe(false);
    recover();
    await act(() => result.current.loadSourceContent());
    expect(result.current.sourceError).toBeNull();
    expect(result.current.sourceRevision).toBe('revision-one');
  });

  it('does not request source without a branch and ignores an old snapshot setter after scope changes', async () => {
    const { result, rerender, fetcher } = setup();
    await waitFor(() => expect(result.current.project).not.toBeNull());
    const staleSetter = result.current.setSourceSnapshot;
    rerender({ branch: undefined });
    await act(() => result.current.loadSourceContent());
    act(() => staleSetter('stale', 'stale-revision'));
    expect(result.current.sourceContent).toBe('');
    expect(fetcher.mock.calls.some(([input]) => String(input).includes('/revisions/file'))).toBe(false);
  });
});
