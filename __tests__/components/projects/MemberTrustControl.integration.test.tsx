import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemberTrustControl } from '@/components/projects/MemberTrustControl';
import type { MemberTrust, TrustOverride } from '@/lib/api/trust';
import { jsonResponse } from '../../fixtures/llm-hook-harness';

const initial: MemberTrust = { user_id: 'member', role: 'suggester', tier: 'untrusted', is_trusted: false, trust_override: 'none', accepted_count: 3 };
function mount(trust: MemberTrust = initial) {
  let failure = false;
  const fetcher = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
    if (failure) return new Response('Trust change denied', { status: 403 });
    const { trust_override } = JSON.parse(String(init?.body)) as { trust_override: TrustOverride };
    return jsonResponse({ ...trust, trust_override, is_trusted: trust_override === 'granted', tier: trust_override === 'granted' ? 'trusted' : trust.tier === 'reviewer' ? 'reviewer' : 'untrusted' });
  });
  vi.stubGlobal('fetch', fetcher);
  function Parent() {
    const [current, setCurrent] = useState(trust);
    return <><MemberTrustControl projectId="project" userId="member" token="token" trust={current} onChanged={setCurrent} /><output>{current.tier}</output></>;
  }
  return { fetcher, fail: (value: boolean) => { failure = value; }, ...render(<Parent />) };
}
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const open = () => fireEvent.click(screen.getByRole('button', { name: /Trust status/ }));

describe('member trust HTTP and controlled parent integration', () => {
  it.each([
    ['granted', 'Grant trusted', 'Trusted (granted)'],
    ['refused', 'Refuse trust', 'Trust refused'],
    ['revoked', 'Revoke trust', 'Trust revoked'],
    ['none', 'Leave it to the ladder', 'Earning trust'],
  ] as const)('persists %s and synchronizes the authoritative parent', async (override, action, label) => {
    const { fetcher } = mount({ ...initial, trust_override: override === 'none' ? 'granted' : 'none' });
    open(); fireEvent.click(screen.getByRole('menuitem', { name: new RegExp(action) }));
    await waitFor(() => expect(screen.getByRole('button', { name: /Trust status/ }).hasAttribute('disabled')).toBe(false));
    expect(screen.getByText(label)).toBeDefined();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual({ trust_override: override });
    expect(new Headers(fetcher.mock.calls[0][1]?.headers).get('Authorization')).toBe('Bearer token');
    expect(screen.getByRole('status').textContent).toBe(override === 'granted' ? 'trusted' : 'untrusted');
  });

  it.each([
    { action: 'Grant trusted', before: initial, optimisticLabel: 'Trusted (granted)', override: 'granted' as const },
    { action: 'Leave it to the ladder', before: { ...initial, tier: 'trusted' as const, is_trusted: true, trust_override: 'granted' as const }, optimisticLabel: 'Earning trust', override: 'none' as const },
  ])('prevents a second decision while $action is pending and adopts the server result', async ({ action, before, optimisticLabel, override }) => {
    let finish!: (response: Response) => void;
    const fetcher = vi.fn((_input: RequestInfo | URL, _init?: RequestInit) => new Promise<Response>(resolve => { finish = resolve; }));
    vi.stubGlobal('fetch', fetcher);
    function Parent() {
      const [current, setCurrent] = useState<MemberTrust>(before);
      return <><MemberTrustControl projectId="project" userId="member" token="token" trust={current} onChanged={setCurrent} /><output>{current.trust_override}</output></>;
    }
    render(<Parent />);
    open(); fireEvent.click(screen.getByRole('menuitem', { name: new RegExp(action) }));
    expect(screen.getByText(optimisticLabel)).toBeDefined();
    const trigger = screen.getByRole('button', { name: /Trust status/ });
    expect((trigger as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(trigger);
    expect(screen.queryByRole('menu')).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status').textContent).toBe(before.trust_override);
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual({ trust_override: override });
    await act(async () => { finish(jsonResponse({ ...initial, trust_override: override, is_trusted: true, tier: 'trusted', accepted_count: 10 })); });
    expect(screen.getByRole('status').textContent).toBe(override);
    expect((screen.getByRole('button', { name: /Trust status/ }) as HTMLButtonElement).disabled).toBe(false);
    if (override === 'none') expect(screen.getByText('· 10 accepted')).toBeDefined();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('yields a completed HTTP decision to a later authoritative refresh', async () => {
    const fetcher = vi.fn(async () => jsonResponse({ ...initial, trust_override: 'granted', is_trusted: true, tier: 'trusted' }));
    vi.stubGlobal('fetch', fetcher);
    const view = render(<MemberTrustControl projectId="project" userId="member" token="token" trust={initial} />);
    open(); fireEvent.click(screen.getByRole('menuitem', { name: /Grant trusted/ }));
    await waitFor(() => expect((screen.getByRole('button', { name: /Trust status/ }) as HTMLButtonElement).disabled).toBe(false));
    expect(screen.getByText('Trusted (granted)')).toBeDefined();
    view.rerender(<MemberTrustControl projectId="project" userId="member" token="token" trust={{ ...initial, trust_override: 'revoked' }} />);
    expect(screen.getByText('Trust revoked')).toBeDefined();
    expect(screen.queryByText('Trusted (granted)')).toBeNull();
    open();
    expect((screen.getByRole('menuitem', { name: /Revoke trust/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('rolls back a failed update, exposes the error and allows retry', async () => {
    const { fail } = mount(); fail(true);
    open(); fireEvent.click(screen.getByRole('menuitem', { name: /Grant trusted/ }));
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Trust change denied');
    expect(screen.getByText('Earning trust')).toBeDefined();
    expect(screen.getByRole('status').textContent).toBe('untrusted');
    fail(false); open(); fireEvent.click(screen.getByRole('menuitem', { name: /Grant trusted/ }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('trusted'));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('retains reviewer tier when trust is revoked', async () => {
    mount({ ...initial, tier: 'reviewer', role: 'editor', is_trusted: true, trust_override: 'granted' });
    open(); fireEvent.click(screen.getByRole('menuitem', { name: /Revoke trust/ }));
    await waitFor(() => expect(screen.getByText('Trust revoked')).toBeDefined());
    expect(screen.getByRole('status').textContent).toBe('reviewer');
  });

  it('closes by Escape with focus restored and by outside click without issuing mutations', async () => {
    const addedListener = vi.spyOn(document, 'addEventListener');
    const { fetcher } = mount(); open();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /Trust status/ }));
    open();
    await waitFor(() => expect(addedListener).toHaveBeenCalledWith('mousedown', expect.any(Function)));
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('menu')).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('disables the current override and hides the control until trust is loaded', () => {
    const { rerender } = render(<MemberTrustControl projectId="project" userId="member" trust={null} token="token" />);
    expect(screen.queryByRole('button')).toBeNull();
    rerender(<MemberTrustControl projectId="project" userId="member" trust={initial} token="token" />);
    open(); expect(screen.getByRole('menuitem', { name: /Leave it to the ladder/ }).hasAttribute('disabled')).toBe(true);
  });
});
