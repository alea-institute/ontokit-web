import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { SessionProvider } from 'next-auth/react';
import type { Session } from 'next-auth';
import { afterEach, describe, expect, it, vi } from 'vitest';
import NewProjectPage from '@/app/projects/new/page';
import { jsonResponse, llmHookHarness } from '../fixtures/llm-hook-harness';

const navigation = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => navigation, usePathname: () => '/projects/new' }));
const session: Session = { user: { name: 'Fixture User', email: 'fixture@example.invalid' }, accessToken: 'token', expires: '2099-01-01T00:00:00Z' };
function mount(auth: Session | null = session) {
  let fail = false;
  const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const path = new URL(String(input)).pathname;
    if (path.endsWith('/pr-party/me')) return jsonResponse({ is_reviewer: false });
    if (path.endsWith('/notifications')) return jsonResponse({ items: [], unread_count: 0 });
    if (path.endsWith('/github-token')) return jsonResponse({ has_token: true });
    if (path.endsWith('/github-repos')) return jsonResponse({ items: [{ owner: 'fixture', name: 'ontology', full_name: 'fixture/ontology', private: false, default_branch: 'develop' }] });
    if (path.endsWith('/github/scan-files')) return jsonResponse({ items: [{ path: 'source/model.owl', name: 'model.owl', size: 512 }], total: 1 });
    if (path.endsWith('/from-github')) return fail ? jsonResponse({ detail: 'Repository unavailable' }, 403) : jsonResponse({ id: 'cloned-project' });
    if (path === '/api/v1/projects' && init?.method === 'POST') return fail ? new Response('Creation denied', { status: 403 }) : jsonResponse({ id: 'created-project' });
    throw new Error(`Unexpected request: ${path}`);
  });
  vi.stubGlobal('fetch', fetcher);
  const { wrapper: QueryWrapper } = llmHookHarness();
  return { fetcher, reject: (next: boolean) => { fail = next; }, ...render(<SessionProvider session={auth} refetchOnWindowFocus={false}><QueryWrapper><NewProjectPage /></QueryWrapper></SessionProvider>) };
}
afterEach(() => { cleanup(); vi.unstubAllGlobals(); navigation.push.mockClear(); });
const form = () => within(screen.getByRole('main'));

describe('new project route through the real form and HTTP client', () => {
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


  it.each([false, true])('imports a selected file through real multipart construction (retry: %s)', async retry => {
    class Upload extends EventTarget {
      static requests: Upload[] = [];
      upload = new EventTarget(); status = 200; statusText = 'OK'; responseText = ''; timeout = 0;
      body: FormData | null = null;
      open = vi.fn(); setRequestHeader = vi.fn();
      send(body: FormData) { this.body = body; Upload.requests.push(this); }
      finish(status: number, body: unknown) { this.status = status; this.responseText = JSON.stringify(body); this.dispatchEvent(new Event('load')); }
    }
    vi.stubGlobal('XMLHttpRequest', Upload);
    mount(); fireEvent.click(form().getByRole('button', { name: 'Import from File' }));
    const file = new File(['@prefix : <http://example.org/> .'], 'ontology.ttl', { type: 'text/turtle' });
    fireEvent.change(document.querySelector('input[type="file"]')!, { target: { files: [file] } });
    fireEvent.click(form().getByRole('button', { name: 'Import Project' }));
    expect(Upload.requests).toHaveLength(1);
    const first = Upload.requests[0];
    expect(first.open).toHaveBeenCalledWith('POST', expect.stringContaining('/api/v1/projects/import'));
    expect(first.setRequestHeader).toHaveBeenCalledWith('Authorization', 'Bearer token');
    expect(first.body?.get('file')).toBe(file);
    expect(first.body?.get('is_public')).toBe('false');
    expect(first.body?.has('name')).toBe(false);
    expect(screen.getByRole('button', { name: 'Saving...' }).hasAttribute('disabled')).toBe(true);
    if (retry) {
      await act(async () => first.finish(400, { detail: 'Malformed ontology' }));
      expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Import failedMalformed ontology');
      expect(navigation.push).not.toHaveBeenCalled();
      fireEvent.click(form().getByRole('button', { name: 'Import Project' }));
      expect(Upload.requests).toHaveLength(2);
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

});
