import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { SessionProvider } from 'next-auth/react';
import type { Session } from 'next-auth';
import type { NormalizationStatusResponse } from '@/lib/api/normalization';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ProjectSettingsPage from '@/app/projects/[id]/settings/page';
import { ToastProvider } from '@/lib/context/ToastContext';
import { jsonResponse, llmHookHarness } from '../fixtures/llm-hook-harness';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), useParams: () => ({ id: 'project' }), usePathname: () => '/projects/project/settings', useSearchParams: () => new URLSearchParams() }));
vi.mock('@monaco-editor/react', () => ({ loader: { config: vi.fn() }, DiffEditor: ({ original, modified }: { original: string; modified: string }) => <><pre aria-label="Original Turtle">{original}</pre><pre aria-label="Normalized Turtle">{modified}</pre></> }));
const session: Session = { user: { id: 'owner', name: 'Owner' }, accessToken: 'fixture-token', expires: '2099-01-01T00:00:00Z' };
const project = { id: 'project', name: 'Ontology', is_public: false, user_role: 'owner', owner_id: 'owner', member_count: 0, label_preferences: [], source_file_path: 'ontology.ttl', created_at: '2026-01-01T00:00:00Z' };
const report = { original_format: 'turtle', original_filename: 'ontology.ttl', original_size_bytes: 2000, normalized_size_bytes: 1000, triple_count: 12, prefixes_before: ['ex'], prefixes_after: ['ex'], prefixes_removed: [], prefixes_added: [], format_converted: false, notes: ['Sorted triples'] };
let status: NormalizationStatusResponse;
let route: (url: URL, init?: RequestInit) => Response | Promise<Response> | undefined;
let fetcher: ReturnType<typeof vi.fn>;
const scroll = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollIntoView');
const originalUrl = window.location.href;
beforeEach(() => {
  status = { needs_normalization: true, last_run: null, last_run_id: null, last_check: null, preview_report: null, checking: false, error: null };
  route = () => undefined;
  class Socket extends EventTarget { static OPEN = 1; static CONNECTING = 0; readyState = 1; close = vi.fn(); }
  vi.stubGlobal('WebSocket', Socket);
  Object.defineProperty(Element.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
  fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const override = route(url, init); if (override) return override;
    const path = url.pathname;
    if (path.includes('/normalization')) expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer fixture-token');
    if (path === '/api/v1/projects/project') return jsonResponse(project);
    if (path.endsWith('/normalization/status')) return jsonResponse(status);
    if (path.endsWith('/normalization/history')) return jsonResponse({ items: [], total: 0 });
    if (path.endsWith('/normalization/queue')) return jsonResponse({ job_id: 'normalize-job', status: 'queued' }, 202);
    if (path.endsWith('/normalization/jobs/normalize-job')) return jsonResponse({ status: 'running', job_id: 'normalize-job' });
    if (path.endsWith('/normalization')) return jsonResponse({ id: 'preview', report, original_content: null, normalized_content: null });
    if (path.endsWith('/ontology/index-status')) return jsonResponse({ status: 'ready', entity_count: 12 });
    if (path.endsWith('/pr-party/me')) return jsonResponse({ is_reviewer: false });
    if (path.endsWith('/notifications')) return jsonResponse({ items: [], unread_count: 0 });
    if (path.endsWith('/trust/members')) return jsonResponse([]);
    if (path.endsWith('/members')) return jsonResponse({ items: [], total: 0 });
    if (path.endsWith('/pr-settings')) return jsonResponse({ pr_approval_required: 0, github_integration: null });
    if (path.endsWith('/github-token')) return jsonResponse({ has_token: false });
    if (init?.method && init.method !== 'GET') throw new Error(`Unexpected mutation: ${init.method} ${path}`);
    return jsonResponse({ detail: 'Ancillary service unavailable' }, 403);
  });
  vi.stubGlobal('fetch', fetcher);
});
afterEach(() => {
  cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks();
  window.history.replaceState(null, '', originalUrl);
  if (scroll) Object.defineProperty(Element.prototype, 'scrollIntoView', scroll); else Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
});
async function mount(expectedStatus = 'Normalization recommended') {
  const { wrapper: QueryWrapper } = llmHookHarness();
  const view = render(<SessionProvider session={session} refetchOnWindowFocus={false}><QueryWrapper><ToastProvider><ProjectSettingsPage /></ToastProvider></QueryWrapper></SessionProvider>);
  await screen.findByText(expectedStatus);
  return view;
}
function section() { return within(screen.getByRole('heading', { name: 'Ontology Normalization' }).closest('section')!); }
async function queue() {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  fireEvent.click(section().getByRole('button', { name: 'Run Normalization' }));
  await screen.findByText('Normalization job queued...');
}
const jobCalls = () => fetcher.mock.calls.filter(([input]) => String(input).includes('/normalization/jobs/'));

describe('settings normalization through the real page, query hooks and HTTP client', () => {
  it.each([
    { removed: ['old', 'unused'], added: ['owl', 'rdfs'], converted: true, notes: ['Converted RDF/XML', 'Sorted triples'] },
    { removed: [], added: ['owl'], converted: false, notes: [] },
    { removed: ['unused'], added: [], converted: false, notes: ['Removed unused prefix'] },
    { removed: [], added: [], converted: false, notes: [] },
  ])('renders the persisted import report with prefixes $removed → $added', async ({ removed, added, converted, notes }) => {
    const savedReport = { ...report, original_format: converted ? 'rdfxml' : 'turtle', format_converted: converted, prefixes_before: ['ex', ...removed], prefixes_after: ['ex', ...added], prefixes_removed: removed, prefixes_added: added, notes };
    route = url => url.pathname === '/api/v1/projects/project' ? jsonResponse({ ...project, normalization_report: savedReport }) : undefined;
    await mount();
    const ui = within(screen.getByRole('heading', { name: 'Import Normalization Report' }).closest('section')!);
    expect(ui.getByText(savedReport.original_format)).toBeDefined();
    expect(ui.getByText('12')).toBeDefined();
    expect(ui.getByText(`${report.original_size_bytes.toLocaleString()} → ${report.normalized_size_bytes.toLocaleString()} bytes`)).toBeDefined();
    expect(ui.queryByText('→ Turtle') !== null).toBe(converted);
    expect(ui.queryByRole('heading', { name: 'Prefix Changes' }) !== null).toBe(removed.length + added.length > 0);
    expect(ui.queryByText('Removed:') !== null).toBe(removed.length > 0);
    expect(ui.queryByText('Added:') !== null).toBe(added.length > 0);
    if (removed.length) expect(ui.getByText(removed.join(', '))).toBeDefined();
    if (added.length) expect(ui.getByText(added.join(', '))).toBeDefined();
    expect(ui.queryByRole('heading', { name: 'Changes Made' }) !== null).toBe(notes.length > 0);
    expect(ui.queryAllByRole('listitem').map(item => item.textContent)).toEqual(notes);
    expect(fetcher.mock.calls.every(([, init]) => !init?.method || init.method === 'GET')).toBe(true);
  });

  it('shows a reported status error and replaces it after an explicit successful check', async () => {
    status = { ...status, error: 'Parser service unavailable' };
    await mount('Error checking status: Parser service unavailable');
    expect(section().queryByText('Normalization recommended')).toBeNull();
    status = { ...status, error: null };
    fireEvent.click(section().getByRole('button', { name: 'Check Status' }));
    expect(await section().findByText('Normalization recommended')).toBeDefined();
    expect(section().queryByText('Error checking status: Parser service unavailable')).toBeNull();
    // Initial query, explicit check, then the real query invalidation refresh.
    await waitFor(() => expect(fetcher.mock.calls.filter(([url]) => String(url).includes('/normalization/status'))).toHaveLength(3));
  });

  it('scrolls an editor deep link to the normalization section after project loading', async () => {
    window.history.replaceState(null, '', '#normalization');
    await mount();
    await waitFor(() => expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' }));
    const target = screen.getByRole('heading', { name: 'Ontology Normalization' }).closest('section');
    expect(vi.mocked(Element.prototype.scrollIntoView).mock.contexts).toEqual([target]);
    expect(target?.id).toBe('normalization');
  });

  it('keeps settings usable when a deep link names a missing section', async () => {
    window.history.replaceState(null, '', '#removed-section');
    await mount();
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
    fireEvent.click(section().getByRole('button', { name: 'Preview Changes' }));
    await screen.findByText('Preview of Changes');
    expect(section().getByRole('button', { name: 'Run Normalization' }).hasAttribute('disabled')).toBe(false);
  });

  it.each([
    { removed: [], added: [], expected: 'No changes' },
    { removed: ['unused'], added: [], expected: '-1' },
    { removed: [], added: ['rdf', 'rdfs'], expected: '+2' },
    { removed: ['unused'], added: ['rdf', 'rdfs'], expected: '-1 / +2' },
  ])('renders cached normalization prefix changes as $expected without starting a job', async ({ removed, added, expected }) => {
    const notes = removed.length && added.length ? Array.from({ length: 7 }, (_, index) => `Normalization note ${index + 1}`) : [];
    status = { ...status, preview_report: { ...report, prefixes_removed: removed, prefixes_added: added, notes } };
    await mount();
    const ui = section();
    expect(ui.getByRole('heading', { name: 'Preview of Changes' })).toBeDefined();
    expect(ui.getByText('Prefixes').nextElementSibling?.textContent).toBe(expected);
    expect(ui.getByText('Triple Count').nextElementSibling?.textContent).toBe('12');
    if (notes.length) {
      expect(ui.getByText(/Normalization note 5/)).toBeDefined();
      expect(ui.queryByText(/Normalization note 6/)).toBeNull();
      expect(ui.getByText('... and 2 more')).toBeDefined();
      expect(ui.getAllByRole('listitem')).toHaveLength(6);
    } else {
      expect(ui.queryByText('Changes')).toBeNull();
    }
    expect(fetcher.mock.calls.every(([, init]) => init?.method === 'GET')).toBe(true);
  });

  it('previews statistics without mutating the ontology and refreshes the normalized status', async () => {
    await mount();
    fireEvent.click(section().getByRole('button', { name: 'Preview Changes' }));
    await screen.findByText('Preview of Changes');
    expect(screen.getByText(/Sorted triples/)).toBeDefined();
    const call = fetcher.mock.calls.find(([input, init]) => String(input).endsWith('/normalization') && init?.method === 'POST');
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({ dry_run: true });
    expect(fetcher.mock.calls.some(([input]) => String(input).endsWith('/normalization/queue'))).toBe(false);
    status = { ...status, needs_normalization: false, last_run: '2026-09-01T12:00:00Z' };
    fireEvent.click(section().getByRole('button', { name: 'Check Status' }));
    await screen.findByText('Ontology is already normalized');
    expect(section().getByRole('button', { name: 'Re-normalize' })).toBeDefined();
  });

  it('shows the real diff viewer when preview includes source and closes it', async () => {
    route = url => url.pathname.endsWith('/normalization') ? jsonResponse({ report, original_content: ':A a :B .', normalized_content: ':A\n a :B .\n' }) : undefined;
    await mount(); fireEvent.click(section().getByRole('button', { name: 'Preview Changes' }));
    expect((await screen.findByLabelText('Original Turtle')).textContent).toBe(':A a :B .');
    expect(screen.getByLabelText('Normalized Turtle').textContent).toBe(':A\n a :B .\n');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByLabelText('Original Turtle')).toBeNull();
  });

  it.each(['/normalization', '/normalization/status', '/normalization/history'])('recovers from a rejected %s operation', async path => {
    await mount();
    route = url => url.pathname.endsWith(path) ? jsonResponse({ detail: 'Operation denied' }, 403) : undefined;
    const button = path.endsWith('status') ? 'Check Status' : path.endsWith('history') ? 'History' : 'Preview Changes';
    fireEvent.click(section().getByRole('button', { name: button }));
    await screen.findByText(/Operation denied/);
    route = () => undefined;
    fireEvent.click(section().getByRole('button', { name: button }));
    if (button === 'History') await screen.findByText('No normalization history yet.');
    else if (button === 'Preview Changes') await screen.findByText('Preview of Changes');
    else await waitFor(() => expect(screen.queryByText(/Operation denied/)).toBeNull());
  });

  it('polls pending and running jobs to completion, refreshes status, and stops polling', async () => {
    await mount(); await queue();
    let state = 'pending';
    route = url => url.pathname.includes('/normalization/jobs/') ? jsonResponse({ status: state, job_id: 'normalize-job' }) : undefined;
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(screen.getByText('Normalization job pending...')).toBeDefined();
    state = 'running'; await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(screen.getByRole('button', { name: 'Processing...' }).hasAttribute('disabled')).toBe(true);
    status = { ...status, needs_normalization: false }; state = 'complete';
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    await screen.findByText('Normalization completed successfully');
    await screen.findByText('Ontology is already normalized');
    const count = jobCalls().length;
    await act(async () => { await vi.advanceTimersByTimeAsync(6000); });
    expect(jobCalls()).toHaveLength(count);
    const call = fetcher.mock.calls.find(([input]) => String(input).endsWith('/normalization/queue'));
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({ dry_run: false });
  });

  it.each(['failed', 'not_found'])('ends polling and permits retry after job status %s', async jobStatus => {
    await mount(); await queue();
    route = url => url.pathname.includes('/normalization/jobs/') ? jsonResponse({ status: jobStatus, error: jobStatus === 'failed' ? 'Normalizer rejected source' : null }) : undefined;
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    await screen.findByText(jobStatus === 'failed' ? 'Normalizer rejected source' : 'Normalization job failed');
    expect(section().getByRole('button', { name: 'Run Normalization' }).hasAttribute('disabled')).toBe(false);
    const count = jobCalls().length;
    await act(async () => { await vi.advanceTimersByTimeAsync(4000); });
    expect(jobCalls()).toHaveLength(count);
    route = () => undefined; await queue();
    expect(screen.queryByText(jobStatus === 'failed' ? 'Normalizer rejected source' : 'Normalization job failed')).toBeNull();
  });

  it('renders imported, manual preview and automatic history and closes the history panel', async () => {
    route = url => url.pathname.endsWith('/normalization/history') ? jsonResponse({ items: ['import', 'manual', 'scheduled'].map((trigger_type, i) => ({ id: String(i), trigger_type, is_dry_run: i === 1, created_at: '2026-09-01T12:00:00Z', report, commit_hash: i === 0 ? 'abcdef123456' : null })) }) : undefined;
    await mount(); fireEvent.click(section().getByRole('button', { name: 'History' }));
    await screen.findByText('Normalization History');
    expect(section().getByText('Import')).toBeDefined();
    expect(section().getByText('Manual')).toBeDefined();
    expect(section().getByText('Automatic')).toBeDefined();
    expect(section().getByText('Preview')).toBeDefined();
    expect(section().getByText('abcdef1')).toBeDefined();
    const request = fetcher.mock.calls.find(([url]) => String(url).includes('/normalization/history'))!;
    expect(new URL(String(request[0])).searchParams.get('include_dry_runs')).toBe('true');
    fireEvent.click(section().getByRole('button', { name: 'Close' }));
    expect(screen.queryByText('Normalization History')).toBeNull();
  });

  it('recovers a rejected queue request without starting a phantom polling job', async () => {
    await mount();
    route = url => url.pathname.endsWith('/normalization/queue') ? jsonResponse({ detail: 'Queue unavailable' }, 403) : undefined;
    fireEvent.click(section().getByRole('button', { name: 'Run Normalization' }));
    await screen.findByText(/Queue unavailable/);
    expect(jobCalls()).toHaveLength(0);
    route = () => undefined; await queue();
    expect(screen.queryByText(/Queue unavailable/)).toBeNull();
  });

  it('continues polling after an HTTP failure and recovers on a later complete response', async () => {
    await mount(); await queue();
    const logged = vi.spyOn(console, 'error');
    route = url => url.pathname.includes('/normalization/jobs/') ? jsonResponse({ detail: 'Poll unavailable' }, 403) : undefined;
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(logged).toHaveBeenCalledWith('Error polling job status:', expect.any(Error));
    expect(section().getByRole('button', { name: 'Queued...' }).hasAttribute('disabled')).toBe(true);
    status = { ...status, needs_normalization: false };
    route = url => url.pathname.includes('/normalization/jobs/') ? jsonResponse({ status: 'complete' }) : undefined;
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    await screen.findByText('Normalization completed successfully');
    expect(jobCalls()).toHaveLength(2);
  });

  it('cancels scheduled job polling when the page unmounts', async () => {
    const view = await mount(); await queue();
    view.unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
    expect(jobCalls()).toHaveLength(0);
  });
});
