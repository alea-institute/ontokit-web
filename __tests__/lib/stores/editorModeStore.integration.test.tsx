import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ModeSwitcher } from '@/components/editor/ModeSwitcher';
import { useEditorModeStore } from '@/lib/stores/editorModeStore';

beforeEach(() => { localStorage.clear(); useEditorModeStore.setState({ editorMode: 'standard', theme: 'light', hasSeenAutoSaveToast: false, showManualSaveButton: true, preferEditMode: false }); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear(); document.documentElement.classList.remove('dark'); });

describe('editor preferences real UI and persistence', () => {
  it('persists a mode selected in the real switcher and restores the selection on hydration', async () => {
    render(<ModeSwitcher />);
    fireEvent.click(screen.getByRole('button', { name: 'Developer' }));
    expect(screen.getByRole('button', { name: 'Developer' }).getAttribute('aria-pressed')).toBe('true');
    const saved = localStorage.getItem('ontokit-editor-preferences')!;
    expect(JSON.parse(saved).state.editorMode).toBe('developer');
    act(() => useEditorModeStore.setState({ editorMode: 'standard' }));
    localStorage.setItem('ontokit-editor-preferences', saved);
    await act(() => useEditorModeStore.persist.rehydrate());
    expect(screen.getByRole('button', { name: 'Developer' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Standard' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('keeps explicit new preferences when migrating a conflicting legacy save-button field', async () => {
    localStorage.setItem('ontokit-editor-preferences', JSON.stringify({ version: 0, state: { editorMode: 'developer', theme: 'dark', showManualSaveButton: true, hideSaveButton: true, hasSeenAutoSaveToast: true } }));
    await act(() => useEditorModeStore.persist.rehydrate());
    expect(useEditorModeStore.getState()).toMatchObject({ editorMode: 'developer', theme: 'dark', showManualSaveButton: true, hasSeenAutoSaveToast: true });
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(JSON.parse(localStorage.getItem('ontokit-editor-preferences')!).state).not.toHaveProperty('hideSaveButton');
  });

  it('claims the teaching message only once through the browser lock boundary', async () => {
    let tail = Promise.resolve();
    const request = vi.fn((_name: string, callback: () => boolean) => { const result = tail.then(callback); tail = result.then(() => undefined); return result; });
    vi.stubGlobal('navigator', { locks: { request } });
    const claim = useEditorModeStore.getState().claimAutoSaveTeachingToast;
    expect(await Promise.all([claim(), claim()])).toEqual([true, false]);
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[0][0]).toBe('ontokit-auto-save-toast-claim');
    expect(localStorage.getItem('ontokit-auto-save-toast-seen')).toBe('true');
  });

  it('falls back to persisted state if the dedicated marker cannot be read or written', async () => {
    const read = localStorage.getItem.bind(localStorage); const write = localStorage.setItem.bind(localStorage);
    vi.spyOn(localStorage, 'getItem').mockImplementation(key => { if (key === 'ontokit-auto-save-toast-seen') throw new Error('Marker unavailable'); return read(key); });
    vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => { if (key === 'ontokit-auto-save-toast-seen') throw new Error('Marker unavailable'); write(key, value); });
    expect(await useEditorModeStore.getState().claimAutoSaveTeachingToast()).toBe(true);
    expect(await useEditorModeStore.getState().claimAutoSaveTeachingToast()).toBe(false);
    expect(JSON.parse(read('ontokit-editor-preferences')!).state.hasSeenAutoSaveToast).toBe(true);
  });

  it('retains current usable preferences after corrupt stored JSON fails hydration', async () => {
    localStorage.setItem('ontokit-editor-preferences', '{corrupt');
    await act(() => useEditorModeStore.persist.rehydrate());
    expect(useEditorModeStore.getState()).toMatchObject({ editorMode: 'standard', theme: 'light', showManualSaveButton: true });
    render(<ModeSwitcher />); fireEvent.click(screen.getByRole('button', { name: 'Developer' }));
    expect(JSON.parse(localStorage.getItem('ontokit-editor-preferences')!).state.editorMode).toBe('developer');
  });
});
