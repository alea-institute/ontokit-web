import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { SessionProvider } from 'next-auth/react';
import type { Session } from 'next-auth';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ProjectSettingsPage from '@/app/projects/[id]/settings/page';
import { ToastProvider } from '@/lib/context/ToastContext';
import { projectQueryKeys } from '@/lib/hooks/useProject';
import { memberTrustQueryKeys } from '@/lib/hooks/useMemberTrust';
import type { MemberTrust } from '@/lib/api/trust';
import { memberQueryKeys } from '@/lib/hooks/useMembers';
import { jsonResponse, llmHookHarness } from '../fixtures/llm-hook-harness';

const navigation = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => navigation, useParams: () => ({ id: 'project' }), usePathname: () => '/projects/project/settings', useSearchParams: () => new URLSearchParams() }));
const session: Session = { user: { id: 'owner', name: 'Owner' }, accessToken: 'fixture-token', expires: '2099-01-01T00:00:00Z' };
const admin = { id: 'membership', user_id: 'admin', role: 'admin', user: { name: 'Target Admin', email: 'admin@example.invalid' } };
function mount(options: { member?: boolean; conflict?: boolean; public?: boolean; self?: boolean; suggester?: boolean; requestProfile?: 'email' | 'missing' } = {}) {
  let failure: 'add' | 'remove' | 'transfer' | 'forced' | 'approve' | 'decline' | 'trust' | null = null;
  let members = options.suggester ? [{ ...admin, role: 'suggester' }] : options.self ? [{ ...admin, user_id: 'owner' }] : options.member ? [admin] : [];
  let project = { id: 'project', name: 'Ontology', user_role: options.self ? 'admin' : 'owner', owner_id: options.self ? 'original-owner' : 'owner', member_count: members.length, label_preferences: [], source_file_path: null, is_public: options.public ?? false };
  let trust: MemberTrust = { user_id: 'admin', role: 'suggester', tier: 'untrusted', is_trusted: false, trust_override: 'none', accepted_count: 3 };
  let requests = [{ id: 'request', user_id: 'applicant', user: options.requestProfile === 'missing' ? undefined : options.requestProfile === 'email' ? { email: 'applicant@example.invalid' } : { name: 'Applicant', email: 'applicant@example.invalid' }, message: 'Please let me contribute', created_at: '2026-09-01T12:00:00Z' }];
  class Socket extends EventTarget { static OPEN = 1; static CONNECTING = 0; readyState = 1; close = vi.fn(); }
  vi.stubGlobal('WebSocket', Socket);
  const confirm = vi.fn().mockReturnValue(true); vi.stubGlobal('confirm', confirm);
  const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input)); const path = url.pathname;
    if (init?.method && init.method !== 'GET') expect(new Headers(init.headers).get('Authorization')).toBe('Bearer fixture-token');
    if (path.endsWith('/users/search')) return jsonResponse({ items: [{ id: 'admin', username: 'target', display_name: 'Target Admin', email: 'admin@example.invalid' }] });
    if (path.endsWith('/transfer-ownership')) {
      if (failure === 'transfer' || (failure === 'forced' && url.searchParams.get('force') === 'true')) return new Response('Transfer refused', { status: 403 });
      if (options.conflict && url.searchParams.get('force') !== 'true') return new Response('GitHub token missing', { status: 409 });
      members = [{ ...admin, role: 'owner' }]; project = { ...project, owner_id: 'admin', user_role: 'admin' }; return jsonResponse({ items: members, total: members.length });
    }
    if ((path.endsWith('/members/admin') || path.endsWith('/members/owner')) && init?.method === 'DELETE') {
      if (failure === 'remove') return new Response('Remove refused', { status: 403 });
      members = []; project = { ...project, member_count: 0 }; return new Response(null, { status: 204 });
    }
    if (path.endsWith('/join-requests/request/approve') || path.endsWith('/join-requests/request/decline')) {
      const approve = path.endsWith('/approve');
      if (failure === (approve ? 'approve' : 'decline')) return new Response('Decision refused', { status: 403 });
      requests = []; if (approve) { members = [{ ...admin, user_id: 'applicant', user: { name: 'Applicant', email: 'applicant@example.invalid' }, role: 'suggester' }]; project = { ...project, member_count: 1 }; }
      return jsonResponse({ status: approve ? 'approved' : 'declined' });
    }
    if (path.endsWith('/join-requests')) return jsonResponse({ items: requests, total: requests.length });
    if (path === '/api/v1/projects/project') return jsonResponse(project);
    if (path.endsWith('/pr-party/me')) return jsonResponse({ is_reviewer: false });
    if (path.endsWith('/notifications')) return jsonResponse({ items: [], unread_count: 0 });
    if (path.endsWith('/trust/members/admin') && init?.method === 'PATCH') {
      if (failure === 'trust') return new Response('Trust decision refused', { status: 403 });
      const { trust_override } = JSON.parse(String(init.body));
      trust = { ...trust, trust_override, is_trusted: trust_override === 'granted', tier: trust_override === 'granted' ? 'trusted' : 'untrusted' };
      return jsonResponse(trust);
    }
    if (path.endsWith('/trust/members')) return jsonResponse(options.suggester ? [trust] : []);
    if (path.endsWith('/members')) {
      if (init?.method === 'POST') {
        if (failure === 'add') return new Response('Add refused', { status: 403 });
        const added = { ...admin, ...JSON.parse(String(init.body)) }; members = [...members, added]; project = { ...project, member_count: members.length }; return jsonResponse(added);
      }
      return jsonResponse({ items: members, total: members.length });
    }
    if (path.endsWith('/pr-settings')) return jsonResponse({ pr_approval_required: 0, github_integration: null });
    if (path.endsWith('/github-token')) return jsonResponse({ has_token: false });
    if (init?.method && init.method !== 'GET') throw new Error(`Unexpected mutation: ${init.method} ${path}`);
    return new Response('Ancillary setting unavailable', { status: 403 });
  });
  vi.stubGlobal('fetch', fetcher);
  const { client, wrapper: QueryWrapper } = llmHookHarness();
  render(<SessionProvider session={session} refetchOnWindowFocus={false}><QueryWrapper><ToastProvider><ProjectSettingsPage /></ToastProvider></QueryWrapper></SessionProvider>);
  return { fetcher, confirm, client, fail: (value: typeof failure) => { failure = value; } };
}
async function section(name = 'Team Members') { return within((await screen.findByRole('heading', { name })).closest('section')!); }
async function memberMenu() { const ui = await section(); await ui.findByText('Target Admin'); fireEvent.click(ui.getByRole('button', { name: '' })); return ui; }
async function selectMember() {
  const ui = await section(); fireEvent.click(ui.getByRole('button', { name: 'Add Member' }));
  fireEvent.change(ui.getByPlaceholderText('Search by name, username, or email...'), { target: { value: 'Target' } });
  fireEvent.mouseDown(await ui.findByRole('option', { name: /Target Admin/ })); return ui;
}
const writes = (h: ReturnType<typeof mount>, suffix: string) => h.fetcher.mock.calls.filter(([url, init]) => new URL(String(url)).pathname.endsWith(suffix) && init?.method === 'POST');
afterEach(() => { cleanup(); vi.unstubAllGlobals(); navigation.push.mockClear(); });

describe('settings membership and join decisions through real UI and HTTP', () => {
  it.each([false, true])('grants a suggester trust and refreshes the authoritative member cache (retry: %s)', async retry => {
    const h = mount({ suggester: true });
    const ui = await section();
    if (retry) h.fail('trust');
    fireEvent.click(await ui.findByRole('button', { name: /Trust status/ }));
    fireEvent.click(ui.getByRole('menuitem', { name: /Grant trusted/ }));
    if (retry) {
      expect((await ui.findByRole('alert')).textContent).toBe('Trust decision refused');
      expect(h.client.getQueryData(memberTrustQueryKeys.list('project', 'owner'))).toMatchObject([{ trust_override: 'none' }]);
      h.fail(null);
      fireEvent.click(ui.getByRole('button', { name: /Trust status/ }));
      fireEvent.click(ui.getByRole('menuitem', { name: /Grant trusted/ }));
    }
    await waitFor(() => expect(h.client.getQueryData(memberTrustQueryKeys.list('project', 'owner'))).toMatchObject([{ user_id: 'admin', trust_override: 'granted', is_trusted: true }]));
    expect(ui.getByText('Trusted (granted)')).toBeDefined();
    expect(ui.queryByRole('alert')).toBeNull();
    const writes = h.fetcher.mock.calls.filter(([url, init]) => String(url).endsWith('/trust/members/admin') && init?.method === 'PATCH');
    expect(writes).toHaveLength(retry ? 2 : 1);
    expect(JSON.parse(String(writes.at(-1)![1]?.body))).toEqual({ trust_override: 'granted' });
    expect(h.fetcher.mock.calls.filter(([url]) => String(url).endsWith('/trust/members'))).toHaveLength(2);
  });

  it('searches users and adds an admin, updating shared member and project caches', async () => {
    const h = mount(); const ui = await selectMember(); fireEvent.change(ui.getByRole('combobox'), { target: { value: 'admin' } });
    fireEvent.click(ui.getByRole('button', { name: 'Add' })); await screen.findByText('Member added successfully');
    expect(JSON.parse(String(writes(h, '/members')[0][1]?.body))).toEqual({ user_id: 'admin', role: 'admin' });
    expect(h.client.getQueryData(projectQueryKeys.detail('project', true))).toMatchObject({ member_count: 1 });
    expect(h.client.getQueryData(memberQueryKeys.list('project'))).toMatchObject({ total: 1, items: [{ user_id: 'admin', role: 'admin' }] });
    expect(ui.queryByText('Add a new member')).toBeNull(); expect(ui.getByText('Target Admin')).toBeDefined();
  });

  it.each(['clear button', 'edit query'])('clears a selected member with %s before a new selection', async action => {
    const h = mount(); const ui = await selectMember();
    const search = ui.getByPlaceholderText('Search by name, username, or email...') as HTMLInputElement;
    expect((ui.getByRole('button', { name: 'Add' }) as HTMLButtonElement).disabled).toBe(false);
    if (action === 'clear button') fireEvent.click(within(search.parentElement!).getByRole('button'));
    else fireEvent.change(search, { target: { value: 'Someone else' } });
    expect((ui.getByRole('button', { name: 'Add' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(ui.getByRole('button', { name: 'Add' }));
    expect(writes(h, '/members')).toHaveLength(0);
    fireEvent.change(search, { target: { value: 'Target' } });
    fireEvent.mouseDown(await ui.findByRole('option', { name: /Target Admin/ }));
    fireEvent.click(ui.getByRole('button', { name: 'Add' }));
    await screen.findByText('Member added successfully');
    expect(writes(h, '/members')).toHaveLength(1);
    expect(JSON.parse(String(writes(h, '/members')[0][1]?.body)).user_id).toBe('admin');
  });

  it('retains a rejected member draft and clears it on successful retry', async () => {
    const h = mount(); h.fail('add'); const ui = await selectMember(); fireEvent.click(ui.getByRole('button', { name: 'Add' }));
    await ui.findByText('Add refused'); expect(h.client.getQueryData(projectQueryKeys.detail('project', true))).toMatchObject({ member_count: 0 });
    h.fail(null); fireEvent.click(ui.getByRole('button', { name: 'Add' })); await screen.findByText('Member added successfully');
    expect(writes(h, '/members')).toHaveLength(2);
  });

  it('clears the add-member error and selected identity on cancel', async () => {
    const h = mount(); h.fail('add'); const ui = await selectMember(); fireEvent.click(ui.getByRole('button', { name: 'Add' })); await ui.findByText('Add refused');
    fireEvent.click(ui.getByRole('button', { name: 'Cancel' })); fireEvent.click(ui.getByRole('button', { name: 'Add Member' }));
    expect(ui.queryByText('Add refused')).toBeNull(); expect(ui.getByRole('button', { name: 'Add' }).hasAttribute('disabled')).toBe(true);
  });

  it('keeps a member on removal error and removes it from the real cache on retry', async () => {
    const h = mount({ member: true }); h.fail('remove'); let ui = await memberMenu(); fireEvent.click(ui.getByRole('button', { name: 'Remove member' }));
    await screen.findByText('Remove refused'); expect(ui.getByText('Target Admin')).toBeDefined(); h.fail(null);
    ui = await memberMenu(); fireEvent.click(ui.getByRole('button', { name: 'Remove member' })); await waitFor(() => expect(ui.queryByText('Target Admin')).toBeNull());
    expect(screen.queryByText('Remove refused')).toBeNull();
    expect(h.client.getQueryData(projectQueryKeys.detail('project', true))).toMatchObject({ member_count: 0 });
  });

  it('redirects after an administrator removes their own membership', async () => {
    const h = mount({ self: true }); const ui = await memberMenu();
    fireEvent.click(ui.getByRole('button', { name: 'Leave project' }));
    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith('/'));
    expect(h.client.getQueryData(memberQueryKeys.list('project'))).toMatchObject({ items: [], total: 0 });
  });

  it('cancels an ownership transfer before sending a request', async () => {
    const h = mount({ member: true }); h.confirm.mockReturnValue(false); const ui = await memberMenu(); fireEvent.click(ui.getByRole('button', { name: 'Transfer Ownership' }));
    expect(h.confirm).toHaveBeenCalledWith(expect.stringContaining('Target Admin')); expect(writes(h, '/transfer-ownership')).toHaveLength(0);
  });

  it.each([false, true])('transfers ownership and refreshes owner-only controls (GitHub conflict: %s)', async conflict => {
    const h = mount({ member: true, conflict }); const ui = await memberMenu(); fireEvent.click(ui.getByRole('button', { name: 'Transfer Ownership' }));
    await screen.findByText(conflict ? 'Ownership transferred. GitHub integration was disconnected because the new owner has no GitHub token.' : 'Ownership transferred successfully');
    expect(h.client.getQueryData(projectQueryKeys.detail('project', true))).toMatchObject({ owner_id: 'admin', user_role: 'admin' });
    expect(screen.queryByRole('heading', { name: 'Pull Request Settings' })).toBeNull();
    const requests = writes(h, '/transfer-ownership'); expect(requests).toHaveLength(conflict ? 2 : 1);
    expect(JSON.parse(String(requests[0][1]?.body))).toEqual({ new_owner_id: 'admin' });
    if (conflict) expect(new URL(String(requests[1][0])).searchParams.get('force')).toBe('true');
  });

  it('cancels the conflict confirmation without forcing ownership transfer', async () => {
    const h = mount({ member: true, conflict: true }); h.confirm.mockReturnValueOnce(true).mockReturnValueOnce(false);
    const ui = await memberMenu(); fireEvent.click(ui.getByRole('button', { name: 'Transfer Ownership' }));
    await waitFor(() => expect(h.confirm).toHaveBeenCalledTimes(2)); expect(writes(h, '/transfer-ownership')).toHaveLength(1);
    expect(h.client.getQueryData(projectQueryKeys.detail('project', true))).toMatchObject({ owner_id: 'owner' });
  });

  it.each(['transfer', 'forced'] as const)('preserves ownership after a rejected %s request', async failure => {
    const h = mount({ member: true, conflict: failure === 'forced' }); h.fail(failure); const ui = await memberMenu();
    fireEvent.click(ui.getByRole('button', { name: 'Transfer Ownership' })); await screen.findByText('Transfer refused');
    expect(h.client.getQueryData(projectQueryKeys.detail('project', true))).toMatchObject({ owner_id: 'owner' });
    expect(screen.getByRole('heading', { name: 'Pull Request Settings' })).toBeDefined();
  });

  it.each(['email', 'missing'] as const)('identifies a join request with a %s profile and declines the correct request', async requestProfile => {
    const h = mount({ public: true, requestProfile });
    const ui = await section('Join Requests');
    expect(await ui.findByText(requestProfile === 'email' ? 'applicant@example.invalid' : 'applicant')).toBeDefined();
    expect(ui.getByText(/Please let me contribute/)).toBeDefined();
    fireEvent.click(ui.getByRole('button', { name: 'Decline' }));
    await ui.findByText('No pending join requests.');
    expect(screen.queryByText('Decision refused')).toBeNull();
    expect(writes(h, '/join-requests/request/decline')).toHaveLength(1);
    expect(writes(h, '/join-requests/request/approve')).toHaveLength(0);
    expect((await section()).queryByText('Applicant')).toBeNull();
  });

  it.each(['approve', 'decline'] as const)('retries a rejected %s decision and refreshes the pending list', async decision => {
    const h = mount({ public: true }); h.fail(decision); const ui = await section('Join Requests'); await ui.findByText('Applicant');
    const label = decision === 'approve' ? 'Approve' : 'Decline'; fireEvent.click(ui.getByRole('button', { name: label })); await screen.findByText('Decision refused');
    expect(ui.getByText('Applicant')).toBeDefined(); h.fail(null); fireEvent.click(ui.getByRole('button', { name: label })); await ui.findByText('No pending join requests.');
    expect(screen.queryByText('Decision refused')).toBeNull();
    expect(writes(h, '/join-requests/request/' + decision)).toHaveLength(2);
    if (decision === 'approve') expect(await (await section()).findByText('Applicant')).toBeDefined();
    else expect((await section()).queryByText('Applicant')).toBeNull();
  });
});
