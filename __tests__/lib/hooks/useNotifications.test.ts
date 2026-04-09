import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { NOTIFICATIONS_CHANGED_EVENT } from "@/lib/hooks/useNotifications";
import type { NotificationListResponse } from "@/lib/api/notifications";

// Mock next-auth/react
const mockSession = {
  accessToken: "test-token",
  user: { name: "Alice" },
  expires: "2099-01-01",
};
vi.mock("next-auth/react", () => ({
  useSession: vi.fn(() => ({
    data: mockSession,
    status: "authenticated",
  })),
}));

vi.mock("@/lib/api/notifications", () => ({
  notificationsApi: {
    list: vi.fn(),
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
  },
}));

import { useSession } from "next-auth/react";
import { notificationsApi } from "@/lib/api/notifications";
import { useNotifications } from "@/lib/hooks/useNotifications";

const mockedList = notificationsApi.list as ReturnType<typeof vi.fn>;
const mockedMarkAsRead = notificationsApi.markAsRead as ReturnType<typeof vi.fn>;
const mockedMarkAllAsRead = notificationsApi.markAllAsRead as ReturnType<typeof vi.fn>;
const mockedUseSession = useSession as ReturnType<typeof vi.fn>;

const mockNotifications: NotificationListResponse = {
  items: [
    {
      id: "n1",
      type: "pr_opened",
      title: "PR opened",
      project_id: "proj-1",
      project_name: "Test",
      is_read: false,
      created_at: "2024-06-01T00:00:00Z",
    },
    {
      id: "n2",
      type: "suggestion_approved",
      title: "Suggestion approved",
      project_id: "proj-1",
      project_name: "Test",
      is_read: true,
      created_at: "2024-06-01T01:00:00Z",
    },
  ],
  total: 2,
  unread_count: 1,
};

describe("useNotifications", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedUseSession.mockReturnValue({
      data: mockSession,
      status: "authenticated",
    });
    mockedList.mockResolvedValue(mockNotifications);
    mockedMarkAsRead.mockResolvedValue(undefined);
    mockedMarkAllAsRead.mockResolvedValue(undefined);
  });

  it("fetches notifications on mount", async () => {
    const { result } = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(result.current.notifications).toEqual(mockNotifications.items);
    });
    expect(mockedList).toHaveBeenCalledWith("test-token");
    expect(result.current.unreadCount).toBe(1);
  });

  it("does not fetch when unauthenticated", async () => {
    mockedUseSession.mockReturnValue({
      data: null,
      status: "unauthenticated",
    });

    const { result } = renderHook(() => useNotifications());

    // Give a tick for the effect to run
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(mockedList).not.toHaveBeenCalled();
    expect(result.current.notifications).toEqual([]);
  });

  it("markAsRead updates state optimistically", async () => {
    const { result } = renderHook(() => useNotifications());

    await waitFor(() => expect(result.current.notifications.length).toBe(2));

    await act(async () => {
      await result.current.markAsRead("n1");
    });

    expect(mockedMarkAsRead).toHaveBeenCalledWith("n1", "test-token");
    expect(result.current.notifications.find((n) => n.id === "n1")?.is_read).toBe(true);
    expect(result.current.unreadCount).toBe(0);
  });

  it("markAllAsRead updates all notifications", async () => {
    const { result } = renderHook(() => useNotifications());

    await waitFor(() => expect(result.current.notifications.length).toBe(2));

    await act(async () => {
      await result.current.markAllAsRead();
    });

    expect(mockedMarkAllAsRead).toHaveBeenCalledWith("test-token");
    expect(result.current.notifications.every((n) => n.is_read)).toBe(true);
    expect(result.current.unreadCount).toBe(0);
  });

  it("refetches on custom event dispatch", async () => {
    const { result } = renderHook(() => useNotifications());

    await waitFor(() => expect(result.current.notifications.length).toBe(2));
    const callCount = mockedList.mock.calls.length;

    await act(async () => {
      window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(mockedList.mock.calls.length).toBeGreaterThan(callCount);
  });

  it("stops polling on 401 error", async () => {
    mockedList.mockRejectedValueOnce({ status: 401 });

    const { result } = renderHook(() => useNotifications());

    // Wait for the initial fetch to complete (which will fail with 401)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(result.current.notifications).toEqual([]);
    expect(result.current.isLoading).toBe(false);

    // Record call count after 401, then trigger a polling event
    const callCountAfter401 = mockedList.mock.calls.length;
    await act(async () => {
      window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
      await new Promise((r) => setTimeout(r, 10));
    });

    // Polling should have stopped — no additional calls
    expect(mockedList.mock.calls.length).toBe(callCountAfter401);
  });

  it("handles fetch errors gracefully", async () => {
    mockedList.mockRejectedValueOnce(new Error("Network error"));

    const { result } = renderHook(() => useNotifications());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    // No crash, empty state remains
    expect(result.current.notifications).toEqual([]);
    expect(result.current.unreadCount).toBe(0);
  });

  it("markAsRead does nothing without session", async () => {
    mockedUseSession.mockReturnValue({
      data: null,
      status: "unauthenticated",
    });

    const { result } = renderHook(() => useNotifications());

    await act(async () => {
      await result.current.markAsRead("n1");
    });

    expect(mockedMarkAsRead).not.toHaveBeenCalled();
  });
});
