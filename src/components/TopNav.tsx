import { Search, Globe, Bell, Menu, ArrowLeft } from 'lucide-react';
import { Logo, Avatar } from './ui';
import { useSidebar } from './sidebar-context';
import type { ScreenId } from '../types';

export function TopNav({
  showSearch = true,
  avatarSrc,
  avatarName = 'Arjun Mehta',
  onNavigate,
}: {
  showSearch?: boolean;
  avatarSrc?: string;
  avatarName?: string;
  onNavigate?: (id: ScreenId) => void;
}) {
  const { openSidebar } = useSidebar();
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
        <button className="rounded-lg p-2 text-navy-500 hover:bg-navy-50">
          <Globe className="h-5 w-5" strokeWidth={1.75} />
        </button>
        <button className="relative rounded-lg p-2 text-navy-500 hover:bg-navy-50">
          <Bell className="h-5 w-5" strokeWidth={1.75} />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-amber-400" />
        </button>
        <button className="ml-1">
          <Avatar src={avatarSrc} alt={avatarName} size="md" />
        </button>
      </div>
    </header>
  );
}
