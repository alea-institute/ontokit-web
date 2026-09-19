import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { SessionProvider } from 'next-auth/react';
import type { Session } from 'next-auth';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ProjectSettingsPage from '@/app/projects/[id]/settings/page';
import { ToastProvider } from '@/lib/context/ToastContext';
import { memberQueryKeys } from '@/lib/hooks/useMembers';
import { projectQueryKeys } from '@/lib/hooks/useProject';
import { jsonResponse, llmHookHarness } from '../fixtures/llm-hook-harness';

const navigation = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => navigation, useParams: () => ({ id: 'project' }), usePathname: () => '/projects/project/settings', useSearchParams: () => new URLSearchParams() }));
const session: Session = { user: { id: 'owner', name: 'Fixture Owner', email: 'fixture@example.invalid' }, accessToken: 'fixture-token', expires: '2099-01-01T00:00:00Z' };
const project = { id: 'project', name: 'Fixture ontology', description: 'Original description', is_public: false, user_role: 'owner', owner_id: 'owner', member_count: 0, label_preferences: [], source_file_path: null, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' };
function mount(options: { role?: string; exemplar?: boolean; superadmin?: boolean; loadStatus?: number; auth?: Session | null; withMember?: boolean; exemplarSource?: string; source?: boolean } = {}) {
  const initial = { ...project, source_file_path: options.source ? 'ontology.ttl' : null, exemplar_source_url: options.exemplarSource, user_role: options.role ?? 'owner', is_exemplar: options.exemplar ?? false, is_superadmin: options.superadmin ?? false };
  const member = { id: 'membership', user_id: 'editor', role: 'editor', can_self_merge_structural: false, user: { name: 'Fixture Editor', email: 'editor@example.invalid' } };
  let mutationFailure = false;
  class Socket extends EventTarget { static OPEN = 1; static CONNECTING = 0; readyState = 1; close = vi.fn(); }
  vi.stubGlobal('WebSocket', Socket);
  const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const path = new URL(String(input)).pathname;
    if (path.endsWith('/pr-party/me')) return jsonResponse({ is_reviewer: false });
    if (path.endsWith('/notifications')) return jsonResponse({ items: [], unread_count: 0 });
    if (path === '/api/v1/projects/project') {
      if (init?.method === 'PATCH') return mutationFailure ? new Response('Update refused', { status: 403 }) : jsonResponse({ ...initial, ...JSON.parse(String(init.body)) });
      if (init?.method === 'DELETE') return mutationFailure ? new Response('Delete refused', { status: 403 }) : new Response(null, { status: 204 });
      return options.loadStatus ? new Response('Project unavailable', { status: options.loadStatus }) : jsonResponse(initial);
    }
    if (path.endsWith('/members/editor') && init?.method === 'PATCH') return mutationFailure ? new Response('Member update refused', { status: 403 }) : jsonResponse({ ...member, ...JSON.parse(String(init.body)) });
    if (path.endsWith('/trust/members')) return jsonResponse([]);
    if (path.endsWith('/members')) return jsonResponse({ items: options.withMember ? [member] : [], total: options.withMember ? 1 : 0 });
    if (path.endsWith('/pr-settings')) return jsonResponse({ pr_approval_required: 0, github_integration: null });
    if (path.endsWith('/github-token')) return jsonResponse({ has_token: false });
    if (options.source && path.endsWith('/lint/config')) return jsonResponse({ project_id: 'project', lint_level: 1, enabled_rules: null, effective_rules: ['labels'], updated_at: null });
    if (options.source && path.endsWith('/lint/levels')) return jsonResponse({ levels: [{ level: 1, name: 'Basic', description: 'Basic checks', rule_ids: ['labels'] }] });
    if (options.source && path.endsWith('/lint/rules')) return jsonResponse({ rules: [{ rule_id: 'labels', name: 'Labels', description: 'Check labels', severity: 'warning', scope: ['class'] }] });
    if (options.source && path.endsWith('/lint/status')) return jsonResponse({ project_id: 'project', last_run: null, error_count: 0, warning_count: 0, info_count: 0, total_issues: 0 });
    if (init?.method && init.method !== 'GET') throw new Error(`Unexpected mutation: ${init.method} ${path}`);
    // Ancillary settings services are unavailable: the real children render their error states.
    return new Response('Ancillary settings unavailable', { status: 503 });
  });
  vi.stubGlobal('fetch', fetcher);
  const { client, wrapper: QueryWrapper } = llmHookHarness();
  const view = render(<SessionProvider session={options.auth === undefined ? session : options.auth} refetchOnWindowFocus={false}><QueryWrapper><ToastProvider><ProjectSettingsPage /></ToastProvider></QueryWrapper></SessionProvider>);
  return { ...view, fetcher, client, fail: (value: boolean) => { mutationFailure = value; } };
}
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); navigation.push.mockClear(); });
const main = () => within(screen.getByRole('main'));

describe('settings route through real project query, form and HTTP client', () => {
  it('loads an owner form even when independent settings services fail, and saves the returned project into the shared cache', async () => {
    const { fetcher, client } = mount();
    const name = await screen.findByLabelText(/Project Name/);
    fireEvent.change(name, { target: { value: '  Renamed ontology  ' } });
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: '  Updated description  ' } });
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(screen.getByText('Project settings saved successfully')).toBeDefined();
    const request = fetcher.mock.calls.find(([, init]) => init?.method === 'PATCH')!;
    expect(JSON.parse(String(request[1]?.body))).toEqual({ name: 'Renamed ontology', description: 'Updated description', is_public: false });
    expect(new Headers(request[1]?.headers).get('Authorization')).toBe('Bearer fixture-token');
    expect(client.getQueryData(projectQueryKeys.detail('project', true))).toMatchObject({ name: 'Renamed ontology', description: 'Updated description' });
    expect(navigation.push).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(2999); });
    expect(screen.getByText('Project settings saved successfully')).toBeDefined();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(screen.queryByText('Project settings saved successfully')).toBeNull();
    expect(client.getQueryData(projectQueryKeys.detail('project', true))).toMatchObject({ name: 'Renamed ontology' });
  });

  it.each(['https://example.org/ontology.ttl', 'javascript:alert(1)'])('displays exemplar provenance safely for %s', async source => {
    const { fetcher } = mount({ exemplarSource: source });
    await screen.findByText('Exemplar ontology');
    if (source.startsWith('https:')) {
      const link = screen.getByRole('link', { name: 'View remote source file' });
      expect(link.getAttribute('href')).toBe(source);
      expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    } else {
      expect(screen.queryByRole('link', { name: 'View remote source file' })).toBeNull();
      expect(screen.getByText(source).tagName).toBe('SPAN');
    }
    expect(fetcher.mock.calls.some(([url]) => String(url) === source)).toBe(false);
    expect(fetcher.mock.calls.every(([, init]) => !init?.method || init.method === 'GET')).toBe(true);
  });

  it('preserves the draft and cached project after a save error, then permits retry', async () => {
    const { fail, client } = mount(); fail(true);
    fireEvent.change(await screen.findByLabelText(/Project Name/), { target: { value: 'Retry name' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    expect(await screen.findByText('Update refused')).toBeDefined();
    expect(client.getQueryData(projectQueryKeys.detail('project', true))).toMatchObject({ name: project.name });
    expect((screen.getByLabelText(/Project Name/) as HTMLInputElement).value).toBe('Retry name');
    fail(false); fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    expect(await screen.findByText('Project settings saved successfully')).toBeDefined();
    expect(screen.queryByText('Update refused')).toBeNull();
  });

  it('loads real lint configuration for a viewer with source while preventing settings mutations', async () => {
    const { fetcher } = mount({ role: 'viewer', source: true });
    const toggle = await screen.findByRole('switch', { name: 'Toggle Labels' });
    await waitFor(() => expect(toggle.getAttribute('aria-checked')).toBe('true'));
    expect(toggle).toHaveProperty('disabled', true);
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    expect(screen.queryByRole('button', { name: 'Save Lint Configuration' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Save Changes' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete Project' })).toBeNull();
    expect(fetcher.mock.calls.some(([url]) => String(url).includes('/lint/config'))).toBe(true);
    expect(fetcher.mock.calls.some(([url]) => String(url).includes('/pr-settings'))).toBe(false);
    expect(fetcher.mock.calls.every(([, init]) => !init?.method || init.method === 'GET')).toBe(true);
  });

  it.each(['viewer', 'editor', 'suggester'])('shows read-only empty settings for %s and does not query administrative settings', async role => {
    const { fetcher } = mount({ role });
    expect(await screen.findByText('View project configuration (read-only)')).toBeDefined();
    expect(screen.getByText('No ontology source file has been configured for this project.')).toBeDefined();
    expect(main().queryByLabelText(/Project Name/)).toBeNull();
    expect(main().queryByRole('button', { name: 'Delete Project' })).toBeNull();
    expect(fetcher.mock.calls.some(([url]) => String(url).includes('pr-settings'))).toBe(false);
  });

  it.each([{ role: 'admin' }, { exemplar: true }])('withholds destructive controls for protected access %j', async options => {
    mount(options); await screen.findByLabelText(/Project Name/);
    expect(screen.queryByRole('button', { name: 'Delete Project' })).toBeNull();
  });

  it.each([false, true])('requires exact deletion confirmation and navigates after HTTP success (retry: %s)', async retry => {
    const { fetcher, fail } = mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Delete Project' }));
    const confirmation = screen.getByPlaceholderText(project.name);
    fireEvent.change(confirmation, { target: { value: project.name.toUpperCase() } });
    expect(screen.getByRole('button', { name: 'Delete Project' }).hasAttribute('disabled')).toBe(true);
    expect(fetcher.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(false);
    fireEvent.change(confirmation, { target: { value: project.name } });
    if (retry) {
      fail(true); fireEvent.click(screen.getByRole('button', { name: 'Delete Project' }));
      expect(await screen.findByText('Delete refused')).toBeDefined();
      expect(navigation.push).not.toHaveBeenCalled(); fail(false);
    }
    fireEvent.click(screen.getByRole('button', { name: 'Delete Project' }));
    await waitFor(() => expect(navigation.push).toHaveBeenCalledExactlyOnceWith('/'));
    expect(fetcher.mock.calls.filter(([, init]) => init?.method === 'DELETE')).toHaveLength(retry ? 2 : 1);
  });

  it.each([false, true])('persists structural self-merge permission through MemberList and the parent cache (retry: %s)', async retry => {
    const { fetcher, client, fail } = mount({ withMember: true });
    const toggle = await screen.findByLabelText('Structural self-merge');
    expect((toggle as HTMLInputElement).checked).toBe(false);
    if (retry) {
      fail(true); fireEvent.click(toggle);
      expect(await screen.findByText('Member update refused')).toBeDefined();
      expect((toggle as HTMLInputElement).checked).toBe(false);
      expect(client.getQueryData(memberQueryKeys.list('project'))).toMatchObject({ items: [{ can_self_merge_structural: false }] });
      fail(false);
    }
    fireEvent.click(toggle);
    await waitFor(() => expect((toggle as HTMLInputElement).checked).toBe(true));
    const request = fetcher.mock.calls.find(([url, init]) => String(url).endsWith('/members/editor') && init?.method === 'PATCH')!;
    expect(JSON.parse(String(request[1]?.body))).toEqual({ role: 'editor', can_self_merge_structural: true });
    expect(client.getQueryData(memberQueryKeys.list('project'))).toMatchObject({ items: [{ user_id: 'editor', can_self_merge_structural: true }] });
  });

  it('cancels deletion and clears the confirmation text before reopening', async () => {
    const { fetcher } = mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Delete Project' }));
    fireEvent.change(screen.getByPlaceholderText(project.name), { target: { value: project.name } });
    const danger = screen.getByRole('heading', { name: 'Danger Zone' }).closest('section')!;
    fireEvent.click(within(danger).getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete Project' }));
    expect((screen.getByPlaceholderText(project.name) as HTMLInputElement).value).toBe('');
    expect(screen.getByRole('button', { name: 'Delete Project' }).hasAttribute('disabled')).toBe(true);
    expect(fetcher.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(false);
  });

});
