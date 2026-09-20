import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useTranslationCoverage } from '@/lib/hooks/useTranslationCoverage';
import { translationQueryKeys } from '@/lib/hooks/useTranslationConfig';
import type { TranslationBackfillStatus } from '@/lib/api/translations';
import { jsonResponse, llmHookHarness } from '../../fixtures/llm-hook-harness';

function setup() {
  let job: TranslationBackfillStatus | null = null;
  let failure = '';
  const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    if (failure && url.pathname.endsWith(failure)) return jsonResponse({ detail: 'Forbidden' }, 403);
    if (url.pathname.endsWith('/coverage')) return jsonResponse({ branch: url.searchParams.get('branch'), languages: [], total_entities: job?.completed ?? 0 });
    if (url.pathname.endsWith('/status')) return jsonResponse(job);
    if (url.pathname.endsWith('/preview')) return jsonResponse({ literal_count: 4, expected_cost_usd: 0.2, upper_bound_cost_usd: 0.5, batch_discount_applied: true });
    if (init?.method === 'POST') { job = { job_id: 'job', status: 'pending', total: 4, completed: 0, error: null }; return jsonResponse({ job_id: 'job' }); }
    throw new Error(`Unexpected URL: ${url}`);
  });
  vi.stubGlobal('fetch', fetcher);
  const { client, wrapper } = llmHookHarness();
  return { client, fetcher, setJob: (next: TranslationBackfillStatus) => { job = next; }, fail: (suffix: string) => { failure = suffix; }, ...renderHook(() => useTranslationCoverage('project', 'review/one', 'token'), { wrapper }) };
}
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('translation coverage and backfill HTTP integration', () => {
  it('loads an empty report, previews encoded filters and refreshes after launch', async () => {
    const { result, fetcher } = setup();
    await waitFor(() => expect(result.current.coverage?.languages).toEqual([]));
    const filters = { branch: 'review/one', language: 'pt-BR', era_before: '2025-01-01', never_confirmed: false };
    await act(async () => { expect(await result.current.previewBackfill(filters)).toMatchObject({ literal_count: 4, batch_discount_applied: true }); });
    const preview = fetcher.mock.calls.find(([input]) => String(input).includes('/preview'))!;
    expect(Object.fromEntries(new URL(String(preview[0])).searchParams)).toEqual({ ...filters, never_confirmed: 'false' });
    expect(new Headers(preview[1]?.headers).get('Authorization')).toBe('Bearer token');
    await act(() => result.current.launchBackfill(filters));
    await waitFor(() => expect(result.current.job?.status).toBe('pending'));
    const post = fetcher.mock.calls.find(([, init]) => init?.method === 'POST')!;
    expect(JSON.parse(String(post[1]?.body))).toEqual(filters);
    expect(fetcher.mock.calls.filter(([input]) => String(input).includes('/coverage'))).toHaveLength(2);
  });

  it.each(['completed', 'failed'] as const)('refreshes coverage when a job progresses and becomes %s', async status => {
    const { result, client, setJob, fetcher } = setup();
    await waitFor(() => expect(result.current.coverage).toBeDefined());
    await act(() => result.current.launchBackfill({ branch: 'review/one' }));
    await waitFor(() => expect(result.current.job?.status).toBe('pending'));
    const statusKey = translationQueryKeys.backfillStatus('project', 'review/one');
    setJob({ job_id: 'job', status: 'running', total: 4, completed: 2, error: null });
    await act(() => client.invalidateQueries({ queryKey: statusKey }));
    await waitFor(() => expect(result.current.coverage?.total_entities).toBe(2));
    const before = fetcher.mock.calls.filter(([input]) => String(input).includes('/coverage')).length;
    setJob({ job_id: 'job', status, total: 4, completed: 2, error: status === 'failed' ? 'provider rejected' : null });
    await act(() => client.invalidateQueries({ queryKey: statusKey }));
    await waitFor(() => expect(fetcher.mock.calls.filter(([input]) => String(input).includes('/coverage')).length).toBe(before + 1));
    await act(() => client.invalidateQueries({ queryKey: statusKey }));
    expect(fetcher.mock.calls.filter(([input]) => String(input).includes('/coverage'))).toHaveLength(before + 1);
  });

  it.each(['preview', 'launch'] as const)('reports %s failures without retry and supports reset', async kind => {
    const { result, fail, fetcher } = setup();
    await waitFor(() => expect(result.current.coverage).toBeDefined());
    fail(kind === 'preview' ? '/preview' : '/backfill');
    await act(async () => {
      await expect((kind === 'preview' ? result.current.previewBackfill : result.current.launchBackfill)({ branch: 'review/one' })).rejects.toThrow();
    });
    await waitFor(() => expect(kind === 'preview' ? result.current.previewError : result.current.launchError).toBeInstanceOf(Error));
    expect(fetcher.mock.calls.filter(([input, init]) => kind === 'preview' ? String(input).includes('/preview') : init?.method === 'POST')).toHaveLength(1);
    act(() => (kind === 'preview' ? result.current.resetPreview : result.current.resetLaunch)());
    await waitFor(() => expect(kind === 'preview' ? result.current.previewError : result.current.launchError).toBeNull());
  });

  it('exposes coverage errors while preserving a separately loaded job', async () => {
    const { result, fail, client } = setup();
    await waitFor(() => expect(result.current.coverage).toBeDefined());
    fail('/coverage');
    await act(() => client.invalidateQueries({ queryKey: translationQueryKeys.coverage('project', 'review/one') }));
    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));
    expect(result.current.job).toBeNull();
  });

  it.each([['', 'main', 'token'], ['project', '', 'token'], ['project', 'main', undefined]])('does not request an incomplete scope (%s, %s)', async (project, branch, token) => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    const { wrapper } = llmHookHarness();
    const { result } = renderHook(() => useTranslationCoverage(project!, branch!, token), { wrapper });
    await act(async () => {});
    expect(result.current.isLoading).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
