/**
 * WebSocket collaboration client for real-time editing
 */

export type MessageType =
  | "authenticate"
  | "authenticated"
  | "error"
  | "join"
  | "leave"
  | "user_list"
  | "presence_update"
  | "cursor_move"
  | "operation"
  | "operation_ack"
  | "operation_reject"
  | "sync_request"
  | "sync_response";

export interface CollabMessage {
  type: MessageType;
  payload: Record<string, unknown>;
  room?: string;
  seq?: number;
}

export interface User {
  user_id: string;
  display_name: string;
  client_type: string;
  client_version: string;
  cursor_path?: string;
  color?: string;
}

export interface Operation {
  id: string;
  type: string;
  path: string;
  value?: unknown;
  previous_value?: unknown;
  timestamp: string;
  user_id: string;
  version: number;
}

export interface CollaborationClientOptions {
  url: string;
  token: string;
  userId: string;
  displayName: string;
  onUsersChanged?: (users: User[]) => void;
  onOperationReceived?: (operation: Operation) => void;
  onCursorMoved?: (userId: string, path: string) => void;
  onConnectionChange?: (connected: boolean) => void;
  onError?: (error: string) => void;
}

export class CollaborationClient {
  private ws: WebSocket | null = null;
  private options: CollaborationClientOptions;
  private seq = 0;
  private pendingOps: Map<string, Operation> = new Map();
  private serverVersion = 0;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private currentRoom: string | null = null;

  constructor(options: CollaborationClientOptions) {
    this.options = options;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(`${this.options.url}?token=${this.options.token}`);

        this.ws.onopen = () => {
          this.reconnectAttempts = 0;
          this.options.onConnectionChange?.(true);
          resolve();
        };

        this.ws.onclose = () => {
          this.options.onConnectionChange?.(false);
          this.attemptReconnect();
        };

        this.ws.onerror = (_event) => {
          this.options.onError?.("WebSocket error");
          reject(new Error("WebSocket connection failed"));
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(JSON.parse(event.data));
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.options.onError?.("Max reconnection attempts reached");
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    setTimeout(() => {
      this.connect().then(() => {
        if (this.currentRoom) {
          this.joinRoom(this.currentRoom);
        }
      });
    }, delay);
  }

  private handleMessage(msg: CollabMessage): void {
    switch (msg.type) {
      case "authenticated":
        // Successfully authenticated
        break;

      case "user_list":
        this.options.onUsersChanged?.(msg.payload.users as User[]);
        break;

      case "operation":
        const op = msg.payload as unknown as Operation;
        this.serverVersion = op.version;
        this.options.onOperationReceived?.(op);
        break;

      case "operation_ack":
        this.pendingOps.delete(msg.payload.operation_id as string);
        this.serverVersion = msg.payload.version as number;
        break;

      case "operation_reject":
        const rejectedId = msg.payload.operation_id as string;
        this.pendingOps.delete(rejectedId);
        this.options.onError?.(`Operation rejected: ${msg.payload.reason}`);
        break;

      case "cursor_move":
        this.options.onCursorMoved?.(
          msg.payload.user_id as string,
          msg.payload.path as string
        );
        break;

      case "sync_response":
        const ops = msg.payload.operations as Operation[];
        this.serverVersion = msg.payload.current_version as number;
        ops.forEach((op) => this.options.onOperationReceived?.(op));
        break;

      case "error":
        this.options.onError?.(msg.payload.message as string);
        break;
    }
  }

  private send(msg: CollabMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  joinRoom(room: string): void {
    this.currentRoom = room;
    this.send({
      type: "join",
      room,
      payload: {
        user_id: this.options.userId,
        display_name: this.options.displayName,
        client_type: "web",
        client_version: "1.0.0",
      },
    });
  }

  leaveRoom(room: string): void {
    this.send({
      type: "leave",
      room,
      payload: { user_id: this.options.userId },
    });
    this.currentRoom = null;
  }

  sendOperation(room: string, operation: Omit<Operation, "version">): void {
    const op: Operation = {
      ...operation,
      version: this.serverVersion,
    };

    this.pendingOps.set(op.id, op);

    this.send({
      type: "operation",
      room,
      seq: ++this.seq,
      payload: op as unknown as Record<string, unknown>,
    });
  }

  updateCursor(room: string, path: string): void {
    this.send({
      type: "cursor_move",
      room,
      payload: {
        user_id: this.options.userId,
        path,
      },
    });
  }

  requestSync(room: string): void {
    this.send({
      type: "sync_request",
      room,
      payload: {
        last_version: this.serverVersion,
      },
    });
  }

  disconnect(): void {
    if (this.currentRoom) {
      this.leaveRoom(this.currentRoom);
    }
    this.ws?.close();
    this.ws = null;
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}
