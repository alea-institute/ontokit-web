"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Lightbulb,
  Check,
  XCircle,
  MessageSquareWarning,
  UserPlus,
  GitPullRequest,
  GitMerge,
  AlertCircle,
  RefreshCw,
  Download,
} from "lucide-react";
import { useNotifications, NOTIFICATIONS_CHANGED_EVENT } from "@/lib/hooks/useNotifications";
import type { NotificationType } from "@/lib/api/notifications";
import { cn } from "@/lib/utils";

// Re-export for consumers that import from this file
export { NOTIFICATIONS_CHANGED_EVENT };

const iconByType: Record<NotificationType, React.ComponentType<{ className?: string }>> = {
  suggestion_submitted: Lightbulb,
  suggestion_approved: Check,
  suggestion_rejected: XCircle,
  suggestion_changes_requested: MessageSquareWarning,
  suggestion_auto_submitted: AlertCircle,
  join_request: UserPlus,
  pr_opened: GitPullRequest,
  pr_merged: GitMerge,
  pr_review: MessageSquareWarning,
  remote_update_applied: RefreshCw,
  remote_update_available: Download,
  remote_sync_error: AlertCircle,
};

const colorByType: Record<NotificationType, string> = {
  suggestion_submitted: "text-amber-500",
  suggestion_approved: "text-green-500",
  suggestion_rejected: "text-red-500",
  suggestion_changes_requested: "text-orange-500",
  suggestion_auto_submitted: "text-orange-500",
  join_request: "text-blue-500",
  pr_opened: "text-indigo-500",
  pr_merged: "text-purple-500",
  pr_review: "text-amber-500",
  remote_update_applied: "text-blue-500",
  remote_update_available: "text-indigo-500",
  remote_sync_error: "text-red-500",
};

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHrs < 24) return `${diffHrs}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function getTargetUrl(notification: { type: NotificationType; project_id: string; target_id?: string; target_url?: string }): string {
  if (notification.target_url) return notification.target_url;

  const base = `/projects/${notification.project_id}`;

  switch (notification.type) {
    case "suggestion_submitted":
    case "suggestion_auto_submitted":
      return `${base}/suggestions/review`;
    case "suggestion_approved":
    case "suggestion_rejected":
    case "suggestion_changes_requested":
      return `${base}/suggestions`;
    case "join_request":
      return `${base}/settings#join-requests`;
    case "pr_opened":
    case "pr_merged":
    case "pr_review":
      return notification.target_id
        ? `${base}/pull-requests/${notification.target_id}`
        : `${base}/pull-requests`;
    case "remote_update_applied":
      return `${base}/settings#remote-sync`;
    case "remote_update_available":
      return notification.target_id
        ? `${base}/pull-requests/${notification.target_id}`
        : `${base}/settings#remote-sync`;
    case "remote_sync_error":
      return `${base}/settings#remote-sync`;
    default:
      return base;
  }
}

export function NotificationBell() {
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
  } = useNotifications();

  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleNotificationClick = async (id: string, url: string, isRead: boolean) => {
    setIsOpen(false);
    if (!isRead) {
      await markAsRead(id);
    }
    router.push(url);
  };

  // Show nothing if no notifications hook data is available
  // (the hook already checks auth status)
  const totalCount = notifications.length;

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative rounded-full p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 rounded-md bg-white dark:bg-slate-800 shadow-lg ring-1 ring-black ring-opacity-5 z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
            <p className="text-sm font-medium text-slate-900 dark:text-white">
              Notifications
            </p>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllAsRead()}
                className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
              >
                Mark all as read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {totalCount === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                No notifications
              </p>
            ) : (
              notifications.map((n) => {
                const Icon = iconByType[n.type] || Bell;
                const iconColor = colorByType[n.type] || "text-slate-400";
                const url = getTargetUrl(n);

                return (
                  <button
                    key={n.id}
                    onClick={() => handleNotificationClick(n.id, url, n.is_read)}
                    className={cn(
                      "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50",
                      !n.is_read && "bg-primary-50/50 dark:bg-primary-900/10",
                    )}
                  >
                    <Icon className={cn("mt-0.5 h-4 w-4 flex-shrink-0", iconColor)} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className={cn(
                          "text-sm truncate",
                          n.is_read
                            ? "text-slate-700 dark:text-slate-300"
                            : "font-medium text-slate-900 dark:text-white",
                        )}>
                          {n.title}
                        </p>
                        {!n.is_read && (
                          <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-primary-500" />
                        )}
                      </div>
                      {n.body && (
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                          {n.body}
                        </p>
                      )}
                      <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                        {n.project_name} · {formatTimeAgo(n.created_at)}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
