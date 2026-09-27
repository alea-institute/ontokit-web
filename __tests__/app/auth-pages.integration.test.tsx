import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SignInPage from '@/app/auth/signin/page';
import AuthErrorPage from '@/app/auth/error/page';

const navigation = vi.hoisted(() => ({ params: new URLSearchParams(), push: vi.fn() }));
vi.mock('next/navigation', () => ({ useSearchParams: () => navigation.params, useRouter: () => navigation }));
beforeEach(() => {
  navigation.params = new URLSearchParams(); navigation.push.mockReset(); sessionStorage.clear();
  // Required mode always runs with a provider (lib/env.ts enforces it).
  vi.stubEnv('NEXT_PUBLIC_AUTH_MODE', 'required'); vi.stubEnv('NEXT_PUBLIC_ZITADEL_CONFIGURED', 'true');
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); sessionStorage.clear(); });

describe('sign in route through the installed NextAuth client', () => {
  it.each([undefined, '/projects/ontology/editor?classIri=https%3A%2F%2Fexample.org%2FPerson'])('performs provider discovery and CSRF-protected sign in with callback %s', async callbackUrl => {
    if (callbackUrl) navigation.params.set('callbackUrl', callbackUrl);
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const path = new URL(String(input), window.location.href).pathname;
      if (path.endsWith('/providers')) return Response.json({ zitadel: { id: 'zitadel', type: 'oidc' } });
      if (path.endsWith('/csrf')) return Response.json({ csrfToken: 'synthetic-csrf' });
      if (path.endsWith('/signin/zitadel')) return Response.json({ url: window.location.href });
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal('fetch', fetcher); render(<SignInPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Sign in with Zitadel' }));
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(3));
    const call = vi.mocked(fetch).mock.calls[2];
    expect(String(call[0])).toContain('/signin/zitadel');
    expect(call[1]?.method).toBe('post');
    const payload = new URLSearchParams(String(call[1]?.body));
    expect(payload.get('csrfToken')).toBe('synthetic-csrf');
    expect(payload.get('callbackUrl')).toBe(callbackUrl ?? '/');
    expect(new Headers(call[1]?.headers).get('X-Auth-Return-Redirect')).toBe('1');
  });

  it.each([
    ['OAuthSignin', 'Error starting OAuth sign in.'], ['OAuthCallback', 'Error during OAuth callback.'],
    ['OAuthCreateAccount', 'Error creating OAuth account.'], ['Callback', 'Error during callback.'],
    ['AccessDenied', 'Access denied.'], ['Configuration', 'Server configuration error. Please check Zitadel settings.'],
    ['Unexpected', 'An error occurred during sign in.'],
  ])('explains %s while retaining a sign-in action', (error, message) => {
    navigation.params.set('error', error); render(<SignInPage />);
    expect(screen.getByText(message)).toBeDefined(); expect(screen.getByRole('button', { name: 'Sign in with Zitadel' })).toBeDefined();
  });
});

describe('sign in route without an active identity provider', () => {
  it('keeps the provider button in optional mode with a provider', () => {
    vi.stubEnv('NEXT_PUBLIC_AUTH_MODE', 'optional');
    render(<SignInPage />);
    expect(screen.getByRole('button', { name: 'Sign in with Zitadel' })).toBeDefined();
  });

  it.each([['optional', 'false', undefined], ['disabled', 'false', undefined], ['disabled', 'true', undefined], ['optional', 'false', 'Configuration']])('explains that sign-in is unavailable in %s mode (provider flag %s, error %s)', (mode, configured, error) => {
    vi.stubEnv('NEXT_PUBLIC_AUTH_MODE', mode); vi.stubEnv('NEXT_PUBLIC_ZITADEL_CONFIGURED', configured);
    if (error) navigation.params.set('error', error);
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    render(<SignInPage />);
    expect(screen.getByRole('heading', { name: 'Sign-in is unavailable' })).toBeDefined();
    expect(screen.getByText("This OntoKit instance isn't configured for sign-in, so there is no account to sign in to. You can still browse public projects.")).toBeDefined();
    expect(screen.queryByRole('button', { name: /sign in/i })).toBeNull();
    expect(screen.queryByText(/By signing in/)).toBeNull();
    expect(screen.getByRole('link', { name: 'Browse public projects' }).getAttribute('href')).toBe('/');
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('authentication error route with real retry countdown and session storage', () => {
  async function tick(seconds: number) { for (let i = 0; i < seconds; i++) await act(async () => { await vi.advanceTimersByTimeAsync(1000); }); }

  it.each(['Configuration', 'OAuthSignin', 'OAuthCallback', 'Callback'])('retries a transient %s error once and persists the next attempt', async error => {
    vi.useFakeTimers(); navigation.params.set('error', error); render(<AuthErrorPage />);
    expect(screen.getByText('Retrying in 10s...')).toBeDefined();
    await tick(9); expect(navigation.push).not.toHaveBeenCalled();
    await tick(1); expect(navigation.push).toHaveBeenCalledExactlyOnceWith('/auth/signin');
    expect(sessionStorage.getItem('auth-error-retry-count')).toBe('1');
    await tick(20); expect(navigation.push).toHaveBeenCalledOnce();
  });

  it('stops at the retry budget, clears persisted attempts, and permits an explicit new attempt', async () => {
    vi.useFakeTimers(); sessionStorage.setItem('auth-error-retry-count', '5'); navigation.params.set('error', 'Configuration');
    render(<AuthErrorPage />); expect(screen.getByText('Retrying in 10s (attempt 6/6)...')).toBeDefined();
    await tick(10); expect(navigation.push).not.toHaveBeenCalled();
    expect(screen.getByText(/The service appears to be down/)).toBeDefined();
    expect(sessionStorage.getItem('auth-error-retry-count')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Retrying...' }));
    expect(navigation.push).toHaveBeenCalledExactlyOnceWith('/auth/signin');
  });

  it.each(['AccessDenied', 'Verification', 'OAuthCreateAccount', 'Unknown', ''])('does not automatically retry permanent or unknown errors: %s', async error => {
    vi.useFakeTimers(); navigation.params.set('error', error); render(<AuthErrorPage />);
    expect(screen.queryByText(/Retrying in/)).toBeNull(); await tick(20); expect(navigation.push).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'Go to homepage' }).getAttribute('href')).toBe('/');
    fireEvent.click(screen.getByRole('button', { name: 'Try signing in again' }));
    expect(navigation.push).toHaveBeenCalledExactlyOnceWith('/auth/signin');
  });

  it('tolerates denied browser storage during automatic retry', async () => {
    vi.useFakeTimers(); navigation.params.set('error', 'Configuration');
    const getItem = vi.spyOn(sessionStorage, 'getItem').mockImplementation(() => { throw new DOMException('Storage denied', 'SecurityError'); });
    const setItem = vi.spyOn(sessionStorage, 'setItem').mockImplementation(() => { throw new DOMException('Storage denied', 'SecurityError'); });
    render(<AuthErrorPage />); await tick(10);
    expect(getItem).toHaveBeenCalledWith('auth-error-retry-count');
    expect(setItem).toHaveBeenCalledWith('auth-error-retry-count', '1');
    expect(navigation.push).toHaveBeenCalledExactlyOnceWith('/auth/signin');
  });

  it.each([
    ['optional', 'false', 'Configuration'], ['optional', 'false', 'AccessDenied'],
    ['disabled', 'false', 'Configuration'], ['disabled', 'true', 'OAuthSignin'],
  ])('offers no sign-in retry when no identity provider is active (%s mode, provider flag %s, error %s)', async (mode, configured, error) => {
    vi.stubEnv('NEXT_PUBLIC_AUTH_MODE', mode); vi.stubEnv('NEXT_PUBLIC_ZITADEL_CONFIGURED', configured);
    vi.useFakeTimers(); navigation.params.set('error', error); render(<AuthErrorPage />);
    expect(screen.getByRole('heading', { name: 'Sign-in is unavailable' })).toBeDefined();
    expect(screen.getByText("This OntoKit instance isn't configured for sign-in, so there is nothing to retry. You can still browse public projects.")).toBeDefined();
    expect(screen.queryByRole('button', { name: /sign(ing)?[\s-]?in|retry/i })).toBeNull();
    expect(screen.queryByText(/Retrying in/)).toBeNull();
    await tick(30); expect(navigation.push).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'Go to homepage' }).getAttribute('href')).toBe('/');
  });

  it('cancels the countdown when the error page unmounts', async () => {
    vi.useFakeTimers(); navigation.params.set('error', 'OAuthSignin'); const view = render(<AuthErrorPage />);
    await tick(3); view.unmount(); await tick(20); expect(navigation.push).not.toHaveBeenCalled();
  });
});
