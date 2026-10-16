import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Paperclip,
  Send,
  ArrowLeft,
  ClipboardList,
  Search,
  Wifi,
  WifiOff,
  X,
  FileText,
  Download,
  ExternalLink,
  AlertCircle,
  Loader2,
  File,
  Eye,
  MoreVertical,
  Trash2,
} from 'lucide-react';
import { TopNav } from '../components/TopNav';
import { Avatar } from '../components/ui';
import {
  apiGetConversations,
  apiGetMessages,
  apiSendMessageWithAttachment,
  apiDeleteMessage,
  getAttachmentUrl,
  type ApiConversation,
  type ApiMessage,
} from '../lib/chatApi';
import { chatSocket, type ServerEvent } from '../lib/chatSocket';
import { useLocale } from '../i18n/LocaleContext';
import type { ScreenId } from '../types';

const uuidv4 = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

// ─── Format Helpers ──────────────────────────────────────────────────────────

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

const ALLOWED_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.pdf', '.doc', '.docx'];
const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp'];

// ─── Types ───────────────────────────────────────────────────────────────────

interface TypingState {
  [conversationId: string]: boolean;
}

interface OnlineState {
  [userId: string]: boolean;
}

interface SelectedAttachment {
  id: string;
  file: File;
  previewUrl: string | null;
  category: 'image' | 'document';
  name: string;
  size: number;
}

export function Chat({
  onNavigate,
  initialProjectId,
}: {
  onNavigate: (id: ScreenId, projectId?: string) => void;
  initialProjectId?: string;
}) {
  const { t } = useLocale();
  const [conversations, setConversations] = useState<ApiConversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ApiMessage[]>([]);
  const [input, setInput] = useState('');
  const [showMobileList, setShowMobileList] = useState(true);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [typing, setTyping] = useState<TypingState>({});
  const [onlineUsers, setOnlineUsers] = useState<OnlineState>({});
  const [searchQuery, setSearchQuery] = useState('');

  // ── Attachment & Upload state ──
  const [selectedAttachments, setSelectedAttachments] = useState<SelectedAttachment[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // ── Lightbox Image Modal ──
  const [lightboxImage, setLightboxImage] = useState<{ url: string; downloadUrl: string; filename: string } | null>(null);

  // ── Message Deletion State ──
  const [messageToDelete, setMessageToDelete] = useState<ApiMessage | null>(null);
  const [isDeletingMessage, setIsDeletingMessage] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [openMenuMessageId, setOpenMenuMessageId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  // ── Scroll Management State & Refs ──
  const isUserNearBottomRef = useRef(true);
  const prevMessagesLengthRef = useRef(0);
  const initialScrollDoneRef = useRef<string | null>(null);

  // ── Stable refs to prevent unwanted clears during effects and unmounts ──
  const selectedAttachmentsRef = useRef<SelectedAttachment[]>([]);
  useEffect(() => {
    selectedAttachmentsRef.current = selectedAttachments;
  }, [selectedAttachments]);

  // Track previous active conversation ID so we ONLY clear attachment when user explicitly switches conversations
  const prevActiveConvIdRef = useRef<string | null>(null);

  const activeConv = conversations.find((c) => c._id === activeConvId);

  // ─── Lifecycle & Diagnostic Logging ─────────────────────────────────────
  useEffect(() => {
    console.log('[Chat Diagnostic] <Chat> mounted. initialProjectId:', initialProjectId);
    return () => {
      console.log('[Chat Diagnostic] <Chat> unmounted! Cleaning up previewUrls...');
      for (const att of selectedAttachmentsRef.current) {
        if (att.previewUrl) {
          try {
            URL.revokeObjectURL(att.previewUrl);
          } catch { }
        }
      }
    };
  }, [initialProjectId]);

  useEffect(() => {
    console.log('[Chat Diagnostic] activeConvId state is now:', activeConvId);
  }, [activeConvId]);

  useEffect(() => {
    console.log('[Chat Diagnostic] selectedAttachments count:', selectedAttachments.length);
  }, [selectedAttachments]);

  // ─── Scroll Management ───────────────────────────────────────────────────
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    if (messagesContainerRef.current) {
      const el = messagesContainerRef.current;
      el.scrollTo({ top: el.scrollHeight, behavior });
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior });
    }
  }, []);

  const handleMessagesScroll = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    // User is considered at the bottom if within 100px
    isUserNearBottomRef.current = distanceToBottom <= 100;
  }, []);

  // Intelligent scroll: only scroll when user is at the bottom or sent a message
  useEffect(() => {
    if (!activeConvId || messages.length === 0) return;

    // Initial load for this conversation: jump to bottom instantly without smooth animation lag
    if (initialScrollDoneRef.current !== activeConvId) {
      initialScrollDoneRef.current = activeConvId;
      isUserNearBottomRef.current = true;
      prevMessagesLengthRef.current = messages.length;
      requestAnimationFrame(() => {
        scrollToBottom('auto');
      });
      return;
    }

    // When new messages are appended
    if (messages.length > prevMessagesLengthRef.current) {
      const lastMsg = messages[messages.length - 1];
      const isMine = lastMsg.senderId !== activeConv?.otherUser?._id;
      // If the current user sent the message or was already near bottom, auto-scroll down
      if (isMine || isUserNearBottomRef.current) {
        scrollToBottom('smooth');
      }
    }

    prevMessagesLengthRef.current = messages.length;
  }, [messages, activeConvId, activeConv, scrollToBottom]);

  // ─── Clean up preview URLs on user remove or after send ──────────────────
  const removeSelectedAttachment = useCallback((idToRemove: string) => {
    setSelectedAttachments((prev) => {
      const item = prev.find((a) => a.id === idToRemove);
      if (item?.previewUrl) {
        try {
          URL.revokeObjectURL(item.previewUrl);
        } catch { }
      }
      return prev.filter((a) => a.id !== idToRemove);
    });
    setUploadError(null);
  }, []);

  const clearSelectedAttachments = useCallback((reason = 'unspecified') => {
    console.log(`[Chat Diagnostic] clearSelectedAttachments called! Reason: ${reason}`);
    setSelectedAttachments((prev) => {
      for (const a of prev) {
        if (a.previewUrl) {
          try {
            URL.revokeObjectURL(a.previewUrl);
          } catch { }
        }
      }
      return [];
    });
    setUploadProgress(null);
    setUploadError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // ─── Keydown handler for Esc to close lightbox or delete modal ────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (lightboxImage) setLightboxImage(null);
        if (openMenuMessageId) setOpenMenuMessageId(null);
        if (messageToDelete && !isDeletingMessage) {
          setMessageToDelete(null);
          setDeleteError(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxImage, openMenuMessageId, messageToDelete, isDeletingMessage]);

  // ─── Close message options menu on outside click ─────────────────────────
  useEffect(() => {
    if (!openMenuMessageId) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.message-action-menu')) {
        setOpenMenuMessageId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openMenuMessageId]);

  // ─── Load conversation list on mount ─────────────────────────────────────
  useEffect(() => {
    console.log('[Chat Diagnostic] Mounting effect: fetching conversations...');
    setLoadingConvs(true);
    apiGetConversations()
      .then((convs) => {
        console.log('[Chat Diagnostic] Loaded conversations:', convs.length);
        setConversations(convs);
        if (convs.length > 0 && !activeConvId) {
          const target = initialProjectId
            ? convs.find((c) => c._id === initialProjectId || c.projectId === initialProjectId)
            : null;
          const chosenId = target ? target._id : convs[0]._id;
          console.log('[Chat Diagnostic] Setting initial activeConvId:', chosenId);
          setActiveConvId(chosenId);
          setShowMobileList(false);
        }
      })
      .catch((err) => console.error('[Chat Diagnostic] Failed to load convs:', err))
      .finally(() => setLoadingConvs(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Load messages when active conversation changes ───────────────────────
  useEffect(() => {
    console.log('[Chat Diagnostic] useEffect [activeConvId] triggered with:', activeConvId, 'previous activeConvId:', prevActiveConvIdRef.current);
    if (!activeConvId) return;

    // ONLY clear attachment if switching from an existing conversation to a DIFFERENT conversation
    if (prevActiveConvIdRef.current && prevActiveConvIdRef.current !== activeConvId) {
      console.log('[Chat Diagnostic] Switched conversations from', prevActiveConvIdRef.current, 'to', activeConvId, '-> clearing attachments');
      clearSelectedAttachments('user switched conversations');
    }
    prevActiveConvIdRef.current = activeConvId;

    setLoadingMsgs(true);
    setMessages([]);
    apiGetMessages(activeConvId)
      .then(({ messages: msgs }) => {
        console.log('[Chat Diagnostic] Loaded messages count:', msgs.length);
        setMessages(msgs);
      })
      .catch((err) => console.error('[Chat Diagnostic] Failed to load messages:', err))
      .finally(() => setLoadingMsgs(false));
  }, [activeConvId, clearSelectedAttachments]);

  // ─── WebSocket connection + event handling ────────────────────────────────
  useEffect(() => {
    chatSocket.connect();

    const checkConnected = setInterval(() => {
      setWsConnected(chatSocket.isConnected());
    }, 1000);

    const unsubscribe = chatSocket.onEvent((event: ServerEvent) => {
      setWsConnected(true);

      switch (event.type) {
        case 'message.created': {
          const msg = event.message;
          // Only append if this message belongs to the active conversation
          if (msg.conversationId === activeConvId) {
            setMessages((prev) => {
              // Deduplicate: if we already have this _id or clientMessageId, update or skip
              if (
                prev.some(
                  (m) =>
                    m._id === msg._id ||
                    (msg.clientMessageId && m.clientMessageId === msg.clientMessageId)
                )
              ) {
                return prev.map((m) =>
                  m.clientMessageId === msg.clientMessageId || m._id === msg._id
                    ? (msg as unknown as ApiMessage)
                    : m
                );
              }
              return [...prev, msg as unknown as ApiMessage];
            });
          }
          // Update conversation list's lastMessage
          setConversations((prev) =>
            prev.map((c) =>
              c._id === msg.conversationId
                ? {
                  ...c,
                  lastMessage: {
                    body: msg.body,
                    senderId: msg.senderId,
                    createdAt: msg.createdAt,
                  },
                  unreadCount: c._id !== activeConvId ? c.unreadCount + 1 : 0,
                }
                : c
            )
          );
          break;
        }

        case 'message.read': {
          setMessages((prev) =>
            prev.map((m) => (m._id === event.messageId ? { ...m, status: 'read' } : m))
          );
          break;
        }

        case 'message.deleted': {
          if (event.conversationId === activeConvId) {
            setMessages((prev) => prev.filter((m) => m._id !== event.messageId));
          }
          // Refresh conversation list so lastMessage snippet and preview update properly
          apiGetConversations()
            .then((convs) => setConversations(convs))
            .catch((err) => console.error('[Chat Diagnostic] Failed to reload convs after delete:', err));
          break;
        }

        case 'typing.start':
          setTyping((prev) => ({ ...prev, [event.conversationId]: true }));
          break;

        case 'typing.stop':
          setTyping((prev) => ({ ...prev, [event.conversationId]: false }));
          break;

        case 'presence.online':
          setOnlineUsers((prev) => ({ ...prev, [event.userId]: true }));
          break;

        case 'presence.offline':
          setOnlineUsers((prev) => ({ ...prev, [event.userId]: false }));
          break;
      }
    });

    return () => {
      unsubscribe();
      clearInterval(checkConnected);
    };
  }, [activeConvId]);

  // ─── File Selection & Validation ─────────────────────────────────────────
  // ─── File Selection & Validation ─────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFiles = Array.from(e.target.files || []);
    if (rawFiles.length === 0) return;

    setUploadError(null);

    const MAX_SIZE = 10 * 1024 * 1024; // 10 MB per file

    // 1. Validate per-file size and format
    for (const file of rawFiles) {
      if (file.size > MAX_SIZE) {
        setUploadError(`"${file.name}" exceeds 10 MB limit (${(file.size / (1024 * 1024)).toFixed(1)} MB).`);
        if (e.target) e.target.value = '';
        return;
      }

      const ext = `.${file.name.split('.').pop()?.toLowerCase() || ''}`;
      if (!ALLOWED_EXTS.includes(ext)) {
        setUploadError(`Unsupported format "${ext}". Supported: JPG, PNG, WEBP, PDF, DOC, DOCX.`);
        if (e.target) e.target.value = '';
        return;
      }
    }

    // 2. Classify incoming files
    const incomingCategories = rawFiles.map((f) => {
      const ext = `.${f.name.split('.').pop()?.toLowerCase() || ''}`;
      const isImg = IMAGE_EXTS.includes(ext);
      return { file: f, isImage: isImg };
    });

    const incomingImages = incomingCategories.filter((c) => c.isImage);
    const incomingDocs = incomingCategories.filter((c) => !c.isImage);

    // 3. Existing attachments
    const existingImages = selectedAttachments.filter((a) => a.category === 'image');
    const existingDocs = selectedAttachments.filter((a) => a.category === 'document');

    const totalImages = existingImages.length + incomingImages.length;
    const totalDocs = existingDocs.length + incomingDocs.length;

    // Disallow mixed image and document attachments in one message
    if (totalImages > 0 && totalDocs > 0) {
      setUploadError('Please attach either up to 5 images or 1 document per message.');
      if (e.target) e.target.value = '';
      return;
    }

    // Enforce limits: max 5 images, max 1 document
    if (totalDocs > 1) {
      setUploadError('You can only attach 1 document per message.');
      if (e.target) e.target.value = '';
      return;
    }

    if (totalImages > 5) {
      setUploadError('You can attach up to 5 images per message.');
      if (e.target) e.target.value = '';
      return;
    }

    // 4. Create preview items
    const newItems: SelectedAttachment[] = incomingCategories.map(({ file, isImage }) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      file,
      previewUrl: isImage ? URL.createObjectURL(file) : null,
      category: isImage ? 'image' : 'document',
      name: file.name,
      size: file.size,
    }));

    setSelectedAttachments((prev) => [...prev, ...newItems]);

    // Reset input so user can choose again or re-select
    if (e.target) {
      e.target.value = '';
    }
  };

  // ─── Send message (Text and/or Attachment) ─────────────────────────────────
  const send = useCallback(async () => {
    if (isSending || !activeConvId) return;

    const trimmedInput = input.trim();
    if (!trimmedInput && selectedAttachments.length === 0) return;

    setIsSending(true);
    setUploadError(null);

    const clientMessageId = uuidv4();

    // If attachments are selected, upload via HTTP multipart endpoint with progress
    if (selectedAttachments.length > 0) {
      setUploadProgress(0);
      try {
        const result = await apiSendMessageWithAttachment(
          activeConvId,
          {
            files: selectedAttachments.map((a) => a.file),
            body: trimmedInput,
            clientMessageId,
          },
          (percent) => setUploadProgress(percent)
        );

        // Immediately update sender's message list with the real persisted message
        setMessages((prev) => {
          if (
            prev.some(
              (m) =>
                m._id === result.message._id ||
                m.clientMessageId === result.message.clientMessageId
            )
          ) {
            return prev;
          }
          return [...prev, result.message];
        });

        // Update conversation's last message preview
        const count = result.message.attachments?.length || 1;
        const lastPreview =
          result.message.body ||
          (result.message.messageType === 'image'
            ? count > 1
              ? `📷 ${count} Images`
              : '📷 Image'
            : `📄 ${result.message.attachment?.filename || 'Document'}`);

        setConversations((prev) =>
          prev.map((c) =>
            c._id === activeConvId
              ? {
                ...c,
                lastMessage: {
                  body: lastPreview,
                  senderId: result.message.senderId,
                  createdAt: result.message.createdAt,
                },
              }
              : c
          )
        );

        // Reset composer
        setInput('');
        clearSelectedAttachments('send completed successfully');
      } catch (err) {
        console.error('Failed to upload attachment message:', err);
        const errMsg = err instanceof Error ? err.message : 'Upload failed. Please try again.';
        setUploadError(errMsg);
      } finally {
        setIsSending(false);
        setUploadProgress(null);
      }
    } else {
      // Plain text message
      try {
        chatSocket.sendMessage(activeConvId, trimmedInput, clientMessageId);
        setInput('');
      } catch (err) {
        console.error('Failed to send text message via socket:', err);
        // Fallback to HTTP endpoint
        try {
          const res = await apiSendMessageWithAttachment(activeConvId, {
            body: trimmedInput,
            clientMessageId,
          });
          setMessages((prev) => [...prev, res.message]);
          setInput('');
        } catch {
          setUploadError('Failed to send message. Check your connection.');
        }
      } finally {
        setIsSending(false);
      }
    }

    // Stop typing indicator
    if (isTypingRef.current) {
      chatSocket.sendTypingStop(activeConvId);
      isTypingRef.current = false;
    }
  }, [isSending, activeConvId, input, selectedAttachments, clearSelectedAttachments]);

  // ─── Typing indicator ────────────────────────────────────────────────────
  const handleInputChange = (value: string) => {
    setInput(value);

    if (!activeConvId) return;

    if (!isTypingRef.current) {
      chatSocket.sendTypingStart(activeConvId);
      isTypingRef.current = true;
    }

    // Debounce stop typing
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      if (activeConvId) chatSocket.sendTypingStop(activeConvId);
      isTypingRef.current = false;
    }, 2000);
  };

  // ─── Open a conversation ─────────────────────────────────────────────────
  const openConversation = (convId: string) => {
    console.log('[Chat Diagnostic] openConversation clicked for convId:', convId, 'current activeConvId:', activeConvId);
    if (convId === activeConvId) {
      console.log('[Chat Diagnostic] openConversation: already on this conversation, ignoring click to avoid clearing attachment');
      setShowMobileList(false);
      return;
    }
    setActiveConvId(convId);
    setShowMobileList(false);
    clearSelectedAttachments('user switched conversation in list');

    // Clear unread count locally for responsive UX
    setConversations((prev) =>
      prev.map((c) => (c._id === convId ? { ...c, unreadCount: 0 } : c))
    );
  };

  // ─── Send read receipt when messages load ────────────────────────────────
  useEffect(() => {
    if (!activeConvId || messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    chatSocket.sendReadReceipt(activeConvId, lastMsg._id);
  }, [messages, activeConvId]);

  // ─── Filtered conversation list ──────────────────────────────────────────
  const filteredConversations = conversations.filter((c) =>
    (c.otherUser?.fullName || 'Unknown').toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ─── Delete Message Handler ──────────────────────────────────────────────
  const handleDeleteConfirm = async () => {
    if (!messageToDelete || !activeConvId) return;
    setIsDeletingMessage(true);
    setDeleteError(null);
    try {
      await apiDeleteMessage(activeConvId, messageToDelete._id);
      // Remove immediately from sender's active chat view
      setMessages((prev) => prev.filter((m) => m._id !== messageToDelete._id));
      setMessageToDelete(null);
      // Synchronize conversation list (in case lastMessage changed)
      apiGetConversations()
        .then((convs) => setConversations(convs))
        .catch((err) => console.error('[Chat Diagnostic] Failed to reload convs after delete:', err));
    } catch (err: unknown) {
      console.error('[Chat] Failed to delete message:', err);
      const errMsg =
        (err as { response?: { data?: { error?: string } }; message?: string })?.response?.data?.error ||
        (err as Error).message ||
        'Failed to delete message. Please try again.';
      setDeleteError(errMsg);
    } finally {
      setIsDeletingMessage(false);
    }
  };

  // ─── Helpers ─────────────────────────────────────────────────────────────
  const getOtherUserOnline = (conv: ApiConversation): boolean => {
    if (!conv.otherUser) return false;
    return onlineUsers[conv.otherUser._id] ?? conv.otherUser.isOnline;
  };

  const formatTime = (isoString: string): string => {
    const date = new Date(isoString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString('en-IN', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-white">
      <TopNav showSearch={false} onNavigate={onNavigate} />

      {/* WS connection indicator */}
      <div className="fixed right-4 top-20 z-40 flex items-center gap-1 rounded-full bg-white px-2 py-1 text-xs shadow-sm ring-1 ring-gray-100">
        {wsConnected ? (
          <>
            <Wifi className="h-3 w-3 text-emerald-500" />
            <span className="text-emerald-600 font-medium">Live</span>
          </>
        ) : (
          <>
            <WifiOff className="h-3 w-3 text-red-400" />
            <span className="text-red-500 font-medium">Offline</span>
          </>
        )}
      </div>

      <div className="mx-auto max-w-5xl px-0 md:px-6 md:py-4">
        <div className="flex h-[calc(100vh-4rem)] overflow-hidden md:rounded-xl md:border md:border-gray-100 md:shadow-soft">
          {/* ── Conversation list ─────────────────────────────────────────── */}
          <div
            className={`w-full shrink-0 border-r border-gray-100 md:w-72 ${showMobileList ? 'block' : 'hidden md:block'
              }`}
          >
            <div className="flex items-center gap-2 border-b border-gray-100 p-3">
              <div className="flex flex-1 items-center gap-2 rounded-lg bg-gray-100 px-3 py-2">
                <Search className="h-4 w-4 text-gray-400" />
                <input
                  placeholder="Search chats..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent text-sm text-navy-700 placeholder-gray-400 outline-none"
                />
              </div>
            </div>

            <div className="overflow-y-auto">
              {loadingConvs && (
                <div className="flex items-center justify-center py-12">
                  <div className="h-6 w-6 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" />
                </div>
              )}

              {!loadingConvs && filteredConversations.length === 0 && (
                <p className="px-4 py-8 text-center text-sm text-gray-400">
                  {conversations.length === 0
                    ? 'No conversations yet. Accept a bid to start chatting.'
                    : 'No matching conversations.'}
                </p>
              )}

              {filteredConversations.map((conv) => {
                const isOnlineNow = getOtherUserOnline(conv);
                return (
                  <button
                    key={conv._id}
                    onClick={() => openConversation(conv._id)}
                    className={`flex w-full items-center gap-3 border-b border-gray-50 p-3 text-left transition-colors ${activeConvId === conv._id ? 'bg-navy-50' : 'hover:bg-gray-50'
                      }`}
                  >
                    <div className="relative shrink-0">
                      <Avatar
                        src={conv.otherUser?.profileImage ?? undefined}
                        alt={conv.otherUser?.fullName ?? 'User'}
                        size="md"
                      />
                      {isOnlineNow && (
                        <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-400" />
                      )}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-navy-700">
                          {conv.otherUser?.fullName ?? 'Unknown'}
                        </span>
                        <span className="text-xs text-gray-400">
                          {conv.lastMessage ? formatTime(conv.lastMessage.createdAt) : ''}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">
                        {conv.otherUser?.specialization ?? conv.otherUser?.role}
                      </p>
                      <div className="flex items-center justify-between">
                        <p className="truncate text-xs text-gray-400">
                          {typing[conv._id] ? (
                            <span className="italic text-emerald-500">{t('typing')}</span>
                          ) : (
                            conv.lastMessage?.body || t('noMessagesYet')
                          )}
                        </p>
                        {conv.unreadCount > 0 && (
                          <span className="ml-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-400 text-xs font-semibold text-navy-700">
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Chat panel ────────────────────────────────────────────────── */}
          <div className={`flex flex-1 flex-col ${showMobileList ? 'hidden md:flex' : 'flex'}`}>
            {!activeConv ? (
              <div className="flex flex-1 items-center justify-center text-sm text-gray-400">
                {t('selectConvToStart')}
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="flex items-center gap-2 border-b border-gray-100 p-3">
                  <button
                    onClick={() => setShowMobileList(true)}
                    className="rounded-lg p-1.5 text-navy-500 hover:bg-navy-50 md:hidden"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <div className="relative">
                    <Avatar
                      src={activeConv.otherUser?.profileImage ?? undefined}
                      alt={activeConv.otherUser?.fullName ?? 'User'}
                      size="sm"
                    />
                    {getOtherUserOnline(activeConv) && (
                      <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full border-2 border-white bg-emerald-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-navy-700">
                      {activeConv.otherUser?.fullName ?? 'Unknown'}
                    </p>
                    <p
                      className={`text-xs ${getOtherUserOnline(activeConv) ? 'text-emerald-500' : 'text-gray-400'
                        }`}
                    >
                      {typing[activeConv._id]
                        ? `✏️ ${t('typing')}`
                        : getOtherUserOnline(activeConv)
                          ? `● ${t('online')}`
                          : `○ ${t('offline')}`}
                    </p>
                  </div>
                </div>

                {/* Project progress pinned link */}
                <button
                  onClick={() => onNavigate('project-tracking', activeConv.projectId)}
                  className="flex items-center justify-center gap-2 border-b border-gray-100 bg-navy-50 py-2 text-xs font-medium text-navy-600 transition-colors hover:bg-navy-100"
                >
                  <ClipboardList className="h-3.5 w-3.5" /> {t('viewProjectProgress')}
                </button>

                {/* Messages list */}
                <div
                  ref={messagesContainerRef}
                  onScroll={handleMessagesScroll}
                  className="flex-1 space-y-3 overflow-y-auto bg-gray-50 p-4"
                >
                  {loadingMsgs && (
                    <div className="flex justify-center py-8">
                      <div className="h-6 w-6 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" />
                    </div>
                  )}

                  {!loadingMsgs && messages.length === 0 && (
                    <p className="text-center text-sm text-gray-400">{t('noMessagesYet')}</p>
                  )}

                  {messages.map((m) => {
                    const isMine = m.senderId !== activeConv.otherUser?._id;
                    const msgAttachments =
                      m.attachments && m.attachments.length > 0
                        ? m.attachments
                        : m.attachment && m.attachment.fileId
                          ? [m.attachment]
                          : [];

                    const isImageCategory =
                      m.messageType === 'image' ||
                      msgAttachments.some((a) => {
                        const ext = `.${a.filename.split('.').pop()?.toLowerCase() || ''}`;
                        return IMAGE_EXTS.includes(ext) || a.mimeType?.startsWith('image/');
                      });

                    return (
                      <div
                        key={m._id}
                        className={`group/msg flex items-center gap-1.5 ${
                          isMine ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        {/* Action Menu (Delete Message) - Only for messages sent by the current user */}
                        {isMine && (
                          <div
                            className={`relative message-action-menu ${
                              openMenuMessageId === m._id
                                ? 'opacity-100'
                                : 'opacity-0 group-hover/msg:opacity-100 focus-within:opacity-100'
                            } transition-opacity shrink-0`}
                          >
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenuMessageId((cur) => (cur === m._id ? null : m._id));
                              }}
                              title="Message options"
                              aria-label="Message options"
                              className="rounded-full p-1 text-gray-400 hover:bg-gray-200/60 hover:text-navy-700 transition-colors"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </button>

                            {openMenuMessageId === m._id && (
                              <div
                                className="absolute right-0 top-full mt-1 z-30 min-w-[140px] rounded-xl bg-white py-1 shadow-lg ring-1 ring-black/5 animate-fade-in"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenMenuMessageId(null);
                                    setDeleteError(null);
                                    setMessageToDelete(m);
                                  }}
                                  className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  <span>Delete message</span>
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        <div
                          className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                            isMine
                              ? 'rounded-br-sm bg-navy-600 text-white'
                              : 'rounded-bl-sm bg-white text-navy-700 ring-1 ring-gray-100'
                          }`}
                        >
                          {/* Images Rendering (Grid for up to 5 images) */}
                          {msgAttachments.length > 0 && isImageCategory && (
                            <div className="mb-2">
                              <div
                                className={`grid gap-1.5 ${
                                  msgAttachments.length === 1
                                    ? 'grid-cols-1'
                                    : msgAttachments.length === 2
                                      ? 'grid-cols-2 max-w-sm'
                                      : msgAttachments.length === 4
                                        ? 'grid-cols-2 max-w-sm'
                                        : 'grid-cols-2 sm:grid-cols-3 max-w-sm sm:max-w-md'
                                }`}
                              >
                                {msgAttachments.map((att, idx) => {
                                  const attUrl = getAttachmentUrl(m.conversationId, att.fileId);
                                  const dlUrl = getAttachmentUrl(m.conversationId, att.fileId, true);
                                  const isSingle = msgAttachments.length === 1;

                                  return (
                                    <div
                                      key={att.fileId || idx}
                                      onClick={() =>
                                        setLightboxImage({
                                          url: attUrl,
                                          downloadUrl: dlUrl,
                                          filename: att.filename,
                                        })
                                      }
                                      className={`group relative overflow-hidden rounded-xl bg-gray-900/10 cursor-pointer ${
                                        msgAttachments.length === 3 && idx === 0 ? 'col-span-2 sm:col-span-1' : ''
                                      }`}
                                    >
                                      <img
                                        src={attUrl}
                                        alt={att.filename}
                                        loading="lazy"
                                        onLoad={() => {
                                          if (isUserNearBottomRef.current) {
                                            scrollToBottom('smooth');
                                          }
                                        }}
                                        className={`w-full rounded-xl object-cover transition-transform duration-200 group-hover:scale-102 ${isSingle ? 'max-h-72 min-h-[120px]' : 'h-32 sm:h-36'
                                          }`}
                                        onError={(e) => {
                                          const target = e.currentTarget;
                                          target.style.display = 'none';
                                          const fallback = target.nextElementSibling;
                                          if (fallback) fallback.classList.remove('hidden');
                                        }}
                                      />
                                      <div className="hidden flex items-center justify-between gap-1 p-2 text-xs text-red-600 bg-red-50 rounded-lg">
                                        <span className="truncate">{att.filename || 'Error'}</span>
                                        {dlUrl && (
                                          <a href={dlUrl} download={att.filename} className="underline shrink-0">
                                            Download
                                          </a>
                                        )}
                                      </div>
                                      <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <span className="flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-xs">
                                          <Eye className="h-3 w-3" /> View
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Document Rendering (Max 1 document) */}
                          {msgAttachments.length > 0 && !isImageCategory && (
                            <div className="mb-2">
                              {msgAttachments.map((att, idx) => {
                                const attUrl = getAttachmentUrl(m.conversationId, att.fileId);
                                const dlUrl = getAttachmentUrl(m.conversationId, att.fileId, true);
                                const isPdf = att.filename.toLowerCase().endsWith('.pdf');

                                return (
                                  <div
                                    key={att.fileId || idx}
                                    className={`flex items-center gap-3 rounded-xl p-3 border ${isMine
                                        ? 'bg-navy-700/60 border-navy-500/50 text-white'
                                        : 'bg-gray-50 border-gray-200 text-navy-700'
                                      }`}
                                  >
                                    <div
                                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${isPdf ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'
                                        }`}
                                    >
                                      {isPdf ? <FileText className="h-5 w-5" /> : <File className="h-5 w-5" />}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-xs font-semibold leading-tight">{att.filename}</p>
                                      <p className={`mt-0.5 text-[11px] ${isMine ? 'text-navy-200' : 'text-gray-400'}`}>
                                        {formatBytes(att.fileSize)}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                      {isPdf && (
                                        <a
                                          href={attUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          title="Open in new tab"
                                          className={`rounded-lg p-1.5 transition-colors ${isMine ? 'hover:bg-navy-600 text-white' : 'hover:bg-gray-200 text-navy-700'
                                            }`}
                                        >
                                          <ExternalLink className="h-4 w-4" />
                                        </a>
                                      )}
                                      <a
                                        href={dlUrl}
                                        download={att.filename}
                                        title="Download file"
                                        className={`rounded-lg p-1.5 transition-colors ${isMine ? 'hover:bg-navy-600 text-white' : 'hover:bg-gray-200 text-navy-700'
                                          }`}
                                      >
                                        <Download className="h-4 w-4" />
                                      </a>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Message text content */}
                          {m.body ? <p className="break-words leading-relaxed">{m.body}</p> : null}

                          {/* Timestamp and status */}
                          <div
                            className={`mt-1 flex items-center justify-end gap-1 text-[11px] ${isMine ? 'text-navy-200' : 'text-gray-400'
                              }`}
                          >
                            <span>{formatTime(m.createdAt)}</span>
                            {isMine && <span>{m.status === 'read' ? '✓✓' : '✓'}</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  <div ref={messagesEndRef} />
                </div>

                {/* Selected Attachments Preview Tray (before sending) */}
                {selectedAttachments.length > 0 && (
                  <div className="border-t border-gray-100 bg-gray-50/90 px-4 py-2.5">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                          {selectedAttachments[0].category === 'image'
                            ? `${selectedAttachments.length}/5 Images`
                            : '1/1 Document'}
                        </span>
                        <span className="text-[11px] text-gray-500">
                          {selectedAttachments[0].category === 'image'
                            ? 'Up to 5 images can be sent together'
                            : '1 document per message'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => clearSelectedAttachments('user clicked clear all')}
                        disabled={isSending}
                        className="text-[11px] font-medium text-gray-400 hover:text-red-600 transition-colors"
                      >
                        Clear all
                      </button>
                    </div>

                    {/* Thumbnails list */}
                    <div className="flex flex-wrap items-center gap-2.5">
                      {selectedAttachments.map((att) => (
                        <div
                          key={att.id}
                          className="group relative flex items-center gap-2.5 rounded-lg bg-white p-2 shadow-xs ring-1 ring-gray-200"
                        >
                          {att.category === 'image' && att.previewUrl ? (
                            <img
                              src={att.previewUrl}
                              alt="Selected preview"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                              className="h-12 w-12 rounded-md object-cover ring-1 ring-gray-100 shrink-0"
                            />
                          ) : (
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-amber-50 text-amber-600 ring-1 ring-amber-100">
                              <FileText className="h-6 w-6" />
                            </div>
                          )}

                          <div className="max-w-[140px] sm:max-w-[180px] min-w-0 pr-6">
                            <p className="truncate text-xs font-medium text-navy-700">
                              {att.name}
                            </p>
                            <p className="text-[10px] text-gray-400">
                              {formatBytes(att.size)}
                            </p>
                          </div>

                          {/* Remove individual attachment button */}
                          <button
                            type="button"
                            onClick={() => removeSelectedAttachment(att.id)}
                            disabled={isSending}
                            className="absolute right-1 top-1 rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-red-600 transition-colors"
                            title="Remove file"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Upload Progress Bar when sending */}
                    {uploadProgress !== null && (
                      <div className="mt-2.5">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-navy-700 mb-1">
                          <span className="flex items-center gap-1.5">
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-500" /> Uploading files...
                          </span>
                          <span>{uploadProgress}%</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                          <div
                            className="h-full bg-amber-400 transition-all duration-200"
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Error Banner */}
                {uploadError && (
                  <div className="flex items-center justify-between gap-2 border-t border-red-100 bg-red-50 px-4 py-2 text-xs text-red-600">
                    <div className="flex items-center gap-1.5">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>{uploadError}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setUploadError(null)}
                      className="text-red-400 hover:text-red-600"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

                {/* Input bar */}
                <div className="flex items-center gap-2 border-t border-gray-100 p-3">
                  {/* Hidden file picker input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={handleFileChange}
                    className="hidden"
                    accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx"
                  />

                  {/* Attachment paperclip button */}
                  <button
                    type="button"
                    onClick={() => {
                      if (fileInputRef.current) {
                        fileInputRef.current.value = '';
                        fileInputRef.current.click();
                      }
                    }}
                    disabled={isSending}
                    title="Attach image (JPG, PNG, WEBP) or document (PDF, DOC, DOCX)"
                    className="rounded-lg p-2 text-gray-400 hover:bg-gray-50 hover:text-navy-600 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Paperclip className="h-5 w-5" strokeWidth={1.75} />
                  </button>

                  <input
                    value={input}
                    disabled={isSending}
                    onChange={(e) => handleInputChange(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
                    placeholder={
                      selectedAttachments.length > 0
                        ? 'Add an optional message...'
                        : t('typeMessage')
                    }
                    className="flex-1 rounded-lg bg-gray-100 px-4 py-2.5 text-sm text-navy-700 placeholder-gray-400 outline-none focus:bg-gray-50 focus:ring-1 focus:ring-navy-200 disabled:opacity-75"
                  />

                  <button
                    onClick={send}
                    disabled={isSending || (!input.trim() && selectedAttachments.length === 0)}
                    title="Send message"
                    className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-400 text-navy-700 transition-colors hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" strokeWidth={2} />
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Delete Message Confirmation Modal ────────────────────────────── */}
      {messageToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-fade-in"
          onClick={() => {
            if (!isDeletingMessage) {
              setMessageToDelete(null);
              setDeleteError(null);
            }
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-black/5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-navy-900">Delete message?</h3>
                <p className="text-xs text-gray-500">Delete for everyone in this conversation</p>
              </div>
            </div>

            <div className="mt-4 rounded-xl bg-gray-50 p-3 text-xs text-gray-600 border border-gray-100">
              {messageToDelete.body ? (
                <p className="line-clamp-2 italic font-serif">"{messageToDelete.body}"</p>
              ) : (
                <p className="italic">
                  [
                  {messageToDelete.attachments?.length
                    ? `${messageToDelete.attachments.length} attachment(s)`
                    : messageToDelete.attachment?.filename || 'Attachment message'}
                  ]
                </p>
              )}
            </div>

            <p className="mt-3 text-xs leading-relaxed text-gray-600">
              This will permanently delete this message for both participants in this conversation. Any attached image or document files will also be removed from storage.
            </p>

            {deleteError && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-50 p-2.5 text-xs text-red-600 border border-red-100">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{deleteError}</span>
              </div>
            )}

            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={isDeletingMessage}
                onClick={() => {
                  setMessageToDelete(null);
                  setDeleteError(null);
                }}
                className="rounded-lg px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingMessage}
                onClick={handleDeleteConfirm}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {isDeletingMessage ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Delete for everyone</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Lightbox Image Modal ────────────────────────────────────────────── */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/85 p-4 backdrop-blur-xs animate-fade-in"
          onClick={() => setLightboxImage(null)}
        >
          {/* Top modal bar */}
          <div
            className="flex w-full max-w-4xl items-center justify-between pb-3 text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 overflow-hidden">
              <FileText className="h-4 w-4 text-amber-400 shrink-0" />
              <span className="truncate text-sm font-medium">{lightboxImage.filename}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <a
                href={lightboxImage.downloadUrl}
                download={lightboxImage.filename}
                className="flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/25 transition-colors"
              >
                <Download className="h-3.5 w-3.5" /> Download
              </a>
              <button
                onClick={() => setLightboxImage(null)}
                className="rounded-lg bg-white/15 p-1.5 text-white hover:bg-white/25 transition-colors"
                title="Close (Esc)"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Centered Image */}
          <div
            className="relative flex max-h-[85vh] max-w-4xl items-center justify-center overflow-hidden rounded-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={lightboxImage.url}
              alt={lightboxImage.filename}
              className="max-h-[80vh] max-w-full rounded-xl object-contain shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}
