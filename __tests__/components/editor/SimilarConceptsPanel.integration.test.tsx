import { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SimilarConceptsPanel } from '@/components/editor/SimilarConceptsPanel';
import { jsonResponse, llmHookHarness } from '../../fixtures/llm-hook-harness';

const iri = 'https://example.org/Focus';
const entities = [
  { iri: 'https://example.org/Class', label: 'Related class', entity_type: 'class', score: .8, deprecated: false },
  { iri: 'https://example.org/Property', label: 'Related property', entity_type: 'property', score: .6, deprecated: false },
  { iri: 'https://example.org/Individual', label: 'Related individual', entity_type: 'individual', score: .5, deprecated: false },
];
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function transport(reply: (url: URL) => Response) {
  const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    expect(url.pathname).toMatch(/^\/api\/v1\/projects\/project\/entities\/.+\/similar$/);
    expect(init?.method ?? 'GET').toBe('GET');
    expect(url.searchParams.get('limit')).toBe('10');
    expect(url.searchParams.get('threshold')).toBe('0.5');
    return reply(url);
  });
  vi.stubGlobal('fetch', fetcher);
  return fetcher;
}

describe('similar concepts through React Query and the actual embeddings HTTP client', () => {
  it('renders score boundaries and follows a selected entity into a fresh scoped query', async () => {
    const fetcher = transport(url => jsonResponse(decodeURIComponent(url.pathname).includes(iri) ? entities : []));
    function EditorSelection() {
      const [selected, setSelected] = useState(iri);
      return <><output>{selected}</output><SimilarConceptsPanel projectId="project" classIri={selected} accessToken="test-token" branch="review" onNavigateToClass={setSelected} /></>;
    }
    render(<EditorSelection />, { wrapper: llmHookHarness().wrapper });
    fireEvent.click(await screen.findByRole('button', { name: 'Similar (3)' }));
    for (const [index, badge, color] of [[0, 'C', 'text-green-600'], [1, 'P', 'text-amber-600'], [2, 'I', 'text-slate-500']] as const) {
      const row = within(screen.getByTitle(entities[index].iri));
      expect(row.getByText(badge)).toBeDefined();
      expect(row.getByText(`${entities[index].score * 100}%`).classList.contains(color)).toBe(true);
    }
    fireEvent.click(screen.getByTitle(entities[0].iri));
    await waitFor(() => expect(screen.queryByRole('button', { name: /Similar/ })).toBeNull());
    expect(screen.getByRole('status').textContent).toBe(entities[0].iri);
    expect(fetcher).toHaveBeenCalledTimes(2);
    for (const [url, init] of fetcher.mock.calls) {
      expect(new URL(String(url)).searchParams.get('branch')).toBe('review');
      expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer test-token');
    }
    expect(decodeURIComponent(new URL(String(fetcher.mock.calls[1][0])).pathname)).toContain(entities[0].iri);
  });

  it('shows unknown deprecated entities by local name and reopens cached public results', async () => {
    const entity = { ...entities[0], iri: 'https://example.org/#Legacy', label: '', entity_type: 'future-type', score: .555, deprecated: true };
    const fetcher = transport(() => jsonResponse([entity]));
    render(<SimilarConceptsPanel projectId="project" classIri={iri} />, { wrapper: llmHookHarness().wrapper });
    const toggle = await screen.findByRole('button', { name: 'Similar (1)' });
    fireEvent.click(toggle);
    const result = screen.getByTitle(entity.iri);
    expect(within(result).getByText('Legacy')).toBeDefined();
    expect(within(result).getByText('C')).toBeDefined();
    expect(within(result).getByText('56%').classList.contains('text-slate-500')).toBe(true);
    expect(result.classList.contains('line-through')).toBe(true);
    fireEvent.click(result);
    fireEvent.click(toggle);
    expect(screen.queryByTitle(entity.iri)).toBeNull();
    fireEvent.click(toggle);
    expect(screen.getByTitle(entity.iri)).toBeDefined();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(new Headers(fetcher.mock.calls[0][1]?.headers).has('Authorization')).toBe(false);
    expect(new URL(String(fetcher.mock.calls[0][0])).searchParams.has('branch')).toBe(false);
  });

  it.each([403, 404])('distinguishes HTTP %s and recovers when switching to an indexed branch', async status => {
    const fetcher = transport(url => url.searchParams.get('branch') === 'ready' ? jsonResponse(entities) : jsonResponse({ detail: 'Unavailable' }, status));
    const { rerender } = render(<SimilarConceptsPanel projectId="project" classIri={iri} branch="missing" />, { wrapper: llmHookHarness().wrapper });
    fireEvent.click(await screen.findByRole('button', { name: 'Similar (0)' }));
    const message = status === 404 ? 'Generate embeddings in project settings to see similar concepts.' : 'Failed to load similar concepts.';
    expect(screen.getByText(message)).toBeDefined();
    rerender(<SimilarConceptsPanel projectId="project" classIri={iri} branch="ready" />);
    expect(await screen.findByTitle(entities[0].iri)).toBeDefined();
    expect(screen.queryByText(message)).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('does not request without selection and hides a successful empty response', async () => {
    const fetcher = transport(() => jsonResponse([]));
    const { container, rerender } = render(<SimilarConceptsPanel projectId="project" classIri={null} />, { wrapper: llmHookHarness().wrapper });
    expect(container.innerHTML).toBe('');
    expect(fetcher).not.toHaveBeenCalled();
    rerender(<SimilarConceptsPanel projectId="project" classIri={iri} />);
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(container.innerHTML).toBe(''));
  });
});
