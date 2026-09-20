import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Project } from '@/lib/api/projects';
import { useEditorModeStore } from '@/lib/stores/editorModeStore';
import { jsonResponse } from '../fixtures/llm-hook-harness';

const auth = vi.hoisted(() => ({ status: 'unauthenticated', data: null as null | { accessToken: string; user: { name: string } }, signIn: vi.fn() }));
vi.mock('next-auth/react', () => ({ useSession: () => auth, signIn: auth.signIn, signOut: vi.fn() }));
vi.mock('next/navigation', () => ({ usePathname: () => '/', useRouter: () => ({ push: vi.fn() }) }));
import HomePage from '@/app/page';

const project = (id: string, extra: Partial<Project> = {}): Project => ({ id, name: `Ontology ${id}`, is_public: true, owner_id: 'owner', created_at: '2026-09-01T00:00:00Z', member_count: 1, ...extra });
const page = (items: Project[], total = items.length, skip = 0, unfiltered_total = total) => ({ items, total, skip, limit: 50, unfiltered_total });
function mount(handler: (url: URL) => Response | Promise<Response> = () => jsonResponse(page([project('first')]))) {
  const fetcher = vi.fn(async (input: string | URL | Request) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith('/pr-party/me')) return jsonResponse({ is_reviewer: false });
    if (url.pathname.endsWith('/notifications')) return jsonResponse({ items: [], unread_count: 0 });
    if (url.pathname === '/api/v1/projects') return handler(url);
    throw new Error(`Unexpected request ${url}`);
  });
  vi.stubGlobal('fetch', fetcher);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const view = render(<QueryClientProvider client={client}><HomePage /></QueryClientProvider>);
  return { ...view, fetcher, requests: () => fetcher.mock.calls.map(([input]) => new URL(String(input))).filter(url => url.pathname === '/api/v1/projects' && !url.searchParams.has('is_demo')) };
}
const content = () => within(screen.getByRole('main'));
beforeEach(() => { auth.status = 'unauthenticated'; auth.data = null; auth.signIn.mockClear(); vi.stubEnv('NEXT_PUBLIC_AUTH_MODE', 'optional'); useEditorModeStore.setState({ preferEditMode: false }); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); useEditorModeStore.setState({ preferEditMode: false }); });
function authenticated() { auth.status = 'authenticated'; auth.data = { accessToken: 'fixture-token', user: { name: 'Fixture' } }; }

describe('project listing through query pagination, permissions and actual project cards', () => {
  it('renders public project metadata and a viewer link for anonymous visitors', async () => {
    const { requests } = mount(() => jsonResponse(page([project('public', { description: 'A public vocabulary', is_exemplar: true, member_count: 2 })])));
    expect((await screen.findByRole('link', { name: 'Open project Ontology public' })).getAttribute('href')).toBe('/projects/public');
    expect(content().getByText('A public vocabulary')).toBeDefined(); expect(content().getByText('2 members')).toBeDefined(); expect(content().getByText('Exemplar')).toBeDefined();
    expect(requests()[0].searchParams.get('filter')).toBe('public'); expect(content().queryByRole('link', { name: 'New Project' })).toBeNull();
  });

  it('defaults authenticated users to their projects and passes private/all filters to HTTP', async () => {
    authenticated(); const { requests } = mount();
    await screen.findByRole('link', { name: 'Open project Ontology first' });
    await waitFor(() => expect(requests().some(url => url.searchParams.get('filter') === 'mine')).toBe(true));
    expect(content().getByRole('link', { name: 'New Project' }).getAttribute('href')).toBe('/projects/new');
    fireEvent.click(content().getByRole('button', { name: 'Private' }));
    await waitFor(() => expect(requests().at(-1)?.searchParams.get('filter')).toBe('private'));
    fireEvent.click(content().getByRole('button', { name: 'All' }));
    await waitFor(() => expect(requests().at(-1)?.searchParams.has('filter')).toBe(false));
  });

  it.each(['My Projects', 'Private'])('requires sign-in for anonymous %s without sending a privileged list request', async filter => {
    const { requests } = mount(); await screen.findByText('Ontology first'); const count = requests().length;
    fireEvent.click(content().getByRole('button', { name: filter }));
    expect(content().getByRole('heading', { name: /Sign in to see/ })).toBeDefined();
    fireEvent.click(content().getByRole('button', { name: 'Sign In' })); expect(auth.signIn).toHaveBeenCalledOnce(); expect(requests()).toHaveLength(count);
  });

  it.each(['editor', 'viewer'] as const)('honors editor preference only when actual %s permissions allow it', async role => {
    authenticated(); useEditorModeStore.setState({ preferEditMode: true }); mount(() => jsonResponse(page([project('role', { user_role: role })])));
    expect((await screen.findByRole('link', { name: 'Open project Ontology role' })).getAttribute('href')).toBe(role === 'editor' ? '/projects/role/editor' : '/projects/role');
  });

  it('debounces search, sends the final term and resets pagination while keeping counts accurate', async () => {
    const { requests } = mount(url => jsonResponse(url.searchParams.has('search') ? page([project('match')], 1, 0, 75) : page([project('first')], 75)));
    await screen.findByText('Ontology first');
    fireEvent.change(content().getByPlaceholderText('Search projects...'), { target: { value: 'discard' } });
    fireEvent.change(content().getByPlaceholderText('Search projects...'), { target: { value: 'semantic' } });
    await screen.findByText('Ontology match');
    expect(content().getByText('1 result for "semantic"')).toBeDefined(); expect(content().getByText('(of 75)')).toBeDefined();
    expect(requests().some(url => url.searchParams.get('search') === 'discard')).toBe(false);
    expect(requests().at(-1)?.searchParams.get('skip')).toBe('0'); expect(content().queryByText('Ontology first')).toBeNull(); expect(content().queryByRole('button', { name: 'Load More' })).toBeNull();
  });

  it('appends the next real API page and removes Load More at the server total', async () => {
    const { requests } = mount(url => jsonResponse(url.searchParams.get('skip') === '50' ? page([project('last')], 51, 50) : page([project('first')], 51)));
    await screen.findByText('Ontology first'); fireEvent.click(content().getByRole('button', { name: 'Load More' }));
    await screen.findByText('Ontology last'); expect(content().getByText('Ontology first')).toBeDefined(); expect(requests().at(-1)?.searchParams.get('skip')).toBe('50'); expect(content().queryByRole('button', { name: 'Load More' })).toBeNull();
  });

  it('preserves loaded projects when pagination fails and retries the same next page', async () => {
    let failed = true;
    const { requests } = mount(url => url.searchParams.get('skip') === '50'
      ? failed ? new Response('Next page unavailable', { status: 403 }) : jsonResponse(page([project('last')], 51, 50))
      : jsonResponse(page([project('first')], 51)));
    await screen.findByText('Ontology first');
    fireEvent.click(content().getByRole('button', { name: 'Load More' }));
    await waitFor(() => expect(requests().filter(url => url.searchParams.get('skip') === '50')).toHaveLength(1));
    await screen.findByText('Next page unavailable');
    expect(content().getByText('Ontology first')).toBeDefined();
    failed = false; fireEvent.click(content().getByRole('button', { name: /Retry/ }));
    await screen.findByText('Ontology last');
    expect(requests().filter(url => url.searchParams.get('skip') === '50')).toHaveLength(2);
  });

  it('recovers from an initial HTTP failure through the real retry action', async () => {
    let failed = true; mount(url => url.searchParams.has('is_demo') ? jsonResponse(page([])) : failed ? new Response('List unavailable', { status: 403 }) : jsonResponse(page([project('recovered')])));
    await screen.findByText('List unavailable'); expect(content().queryByText('No projects available')).toBeNull(); failed = false;
    fireEvent.click(content().getByRole('button', { name: 'Try Again' })); await screen.findByText('Ontology recovered'); expect(content().queryByText('List unavailable')).toBeNull();
  });

  it('shows an authenticated empty private state with a creation link', async () => {
    authenticated(); mount(() => jsonResponse(page([]))); await screen.findByText('No projects yet');
    fireEvent.click(content().getByRole('button', { name: 'Private' })); await screen.findByText('No private projects yet'); expect(content().getByRole('link', { name: 'Create Private Project' }).getAttribute('href')).toBe('/projects/new');
  });

  it('distinguishes an empty search from an empty catalog', async () => {
    mount(() => jsonResponse(page([]))); await screen.findByText('No projects available');
    fireEvent.change(content().getByPlaceholderText('Search projects...'), { target: { value: 'missing' } }); await screen.findByText('No projects found'); expect(content().getByText('Try a different search term')).toBeDefined();
  });

  it('recovers the independent demo query without interrupting the project catalog', async () => {
    let failed = true; mount(url => url.searchParams.has('is_demo') ? failed ? new Response('Demo unavailable', { status: 403 }) : jsonResponse(page([project('demo', { is_demo: true })])) : jsonResponse(page([project('public')])));
    await screen.findByText('Demo workspaces are temporarily unavailable.'); expect(content().getByText('Ontology public')).toBeDefined(); failed = false;
    fireEvent.click(content().getByRole('button', { name: 'Try again' })); expect((await screen.findByRole('link', { name: 'Try editing' })).getAttribute('href')).toBe('/projects/demo/editor'); expect(content().getByRole('link', { name: 'Explore' }).getAttribute('href')).toBe('/projects/demo');
  });
});
