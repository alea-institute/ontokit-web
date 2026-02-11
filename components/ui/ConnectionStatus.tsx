"use client";

import { Loader2 } from "lucide-react";
import { WebSocketIcon } from "@/components/ui/icons/WebSocketIcon";
import { cn } from "@/lib/utils";

export type ConnectionState = "connecting" | "connected" | "disconnected";

interface ConnectionStatusProps {
  state: ConnectionState;
  className?: string;
  showLabel?: boolean;
  /** Description of what the WebSocket is used for */
  purpose?: string;
  /** The endpoint path being connected to */
  endpoint?: string;
}

const stateConfig = {
  connecting: {
    icon: Loader2,
    color: "text-amber-500",
    bgColor: "bg-amber-100 dark:bg-amber-900/30",
    label: "Connecting",
    animate: true,
  },
  connected: {
    icon: WebSocketIcon,
    color: "text-green-500",
    bgColor: "bg-green-100 dark:bg-green-900/30",
    label: "Connected",
    animate: false,
  },
  disconnected: {
    icon: WebSocketIcon,
    color: "text-red-500",
    bgColor: "bg-red-100 dark:bg-red-900/30",
    label: "Disconnected",
    animate: false,
  },
};

export function ConnectionStatus({
  state,
  className,
  showLabel = false,
  purpose,
  endpoint,
}: ConnectionStatusProps) {
  const config = stateConfig[state];
  const Icon = config.icon;

  // Build informative tooltip
  const buildTitle = () => {
    const parts: string[] = [config.label];
    if (purpose) {
      parts.push(`Purpose: ${purpose}`);
    }
    if (endpoint) {
      parts.push(`Endpoint: ${endpoint}`);
    }
    return parts.join("\n");
  };

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-full px-2 py-1",
        config.bgColor,
        className
      )}
      title={buildTitle()}
    >
      <Icon
        className={cn(
          "h-3.5 w-3.5",
          config.color,
          config.animate && "animate-spin"
        )}
      />
      {showLabel && (
        <span className={cn("text-xs font-medium", config.color)}>
          {config.label}
        </span>
      )}
    </div>
  );
}

export default ConnectionStatus;
