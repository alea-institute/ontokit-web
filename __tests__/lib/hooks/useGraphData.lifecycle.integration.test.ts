import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useGraphData } from '@/lib/hooks/useGraphData';

const iri = (value: string) => `https://example.invalid/${value}`;
const detail = (name: string, parent_iris: string[] = []) => ({ iri: iri(name), labels: [{ value: name, lang: 'en' }], comments: [], annotations: [], parent_iris, equivalent_iris: null, disjoint_iris: null, deprecated: false });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('graph lifecycle through HTTP, neighbor resolution and graph construction', () => {
  it.each(['focus', 'neighbor', 'depth-two', 'label-resolution', 'ancestry', 'search'])('does not publish the old graph after changing focus during %s resolution', async phase => {
    let release!: (response: Response) => void;
    const pending = new Promise<Response>(resolve => { release = resolve; });
    let paused = false;
    const deepNeighbor = phase === 'depth-two' || phase === 'label-resolution';
    const delayedName = phase === 'focus' ? 'Old' : deepNeighbor ? 'Grandparent' : 'Parent';
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      const path = decodeURIComponent(url.pathname);
      if (path.includes('/classes/')) {
        const name = path.split('/').at(-1)!;
        if ((phase === 'focus' && name === 'Old') || (phase === 'neighbor' && name === 'Parent') || (deepNeighbor && name === 'Grandparent')) { paused = true; return pending; }
        if (phase === 'search' && name === 'Parent') return Response.json({ detail: 'Not a class' }, { status: 404 });
        return Response.json(detail(name, name === 'Old' ? [iri('Parent')] : name === 'Parent' && deepNeighbor ? [iri('Grandparent')] : []));
      }
      if (path.endsWith('/ancestors')) {
        if (phase === 'ancestry' && path.includes(iri('Old'))) { paused = true; return pending; }
        return Response.json({ nodes: [] });
      }
      if (path.endsWith('/search')) { paused = true; return pending; }
      throw new Error(`Unexpected request: ${path}`);
    }));
    const { result, rerender } = renderHook(({ focus }) => useGraphData({ focusIri: iri(focus), projectId: 'project', initialDepth: phase === 'depth-two' ? 2 : 1 }), { initialProps: { focus: 'Old' } });
    await waitFor(() => expect(paused).toBe(true));
    rerender({ focus: 'Current' });
    await waitFor(() => expect(result.current.graphData?.nodes.some(node => node.id === iri('Current'))).toBe(true));
    await act(async () => { release(Response.json(phase === 'ancestry' ? { nodes: [] } : phase === 'search' ? { results: [] } : detail(delayedName))); });
    expect(result.current.graphData?.nodes.map(node => node.id)).toEqual([iri('Current')]);
    expect(result.current.isLoading).toBe(false);
  });

  it('shows a single unresolved focus when the class API rejects it', async () => {
    const fetcher = vi.fn(async () => Response.json({ detail: 'Missing' }, { status: 404 })); vi.stubGlobal('fetch', fetcher);
    const { result } = renderHook(() => useGraphData({ focusIri: iri('Missing'), projectId: 'project' }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.graphData?.nodes).toEqual([expect.objectContaining({ id: iri('Missing'), label: 'Missing' })]);
    expect(result.current.resolvedCount).toBe(0); expect(fetcher).toHaveBeenCalledOnce();
  });

  it('unmounts while a focus request is pending without starting neighbor requests', async () => {
    let release!: (response: Response) => void;
    const pending = new Promise<Response>(resolve => { release = resolve; });
    const fetcher = vi.fn(() => pending); vi.stubGlobal('fetch', fetcher);
    const { unmount } = renderHook(() => useGraphData({ focusIri: iri('Old'), projectId: 'project' }));
    await waitFor(() => expect(fetcher).toHaveBeenCalledOnce()); unmount();
    await act(async () => { release(Response.json(detail('Old', [iri('Parent')]))); });
    expect(fetcher).toHaveBeenCalledOnce();
  });
});


describe('graph recovery and request capacity', () => {
  it('retries an explicitly expanded failed node and reloads after reset', async () => {
    let available = false;
    let focusCalls = 0;
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
      const path = decodeURIComponent(new URL(String(input)).pathname);
      if (path.endsWith('/ancestors')) return Response.json({ nodes: [] });
      if (path.endsWith('/search')) return Response.json({ results: [] });
      const name = path.split('/').at(-1)!;
      if (name === 'Focus') { focusCalls++; return Response.json(detail(name, [iri('Parent')])); }
      return available ? Response.json(detail(name)) : Response.json({ detail: 'Missing' }, { status: 404 });
    }));
    const { result } = renderHook(() => useGraphData({ focusIri: iri('Focus'), projectId: 'project' }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.resolvedCount).toBe(1);
    available = true;
    await act(async () => { await result.current.expandNode(iri('Parent')); });
    expect(result.current.resolvedCount).toBe(2);
    act(() => result.current.resetGraph());
    await waitFor(() => expect(focusCalls).toBe(2));
    await waitFor(() => expect(result.current.resolvedCount).toBe(2));
  });

  it('reserves capacity for parallel requests and deduplicates repeated references', async () => {
    let detailCalls = 0;
    const parents = Array.from({ length: 150 }, (_, index) => iri(`Parent${index}`));
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
      const path = decodeURIComponent(new URL(String(input)).pathname);
      if (path.endsWith('/ancestors')) return Response.json({ nodes: [] });
      const name = path.split('/').at(-1)!;
      detailCalls++;
      return Response.json(detail(name, name === 'Focus' ? [...parents, ...parents] : []));
    }));
    const { result } = renderHook(() => useGraphData({ focusIri: iri('Focus'), projectId: 'project' }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.resolvedCount).toBe(100);
    expect(detailCalls).toBe(100);
  });

  it('does not allow an old expansion to contaminate the new focus cache', async () => {
    let release!: (response: Response) => void;
    const pending = new Promise<Response>(resolve => { release = resolve; });
    let paused = false;
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
      const path = decodeURIComponent(new URL(String(input)).pathname);
      if (path.endsWith('/ancestors')) return Response.json({ nodes: [] });
      const name = path.split('/').at(-1)!;
      if (name === 'Expansion') { paused = true; return pending; }
      return Response.json(detail(name));
    }));
    const { result, rerender } = renderHook(({ focus }) => useGraphData({ focusIri: iri(focus), projectId: 'project' }), { initialProps: { focus: 'Old' } });
    await waitFor(() => expect(result.current.resolvedCount).toBe(1));
    let expansion!: Promise<void>;
    act(() => { expansion = result.current.expandNode(iri('Expansion')) as unknown as Promise<void>; });
    await waitFor(() => expect(paused).toBe(true));
    rerender({ focus: 'Current' });
    await waitFor(() => expect(result.current.graphData?.nodes[0]?.id).toBe(iri('Current')));
    await act(async () => { release(Response.json(detail('Expansion'))); await expansion; });
    await act(async () => { await result.current.expandNode(iri('Current')); });
    expect(result.current.graphData?.nodes.map(node => node.id)).toEqual([iri('Current')]);
    expect(result.current.resolvedCount).toBe(1);
  });
});
