import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { SessionProvider } from 'next-auth/react';
import type { Session } from 'next-auth';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ProjectSettingsPage from '@/app/projects/[id]/settings/page';
import { ToastProvider } from '@/lib/context/ToastContext';
import { jsonResponse, llmHookHarness } from '../fixtures/llm-hook-harness';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), useParams: () => ({ id: 'project' }), usePathname: () => '/projects/project/settings', useSearchParams: () => new URLSearchParams() }));
const session: Session = { user: { id: 'owner', name: 'Owner' }, accessToken: 'fixture-token', expires: '2099-01-01T00:00:00Z' };
const repo = { owner: 'example', name: 'ontology', full_name: 'example/ontology', default_branch: 'develop', private: true, description: 'Test vocabulary', html_url: 'https://github.com/example/ontology' };
const integration = { id: 'github', repo_owner: repo.owner, repo_name: repo.name, repo_url: repo.html_url, default_branch: repo.default_branch, ontology_file_path: 'source.ttl', turtle_file_path: 'output.ttl', sync_enabled: true, sync_status: 'idle', webhooks_enabled: false, github_hook_id: null, connected_by_user_id: 'owner', last_sync_at: '2026-09-01T12:00:00Z' };
function mount(options: { token?: boolean; connected?: boolean; syncStatus?: string; legacy?: boolean } = {}) {
  let failure: 'repos' | 'scan' | 'connect' | 'remove' | null = null;
  let repos = [repo];
  class Socket extends EventTarget { static OPEN = 1; static CONNECTING = 0; readyState = 1; close = vi.fn(); }
  vi.stubGlobal('WebSocket', Socket);
  const confirm = vi.fn().mockReturnValue(true); vi.stubGlobal('confirm', confirm);
  const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(input)).pathname;
    if (path.includes('github')) expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer fixture-token');
    if (path.endsWith('/github-repos')) return failure === 'repos' ? new Response('Repositories refused', { status: 403 }) : jsonResponse({ items: repos, total: repos.length });
    if (path.endsWith('/github/scan-files')) return failure === 'scan' ? new Response('Scan refused', { status: 403 }) : jsonResponse({ items: [{ path: 'source.ttl', size: 12, format: 'turtle' }], total: 1 });
    if (path.endsWith('/github-integration')) {
      if (init?.method === 'POST') return failure === 'connect' ? new Response('Connect refused', { status: 403 }) : jsonResponse(integration);
      if (init?.method === 'DELETE') return failure === 'remove' ? new Response('Remove refused', { status: 403 }) : new Response(null, { status: 204 });
    }
    if (path === '/api/v1/projects/project') return jsonResponse({ id: 'project', name: 'Ontology', user_role: 'owner', owner_id: 'owner', member_count: 0, label_preferences: [], source_file_path: null, is_public: false });
    if (path.endsWith('/pr-party/me')) return jsonResponse({ is_reviewer: false });
    if (path.endsWith('/notifications')) return jsonResponse({ items: [], unread_count: 0 });
    if (path.endsWith('/trust/members')) return jsonResponse([]);
    if (path.endsWith('/members')) return jsonResponse({ items: [], total: 0 });
    if (path.endsWith('/pr-settings')) return jsonResponse({ pr_approval_required: 0, github_integration: options.connected ? { ...integration, sync_enabled: !options.legacy, connected_by_user_id: options.legacy ? undefined : integration.connected_by_user_id, sync_status: options.syncStatus ?? 'idle', sync_error: 'Remote requires attention' } : null });
    if (path.endsWith('/github-token')) return jsonResponse({ has_token: options.token ?? true });
    if (init?.method && init.method !== 'GET') throw new Error(`Unexpected mutation: ${init.method} ${path}`);
    return new Response('Ancillary setting unavailable', { status: 403 });
  });
  vi.stubGlobal('fetch', fetcher);
  const { wrapper: QueryWrapper, client } = llmHookHarness();
  const view = render(<SessionProvider session={session} refetchOnWindowFocus={false}><QueryWrapper><ToastProvider><ProjectSettingsPage /></ToastProvider></QueryWrapper></SessionProvider>);
  return { ...view, client, fetcher, confirm, fail: (value: typeof failure) => { failure = value; }, repos: (value: typeof repos) => { repos = value; } };
}
async function section() { const heading = await screen.findByRole('heading', { name: 'GitHub Integration' }); return within(heading.closest('section')!); }
async function setup(harness: ReturnType<typeof mount>) {
  const ui = await section();
  // The section mounts before the independent credential query has settled.
  await waitFor(() => expect(harness.client.getQueryState(['githubTokenStatus', 'owner'])?.status).toBe('success'));
  await act(async () => { fireEvent.click(ui.getByRole('button', { name: 'Connect to GitHub' })); });
  return ui;
}
const connections = (h: ReturnType<typeof mount>) => h.fetcher.mock.calls.filter(([url, init]) => String(url).endsWith('/github-integration') && init?.method === 'POST');
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('repository connections through settings, the actual output picker and HTTP clients', () => {
  it('routes users without a token to review settings without listing repositories', async () => {
    const h = mount({ token: false }); const ui = await setup(h);
    expect(await ui.findByRole('link', { name: 'review settings' })).toBeDefined();
    expect(ui.getByRole('link', { name: 'review settings' }).getAttribute('href')).toBe('/pr-party/settings');
    expect(h.fetcher.mock.calls.some(([url]) => String(url).includes('/github-repos'))).toBe(false);
  });

  it('selects a repository, scans its real output picker and connects with an exact payload', async () => {
    const h = mount(); const ui = await setup(h);
    expect(ui.getByRole('button', { name: 'Connect Repository' }).hasAttribute('disabled')).toBe(true);
    fireEvent.click(await ui.findByRole('button', { name: /example\/ontology/ }));
    await ui.findByText('source.ttl'); fireEvent.click(ui.getByRole('button', { name: 'Connect Repository' }));
    await screen.findByText('GitHub repository connected successfully');
    expect(JSON.parse(String(connections(h)[0][1]?.body))).toEqual({ repo_owner: 'example', repo_name: 'ontology', default_branch: 'develop', webhooks_enabled: false, ontology_file_path: 'source.ttl' });
    expect(ui.getByRole('link', { name: 'View on GitHub' }).getAttribute('href')).toBe(repo.html_url);
    expect(ui.getByText('Turtle output: output.ttl')).toBeDefined();
    expect(ui.getByText(/Last synced:/)).toBeDefined();
  });

  it('preserves selected repository and output path when connection fails, then retries', async () => {
    const h = mount(); h.fail('connect'); const ui = await setup(h);
    fireEvent.click(await ui.findByRole('button', { name: /example\/ontology/ })); await ui.findByText('source.ttl');
    fireEvent.click(ui.getByRole('button', { name: 'Connect Repository' })); await screen.findByText('Connect refused');
    expect(ui.getByText('source.ttl')).toBeDefined();
    h.fail(null); fireEvent.click(ui.getByRole('button', { name: 'Connect Repository' }));
    await screen.findByText('GitHub repository connected successfully'); expect(connections(h)).toHaveLength(2);
    expect(screen.queryByText('Connect refused')).toBeNull();
  });

  it('recovers an initial repository load error through debounced search and clears stale selection', async () => {
    const h = mount(); h.fail('repos'); const ui = await setup(h); await ui.findByText('No repositories available');
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    h.fail(null); fireEvent.change(ui.getByPlaceholderText('Search by name...'), { target: { value: 'ontology' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    vi.useRealTimers();
    fireEvent.click(await ui.findByRole('button', { name: /example\/ontology/ })); await ui.findByText('source.ttl');
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    h.repos([]); fireEvent.change(ui.getByPlaceholderText('Search by name...'), { target: { value: 'absent' } });
    expect(ui.getByRole('button', { name: 'Connect Repository' }).hasAttribute('disabled')).toBe(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    vi.useRealTimers();
    await ui.findByText('No repositories found');
    const calls = h.fetcher.mock.calls.filter(([url]) => String(url).includes('/github-repos'));
    expect(new URL(String(calls.at(-1)![0])).searchParams.get('q')).toBe('absent');
  });

  it('displays a search error as an empty result and reloads after cancel and reopen', async () => {
    const h = mount(); const ui = await setup(h); await ui.findByRole('button', { name: /example\/ontology/ });
    h.fail('repos'); fireEvent.change(ui.getByPlaceholderText('Search by name...'), { target: { value: 'query' } }); await ui.findByText('No repositories found');
    fireEvent.click(ui.getByRole('button', { name: 'Cancel' })); h.fail(null);
    fireEvent.click(ui.getByRole('button', { name: 'Connect to GitHub' })); await ui.findByRole('button', { name: /example\/ontology/ });
    expect((ui.getByPlaceholderText('Search by name...') as HTMLInputElement).value).toBe('');
    expect(ui.getByRole('button', { name: 'Connect Repository' }).hasAttribute('disabled')).toBe(true);
  });

  it('prevents connecting when the repository scan fails', async () => {
    const h = mount(); h.fail('scan'); const ui = await setup(h);
    fireEvent.click(await ui.findByRole('button', { name: /example\/ontology/ })); await ui.findByText('Scan refused');
    expect(ui.getByRole('button', { name: 'Connect Repository' }).hasAttribute('disabled')).toBe(true); expect(connections(h)).toHaveLength(0);
  });

  it('replaces a disabled legacy connection through the real remove and reconnect flow', async () => {
    const h = mount({ connected: true, legacy: true });
    const ui = await section();
    expect(await ui.findByText('Legacy — reconnect to enable sync')).toBeDefined();
    expect(ui.getByText('Sync disabled')).toBeDefined();
    fireEvent.click(ui.getByRole('button', { name: '' }));
    await screen.findByText('GitHub integration removed');
    await setup(h);
    fireEvent.click(await ui.findByRole('button', { name: /example\/ontology/ }));
    await ui.findByText('source.ttl');
    fireEvent.click(ui.getByRole('button', { name: 'Connect Repository' }));
    await screen.findByText('GitHub repository connected successfully');
    expect(ui.getByText('Sync enabled')).toBeDefined();
    expect(ui.queryByText('Legacy — reconnect to enable sync')).toBeNull();
    expect(h.fetcher.mock.calls.filter(([, init]) => init?.method === 'DELETE')).toHaveLength(1);
    expect(connections(h)).toHaveLength(1);
    expect(JSON.parse(String(connections(h)[0][1]?.body))).toMatchObject({ repo_owner: 'example', repo_name: 'ontology', ontology_file_path: 'source.ttl' });
  });

  it('honors removal cancellation and retains the connection on error before retrying', async () => {
    const h = mount({ connected: true }); const ui = await section(); await ui.findByText('example/ontology');
    const remove = ui.getByRole('button', { name: '' }); h.confirm.mockReturnValue(false); fireEvent.click(remove);
    expect(h.fetcher.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(false);
    h.confirm.mockReturnValue(true); h.fail('remove'); fireEvent.click(remove); await screen.findByText('Remove refused');
    expect(ui.getByText('example/ontology')).toBeDefined(); h.fail(null); fireEvent.click(remove);
    await screen.findByText('GitHub integration removed'); expect(ui.getByRole('button', { name: 'Connect to GitHub' })).toBeDefined();
  });

  it.each([['syncing', 'Syncing...'], ['conflict', 'Merge conflict detected'], ['error', 'Sync error']])('renders the connected repository %s status', async (syncStatus, text) => {
    mount({ connected: true, syncStatus }); const ui = await section(); await ui.findByText(text);
    if (syncStatus !== 'syncing') expect(ui.getByText('Remote requires attention')).toBeDefined();
  });
});
