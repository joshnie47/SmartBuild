import { useState } from 'react';
import type { Role, ScreenId } from './types';
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
import { Chat } from './screens/Chat';

function App() {
  const [role, setRole] = useState<Role | null>(null);
  const [screen, setScreen] = useState<ScreenId>('auth');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleAuth = (r: Role) => {
    setRole(r);
    if (r === 'client') setScreen('client-home');
    else if (r === 'contractor') setScreen('contractor-onboarding');
    else setScreen('admin-dashboard');
  };
  

  const handleNavigate = (id: ScreenId) => {
    if (id === 'auth') {
      setRole(null);
      setScreen('auth');
      return;
    }
    setScreen(id);
  };

  if (!role || screen === 'auth') {
    return <AuthScreen onAuth={handleAuth} defaultRole={role || 'client'} />;
  }

  if (role === 'admin' || screen === 'admin-dashboard') {
    return <AdminDashboard onNavigate={handleNavigate} />;
  }

  const showSidebar = role === 'client' || role === 'contractor';

  const renderScreen = () => {
    switch (screen) {
      case 'client-home':
        return <ClientHome onNavigate={handleNavigate} />;
      case 'post-project':
        return <PostProject onNavigate={handleNavigate} />;
      case 'contractor-results':
        return <ContractorResults onNavigate={handleNavigate} />;
      case 'project-tracking':
        return <ProjectTracking onNavigate={handleNavigate} />;
      case 'review-dispute':
        return <ReviewDispute onNavigate={handleNavigate} />;
      case 'contractor-onboarding':
        return <ContractorOnboarding onNavigate={handleNavigate} />;
      case 'contractor-dashboard':
        return <ContractorDashboard onNavigate={handleNavigate} />;
      case 'submit-quote':
        return <SubmitQuote onNavigate={handleNavigate} />;
      case 'project-update':
        return <ProjectUpdate onNavigate={handleNavigate} />;
      case 'contractor-profile':
        return <ContractorProfile onNavigate={handleNavigate} />;
      case 'chat':
        return <Chat onNavigate={handleNavigate} />;
      default:
        return <ClientHome onNavigate={handleNavigate} />;
    }
  };

  return (
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
  );
}

export default App;
