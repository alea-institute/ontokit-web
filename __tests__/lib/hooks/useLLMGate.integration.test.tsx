import type { ReactNode } from 'react';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { SessionProvider } from 'next-auth/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useLLMGate } from '@/lib/hooks/useLLMGate';
import { useSuggestions } from '@/lib/hooks/useSuggestions';
import { LLM_STATUS_INVALIDATION_EVENT } from '@/lib/api/llm';
import { useSuggestionStore } from '@/lib/stores/suggestionStore';
import { jsonResponse, llmHookHarness } from '../../fixtures/llm-hook-harness';

function setup(generationStatus: number, role: 'admin' | 'suggester' = 'admin') {
  let exhausted = false; let failedRead = false;
  const fetcher = vi.fn(async (input: string | URL | Request) => {
    if (String(input).endsWith('/generate-suggestions')) { exhausted = generationStatus === 402; return jsonResponse({ detail: 'Limit reached' }, generationStatus); }
    if (failedRead) return new Response('Status denied', { status: 403 });
    return jsonResponse({ configured: true, provider: 'local', budget_exhausted: exhausted, daily_remaining: 0, monthly_budget_usd: 100, monthly_spent_usd: exhausted ? 100 : 10, burn_rate_daily_usd: 2 });
  });
  vi.stubGlobal('fetch', fetcher);
  const { wrapper: QueryWrapper } = llmHookHarness();
  const wrapper = ({ children }: { children: ReactNode }) => <SessionProvider session={{ user: { email: 'fixture@example.invalid' }, accessToken: 'token', expires: '2099-01-01T00:00:00Z' }} refetchOnWindowFocus={false}><QueryWrapper>{children}</QueryWrapper></SessionProvider>;
  const hook = renderHook(() => {
    const gate = useLLMGate('project', role);
    const suggestions = useSuggestions({ projectId: 'project', branch: 'main', entityIri: 'http://example.org/Person', suggestionType: 'children', accessToken: 'token', canUseLLM: gate.canUseLLM });
    return { gate, suggestions };
  }, { wrapper });
  return { ...hook, fetcher, failRead: (next: boolean) => { failedRead = next; } };
}
afterEach(() => { cleanup(); vi.unstubAllGlobals(); useSuggestionStore.getState().clearAllSuggestions(); });

describe('LLM quota events through real generation and status clients', () => {
  it.each([402, 429])('refreshes advisory status after generation returns HTTP %s', async status => {
    const { result, fetcher } = setup(status);
    await waitFor(() => expect(result.current.gate.canUseLLM).toBe(true));
    expect(result.current.gate.roleLimitLabel).toBe('Admin — unlimited');
    await act(() => result.current.suggestions.request());
    await waitFor(() => expect(fetcher.mock.calls.filter(([input]) => String(input).endsWith('/status'))).toHaveLength(2));
    await waitFor(() => expect(result.current.gate.budgetExhausted).toBe(status === 402));
    expect(result.current.gate.canUseLLM).toBe(status !== 402);
    expect(result.current.suggestions.error).toContain(status === 402 ? 'budget has been exhausted' : 'request limit');
  });

  it('ignores invalidation events for other projects and events with no detail', async () => {
    const { result, fetcher } = setup(403, 'suggester');
    await waitFor(() => expect(result.current.gate.canUseLLM).toBe(true));
    expect(result.current.gate.roleLimitLabel).toBe('Suggester — 100/day');
    await act(async () => { window.dispatchEvent(new Event(LLM_STATUS_INVALIDATION_EVENT)); window.dispatchEvent(new CustomEvent(LLM_STATUS_INVALIDATION_EVENT, { detail: { projectId: 'other' } })); });
    expect(fetcher).toHaveBeenCalledTimes(1);
    await act(() => result.current.suggestions.request());
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('exposes a failed status refresh and recovers through explicit invalidation', async () => {
    const { result, failRead } = setup(403);
    await waitFor(() => expect(result.current.gate.canUseLLM).toBe(true));
    failRead(true); await act(() => result.current.gate.invalidateStatus());
    await waitFor(() => expect(result.current.gate.isError).toBe(true));
    expect(result.current.gate.notConfigured).toBe(false);
    failRead(false); await act(() => result.current.gate.invalidateStatus());
    await waitFor(() => expect(result.current.gate.isError).toBe(false));
    expect(result.current.gate.canUseLLM).toBe(true);
  });

  it('removes the status invalidation listener on unmount', async () => {
    const { result, fetcher, unmount } = setup(403);
    await waitFor(() => expect(result.current.gate.canUseLLM).toBe(true)); unmount();
    await act(async () => { window.dispatchEvent(new CustomEvent(LLM_STATUS_INVALIDATION_EVENT, { detail: { projectId: 'project' } })); });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
