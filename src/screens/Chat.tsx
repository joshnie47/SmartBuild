import { useState } from 'react';
import { Paperclip, Send, ArrowLeft, ClipboardList, Search } from 'lucide-react';
import { TopNav } from '../components/TopNav';
import { MicInline, MicButton, Avatar } from '../components/ui';
import { chatMessages, conversations } from '../data';
import type { ScreenId } from '../types';

export function Chat({ onNavigate }: { onNavigate: (id: ScreenId) => void }) {
  const [activeConv, setActiveConv] = useState('1');
  const [messages, setMessages] = useState(chatMessages);
  const [input, setInput] = useState('');
  const [showMobileList, setShowMobileList] = useState(true);

  const active = conversations.find((c) => c.id === activeConv)!;

  const send = () => {
    if (!input.trim()) return;
    setMessages([...messages, {
      id: String(messages.length + 1),
      sender: 'client',
      text: input,
      time: 'Now',
    }]);
    setInput('');
  };

  return (
    <div className="min-h-screen bg-white">
      <TopNav showSearch={false} />
      <div className="mx-auto max-w-5xl px-0 md:px-6 md:py-4">
        <div className="flex h-[calc(100vh-4rem)] overflow-hidden md:rounded-xl md:border md:border-gray-100 md:shadow-soft">
          {/* Conversation list */}
          <div className={`w-full shrink-0 border-r border-gray-100 md:w-72 ${showMobileList ? 'block' : 'hidden md:block'}`}>
            <div className="flex items-center gap-2 border-b border-gray-100 p-3">
              <div className="flex flex-1 items-center gap-2 rounded-lg bg-gray-100 px-3 py-2">
                <Search className="h-4 w-4 text-gray-400" />
                <input placeholder="Search chats..." className="w-full bg-transparent text-sm text-navy-700 placeholder-gray-400 outline-none" />
              </div>
            </div>
            <div className="overflow-y-auto">
              {conversations.map((c) => (
                <button
                  key={c.id}
                  onClick={() => { setActiveConv(c.id); setShowMobileList(false); }}
                  className={`flex w-full items-center gap-3 border-b border-gray-50 p-3 text-left transition-colors ${
                    activeConv === c.id ? 'bg-navy-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <Avatar src={c.id === '3' ? undefined : 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=150'} alt={c.name} size="md" />
                  <div className="flex-1 overflow-hidden">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-navy-700">{c.name}</span>
                      <span className="text-xs text-gray-400">{c.time}</span>
                    </div>
                    <p className="text-xs text-gray-500">{c.role}</p>
                    <div className="flex items-center justify-between">
                      <p className="truncate text-xs text-gray-400">{c.lastMsg}</p>
                      {c.unread > 0 && (
                        <span className="ml-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-400 text-xs font-semibold text-navy-700">{c.unread}</span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Chat panel */}
          <div className={`flex flex-1 flex-col ${showMobileList ? 'hidden md:flex' : 'flex'}`}>
            {/* Header */}
            <div className="flex items-center gap-2 border-b border-gray-100 p-3">
              <button onClick={() => setShowMobileList(true)} className="rounded-lg p-1.5 text-navy-500 hover:bg-navy-50 md:hidden">
                <ArrowLeft className="h-5 w-5" />
              </button>
              <Avatar src="https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=150" alt={active.name} size="sm" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-navy-700">{active.name}</p>
                <p className="text-xs text-emerald-500">● Online</p>
              </div>
            </div>

            {/* Pinned project progress */}
            <button
              onClick={() => onNavigate('project-tracking')}
              className="flex items-center justify-center gap-2 border-b border-gray-100 bg-navy-50 py-2 text-xs font-medium text-navy-600 transition-colors hover:bg-navy-100"
            >
              <ClipboardList className="h-3.5 w-3.5" /> View Project Progress
            </button>

            {/* Messages */}
            <div className="flex-1 space-y-3 overflow-y-auto bg-gray-50 p-4">
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.sender === 'client' ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                    m.sender === 'client'
                      ? 'rounded-bl-sm bg-gray-200 text-navy-700'
                      : 'rounded-br-sm bg-navy-600 text-white'
                  }`}>
                    <p>{m.text}</p>
                    <p className={`mt-1 text-right text-xs ${m.sender === 'client' ? 'text-gray-400' : 'text-navy-200'}`}>{m.time}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Input bar */}
            <div className="flex items-center gap-2 border-t border-gray-100 p-3">
              <button className="rounded-lg p-2 text-gray-400 hover:bg-gray-50 hover:text-navy-600">
                <Paperclip className="h-5 w-5" strokeWidth={1.75} />
              </button>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && send()}
                placeholder="Type a message..."
                className="flex-1 rounded-lg bg-gray-100 px-4 py-2.5 text-sm text-navy-700 placeholder-gray-400 outline-none focus:bg-gray-50 focus:ring-1 focus:ring-navy-200"
              />
              <MicInline />
              <button
                onClick={send}
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-400 text-navy-700 transition-colors hover:bg-amber-300"
              >
                <Send className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>
          </div>
        </div>
      </div>
      <MicButton />
    </div>
  );
}
