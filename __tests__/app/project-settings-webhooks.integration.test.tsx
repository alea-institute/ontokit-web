import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { SessionProvider } from 'next-auth/react';
import type { Session } from 'next-auth';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ProjectSettingsPage from '@/app/projects/[id]/settings/page';
import { ToastProvider } from '@/lib/context/ToastContext';
import { jsonResponse, llmHookHarness } from '../fixtures/llm-hook-harness';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), useParams: () => ({ id: 'project' }), usePathname: () => '/projects/project/settings', useSearchParams: () => new URLSearchParams() }));
const session: Session = { user: { id: 'owner', name: 'Owner' }, accessToken: 'fixture-token', expires: '2099-01-01T00:00:00Z' };
function mount(enabled = false, hookId: number | null = null) {
  let integration = { id: 'github', repo_owner: 'example', repo_name: 'ontology', repo_url: 'https://github.com/example/ontology', default_branch: 'main', ontology_file_path: 'source.ttl', sync_enabled: true, sync_status: 'idle', webhooks_enabled: enabled, github_hook_id: hookId };
  let errorBody = 'Setup refused';
  let failure: 'update' | 'setup' | 'secret' | 'network' | null = null;
  let setup = { status: 'created', github_hook_id: 42 as number | null, message: 'Webhook created' };
  class Socket extends EventTarget { static OPEN = 1; static CONNECTING = 0; readyState = 1; close = vi.fn(); }
  vi.stubGlobal('WebSocket', Socket);
  const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(input)).pathname;
    if (path.includes('/github-integration')) expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer fixture-token');
    if (path.endsWith('/webhook-setup') && failure === 'network') throw new TypeError('Failed to fetch');
    if (path.endsWith('/webhook-setup')) return failure === 'setup' ? new Response(errorBody, { status: 403 }) : jsonResponse(setup);
    if (path.endsWith('/webhook-secret')) return failure === 'secret' ? new Response('Details refused', { status: 403 }) : jsonResponse({ webhook_secret: 'synthetic-webhook-value', webhook_url: '/api/v1/webhooks/project' });
    if (path.endsWith('/github-integration') && init?.method === 'PATCH') {
      if (failure === 'update') return new Response('Update refused', { status: 403 });
      integration = { ...integration, ...JSON.parse(String(init.body)) }; return jsonResponse(integration);
    }
    if (path === '/api/v1/projects/project') return jsonResponse({ id: 'project', name: 'Ontology', user_role: 'owner', owner_id: 'owner', member_count: 0, label_preferences: [], source_file_path: null, is_public: false });
    if (path.endsWith('/pr-party/me')) return jsonResponse({ is_reviewer: false });
    if (path.endsWith('/notifications')) return jsonResponse({ items: [], unread_count: 0 });
    if (path.endsWith('/trust/members')) return jsonResponse([]);
    if (path.endsWith('/members')) return jsonResponse({ items: [], total: 0 });
    if (path.endsWith('/pr-settings')) return jsonResponse({ pr_approval_required: 0, github_integration: integration });
    if (path.endsWith('/github-token')) return jsonResponse({ has_token: false });
    if (init?.method && init.method !== 'GET') throw new Error(`Unexpected mutation: ${init.method} ${path}`);
    return new Response('Ancillary setting unavailable', { status: 403 });
  });
  vi.stubGlobal('fetch', fetcher);
  const { wrapper: QueryWrapper } = llmHookHarness();
  const view = render(<SessionProvider session={session} refetchOnWindowFocus={false}><QueryWrapper><ToastProvider><ProjectSettingsPage /></ToastProvider></QueryWrapper></SessionProvider>);
  return { ...view, fetcher, errorBody: (value: string) => { errorBody = value; }, fail: (value: typeof failure) => { failure = value; }, setup: (value: typeof setup) => { setup = value; } };
}
async function section() {
  const heading = await screen.findByRole('heading', { name: 'GitHub Integration' });
  const ui = within(heading.closest('section')!);
  await ui.findByText('example/ontology'); return ui;
}
const setups = (h: ReturnType<typeof mount>) => h.fetcher.mock.calls.filter(([url]) => String(url).endsWith('/webhook-setup'));
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('webhook settings through the real settings route and GitHub HTTP client', () => {
  it.each([
    { body: '{"detail":"Repository permission is missing"}', message: 'Repository permission is missing' },
    { body: '{"message":"Hook policy rejected"}', message: '{"message":"Hook policy rejected"}' },
  ])('shows a structured setup failure and recovers through manual retry: $body', async ({ body, message }) => {
    const h = mount(); h.fail('setup'); h.errorBody(body);
    const ui = await section();
    fireEvent.click(ui.getByRole('checkbox'));
    await ui.findByText(message);
    expect((ui.getByRole('checkbox') as HTMLInputElement).checked).toBe(true);
    expect(setups(h)).toHaveLength(1);
    fireEvent.click(ui.getByRole('button', { name: 'Retry auto-setup' }));
    await waitFor(() => expect(setups(h)).toHaveLength(2));
    await ui.findByText(message);
    h.fail(null);
    fireEvent.click(ui.getByRole('button', { name: 'Retry auto-setup' }));
    await ui.findByText('Webhook configured on GitHub');
    expect(ui.queryByText(message)).toBeNull();
    expect(setups(h)).toHaveLength(3);
    expect(h.fetcher.mock.calls.filter(([, init]) => init?.method === 'PATCH')).toHaveLength(1);
  });

  it('recovers webhook setup after a transport failure without enabling it twice', async () => {
    const h = mount(); h.fail('network');
    const ui = await section();
    fireEvent.click(ui.getByRole('checkbox'));
    await ui.findByText('Failed to fetch');
    expect((ui.getByRole('checkbox') as HTMLInputElement).checked).toBe(true);
    expect(setups(h)).toHaveLength(1);
    h.fail(null);
    fireEvent.click(ui.getByRole('button', { name: 'Retry auto-setup' }));
    await ui.findByText('Webhook configured on GitHub');
    expect(ui.queryByText('Failed to fetch')).toBeNull();
    expect(setups(h)).toHaveLength(2);
    expect(h.fetcher.mock.calls.filter(([, init]) => init?.method === 'PATCH')).toHaveLength(1);
  });

  it('renders an existing configured hook without creating another hook', async () => {
    const h = mount(true, 42); const ui = await section();
    expect(await ui.findByText('Webhook configured on GitHub')).toBeDefined();
    expect((ui.getByRole('checkbox') as HTMLInputElement).checked).toBe(true);
    expect(ui.queryByRole('button', { name: 'Show manual setup details' })).toBeNull();
    expect(setups(h)).toHaveLength(0);
  });

  it('enables webhooks, creates the hook, and disables it through authenticated requests', async () => {
    const h = mount(); const ui = await section(); fireEvent.click(ui.getByRole('checkbox'));
    await ui.findByText('Webhook configured on GitHub');
    expect(setups(h)).toHaveLength(1);
    expect(setups(h)[0][1]?.method).toBe('POST');
    fireEvent.click(ui.getByRole('checkbox'));
    await waitFor(() => expect((ui.getByRole('checkbox') as HTMLInputElement).checked).toBe(false));
    expect(ui.queryByText('Webhook configured on GitHub')).toBeNull();
    const updates = h.fetcher.mock.calls.filter(([, init]) => init?.method === 'PATCH');
    expect(updates.map(([, init]) => JSON.parse(String(init?.body)))).toEqual([{ webhooks_enabled: true }, { webhooks_enabled: false }]);
  });

  it.each(['no_scope', 'no_token', 'manual_required', 'error'])('offers manual setup after %s and retries successfully', async status => {
    const h = mount(); h.setup({ status, github_hook_id: null, message: 'Manual action needed' }); const ui = await section();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    await act(async () => { fireEvent.click(ui.getByRole('checkbox')); });
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    vi.useRealTimers();
    expect(setups(h)).toHaveLength(1);
    await ui.findByText('Manual action needed');
    expect(ui.getByRole('button', { name: 'Show manual setup details' })).toBeDefined();
    h.setup({ status: 'configured', github_hook_id: 55, message: 'Ready' });
    fireEvent.click(ui.getByRole('button', { name: 'Retry auto-setup' }));
    await ui.findByText('Webhook configured on GitHub');
    expect(ui.queryByText('Manual action needed')).toBeNull(); expect(setups(h)).toHaveLength(2);
  });

  it('recovers from automatic and manual setup HTTP failures', async () => {
    const h = mount(); h.fail('setup'); const ui = await section();
    fireEvent.click(ui.getByRole('checkbox')); await ui.findByText('Setup refused');
    fireEvent.click(ui.getByRole('button', { name: 'Retry auto-setup' }));
    await waitFor(() => expect(setups(h)).toHaveLength(2)); await ui.findByText('Setup refused');
    h.fail(null); fireEvent.click(ui.getByRole('button', { name: 'Retry auto-setup' }));
    await ui.findByText('Webhook configured on GitHub'); expect(setups(h)).toHaveLength(3);
  });

  it('offers fallback when enabling fails and clears the error on retry', async () => {
    const h = mount(); h.fail('update'); const ui = await section(); fireEvent.click(ui.getByRole('checkbox'));
    await ui.findByText('Update refused'); expect((ui.getByRole('checkbox') as HTMLInputElement).checked).toBe(false);
    expect(ui.getByRole('button', { name: 'Show manual setup details' })).toBeDefined(); expect(setups(h)).toHaveLength(0);
    h.fail(null); fireEvent.click(ui.getByRole('checkbox')); await ui.findByText('Webhook configured on GitHub');
    expect(ui.queryByText('Update refused')).toBeNull();
  });

  it('keeps an existing hook enabled when disabling fails without offering manual fallback', async () => {
    const h = mount(true, 42); h.fail('update'); const ui = await section(); fireEvent.click(ui.getByRole('checkbox'));
    await ui.findByText('Update refused'); expect((ui.getByRole('checkbox') as HTMLInputElement).checked).toBe(true);
    expect(ui.queryByRole('button', { name: 'Show manual setup details' })).toBeNull();
    expect(setups(h)).toHaveLength(0);
  });

  it('retries manual-detail retrieval, toggles the synthetic value, and clears details on disable', async () => {
    const h = mount(true); h.fail('secret'); const ui = await section();
    fireEvent.click(ui.getByRole('button', { name: 'Show manual setup details' })); await ui.findByText('Failed to retrieve webhook secret');
    h.fail(null); fireEvent.click(ui.getByRole('button', { name: 'Show manual setup details' }));
    const value = await ui.findByText('synthetic-webhook-value');
    expect(ui.queryByText('Failed to retrieve webhook secret')).toBeNull();
    const controls = within(value.parentElement!).getAllByRole('button');
    fireEvent.click(controls[0]); expect(ui.queryByText('synthetic-webhook-value')).toBeNull();
    fireEvent.click(controls[0]); expect(ui.getByText('synthetic-webhook-value')).toBeDefined();
    fireEvent.click(ui.getByRole('checkbox'));
    await waitFor(() => expect(ui.queryByText('synthetic-webhook-value')).toBeNull());
  });

  it('copies the manual payload URL and synthetic value through the browser clipboard', async () => {
    const h = mount(true); const ui = await section();
    const writeText = vi.fn().mockResolvedValue(undefined);
    const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    try {
      fireEvent.click(ui.getByRole('button', { name: 'Show manual setup details' }));
      const value = await ui.findByText('synthetic-webhook-value');
      const url = ui.getByText(/http.*\/api\/v1\/webhooks\/project/);
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      const copyUrl = within(url.parentElement!).getByRole('button');
      await act(async () => { fireEvent.click(copyUrl); });
      expect(writeText).toHaveBeenLastCalledWith(url.textContent);
      expect(copyUrl.querySelector('.lucide-check')).not.toBeNull();
      await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
      expect(copyUrl.querySelector('.lucide-check')).toBeNull();
      expect(copyUrl.querySelector('.lucide-copy')).not.toBeNull();
      const copyValue = within(value.parentElement!).getAllByRole('button')[1];
      await act(async () => { fireEvent.click(copyValue); });
      expect(writeText).toHaveBeenLastCalledWith('synthetic-webhook-value');
      expect(copyValue.querySelector('.lucide-check')).not.toBeNull();
      await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
      expect(copyValue.querySelector('.lucide-check')).toBeNull();
      expect(copyValue.querySelector('.lucide-copy')).not.toBeNull();
      expect(writeText).toHaveBeenCalledTimes(2);
      expect(h.fetcher.mock.calls.filter(([input]) => String(input).endsWith('/webhook-secret'))).toHaveLength(1);
    } finally {
      if (original) Object.defineProperty(navigator, 'clipboard', original); else Reflect.deleteProperty(navigator, 'clipboard');
    }
  });

  it('shows a successful creation response even when no hook identifier is returned', async () => {
    const h = mount(); h.setup({ status: 'created', github_hook_id: null, message: 'Created' });
    const ui = await section(); fireEvent.click(ui.getByRole('checkbox'));
    await ui.findByText('Webhook auto-created on GitHub');
    expect(ui.queryByRole('button', { name: 'Show manual setup details' })).toBeNull();
  });

  it.each(['disable', 'unmount'])('cancels delayed automatic setup on %s', async action => {
    const h = mount(); const ui = await section();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    await act(async () => { fireEvent.click(ui.getByRole('checkbox')); });
    expect((ui.getByRole('checkbox') as HTMLInputElement).checked).toBe(true);
    if (action === 'disable') await act(async () => { fireEvent.click(ui.getByRole('checkbox')); });
    else h.unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(200); });
    expect(setups(h)).toHaveLength(0);
  });
});
