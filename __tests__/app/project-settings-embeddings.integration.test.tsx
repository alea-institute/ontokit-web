import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { SessionProvider, useSession } from 'next-auth/react';
import type { Session } from 'next-auth';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ProjectSettingsPage from '@/app/projects/[id]/settings/page';
import { ToastProvider } from '@/lib/context/ToastContext';
import type { EmbeddingConfig, EmbeddingStatus } from '@/lib/api/embeddings';
import { jsonResponse, llmHookHarness } from '../fixtures/llm-hook-harness';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), useParams: () => ({ id: 'project' }), usePathname: () => '/projects/project/settings', useSearchParams: () => new URLSearchParams() }));
const session: Session = { user: { id: 'owner', name: 'Fixture Owner' }, accessToken: 'fixture-token', expires: '2099-01-01T00:00:00Z' };
const config: EmbeddingConfig = { provider: 'local', model_name: 'all-MiniLM-L6-v2', api_key_set: false, dimensions: 384, auto_embed_on_save: false };
const status: EmbeddingStatus = { provider: 'local', model_name: config.model_name, total_entities: 12, embedded_entities: 4, coverage_percent: 33.33, job_in_progress: false };
function RefreshSession() {
  const { update } = useSession();
  return <button onClick={() => void update({ refresh: true })}>Refresh fixture session</button>;
}
function mount(options: { config?: EmbeddingConfig | null; status?: EmbeddingStatus | null; loadFailure?: boolean } = {}) {
  let currentConfig = options.config === undefined ? config : options.config;
  let currentStatus = options.status === undefined ? status : options.status;
  let saveFailure = false;
  let generationFailure = false;
  let statusFailure = false;
  let token = session.accessToken;
  class Socket extends EventTarget { static OPEN = 1; static CONNECTING = 0; readyState = 1; close = vi.fn(); }
  vi.stubGlobal('WebSocket', Socket);
  const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const path = new URL(String(input), window.location.origin).pathname;
    if (path === '/api/auth/csrf') return jsonResponse({ csrfToken: 'fixture-csrf' });
    if (path === '/api/auth/session') {
      token = 'refreshed-fixture-token';
      return jsonResponse({ ...session, accessToken: token });
    }
    if (path.includes('/embeddings/')) {
      expect(new Headers(init?.headers).get('Authorization')).toBe(`Bearer ${token}`);
      if (path.endsWith('/config')) {
        if (init?.method === 'PUT') {
          if (saveFailure) return new Response('Embedding save refused', { status: 403 });
          const update = JSON.parse(String(init.body));
          currentConfig = { ...config, ...update, api_key_set: Boolean(update.api_key || currentConfig?.api_key_set) };
          return jsonResponse(currentConfig);
        }
        return options.loadFailure ? new Response('Unavailable', { status: 403 }) : currentConfig ? jsonResponse(currentConfig) : new Response('Not configured', { status: 404 });
      }
      if (path.endsWith('/status')) return statusFailure ? new Response('Status unavailable', { status: 403 }) : currentStatus ? jsonResponse(currentStatus) : new Response('No status', { status: 404 });
      if (path.endsWith('/generate') && init?.method === 'POST') return generationFailure ? new Response('Generation refused', { status: 403 }) : jsonResponse({ job_id: 'job' });
    }
    if (path === '/api/v1/projects/project') return jsonResponse({ id: 'project', name: 'Fixture ontology', user_role: 'owner', owner_id: 'owner', member_count: 0, label_preferences: [], source_file_path: null, is_public: false });
    if (path.endsWith('/pr-party/me')) return jsonResponse({ is_reviewer: false });
    if (path.endsWith('/notifications')) return jsonResponse({ items: [], unread_count: 0 });
    if (path.endsWith('/trust/members')) return jsonResponse([]);
    if (path.endsWith('/members')) return jsonResponse({ items: [], total: 0 });
    if (path.endsWith('/pr-settings')) return jsonResponse({ pr_approval_required: 0, github_integration: null });
    if (path.endsWith('/github-token')) return jsonResponse({ has_token: false });
    if (init?.method && init.method !== 'GET') throw new Error(`Unexpected mutation: ${init.method} ${path}`);
    return new Response('Ancillary setting unavailable', { status: 403 });
  });
  vi.stubGlobal('fetch', fetcher);
  const { wrapper: QueryWrapper } = llmHookHarness();
  const view = render(<SessionProvider session={session} refetchOnWindowFocus={false}><RefreshSession /><QueryWrapper><ToastProvider><ProjectSettingsPage /></ToastProvider></QueryWrapper></SessionProvider>);
  return { ...view, fetcher, failSave: (value: boolean) => { saveFailure = value; }, failGeneration: (value: boolean) => { generationFailure = value; }, failStatus: (value: boolean) => { statusFailure = value; }, setStatus: (value: EmbeddingStatus) => { currentStatus = value; } };
}
async function section() {
  const heading = await screen.findByRole('heading', { name: 'Intelligence Features' });
  const result = within(heading.closest('section')!);
  await result.findByRole('button', { name: 'Save Configuration' });
  return result;
}
const writes = (fetcher: ReturnType<typeof mount>['fetcher']) => fetcher.mock.calls.filter(([url, init]) => String(url).endsWith('/embeddings/config') && init?.method === 'PUT');
const statusReads = (fetcher: ReturnType<typeof mount>['fetcher']) => fetcher.mock.calls.filter(([url]) => String(url).endsWith('/embeddings/status')).length;
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('embedding settings through the settings route and real HTTP client', () => {
  it('uses the refreshed session token while polling an existing embedding job', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const harness = mount({ status: { ...status, job_in_progress: true } });
    await section();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh fixture session' }));
    await waitFor(() => {
      const calls = harness.fetcher.mock.calls.filter(([url]) => String(url).endsWith('/embeddings/status'));
      expect(new Headers(calls.at(-1)?.[1]?.headers).get('Authorization')).toBe('Bearer refreshed-fixture-token');
    });
    await section();
    const beforePoll = statusReads(harness.fetcher);
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    const reads = harness.fetcher.mock.calls.filter(([url]) => String(url).endsWith('/embeddings/status'));
    expect(new Headers(reads.at(-1)?.[1]?.headers).get('Authorization')).toBe('Bearer refreshed-fixture-token');
    expect(reads).toHaveLength(beforePoll + 1);
    harness.setStatus({ ...status, embedded_entities: 12, coverage_percent: 100 });
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    await screen.findByText('12 of 12 entities embedded');
    expect(harness.fetcher.mock.calls.some(([url]) => String(url).endsWith('/embeddings/generate'))).toBe(false);
  });

  it('loads coverage and persists local auto-embedding without an API key', async () => {
    const { fetcher } = mount(); const ui = await section();
    expect(ui.getByText('4 of 12 entities embedded')).toBeDefined();
    expect(ui.getByText('33%')).toBeDefined();
    fireEvent.click(ui.getByLabelText('Auto-embed on save (~50ms for local model)'));
    fireEvent.click(ui.getByRole('button', { name: 'Save Configuration' }));
    await ui.findByText('Embedding configuration saved');
    expect(JSON.parse(String(writes(fetcher)[0][1]?.body))).toEqual({ provider: 'local', model_name: config.model_name, auto_embed_on_save: true });
  });

  it('treats missing config and status as an empty setup and enables generation after saving', async () => {
    mount({ config: null, status: null }); const ui = await section();
    expect(ui.getByRole('button', { name: 'Generate Embeddings' }).hasAttribute('disabled')).toBe(true);
    expect(ui.queryByText(/entities embedded/)).toBeNull();
    fireEvent.click(ui.getByRole('button', { name: 'Save Configuration' }));
    await ui.findByText('Embedding configuration saved');
    expect(ui.getByRole('button', { name: 'Generate Embeddings' }).hasAttribute('disabled')).toBe(false);
  });

  it('keeps configuration available after a non-404 load failure', async () => {
    mount({ loadFailure: true }); const ui = await section();
    expect(ui.getByRole('button', { name: 'Generate Embeddings' }).hasAttribute('disabled')).toBe(true);
    fireEvent.click(ui.getByRole('button', { name: 'Save Configuration' }));
    await ui.findByText('Embedding configuration saved');
  });

  it.each([{ provider: 'OpenAI', value: 'openai', model: 'text-embedding-3-small' }, { provider: 'Voyage AI', value: 'voyage', model: 'voyage-3-lite' }])('validates and trims a new $provider key before saving the provider model', async ({ provider, value, model }) => {
    const { fetcher } = mount(); const ui = await section();
    fireEvent.click(ui.getByRole('button', { name: new RegExp(provider) }));
    fireEvent.change(ui.getByPlaceholderText('Enter API key'), { target: { value: '   ' } });
    fireEvent.click(ui.getByRole('button', { name: 'Save Configuration' }));
    expect(ui.getByText('API key is required for the selected provider')).toBeDefined();
    expect(writes(fetcher)).toHaveLength(0);
    fireEvent.change(ui.getByPlaceholderText('Enter API key'), { target: { value: '  fixture-cloud-token  ' } });
    fireEvent.click(ui.getByRole('button', { name: 'Save Configuration' }));
    await ui.findByText('Embedding configuration saved');
    expect(JSON.parse(String(writes(fetcher)[0][1]?.body))).toEqual({ provider: value, model_name: model, auto_embed_on_save: false, api_key: 'fixture-cloud-token' });
    expect((ui.getByPlaceholderText('Enter new key to replace') as HTMLInputElement).value).toBe('');
    expect(ui.queryByText('API key is required for the selected provider')).toBeNull();
  });

  it('reuses an existing key only for the configured provider', async () => {
    const { fetcher } = mount({ config: { ...config, provider: 'openai', api_key_set: true, auto_embed_on_save: true } }); const ui = await section();
    fireEvent.click(ui.getByRole('button', { name: 'Save Configuration' }));
    await ui.findByText('Embedding configuration saved');
    expect(JSON.parse(String(writes(fetcher)[0][1]?.body))).toEqual({ provider: 'openai', model_name: 'text-embedding-3-small', auto_embed_on_save: true });
    fireEvent.click(ui.getByRole('button', { name: /Voyage AI/ }));
    fireEvent.click(ui.getByRole('button', { name: 'Save Configuration' }));
    expect(ui.getByText('API key is required for the selected provider')).toBeDefined();
    expect(writes(fetcher)).toHaveLength(1);
  });

  it('retains the key draft on save failure and clears it after a successful retry', async () => {
    const harness = mount(); harness.failSave(true); const ui = await section();
    fireEvent.click(ui.getByRole('button', { name: /OpenAI/ }));
    fireEvent.change(ui.getByPlaceholderText('Enter API key'), { target: { value: 'fixture-token' } });
    fireEvent.click(ui.getByRole('button', { name: 'Save Configuration' }));
    await ui.findByText('Embedding save refused');
    expect((ui.getByPlaceholderText('Enter API key') as HTMLInputElement).value).toBe('fixture-token');
    harness.failSave(false);
    fireEvent.click(ui.getByRole('button', { name: 'Save Configuration' }));
    await ui.findByText('Embedding configuration saved');
    expect(ui.queryByText('Embedding save refused')).toBeNull();
    expect(writes(harness.fetcher)).toHaveLength(2);
  });

  it('recovers from generation rejection, ignores status failures and stops polling on completion', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const harness = mount(); harness.failGeneration(true); const ui = await section();
    fireEvent.click(ui.getByRole('button', { name: 'Generate Embeddings' }));
    await ui.findByText('Generation refused');
    expect(ui.getByRole('button', { name: 'Generate Embeddings' }).hasAttribute('disabled')).toBe(false);
    harness.failGeneration(false); harness.failStatus(true);
    fireEvent.click(ui.getByRole('button', { name: 'Generate Embeddings' }));
    await ui.findByText('Embedding generation started');
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(ui.getByRole('button', { name: 'Generating...' }).hasAttribute('disabled')).toBe(true);
    harness.failStatus(false); harness.setStatus({ ...status, embedded_entities: 12, coverage_percent: 100 });
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(ui.getByText('12 of 12 entities embedded')).toBeDefined();
    expect(ui.getByRole('button', { name: 'Generate Embeddings' }).hasAttribute('disabled')).toBe(false);
    const count = statusReads(harness.fetcher);
    await act(async () => { await vi.advanceTimersByTimeAsync(4000); });
    expect(statusReads(harness.fetcher)).toBe(count);
    expect(harness.fetcher.mock.calls.filter(([url, init]) => String(url).endsWith('/embeddings/generate') && init?.method === 'POST')).toHaveLength(2);
  });

  it('resumes an existing job, survives a poll error and finishes without starting another job', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const harness = mount({ status: { ...status, job_in_progress: true, job_progress_percent: 25.4 } }); const ui = await section();
    expect(ui.getByText('Job in progress: 25%')).toBeDefined();
    harness.failStatus(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(ui.getByText('Job in progress: 25%')).toBeDefined();
    harness.failStatus(false); harness.setStatus({ ...status, embedded_entities: 12, coverage_percent: 100 });
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(ui.queryByText(/Job in progress/)).toBeNull();
    expect(ui.getByRole('button', { name: 'Generate Embeddings' }).hasAttribute('disabled')).toBe(false);
    const count = statusReads(harness.fetcher);
    await act(async () => { await vi.advanceTimersByTimeAsync(4000); });
    expect(statusReads(harness.fetcher)).toBe(count);
    expect(harness.fetcher.mock.calls.some(([url]) => String(url).endsWith('/embeddings/generate'))).toBe(false);
  });

  it('shows immediate generation progress and cancels newly started polling on unmount', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const harness = mount(); const ui = await section();
    harness.setStatus({ ...status, job_in_progress: true, job_progress_percent: 40 });
    fireEvent.click(ui.getByRole('button', { name: 'Generate Embeddings' }));
    await ui.findByText('Job in progress: 40%');
    expect(ui.getByRole('button', { name: 'Generating...' }).hasAttribute('disabled')).toBe(true);
    const count = statusReads(harness.fetcher); expect(count).toBe(2);
    harness.unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(6000); });
    expect(statusReads(harness.fetcher)).toBe(count);
  });

  it('omits an unsaved cloud key after switching back to the local provider', async () => {
    const { fetcher } = mount(); const ui = await section();
    fireEvent.click(ui.getByRole('button', { name: /OpenAI/ }));
    fireEvent.change(ui.getByPlaceholderText('Enter API key'), { target: { value: 'unused-fixture-token' } });
    fireEvent.click(ui.getByRole('button', { name: /Local \(CPU\)/ }));
    expect(ui.queryByPlaceholderText('Enter API key')).toBeNull();
    fireEvent.click(ui.getByRole('button', { name: 'Save Configuration' }));
    await ui.findByText('Embedding configuration saved');
    expect(JSON.parse(String(writes(fetcher)[0][1]?.body))).toEqual({ provider: 'local', model_name: config.model_name, auto_embed_on_save: false });
  });

  it('cancels the resumed polling interval when leaving the settings route', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const harness = mount({ status: { ...status, job_in_progress: true } }); const ui = await section();
    expect(ui.queryByText(/Job in progress/)).toBeNull();
    expect(ui.getByRole('button', { name: 'Generating...' })).toBeDefined();
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    const count = statusReads(harness.fetcher); expect(count).toBe(2);
    harness.unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(6000); });
    expect(statusReads(harness.fetcher)).toBe(count);
  });
});
