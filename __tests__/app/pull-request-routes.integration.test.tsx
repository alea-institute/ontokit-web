import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { SessionProvider } from 'next-auth/react';
import type { Session } from 'next-auth';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ListPage from '@/app/projects/[id]/pull-requests/page';
import DetailPage from '@/app/projects/[id]/pull-requests/[prNumber]/page';
import { jsonResponse, llmHookHarness } from '../fixtures/llm-hook-harness';

const navigation = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => navigation, useParams: () => ({ id: 'project', prNumber: '7' }), usePathname: () => '/projects/project/pull-requests', useSearchParams: () => new URLSearchParams() }));
const session: Session = { user: { id: 'author', name: 'Fixture User' }, accessToken: 'token', expires: '2099-01-01T00:00:00Z' };
const initialPR = { id: 'pr', project_id: 'project', pr_number: 7, title: 'Review ontology', source_branch: 'feature', target_branch: 'main', status: 'open', author_id: 'author', github_sync_status: 'not_configured', created_at: '2026-09-01T12:00:00Z', review_count: 0, approval_count: 0, comment_count: 0, commits_ahead: 0, can_merge: true };
function mount(options: { detail?: boolean; auth?: Session | null; role?: string; projectStatus?: number; handler?: (url: URL, init: RequestInit) => Response | undefined } = {}) {
  let current = { ...initialPR };
  const fetcher = vi.fn(async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = new URL(String(input)); const path = url.pathname;
    const override = options.handler?.(url, init); if (override) return override;
    if (path.endsWith('/pr-party/me')) return jsonResponse({ is_reviewer: false });
    if (path.endsWith('/notifications')) return jsonResponse({ items: [], unread_count: 0 });
    if (path.endsWith('/projects/project')) return options.projectStatus ? new Response(`Project request ${options.projectStatus}`, { status: options.projectStatus }) : jsonResponse({ id: 'project', name: 'Ontology', user_role: options.role ?? 'owner', source_file_path: 'ontology.ttl' });
    if (path.endsWith('/branches')) return jsonResponse({ items: [{ name: 'main' }, { name: 'feature' }], default_branch: 'main', current_branch: 'main' });
    if (path.endsWith('/reviews') || path.endsWith('/comments')) return jsonResponse({ items: [], total: 0 });
    if (path.endsWith('/merge')) { current = { ...current, status: 'merged' }; return jsonResponse({ success: true }); }
    if (path.endsWith('/close')) { current = { ...current, status: 'closed' }; return jsonResponse(current); }
    if (path.endsWith('/reopen')) { current = { ...current, status: 'open' }; return jsonResponse(current); }
    if (path.endsWith('/pull-requests/7')) return jsonResponse(current);
    if (path.endsWith('/pull-requests')) return init?.method === 'POST' ? jsonResponse(current) : jsonResponse({ items: [], total: 0 });
    throw new Error(`Unexpected request: ${init?.method} ${url}`);
  });
  vi.stubGlobal('fetch', fetcher);
  const { wrapper: QueryWrapper } = llmHookHarness();
  render(<SessionProvider session={options.auth === undefined ? session : options.auth} refetchOnWindowFocus={false}><QueryWrapper>{options.detail ? <DetailPage /> : <ListPage />}</QueryWrapper></SessionProvider>);
  return fetcher;
}
beforeEach(() => sessionStorage.clear());
afterEach(() => { cleanup(); vi.unstubAllGlobals(); navigation.push.mockClear(); });
async function openCreate() {
  fireEvent.click(await screen.findByRole('button', { name: 'New Pull Request' }));
  await waitFor(() => expect(screen.getAllByRole('combobox')[0].querySelectorAll('option')).toHaveLength(2));
}
function fillCreate() {
  fireEvent.change(screen.getByLabelText('Title'), { target: { value: '  New axiom  ' } });
  fireEvent.change(screen.getByLabelText('Description'), { target: { value: '  Explain axiom  ' } });
  fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'feature' } });
}

describe('pull request list route through real providers, controls and HTTP', () => {
  it('creates a pull request from actual branch options and navigates to its returned number', async () => {
    const fetcher = mount(); await openCreate(); fillCreate();
    fireEvent.click(screen.getByRole('button', { name: 'Create Pull Request' }));
    await waitFor(() => expect(navigation.push).toHaveBeenCalledExactlyOnceWith('/projects/project/pull-requests/7'));
    const request = fetcher.mock.calls.find(([, init]) => init?.method === 'POST')!;
    expect(JSON.parse(String(request[1]?.body))).toEqual({ title: 'New axiom', description: 'Explain axiom', source_branch: 'feature', target_branch: 'main' });
    expect(new Headers(request[1]?.headers).get('Authorization')).toBe('Bearer token');
    expect(screen.queryByLabelText('Title')).toBeNull();
  });
  it('retains form data after server rejection and permits retry', async () => {
    let attempts = 0;
    mount({ handler: (url, init) => url.pathname.endsWith('/pull-requests') && init?.method === 'POST' && ++attempts === 1 ? new Response('Duplicate request', { status: 409 }) : undefined });
    await openCreate(); fillCreate(); fireEvent.click(screen.getByRole('button', { name: 'Create Pull Request' }));
    expect(await screen.findByText('Duplicate request')).toBeDefined();
    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('  New axiom  ');
    expect(navigation.push).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Create Pull Request' }));
    await waitFor(() => expect(navigation.push).toHaveBeenCalledOnce()); expect(attempts).toBe(2);
  });
  it('validates whitespace titles and identical branches without contacting the create endpoint', async () => {
    const fetcher = mount(); await openCreate();
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: '   ' } });
    fireEvent.submit(screen.getByLabelText('Title').closest('form')!);
    expect(await screen.findByText('Title is required')).toBeDefined();
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Title' } });
    fireEvent.submit(screen.getByLabelText('Title').closest('form')!);
    expect(await screen.findByText('Source and target branches must be different')).toBeDefined();
    expect(fetcher.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' })); expect(screen.queryByLabelText('Title')).toBeNull();
  });
  it.each(['viewer', 'suggester'])('keeps %s users read-only and renders status-specific empty lists', async role => {
    const fetcher = mount({ role }); await screen.findByText('There are no open pull requests for this project.');
    expect(screen.queryByRole('button', { name: 'New Pull Request' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Merged' }));
    expect(await screen.findByText('No pull requests have been merged yet.')).toBeDefined();
    expect(fetcher.mock.calls.some(([input]) => new URL(String(input)).searchParams.get('status') === 'merged')).toBe(true);
  });
  it('shows an unstructured project failure on the detail route without loading review actions', async () => {
    const fetcher = mount({ detail: true, handler: url => url.pathname.endsWith('/projects/project')
      ? new Response('Project temporarily unavailable', { status: 422 }) : undefined });
    expect(await screen.findByText('Project temporarily unavailable')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Merge Pull Request' })).toBeNull();
    expect(fetcher.mock.calls.some(([url]) => new URL(String(url)).pathname.includes('/pull-requests'))).toBe(false);
    const request = fetcher.mock.calls.find(([url]) => new URL(String(url)).pathname.endsWith('/projects/project'));
    expect(new Headers(request?.[1]?.headers).get('Authorization')).toBe('Bearer token');
  });

  it('recovers a list failure by changing the status filter and preserves result links', async () => {
    mount({ handler: url => url.pathname.endsWith('/pull-requests') ? url.searchParams.get('status') === 'open' ? new Response('List unavailable', { status: 403 }) : jsonResponse({ items: [initialPR], total: 1 }) : undefined });
    expect(await screen.findByText('List unavailable')).toBeDefined(); fireEvent.click(screen.getByRole('button', { name: 'All' }));
    expect((await screen.findByRole('link', { name: /Review ontology/ })).getAttribute('href')).toBe('/projects/project/pull-requests/7');
    expect(screen.queryByText('List unavailable')).toBeNull();
  });
  it('paginates server results and resets the offset when the status changes', async () => {
    const fetcher = mount({ handler: url => url.pathname.endsWith('/pull-requests') ? jsonResponse({ items: [{ ...initialPR, title: url.searchParams.get('skip') === '20' ? 'Last result' : 'First result' }], total: 21 }) : undefined });
    await screen.findByText('First result'); expect(screen.getByRole('button', { name: 'Previous' }).hasAttribute('disabled')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Next' })); await screen.findByText('Last result');
    expect(screen.getByRole('button', { name: 'Next' }).hasAttribute('disabled')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Closed' })); await screen.findByText('First result');
    const requests = fetcher.mock.calls.filter(([url]) => new URL(String(url)).pathname.endsWith('/pull-requests'));
    expect(new URL(String(requests.at(-1)![0])).searchParams.get('skip')).toBe('0');
    expect(new URL(String(requests.at(-1)![0])).searchParams.get('status')).toBe('closed');
  });
  it.each([403, 404])('gates the list when project lookup returns %s', async projectStatus => {
    const fetcher = mount({ projectStatus });
    expect(await screen.findByRole('heading', { name: projectStatus === 403 ? "You don't have access to this project" : 'Project not found' })).toBeDefined();
    expect(fetcher.mock.calls.some(([url]) => String(url).includes('/pull-requests'))).toBe(false);
  });
});

describe('pull request detail route passes project permissions and route identity to real actions', () => {
  it('merges with retained source branch, refreshes state, and links back to the target editor', async () => {
    const fetcher = mount({ detail: true }); fireEvent.click(await screen.findByRole('button', { name: 'Merge' }));
    const dialog = within(screen.getByRole('dialog'));
    fireEvent.click(dialog.getByRole('checkbox')); fireEvent.click(dialog.getByRole('button', { name: 'Merge' }));
    expect(await screen.findByText(/This pull request was merged into/)).toBeDefined();
    expect(screen.getByRole('link', { name: 'Continue to Editor' }).getAttribute('href')).toBe('/projects/project/editor?branch=main');
    const request = fetcher.mock.calls.find(([url]) => String(url).endsWith('/merge'))!;
    expect(JSON.parse(String(request[1]?.body))).toEqual({ delete_source_branch: false });
    expect(screen.getByRole('button', { name: /Delete Branch/ })).toBeDefined();
  });
  it('closes and reopens a pull request through confirmations without losing its detail', async () => {
    const fetcher = mount({ detail: true }); fireEvent.click(await screen.findByRole('button', { name: 'Close' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close PR' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Reopen' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Reopen' }));
    expect(await screen.findByRole('button', { name: 'Merge' })).toBeDefined();
    expect(fetcher.mock.calls.filter(([url]) => /\/(close|reopen)$/.test(String(url)))).toHaveLength(2);
  });
  it('uses viewer role to remove merge and approval controls while allowing review comments', async () => {
    mount({ detail: true, role: 'viewer' }); fireEvent.click(await screen.findByRole('button', { name: 'Review' }));
    expect(screen.queryByRole('button', { name: 'Merge' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
    expect(screen.getByPlaceholderText('Leave a comment (optional)')).toBeDefined();
  });
  it('renders anonymous detail without authenticated mutation controls', async () => {
    const fetcher = mount({ detail: true, auth: null, role: 'viewer' });
    await screen.findByText('Review ontology'); expect(screen.queryByRole('button', { name: 'Review' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Pull Requests' }).getAttribute('href')).toBe('/projects/project/pull-requests');
    expect(fetcher.mock.calls.every(([, init]) => !new Headers(init?.headers).has('Authorization'))).toBe(true);
  });
  it('keeps the list breadcrumb available when the pull request itself cannot load', async () => {
    mount({ detail: true, handler: url => url.pathname.endsWith('/pull-requests/7') ? new Response('Pull request no longer exists', { status: 404 }) : undefined });
    expect(await screen.findByText('Pull request no longer exists')).toBeDefined();
    expect(screen.getByRole('link', { name: 'Pull Requests' }).getAttribute('href')).toBe('/projects/project/pull-requests');
    expect(screen.queryByRole('button', { name: 'Merge' })).toBeNull();
  });
  it.each([403, 404])('does not load PR data after project detail failure %s', async projectStatus => {
    const fetcher = mount({ detail: true, handler: url => url.pathname.endsWith('/projects/project') ? jsonResponse({ detail: 'Lookup refused' }, projectStatus) : undefined });
    await screen.findByRole('heading', { name: projectStatus === 403 ? "You don't have access to this project" : 'Project not found' });
    expect(fetcher.mock.calls.some(([url]) => String(url).includes('/pull-requests'))).toBe(false);
  });
});
