/**
 * Notifications API client
 *
 * Unified notification system for suggestion reviews, join requests,
 * PR events, and other project-level activities.
 */

import { api } from "./client";

// --- Types ---

export type NotificationType =
  | "suggestion_submitted"
  | "suggestion_approved"
  | "suggestion_rejected"
  | "suggestion_changes_requested"
  | "suggestion_auto_submitted"
  | "join_request"
  | "pr_opened"
  | "pr_merged"
  | "pr_review";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body?: string;
  project_id: string;
  project_name: string;
  target_id?: string;
  target_url?: string;
  is_read: boolean;
  created_at: string;
}

export interface NotificationListResponse {
  items: Notification[];
  total: number;
  unread_count: number;
}

// --- API ---

export const notificationsApi = {
  /**
   * List notifications for the current user.
   * Optionally filter to unread only.
   */
  list: (token: string, unreadOnly?: boolean) =>
    api.get<NotificationListResponse>("/api/v1/notifications", {
      headers: { Authorization: `Bearer ${token}` },
      params: { unread_only: unreadOnly },
    }),

  /**
   * Mark a single notification as read.
   */
  markAsRead: (id: string, token: string) =>
    api.post<void>(`/api/v1/notifications/${id}/read`, undefined, {
      headers: { Authorization: `Bearer ${token}` },
    }),

  /**
   * Mark all notifications as read.
   */
  markAllAsRead: (token: string) =>
    api.post<void>("/api/v1/notifications/read-all", undefined, {
      headers: { Authorization: `Bearer ${token}` },
    }),
};
