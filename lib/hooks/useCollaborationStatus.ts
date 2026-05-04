"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { ConnectionState } from "@/components/ui/ConnectionStatus";

interface UseCollaborationStatusOptions {
  projectId: string;
  enabled?: boolean;
  token?: string;
}

/**
 * Hook to track WebSocket connection status for the lint endpoint.
 * Maintains a persistent connection and reports status changes.
 */
export function useCollaborationStatus({
  projectId,
  enabled = true,
  token,
}: UseCollaborationStatusOptions) {
  const [status, setStatus] = useState<ConnectionState>("disconnected");
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const isClosingRef = useRef(false);
  const connectRef = useRef<() => void>(() => {});

  const getWsUrl = useCallback(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const wsUrl = apiUrl.replace(/^http/, "ws");
    const params = token ? `?token=${encodeURIComponent(token)}` : "";
    return `${wsUrl}/api/v1/projects/${projectId}/lint/ws${params}`;
  }, [projectId, token]);

  const connect = useCallback(() => {
    if (!enabled || !projectId || isClosingRef.current) return;

    // Clean up existing connection
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setStatus("connecting");

    try {
      const ws = new WebSocket(getWsUrl());
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectAttemptsRef.current = 0;
        setStatus("connected");
      };

      ws.onclose = () => {
        if (isClosingRef.current) {
          setStatus("disconnected");
          return;
        }

        setStatus("disconnected");

        // Attempt reconnection with exponential backoff
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          reconnectAttemptsRef.current++;

          reconnectTimeoutRef.current = setTimeout(() => {
            setStatus("connecting");
            connectRef.current();
          }, delay);
        }
      };

      ws.onerror = () => {
        // Error will trigger onclose, so we don't need to do much here
      };

      // Handle messages from the lint WebSocket
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          // Lint WebSocket sends messages about lint run status
          // We don't need to do anything special with them here,
          // but we could emit events if needed in the future
          console.log("[WebSocket] Lint update:", data.type);
        } catch {
          // Ignore parse errors
        }
      };
    } catch {
      setStatus("disconnected");
    }
  }, [enabled, projectId, getWsUrl]);

  // Keep the ref in sync so the onclose callback always calls the latest version
  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  const disconnect = useCallback(() => {
    isClosingRef.current = true;

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setStatus("disconnected");
  }, []);

  // Connect when enabled and we have a project ID
  useEffect(() => {
    if (enabled && projectId) {
      isClosingRef.current = false;
      // Small delay to avoid double-connect in React Strict Mode
      const timeout = setTimeout(connect, 100);
      return () => {
        clearTimeout(timeout);
        disconnect();
      };
    } else {
      disconnect();
    }
  }, [enabled, projectId, connect, disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isClosingRef.current = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Get the endpoint path for display (without the host)
  const endpointPath = `/api/v1/projects/${projectId}/lint/ws`;

  return {
    status,
    isConnected: status === "connected",
    reconnect: connect,
    /** The WebSocket endpoint path */
    endpoint: endpointPath,
    /** Description of what this WebSocket connection is used for */
    purpose: "Real-time lint status updates",
  };
}
