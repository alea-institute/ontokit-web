/**
 * WebSocket client for real-time ontology index status updates.
 *
 * Mirrors the pattern in lib/api/lint.ts for lint WebSocket updates.
 */

import { NotificationSocketManager } from "./notificationSocket";
import { getWebSocketUrl } from "./websocketUrl";

export interface IndexWebSocketMessage {
  type: "index_started" | "index_complete" | "index_failed";
  project_id: string;
  branch?: string;
  entity_count?: number;
  error?: string;
}

/**
 * Create a WebSocket connection for ontology index updates.
 */
export function createIndexWebSocket(
  projectId: string,
  onMessage: (message: IndexWebSocketMessage) => void,
  onError?: (error: Event) => void,
  onClose?: (event: CloseEvent) => void,
  token?: string,
  onOpen?: () => void
): WebSocket {
  const wsUrl = getWebSocketUrl();

  const params = token ? `?token=${encodeURIComponent(token)}` : "";
  const ws = new WebSocket(
    `${wsUrl}/api/v1/projects/${projectId}/ontology/index-ws${params}`
  );

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data) as IndexWebSocketMessage;
      onMessage(data);
    } catch {
      console.error("Failed to parse index WebSocket message");
    }
  };

  ws.onerror = (error) => {
    console.error("Index WebSocket error");
    onError?.(error);
  };

  ws.onopen = () => onOpen?.();

  ws.onclose = (event) => {
    onClose?.(event);
  };

  return ws;
}

/**
 * Hook-friendly WebSocket manager with auto-reconnect.
 */
export class IndexWebSocketManager extends NotificationSocketManager<IndexWebSocketMessage> {
  constructor(
    projectId: string,
    onMessage: (message: IndexWebSocketMessage) => void,
    token?: string,
    onOpen?: () => void,
  ) {
    super(
      (message, error, close, open) => createIndexWebSocket(projectId, message, error, close, token, open),
      onMessage,
      onOpen,
    );
  }
}
