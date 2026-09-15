import WebSocket from 'ws';

/**
 * In-memory presence store.
 * key   = userId (string)
 * value = Set of all WebSocket connections open for that user
 *         (same user can have browser + mobile = 2 sockets)
 *
 * A user is "online" iff onlineUsers.get(userId)?.size > 0
 *
 * NOTE: This is a single-process store. When you scale to multiple
 * server instances, replace this with Redis SETNX / INCR / DECR.
 */
const onlineUsers = new Map<string, Set<WebSocket>>();

/**
 * Register a new socket connection for a user.
 * Returns true if this was the first socket (user just came online).
 */
export function addConnection(userId: string, socket: WebSocket): boolean {
  if (!onlineUsers.has(userId)) {
    onlineUsers.set(userId, new Set());
  }
  const sockets = onlineUsers.get(userId)!;
  const wasOffline = sockets.size === 0;
  sockets.add(socket);
  return wasOffline;
}

/**
 * Remove a socket when a connection closes.
 * Returns true if this was the last socket (user just went offline).
 */
export function removeConnection(userId: string, socket: WebSocket): boolean {
  const sockets = onlineUsers.get(userId);
  if (!sockets) return false;

  sockets.delete(socket);

  if (sockets.size === 0) {
    onlineUsers.delete(userId);
    return true; // User went offline
  }

  return false; // Still has other connections open
}

/**
 * Check if a user is currently online.
 */
export function isOnline(userId: string): boolean {
  return (onlineUsers.get(userId)?.size ?? 0) > 0;
}

/**
 * Get all open sockets for a user.
 * Returns empty Set if the user is offline.
 */
export function getSockets(userId: string): Set<WebSocket> {
  return onlineUsers.get(userId) ?? new Set();
}

/**
 * Send a JSON event to all open sockets of a specific user.
 * Silently skips sockets that are no longer OPEN.
 */
export function sendToUser(userId: string, event: object): void {
  const payload = JSON.stringify(event);
  const sockets = getSockets(userId);

  for (const socket of sockets) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(payload);
    }
  }
}
