import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { SessionProvider } from 'next-auth/react';
import type { Session } from 'next-auth';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { projectQueryKeys } from '@/lib/hooks/useProject';
import Dashboard from '@/app/projects/[id]/dashboard/page';
import { jsonResponse, llmHookHarness } from '../fixtures/llm-hook-harness';

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'dashboard-project' }),
  usePathname: () => '/projects/dashboard-project/dashboard',
  useSearchParams: () => new URLSearchParams(window.location.search),
}));
const session: Session = { accessToken: 'dashboard-token', user: { name: 'Fixture' }, expires: '2099-01-01T00:00:00Z' };
const request = { id: 'join-1', project_id: 'dashboard-project', user_id: 'fixture', message: 'I can contribute', status: 'pending', created_at: '2026-01-01T00:00:00Z' };
function mount(options: { role?: string; public?: boolean; anonymous?: boolean; projectStatus?: number; pending?: boolean; declined?: boolean; count?: number; languages?: string[]; metadataError?: boolean; memberCount?: number; description?: string; updatedAt?: string; mineError?: boolean } = {}) {
  let pending = options.pending ?? false;
  let failMine = options.mineError ?? false;
  let failMutation = false;
  let languageReply: (() => Response | Promise<Response>) | undefined;
  const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const path = new URL(String(input)).pathname;
    if (path.endsWith('/pr-party/me')) return jsonResponse({ is_reviewer: false });
    if (path.endsWith('/notifications')) return jsonResponse({ items: [], unread_count: 0 });
    if (path === '/api/v1/projects/dashboard-project') return options.projectStatus ? jsonResponse({ detail: 'Unavailable' }, options.projectStatus) : jsonResponse({ id: 'dashboard-project', name: 'Connected ontology', is_public: options.public ?? true, user_role: options.role, member_count: options.memberCount ?? 1, description: options.description, updated_at: options.updatedAt, created_at: '2026-01-01T00:00:00Z' });
    if (path.endsWith('/my-reviewer-languages')) return languageReply ? languageReply() : options.metadataError ? new Response('Language lookup failed', { status: 503 }) : jsonResponse({ languages: options.languages ?? [] });
    if (path.endsWith('/join-requests/mine')) {
      if (failMine) { failMine = false; return jsonResponse({ detail: 'Status unavailable' }, 403); }
      return jsonResponse({ has_pending_request: pending, request: pending ? request : options.declined ? { ...request, status: 'declined' } : undefined });
    }
    if (path.endsWith('/join-requests/join-1') && init?.method === 'DELETE') {
      if (failMutation) return new Response('Withdrawal unavailable', { status: 503 });
      pending = false; return new Response(null, { status: 204 });
    }
    if (path.endsWith('/join-requests')) {
      if (init?.method === 'POST') {
        if (failMutation) return new Response('Join unavailable', { status: 503 });
        pending = true; return jsonResponse(request);
      }
      return options.metadataError ? new Response('Count unavailable', { status: 503 }) : jsonResponse({ items: [], total: options.count ?? 0 });
    }
    throw new Error(`Unexpected request: ${path}`);
  });
  vi.stubGlobal('fetch', fetcher);
  const { wrapper: QueryWrapper, client } = llmHookHarness();
  render(<SessionProvider session={options.anonymous ? null : session} refetchOnWindowFocus={false}><QueryWrapper><Dashboard /></QueryWrapper></SessionProvider>);
  return { fetcher, languages: (reply: () => Response | Promise<Response>) => { languageReply = reply; },
    role: (role: string) => {
      const key = projectQueryKeys.detail('dashboard-project', true);
      const current = client.getQueryData<Record<string, unknown>>(key)!;
      client.setQueryData(key, { ...current, user_role: role });
    }, fail: (value: boolean) => { failMutation = value; } };
}
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const main = () => within(screen.getByRole('main'));

describe('dashboard through project queries, permissions and join-request HTTP client', () => {
  it('keeps public navigation usable after a request-status error and refreshes status after submission', async () => {
    const { fetcher } = mount({ mineError: true });
    const join = await screen.findByRole('button', { name: 'Request to Join' });
    await waitFor(() => expect(fetcher.mock.calls.filter(([url]) => String(url).endsWith('/join-requests/mine'))).toHaveLength(1));
    await act(async () => {});
    expect(main().getByRole('link', { name: /^View Ontology/ }).getAttribute('href')).toBe('/projects/dashboard-project');
    expect(screen.queryByText('Request Pending')).toBeNull();
    expect(fetcher.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
    fireEvent.click(join);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'I can contribute' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit Request' }));
    expect(await screen.findByText('Request Pending')).toBeDefined();
    expect(fetcher.mock.calls.filter(([url]) => String(url).endsWith('/join-requests/mine'))).toHaveLength(2);
    expect(fetcher.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1);
  });

  it('creates a request, refreshes its server status and withdraws using authenticated HTTP calls', async () => {
    const { fetcher } = mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Request to Join' }));
    const submit = screen.getByRole('button', { name: 'Submit Request' });
    expect(submit.hasAttribute('disabled')).toBe(true);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'I can contribute' } });
    fireEvent.click(submit);
    expect(await screen.findByText('Request Pending')).toBeDefined();
    expect(screen.queryByRole('textbox')).toBeNull();
    const post = fetcher.mock.calls.find(([, init]) => init?.method === 'POST')!;
    expect(JSON.parse(String(post[1]?.body))).toEqual({ message: 'I can contribute' });
    expect(new Headers(post[1]?.headers).get('Authorization')).toBe('Bearer dashboard-token');
    expect(fetcher.mock.calls.filter(([url]) => String(url).endsWith('/join-requests/mine'))).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw' }));
    expect(await screen.findByRole('button', { name: 'Request to Join' })).toBeDefined();
    expect(screen.queryByText('Withdrawal unavailable')).toBeNull();
    const deletion = fetcher.mock.calls.find(([, init]) => init?.method === 'DELETE')!;
    expect(String(deletion[0])).toContain('/join-requests/join-1');
  });

  it('preserves the message after a submission error and allows retry', async () => {
    const { fail, fetcher } = mount(); fail(true);
    fireEvent.click(await screen.findByRole('button', { name: 'Request to Join' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'A useful contribution' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit Request' }));
    expect(await screen.findByText('Join unavailable')).toBeDefined();
    expect(screen.getByRole('textbox')).toHaveProperty('value', 'A useful contribution');
    fail(false); fireEvent.click(screen.getByRole('button', { name: 'Submit Request' }));
    expect(await screen.findByText('Request Pending')).toBeDefined();
    expect(fetcher.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(2);
  });

  it('allows a declined requester to cancel and clears the next form', async () => {
    mount({ declined: true });
    fireEvent.click(await screen.findByRole('button', { name: 'Request Again' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Replacement application' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('textbox')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Request Again' }));
    expect(screen.getByRole('textbox')).toHaveProperty('value', '');
    expect(screen.getByRole('button', { name: 'Submit Request' }).hasAttribute('disabled')).toBe(true);
  });

  it('retains pending status after a failed withdrawal and allows a successful retry', async () => {
    const { fail, fetcher } = mount({ pending: true }); fail(true);
    fireEvent.click(await screen.findByRole('button', { name: 'Withdraw' }));
    await waitFor(() => expect(fetcher.mock.calls.filter(([, init]) => init?.method === 'DELETE')).toHaveLength(1));
    expect(screen.getByText('Request Pending')).toBeDefined();
    expect(await screen.findByText('Withdrawal unavailable')).toBeDefined();
    fail(false); fireEvent.click(screen.getByRole('button', { name: 'Withdraw' }));
    expect(await screen.findByRole('button', { name: 'Request to Join' })).toBeDefined();
    expect(screen.queryByText('Withdrawal unavailable')).toBeNull();
  });

  it.each([1, 3])('shows the server-provided pending count to an owner (%s)', async count => {
    mount({ role: 'owner', count });
    const banner = await screen.findByRole('link', { name: new RegExp(`${count} pending join request`) });
    expect(banner.getAttribute('href')).toBe('/projects/dashboard-project/settings#join-requests');
    expect(main().getByRole('link', { name: 'Open Editor' }).getAttribute('href')).toBe('/projects/dashboard-project/editor');
    expect(main().getByRole('link', { name: 'Settings' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Request to Join' })).toBeNull();
  });

  it('keeps an owner dashboard usable when optional count and reviewer requests fail', async () => {
    const { fetcher } = mount({ role: 'owner', metadataError: true });
    expect(await screen.findByRole('heading', { name: 'Connected ontology' })).toBeDefined();
    await waitFor(() => {
      expect(fetcher.mock.calls.filter(([url]) => String(url).endsWith('/my-reviewer-languages'))).toHaveLength(3);
      expect(fetcher.mock.calls.filter(([url]) => String(url).endsWith('/join-requests'))).toHaveLength(3);
    }, { timeout: 4000 });
    expect(main().getByRole('link', { name: /Translation Review/ })).toBeDefined();
    expect(screen.queryByText(/pending join request/)).toBeNull();
  });

  it.each([false, true])('uses reviewer-language API data without granting editor access (reviewer: %s)', async reviewer => {
    const { fetcher } = mount({ role: 'viewer', public: false, languages: reviewer ? ['sw'] : [] });
    expect(await screen.findByRole('heading', { name: 'Connected ontology' })).toBeDefined();
    await waitFor(() => expect(fetcher.mock.calls.some(([url]) => String(url).endsWith('/my-reviewer-languages'))).toBe(true));
    if (reviewer) expect(await screen.findByRole('link', { name: /Translation Review/ })).toBeDefined();
    else expect(screen.queryByRole('link', { name: /Translation Review/ })).toBeNull();
    expect(main().getByRole('link', { name: /Translation Coverage/ }).getAttribute('href')).toBe('/projects/dashboard-project/translations');
    expect(main().queryByRole('link', { name: 'Open Editor' })).toBeNull();
    expect(main().queryByRole('link', { name: 'Settings' })).toBeNull();
    expect(fetcher.mock.calls.some(([url]) => String(url).includes('/join-requests'))).toBe(false);
  });

  it('removes reviewer navigation after an authoritative language failure and recovers on a later role refresh', async () => {
    const h = mount({ role: 'viewer', public: false, languages: ['sw'] });
    await screen.findByRole('link', { name: /Translation Review/ });
    h.languages(() => new Response('Reviewer lookup denied', { status: 403 }));
    act(() => h.role('suggester'));
    await waitFor(() => expect(screen.queryByRole('link', { name: /Translation Review/ })).toBeNull());
    expect(main().getByRole('link', { name: /Translation Coverage/ })).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Connected ontology' })).toBeDefined();
    h.languages(() => jsonResponse({ languages: ['fr'] }));
    act(() => h.role('viewer'));
    await screen.findByRole('link', { name: /Translation Review/ });
    expect(h.fetcher.mock.calls.filter(([url]) => String(url).endsWith('/my-reviewer-languages'))).toHaveLength(3);
  });

  it.each([200, 403])('ignores an old reviewer-language response after another role refresh (HTTP %s)', async status => {
    const h = mount({ role: 'viewer', public: false, languages: ['sw'] });
    await screen.findByRole('link', { name: /Translation Review/ });
    let finish!: (response: Response) => void;
    const pending = new Promise<Response>(resolve => { finish = resolve; });
    h.languages(() => pending);
    act(() => h.role('suggester'));
    await waitFor(() => expect(h.fetcher.mock.calls.filter(([url]) => String(url).endsWith('/my-reviewer-languages'))).toHaveLength(2));
    h.languages(() => jsonResponse({ languages: ['fr'] }));
    act(() => h.role('viewer'));
    await waitFor(() => expect(h.fetcher.mock.calls.filter(([url]) => String(url).endsWith('/my-reviewer-languages'))).toHaveLength(3));
    await act(async () => { finish(status === 200 ? jsonResponse({ languages: [] }) : new Response('Obsolete language failure', { status })); });
    expect(screen.getByRole('link', { name: /Translation Review/ })).toBeDefined();
    expect(screen.queryByText('Obsolete language failure')).toBeNull();
    expect(h.fetcher.mock.calls.every(([, init]) => init?.method === 'GET')).toBe(true);
  });

  it.each([0, 3])('renders descriptive metadata and the appropriate team navigation for %s members', async memberCount => {
    mount({ role: 'viewer', public: false, memberCount, description: 'A shared vocabulary', updatedAt: '2026-09-19T00:00:00Z' });
    await screen.findByRole('heading', { name: 'Connected ontology' });
    expect(screen.getByText('A shared vocabulary')).toBeDefined();
    expect(screen.getByText(`${memberCount} members`)).toBeDefined();
    expect(screen.getByText(/^Updated /).textContent).toContain('2026');
    if (memberCount === 0) expect(main().queryByRole('link', { name: /Team Members/ })).toBeNull();
    else expect(main().getByRole('link', { name: /Team Members/ }).getAttribute('href')).toBe('/projects/dashboard-project/settings#members');
    expect(main().queryByRole('link', { name: 'Settings' })).toBeNull();
  });

  it('shows public read-only navigation to an anonymous visitor without private metadata requests', async () => {
    const { fetcher } = mount({ anonymous: true });
    expect(await screen.findByRole('heading', { name: 'Connected ontology' })).toBeDefined();
    expect(main().queryByRole('link', { name: 'Open Editor' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Request to Join' })).toBeNull();
    expect(main().queryByRole('link', { name: /Translation Coverage/ })).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(new Headers(fetcher.mock.calls[0][1]?.headers).has('Authorization')).toBe(false);
  });

  it.each([
    { projectStatus: 404, anonymous: false, message: 'Project not found' },
    { projectStatus: 403, anonymous: false, message: "You don't have access to this project" },
    { projectStatus: 403, anonymous: true, message: 'This is a private project. Sign in to request access.' },
  ])('renders the real project error classification: $message', async ({ message, ...options }) => {
    mount(options);
    expect(await screen.findByRole('heading', { name: message })).toBeDefined();
    expect(main().getByRole('link', { name: 'Back to Projects' }).getAttribute('href')).toBe('/');
    expect(screen.queryByRole('button', { name: 'Request to Join' })).toBeNull();
  });
});
