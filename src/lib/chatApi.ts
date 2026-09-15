import { getToken } from './auth';

const BASE = 'http://localhost:5000/api';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ApiOtherUser {
  _id: string;
  fullName: string;
  profileImage: string | null;
  role: 'CLIENT' | 'CONTRACTOR';
  specialization: string | null;
  isOnline: boolean;
}

export interface ApiLastMessage {
  body: string;
  senderId: string;
  createdAt: string;
}

export interface ApiConversation {
  _id: string;
  projectId: string;
  otherUser: ApiOtherUser | null;
  lastMessage: ApiLastMessage | null;
  unreadCount: number;
  updatedAt: string;
}

export interface ApiMessage {
  _id: string;
  conversationId: string;
  senderId: string;
  clientMessageId: string;
  body: string;
  status: 'sent' | 'delivered' | 'read';
  deletedAt: string | null;
  createdAt: string;
}

export interface MessagePagination {
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function authHeaders(): HeadersInit {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(body.message ?? 'API error');
  }
  return res.json() as Promise<T>;
}

// ─── API Functions ────────────────────────────────────────────────────────────

/**
 * GET /api/conversations
 * Returns all conversations for the logged-in user.
 */
export async function apiGetConversations(): Promise<ApiConversation[]> {
  const res = await fetch(`${BASE}/conversations`, {
    headers: authHeaders(),
  });
  const data = await handleResponse<{ conversations: ApiConversation[] }>(res);
  return data.conversations;
}

/**
 * GET /api/conversations/:id
 * Returns a single conversation's metadata.
 */
export async function apiGetConversation(conversationId: string): Promise<ApiConversation> {
  const res = await fetch(`${BASE}/conversations/${conversationId}`, {
    headers: authHeaders(),
  });
  const data = await handleResponse<{ conversation: ApiConversation }>(res);
  return data.conversation;
}

/**
 * GET /api/conversations/:id/messages?page=N&limit=N
 * Returns paginated message history.
 */
export async function apiGetMessages(
  conversationId: string,
  page = 1,
  limit = 50
): Promise<{ messages: ApiMessage[]; pagination: MessagePagination }> {
  const res = await fetch(
    `${BASE}/conversations/${conversationId}/messages?page=${page}&limit=${limit}`,
    { headers: authHeaders() }
  );
  return handleResponse<{ messages: ApiMessage[]; pagination: MessagePagination }>(res);
}

/**
 * DELETE /api/conversations/messages/:messageId
 * Soft-deletes a message (only sender can do this).
 */
export async function apiDeleteMessage(messageId: string): Promise<void> {
  const res = await fetch(`${BASE}/conversations/messages/${messageId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  await handleResponse<{ message: string }>(res);
}
