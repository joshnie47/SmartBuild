// ─── Client → Server ────────────────────────────────────────────────────────

export interface MessageSendEvent {
  type: 'message.send';
  conversationId: string;
  body: string;
  clientMessageId: string;  // UUID v4 from browser — idempotency key
}

export interface MessageReadEvent {
  type: 'message.read';
  conversationId: string;
  messageId: string;
}

export interface TypingStartEvent {
  type: 'typing.start';
  conversationId: string;
}

export interface TypingStopEvent {
  type: 'typing.stop';
  conversationId: string;
}

export type ClientEvent =
  | MessageSendEvent
  | MessageReadEvent
  | TypingStartEvent
  | TypingStopEvent;

// ─── Server → Client ────────────────────────────────────────────────────────

export interface MessageCreatedEvent {
  type: 'message.created';
  message: {
    _id: string;
    conversationId: string;
    senderId: string;
    body: string;
    status: string;
    createdAt: string;
  };
}

export interface MessageReadBroadcastEvent {
  type: 'message.read';
  conversationId: string;
  userId: string;       // Who read the message
  messageId: string;
}

export interface TypingBroadcastEvent {
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
  | MessageReadBroadcastEvent
  | TypingBroadcastEvent
  | PresenceEvent
  | ErrorEvent;
