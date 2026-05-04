import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemberList } from "@/components/projects/member-list";
import type { ProjectMember, ProjectRole } from "@/lib/api/projects";

function makeMember(overrides: Partial<ProjectMember> = {}): ProjectMember {
  return {
    id: "mem-1",
    project_id: "proj-1",
    user_id: "user-1",
    role: "editor" as ProjectRole,
    user: { id: "user-1", name: "Alice Smith", email: "alice@example.com" },
    created_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("MemberList", () => {
  const defaultProps = {
    members: [
      makeMember({
        id: "mem-1",
        user_id: "user-1",
        role: "owner" as ProjectRole,
        user: { id: "user-1", name: "Alice Smith", email: "alice@example.com" },
      }),
      makeMember({
        id: "mem-2",
        user_id: "user-2",
        role: "editor" as ProjectRole,
        user: { id: "user-2", name: "Bob Jones", email: "bob@example.com" },
      }),
      makeMember({
        id: "mem-3",
        user_id: "user-3",
        role: "viewer" as ProjectRole,
        user: { id: "user-3", name: "Charlie Brown" },
      }),
    ],
    currentUserId: "user-1",
    currentUserRole: "owner" as ProjectRole,
    onUpdateRole: vi.fn().mockResolvedValue(undefined),
    onRemove: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders all members", () => {
    render(<MemberList {...defaultProps} />);
    expect(screen.getByText("Alice Smith")).toBeDefined();
    expect(screen.getByText("Bob Jones")).toBeDefined();
    expect(screen.getByText("Charlie Brown")).toBeDefined();
  });

  it("shows role labels for each member", () => {
    render(<MemberList {...defaultProps} />);
    expect(screen.getByText("Owner")).toBeDefined();
    expect(screen.getByText("Editor")).toBeDefined();
    expect(screen.getByText("Viewer")).toBeDefined();
  });

  it("shows email when available", () => {
    render(<MemberList {...defaultProps} />);
    expect(screen.getByText("alice@example.com")).toBeDefined();
    expect(screen.getByText("bob@example.com")).toBeDefined();
  });

  it("shows (you) label for current user", () => {
    render(<MemberList {...defaultProps} />);
    expect(screen.getByText("(you)")).toBeDefined();
  });

  it("shows initials from user name", () => {
    render(<MemberList {...defaultProps} />);
    expect(screen.getByText("AS")).toBeDefined(); // Alice Smith
    expect(screen.getByText("BJ")).toBeDefined(); // Bob Jones
    expect(screen.getByText("CB")).toBeDefined(); // Charlie Brown
  });

  it("falls back to user_id when name is absent", () => {
    const members = [
      makeMember({
        id: "mem-x",
        user_id: "uid-abc",
        role: "editor",
        user: undefined,
      }),
    ];
    render(
      <MemberList
        {...defaultProps}
        members={members}
        currentUserId="other"
      />
    );
    expect(screen.getByText("uid-abc")).toBeDefined();
    expect(screen.getByText("UI")).toBeDefined(); // "ui" from uid-abc
  });

  it("does not show action menu for members when current user is viewer", () => {
    render(
      <MemberList
        {...defaultProps}
        currentUserRole="viewer"
      />
    );
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("shows action menu button for editable members when owner", () => {
    render(<MemberList {...defaultProps} />);
    // Owner can edit editor and viewer but not themselves (owner role)
    const buttons = screen.getAllByRole("button");
    // Should have buttons for Bob (editor) and Charlie (viewer)
    expect(buttons.length).toBeGreaterThanOrEqual(2);
  });

  it("opens dropdown menu when action button is clicked", async () => {
    render(<MemberList {...defaultProps} />);
    const buttons = screen.getAllByRole("button");
    // Click the first action button (for Bob - editor)
    await userEvent.click(buttons[0]);
    expect(screen.getByText("Change role")).toBeDefined();
  });

  it("shows Remove member option in dropdown", async () => {
    render(<MemberList {...defaultProps} />);
    const buttons = screen.getAllByRole("button");
    await userEvent.click(buttons[0]);
    expect(screen.getByText("Remove member")).toBeDefined();
  });

  it("calls onRemove when Remove member is clicked", async () => {
    const onRemove = vi.fn().mockResolvedValue(undefined);
    render(<MemberList {...defaultProps} onRemove={onRemove} />);
    const buttons = screen.getAllByRole("button");
    await userEvent.click(buttons[0]);
    await userEvent.click(screen.getByText("Remove member"));
    expect(onRemove).toHaveBeenCalledWith("user-2");
  });

  it("shows Transfer Ownership for admin when owner and callback provided", async () => {
    const members = [
      makeMember({
        id: "mem-1",
        user_id: "user-1",
        role: "owner",
        user: { id: "user-1", name: "Alice" },
      }),
      makeMember({
        id: "mem-2",
        user_id: "user-2",
        role: "admin",
        user: { id: "user-2", name: "Bob" },
      }),
    ];
    const onTransfer = vi.fn().mockResolvedValue(undefined);
    render(
      <MemberList
        {...defaultProps}
        members={members}
        onTransferOwnership={onTransfer}
      />
    );
    const buttons = screen.getAllByRole("button");
    await userEvent.click(buttons[0]);
    expect(screen.getByText("Transfer Ownership")).toBeDefined();
  });

  it("does not show Transfer Ownership for non-admin members", async () => {
    const members = [
      makeMember({
        id: "mem-1",
        user_id: "user-1",
        role: "owner",
        user: { id: "user-1", name: "Alice" },
      }),
      makeMember({
        id: "mem-2",
        user_id: "user-2",
        role: "editor",
        user: { id: "user-2", name: "Bob" },
      }),
    ];
    const onTransfer = vi.fn().mockResolvedValue(undefined);
    render(
      <MemberList
        {...defaultProps}
        members={members}
        onTransferOwnership={onTransfer}
      />
    );
    const buttons = screen.getAllByRole("button");
    await userEvent.click(buttons[0]);
    expect(screen.queryByText("Transfer Ownership")).toBeNull();
  });

  it("shows 'Leave project' for current user self-removal", async () => {
    const members = [
      makeMember({
        id: "mem-1",
        user_id: "user-owner",
        role: "owner",
        user: { id: "user-owner", name: "Owner" },
      }),
      makeMember({
        id: "mem-2",
        user_id: "user-2",
        role: "editor",
        user: { id: "user-2", name: "Current" },
      }),
    ];
    render(
      <MemberList
        {...defaultProps}
        members={members}
        currentUserId="user-2"
        currentUserRole="editor"
      />
    );
    const buttons = screen.getAllByRole("button");
    await userEvent.click(buttons[0]);
    expect(screen.getByText("Leave project")).toBeDefined();
  });
});
