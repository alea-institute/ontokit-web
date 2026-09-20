import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ProjectAnalyticsPage from '@/app/projects/[id]/analytics/page';
import { useSelectionStore } from '@/lib/stores/selectionStore';
import { useEditorModeStore } from '@/lib/stores/editorModeStore';

const navigation = vi.hoisted(() => ({ push: vi.fn(), token: 'analytics-token' as string | undefined }));
vi.mock('next-auth/react', () => ({ useSession: () => ({ data: navigation.token ? { accessToken: navigation.token, user: { name: 'Fixture' } } : null, status: navigation.token ? 'authenticated' : 'unauthenticated' }) }));
vi.mock('next/navigation', () => ({ useParams: () => ({ id: 'analytics-project' }), useRouter: () => navigation, usePathname: () => '/projects/analytics-project/analytics', useSearchParams: () => new URLSearchParams() }));
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
let client: QueryClient;
let failed: string[];
let empty: boolean;
let role: string;
let requests: { url: URL; init: RequestInit }[];
beforeEach(() => {
  navigation.token = 'analytics-token'; navigation.push.mockReset();
  failed = []; empty = false; role = 'editor'; requests = [];
  useSelectionStore.getState().clear(); useEditorModeStore.setState({ preferEditMode: false });
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = new URL(String(input)); requests.push({ url, init });
    const endpoint = url.pathname.split('/').at(-1)!;
    if (failed.includes(endpoint)) return json({ detail: 'Temporarily unavailable' }, 503);
    if (endpoint === 'analytics-project') return json({ id: endpoint, name: 'Ontology', user_role: role });
    if (endpoint === 'me') return json({ is_reviewer: false });
    if (endpoint === 'notifications') return json({ items: [], unread_count: 0 });
    if (endpoint === 'activity') return json({ daily_counts: empty ? [] : [{ date: '2026-09-17', count: 0 }, { date: '2026-09-18', count: 8 }], total_events: empty ? 0 : 8, top_editors: [] });
    if (endpoint === 'hot-entities') return json(empty ? [] : [
      { entity_iri: 'https://example.org/#Person', entity_type: 'class', label: 'Person label', edit_count: 5 },
      { entity_iri: 'https://example.org/hasName', entity_type: 'property', edit_count: 2 },
      { entity_iri: 'https://example.org/#Alice', entity_type: 'individual', edit_count: 1 },
    ]);
    if (endpoint === 'contributors') return json(empty ? [] : [{ user_id: 'fixture-user', user_name: '', create_count: 3, update_count: 5, delete_count: 0, total_count: 8 }]);
    throw new Error(`Unexpected request: ${url}`);
  }));
});
afterEach(() => { cleanup(); client.clear(); vi.unstubAllGlobals(); useSelectionStore.getState().clear(); useEditorModeStore.setState({ preferEditMode: false }); });
const mount = () => render(<QueryClientProvider client={client}><ProjectAnalyticsPage /></QueryClientProvider>);

describe('project analytics route with real query hooks and HTTP transport', () => {
  it('loads all three analytics datasets with bounded query parameters and bearer authentication', async () => {
    mount();
    expect(await screen.findByText('8 total edits')).toBeDefined();
    expect(await screen.findByText('fixture-user')).toBeDefined();
    expect(screen.getByText('+3')).toBeDefined(); expect(screen.getByText('~5')).toBeDefined(); expect(screen.getByText('-0')).toBeDefined();
    const analytics = requests.filter(({ url }) => url.pathname.includes('/analytics/'));
    expect(analytics).toHaveLength(3);
    for (const { url, init } of analytics) {
      expect(new Headers(init.headers).get('Authorization')).toBe('Bearer analytics-token');
      expect(url.search).toBe(url.pathname.endsWith('hot-entities') ? '?limit=20' : '?days=30');
    }
  });

  it.each(['Person label', 'hasName', 'Alice'])('opens the selected entity from its label or IRI fallback: %s', async label => {
    mount(); fireEvent.click(await screen.findByRole('button', { name: new RegExp(label) }));
    const iri = label === 'Person label' ? 'https://example.org/#Person' : label === 'hasName' ? 'https://example.org/hasName' : 'https://example.org/#Alice';
    expect(navigation.push).toHaveBeenCalledExactlyOnceWith(`/projects/analytics-project?classIri=${encodeURIComponent(iri)}`);
  });

  it('renders empty datasets without fabricated edit counts or entities', async () => {
    empty = true; mount();
    expect(await screen.findByText('0 total edits')).toBeDefined();
    expect(await screen.findByText('No recent edits')).toBeDefined();
    expect(await screen.findByText('No contributor data')).toBeDefined();
    expect(screen.queryByText('Person label')).toBeNull();
  });

  it('isolates activity failures while other analytics continue to render', async () => {
    failed = ['activity']; mount();
    expect(await screen.findByText('Failed to load activity data', {}, { timeout: 4000 })).toBeDefined();
    expect(await screen.findByRole('button', { name: /Person label/ })).toBeDefined();
    expect(await screen.findByText('fixture-user')).toBeDefined();
    expect(screen.queryByText('8 total edits')).toBeNull();
    expect(requests.filter(({ url }) => url.pathname.endsWith('/activity'))).toHaveLength(3);
  });

  it('shows independent errors for hot entities and contributors', async () => {
    failed = ['hot-entities', 'contributors']; mount();
    expect(await screen.findByText('Failed to load hot entities', {}, { timeout: 4000 })).toBeDefined();
    expect(await screen.findByText('Failed to load contributors')).toBeDefined();
    expect(await screen.findByText('8 total edits')).toBeDefined();
    expect(screen.queryByText('No recent edits')).toBeNull();
  });

  it('carries the active property selection back to the authorized editor', async () => {
    useSelectionStore.setState({ iri: 'https://example.org/hasName', type: 'property', mode: 'editor' });
    mount();
    await waitFor(() => expect(screen.getByRole('link', { name: 'Back to project' }).getAttribute('href')).toBe('/projects/analytics-project/editor?propertyIri=https%3A%2F%2Fexample.org%2FhasName'));
  });

  it('serves public analytics without credentials and keeps anonymous back navigation in the viewer', async () => {
    navigation.token = undefined; role = ''; useSelectionStore.setState({ mode: 'editor' }); mount();
    expect(await screen.findByText('8 total edits')).toBeDefined();
    expect(screen.getByRole('link', { name: 'Back to project' }).getAttribute('href')).toBe('/projects/analytics-project');
    for (const { init } of requests) expect(new Headers(init.headers).has('Authorization')).toBe(false);
  });
});
