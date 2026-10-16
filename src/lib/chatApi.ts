import { getToken } from './auth';

const getApiBase = (): string => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (!envUrl) return 'http://localhost:5000/api';
  return envUrl.endsWith('/api') ? envUrl : `${envUrl.replace(/\/+$/, '')}/api`;
};

const BASE = getApiBase();

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

export interface ApiAttachment {
  fileId: string;
  filename: string;
  mimeType: string;
  fileSize: number;
  url?: string;
}

export interface ApiMessage {
  _id: string;
  conversationId: string;
  senderId: string;
  clientMessageId: string;
  messageType?: 'text' | 'image' | 'document';
  body: string;
  attachment?: ApiAttachment;
  attachments?: ApiAttachment[];
  status: 'sent' | 'delivered' | 'read';
  deletedAt: string | null;
  createdAt: string;
  updatedAt?: string;
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
 * DELETE /api/conversations/:conversationId/messages/:messageId or /api/conversations/messages/:messageId
 * Soft-deletes a message (only sender can do this).
 */
export async function apiDeleteMessage(conversationId: string, messageId?: string): Promise<void> {
  const actualMsgId = messageId || conversationId;
  const actualConvId = messageId ? conversationId : undefined;
  const endpoint = actualConvId
    ? `${BASE}/conversations/${actualConvId}/messages/${actualMsgId}`
    : `${BASE}/conversations/messages/${actualMsgId}`;

  const res = await fetch(endpoint, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  await handleResponse<{ message: string; success?: boolean }>(res);
}

/**
 * Generates an authenticated URL for retrieving or downloading an attachment from GridFS.
 */
export function getAttachmentUrl(conversationId: string, fileId: string | unknown, download = false): string {
  const token = getToken();
  let rawId = String(fileId || '');
  if (typeof fileId === 'object' && fileId !== null) {
    rawId = (fileId as any).$oid || (fileId as any)._id || (fileId as any).toString?.() || String(fileId);
  }
  // Strip any accidental prefix if rawId is already a path
  if (rawId.includes('/attachments/')) {
    rawId = rawId.split('/attachments/').pop()?.split('?')[0] || rawId;
  }
  const base = `${BASE}/conversations/${conversationId}/attachments/${rawId}`;
  const params = new URLSearchParams();
  if (token) params.set('token', token);
  if (download) params.set('download', '1');
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

/**
 * POST /api/conversations/:id/messages
 * Sends a message with optional image/document attachment and tracks genuine upload progress.
 */
export function apiSendMessageWithAttachment(
  conversationId: string,
  data: {
    file?: File;
    files?: File[];
    body?: string;
    clientMessageId: string;
  },
  onProgress?: (percent: number) => void
): Promise<{ message: ApiMessage }> {
  return new Promise((resolve, reject) => {
    const token = getToken();
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${BASE}/conversations/${conversationId}/messages`);

    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress(percent);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const res = JSON.parse(xhr.responseText);
          resolve(res);
        } catch {
          reject(new Error('Invalid response from server'));
        }
      } else {
        try {
          const res = JSON.parse(xhr.responseText);
          reject(new Error(res.message || 'Failed to send message'));
        } catch {
          reject(new Error(`Server error: status ${xhr.status}`));
        }
      }
    };

    xhr.onerror = () => reject(new Error('Network error during file upload'));
    xhr.ontimeout = () => reject(new Error('Upload request timed out'));

    const formData = new FormData();
    formData.append('clientMessageId', data.clientMessageId);
    if (data.body) formData.append('body', data.body);
    if (data.files && data.files.length > 0) {
      data.files.forEach((f) => formData.append('files', f));
    } else if (data.file) {
      formData.append('file', data.file);
    }

    xhr.send(formData);
  });
}

