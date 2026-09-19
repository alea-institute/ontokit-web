import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SuggestionsPage from '@/app/projects/[id]/suggestions/page';
import type { SuggestionSessionSummary } from '@/lib/api/suggestions';
import { useSelectionStore } from '@/lib/stores/selectionStore';

const auth = vi.hoisted(() => ({ token: 'history-token' as string | undefined }));
vi.mock('next-auth/react', () => ({ useSession: () => ({ data: auth.token ? { accessToken: auth.token, user: { name: 'Fixture' } } : null, status: auth.token ? 'authenticated' : 'unauthenticated' }) }));
vi.mock('next/navigation', () => ({ useParams: () => ({ id: 'history-project' }), usePathname: () => '/projects/history-project/suggestions', useSearchParams: () => new URLSearchParams() }));
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
let client: QueryClient;
let items: SuggestionSessionSummary[];
let projectStatus: number;
let sessionsStatus: number;
let requests: { path: string; init: RequestInit }[];
const suggestion = (status: SuggestionSessionSummary['status']): SuggestionSessionSummary => ({ session_id: `session-${status}`, branch: 'suggestions/topic with spaces', changes_count: 1, last_activity: '2026-09-18T12:00:00Z', entities_modified: ['Person'], status });
beforeEach(() => {
  auth.token = 'history-token'; items = []; projectStatus = 200; sessionsStatus = 200; requests = [];
  useSelectionStore.getState().clear();
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request, init: RequestInit = {}) => {
    const path = new URL(String(input)).pathname; requests.push({ path, init });
    if (path.endsWith('/history-project')) return json(projectStatus === 200 ? { id: 'history-project', name: 'Ontology', user_role: auth.token ? 'suggester' : null } : { detail: 'Unavailable' }, projectStatus);
    if (path.endsWith('/sessions')) return sessionsStatus === 200 ? json({ items }) : new Response('Suggestion history unavailable', { status: sessionsStatus });
    if (path.endsWith('/me')) return json({ is_reviewer: false });
    if (path.endsWith('/notifications')) return json({ items: [], unread_count: 0 });
    throw new Error(`Unexpected request: ${path}`);
  }));
});
afterEach(() => { cleanup(); client.clear(); vi.unstubAllGlobals(); useSelectionStore.getState().clear(); });
const mount = () => render(<QueryClientProvider client={client}><SuggestionsPage /></QueryClientProvider>);

describe('suggestion history route through project permissions and session API', () => {
  it('shows the empty state and editor entry points after authenticated history fetch', async () => {
    mount(); expect(await screen.findByRole('heading', { name: 'No suggestions yet' })).toBeDefined();
    for (const link of screen.getAllByRole('link', { name: 'Open Editor' })) expect(link.getAttribute('href')).toBe('/projects/history-project/editor');
    const sessions = requests.filter(({ path }) => path.endsWith('/sessions'));
    expect(sessions).toHaveLength(1);
    expect(new Headers(sessions[0].init.headers).get('Authorization')).toBe('Bearer history-token');
  });

  it('renders the full session lifecycle, entity labels and singular/plural change counts', async () => {
    items = ['active', 'submitted', 'auto-submitted', 'discarded', 'merged', 'rejected', 'changes-requested'].map(status => suggestion(status as SuggestionSessionSummary['status']));
    items[0].changes_count = 2; mount();
    for (const label of ['In Progress', 'Pending Review', 'Auto-Submitted', 'Discarded', 'Merged', 'Rejected', 'Changes Requested']) expect(await screen.findByText(label)).toBeDefined();
    expect(screen.getByText('2 changes')).toBeDefined(); expect(screen.getAllByText('1 change')).toHaveLength(6);
    expect(screen.getAllByText('Person')).toHaveLength(7);
  });

  it('links requested revisions back to the encoded branch and displays reviewer feedback', async () => {
    items = [{ ...suggestion('changes-requested'), reviewer: { id: 'reviewer', name: 'Fixture Reviewer' }, reviewer_feedback: 'Please define the domain.', revision: 3 }];
    mount();
    expect(await screen.findByText('Feedback from Fixture Reviewer')).toBeDefined();
    expect(screen.getByText('Please define the domain.')).toBeDefined(); expect(screen.getByText('v3')).toBeDefined();
    expect(screen.getByRole('link', { name: 'Resume Editing' }).getAttribute('href')).toBe('/projects/history-project/editor?resumeSession=session-changes-requested&branch=suggestions%2Ftopic%20with%20spaces');
  });

  it.each([undefined, { id: 'reviewer', email: 'reviewer@example.invalid' }])('uses available reviewer identity on rejected suggestions: %j', async reviewer => {
    items = [{ ...suggestion('rejected'), reviewer, reviewer_feedback: 'Not in scope.', entities_modified: [] }]; mount();
    expect(await screen.findByText(`Feedback from ${reviewer?.email ?? 'reviewer'}`)).toBeDefined();
    expect(screen.queryByRole('link', { name: 'Resume Editing' })).toBeNull();
  });

  it('provides internal PR navigation and safe external-link attributes after submission', async () => {
    items = [{ ...suggestion('submitted'), pr_number: 42, github_pr_url: 'https://github.com/example/ontology/pull/42', reviewer_feedback: 'Hidden until a reviewed state' }]; mount();
    expect((await screen.findByRole('link', { name: 'PR #42' })).getAttribute('href')).toBe('/projects/history-project/pull-requests/42');
    const github = screen.getByRole('link', { name: 'View pull request on GitHub' });
    expect(github.getAttribute('href')).toBe(items[0].github_pr_url); expect(github.getAttribute('rel')).toBe('noopener noreferrer'); expect(github.getAttribute('target')).toBe('_blank');
    expect(screen.queryByText('Hidden until a reviewed state')).toBeNull();
  });

  it('surfaces history request failure without showing the empty-success state', async () => {
    sessionsStatus = 403; mount();
    expect(await screen.findByRole('heading', { name: 'Suggestion history unavailable' })).toBeDefined();
    expect(screen.queryByText('No suggestions yet')).toBeNull();
    expect(screen.getByRole('link', { name: 'Back to projects' }).getAttribute('href')).toBe('/');
  });

  it('reports a missing project even when history succeeds', async () => {
    projectStatus = 404; mount(); expect(await screen.findByRole('heading', { name: 'Project not found' })).toBeDefined();
    expect(screen.queryByRole('heading', { name: 'My Suggestions' })).toBeNull();
  });

  it('does not request private session history for an anonymous project visitor', async () => {
    auth.token = undefined; mount(); expect(await screen.findByRole('heading', { name: 'No suggestions yet' })).toBeDefined();
    await waitFor(() => expect(requests.some(({ path }) => path.endsWith('/history-project'))).toBe(true));
    expect(requests.some(({ path }) => path.endsWith('/sessions'))).toBe(false);
  });
});
