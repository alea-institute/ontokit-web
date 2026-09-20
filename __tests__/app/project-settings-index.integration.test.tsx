import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { SessionProvider } from 'next-auth/react';
import type { Session } from 'next-auth';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ProjectSettingsPage from '@/app/projects/[id]/settings/page';
import { ToastProvider } from '@/lib/context/ToastContext';
import { jsonResponse, llmHookHarness } from '../fixtures/llm-hook-harness';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), useParams: () => ({ id: 'project' }), usePathname: () => '/projects/project/settings', useSearchParams: () => new URLSearchParams() }));
const session: Session = { user: { id: 'owner', name: 'Owner' }, accessToken: 'fixture-token', expires: '2099-01-01T00:00:00Z' };
function mount(options: { status?: string | null; source?: boolean } = {}) {
  let status = options.status === undefined ? 'ready' : options.status;
  let fail = false;
  let entityCount = 1234;
  const sockets: Socket[] = [];
  class Socket extends EventTarget {
    static OPEN = 1; static CONNECTING = 0; readyState = 1; close = vi.fn();
    onmessage: ((event: MessageEvent) => void) | null = null;
    constructor(readonly url: string) { super(); sockets.push(this); }
    message(type: string) { this.onmessage?.(new MessageEvent('message', { data: JSON.stringify({ type, project_id: 'project' }) })); }
  }
  vi.stubGlobal('WebSocket', Socket);
  const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(input)).pathname;
    if (path.endsWith('/ontology/index-status')) return status === null ? new Response('Index unavailable', { status: 403 }) : jsonResponse({ status, entity_count: entityCount, commit_hash: 'abcdef1234', indexed_at: '2026-09-01T12:00:00Z', error_message: status === 'failed' ? 'Invalid ontology' : null });
    if (path.endsWith('/ontology/reindex')) {
      expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer fixture-token');
      expect(init?.method).toBe('POST');
      return fail ? new Response('Rebuild refused', { status: 403 }) : jsonResponse({ status: 'queued' });
    }
    if (path === '/api/v1/projects/project') return jsonResponse({ id: 'project', name: 'Ontology', user_role: 'owner', owner_id: 'owner', member_count: 0, label_preferences: [], source_file_path: options.source === false ? null : 'ontology.ttl', is_public: false });
    if (path.endsWith('/pr-party/me')) return jsonResponse({ is_reviewer: false });
    if (path.endsWith('/notifications')) return jsonResponse({ items: [], unread_count: 0 });
    if (path.endsWith('/trust/members')) return jsonResponse([]);
    if (path.endsWith('/members')) return jsonResponse({ items: [], total: 0 });
    if (path.endsWith('/pr-settings')) return jsonResponse({ pr_approval_required: 0, github_integration: null });
    if (path.endsWith('/github-token')) return jsonResponse({ has_token: false });
    if (init?.method && init.method !== 'GET') throw new Error(`Unexpected mutation: ${init.method} ${path}`);
    return new Response('Ancillary setting unavailable', { status: 403 });
  });
  vi.stubGlobal('fetch', fetcher);
  const { wrapper: QueryWrapper } = llmHookHarness();
  const view = render(<SessionProvider session={session} refetchOnWindowFocus={false}><QueryWrapper><ToastProvider><ProjectSettingsPage /></ToastProvider></QueryWrapper></SessionProvider>);
  return { ...view, sockets, fetcher, fail: (value: boolean) => { fail = value; }, status: (value: string) => { status = value; }, entityCount: (value: number) => { entityCount = value; } };
}
async function section() { return within((await screen.findByRole('heading', { name: 'Ontology Search Index' })).closest('section')!); }
async function socket(h: ReturnType<typeof mount>) { await waitFor(() => expect(h.sockets.some(s => s.url.includes('/index-ws'))).toBe(true)); return h.sockets.find(s => s.url.includes('/index-ws'))!; }
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('settings index rebuild through real HTTP, query invalidation and websocket parsing', () => {
  it.each([['ready', 'Index up to date'], ['indexing', 'Indexing in progress...'], ['pending', 'Index pending'], ['failed', 'Index failed']])('shows the %s index state and its metadata', async (status, label) => {
    mount({ status }); const ui = await section(); await ui.findByText(label);
    expect(ui.getByText('1,234 entities indexed')).toBeDefined(); expect(ui.getByText('abcdef1')).toBeDefined();
    expect(ui.getByText(/Last indexed:/)).toBeDefined();
    if (status === 'failed') expect(ui.getByText('Invalid ontology')).toBeDefined();
  });

  it('hides the index controls without a source and avoids fetching index status', async () => {
    const h = mount({ source: false }); await screen.findByLabelText(/Project Name/);
    expect(screen.queryByRole('heading', { name: 'Ontology Search Index' })).toBeNull();
    expect(h.fetcher.mock.calls.some(([url]) => String(url).endsWith('/ontology/index-status'))).toBe(false);
  });

  it('queues a rebuild and displays changed index metadata delivered after completion', async () => {
    const h = mount(); const ui = await section(); await ui.findByText('Index up to date'); const ws = await socket(h);
    expect(new URL(ws.url).searchParams.get('token')).toBe('fixture-token');
    fireEvent.click(ui.getByRole('button', { name: 'Rebuild Index' }));
    await screen.findByText('Reindex job queued. The index will update in the background.');
    expect(ui.getByRole('button', { name: 'Reindexing...' }).hasAttribute('disabled')).toBe(true);
    expect(ui.getByText('Indexing in progress...')).toBeDefined();
    h.entityCount(1500); act(() => ws.message('index_complete'));
    await ui.findByText('1,500 entities indexed'); expect(ui.getByText('Index up to date')).toBeDefined();
    expect(ui.getByRole('button', { name: 'Rebuild Index' }).hasAttribute('disabled')).toBe(false);
    expect(h.fetcher.mock.calls.filter(([url]) => String(url).endsWith('/ontology/index-status'))).toHaveLength(2);
    h.unmount(); expect(ws.close).toHaveBeenCalledWith(1000, 'Client closing connection');
  });

  it('reconciles completion even when index metadata is unchanged', async () => {
    const h = mount(); const ui = await section(); await ui.findByText('Index up to date'); const ws = await socket(h);
    expect(new URL(ws.url).searchParams.get('token')).toBe('fixture-token');
    fireEvent.click(ui.getByRole('button', { name: 'Rebuild Index' }));
    await screen.findByText('Reindex job queued. The index will update in the background.');
    expect(ui.getByRole('button', { name: 'Reindexing...' }).hasAttribute('disabled')).toBe(true);
    expect(ui.getByText('Indexing in progress...')).toBeDefined();
    act(() => ws.message('index_complete'));
    await ui.findByText('Index up to date');
    expect(ui.getByRole('button', { name: 'Rebuild Index' }).hasAttribute('disabled')).toBe(false);
    expect(h.fetcher.mock.calls.filter(([url]) => String(url).endsWith('/ontology/index-status'))).toHaveLength(2);
    h.unmount(); expect(ws.close).toHaveBeenCalledWith(1000, 'Client closing connection');
  });

  it('responds to an externally started job and refreshes a failed result', async () => {
    const h = mount(); const ui = await section(); await ui.findByText('Index up to date'); const ws = await socket(h);
    act(() => ws.message('index_started')); expect(ui.getByText('Indexing in progress...')).toBeDefined();
    h.status('failed'); act(() => ws.message('index_failed')); await ui.findByText('Invalid ontology');
    expect(ui.getByRole('button', { name: 'Rebuild Index' }).hasAttribute('disabled')).toBe(false);
  });

  it('retains ready metadata after a rejected rebuild and permits a successful retry', async () => {
    const h = mount(); h.fail(true); const ui = await section(); await ui.findByText('Index up to date');
    fireEvent.click(ui.getByRole('button', { name: 'Rebuild Index' })); await screen.findByText('Rebuild refused');
    expect(ui.getByText('Index up to date')).toBeDefined(); h.fail(false);
    fireEvent.click(ui.getByRole('button', { name: 'Rebuild Index' })); await ui.findByText('Indexing in progress...');
    expect(screen.queryByText('Rebuild refused')).toBeNull();
  });

  it('can rebuild from unavailable status and hydrate the index on completion', async () => {
    const h = mount({ status: null }); const ui = await section(); await ui.findByText(/No index status available/); const ws = await socket(h);
    act(() => ws.message('index_started'));
    expect(ui.getByRole('button', { name: 'Reindexing...' }).hasAttribute('disabled')).toBe(true);
    h.status('ready'); act(() => ws.message('index_complete')); await ui.findByText('Index up to date');
  });
});
