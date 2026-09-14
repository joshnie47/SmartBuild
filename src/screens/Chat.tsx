import { useState, useEffect, useRef, useCallback } from 'react';
import { Paperclip, Send, ArrowLeft, ClipboardList, Search, Wifi, WifiOff } from 'lucide-react';
import { TopNav } from '../components/TopNav';
import { MicInline, MicButton, Avatar } from '../components/ui';
import type { ScreenId } from '../types';
import { apiGetConversations, apiGetMessages, type ApiConversation, type ApiMessage } from '../lib/chatApi';
import { chatSocket, type ServerEvent } from '../lib/chatSocket';
import { v4 as uuidv4 } from 'uuid';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TypingState {
  [conversationId: string]: boolean; // true = other user is typing
}

interface OnlineState {
  [userId: string]: boolean;
}

export function Chat({ onNavigate }: { onNavigate: (id: ScreenId) => void }) {
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

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  const activeConv = conversations.find((c) => c._id === activeConvId);

  // ─── Scroll to bottom when new messages arrive ───────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ─── Load conversation list on mount ────────────────────────────────────
  useEffect(() => {
    setLoadingConvs(true);
    apiGetConversations()
      .then((convs) => {
        setConversations(convs);
        // Auto-select first conversation on desktop
        if (convs.length > 0 && !activeConvId) {
          setActiveConvId(convs[0]._id);
          setShowMobileList(false);
        }
      })
      .catch(console.error)
      .finally(() => setLoadingConvs(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Load messages when active conversation changes ──────────────────────
  useEffect(() => {
    if (!activeConvId) return;
    setLoadingMsgs(true);
    setMessages([]);
    apiGetMessages(activeConvId)
      .then(({ messages: msgs }) => setMessages(msgs))
      .catch(console.error)
      .finally(() => setLoadingMsgs(false));
  }, [activeConvId]);

  // ─── WebSocket connection + event handling ───────────────────────────────
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
              // Deduplicate: if we already have this clientMessageId, skip
              if (prev.some((m) => m.clientMessageId === msg.clientMessageId)) return prev;
              return [...prev, msg as unknown as ApiMessage];
            });
          }
          // Update conversation list's lastMessage
          setConversations((prev) =>
            prev.map((c) =>
              c._id === msg.conversationId
                ? {
                    ...c,
                    lastMessage: { body: msg.body, senderId: msg.senderId, createdAt: msg.createdAt },
                    unreadCount: c._id !== activeConvId ? c.unreadCount + 1 : 0,
                  }
                : c
            )
          );
          break;
        }

        case 'message.read': {
          // Update message statuses to "read" up to the read messageId
          setMessages((prev) =>
            prev.map((m) =>
              m._id === event.messageId ? { ...m, status: 'read' } : m
            )
          );
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

  // ─── Send message ────────────────────────────────────────────────────────
  const send = useCallback(() => {
    if (!input.trim() || !activeConvId) return;

    const clientMessageId = uuidv4();
    chatSocket.sendMessage(activeConvId, input.trim(), clientMessageId);
    setInput('');

    // Stop typing indicator
    if (isTypingRef.current) {
      chatSocket.sendTypingStop(activeConvId);
      isTypingRef.current = false;
    }
  }, [input, activeConvId]);

  // ─── Typing indicator ────────────────────────────────────────────────────
  const handleInputChange = (value: string) => {
    setInput(value);

    if (!activeConvId) return;

    if (!isTypingRef.current) {
      chatSocket.sendTypingStart(activeConvId);
      isTypingRef.current = true;
    }

    // Clear and reset the stop-typing timer (debounced)
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      if (activeConvId) chatSocket.sendTypingStop(activeConvId);
      isTypingRef.current = false;
    }, 2000);
  };

  // ─── Open a conversation ─────────────────────────────────────────────────
  const openConversation = (convId: string) => {
    setActiveConvId(convId);
    setShowMobileList(false);

    // Mark as read — send read receipt for last message in this conversation
    const conv = conversations.find((c) => c._id === convId);
    if (conv?.lastMessage) {
      // We'll send the read receipt once messages load (see messages effect)
    }
    // Clear local unread count immediately for good UX
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
    c.otherUser?.fullName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ─── Helpers ─────────────────────────────────────────────────────────────
  const getOtherUserOnline = (conv: ApiConversation): boolean => {
    if (!conv.otherUser) return false;
    // Prefer real-time state, fall back to initial API value
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
      <TopNav showSearch={false} />

      {/* WS connection indicator (subtle) */}
      <div className="fixed right-4 top-20 z-50 flex items-center gap-1 rounded-full bg-white px-2 py-1 text-xs shadow-sm ring-1 ring-gray-100">
        {wsConnected
          ? <><Wifi className="h-3 w-3 text-emerald-500" /> <span className="text-emerald-600">Live</span></>
          : <><WifiOff className="h-3 w-3 text-red-400" /> <span className="text-red-500">Offline</span></>
        }
      </div>

      <div className="mx-auto max-w-5xl px-0 md:px-6 md:py-4">
        <div className="flex h-[calc(100vh-4rem)] overflow-hidden md:rounded-xl md:border md:border-gray-100 md:shadow-soft">

          {/* ── Conversation list ─────────────────────────────────────────── */}
          <div className={`w-full shrink-0 border-r border-gray-100 md:w-72 ${showMobileList ? 'block' : 'hidden md:block'}`}>
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
                    className={`flex w-full items-center gap-3 border-b border-gray-50 p-3 text-left transition-colors ${
                      activeConvId === conv._id ? 'bg-navy-50' : 'hover:bg-gray-50'
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
                      <p className="text-xs text-gray-500">{conv.otherUser?.specialization ?? conv.otherUser?.role}</p>
                      <div className="flex items-center justify-between">
                        <p className="truncate text-xs text-gray-400">
                          {typing[conv._id] ? (
                            <span className="italic text-emerald-500">Typing…</span>
                          ) : (
                            conv.lastMessage?.body ?? 'No messages yet'
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
                Select a conversation to start chatting
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
                    <p className={`text-xs ${getOtherUserOnline(activeConv) ? 'text-emerald-500' : 'text-gray-400'}`}>
                      {typing[activeConv._id]
                        ? '✏️ Typing…'
                        : getOtherUserOnline(activeConv) ? '● Online' : '○ Offline'}
                    </p>
                  </div>
                </div>

                {/* Project progress pinned link */}
                <button
                  onClick={() => onNavigate('project-tracking')}
                  className="flex items-center justify-center gap-2 border-b border-gray-100 bg-navy-50 py-2 text-xs font-medium text-navy-600 transition-colors hover:bg-navy-100"
                >
                  <ClipboardList className="h-3.5 w-3.5" /> View Project Progress
                </button>

                {/* Messages */}
                <div className="flex-1 space-y-3 overflow-y-auto bg-gray-50 p-4">
                  {loadingMsgs && (
                    <div className="flex justify-center py-8">
                      <div className="h-6 w-6 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" />
                    </div>
                  )}

                  {!loadingMsgs && messages.length === 0 && (
                    <p className="text-center text-sm text-gray-400">
                      No messages yet. Say hello! 👋
                    </p>
                  )}

                  {messages.map((m) => {
                    const isMine = m.senderId !== activeConv.otherUser?._id;
                    return (
                      <div key={m._id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                            isMine
                              ? 'rounded-br-sm bg-navy-600 text-white'
                              : 'rounded-bl-sm bg-gray-200 text-navy-700'
                          }`}
                        >
                          <p>{m.body}</p>
                          <div className={`mt-1 flex items-center justify-end gap-1 text-xs ${isMine ? 'text-navy-200' : 'text-gray-400'}`}>
                            <span>{formatTime(m.createdAt)}</span>
                            {isMine && (
                              <span>{m.status === 'read' ? '✓✓' : '✓'}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  <div ref={messagesEndRef} />
                </div>

                {/* Input bar */}
                <div className="flex items-center gap-2 border-t border-gray-100 p-3">
                  <button className="rounded-lg p-2 text-gray-400 hover:bg-gray-50 hover:text-navy-600">
                    <Paperclip className="h-5 w-5" strokeWidth={1.75} />
                  </button>
                  <input
                    value={input}
                    onChange={(e) => handleInputChange(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && send()}
                    placeholder="Type a message..."
                    className="flex-1 rounded-lg bg-gray-100 px-4 py-2.5 text-sm text-navy-700 placeholder-gray-400 outline-none focus:bg-gray-50 focus:ring-1 focus:ring-navy-200"
                  />
                  <MicInline />
                  <button
                    onClick={send}
                    disabled={!input.trim()}
                    className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-400 text-navy-700 transition-colors hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Send className="h-4 w-4" strokeWidth={2} />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <MicButton />
    </div>
  );
}
