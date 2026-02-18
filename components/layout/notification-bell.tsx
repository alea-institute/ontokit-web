"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Bell } from "lucide-react";
import {
  joinRequestApi,
  type PendingJoinRequestsSummary,
} from "@/lib/api/joinRequests";

export function NotificationBell() {
  const { data: session, status } = useSession();
  const [summary, setSummary] = useState<PendingJoinRequestsSummary | null>(
    null
  );
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (status !== "authenticated" || !session?.accessToken) return;

    joinRequestApi
      .getPendingSummary(session.accessToken)
      .then(setSummary)
      .catch(() => {
        // Ignore errors — user may not manage any projects
      });
  }, [session?.accessToken, status]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (status !== "authenticated") return null;

  const totalPending = summary?.total_pending ?? 0;

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative rounded-full p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {totalPending > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white">
            {totalPending > 99 ? "99+" : totalPending}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 rounded-md bg-white dark:bg-slate-800 shadow-lg ring-1 ring-black ring-opacity-5 z-50">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
            <p className="text-sm font-medium text-slate-900 dark:text-white">
              Notifications
            </p>
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {totalPending === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                No notifications
              </p>
            ) : (
              summary?.by_project.map((project) => (
                <Link
                  key={project.project_id}
                  href={`/projects/${project.project_id}/settings#join-requests`}
                  onClick={() => setIsOpen(false)}
                  className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                      {project.project_name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {project.pending_count} pending join{" "}
                      {project.pending_count === 1 ? "request" : "requests"}
                    </p>
                  </div>
                  <span className="ml-2 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-amber-100 px-1.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                    {project.pending_count}
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
