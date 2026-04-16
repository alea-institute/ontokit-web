/**
 * WebSocket client for real-time ontology index status updates.
 *
 * Mirrors the pattern in lib/api/lint.ts for lint WebSocket updates.
 */

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
  token?: string
): WebSocket {
  const wsUrl =
    process.env.NEXT_PUBLIC_WS_URL ||
    process.env.NEXT_PUBLIC_API_URL?.replace(/^http/, "ws") ||
    "ws://localhost:8000";

  const params = token ? `?token=${encodeURIComponent(token)}` : "";
  const ws = new WebSocket(
    `${wsUrl}/api/v1/projects/${projectId}/ontology/index-ws${params}`
  );

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data) as IndexWebSocketMessage;
      onMessage(data);
    } catch (e) {
      console.error("Failed to parse index WebSocket message:", e);
    }
  };

  ws.onerror = (error) => {
    console.error("Index WebSocket error:", error);
    onError?.(error);
  };

  ws.onclose = (event) => {
    onClose?.(event);
  };

  return ws;
}

/**
 * Hook-friendly WebSocket manager with auto-reconnect.
 */
export class IndexWebSocketManager {
  private ws: WebSocket | null = null;
  private projectId: string;
  private onMessage: (message: IndexWebSocketMessage) => void;
  private token?: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private isClosing = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    projectId: string,
    onMessage: (message: IndexWebSocketMessage) => void,
    token?: string
  ) {
    this.projectId = projectId;
    this.onMessage = onMessage;
    this.token = token;
  }

  connect(): void {
    if (
      this.ws?.readyState === WebSocket.OPEN ||
      this.ws?.readyState === WebSocket.CONNECTING
    ) {
      return;
    }

    this.isClosing = false;
    this.ws = createIndexWebSocket(
      this.projectId,
      this.onMessage,
      () => this.handleReconnect(),
      (event) => {
        if (!this.isClosing && event.code !== 1000) {
          this.handleReconnect();
        }
      },
      this.token
    );

    // Reset retry budget on successful open
    this.ws.addEventListener("open", () => {
      this.reconnectAttempts = 0;
    });
  }

  disconnect(): void {
    this.isClosing = true;
    this.reconnectAttempts = 0;
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close(1000, "Client closing connection");
      this.ws = null;
    }
  }

  private handleReconnect(): void {
    if (this.isClosing || this.reconnectTimer !== null) return;

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay =
        this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null;
        this.connect();
      }, delay);
    }
  }
}
