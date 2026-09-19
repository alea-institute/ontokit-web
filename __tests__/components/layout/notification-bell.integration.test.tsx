import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NotificationBell, NOTIFICATIONS_CHANGED_EVENT } from "@/components/layout/notification-bell";
import type { Notification } from "@/lib/api/notifications";

const boundary = vi.hoisted(() => ({ push: vi.fn(), token: "notification-token" }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: boundary.push }) }));
vi.mock("next-auth/react", () => ({ useSession: () => ({ status: "authenticated", data: { accessToken: boundary.token } }) }));
const fetchMock = vi.fn<typeof fetch>();
const item = (overrides: Partial<Notification> = {}): Notification => ({
  id: "notice-1", title: "Review update", type: "suggestion_submitted", project_id: "project-1",
  is_read: true, created_at: "2026-09-18T12:00:00Z", ...overrides,
});
function response(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
}
function listing(notification: Notification) {
  return response({ items: [notification], total: 1, unread_count: notification.is_read ? 0 : 1 });
}
async function open() {
  fireEvent.click(screen.getByRole("button", { name: "Notifications" }));
  await screen.findByText("Review update");
}
beforeEach(() => { boundary.token = "notification-token"; vi.clearAllMocks(); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("NotificationBell through notification API", () => {
  it.each<[Partial<Notification>, string]>([
    [{ type: "suggestion_auto_submitted" }, "/projects/project-1/suggestions/review"],
    [{ type: "suggestion_approved" }, "/projects/project-1/suggestions"],
    [{ type: "suggestion_rejected" }, "/projects/project-1/suggestions"],
    [{ type: "suggestion_changes_requested" }, "/projects/project-1/suggestions"],
    [{ type: "pr_merged" }, "/projects/project-1/pull-requests"],
    [{ type: "pr_review", target_id: "42" }, "/projects/project-1/pull-requests/42"],
    [{ type: "remote_update_applied" }, "/projects/project-1/settings#remote-sync"],
    [{ type: "remote_update_available" }, "/projects/project-1/settings#remote-sync"],
    [{ type: "remote_update_available", target_id: "43" }, "/projects/project-1/pull-requests/43"],
    [{ type: "remote_sync_error" }, "/projects/project-1/settings#remote-sync"],
    [{ project_id: null, target_url: "//outside.invalid" }, "/"],
    [{ type: "pr_party_ready", project_id: null }, "/pr-party"],
  ])("routes server notification %j to %s without a read mutation", async (overrides, target) => {
    fetchMock.mockResolvedValue(listing(item(overrides)));
    render(<NotificationBell />);
    await open();
    fireEvent.click(screen.getByText("Review update"));
    expect(boundary.push).toHaveBeenCalledWith(target);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/v1/notifications");
    expect(new Headers(options?.headers).get("Authorization")).toBe("Bearer notification-token");
  });

  it("does not mark notifications read after credentials disappear and retries after reauthentication", async () => {
    fetchMock.mockResolvedValueOnce(listing(item({ is_read: false })))
      .mockResolvedValueOnce(listing(item({ is_read: false })))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const view = render(<NotificationBell />);
    await open();
    boundary.token = "";
    view.rerender(<NotificationBell />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Mark all as read" })));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText("1")).toBeDefined();
    boundary.token = "renewed-notification-token";
    view.rerender(<NotificationBell />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Mark all as read" })));
    await waitFor(() => expect(screen.queryByText("1")).toBeNull());
    expect(new Headers(fetchMock.mock.calls[2][1]?.headers).get("Authorization")).toBe("Bearer renewed-notification-token");
    expect(String(fetchMock.mock.calls[2][0])).toContain("/notifications/read-all");
  });

  it("waits for mark-read before navigating and updates the unread badge", async () => {
    let finish!: (result: Response) => void;
    fetchMock.mockResolvedValueOnce(listing(item({ is_read: false, target_url: "/pr-party?card=7" })))
      .mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    render(<NotificationBell />);
    await open();
    fireEvent.click(screen.getByText("Review update"));
    expect(boundary.push).not.toHaveBeenCalled();
    expect(screen.queryByText("Review update")).toBeNull();
    expect(fetchMock.mock.calls[1][1]?.method).toBe("POST");
    expect(String(fetchMock.mock.calls[1][0])).toContain("/notice-1/read");
    await act(async () => finish(new Response(null, { status: 204 })));
    await waitFor(() => expect(boundary.push).toHaveBeenCalledWith("/pr-party?card=7"));
    expect(screen.queryByText("1")).toBeNull();
    await open();
    expect(screen.queryByRole("button", { name: "Mark all as read" })).toBeNull();
  });

  it("still navigates on a mark-read failure and retains the unread item for retry", async () => {
    fetchMock.mockResolvedValueOnce(listing(item({ is_read: false })))
      .mockResolvedValueOnce(response({ detail: "Offline" }, 503))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    render(<NotificationBell />);
    await open();
    fireEvent.click(screen.getByText("Review update"));
    await waitFor(() => expect(boundary.push).toHaveBeenCalledOnce());
    expect(screen.getByText("1")).toBeDefined();
    await open();
    fireEvent.click(screen.getByRole("button", { name: "Mark all as read" }));
    await waitFor(() => expect(screen.queryByText("1")).toBeNull());
    expect(String(fetchMock.mock.calls[2][0])).toContain("/notifications/read-all");
  });

  it("retains unread state after mark-all fails, then retries successfully", async () => {
    fetchMock.mockResolvedValueOnce(listing(item({ is_read: false })))
      .mockResolvedValueOnce(response({ detail: "Unavailable" }, 503))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    render(<NotificationBell />);
    await open();
    await act(async () => fireEvent.click(screen.getByText("Mark all as read")));
    expect(screen.getByText("1")).toBeDefined();
    fireEvent.click(screen.getByText("Mark all as read"));
    await waitFor(() => expect(screen.queryByText("Mark all as read")).toBeNull());
    expect(boundary.push).not.toHaveBeenCalled();
  });

  it("recovers a failed initial list through the public refresh event", async () => {
    fetchMock.mockResolvedValueOnce(response({ detail: "Unavailable" }, 403))
      .mockResolvedValueOnce(listing(item()));
    render(<NotificationBell />);
    fireEvent.click(screen.getByRole("button", { name: "Notifications" }));
    await act(async () => {});
    expect(screen.getByText("No notifications")).toBeDefined();
    await act(async () => window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT)));
    expect(await screen.findByText("Review update")).toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
