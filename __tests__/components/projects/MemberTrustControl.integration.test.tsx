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
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
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
    const { fetcher } = mount(); open();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /Trust status/ }));
    open();
    await act(() => new Promise(resolve => setTimeout(resolve, 1)));
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
