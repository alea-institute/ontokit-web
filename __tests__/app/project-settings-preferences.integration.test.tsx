import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { SessionProvider } from 'next-auth/react';
import type { Session } from 'next-auth';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ProjectSettingsPage from '@/app/projects/[id]/settings/page';
import { ToastProvider } from '@/lib/context/ToastContext';
import { projectQueryKeys } from '@/lib/hooks/useProject';
import { jsonResponse, llmHookHarness } from '../fixtures/llm-hook-harness';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), useParams: () => ({ id: 'project' }), usePathname: () => '/projects/project/settings', useSearchParams: () => new URLSearchParams() }));
const session: Session = { user: { id: 'owner', name: 'Owner' }, accessToken: 'fixture-token', expires: '2099-01-01T00:00:00Z' };
function mount() {
  let failure = false;
  let project = { id: 'project', name: 'Ontology', user_role: 'owner', owner_id: 'owner', member_count: 0, label_preferences: [] as string[], source_file_path: 'ontology.ttl', is_public: false };
  class Socket extends EventTarget { static OPEN = 1; static CONNECTING = 0; readyState = 1; close = vi.fn(); }
  vi.stubGlobal('WebSocket', Socket);
  const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(input)).pathname;
    if (init?.method === 'PATCH') {
      expect(new Headers(init.headers).get('Authorization')).toBe('Bearer fixture-token');
      if (failure) return new Response('Save refused', { status: 403 });
      const body = JSON.parse(String(init.body));
      if (path.endsWith('/pr-settings')) return jsonResponse({ pr_approval_required: body.pr_approval_required, github_integration: null });
      if (path === '/api/v1/projects/project') { project = { ...project, ...body }; return jsonResponse(project); }
      throw new Error('Unexpected PATCH ' + path);
    }
    if (path === '/api/v1/projects/project') return jsonResponse(project);
    if (path.endsWith('/pr-party/me')) return jsonResponse({ is_reviewer: false });
    if (path.endsWith('/notifications')) return jsonResponse({ items: [], unread_count: 0 });
    if (path.endsWith('/trust/members')) return jsonResponse([]);
    if (path.endsWith('/members')) return jsonResponse({ items: [], total: 0 });
    if (path.endsWith('/pr-settings')) return jsonResponse({ pr_approval_required: 2, github_integration: null });
    if (path.endsWith('/github-token')) return jsonResponse({ has_token: false });
    if (init?.method && init.method !== 'GET') throw new Error(`Unexpected mutation: ${init.method} ${path}`);
    return new Response('Ancillary setting unavailable', { status: 403 });
  });
  vi.stubGlobal('fetch', fetcher);
  const { client, wrapper: QueryWrapper } = llmHookHarness();
  render(<SessionProvider session={session} refetchOnWindowFocus={false}><QueryWrapper><ToastProvider><ProjectSettingsPage /></ToastProvider></QueryWrapper></SessionProvider>);
  return { fetcher, client, fail: (value: boolean) => { failure = value; } };
}
async function section(name: string) { return within((await screen.findByRole('heading', { name })).closest('section')!); }
const bodies = (h: ReturnType<typeof mount>) => h.fetcher.mock.calls.filter(([, init]) => init?.method === 'PATCH').map(([, init]) => JSON.parse(String(init?.body)));
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('settings preference persistence through real form components and HTTP clients', () => {
  it('adds distinct label preferences, reorders them and persists priority in the shared cache', async () => {
    const h = mount(); const ui = await section('Label Preferences');
    expect(ui.getByText(/No preferences configured/)).toBeDefined();
    const [property, language] = ui.getAllByRole('combobox');
    fireEvent.change(property, { target: { value: 'skos:prefLabel' } }); fireEvent.change(language, { target: { value: 'fr' } });
    fireEvent.click(ui.getByRole('button', { name: 'Add' })); fireEvent.click(ui.getByRole('button', { name: 'Add' }));
    expect(ui.getAllByRole('listitem')).toHaveLength(1);
    fireEvent.change(property, { target: { value: 'rdfs:label' } }); fireEvent.change(language, { target: { value: '' } }); fireEvent.click(ui.getByRole('button', { name: 'Add' }));
    fireEvent.click(ui.getAllByTitle('Move up')[1]);
    fireEvent.click(ui.getByRole('button', { name: 'Save Preferences' })); await ui.findByText('Preferences saved');
    expect(bodies(h)).toEqual([{ label_preferences: ['rdfs:label', 'skos:prefLabel@fr'] }]);
    expect(h.client.getQueryData(projectQueryKeys.detail('project', true))).toMatchObject({ label_preferences: ['rdfs:label', 'skos:prefLabel@fr'] });
  });

  it('retains unsaved label choices on HTTP failure and saves an empty list after removing the last entry', async () => {
    const h = mount(); h.fail(true); const ui = await section('Label Preferences'); fireEvent.click(ui.getByRole('button', { name: 'Add' }));
    fireEvent.click(ui.getByRole('button', { name: 'Save Preferences' })); await screen.findByText('Save refused');
    expect(ui.getAllByRole('listitem')).toHaveLength(1); expect(h.client.getQueryData(projectQueryKeys.detail('project', true))).toMatchObject({ label_preferences: [] });
    h.fail(false); fireEvent.click(ui.getByTitle('Remove')); fireEvent.click(ui.getByRole('button', { name: 'Save Preferences' })); await ui.findByText('Preferences saved');
    expect(bodies(h)).toEqual([{ label_preferences: ['rdfs:label'] }, { label_preferences: [] }]);
    expect(screen.queryByText('Save refused')).toBeNull();
  });

  it('removes the label save confirmation after its timeout', async () => {
    mount(); const ui = await section('Label Preferences'); vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    await act(async () => { fireEvent.click(ui.getByRole('button', { name: 'Save Preferences' })); });
    expect(ui.getByText('Preferences saved')).toBeDefined();
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); }); expect(ui.queryByText('Preferences saved')).toBeNull();
  });

  it.each([['', 0], ['10', 10], ['3', 3]])('persists required approvals %j as %i', async (input, expected) => {
    const h = mount(); const ui = await section('Pull Request Settings');
    await waitFor(() => expect((ui.getByLabelText('Required Approvals') as HTMLInputElement).value).toBe('2'));
    fireEvent.change(ui.getByLabelText('Required Approvals'), { target: { value: input } }); fireEvent.click(ui.getByRole('button', { name: 'Save' }));
    await screen.findByText('PR settings saved'); expect(bodies(h)).toEqual([{ pr_approval_required: expected }]);
  });

  it('keeps an approval draft on error and permits retry', async () => {
    const h = mount(); h.fail(true); const ui = await section('Pull Request Settings');
    await waitFor(() => expect((ui.getByLabelText('Required Approvals') as HTMLInputElement).value).toBe('2'));
    fireEvent.change(ui.getByLabelText('Required Approvals'), { target: { value: '4' } }); fireEvent.click(ui.getByRole('button', { name: 'Save' }));
    await screen.findByText('Save refused'); expect((ui.getByLabelText('Required Approvals') as HTMLInputElement).value).toBe('4');
    h.fail(false); fireEvent.click(ui.getByRole('button', { name: 'Save' })); await screen.findByText('PR settings saved');
    expect(screen.queryByText('Save refused')).toBeNull(); expect(bodies(h)).toHaveLength(2);
  });
});
