import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemberList } from '@/components/projects/member-list';
import { projectApi, type ProjectMember, type ProjectRole } from '@/lib/api/projects';

const member = (role: ProjectRole = 'editor'): ProjectMember => ({
  id: 'membership', project_id: 'project', user_id: 'member', role,
  user: { id: 'member', name: 'Test Member' }, created_at: '2026-01-01',
});
const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
afterEach(() => vi.unstubAllGlobals());

function ConnectedMembers({ initial = member() }: { initial?: ProjectMember }) {
  const [members, setMembers] = useState([initial]);
  const [error, setError] = useState('');
  return <><p role="status">{error}</p><MemberList members={members} currentUserId="owner" currentUserRole="owner"
    onUpdateRole={async (id, data) => {
      try {
        const updated = await projectApi.updateMember('project', id, data, 'test-token');
        setMembers([updated]);
      } catch (error) { setError((error as Error).message); }
    }}
    onRemove={async id => { await projectApi.removeMember('project', id, 'test-token'); setMembers([]); }}
    onTransferOwnership={async id => {
      const result = await projectApi.transferOwnership('project', { new_owner_id: id }, 'test-token');
      setMembers(result.items);
    }}
  /></>;
}
function basic(role: ProjectRole, currentUserRole: ProjectRole, extra = {}) {
  return render(<MemberList members={[member(role)]} currentUserId="other" currentUserRole={currentUserRole}
    onUpdateRole={vi.fn().mockResolvedValue(undefined)} onRemove={vi.fn().mockResolvedValue(undefined)} {...extra} />);
}

describe('MemberList real API and permission flows', () => {
  it('changes a role through the API and renders the returned membership', async () => {
    const fetch = vi.fn().mockResolvedValue(response(member('suggester')));
    vi.stubGlobal('fetch', fetch);
    render(<ConnectedMembers />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByRole('button', { name: 'Suggester' }));
    await screen.findByText('Suggester');
    expect(screen.queryByText('Change role')).toBeNull();
    const [url, options] = fetch.mock.calls[0];
    expect(String(url)).toContain('/projects/project/members/member');
    expect(options.method).toBe('PATCH');
    expect(JSON.parse(options.body)).toEqual({ role: 'suggester' });
    expect(options.headers.get('Authorization')).toBe('Bearer test-token');
  });

  it('disables an in-flight role update and releases the row after an API failure handled by the parent', async () => {
    let resolve!: (value: Response) => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(r => { resolve = r; })));
    render(<ConnectedMembers />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByRole('button', { name: 'Viewer' }));
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('checkbox') as HTMLInputElement).disabled).toBe(true);
    await act(async () => resolve(response({ detail: 'Denied' }, 403)));
    expect(screen.getByRole('status').textContent).toContain('Denied');
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByText('Editor')).toBeDefined();
  });

  it('persists structural self-merge opt-in and opt-out with the existing role', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(response({ ...member(), can_self_merge_structural: true }))
      .mockResolvedValueOnce(response({ ...member(), can_self_merge_structural: false }));
    vi.stubGlobal('fetch', fetch);
    render(<ConnectedMembers />);
    fireEvent.click(screen.getByRole('checkbox'));
    await waitFor(() => expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(true));
    fireEvent.click(screen.getByRole('checkbox'));
    await waitFor(() => expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(false));
    expect(fetch.mock.calls.map(([, options]) => JSON.parse(options.body))).toEqual([
      { role: 'editor', can_self_merge_structural: true }, { role: 'editor', can_self_merge_structural: false },
    ]);
  });

  it('removes membership through DELETE and updates the parent list to empty', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetch);
    render(<ConnectedMembers />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByRole('button', { name: 'Remove member' }));
    await waitFor(() => expect(screen.queryByText('Test Member')).toBeNull());
    expect(fetch.mock.calls[0][1].method).toBe('DELETE');
  });

  it('transfers ownership to an admin through the real API', async () => {
    const fetch = vi.fn().mockResolvedValue(response({ items: [member('owner')], total: 1 }));
    vi.stubGlobal('fetch', fetch);
    render(<ConnectedMembers initial={member('admin')} />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByRole('button', { name: 'Transfer Ownership' }));
    await screen.findByText('Owner');
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ new_owner_id: 'member' });
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('prevents admins from editing another admin', () => {
    basic('admin', 'admin');
    expect(screen.queryByRole('button')).toBeNull();
  });
  it('restricts public-project admin role choices to editor and suggester', () => {
    basic('viewer', 'admin', { isPublic: true });
    fireEvent.click(screen.getByRole('button'));
    expect(screen.queryByRole('button', { name: 'Admin' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Editor' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Suggester' })).toBeDefined();
  });
  it('omits viewer as an assignable role on public projects', () => {
    basic('editor', 'owner', { isPublic: true });
    fireEvent.click(screen.getByRole('button'));
    expect(screen.queryByRole('button', { name: 'Viewer' })).toBeNull();
  });
  it('closes the menu from the backdrop and by toggling the menu button', () => {
    const { container } = basic('editor', 'owner');
    const button = screen.getByRole('button');
    fireEvent.click(button);
    fireEvent.click(container.querySelector('.fixed.inset-0')!);
    expect(screen.queryByText('Change role')).toBeNull();
    fireEvent.click(button);
    fireEvent.click(button);
    expect(screen.queryByText('Change role')).toBeNull();
  });
  it('disables all management controls while parent data is loading', () => {
    basic('editor', 'owner', { isLoading: true });
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('checkbox') as HTMLInputElement).disabled).toBe(true);
  });
  it('renders the supplied trust control with the real member and supports an empty roster', () => {
    const { rerender } = basic('viewer', 'owner', { renderTrustControl: (m: ProjectMember) => <span>Trust for {m.user_id}</span> });
    expect(screen.getByText('Trust for member')).toBeDefined();
    rerender(<MemberList members={[]} currentUserId="owner" currentUserRole="owner" onUpdateRole={async () => {}} onRemove={async () => {}} />);
    expect(screen.queryByText('Test Member')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
