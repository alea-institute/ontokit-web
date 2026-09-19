import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { SessionProvider } from 'next-auth/react';
import type { Session } from 'next-auth';
import { afterEach, describe, expect, it, vi } from 'vitest';
import NewProjectPage from '@/app/projects/new/page';
import { jsonResponse, llmHookHarness } from '../fixtures/llm-hook-harness';

const navigation = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => navigation, usePathname: () => '/projects/new' }));
const session: Session = { user: { name: 'Fixture User', email: 'fixture@example.invalid' }, accessToken: 'token', expires: '2099-01-01T00:00:00Z' };
class Upload extends EventTarget {
  static requests: Upload[] = [];
  upload = new EventTarget(); status = 200; statusText = 'OK'; responseText = ''; timeout = 0;
  body: FormData | null = null;
  open = vi.fn(); setRequestHeader = vi.fn();
  send(body: FormData) { this.body = body; Upload.requests.push(this); }
  finish(status: number, body: unknown) { this.status = status; this.responseText = JSON.stringify(body); this.dispatchEvent(new Event('load')); }
}

function mount(auth: Session | null = session, sessionGate?: Promise<Session | null>) {
  let fail = false;
  let cloneError: unknown = { detail: 'Repository unavailable' };
  let cloneGate: Promise<void> | undefined;
  const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const path = new URL(String(input), window.location.origin).pathname;
    if (path === '/api/auth/session') return jsonResponse(await sessionGate);
    if (path.endsWith('/pr-party/me')) return jsonResponse({ is_reviewer: false });
    if (path.endsWith('/notifications')) return jsonResponse({ items: [], unread_count: 0 });
    if (path.endsWith('/github-token')) return jsonResponse({ has_token: true });
    if (path.endsWith('/github-repos')) return jsonResponse({ items: [{ owner: 'fixture', name: 'ontology', full_name: 'fixture/ontology', private: false, default_branch: 'develop' }] });
    if (path.endsWith('/github/scan-files')) return jsonResponse({ items: [{ path: 'source/model.owl', name: 'model.owl', size: 512 }], total: 1 });
    if (path.endsWith('/from-github')) { await cloneGate; return fail ? jsonResponse(cloneError, 403) : jsonResponse({ id: 'cloned-project' }); }
    if (path === '/api/v1/projects' && init?.method === 'POST') return fail ? new Response('Creation denied', { status: 403 }) : jsonResponse({ id: 'created-project' });
    throw new Error(`Unexpected request: ${path}`);
  });
  vi.stubGlobal('fetch', fetcher);
  const { wrapper: QueryWrapper } = llmHookHarness();
  return { fetcher, setCloneError: (body: unknown) => { cloneError = body; }, delayClone: (gate: Promise<void>) => { cloneGate = gate; }, reject: (next: boolean) => { fail = next; }, ...render(<SessionProvider session={sessionGate ? undefined : auth} refetchOnWindowFocus={false}><QueryWrapper><NewProjectPage /></QueryWrapper></SessionProvider>) };
}
afterEach(() => { cleanup(); Upload.requests.length = 0; vi.useRealTimers(); vi.unstubAllGlobals(); navigation.push.mockClear(); });
const form = () => within(screen.getByRole('main'));

describe('new project route through the real form and HTTP client', () => {
  it('waits for the real session provider before exposing project creation', async () => {
    let release!: (value: Session) => void;
    const gate = new Promise<Session>(resolve => { release = resolve; });
    const { container, fetcher } = mount(session, gate);
    expect(form().queryByLabelText(/Project Name/)).toBeNull();
    expect(container.querySelector('.animate-spin')).not.toBeNull();
    expect(fetcher.mock.calls.every(([url]) => String(url).endsWith('/api/auth/session'))).toBe(true);
    await act(async () => { release(session); });
    expect(await screen.findByLabelText(/Project Name/)).toBeDefined();
    expect(form().getByRole('button', { name: 'Create Project' })).toBeDefined();
    expect(fetcher.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });

  it('returns from file import to empty creation without uploading the selected file', async () => {
    vi.stubGlobal('XMLHttpRequest', Upload);
    const { fetcher } = mount();
    fireEvent.click(form().getByRole('button', { name: 'Import from File' }));
    fireEvent.change(document.querySelector('input[type="file"]')!, { target: { files: [new File(['fixture'], 'ontology.ttl', { type: 'text/turtle' })] } });
    expect(form().getByRole('button', { name: 'Import Project' })).toBeDefined();
    fireEvent.click(form().getByRole('button', { name: 'Create Empty' }));
    expect(form().queryByRole('button', { name: 'Import Project' })).toBeNull();
    fireEvent.change(form().getByLabelText(/Project Name/), { target: { value: 'Empty ontology' } });
    fireEvent.click(form().getByRole('button', { name: 'Create Project' }));
    await waitFor(() => expect(navigation.push).toHaveBeenCalledExactlyOnceWith('/projects/created-project'));
    expect(Upload.requests).toHaveLength(0);
    const posts = fetcher.mock.calls.filter(([, init]) => init?.method === 'POST');
    expect(posts).toHaveLength(1);
    expect(JSON.parse(String(posts[0][1]?.body))).toEqual({ name: 'Empty ontology', is_public: false });
  });

  it('creates a trimmed private project and navigates only after the server succeeds', async () => {
    const { fetcher } = mount();
    fireEvent.change(form().getByLabelText(/Project Name/), { target: { value: '  Ontology  ' } });
    fireEvent.change(form().getByLabelText('Description'), { target: { value: '  Description  ' } });
    fireEvent.click(form().getByRole('button', { name: 'Create Project' }));
    await waitFor(() => expect(navigation.push).toHaveBeenCalledExactlyOnceWith('/projects/created-project'));
    const create = fetcher.mock.calls.find(([, init]) => init?.method === 'POST')!;
    expect(JSON.parse(String(create[1]?.body))).toEqual({ name: 'Ontology', description: 'Description', is_public: false });
    expect(new Headers(create[1]?.headers).get('Authorization')).toBe('Bearer token');
  });

  it('keeps entered data after creation fails and permits a public-project retry', async () => {
    const { reject, fetcher } = mount(); reject(true);
    fireEvent.change(form().getByLabelText(/Project Name/), { target: { value: 'Retry project' } });
    fireEvent.click(form().getByRole('button', { name: /Public Anyone/ }));
    fireEvent.click(form().getByRole('button', { name: 'Create Project' }));
    expect(await screen.findByText('Creation denied')).toBeDefined();
    expect(navigation.push).not.toHaveBeenCalled();
    expect((form().getByLabelText(/Project Name/) as HTMLInputElement).value).toBe('Retry project');
    reject(false); fireEvent.click(form().getByRole('button', { name: 'Create Project' }));
    await waitFor(() => expect(navigation.push).toHaveBeenCalledOnce());
    const requests = fetcher.mock.calls.filter(([, init]) => init?.method === 'POST');
    expect(requests).toHaveLength(2);
    expect(JSON.parse(String(requests[1][1]?.body))).toEqual({ name: 'Retry project', is_public: true });
    expect(screen.queryByText('Creation denied')).toBeNull();
  });

  it('requires sign-in before exposing a project form', () => {
    const { fetcher } = mount(null);
    expect(screen.getByRole('heading', { name: 'Sign in required' })).toBeDefined();
    expect(form().queryByLabelText(/Project Name/)).toBeNull();
    expect(form().getByRole('link', { name: 'Sign In' }).getAttribute('href')).toBe('/auth/signin');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('rejects a session missing its API token without issuing a create request', async () => {
    const { fetcher } = mount({ ...session, accessToken: undefined });
    fireEvent.change(form().getByLabelText(/Project Name/), { target: { value: 'Project' } });
    fireEvent.click(form().getByRole('button', { name: 'Create Project' }));
    expect(await screen.findByText('You must be signed in to create a project')).toBeDefined();
    expect(fetcher).not.toHaveBeenCalled(); expect(navigation.push).not.toHaveBeenCalled();
  });

  it('cancels to the project list without posting', () => {
    const { fetcher } = mount(); fireEvent.click(form().getByRole('button', { name: 'Cancel' }));
    expect(navigation.push).toHaveBeenCalledExactlyOnceWith('/');
    expect(fetcher.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });


  it.each([{ retry: false, description: '' }, { retry: true, description: '' }, { retry: false, description: 'A multilingual ontology: café' }, { retry: true, description: 'A multilingual ontology: café' }])('imports a selected file through real multipart construction (retry: $retry, description: $description)', async ({ retry, description }) => {
    vi.stubGlobal('XMLHttpRequest', Upload);
    mount(); fireEvent.click(form().getByRole('button', { name: 'Import from File' }));
    const file = new File(['@prefix : <http://example.org/> .'], 'ontology.ttl', { type: 'text/turtle' });
    fireEvent.change(document.querySelector('input[type="file"]')!, { target: { files: [file] } });
    if (description) fireEvent.change(form().getByLabelText(/Description/), { target: { value: description } });
    fireEvent.click(form().getByRole('button', { name: 'Import Project' }));
    expect(Upload.requests).toHaveLength(1);
    const first = Upload.requests[0];
    expect(first.open).toHaveBeenCalledWith('POST', expect.stringContaining('/api/v1/projects/import'));
    expect(first.setRequestHeader).toHaveBeenCalledWith('Authorization', 'Bearer token');
    expect(first.body?.get('file')).toBe(file);
    expect(first.body?.get('is_public')).toBe('false');
    expect(first.body?.has('name')).toBe(false);
    expect(first.body?.get('description')).toBe(description || null);
    expect(screen.getByRole('button', { name: 'Saving...' }).hasAttribute('disabled')).toBe(true);
    if (retry) {
      await act(async () => first.finish(400, { detail: 'Malformed ontology' }));
      expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Import failedMalformed ontology');
      expect(navigation.push).not.toHaveBeenCalled();
      fireEvent.click(form().getByRole('button', { name: 'Import Project' }));
      expect(Upload.requests).toHaveLength(2);
      expect(Upload.requests[1].body?.get('description')).toBe(description || null);
      expect(Upload.requests[1].body?.get('file')).toBe(file);
    }
    await act(async () => Upload.requests.at(-1)!.finish(200, { id: 'imported-project' }));
    await waitFor(() => expect(navigation.push).toHaveBeenCalledExactlyOnceWith('/projects/imported-project'));
    expect(screen.queryByRole('alert')).toBeNull();
  });


  it.each([false, true])('clones from selected repository and normalized Turtle path (retry: %s)', async retry => {
    const { fetcher, reject } = mount();
    fireEvent.click(form().getByRole('button', { name: 'Clone from GitHub' }));
    fireEvent.click(await screen.findByRole('button', { name: /fixture\/ontology/ }));
    const outputPath = await screen.findByDisplayValue('source/model.ttl');
    fireEvent.change(outputPath, { target: { value: 'normalized/model.ttl' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Turtle output path' }));
    const submit = await screen.findByRole('button', { name: 'Clone & Create Project' });
    if (retry) {
      reject(true); fireEvent.click(submit);
      expect(await screen.findByText('Repository unavailable')).toBeDefined();
      expect(navigation.push).not.toHaveBeenCalled(); reject(false);
    }
    fireEvent.click(screen.getByRole('button', { name: 'Clone & Create Project' }));
    await waitFor(() => expect(navigation.push).toHaveBeenCalledExactlyOnceWith('/projects/cloned-project'));
    const request = fetcher.mock.calls.filter(([input]) => String(input).endsWith('/from-github')).at(-1)!;
    expect(JSON.parse(String(request[1]?.body))).toEqual({ repo_owner: 'fixture', repo_name: 'ontology', ontology_file_path: 'source/model.owl', turtle_file_path: 'normalized/model.ttl', is_public: false, default_branch: 'develop' });
  });

  it('retains the import file and metadata after a structured rejection without detail', async () => {
    vi.stubGlobal('XMLHttpRequest', Upload);
    mount();
    fireEvent.click(form().getByRole('button', { name: 'Import from File' }));
    const file = new File(['@prefix : <https://example.org/> .'], 'ontology.ttl', { type: 'text/turtle' });
    fireEvent.change(document.querySelector('input[type="file"]')!, { target: { files: [file] } });
    fireEvent.change(form().getByLabelText(/Description/), { target: { value: 'Preserved import description' } });
    fireEvent.click(form().getByRole('button', { name: 'Import Project' }));
    const error = { message: 'Import permission expired', code: 'expired' };
    await act(async () => Upload.requests[0].finish(403, error));
    expect((await screen.findByRole('alert')).textContent).toContain(JSON.stringify(error));
    expect(navigation.push).not.toHaveBeenCalled();
    fireEvent.click(form().getByRole('button', { name: 'Import Project' }));
    expect(Upload.requests).toHaveLength(2);
    expect(Upload.requests[1].body?.get('file')).toBe(file);
    expect(Upload.requests[1].body?.get('description')).toBe('Preserved import description');
    await act(async () => Upload.requests[1].finish(200, { id: 'recovered-import' }));
    await waitFor(() => expect(navigation.push).toHaveBeenCalledExactlyOnceWith('/projects/recovered-import'));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('retains the selected repository after a structured clone rejection without detail', async () => {
    const { fetcher, reject, setCloneError } = mount();
    const error = { message: 'Repository permission expired', code: 'expired' };
    setCloneError(error); reject(true);
    fireEvent.click(form().getByRole('button', { name: 'Clone from GitHub' }));
    fireEvent.click(await screen.findByRole('button', { name: /fixture\/ontology/ }));
    await screen.findByDisplayValue('source/model.ttl');
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Turtle output path' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Clone & Create Project' }));
    expect((await screen.findAllByText(JSON.stringify(error))).length).toBeGreaterThan(0);
    expect(navigation.push).not.toHaveBeenCalled();
    reject(false);
    fireEvent.click(screen.getByRole('button', { name: 'Clone & Create Project' }));
    await waitFor(() => expect(navigation.push).toHaveBeenCalledExactlyOnceWith('/projects/cloned-project'));
    const attempts = fetcher.mock.calls.filter(([input]) => String(input).endsWith('/from-github'));
    expect(attempts).toHaveLength(2);
    expect(attempts[1][1]?.body).toBe(attempts[0][1]?.body);
    expect(new Headers(attempts[1][1]?.headers).get('Authorization')).toBe('Bearer token');
    expect(screen.queryByText(JSON.stringify(error))).toBeNull();
  });

  it('reports upload and processing progress through actual XHR events, then clears progress', async () => {
    vi.stubGlobal('XMLHttpRequest', Upload); mount();
    fireEvent.click(form().getByRole('button', { name: 'Import from File' }));
    const file = new File(['@prefix : <https://example.test/> .'], 'progress.ttl', { type: 'text/turtle' });
    fireEvent.change(document.querySelector('input[type="file"]')!, { target: { files: [file] } });
    fireEvent.change(form().getByLabelText(/Project Name/), { target: { value: '  Imported name  ' } });
    fireEvent.click(form().getByRole('button', { name: /Public Anyone/ }));
    fireEvent.click(form().getByRole('button', { name: 'Import Project' }));
    const upload = Upload.requests[0];
    expect(upload.body?.get('name')).toBe('Imported name'); expect(upload.body?.get('is_public')).toBe('true');
    act(() => upload.upload.dispatchEvent(new ProgressEvent('progress', { lengthComputable: true, loaded: 25, total: 100 })));
    expect(screen.getByText('Uploading file...')).toBeDefined(); expect(screen.getByText('25%')).toBeDefined();
    act(() => upload.upload.dispatchEvent(new Event('load')));
    expect(screen.getByText('Processing ontology...')).toBeDefined(); expect(screen.queryByText('25%')).toBeNull();
    await act(async () => upload.finish(200, { id: 'progress-project' }));
    expect(navigation.push).toHaveBeenCalledExactlyOnceWith('/projects/progress-project');
    expect(screen.queryByText('Processing ontology...')).toBeNull();
  });

  it.each(['timeout', 'abort'] as const)('keeps the selected file after upload %s and permits retry', async event => {
    vi.stubGlobal('XMLHttpRequest', Upload); mount();
    fireEvent.click(form().getByRole('button', { name: 'Import from File' }));
    const file = new File(['@prefix : <https://example.test/> .'], 'retry.ttl', { type: 'text/turtle' });
    fireEvent.change(document.querySelector('input[type="file"]')!, { target: { files: [file] } });
    fireEvent.click(form().getByRole('button', { name: 'Import Project' }));
    await act(async () => Upload.requests[0].dispatchEvent(new Event(event)));
    const error = await screen.findByRole('alert');
    expect(error.textContent).toContain(event === 'timeout' ? 'upload timed out' : 'Upload was cancelled');
    expect(navigation.push).not.toHaveBeenCalled();
    fireEvent.click(form().getByRole('button', { name: 'Import Project' }));
    expect(Upload.requests).toHaveLength(2); expect(Upload.requests[1].body?.get('file')).toBe(file);
    await act(async () => Upload.requests[1].finish(200, { id: 'retry-project' }));
    expect(navigation.push).toHaveBeenCalledExactlyOnceWith('/projects/retry-project');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('refuses import when an authenticated session has no API token', async () => {
    vi.stubGlobal('XMLHttpRequest', Upload); mount({ ...session, accessToken: undefined });
    fireEvent.click(form().getByRole('button', { name: 'Import from File' }));
    fireEvent.change(document.querySelector('input[type="file"]')!, { target: { files: [new File(['data'], 'ontology.ttl')] } });
    fireEvent.click(form().getByRole('button', { name: 'Import Project' }));
    await screen.findByText('You must be signed in to import a project');
    expect(Upload.requests).toHaveLength(0); expect(navigation.push).not.toHaveBeenCalled();
  });

  it.each([false, true])('advances clone progress without navigating before HTTP completion (failure: %s)', async failure => {
    const { fetcher, delayClone, reject } = mount();
    fireEvent.click(form().getByRole('button', { name: 'Clone from GitHub' }));
    fireEvent.click(await screen.findByRole('button', { name: /fixture\/ontology/ }));
    await screen.findByDisplayValue('source/model.ttl');
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Turtle output path' }));
    fireEvent.change(form().getByLabelText(/Project Name/), { target: { value: '  Cloned name  ' } });
    fireEvent.change(form().getByLabelText('Description'), { target: { value: '  Cloned description  ' } });
    let finish!: () => void;
    delayClone(new Promise<void>(resolve => { finish = resolve; }));
    reject(failure); vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: 'Clone & Create Project' }));
    expect(screen.getByText('Parsing ontology file...')).toBeDefined();
    for (const [delay, label, percentage] of [
      [1500, 'Normalizing to Turtle format...', '30%'],
      [2000, 'Creating project...', '45%'],
      [2000, 'Cloning repository...', '70%'],
      [15000, 'Normalizing repository content...', '85%'],
      [5000, 'Finalizing...', '95%'],
    ] as const) {
      await act(async () => vi.advanceTimersByTimeAsync(delay));
      expect(screen.getByText(label)).toBeDefined(); expect(screen.getByText(percentage)).toBeDefined();
      expect(navigation.push).not.toHaveBeenCalled();
    }
    await act(async () => finish()); vi.useRealTimers();
    expect(screen.queryByText('Finalizing...')).toBeNull();
    if (failure) {
      await screen.findByText('Repository unavailable'); expect(navigation.push).not.toHaveBeenCalled();
      reject(false); fireEvent.click(screen.getByRole('button', { name: 'Clone & Create Project' }));
    }
    await waitFor(() => expect(navigation.push).toHaveBeenCalledExactlyOnceWith('/projects/cloned-project'));
    const request = fetcher.mock.calls.filter(([input]) => String(input).endsWith('/from-github')).at(-1)!;
    expect(JSON.parse(String(request[1]?.body))).toMatchObject({ name: 'Cloned name', description: 'Cloned description', turtle_file_path: 'source/model.ttl' });
  });

});
