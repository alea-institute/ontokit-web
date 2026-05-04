import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NotificationBell } from "@/components/layout/notification-bell";
import type { Notification } from "@/lib/api/notifications";

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), back: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

// Mock the useNotifications hook
const mockMarkAsRead = vi.fn().mockResolvedValue(undefined);
const mockMarkAllAsRead = vi.fn().mockResolvedValue(undefined);
const mockRefetch = vi.fn();

vi.mock("@/lib/hooks/useNotifications", () => ({
  useNotifications: vi.fn(),
  NOTIFICATIONS_CHANGED_EVENT: "notifications:changed",
}));

import { useNotifications } from "@/lib/hooks/useNotifications";
const mockUseNotifications = vi.mocked(useNotifications);

function makeNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: "n-1",
    type: "suggestion_submitted",
    title: "New suggestion",
    body: "A class was suggested",
    project_id: "proj-1",
    project_name: "Test Project",
    is_read: false,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function setupHook(overrides: Partial<ReturnType<typeof useNotifications>> = {}) {
  mockUseNotifications.mockReturnValue({
    notifications: [],
    unreadCount: 0,
    isLoading: false,
    markAsRead: mockMarkAsRead,
    markAllAsRead: mockMarkAllAsRead,
    refetch: mockRefetch,
    ...overrides,
  });
}

describe("NotificationBell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders bell button with no badge when there are no unread notifications", () => {
    setupHook({ notifications: [], unreadCount: 0 });
    render(<NotificationBell />);

    expect(screen.getByRole("button", { name: "Notifications" })).toBeDefined();
    // No badge should be visible
    expect(screen.queryByText("0")).toBeNull();
  });

  it("shows unread count badge when there are unread notifications", () => {
    setupHook({
      notifications: [makeNotification()],
      unreadCount: 3,
    });
    render(<NotificationBell />);

    expect(screen.getByText("3")).toBeDefined();
  });

  it("shows 99+ when unread count exceeds 99", () => {
    setupHook({
      notifications: [makeNotification()],
      unreadCount: 150,
    });
    render(<NotificationBell />);

    expect(screen.getByText("99+")).toBeDefined();
  });

  it("opens dropdown when bell is clicked", async () => {
    const user = userEvent.setup();
    setupHook({ notifications: [], unreadCount: 0 });
    render(<NotificationBell />);

    await user.click(screen.getByRole("button", { name: "Notifications" }));

    expect(screen.getAllByText("Notifications").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("No notifications")).toBeDefined();
  });

  it("shows notification items in the dropdown", async () => {
    const user = userEvent.setup();
    const notifications = [
      makeNotification({ id: "n-1", title: "First notification", is_read: false }),
      makeNotification({ id: "n-2", title: "Second notification", is_read: true }),
    ];
    setupHook({ notifications, unreadCount: 1 });
    render(<NotificationBell />);

    await user.click(screen.getByRole("button", { name: "Notifications" }));

    expect(screen.getByText("First notification")).toBeDefined();
    expect(screen.getByText("Second notification")).toBeDefined();
  });

  it("shows 'Mark all as read' button when there are unread notifications", async () => {
    const user = userEvent.setup();
    setupHook({
      notifications: [makeNotification({ is_read: false })],
      unreadCount: 1,
    });
    render(<NotificationBell />);

    await user.click(screen.getByRole("button", { name: "Notifications" }));

    expect(screen.getByText("Mark all as read")).toBeDefined();
  });

  it("does not show 'Mark all as read' when all notifications are read", async () => {
    const user = userEvent.setup();
    setupHook({
      notifications: [makeNotification({ is_read: true })],
      unreadCount: 0,
    });
    render(<NotificationBell />);

    await user.click(screen.getByRole("button", { name: "Notifications" }));

    expect(screen.queryByText("Mark all as read")).toBeNull();
  });

  it("calls markAllAsRead when 'Mark all as read' is clicked", async () => {
    const user = userEvent.setup();
    setupHook({
      notifications: [makeNotification({ is_read: false })],
      unreadCount: 1,
    });
    render(<NotificationBell />);

    await user.click(screen.getByRole("button", { name: "Notifications" }));
    await user.click(screen.getByText("Mark all as read"));

    expect(mockMarkAllAsRead).toHaveBeenCalledOnce();
  });

  it("calls markAsRead and navigates when clicking an unread notification", async () => {
    const user = userEvent.setup();
    const notification = makeNotification({
      id: "n-42",
      title: "Unread item",
      is_read: false,
      type: "suggestion_submitted",
      project_id: "proj-1",
    });
    setupHook({ notifications: [notification], unreadCount: 1 });
    render(<NotificationBell />);

    await user.click(screen.getByRole("button", { name: "Notifications" }));
    await user.click(screen.getByText("Unread item"));

    expect(mockMarkAsRead).toHaveBeenCalledWith("n-42");
    expect(mockPush).toHaveBeenCalledWith("/projects/proj-1/suggestions/review");
  });

  it("navigates without marking as read when clicking a read notification", async () => {
    const user = userEvent.setup();
    const notification = makeNotification({
      id: "n-42",
      title: "Read item",
      is_read: true,
      type: "pr_opened",
      project_id: "proj-1",
      target_id: "pr-5",
    });
    setupHook({ notifications: [notification], unreadCount: 0 });
    render(<NotificationBell />);

    await user.click(screen.getByRole("button", { name: "Notifications" }));
    await user.click(screen.getByText("Read item"));

    expect(mockMarkAsRead).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/projects/proj-1/pull-requests/pr-5");
  });

  it("uses target_url when present in notification", async () => {
    const user = userEvent.setup();
    const notification = makeNotification({
      id: "n-1",
      title: "Custom URL",
      is_read: true,
      target_url: "/custom/path",
    });
    setupHook({ notifications: [notification], unreadCount: 0 });
    render(<NotificationBell />);

    await user.click(screen.getByRole("button", { name: "Notifications" }));
    await user.click(screen.getByText("Custom URL"));

    expect(mockPush).toHaveBeenCalledWith("/custom/path");
  });

  it("displays notification body and project name", async () => {
    const user = userEvent.setup();
    const notification = makeNotification({
      title: "Test title",
      body: "Detailed body text",
      project_name: "My Ontology",
    });
    setupHook({ notifications: [notification], unreadCount: 1 });
    render(<NotificationBell />);

    await user.click(screen.getByRole("button", { name: "Notifications" }));

    expect(screen.getByText("Detailed body text")).toBeDefined();
    expect(screen.getByText(/My Ontology/)).toBeDefined();
  });

  it("closes dropdown when bell is clicked again", async () => {
    const user = userEvent.setup();
    setupHook({ notifications: [], unreadCount: 0 });
    render(<NotificationBell />);

    const bell = screen.getByRole("button", { name: "Notifications" });
    await user.click(bell);
    expect(screen.getByText("No notifications")).toBeDefined();

    await user.click(bell);
    expect(screen.queryByText("No notifications")).toBeNull();
  });

  it("closes dropdown on outside click", async () => {
    const user = userEvent.setup();
    setupHook({ notifications: [], unreadCount: 0 });
    render(
      <div>
        <NotificationBell />
        <div data-testid="outside">Outside</div>
      </div>
    );

    await user.click(screen.getByRole("button", { name: "Notifications" }));
    expect(screen.getByText("No notifications")).toBeDefined();

    await user.click(screen.getByTestId("outside"));
    expect(screen.queryByText("No notifications")).toBeNull();
  });

  it("navigates to join_request settings URL", async () => {
    const user = userEvent.setup();
    const notification = makeNotification({
      id: "n-1",
      title: "Join request",
      is_read: true,
      type: "join_request",
      project_id: "proj-1",
    });
    setupHook({ notifications: [notification], unreadCount: 0 });
    render(<NotificationBell />);

    await user.click(screen.getByRole("button", { name: "Notifications" }));
    await user.click(screen.getByText("Join request"));

    expect(mockPush).toHaveBeenCalledWith("/projects/proj-1/settings#join-requests");
  });
});
