/** Owns one notification connection and its bounded retry lifecycle. */
export class NotificationSocketManager<T> {
  private ws: WebSocket | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private attempts = 0;
  private closing = false;

  constructor(
    private readonly create: (
      onMessage: (message: T) => void,
      onError: (event: Event) => void,
      onClose: (event: CloseEvent) => void,
      onOpen: () => void,
    ) => WebSocket,
    private readonly onMessage: (message: T) => void,
    private readonly onOpen?: () => void,
    private readonly onError?: (event: Event) => void,
    private readonly onClose?: (event: CloseEvent) => void,
  ) {}

  connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;
    this.closing = false;
    this.cancelTimer();
    let socket: WebSocket;
    const current = () => !this.closing && this.ws === socket;
    try {
      socket = this.create(
        message => { if (current()) this.onMessage(message); },
        event => { if (current()) { this.onError?.(event); this.retry(); } },
        event => {
          if (!current()) return;
          this.ws = null;
          this.onClose?.(event);
          // 1008 is a policy/auth refusal. A new token requires a new manager.
          if (event.code === 1008 || event.code === 1000) this.cancelTimer();
          else this.retry();
        },
        () => {
          if (!current()) return;
          this.attempts = 0;
          this.cancelTimer();
          // HTTP reconciliation on every open recovers missed notifications.
          this.onOpen?.();
        },
      );
      this.ws = socket;
    } catch {
      // Construction failures can include the token-bearing URL. Never log them.
      this.ws = null;
      this.retry();
    }
  }

  disconnect(): void {
    this.closing = true;
    this.attempts = 0;
    this.cancelTimer();
    const socket = this.ws;
    this.ws = null;
    socket?.close(1000, 'Client closing connection');
  }

  private cancelTimer(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }

  private retry(): void {
    if (this.closing || this.timer !== null || this.attempts >= 5) return;
    const delay = 1000 * 2 ** this.attempts++;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.connect();
    }, delay);
  }
}
