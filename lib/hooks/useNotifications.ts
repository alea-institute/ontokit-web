"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import {
  notificationsApi,
  type Notification,
} from "@/lib/api/notifications";
/** Event name dispatched to trigger an immediate notification refetch. */
export const NOTIFICATIONS_CHANGED_EVENT = "notifications:changed";

const POLL_INTERVAL = 30_000; // 30 seconds

export interface UseNotificationsReturn {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refetch: () => void;
}

export function useNotifications(): UseNotificationsReturn {
  const { data: session, status } = useSession();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const stopPollingRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scopeRef = useRef(0);
  const requestRef = useRef(0);

  useEffect(() => {
    const scope = ++scopeRef.current;
    stopPollingRef.current = false;
    setNotifications([]);
    setUnreadCount(0);
    setIsLoading(false);
    return () => { scopeRef.current = scope + 1; };
  }, [session?.accessToken, status]);

  const fetchNotifications = useCallback(async () => {
    if (status !== "authenticated" || !session?.accessToken || stopPollingRef.current) return;
    const scope = scopeRef.current;
    const request = ++requestRef.current;
    const isCurrent = () => scope === scopeRef.current && request === requestRef.current;

    try {
      setIsLoading(true);
      const response = await notificationsApi.list(session.accessToken);
      if (!isCurrent()) return;
      setNotifications(response.items);
      setUnreadCount(response.unread_count);
    } catch (err) {
      if (!isCurrent()) return;
      // Stop polling on 401 (expired session)
      if (err && typeof err === "object" && "status" in err && (err as { status: number }).status === 401) {
        stopPollingRef.current = true;
      }
    } finally {
      if (isCurrent()) setIsLoading(false);
    }
  }, [session?.accessToken, status]);

  // Initial fetch + polling
  useEffect(() => {
    fetchNotifications();

    intervalRef.current = setInterval(fetchNotifications, POLL_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchNotifications]);

  // Listen for immediate refetch events
  useEffect(() => {
    const handler = () => fetchNotifications();
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, handler);
    return () => window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, handler);
  }, [fetchNotifications]);

  const markAsRead = useCallback(async (id: string) => {
    if (!session?.accessToken) return;
    const scope = scopeRef.current;
    try {
      await notificationsApi.markAsRead(id, session.accessToken);
      if (scope !== scopeRef.current) return;
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // Silently fail — not critical
    }
  }, [session?.accessToken]);

  const markAllAsRead = useCallback(async () => {
    if (!session?.accessToken) return;
    const scope = scopeRef.current;
    try {
      await notificationsApi.markAllAsRead(session.accessToken);
      if (scope !== scopeRef.current) return;
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {
      // Silently fail
    }
  }, [session?.accessToken]);

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    refetch: fetchNotifications,
  };
}
