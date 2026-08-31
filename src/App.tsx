import { useState, useEffect } from 'react';
import type { Role, ScreenId } from './types';
import { LocaleContext } from './i18n/LocaleContext';
import { getStoredLocale, storeLocale } from './i18n';
import type { Locale } from './i18n';
import { getToken, setToken, clearToken } from './lib/auth';
import { apiGetMe, apiGetContractorProfileMe } from './lib/api';
import { Sidebar } from './components/Sidebar';
import { SidebarContext } from './components/sidebar-context';
import { AuthScreen } from './screens/AuthScreen';
import { ClientHome } from './screens/ClientHome';
import { PostProject } from './screens/PostProject';
import { ContractorResults } from './screens/ContractorResults';
import { ProjectTracking } from './screens/ProjectTracking';
import { ReviewDispute } from './screens/ReviewDispute';
import { ContractorOnboarding } from './screens/ContractorOnboarding';
import { ContractorDashboard } from './screens/ContractorDashboard';
import { SubmitQuote } from './screens/SubmitQuote';
import { ProjectUpdate } from './screens/ProjectUpdate';
import { ContractorProfile } from './screens/ContractorProfile';
import { AdminDashboard } from './screens/AdminDashboard';
import { AdminLoginScreen } from './screens/AdminLoginScreen';
import { Chat } from './screens/Chat';

const ADMIN_SCREENS: ScreenId[] = ['admin-dashboard'];

const ADMIN_SESSION_KEY = 'smartbuild_admin_session';
function getAdminSession(): boolean {
  try { return !!localStorage.getItem(ADMIN_SESSION_KEY); } catch { return false; }
}
function setAdminSession(v: boolean) {
  if (v) localStorage.setItem(ADMIN_SESSION_KEY, '1');
  else localStorage.removeItem(ADMIN_SESSION_KEY);
}

function App() {
  const [locale, setLocaleState] = useState<Locale>(getStoredLocale);
  const [role, setRole] = useState<Role | null>(getAdminSession() ? 'admin' : null);
  const [screen, setScreen] = useState<ScreenId>(getAdminSession() ? 'admin-dashboard' : 'auth');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(!getAdminSession() && !!getToken());
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  // On mount: if a JWT exists, restore session via /api/auth/me and contractor profile
  useEffect(() => {
    if (!getToken() || getAdminSession()) return;
    apiGetMe()
      .then(async (user) => {
        const r = user.role.toLowerCase() as Role;
        setRole(r);
        if (r === 'client') {
          setScreen('client-home');
        } else if (r === 'contractor') {
          try {
            const { onboardingCompleted } = await apiGetContractorProfileMe();
            if (onboardingCompleted) {
              setScreen('contractor-dashboard');
            } else {
              setScreen('contractor-onboarding');
            }
          } catch {
            setScreen('contractor-onboarding');
          }
        }
      })
      .catch(() => {
        clearToken();
      })
      .finally(() => setSessionLoading(false));
  }, []);

  const handleAuth = async (r: Role, token?: string) => {
    if (token) setToken(token); else clearToken();
    setRole(r);
    if (r === 'client') {
      setScreen('client-home');
    } else if (r === 'contractor') {
      try {
        const { onboardingCompleted } = await apiGetContractorProfileMe();
        if (onboardingCompleted) {
          setScreen('contractor-dashboard');
        } else {
          setScreen('contractor-onboarding');
        }
      } catch {
        setScreen('contractor-onboarding');
      }
    }
  };

  const handleNavigate = (id: ScreenId, projectId?: string) => {
    if (projectId) {
      setActiveProjectId(projectId);
    }
    if (id === 'auth') {
      clearToken();
      setAdminSession(false);
      setRole(null);
      setScreen('auth');
      setActiveProjectId(null);
      return;
    }
    if (ADMIN_SCREENS.includes(id) && role !== 'admin') {
      setScreen('admin-login');
      return;
    }
    setScreen(id);
  };

  if (sessionLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" />
      </div>
    );
  }

  const handleSetLocale = (l: Locale) => { storeLocale(l); setLocaleState(l); };

  if (screen === 'admin-login') {
    return (
      <LocaleContext.Provider value={{ locale, setLocale: handleSetLocale }}>
        <AdminLoginScreen
          onSuccess={() => {
            setAdminSession(true);
            setRole('admin');
            setScreen('admin-dashboard');
          }}
          onBack={() => setScreen('auth')}
        />
      </LocaleContext.Provider>
    );
  }

  if (!role || screen === 'auth') {
    return (
      <LocaleContext.Provider value={{ locale, setLocale: handleSetLocale }}>
        <AuthScreen onAuth={handleAuth} onAdminPortal={() => setScreen('admin-login')} defaultRole={role || 'client'} />
      </LocaleContext.Provider>
    );
  }

  if (role === 'admin') {
    return (
      <LocaleContext.Provider value={{ locale, setLocale: handleSetLocale }}>
        <AdminDashboard onNavigate={handleNavigate} />
      </LocaleContext.Provider>
    );
  }

  const showSidebar = role === 'client' || role === 'contractor';

  const renderScreen = () => {
    switch (screen) {
      case 'client-home':
        return <ClientHome onNavigate={handleNavigate} />;
      case 'post-project':
        return <PostProject onNavigate={handleNavigate} />;
      case 'contractor-results':
        return <ContractorResults onNavigate={handleNavigate} projectId={activeProjectId} />;
      case 'project-tracking':
        return <ProjectTracking onNavigate={handleNavigate} projectId={activeProjectId} />;
      case 'review-dispute':
        return <ReviewDispute onNavigate={handleNavigate} projectId={activeProjectId} />;
      case 'contractor-onboarding':
        return <ContractorOnboarding onNavigate={handleNavigate} />;
      case 'contractor-dashboard':
        return <ContractorDashboard onNavigate={handleNavigate} />;
      case 'submit-quote':
        return <SubmitQuote onNavigate={handleNavigate} projectId={activeProjectId} />;
      case 'project-update':
        return <ProjectUpdate onNavigate={handleNavigate} projectId={activeProjectId} />;
      case 'contractor-profile':
        return <ContractorProfile onNavigate={handleNavigate} />;
      case 'chat':
        return <Chat onNavigate={handleNavigate} />;
      default:
        return <ClientHome onNavigate={handleNavigate} />;
    }
  };

  return (
    <LocaleContext.Provider value={{ locale, setLocale: handleSetLocale }}>
    <SidebarContext.Provider value={{ openSidebar: () => setSidebarOpen(true) }}>
      <div className="min-h-screen bg-white">
        {showSidebar && (
          <Sidebar
            role={role}
            current={screen}
            onNavigate={handleNavigate}
            open={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
          />
        )}
        <div className="lg:pl-64">
          {renderScreen()}
        </div>
      </div>
    </SidebarContext.Provider>
    </LocaleContext.Provider>
  );
}

export default App;
