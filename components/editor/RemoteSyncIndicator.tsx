"use client";

import Link from "next/link";
import { RefreshCw, Download, AlertCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { remoteSyncApi } from "@/lib/api/remoteSync";

interface RemoteSyncIndicatorProps {
  projectId: string;
  accessToken?: string;
}

export function RemoteSyncIndicator({
  projectId,
  accessToken,
}: RemoteSyncIndicatorProps) {
  const { data: config } = useQuery({
    queryKey: ["remoteSync", "config", projectId, accessToken],
    queryFn: () => remoteSyncApi.getConfig(projectId, accessToken),
    enabled: !!projectId && !!accessToken,
    retry: false,
  });

  // Don't render if no config or disabled
  if (!config || !config.enabled) return null;

  const status = config.status;

  if (status === "up_to_date" || status === "idle") {
    return (
      <Link href={`/projects/${projectId}/settings#remote-sync`}>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-green-600 dark:text-green-400"
          aria-label="In sync with remote"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span className="hidden sm:inline text-xs">Synced</span>
        </Button>
      </Link>
    );
  }

  if (status === "checking") {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5 text-blue-600 dark:text-blue-400 cursor-default"
        aria-label="Checking for updates from remote"
        disabled
      >
        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
        <span className="hidden sm:inline text-xs">Checking</span>
      </Button>
    );
  }

  if (status === "update_available") {
    const target = config.pending_pr_id
      ? `/projects/${projectId}/pull-requests/${config.pending_pr_id}`
      : `/projects/${projectId}/settings#remote-sync`;

    return (
      <Link href={target}>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-indigo-600 dark:text-indigo-400"
          aria-label="Update available from remote"
        >
          <Download className="h-3.5 w-3.5" />
          <span className="hidden sm:inline text-xs">Update</span>
          <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
        </Button>
      </Link>
    );
  }

  if (status === "error") {
    return (
      <Link href={`/projects/${projectId}/settings#remote-sync`}>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-red-600 dark:text-red-400"
          aria-label="Sync from remote error"
        >
          <AlertCircle className="h-3.5 w-3.5" />
          <span className="hidden sm:inline text-xs">Sync Error</span>
        </Button>
      </Link>
    );
  }

  return null;
}
