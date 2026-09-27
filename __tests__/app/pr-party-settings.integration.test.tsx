import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { SessionProvider } from 'next-auth/react';
import type { Session } from 'next-auth';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Page from '@/app/pr-party/settings/page';
import type { PRPartyMe, PRPartySettings } from '@/lib/api/prParty';
import { jsonResponse, llmHookHarness } from '../fixtures/llm-hook-harness';

vi.mock('next/navigation', () => ({ usePathname: () => '/pr-party/settings', useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
const session: Session = { user: { email: 'reviewer@example.invalid', name: 'Fixture reviewer' }, accessToken: 'synthetic-session', expires: '2099-01-01T00:00:00Z' };
const healthy = { expires_at: null, last_validated_at: null, last_error: null, expired: false, expires_soon: false };
function mount(options: { auth?: Session | null; me?: Partial<PRPartyMe>; capabilitiesStatus?: number; holdCapabilities?: boolean; failSettings?: boolean } = {}) {
  let me: PRPartyMe = { is_reviewer: true, degraded: false, github_login: 'fixture-reviewer', credential: null, generation_token: null, ...options.me };
  let settings: PRPartySettings = { merge_default: 'dashboard', ntfy_topic: 'existing-topic' };
  let failure: string | null = null;
  let revokeUrl = 'https://github.com/settings/tokens';
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const path = new URL(String(input)).pathname;
    if (path.endsWith('/notifications')) return jsonResponse({ items: [], unread_count: 0 });
    if (path.endsWith('/pr-party/me')) {
      if (options.holdCapabilities) await pending;
      return jsonResponse(me, options.capabilitiesStatus ?? 200);
    }
    if (path.endsWith('/settings') && init?.method === 'GET') return options.failSettings ? jsonResponse({ detail: 'Preferences unavailable' }, 403) : jsonResponse(settings);
    if (path.endsWith('/settings') && init?.method === 'PUT') {
      if (failure) return jsonResponse({ detail: { message: failure } }, 403);
      settings = { ...settings, ...JSON.parse(String(init.body)) };
      return jsonResponse(settings);
    }
    if (path.endsWith('/credential')) {
      if (failure) return jsonResponse({ detail: { message: failure } }, 403);
      me = { ...me, credential: init?.method === 'DELETE' ? null : healthy };
      return jsonResponse(init?.method === 'DELETE' ? { revoked_locally: true, revoke_url: revokeUrl } : healthy);
    }
    throw new Error(`Unexpected request ${init?.method} ${path}`);
  });
  vi.stubGlobal('fetch', fetcher);
  const { wrapper: Wrapper, client: queryClient } = llmHookHarness();
  render(<SessionProvider session={options.auth === undefined ? session : options.auth} refetchOnWindowFocus={false}><Wrapper><Page /></Wrapper></SessionProvider>);
  return { fetcher, queryClient, release, fail: (message: string | null) => { failure = message; }, revokeLink: (url: string) => { revokeUrl = url; } };
}
const requests = (fetcher: ReturnType<typeof mount>['fetcher'], method: string) => fetcher.mock.calls.filter(([, init]) => init?.method === method);
const ready = () => screen.findByRole('heading', { name: 'Review settings' });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('review settings route with real capability, settings and credential chains', () => {
  it('gates anonymous visitors without making authenticated requests', () => {
    // Required mode always runs with a provider (lib/env.ts enforces it).
    vi.stubEnv('NEXT_PUBLIC_AUTH_MODE', 'required'); vi.stubEnv('NEXT_PUBLIC_ZITADEL_CONFIGURED', 'true');
    const { fetcher } = mount({ auth: null });
    expect(within(screen.getByRole('main')).getByRole('button', { name: 'Sign In' })).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Sign in to manage your review settings' })).toBeDefined();
    expect(screen.queryByLabelText('GitHub personal access token')).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([['optional', 'false'], ['disabled', 'false'], ['disabled', 'true']])('explains that review settings are unavailable without sign-in in %s mode (provider flag %s)', (mode, configured) => {
    vi.stubEnv('NEXT_PUBLIC_AUTH_MODE', mode); vi.stubEnv('NEXT_PUBLIC_ZITADEL_CONFIGURED', configured);
    const { fetcher } = mount({ auth: null });
    expect(screen.getByRole('heading', { name: 'Review settings are unavailable here' })).toBeDefined();
    expect(screen.getByText('Sign-in is unavailable in this configuration, and review settings belong to a signed-in reviewer. Nothing else on OntoKit is affected.')).toBeDefined();
    expect(screen.queryByRole('heading', { name: 'Sign in to manage your review settings' })).toBeNull();
    expect(screen.queryByRole('button', { name: /sign in/i })).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([200, 403])('fails closed when reviewer permission is absent or rejected (%s)', async status => {
    const { fetcher } = mount({ me: { is_reviewer: false }, capabilitiesStatus: status });
    expect(await screen.findByText('PR Party is limited to designated reviewers')).toBeDefined();
    expect(fetcher.mock.calls.some(([url]) => String(url).endsWith('/settings'))).toBe(false);
    expect(screen.queryByRole('link', { name: 'Review' })).toBeNull();
  });

  it('waits for capabilities before exposing credentials and loading preferences', async () => {
    const { fetcher, release } = mount({ holdCapabilities: true });
    expect(screen.getByRole('status', { name: 'Loading your review settings' })).toBeDefined();
    expect(screen.queryByLabelText('GitHub personal access token')).toBeNull();
    expect(fetcher.mock.calls.some(([url]) => String(url).endsWith('/settings'))).toBe(false);
    await act(async () => release());
    await ready();
    await waitFor(() => expect((screen.getByLabelText('ntfy topic') as HTMLInputElement).value).toBe('existing-topic'));
  });

  it('keeps credential controls usable when health timestamps cannot be parsed', async () => {
    const { fetcher } = mount({ me: { credential: { ...healthy, expires_soon: true, expires_at: 'invalid-expiry', last_validated_at: 'invalid-validation' } } });
    await ready();
    expect((await screen.findByTestId('credential-banner-expiring')).textContent).toContain('expires on unknown');
    expect(screen.getByTestId('credential-expires').textContent).toBe('unknown');
    const checked = screen.getByText('Last checked');
    expect(checked.nextElementSibling?.textContent).toBe('unknown');
    expect(screen.queryByText(/Invalid Date/)).toBeNull();
    expect((screen.getByLabelText('Replace your token') as HTMLInputElement).disabled).toBe(false);
    expect(fetcher.mock.calls.every(([, init]) => init?.method === 'GET')).toBe(true);
  });

  it('saves a trimmed synthetic credential, refreshes health and clears the form', async () => {
    const { fetcher, queryClient } = mount(); await ready();
    const input = screen.getByLabelText('GitHub personal access token') as HTMLInputElement;
    expect(input.type).toBe('password');
    fireEvent.change(input, { target: { value: '  synthetic-pat-fixture  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Connect token' }));
    expect(await screen.findByTestId('credential-banner-healthy')).toBeDefined();
    await waitFor(() => expect(input.value).toBe(''));
    const [, init] = requests(fetcher, 'PUT')[0];
    expect(JSON.parse(String(init?.body))).toEqual({ token: 'synthetic-pat-fixture' });
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer synthetic-session');
    expect(JSON.stringify(queryClient.getQueryCache().getAll().map(query => query.queryKey))).not.toContain('synthetic-pat-fixture');
    expect(screen.getByTestId('pr-party-settings-success').textContent).toContain('GitHub token saved');
  });

  it('keeps a rejected credential for correction and clears the error after retry', async () => {
    const { fail, fetcher } = mount(); await ready(); fail('Token belongs to another account');
    const input = screen.getByLabelText('GitHub personal access token') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'synthetic-pat-fixture' } });
    fireEvent.click(screen.getByRole('button', { name: 'Connect token' }));
    expect((await screen.findByTestId('credential-save-error')).textContent).toBe('Token belongs to another account');
    expect(input.value).toBe('synthetic-pat-fixture');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(requests(fetcher, 'PUT')).toHaveLength(1);
    fail(null); fireEvent.click(screen.getByRole('button', { name: 'Connect token' }));
    await screen.findByTestId('credential-banner-healthy');
    expect(screen.queryByTestId('credential-save-error')).toBeNull();
    expect(requests(fetcher, 'PUT')).toHaveLength(2);
  });

  it.each(['https://github.com/settings/tokens', 'https://github.com.evil.invalid/tokens'])('confirms removal and validates the returned revoke link: %s', async url => {
    const { fetcher, revokeLink } = mount({ me: { credential: healthy } }); revokeLink(url); await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Remove token' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    expect(requests(fetcher, 'DELETE')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Remove token' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Remove it' }));
    await screen.findByTestId('credential-degraded-explainer');
    expect(requests(fetcher, 'DELETE')).toHaveLength(1);
    const link = screen.queryByRole('link', { name: /Finish revoking/ });
    if (url === 'https://github.com/settings/tokens') {
      expect(link?.getAttribute('href')).toBe(url); expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
    } else expect(link).toBeNull();
  });

  it('reports removal failure on the page and preserves the connected credential for retry', async () => {
    const { fail } = mount({ me: { credential: healthy } }); await ready(); fail('Removal denied');
    fireEvent.click(screen.getByRole('button', { name: 'Remove token' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove it' }));
    expect((await screen.findByTestId('pr-party-settings-error')).textContent).toBe('Removal denied');
    expect(screen.getByTestId('credential-banner-healthy')).toBeDefined();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    fail(null); fireEvent.click(screen.getByRole('button', { name: 'Remove token' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove it' }));
    await screen.findByTestId('credential-degraded-explainer');
    expect(screen.queryByTestId('pr-party-settings-error')).toBeNull();
  });

  it('rejects invalid topics locally, then saves trimmed topics and clears them with null', async () => {
    const { fetcher } = mount(); await ready();
    const input = screen.getByLabelText('ntfy topic');
    fireEvent.change(input, { target: { value: 'bad/topic' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save topic' }));
    expect(screen.getByTestId('ntfy-topic-error')).toBeDefined(); expect(requests(fetcher, 'PUT')).toHaveLength(0);
    fireEvent.change(input, { target: { value: '  fixture-topic_7  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save topic' }));
    await screen.findByTestId('pr-party-settings-success');
    expect(JSON.parse(String(requests(fetcher, 'PUT')[0][1]?.body))).toEqual({ ntfy_topic: 'fixture-topic_7' });
    await waitFor(() => expect((screen.getByRole('button', { name: 'Save topic' }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.change(input, { target: { value: '  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save topic' }));
    await waitFor(() => expect(requests(fetcher, 'PUT')).toHaveLength(2));
    expect(JSON.parse(String(requests(fetcher, 'PUT')[1][1]?.body))).toEqual({ ntfy_topic: null });
  });

  it('keeps whitespace-only credentials disabled and accepts the topic length boundary', async () => {
    const { fetcher } = mount(); await ready();
    fireEvent.change(screen.getByLabelText('GitHub personal access token'), { target: { value: '   ' } });
    expect((screen.getByRole('button', { name: 'Connect token' }) as HTMLButtonElement).disabled).toBe(true);
    const topic = screen.getByLabelText('ntfy topic');
    fireEvent.change(topic, { target: { value: 'a'.repeat(65) } });
    fireEvent.click(screen.getByRole('button', { name: 'Save topic' }));
    expect(screen.getByTestId('ntfy-topic-error')).toBeDefined();
    expect(requests(fetcher, 'PUT')).toHaveLength(0);
    fireEvent.change(topic, { target: { value: 'a'.repeat(64) } });
    fireEvent.click(screen.getByRole('button', { name: 'Save topic' }));
    await screen.findByTestId('pr-party-settings-success');
    expect(JSON.parse(String(requests(fetcher, 'PUT')[0][1]?.body))).toEqual({ ntfy_topic: 'a'.repeat(64) });
  });

  it('reports preference errors, retries successfully and reflects server merge placement', async () => {
    const { fail, fetcher } = mount(); await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Here' }));
    expect(requests(fetcher, 'PUT')).toHaveLength(0);
    fail('Preference denied'); fireEvent.click(screen.getByRole('button', { name: 'On GitHub' }));
    expect((await screen.findByTestId('pr-party-settings-error')).textContent).toBe('Preference denied');
    expect(screen.getByRole('button', { name: 'Here' }).getAttribute('aria-pressed')).toBe('true');
    fail(null); fireEvent.click(screen.getByRole('button', { name: 'On GitHub' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'On GitHub' }).getAttribute('aria-pressed')).toBe('true'));
    expect(screen.queryByTestId('pr-party-settings-error')).toBeNull();
    expect(JSON.parse(String(requests(fetcher, 'PUT')[1][1]?.body))).toEqual({ merge_default: 'manual' });
  });

  it.each([
    { token: null, text: 'No shared token is configured.' },
    { token: { expires_at: null, last_error: null }, text: 'Expires: no expiry set' },
    { token: { expires_at: '2000-01-01T00:00:00Z', last_error: 'older failure' }, text: 'This token has expired, so new briefs are not being written. Ask an administrator to replace it.' },
    { token: { expires_at: '2099-01-01T00:00:00Z', last_error: 'Quota exhausted' }, text: 'The brief writer last failed with: Quota exhausted' },
  ])('renders shared-token state from capabilities: $text', async ({ token, text }) => {
    mount({ me: { generation_token: token } }); await ready();
    expect(screen.getByText(text)).toBeDefined();
    expect(screen.getByRole('link', { name: 'Back to the queue' }).getAttribute('href')).toBe('/pr-party');
  });
});

it('shows failed preference loading and retries without editable fallback values', async () => {
  const options = { failSettings: true }; mount(options);
  await screen.findByText('Preferences unavailable');
  expect(screen.queryByRole('button', { name: 'On GitHub' })).toBeNull();
  options.failSettings = false; fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await ready(); expect(screen.getByRole('button', { name: 'On GitHub' })).toBeDefined();
});
