import {
  Home, FilePlus, Users, ClipboardList, Star, MessageSquare,
  LayoutDashboard, FileText, User, Settings, X, Building2,
} from 'lucide-react';
import type { Role, ScreenId } from '../types';
import { useLocale } from '../i18n/LocaleContext';
import type { TranslationKey } from '../i18n';
import { LanguageSwitcher } from './LanguageSwitcher';

interface NavItem {
  id: ScreenId;
  labelKey: TranslationKey;
  icon: typeof Home;
}

const clientNav: NavItem[] = [
  { id: 'client-home', labelKey: 'navDashboard', icon: Home },
  { id: 'post-project', labelKey: 'navPostProject', icon: FilePlus },
  { id: 'contractor-results', labelKey: 'navFindContractors', icon: Users },
  { id: 'project-tracking', labelKey: 'navProjectTracking', icon: ClipboardList },
  { id: 'review-dispute', labelKey: 'navReviews', icon: Star },
  { id: 'chat', labelKey: 'navMessages', icon: MessageSquare },
];

const contractorNav: NavItem[] = [
  { id: 'contractor-dashboard', labelKey: 'navDashboard', icon: LayoutDashboard },
  { id: 'submit-quote', labelKey: 'navSubmitQuote', icon: FileText },
  { id: 'project-update', labelKey: 'navProjectUpdates', icon: ClipboardList },
  { id: 'contractor-profile', labelKey: 'navMyProfile', icon: User },
  { id: 'chat', labelKey: 'navMessages', icon: MessageSquare },
];

const adminNav: NavItem[] = [
  { id: 'admin-dashboard', labelKey: 'navDashboard', icon: LayoutDashboard },
];

export function Sidebar({
  role,
  current,
  onNavigate,
  open,
  onClose,
}: {
  role: Role;
  current: ScreenId;
  onNavigate: (id: ScreenId) => void;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useLocale();
  const items = role === 'client' ? clientNav : role === 'contractor' ? contractorNav : adminNav;

  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-navy-900/30 backdrop-blur-sm lg:hidden" onClick={onClose} />}
      <aside
        className={`fixed left-0 top-0 z-50 flex h-full w-64 flex-col bg-white border-r border-gray-100 transition-transform duration-300 lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center justify-between px-5">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy-600">
              <Building2 className="h-4 w-4 text-amber-400" strokeWidth={2.5} />
            </div>
            <span className="text-lg font-bold text-navy-700">SmartBuild</span>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-navy-400 hover:bg-navy-50 lg:hidden">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {items.map((item) => {
            const active = current === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onNavigate(item.id);
                  onClose();
                }}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  active ? 'bg-navy-600 text-white' : 'text-navy-500 hover:bg-navy-50'
                }`}
              >
                <item.icon className="h-5 w-5" strokeWidth={1.75} />
                {t(item.labelKey)}
              </button>
            );
          })}
        </nav>
        <div className="border-t border-gray-100 p-3 space-y-2">
          <LanguageSwitcher variant="card" className="w-full" />
          <button
            onClick={() => onNavigate('auth')}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-500 hover:bg-gray-50"
          >
            <Settings className="h-5 w-5" strokeWidth={1.75} />
            {t('navSwitchRole')}
          </button>
        </div>
      </aside>
    </>
  );
}
