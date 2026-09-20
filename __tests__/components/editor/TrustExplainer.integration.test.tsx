import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SessionProvider } from 'next-auth/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TrustExplainer } from '@/components/editor/TrustExplainer';
import { useTrustCapabilities } from '@/lib/hooks/useTrustCapabilities';
import type { SuggestionCapabilities } from '@/lib/api/trust';
import { jsonResponse, llmHookHarness } from '../../fixtures/llm-hook-harness';

const capabilities: SuggestionCapabilities = { tier: 'untrusted', can_suggest: true, can_mint_entities: false, accepted_count: 2, promotion_threshold: 3, auto_accept_enabled: false, auto_accept_quiet_days: 7, verification_required: false };
function mount(overrides: Partial<SuggestionCapabilities> = {}, initialFailure = false) {
  let failure = initialFailure;
  const fetcher = vi.fn(async () => failure ? new Response('Unavailable', { status: 403 }) : jsonResponse({ ...capabilities, ...overrides }));
  vi.stubGlobal('fetch', fetcher);
  const onSignIn = vi.fn();
  function Consumer() {
    const trust = useTrustCapabilities('project');
    return <TrustExplainer align="right" gate={{ tier: trust.tier, locked: !trust.canMintEntities, isLoading: trust.isLoading, isError: trust.isError, progress: trust.promotionProgress, onRetry: () => { void trust.refetch(); }, onSignIn }} />;
  }
  const { wrapper: QueryWrapper } = llmHookHarness();
  return { fetcher, onSignIn, recover: () => { failure = false; }, ...render(<SessionProvider session={{ user: { name: 'Test Contributor', email: 'test@example.invalid' }, accessToken: 'synthetic-token', expires: '2099-01-01T00:00:00Z' }} refetchOnWindowFocus={false}><QueryWrapper><Consumer /></QueryWrapper></SessionProvider>) };
}
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
async function open() { fireEvent.click(screen.getByRole('button', { name: "Why can't I add entries?" })); return screen.getByRole('dialog'); }

describe('trust explanations driven by real capabilities', () => {
  it('shows earned progress, ignores inside clicks and dismisses outside without stealing focus', async () => {
    const addedListener = vi.spyOn(document, 'addEventListener');
    mount(); const panel = await open();
    expect(await screen.findByText('2 of 3 accepted')).toBeDefined();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('2');
    expect(screen.getByText('1 more accepted suggestion to go.')).toBeDefined();
    await waitFor(() => expect(addedListener).toHaveBeenCalledWith('mousedown', expect.any(Function)));
    fireEvent.mouseDown(panel);
    expect(screen.getByRole('dialog')).toBeDefined();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('keeps minting locked after a failed read and recovers through the actual retry button', async () => {
    const { recover, fetcher } = mount({}, true); await open();
    const retry = await screen.findByRole('button', { name: 'Try again' });
    recover(); fireEvent.click(retry);
    expect(await screen.findByText('2 of 3 accepted')).toBeDefined();
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
  });

  it('offers sign-in for anonymous capabilities and closes by Escape with focus restored', async () => {
    const { onSignIn } = mount({ tier: 'anonymous', accepted_count: 0 }); await open();
    fireEvent.click(await screen.findByRole('button', { name: 'Sign in' }));
    expect(onSignIn).toHaveBeenCalledOnce();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: "Why can't I add entries?" }));
  });

  it.each(['trusted', 'reviewer'] as const)('removes the explanation after %s capabilities grant minting', async tier => {
    mount({ tier, can_mint_entities: true });
    await waitFor(() => expect(screen.queryByRole('button')).toBeNull());
  });

  it.each([[0, 2, '0%'], [3, 5, '100%']] as const)('bounds progress width with threshold %s and accepted count %s', async (promotion_threshold, accepted_count, width) => {
    mount({ promotion_threshold, accepted_count }); await open();
    const progress = await screen.findByRole('progressbar');
    expect((progress.firstElementChild as HTMLElement).style.width).toBe(width);
    expect(screen.getByText('0 more accepted suggestions to go.')).toBeDefined();
  });
});
