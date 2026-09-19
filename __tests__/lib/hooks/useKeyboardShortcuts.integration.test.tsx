import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { formatShortcut, useKeyboardShortcuts, type ShortcutDefinition } from '@/lib/hooks/useKeyboardShortcuts';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const shortcut = (action: () => void, extra: Partial<ShortcutDefinition> = {}): ShortcutDefinition => ({ id: 'save', key: 's', modifiers: { ctrl: true }, description: 'Save', category: 'Editing', action, ...extra });

describe('keyboard shortcuts with real focus and dialog components', () => {
  it('suspends a global shortcut inside a real dialog and restores it after closing', () => {
    const action = vi.fn();
    function Consumer() {
      const [open, setOpen] = useState(false);
      useKeyboardShortcuts([shortcut(action, { global: true })]);
      return <><button onClick={() => setOpen(true)}>Open settings</button><Dialog open={open} onOpenChange={setOpen}><DialogContent aria-describedby={undefined}><DialogTitle>Settings</DialogTitle><button onClick={() => setOpen(false)}>Done</button></DialogContent></Dialog></>;
    }
    render(<Consumer />);
    fireEvent.keyDown(document, { key: 's', ctrlKey: true });
    expect(action).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Open settings' }));
    fireEvent.keyDown(document, { key: 's', ctrlKey: true });
    expect(action).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    fireEvent.keyDown(document, { key: 's', ctrlKey: true });
    expect(action).toHaveBeenCalledTimes(2);
  });

  it.each(['textarea', 'select'] as const)('leaves %s editing shortcuts unconsumed', tag => {
    const action = vi.fn();
    function Consumer() { useKeyboardShortcuts([shortcut(action)]); return tag === 'textarea' ? <textarea aria-label="Input" /> : <select aria-label="Input"><option>A</option></select>; }
    render(<Consumer />); screen.getByLabelText('Input').focus();
    const event = new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true });
    document.dispatchEvent(event);
    expect(action).not.toHaveBeenCalled(); expect(event.defaultPrevented).toBe(false);
  });

  it('honors the Monaco focus opt-in separately from the global input opt-in', () => {
    const action = vi.fn();
    function Consumer({ allow }: { allow: boolean }) { useKeyboardShortcuts([shortcut(action, { global: true, ignoreWhenEditorFocused: !allow })]); return <div className="monaco-editor"><textarea aria-label="Source" /></div>; }
    const { rerender } = render(<Consumer allow={false} />); screen.getByLabelText('Source').focus();
    fireEvent.keyDown(document, { key: 's', ctrlKey: true }); expect(action).not.toHaveBeenCalled();
    rerender(<Consumer allow />);
    fireEvent.keyDown(document, { key: 's', ctrlKey: true }); expect(action).toHaveBeenCalledOnce();
  });

  it('uses updated actions after rerender and removes handlers on unmount', () => {
    const first = vi.fn(); const second = vi.fn();
    function Consumer({ action }: { action: () => void }) { useKeyboardShortcuts([shortcut(action)]); return <button>Editor</button>; }
    const { rerender, unmount } = render(<Consumer action={first} />);
    rerender(<Consumer action={second} />);
    fireEvent.keyDown(document, { key: 'S', ctrlKey: true });
    expect(first).not.toHaveBeenCalled(); expect(second).toHaveBeenCalledOnce();
    unmount(); fireEvent.keyDown(document, { key: 's', ctrlKey: true }); expect(second).toHaveBeenCalledOnce();
  });

  it('allows a later matching shortcut when the first gate declines without consuming the event', () => {
    const first = vi.fn(); const second = vi.fn();
    function Consumer() { useKeyboardShortcuts([shortcut(first, { shouldFire: () => false }), shortcut(second)]); return <button>Editor</button>; }
    render(<Consumer />);
    const event = new KeyboardEvent('keydown', { key: 's', metaKey: true, bubbles: true, cancelable: true }); document.dispatchEvent(event);
    expect(first).not.toHaveBeenCalled(); expect(second).toHaveBeenCalledOnce(); expect(event.defaultPrevented).toBe(true);
  });

  it.each(['Macintosh', 'iPad'])('formats platform modifier labels for %s', userAgent => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(userAgent);
    expect(formatShortcut(shortcut(vi.fn(), { key: 'Enter', modifiers: { ctrl: true, shift: true, alt: true } }))).toBe('Cmd+Shift+Option+Enter');
  });
});
