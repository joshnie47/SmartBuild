import { useState, useEffect, useRef } from 'react';
import { Search, Globe, Bell, Menu, ArrowLeft, Check, CheckCheck, ExternalLink, Clock } from 'lucide-react';
import { Logo, Avatar } from './ui';
import { useSidebar } from './sidebar-context';
import type { ScreenId, ApiNotificationItem } from '../types';
import { apiGetNotifications, apiMarkNotificationRead, apiMarkAllNotificationsRead } from '../lib/api';
import { useLocale } from '../i18n/LocaleContext';
import { t } from '../i18n';

export function TopNav({
  showSearch = true,
  avatarSrc,
  avatarName = 'Arjun Mehta',
  onNavigate,
}: {
  showSearch?: boolean;
  avatarSrc?: string;
  avatarName?: string;
  onNavigate?: (id: ScreenId, projectId?: string) => void;
}) {
  const { openSidebar } = useSidebar();
  const { locale, setLocale } = useLocale();
  const [notifications, setNotifications] = useState<ApiNotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const data = await apiGetNotifications();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch {
      // Not logged in or error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 10000); // Polling every 10s for new bids
    return () => clearInterval(interval);
  }, []);

  // Handle outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    }
    if (showNotifications) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNotifications]);

  const handleNotificationClick = async (n: ApiNotificationItem) => {
    if (!n.isRead) {
      try {
        await apiMarkNotificationRead(n._id);
        setNotifications((prev) =>
          prev.map((item) => (item._id === n._id ? { ...item, isRead: true } : item))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch {
        // Fallback
      }
    }
    setShowNotifications(false);
    if (n.projectId && onNavigate) {
      if (n.type === 'BID_ACCEPTED' || n.type === 'PROJECT_AWARDED') {
        onNavigate('project-tracking', String(n.projectId));
      } else {
        onNavigate('contractor-results', String(n.projectId));
      }
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await apiMarkAllNotificationsRead();
      setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
      setUnreadCount(0);
    } catch {
      // Fallback
    }
  };

  const toggleLanguage = () => {
    setLocale(locale === 'en' ? 'ta' : 'en');
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-gray-100 bg-white/95 px-4 backdrop-blur-md md:px-6">
      <button onClick={openSidebar} className="rounded-lg p-2 text-navy-500 hover:bg-navy-50 lg:hidden">
        <Menu className="h-5 w-5" />
      </button>

      {onNavigate && (
        <button
          onClick={() => onNavigate('auth')}
          className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-navy-600 hover:bg-navy-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Login
        </button>
      )}

      <Logo variant="dark" />

      {showSearch && (
        <div className="ml-4 hidden flex-1 max-w-md items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 md:flex">
          <Search className="h-4 w-4 text-gray-400" />
          <input
            placeholder="Search contractors, projects..."
            className="w-full bg-transparent text-sm text-navy-700 placeholder-gray-400 outline-none"
          />
        </div>
      )}

      <div className="ml-auto flex items-center gap-1 md:gap-2">
        <button
          onClick={toggleLanguage}
          title="Toggle English / தமிழ்"
          className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-navy-600 hover:bg-navy-50 border border-gray-200"
        >
          <Globe className="h-4 w-4 text-navy-500" strokeWidth={1.75} />
          {locale === 'en' ? 'தமிழ்' : 'English'}
        </button>

        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => {
              setShowNotifications(!showNotifications);
              if (!showNotifications) fetchNotifications();
            }}
            className="relative rounded-lg p-2 text-navy-500 hover:bg-navy-50 transition-colors"
            title="Notifications"
          >
            <Bell className="h-5 w-5" strokeWidth={1.75} />
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-extrabold text-navy-900 shadow-sm animate-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Notification Dropdown Menu */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-gray-100 bg-white p-3 shadow-card z-50 animate-fadeIn">
              <div className="flex items-center justify-between border-b border-gray-100 pb-2 px-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-navy-700">Notifications</span>
                  {unreadCount > 0 && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="flex items-center gap-1 text-[11px] font-medium text-navy-600 hover:text-navy-800"
                  >
                    <CheckCheck className="h-3 w-3" /> Mark all read
                  </button>
                )}
              </div>

              <div className="mt-2 max-h-80 overflow-y-auto space-y-1.5 scrollbar-thin">
                {loading && notifications.length === 0 ? (
                  <p className="py-6 text-center text-xs text-gray-400">Loading notifications...</p>
                ) : notifications.length === 0 ? (
                  <div className="py-8 text-center">
                    <Bell className="mx-auto h-8 w-8 text-gray-300 stroke-[1.5]" />
                    <p className="mt-2 text-xs font-medium text-gray-500">No notifications yet</p>
                    <p className="text-[11px] text-gray-400">You'll receive updates when bids or responses are submitted.</p>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n._id}
                      onClick={() => handleNotificationClick(n)}
                      className={`cursor-pointer rounded-xl p-3 text-left transition-all ${
                        !n.isRead
                          ? 'bg-amber-50/60 hover:bg-amber-50 border border-amber-100/80 shadow-soft'
                          : 'bg-gray-50/60 hover:bg-gray-100 border border-transparent'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-navy-700">{n.title}</span>
                            {!n.isRead && (
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                            )}
                          </div>
                          <p className="mt-1 text-xs text-gray-600 leading-snug">{n.message}</p>
                          <div className="mt-2 flex items-center gap-2 text-[10px] text-gray-400">
                            <Clock className="h-3 w-3" />
                            <span>{new Date(n.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                            {n.projectId && (
                              <span className="ml-auto font-medium text-navy-600 flex items-center gap-0.5 hover:underline">
                                View <ExternalLink className="h-2.5 w-2.5" />
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <button className="ml-1">
          <Avatar src={avatarSrc} alt={avatarName} size="md" />
        </button>
      </div>
    </header>
  );
}
