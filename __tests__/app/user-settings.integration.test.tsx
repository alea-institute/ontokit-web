import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { SessionProvider } from 'next-auth/react';
import type { Session } from 'next-auth';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import UserSettingsPage from '@/app/settings/page';
import { useEditorModeStore } from '@/lib/stores/editorModeStore';
import type { CommitIdentity } from '@/lib/api/userSettings';
import { jsonResponse, llmHookHarness } from '../fixtures/llm-hook-harness';

vi.mock('next/navigation', () => ({ usePathname: () => '/settings', useRouter: () => ({ push: vi.fn() }) }));
const session: Session = { user: { name: 'Fixture User' }, accessToken: 'fixture-token', expires: '2099-01-01T00:00:00Z' };
const initialIdentity: CommitIdentity = {
  display_name: 'Fixture Contributor', noreply_alias: 'fixture@noreply.example.invalid',
  effective_email: 'fixture@noreply.example.invalid', commit_email: 'fixture@example.invalid',
  commit_email_verified: true, use_verified_email: false,
};
function mount(options: { auth?: Session | null; identity?: Partial<CommitIdentity>; failLoad?: boolean } = {}) {
  let rejectUpdate = false;
  let identity = { ...initialIdentity, ...options.identity };
  let pending: (() => void) | undefined;
  let deferUpdate = false;
  const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const path = new URL(String(input)).pathname;
    if (path.endsWith('/pr-party/me')) return jsonResponse({ is_reviewer: false });
    if (path.endsWith('/notifications')) return jsonResponse({ items: [], unread_count: 0 });
    if (path.endsWith('/commit-identity')) {
      if (init?.method === 'PATCH') {
        if (deferUpdate) await new Promise<void>(resolve => { pending = resolve; });
        if (rejectUpdate) return new Response('Credit update denied', { status: 403 });
        const patch = JSON.parse(String(init.body));
        identity = { ...identity, ...patch, effective_email: patch.use_verified_email ? identity.commit_email! : identity.noreply_alias };
        return jsonResponse(identity);
      }
      return options.failLoad ? new Response('Unavailable', { status: 403 }) : jsonResponse(identity);
    }
    throw new Error(`Unexpected request: ${path}`);
  });
  vi.stubGlobal('fetch', fetcher);
  const { wrapper: QueryWrapper } = llmHookHarness();
  return {
    fetcher, rejectUpdate: (value: boolean) => { rejectUpdate = value; },
    defer: () => { deferUpdate = true; }, resolve: () => pending?.(),
    ...render(<SessionProvider session={options.auth === undefined ? session : options.auth} refetchOnWindowFocus={false}><QueryWrapper><UserSettingsPage /></QueryWrapper></SessionProvider>),
  };
}
const main = () => within(screen.getByRole('main'));
const creditToggle = () => main().getByRole('checkbox', { name: /Use my verified address/ }) as HTMLInputElement;
beforeEach(() => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  localStorage.clear();
  useEditorModeStore.setState({ editorMode: 'standard', theme: 'system', preferEditMode: false, showManualSaveButton: true, hasSeenAutoSaveToast: false });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); window.history.replaceState({}, '', '/'); document.documentElement.classList.remove('dark'); });

describe('user settings through real cards, preferences store, and HTTP client', () => {
  it('loads private attribution and opts into and out of a verified public address', async () => {
    const { fetcher } = mount();
    expect(await screen.findByText('Fixture Contributor')).toBeDefined();
    expect(screen.getByTestId('effective-email').textContent).toBe(initialIdentity.noreply_alias);
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    fireEvent.click(creditToggle());
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(screen.getByTestId('effective-email').textContent).toBe(initialIdentity.commit_email);
    expect(creditToggle().checked).toBe(true);
    expect(screen.getByText('Credit settings updated')).toBeDefined();
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    fireEvent.click(creditToggle());
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(creditToggle().checked).toBe(false);
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(screen.getByText('Credit settings updated')).toBeDefined();
    expect(screen.getByTestId('effective-email').textContent).toBe(initialIdentity.noreply_alias);
    const updates = fetcher.mock.calls.filter(([, init]) => init?.method === 'PATCH');
    expect(updates.map(([, init]) => JSON.parse(String(init?.body)))).toEqual([{ use_verified_email: true }, { use_verified_email: false }]);
    for (const [, init] of updates) expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer fixture-token');
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(screen.queryByText('Credit settings updated')).toBeNull();
    expect(screen.getByTestId('effective-email').textContent).toBe(initialIdentity.noreply_alias);
  });

  it('prevents another opt-in while saving and applies the response after completion', async () => {
    const harness = mount(); await screen.findByText('Fixture Contributor'); harness.defer();
    fireEvent.click(creditToggle());
    await waitFor(() => expect(creditToggle().disabled).toBe(true));
    expect(screen.getByTestId('effective-email').textContent).toBe(initialIdentity.noreply_alias);
    await act(async () => harness.resolve());
    await waitFor(() => expect(creditToggle().disabled).toBe(false));
    expect(creditToggle().checked).toBe(true);
  });

  it('keeps the private identity after an update fails and permits a successful retry', async () => {
    const harness = mount(); await screen.findByText('Fixture Contributor'); harness.rejectUpdate(true);
    fireEvent.click(creditToggle());
    expect(await screen.findByText('Credit update denied')).toBeDefined();
    expect(creditToggle().checked).toBe(false);
    expect(screen.getByTestId('effective-email').textContent).toBe(initialIdentity.noreply_alias);
    harness.rejectUpdate(false); fireEvent.click(creditToggle());
    await screen.findByText('Credit settings updated');
    expect(screen.queryByText('Credit update denied')).toBeNull(); expect(creditToggle().checked).toBe(true);
  });

  it('explains a failed identity load while keeping local preferences usable', async () => {
    mount({ failLoad: true });
    expect(await screen.findByText("Couldn't load your credit settings. Try again in a moment.")).toBeDefined();
    expect(screen.getByText('Credit settings are unavailable right now.')).toBeDefined();
    expect(main().queryByRole('checkbox')).toBeNull();
    fireEvent.click(main().getByRole('button', { name: 'Dark' }));
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it.each([false, true])('does not expose an opt-in without a verified address (address present: %s)', async present => {
    const { fetcher } = mount({ identity: { display_name: null, commit_email: present ? 'unverified@example.invalid' : null, commit_email_verified: false } });
    await screen.findByText('Contributor');
    expect(main().queryByRole('checkbox')).toBeNull();
    expect(main().getByText(present ? /not verified yet/ : /Nothing to do here/)).toBeDefined();
    expect(fetcher.mock.calls.some(([, init]) => init?.method === 'PATCH')).toBe(false);
  });

  it('requires authentication and performs no identity or preference rendering for signed-out users', () => {
    const { fetcher } = mount({ auth: null });
    expect(screen.getByRole('heading', { name: 'Sign in required' })).toBeDefined();
    expect(main().queryByRole('switch')).toBeNull(); expect(fetcher).not.toHaveBeenCalled();
  });

  it('renders local preferences but no identity controls for a session without an access token', async () => {
    const { fetcher } = mount({ auth: { ...session, accessToken: undefined } });
    await screen.findByText('Credit settings are unavailable right now.');
    expect(main().getByRole('switch', { name: 'Prefer Edit Mode' })).toBeDefined();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('persists all preference controls and restores their visual and DOM state on rehydration', async () => {
    const first = mount(); await screen.findByText('Fixture Contributor');
    fireEvent.click(main().getByRole('button', { name: /Developer Source-code/ }));
    fireEvent.click(main().getByRole('button', { name: 'Dark' }));
    fireEvent.click(main().getByRole('switch', { name: 'Prefer Edit Mode' }));
    fireEvent.click(main().getByRole('switch', { name: 'Show Manual Save Button' }));
    const stored = localStorage.getItem('ontokit-editor-preferences')!;
    expect(JSON.parse(stored).state).toMatchObject({ editorMode: 'developer', theme: 'dark', preferEditMode: true, showManualSaveButton: false });
    first.unmount();
    useEditorModeStore.setState({ editorMode: 'standard', theme: 'light', preferEditMode: false, showManualSaveButton: true });
    localStorage.setItem('ontokit-editor-preferences', stored);
    await act(async () => useEditorModeStore.persist.rehydrate());
    mount(); await screen.findByText('Fixture Contributor');
    expect(main().getByRole('button', { name: /Developer Source-code/ }).getAttribute('aria-pressed')).toBe('true');
    expect(main().getByRole('button', { name: 'Dark' }).getAttribute('aria-pressed')).toBe('true');
    expect(main().getByRole('switch', { name: 'Prefer Edit Mode' }).getAttribute('aria-checked')).toBe('true');
    expect(main().getByRole('switch', { name: 'Show Manual Save Button' }).getAttribute('aria-checked')).toBe('false');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    fireEvent.click(main().getByRole('button', { name: 'Light' }));
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    fireEvent.click(main().getByRole('button', { name: 'System' }));
    expect(useEditorModeStore.getState().theme).toBe('system');
  });

  it('scrolls to a linked preference without changing the stored setting', async () => {
    window.history.replaceState({}, '', '/settings#save-button');
    const scroll = vi.fn();
    const previous = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollIntoView');
    Object.defineProperty(Element.prototype, 'scrollIntoView', { configurable: true, value: scroll });
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    mount();
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(screen.getByText('Fixture Contributor')).toBeDefined();
    expect(scroll).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
    expect(document.getElementById('save-button')?.className).toContain('bg-amber-100');
    await act(async () => { await vi.advanceTimersByTimeAsync(1999); });
    expect(document.getElementById('save-button')?.className).toContain('bg-amber-100');
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(document.getElementById('save-button')?.className).not.toContain('bg-amber-100');
    expect(useEditorModeStore.getState().showManualSaveButton).toBe(true);
    if (previous) Object.defineProperty(Element.prototype, 'scrollIntoView', previous);
    else Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
  });
});
