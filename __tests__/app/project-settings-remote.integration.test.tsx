import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { SessionProvider } from 'next-auth/react';
import type { Session } from 'next-auth';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ProjectSettingsPage from '@/app/projects/[id]/settings/page';
import { ToastProvider } from '@/lib/context/ToastContext';
import { remoteSyncQueryKeys } from '@/lib/hooks/useRemoteSync';
import type { RemoteSyncConfig, SyncEvent } from '@/lib/api/remoteSync';
import { jsonResponse, llmHookHarness } from '../fixtures/llm-hook-harness';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), useParams: () => ({ id: 'project' }), usePathname: () => '/projects/project/settings', useSearchParams: () => new URLSearchParams() }));
const session: Session = { user: { id: 'owner', name: 'Fixture Owner' }, accessToken: 'fixture-token', expires: '2099-01-01T00:00:00Z' };
const config: RemoteSyncConfig = { id: 'sync', project_id: 'project', repo_owner: 'external', repo_name: 'ontology', branch: 'develop', file_path: 'source.ttl', frequency: '24h', enabled: true, update_mode: 'auto_apply', status: 'idle', last_check_at: null, last_update_at: null, next_check_at: null, remote_commit_sha: null, pending_pr_id: null, error_message: null };
function mount(options: { config?: RemoteSyncConfig | null; linked?: boolean; webhook?: boolean; history?: SyncEvent[] } = {}) {
  let current = options.config ?? null;
  let failure: 'save' | 'delete' | 'check' | null = null;
  const integration = options.linked ? { id: 'github', repo_owner: 'external', repo_name: 'ontology', repo_url: 'https://github.com/external/ontology', default_branch: 'develop', ontology_file_path: 'source.ttl', sync_enabled: true, sync_status: 'idle', webhooks_enabled: options.webhook ?? false, github_hook_id: options.webhook ? 42 : null } : null;
  class Socket extends EventTarget { static OPEN = 1; static CONNECTING = 0; readyState = 1; close = vi.fn(); }
  vi.stubGlobal('WebSocket', Socket);
  const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const path = new URL(String(input)).pathname;
    if (path.includes('/remote-sync')) expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer fixture-token');
    if (path.endsWith('/remote-sync/history')) return jsonResponse({ items: options.history ?? [], total: options.history?.length ?? 0 });
    if (path.endsWith('/remote-sync/check')) return failure === 'check' ? new Response('Check refused', { status: 403 }) : jsonResponse({ job_id: 'job', status: 'pending', message: 'Queued' });
    if (path.endsWith('/remote-sync/jobs/job')) { current = { ...config, status: 'up_to_date' }; return jsonResponse({ job_id: 'job', status: 'complete', result: {}, error: null }); }
    if (path.endsWith('/remote-sync')) {
      if (init?.method === 'PUT') { if (failure === 'save') return new Response('Save refused', { status: 403 }); current = { ...config, ...JSON.parse(String(init.body)) }; }
      if (init?.method === 'DELETE') { if (failure === 'delete') return new Response('Remove refused', { status: 403 }); current = null; return new Response(null, { status: 204 }); }
      return jsonResponse(current);
    }
    if (path === '/api/v1/projects/project') return jsonResponse({ id: 'project', name: 'Fixture ontology', description: '', is_public: false, user_role: 'owner', owner_id: 'owner', member_count: 0, label_preferences: [], source_file_path: null });
    if (path.endsWith('/pr-party/me')) return jsonResponse({ is_reviewer: false });
    if (path.endsWith('/notifications')) return jsonResponse({ items: [], unread_count: 0 });
    if (path.endsWith('/trust/members')) return jsonResponse([]);
    if (path.endsWith('/members')) return jsonResponse({ items: [], total: 0 });
    if (path.endsWith('/pr-settings')) return jsonResponse({ pr_approval_required: 0, github_integration: integration });
    if (path.endsWith('/github-token')) return jsonResponse({ has_token: false });
    if (init?.method && init.method !== 'GET') throw new Error(`Unexpected mutation: ${init.method} ${path}`);
    return new Response('Ancillary settings unavailable', { status: 403 });
  });
  vi.stubGlobal('fetch', fetcher);
  const { client, wrapper: QueryWrapper } = llmHookHarness();
  render(<SessionProvider session={session} refetchOnWindowFocus={false}><QueryWrapper><ToastProvider><ProjectSettingsPage /></ToastProvider></QueryWrapper></SessionProvider>);
  return { fetcher, client, fail: (value: typeof failure) => { failure = value; } };
}
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
async function section() { return within((await screen.findByRole('heading', { name: 'Sync from Remote' })).closest('section')!); }
async function form() { const scope = await section(); fireEvent.click(await scope.findByRole('button', { name: /Configure Remote Source File|^Edit$/ })); return scope; }
function fill(scope: ReturnType<typeof within>) {
  fireEvent.change(scope.getByPlaceholderText('e.g. alea-institute'), { target: { value: ' external ' } });
  fireEvent.change(scope.getByPlaceholderText('e.g. FOLIO'), { target: { value: ' ontology ' } });
  fireEvent.change(scope.getByPlaceholderText('e.g. FOLIO.owl'), { target: { value: ' source.ttl ' } });
}

describe('remote tracking settings through the real page, hook and HTTP client', () => {
  it('rejects empty fields locally and clears validation when setup is cancelled', async () => {
    const { fetcher } = mount(); const scope = await form();
    fireEvent.click(scope.getByRole('button', { name: 'Enable Tracking' }));
    expect(scope.getByText('Repository owner, name, and file path are required.')).toBeDefined();
    expect(fetcher.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(false);
    fireEvent.click(scope.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(scope.getByRole('button', { name: 'Configure Remote Source File' }));
    expect(scope.queryByText('Repository owner, name, and file path are required.')).toBeNull();
  });
  it('trims fields, defaults a blank branch and persists disabled manual PR tracking', async () => {
    const { fetcher, client } = mount(); const scope = await form(); fill(scope);
    fireEvent.change(scope.getByPlaceholderText('main'), { target: { value: '   ' } });
    fireEvent.click(scope.getByLabelText('Enable remote tracking'));
    const [frequency, mode] = scope.getAllByRole('combobox');
    fireEvent.change(frequency, { target: { value: 'manual' } }); fireEvent.change(mode, { target: { value: 'review_required' } });
    expect(scope.queryByRole('option', { name: 'Webhook (instant)' })).toBeNull();
    fireEvent.click(scope.getByRole('button', { name: 'Enable Tracking' }));
    expect(await scope.findByText('Disabled · Always create PR')).toBeDefined();
    const request = fetcher.mock.calls.find(([, init]) => init?.method === 'PUT')!;
    const expected = { repo_owner: 'external', repo_name: 'ontology', branch: 'main', file_path: 'source.ttl', frequency: 'manual', enabled: false, update_mode: 'review_required' };
    expect(JSON.parse(String(request[1]?.body))).toEqual(expected);
    expect(client.getQueryData(remoteSyncQueryKeys.config('project', 'fixture-token'))).toMatchObject(expected);
  });
  it('keeps a failed save editable and clears the server error after retry', async () => {
    const { fail } = mount(); fail('save'); const scope = await form(); fill(scope);
    fireEvent.click(scope.getByRole('button', { name: 'Enable Tracking' }));
    expect(await scope.findByText('Save refused')).toBeDefined();
    expect((scope.getByPlaceholderText('e.g. FOLIO') as HTMLInputElement).value).toBe(' ontology ');
    fail(null); fireEvent.click(scope.getByRole('button', { name: 'Enable Tracking' }));
    expect(await scope.findByText('external/ontology')).toBeDefined(); expect(scope.queryByText('Save refused')).toBeNull();
  });
  it('restores all saved values on cancel, then updates an existing configuration', async () => {
    const { fetcher } = mount({ config }); const scope = await form(); fill(scope);
    fireEvent.change(scope.getByPlaceholderText('main'), { target: { value: ' draft ' } });
    fireEvent.click(scope.getByLabelText('Enable remote tracking'));
    fireEvent.change(scope.getAllByRole('combobox')[0], { target: { value: 'weekly' } });
    fireEvent.change(scope.getAllByRole('combobox')[1], { target: { value: 'review_required' } });
    fireEvent.click(scope.getByRole('button', { name: 'Cancel' })); fireEvent.click(scope.getByRole('button', { name: 'Edit' }));
    expect((scope.getByPlaceholderText('main') as HTMLInputElement).value).toBe('develop');
    expect((scope.getByLabelText('Enable remote tracking') as HTMLInputElement).checked).toBe(true);
    expect(scope.getAllByRole('combobox').map(node => (node as HTMLSelectElement).value)).toEqual(['24h', 'auto_apply']);
    expect((scope.getByPlaceholderText('e.g. FOLIO') as HTMLInputElement).value).toBe('ontology');
    fireEvent.change(scope.getByPlaceholderText('main'), { target: { value: ' release ' } });
    fireEvent.click(scope.getByRole('button', { name: 'Update Configuration' }));
    expect(await scope.findByText('source.ttl · release branch')).toBeDefined();
    expect(fetcher.mock.calls.filter(([, init]) => init?.method === 'PUT')).toHaveLength(1);
  });
  it('retains failed removal, retries and resets configuration and history caches', async () => {
    const { fail, client } = mount({ config }); const scope = await form(); fail('delete');
    fireEvent.click(scope.getByRole('button', { name: 'Remove' })); expect(await scope.findByText('Remove refused')).toBeDefined();
    expect(client.getQueryData(remoteSyncQueryKeys.config('project', 'fixture-token'))).toEqual(config);
    fail(null); fireEvent.click(scope.getByRole('button', { name: 'Remove' }));
    fireEvent.click(await scope.findByRole('button', { name: 'Configure Remote Source File' }));
    expect((scope.getByPlaceholderText('e.g. FOLIO') as HTMLInputElement).value).toBe('');
    expect((scope.getByPlaceholderText('main') as HTMLInputElement).value).toBe('main');
    expect(client.getQueryData(remoteSyncQueryKeys.config('project', 'fixture-token'))).toBeNull();
    expect(client.getQueryData(remoteSyncQueryKeys.history('project', 'fixture-token'))).toEqual([]);
  });
  it('identifies a linked repository and locks webhook-managed fields when configured', async () => {
    mount({ config: { ...config, frequency: 'webhook' }, linked: true, webhook: true }); const scope = await section();
    expect(await scope.findByText('Automatically triggered by GitHub webhooks')).toBeDefined();
    expect(scope.getByText('Tracking the same repo as your GitHub integration')).toBeDefined();
    fireEvent.click(scope.getByRole('button', { name: 'Edit' }));
    for (const input of scope.getAllByRole('textbox')) expect((input as HTMLInputElement).readOnly).toBe(true);
    expect(scope.getByRole('option', { name: 'Webhook (instant)' })).toBeDefined();
    expect(scope.getByText('Repository fields are managed by the GitHub integration.')).toBeDefined();
  });
  it('prefills new tracking from the linked repository without locking scheduled fields', async () => {
    mount({ linked: true }); const scope = await form();
    expect((scope.getByPlaceholderText('e.g. FOLIO') as HTMLInputElement).value).toBe('ontology');
    expect((scope.getByPlaceholderText('main') as HTMLInputElement).value).toBe('develop');
    expect((scope.getByPlaceholderText('e.g. FOLIO.owl') as HTMLInputElement).value).toBe('source.ttl');
    expect((scope.getByPlaceholderText('e.g. FOLIO') as HTMLInputElement).readOnly).toBe(false);
    expect(scope.getByText(/Remote tracking will only/)).toBeDefined();
  });
  it.each([
    ['up_to_date', 'Up to date', -60000, 'any moment'],
    ['idle', 'Idle', 1830000, '30m'],
    ['checking', 'Checking for remote changes...', 1830000, null],
    ['update_available', 'Update available from remote', 19800000, '5h'],
    ['error', 'Sync error', 216000000, '2d'],
  ] as const)('renders the %s server status with its applicable actions', async (status, label, nextCheckDelay, nextCheckLabel) => {
    mount({ config: { ...config, status, pending_pr_id: 'pr-42', error_message: 'Upstream denied access', last_check_at: '2026-01-01T00:00:00Z', next_check_at: new Date(Date.now() + nextCheckDelay).toISOString() } });
    const scope = await section(); expect(await scope.findByText(new RegExp(label.replaceAll('.', '\\.')))).toBeDefined();
    expect(scope.getByRole('button', { name: 'Check Now' }).hasAttribute('disabled')).toBe(status === 'checking');
    if (status === 'update_available') expect(scope.getByRole('link', { name: 'Review PR' }).getAttribute('href')).toBe('/projects/project/pull-requests/pr-42');
    if (status === 'error') expect(scope.getByText('Upstream denied access')).toBeDefined();
    if (nextCheckLabel) expect(scope.getByText(`Next check in ${nextCheckLabel}`)).toBeDefined();
    else expect(scope.queryByText(/Next check in/)).toBeNull();
  });
  it('toggles activity with every supported event and displays event details', async () => {
    const types = ['check_no_changes', 'update_found', 'auto_applied', 'pr_created', 'error'] as const;
    mount({ config, history: types.map((event_type, index) => ({ id: String(index), project_id: 'project', config_id: 'sync', event_type, remote_commit_sha: null, pr_id: null, changes_summary: index === 2 ? 'Added 3 classes' : null, error_message: index === 4 ? 'Remote file missing' : null, created_at: '2026-01-01T00:00:00Z' })) });
    const scope = await section(); fireEvent.click(await scope.findByRole('button', { name: 'Recent Activity' }));
    for (const label of ['No changes found', 'Update found', 'Auto-applied update', 'Created PR for review', 'Error', 'Added 3 classes', 'Remote file missing']) expect(scope.getByText(label)).toBeDefined();
    fireEvent.click(scope.getByRole('button', { name: 'Hide History' })); expect(scope.queryByText('Added 3 classes')).toBeNull();
  });
  it('recovers a rejected check and polls the real job endpoint until refreshed status arrives', async () => {
    const { fail, fetcher } = mount({ config }); const scope = await section(); fail('check');
    fireEvent.click(await scope.findByRole('button', { name: 'Check Now' })); expect(await scope.findByText('Check refused')).toBeDefined();
    fail(null); fireEvent.click(scope.getByRole('button', { name: 'Check Now' }));
    expect(await scope.findByRole('button', { name: 'Checking...' })).toBeDefined();
    await waitFor(() => expect(scope.getByText('Up to date')).toBeDefined(), { timeout: 4000 });
    expect(scope.queryByText('Check refused')).toBeNull();
    expect(fetcher.mock.calls.some(([url]) => String(url).endsWith('/remote-sync/jobs/job'))).toBe(true);
  });
});
