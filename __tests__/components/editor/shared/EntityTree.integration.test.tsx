import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EntityTree } from '@/components/editor/shared/EntityTree';
import { useOntologyTree } from '@/lib/hooks/useOntologyTree';

const iri = (name: string) => `https://example.invalid/${name}`;
let childFailure: boolean;
let empty: boolean;
let calls: string[];
const originalScrollIntoView = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollIntoView');
function Harness({ keyboard = true }: { keyboard?: boolean }) {
  const tree = useOntologyTree({ projectId: 'tree-project', accessToken: 'tree-token', branchKey: 'main' });
  return <><output aria-label="Selected entity">{tree.selectedIri ?? 'None'}</output><EntityTree nodes={tree.nodes} selectedIri={tree.selectedIri} onSelect={tree.selectNode} onExpand={tree.expandNode} onCollapse={tree.collapseNode} enableKeyboardNav={keyboard} /></>;
}
beforeEach(() => {
  childFailure = false; empty = false; calls = [];
  vi.stubGlobal('CSS', { escape: (value: string) => value });
  Object.defineProperty(Element.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input)); calls.push(url.pathname);
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer tree-token');
    expect(url.searchParams.get('branch')).toBe('main');
    if (url.pathname.endsWith('/children')) {
      if (childFailure) return new Response('Expansion denied', { status: 403 });
      return Response.json({ nodes: [{ iri: iri('Child'), label: 'Child', child_count: 0 }], total_classes: 2 });
    }
    if (url.pathname.endsWith('/tree')) return Response.json({ nodes: empty ? [] : [{ iri: iri('Root'), label: 'Root', child_count: 1 }], total_classes: empty ? 0 : 2 });
    throw new Error(`Unexpected request: ${url}`);
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); if (originalScrollIntoView) Object.defineProperty(Element.prototype, 'scrollIntoView', originalScrollIntoView);
  else Reflect.deleteProperty(Element.prototype, 'scrollIntoView'); });
const key = (value: string) => fireEvent.keyDown(screen.getByRole('tree'), { key: value });
const selected = () => screen.getByLabelText('Selected entity').textContent;

describe('entity tree keyboard interactions through lazy ontology state and HTTP', () => {
  it('keeps empty trees stable under every navigation and selection key', async () => {
    empty = true; render(<Harness />); await waitFor(() => expect(calls).toHaveLength(1));
    for (const value of ['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Enter', ' ']) key(value);
    expect(selected()).toBe('None'); expect(screen.queryAllByRole('treeitem')).toHaveLength(0); expect(calls).toHaveLength(1);
  });

  it('ignores expansion without a selection and keeps leaf expansion from fetching children', async () => {
    render(<Harness />); await screen.findByText('Root'); key('ArrowRight'); key('ArrowLeft'); key('Enter');
    expect(calls).toHaveLength(1); expect(selected()).toBe('None');
    key('ArrowUp'); key('ArrowRight'); await screen.findByText('Child'); key('ArrowDown'); key('Enter');
    expect(selected()).toBe(iri('Child')); const before = calls.length; key('ArrowRight');
    expect(calls).toHaveLength(before);
  });

  it('permits keyboard retry after a failed lazy child request', async () => {
    childFailure = true; render(<Harness />); await screen.findByText('Root'); key('ArrowDown'); key('ArrowRight');
    await waitFor(() => expect(calls.filter(path => path.endsWith('/children'))).toHaveLength(1));
    await waitFor(() => expect(screen.queryByLabelText('Loading')).toBeNull());
    childFailure = false; key('ArrowRight'); await screen.findByText('Child');
    expect(calls.filter(path => path.endsWith('/children'))).toHaveLength(2);
  });

  it('clears transient keyboard focus on blur and respects disabled keyboard navigation', async () => {
    const view = render(<Harness />); await screen.findByText('Root'); key('ArrowDown');
    expect(screen.getByRole('tree').getAttribute('aria-activedescendant')).toContain('Root');
    fireEvent.blur(screen.getByRole('tree')); expect(screen.getByRole('tree').hasAttribute('aria-activedescendant')).toBe(false);
    view.rerender(<Harness keyboard={false} />); key('ArrowDown'); key('ArrowRight'); key('Enter');
    expect(selected()).toBe('None'); expect(calls).toHaveLength(1);
  });
});
