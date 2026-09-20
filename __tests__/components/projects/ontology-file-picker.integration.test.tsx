import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { OntologyFilePicker } from '@/components/projects/ontology-file-picker';
import type { GitHubRepoFileInfo } from '@/lib/api/projects';

const file = (path: string, size = 512): GitHubRepoFileInfo => ({ path, name: path.split('/').pop()!, size });
const response = (items: GitHubRepoFileInfo[]) => new Response(JSON.stringify({ items, total: items.length }));
const picker = (onSelect = vi.fn(), repo = 'repo') => <OntologyFilePicker owner="test owner" repo={repo} token="test-token" onSelect={onSelect} />;
afterEach(() => vi.unstubAllGlobals());

function scan(items: GitHubRepoFileInfo[]) {
  const fetch = vi.fn().mockResolvedValue(response(items));
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

describe('OntologyFilePicker real scan and path selection', () => {
  it.each([false, true])('clears old source and output selections on repository change (single file: %s)', async single => {
    const fetch = scan([file('old.owl'), file('old-output.ttl')]);
    const selected = vi.fn();
    const view = render(picker(selected));
    fireEvent.click(await screen.findByRole('button', { name: /old.owl/ }));
    fetch.mockResolvedValueOnce(response(single ? [file('current.owl')] : [file('one.owl'), file('two.owl')]));
    view.rerender(picker(selected, 'current'));
    await screen.findByText(single ? 'current.owl' : 'one.owl');
    if (single) {
      expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('current.ttl');
      fireEvent.click(screen.getByRole('button', { name: 'Confirm Turtle output path' }));
      expect(selected).toHaveBeenCalledExactlyOnceWith(file('current.owl'), 'current.ttl');
    } else {
      expect(screen.queryByRole('button', { name: 'Confirm Turtle output path' })).toBeNull();
      expect(selected).not.toHaveBeenCalled();
    }
  });

  it('scans with encoded query parameters and bearer authentication then auto-selects uppercase Turtle', async () => {
    const input = file('nested/model.TTL');
    const fetch = scan([input]);
    const selected = vi.fn();
    render(picker(selected));
    await waitFor(() => expect(selected).toHaveBeenCalledWith(input, input.path));
    const [url, options] = fetch.mock.calls[0];
    expect(new URL(url).pathname).toBe('/api/v1/projects/github/scan-files');
    expect(new URL(url).searchParams.get('owner')).toBe('test owner');
    expect(new URL(url).searchParams.get('repo')).toBe('repo');
    expect(options.headers.get('Authorization')).toBe('Bearer test-token');
    expect(screen.getByText('512 B')).toBeDefined();
  });

  it('confirms the suggested normalized output for a sole nested OWL file', async () => {
    const input = file('nested/source.owl');
    scan([input]);
    const selected = vi.fn();
    render(picker(selected));
    const textbox = await screen.findByRole('textbox');
    expect((textbox as HTMLInputElement).value).toBe('nested/source.ttl');
    expect(selected).not.toHaveBeenCalled();
    expect((screen.getByRole('radio', { name: /Use existing/ }) as HTMLInputElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Turtle output path' }));
    expect(selected).toHaveBeenCalledWith(input, 'nested/source.ttl');
  });

  it('supports extensionless source paths returned by the scanner', async () => {
    scan([file('ontology')]);
    render(picker());
    expect((await screen.findByRole('textbox') as HTMLInputElement).value).toBe('ontology.ttl');
  });

  it.each(['', '   ', 'output.rdf', 'output.ttl.bak'])('prevents confirmation of invalid output %j', async path => {
    scan([file('source.owl')]);
    const selected = vi.fn();
    render(picker(selected));
    fireEvent.change(await screen.findByRole('textbox'), { target: { value: path } });
    const confirm = screen.getByRole('button', { name: 'Confirm Turtle output path' });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(confirm);
    expect(selected).not.toHaveBeenCalled();
  });

  it('trims whitespace while preserving a valid uppercase output extension', async () => {
    const input = file('source.owl');
    scan([input]);
    const selected = vi.fn();
    render(picker(selected));
    fireEvent.change(await screen.findByRole('textbox'), { target: { value: '  normalized/output.TTL  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Turtle output path' }));
    expect(selected).toHaveBeenCalledWith(input, 'normalized/output.TTL');
  });

  it('defaults a non-Turtle selection to an existing Turtle file and permits choosing another', async () => {
    const input = file('source.owl');
    scan([input, file('first.ttl'), file('second.ttl')]);
    const selected = vi.fn();
    render(picker(selected));
    fireEvent.click(await screen.findByRole('button', { name: /source.owl/ }));
    expect((screen.getByRole('radio', { name: /Use existing/ }) as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Turtle output path' }));
    expect(selected).toHaveBeenLastCalledWith(input, 'first.ttl');
    fireEvent.click(screen.getByRole('button', { name: 'second.ttl' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Turtle output path' }));
    expect(selected).toHaveBeenLastCalledWith(input, 'second.ttl');
    fireEvent.click(screen.getByRole('radio', { name: /Create new/ }));
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('source.ttl');
    fireEvent.click(screen.getByRole('radio', { name: /Use existing/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Turtle output path' }));
    expect(selected).toHaveBeenLastCalledWith(input, 'second.ttl');
  });

  it('resets custom output when selecting another source and removes the substep for Turtle', async () => {
    const turtle = file('existing.ttl');
    scan([file('first.owl'), file('second.rdf'), turtle]);
    const selected = vi.fn();
    render(picker(selected));
    fireEvent.click(await screen.findByRole('button', { name: /first.owl/ }));
    fireEvent.click(screen.getByRole('radio', { name: /Create new/ }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'custom.ttl' } });
    fireEvent.click(screen.getByRole('button', { name: /second.rdf/ }));
    fireEvent.click(screen.getByRole('radio', { name: /Create new/ }));
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('second.ttl');
    fireEvent.click(screen.getByRole('button', { name: /existing.ttl 512 B/ }));
    expect(selected).toHaveBeenCalledWith(turtle, 'existing.ttl');
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Confirm Turtle output path' })).toBeNull();
  });

  it('selects a non-Turtle source into new output mode when no Turtle files exist', async () => {
    scan([file('first.owl'), file('second.rdf')]);
    render(picker());
    fireEvent.click(await screen.findByRole('button', { name: /second.rdf/ }));
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('second.ttl');
  });

  it('renders an API error then recovers when the repository changes to an empty scan', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ detail: 'Repository access denied' }), { status: 403 }))
      .mockResolvedValueOnce(response([]));
    vi.stubGlobal('fetch', fetch);
    const { rerender } = render(picker());
    await screen.findByText(/Repository access denied/);
    rerender(picker(vi.fn(), 'accessible'));
    await screen.findByText('No ontology files found');
    expect(screen.queryByText(/Repository access denied/)).toBeNull();
  });

  it('ignores an obsolete successful scan after repository navigation', async () => {
    let resolve!: (value: Response) => void;
    const fetch = vi.fn().mockImplementationOnce(() => new Promise<Response>(r => { resolve = r; }))
      .mockResolvedValueOnce(response([file('current.ttl')]));
    vi.stubGlobal('fetch', fetch);
    const selected = vi.fn();
    const { rerender } = render(picker(selected));
    rerender(picker(selected, 'current'));
    await waitFor(() => expect(selected).toHaveBeenCalledWith(file('current.ttl'), 'current.ttl'));
    await act(async () => resolve(response([file('obsolete.ttl')])));
    expect(selected).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('obsolete.ttl')).toBeNull();
  });

  it('ignores a scan error after unmount without invoking selection', async () => {
    let resolve!: (value: Response) => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(r => { resolve = r; })));
    const selected = vi.fn();
    const { unmount } = render(picker(selected));
    unmount();
    await act(async () => resolve(new Response('Not found', { status: 404 })));
    expect(selected).not.toHaveBeenCalled();
  });
});
