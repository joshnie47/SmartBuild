import { getToken } from './auth';

const WS_URL = 'ws://localhost:5000';

// ─── Event Types (mirroring the server's events.ts) ──────────────────────────

export interface MessageCreatedEvent {
  type: 'message.created';
  message: {
    _id: string;
    conversationId: string;
    senderId: string;
    clientMessageId: string;
    body: string;
    status: string;
    createdAt: string;
  };
}

export interface MessageReadEvent {
  type: 'message.read';
  conversationId: string;
  userId: string;
  messageId: string;
}

export interface TypingEvent {
  type: 'typing.start' | 'typing.stop';
  conversationId: string;
  userId: string;
}

export interface PresenceEvent {
  type: 'presence.online' | 'presence.offline';
  userId: string;
}

export interface ErrorEvent {
  type: 'error';
  code: string;
  message: string;
}

export type ServerEvent =
  | MessageCreatedEvent
  | MessageReadEvent
  | TypingEvent
  | PresenceEvent
  | ErrorEvent;

// ─── Event Handlers ───────────────────────────────────────────────────────────

type EventHandler = (event: ServerEvent) => void;

// ─── ChatSocket Singleton ─────────────────────────────────────────────────────

class ChatSocketManager {
  private socket: WebSocket | null = null;
  private handlers: Set<EventHandler> = new Set();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldReconnect = false;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 30_000;

  /** Open the WebSocket connection. Safe to call multiple times (idempotent). */
  connect(): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) return;
    if (this.socket && this.socket.readyState === WebSocket.CONNECTING) return;

    const token = getToken();
    if (!token) {
      console.warn('[ChatSocket] No JWT found — skipping connection.');
      return;
    }

    this.shouldReconnect = true;
    const url = `${WS_URL}?token=${encodeURIComponent(token)}`;
    this.socket = new WebSocket(url);

    this.socket.onopen = () => {
      console.log('[ChatSocket] Connected.');
      this.reconnectDelay = 1000; // Reset backoff on successful connection
    };

    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as ServerEvent;
        this.handlers.forEach((h) => h(data));
      } catch {
        console.error('[ChatSocket] Failed to parse message:', event.data);
      }
    };

    this.socket.onclose = (event) => {
      console.log('[ChatSocket] Disconnected. Code:', event.code, event.reason);
      this.socket = null;

      if (this.shouldReconnect && event.code !== 4001) {
        // 4001 = unauthorized — don't retry
        this.scheduleReconnect();
      }
    };

    this.socket.onerror = (err) => {
      console.error('[ChatSocket] Error:', err);
    };
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;

    console.log(`[ChatSocket] Reconnecting in ${this.reconnectDelay}ms...`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
      // Exponential backoff: double the delay, cap at 30s
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
    }, this.reconnectDelay);
  }

  /** Disconnect and stop reconnecting. Call on logout. */
  disconnect(): void {
    this.shouldReconnect = false;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  /** Register a handler to receive all server events. Returns a cleanup function. */
  onEvent(handler: EventHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  /** Returns true if the socket is currently open. */
  isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  // ─── Client → Server Event Senders ─────────────────────────────────────────

  private send(event: object): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.warn('[ChatSocket] Cannot send — socket not open.');
      return;
    }
    this.socket.send(JSON.stringify(event));
  }

  sendMessage(conversationId: string, body: string, clientMessageId: string): void {
    this.send({ type: 'message.send', conversationId, body, clientMessageId });
  }

  sendReadReceipt(conversationId: string, messageId: string): void {
    this.send({ type: 'message.read', conversationId, messageId });
  }

  sendTypingStart(conversationId: string): void {
    this.send({ type: 'typing.start', conversationId });
  }

  sendTypingStop(conversationId: string): void {
    this.send({ type: 'typing.stop', conversationId });
  }
}

// Export a singleton — one connection for the whole app
export const chatSocket = new ChatSocketManager();
