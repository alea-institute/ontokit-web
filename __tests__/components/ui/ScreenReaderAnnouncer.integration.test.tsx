import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ScreenReaderAnnouncerProvider, useAnnounce } from '@/components/ui/ScreenReaderAnnouncer';
import { useKeyboardShortcuts } from '@/lib/hooks/useKeyboardShortcuts';

function Consumer() {
  const { announce } = useAnnounce();
  useKeyboardShortcuts([{ id: 'announce', key: 's', modifiers: { ctrl: true }, description: 'Save', category: 'Editor', action: () => announce('Saved') }]);
  return <><button onClick={() => announce('Save failed', 'assertive')}>Fail</button><button onClick={() => announce('Saved')}>Save</button></>;
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('screen reader announcement lifecycle', () => {
  it('publishes a real keyboard action and clears its live region after five seconds', () => {
    render(<ScreenReaderAnnouncerProvider><Consumer /></ScreenReaderAnnouncerProvider>);
    fireEvent.keyDown(document, { key: 's', ctrlKey: true });
    act(() => vi.advanceTimersByTime(20));
    expect(screen.getByRole('status').textContent).toBe('Saved');
    act(() => vi.advanceTimersByTime(4980));
    expect(screen.getByRole('status').textContent).toBe('');
  });

  it('extends clearing after a later assertive message and clears both priorities together', () => {
    render(<ScreenReaderAnnouncerProvider><Consumer /></ScreenReaderAnnouncerProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    act(() => vi.advanceTimersByTime(4000));
    fireEvent.click(screen.getByRole('button', { name: 'Fail' }));
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByRole('status').textContent).toBe('Saved');
    expect(screen.getByRole('alert').textContent).toBe('Save failed');
    act(() => vi.advanceTimersByTime(4000));
    expect(screen.getByRole('status').textContent).toBe('');
    expect(screen.getByRole('alert').textContent).toBe('');
  });

  it('clears the region before repeating identical text so the update is observable', () => {
    render(<ScreenReaderAnnouncerProvider><Consumer /></ScreenReaderAnnouncerProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    act(() => vi.advanceTimersByTime(20));
    expect(screen.getByRole('status').textContent).toBe('Saved');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('status').textContent).toBe('');
    act(() => vi.advanceTimersByTime(20));
    expect(screen.getByRole('status').textContent).toBe('Saved');
  });

  it('allows consumers outside a provider to invoke the default no-op safely', () => {
    render(<Consumer />);
    expect(() => fireEvent.click(screen.getByRole('button', { name: 'Fail' }))).not.toThrow();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
