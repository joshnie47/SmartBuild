import { IncomingMessage } from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { getConversationById, markAsRead } from '../services/chat/conversation.service';
import { createMessage } from '../services/chat/message.service';
import {
  addConnection,
  removeConnection,
  isOnline,
  sendToUser,
} from '../services/chat/presence.service';
import type {
  ClientEvent,
  MessageSendEvent,
  MessageReadEvent,
  TypingStartEvent,
  TypingStopEvent,
} from './events';

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface JwtPayload {
  userId: string;
  role: string;
}

/** Extract and verify JWT from the WebSocket upgrade request. */
function authenticateSocket(req: IncomingMessage): string | null {
  try {
    // Token can come as query param: ws://host?token=<jwt>
    const url = new URL(req.url ?? '', `http://${req.headers.host}`);
    const token = url.searchParams.get('token');

    if (!token) return null;

    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload;
    return decoded.userId;
  } catch {
    return null;
  }
}

/** Send a JSON event to a specific socket. */
function send(socket: WebSocket, event: object): void {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(event));
  }
}

/** Broadcast a presence event to all participants of a conversation. */
async function broadcastToConversationParticipants(
  conversationId: string,
  requestingUserId: string,
  event: object
): Promise<void> {
  const conv = await getConversationById(conversationId, requestingUserId);
  if (!conv) return;

  for (const p of conv.participants) {
    sendToUser(p.userId.toString(), event);
  }
}

// ─── Event Handlers ──────────────────────────────────────────────────────────

async function handleMessageSend(
  socket: WebSocket,
  userId: string,
  event: MessageSendEvent
): Promise<void> {
  const { conversationId, body, clientMessageId } = event;

  // 1. Validate inputs
  if (!mongoose.Types.ObjectId.isValid(conversationId)) {
    send(socket, { type: 'error', code: 'INVALID_CONVERSATION', message: 'Invalid conversation ID.' });
    return;
  }
  if (!body || typeof body !== 'string' || body.trim().length === 0) {
    send(socket, { type: 'error', code: 'INVALID_BODY', message: 'Message body cannot be empty.' });
    return;
  }
  if (body.trim().length > 4000) {
    send(socket, { type: 'error', code: 'BODY_TOO_LONG', message: 'Message cannot exceed 4000 characters.' });
    return;
  }
  if (!clientMessageId || typeof clientMessageId !== 'string') {
    send(socket, { type: 'error', code: 'MISSING_CLIENT_ID', message: 'clientMessageId is required.' });
    return;
  }

  // 2. Authorize: verify userId is a participant in this conversation
  const conv = await getConversationById(conversationId, userId);
  if (!conv) {
    send(socket, { type: 'error', code: 'NOT_PARTICIPANT', message: 'You are not a participant of this conversation.' });
    return;
  }

  // 3. Persist to DB FIRST (source of truth), then broadcast
  const message = await createMessage({
    conversationId,
    senderId: userId,        // Always from JWT — never from client payload
    clientMessageId,
    body,
  });

  // 4. Broadcast message.created to all participants (including sender — for multi-tab support)
  const broadcastEvent = {
    type: 'message.created',
    message: {
      _id: message._id.toString(),
      conversationId,
      senderId: userId,
      clientMessageId,
      body: message.body,
      status: message.status,
      createdAt: message.createdAt.toISOString(),
    },
  };

  for (const p of conv.participants) {
    sendToUser(p.userId.toString(), broadcastEvent);
  }
}

async function handleMessageRead(
  socket: WebSocket,
  userId: string,
  event: MessageReadEvent
): Promise<void> {
  const { conversationId, messageId } = event;

  if (
    !mongoose.Types.ObjectId.isValid(conversationId) ||
    !mongoose.Types.ObjectId.isValid(messageId)
  ) {
    send(socket, { type: 'error', code: 'INVALID_IDS', message: 'Invalid conversation or message ID.' });
    return;
  }

  // Authorize
  const conv = await getConversationById(conversationId, userId);
  if (!conv) {
    send(socket, { type: 'error', code: 'NOT_PARTICIPANT', message: 'Not a participant.' });
    return;
  }

  // Update lastReadMessageId in DB
  await markAsRead(conversationId, userId, messageId);

  // Broadcast read receipt to all participants
  const readEvent = {
    type: 'message.read',
    conversationId,
    userId,
    messageId,
  };

  for (const p of conv.participants) {
    sendToUser(p.userId.toString(), readEvent);
  }
}

async function handleTyping(
  socket: WebSocket,
  userId: string,
  event: TypingStartEvent | TypingStopEvent
): Promise<void> {
  const { conversationId } = event;

  if (!mongoose.Types.ObjectId.isValid(conversationId)) return;

  // Authorize
  const conv = await getConversationById(conversationId, userId);
  if (!conv) return;

  // Forward typing event to the OTHER participant only
  const otherParticipants = conv.participants.filter(
    (p) => p.userId.toString() !== userId
  );

  const typingEvent = {
    type: event.type,   // 'typing.start' or 'typing.stop'
    conversationId,
    userId,
  };

  for (const p of otherParticipants) {
    sendToUser(p.userId.toString(), typingEvent);
  }
}

// ─── Gateway Setup ───────────────────────────────────────────────────────────

export function createChatGateway(wss: WebSocketServer): void {
  wss.on('connection', (socket: WebSocket, req: IncomingMessage) => {
    // 1. Authenticate the connection
    const userId = authenticateSocket(req);
    if (!userId) {
      socket.close(4001, 'Unauthorized: invalid or missing token.');
      return;
    }

    // 2. Register in presence store
    const justCameOnline = addConnection(userId, socket);

    // 3. If user was previously offline, broadcast presence.online to all their conversations
    if (justCameOnline) {
      // We broadcast asynchronously — presence is best-effort
      (async () => {
        const convs = await import('../services/chat/conversation.service')
          .then(m => m.getConversationsForUser(userId))
          .catch(() => []);

        const presenceEvent = { type: 'presence.online', userId };
        const notifiedUsers = new Set<string>();

        for (const conv of convs) {
          // We only have otherParticipantId in enriched result; fetch full conv for broadcasting
          if (conv.otherParticipantId) {
            const otherId = conv.otherParticipantId.toString();
            if (!notifiedUsers.has(otherId)) {
              sendToUser(otherId, presenceEvent);
              notifiedUsers.add(otherId);
            }
          }
        }
      })();
    }

    // 4. Handle incoming messages
    socket.on('message', async (raw) => {
      let event: ClientEvent;

      try {
        event = JSON.parse(raw.toString()) as ClientEvent;
      } catch {
        send(socket, { type: 'error', code: 'INVALID_JSON', message: 'Invalid JSON.' });
        return;
      }

      try {
        switch (event.type) {
          case 'message.send':
            await handleMessageSend(socket, userId, event);
            break;
          case 'message.read':
            await handleMessageRead(socket, userId, event);
            break;
          case 'typing.start':
          case 'typing.stop':
            await handleTyping(socket, userId, event);
            break;
          default:
            send(socket, { type: 'error', code: 'UNKNOWN_EVENT', message: 'Unknown event type.' });
        }
      } catch (err) {
        console.error('[ChatGateway] Error handling event:', err);
        send(socket, { type: 'error', code: 'SERVER_ERROR', message: 'Internal server error.' });
      }
    });

    // 5. Handle disconnect
    socket.on('close', async () => {
      const justWentOffline = removeConnection(userId, socket);

      if (justWentOffline) {
        // Broadcast presence.offline to other participants
        (async () => {
          const convs = await import('../services/chat/conversation.service')
            .then(m => m.getConversationsForUser(userId))
            .catch(() => []);

          const presenceEvent = { type: 'presence.offline', userId };
          const notifiedUsers = new Set<string>();

          for (const conv of convs) {
            if (conv.otherParticipantId) {
              const otherId = conv.otherParticipantId.toString();
              if (!notifiedUsers.has(otherId)) {
                sendToUser(otherId, presenceEvent);
                notifiedUsers.add(otherId);
              }
            }
          }
        })();
      }
    });

    // 6. Heartbeat ping to detect zombie connections
    socket.on('pong', () => {
      (socket as WebSocket & { isAlive?: boolean }).isAlive = true;
    });
  });

  // Heartbeat interval — ping all sockets every 30s, terminate zombies
  const interval = setInterval(() => {
    wss.clients.forEach((socket) => {
      const ws = socket as WebSocket & { isAlive?: boolean };
      if (ws.isAlive === false) {
        ws.terminate();
        return;
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30_000);

  wss.on('close', () => clearInterval(interval));
}
