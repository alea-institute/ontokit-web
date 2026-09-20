import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { BranchProvider, branchQueryKeys } from '@/lib/context/BranchContext';
import { PRCreateModal } from '@/components/pr/PRCreateModal';
import { jsonResponse, llmHookHarness } from '../../fixtures/llm-hook-harness';
afterEach(() => { cleanup(); vi.unstubAllGlobals(); sessionStorage.clear(); });
it('initializes the target from late branch data and preserves an explicit target on refresh', async () => {
  let release!: (value: Response) => void;
  vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(resolve => { release = resolve; })));
  const { wrapper, client } = llmHookHarness();
  render(<BranchProvider projectId="p" initialBranch="feature"><PRCreateModal projectId="p" accessToken="token" isOpen onClose={() => {}} onCreated={() => {}} /></BranchProvider>, { wrapper });
  const response = { items: [{ name: 'feature' }, { name: 'develop' }, { name: 'release' }], current_branch: 'feature', default_branch: 'develop' };
  await act(async () => release(jsonResponse(response)));
  const target = screen.getAllByRole('combobox')[1] as HTMLSelectElement;
  await waitFor(() => expect(target.value).toBe('develop'));
  fireEvent.change(target, { target: { value: 'release' } });
  await act(async () => { client.setQueryData(branchQueryKeys.list('p'), { ...response, default_branch: 'feature' }); });
  expect(target.value).toBe('release');
});
