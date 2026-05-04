import { describe, expect, it, beforeEach } from "vitest";
import {
  mockFetch,
  mockOk,
  mockEmpty,
  resetFetch,
} from "@/__tests__/helpers/mockFetch";
import { notificationsApi } from "@/lib/api/notifications";

describe("notificationsApi", () => {
  beforeEach(() => {
    resetFetch();
  });

  describe("list", () => {
    it("fetches notifications", async () => {
      const data = { items: [], total: 0, unread_count: 0 };
      mockOk(data);

      const result = await notificationsApi.list("tok");
      expect(result).toEqual(data);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/notifications");
      expect(options.method).toBe("GET");
      const headers = new Headers(options.headers);
      expect(headers.get("Authorization")).toBe("Bearer tok");
    });

    it("filters to unread only", async () => {
      mockOk({ items: [], total: 0, unread_count: 0 });

      await notificationsApi.list("tok", true);

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("unread_only=true");
    });

    it("does not include unread_only when undefined", async () => {
      mockOk({ items: [], total: 0, unread_count: 0 });

      await notificationsApi.list("tok");

      const [url] = mockFetch.mock.calls[0];
      expect(url).not.toContain("unread_only");
    });
  });

  describe("markAsRead", () => {
    it("marks a single notification as read", async () => {
      mockEmpty();

      await notificationsApi.markAsRead("notif-1", "tok");

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/notifications/notif-1/read");
      expect(options.method).toBe("POST");
    });
  });

  describe("markAllAsRead", () => {
    it("marks all notifications as read", async () => {
      mockEmpty();

      await notificationsApi.markAllAsRead("tok");

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/notifications/read-all");
      expect(options.method).toBe("POST");
    });
  });
});
