import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { TokenManager } from './components/TokenManager';
import { ComponentBuilder } from './components/ComponentBuilder';
import { ReleaseManager } from './components/ReleaseManager';
import { Settings } from './components/Settings';
import { ProjectManagement } from './components/ProjectManagement';
import { Login } from './components/Login';
import { Signup } from './components/Signup';
import { OAuthCallback } from './components/OAuthCallback';
import { ProjectModal } from './components/ProjectModal';
import { ProjectProvider, useProject } from './contexts/ProjectContext';
import { TenantProvider, useTenant } from './contexts/TenantContext';
import { ViewState } from './types';
import { BookOpen, MessageSquare, FolderOpen, Plus, Building2 } from 'lucide-react';
import { Id } from '../convex/_generated/dataModel';

interface User {
  userId: string; // This is the Convex user ID (Id<"users">)
  email: string;
  name?: string;
  image?: string;
  role: string;
}

export type ThemeMode = 'light' | 'dark' | 'system';

// URL path to view mapping
const pathToView: Record<string, ViewState> = {
  '/': 'projects', // Projects is now the default landing page
  '/overview': 'dashboard',
  '/tokens': 'tokens',
  '/builder': 'builder',
  '/releases': 'releases',
  '/settings': 'settings',
  '/documentation': 'documentation',
  '/feedback': 'feedback',
  '/projects': 'projects',
};

const viewToPath: Record<ViewState, string> = {
  'dashboard': '/overview',
  'tokens': '/tokens',
  'builder': '/builder',
  'releases': '/releases',
  'settings': '/settings',
  'documentation': '/documentation',
  'feedback': '/feedback',
  'projects': '/projects',
};

// Get initial view from URL
const getViewFromPath = (): ViewState => {
  const path = window.location.pathname;
  // Check for exact match first
  if (pathToView[path]) {
    return pathToView[path];
  }
  // Default to projects (first page after login)
  return 'projects';
};

// Inner app component that uses tenant and project context
const AppContent: React.FC<{
  user: User;
  onLogout: () => void;
  themeMode: ThemeMode;
  resolvedTheme: 'light' | 'dark';
  onThemeModeChange: (mode: ThemeMode) => void;
}> = ({ user, onLogout, themeMode, resolvedTheme, onThemeModeChange }) => {
  const [currentView, setCurrentView] = useState<ViewState>(getViewFromPath());
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showTenantModal, setShowTenantModal] = useState(false);
  const { activeTenant, tenantId, isLoading: isTenantLoading, switchTenant } = useTenant();
  const { activeProject, projectId, isLoading: isProjectLoading } = useProject();

  // Handle view change and update URL
  const handleViewChange = (view: ViewState) => {
    setCurrentView(view);
    const newPath = viewToPath[view];
    if (window.location.pathname !== newPath) {
      window.history.pushState({ view }, '', newPath);
    }
  };

  // Listen for browser back/forward navigation
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const view = event.state?.view || getViewFromPath();
      setCurrentView(view);
    };

    window.addEventListener('popstate', handlePopState);
    
    // Set initial state in history
    if (!window.history.state?.view) {
      window.history.replaceState({ view: currentView }, '', viewToPath[currentView]);
    }

    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Redirect to projects if no project selected (except for projects and settings views)
  useEffect(() => {
    if (!projectId && !isProjectLoading && tenantId && currentView !== 'projects' && currentView !== 'settings') {
      handleViewChange('projects');
    }
  }, [projectId, isProjectLoading, tenantId, currentView]);

  const renderView = () => {
    // Show "no tenant" state if no active tenant
    if (!tenantId && !isTenantLoading) {
      return (
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-zinc-200/60 dark:border-zinc-800/60 flex justify-between items-center bg-white dark:bg-zinc-900 z-10">
            <div>
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">
                Get Started
              </h2>
            </div>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 dark:text-zinc-400">
            <div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center mb-3">
              <Building2 size={24} className="text-violet-500" strokeWidth={1.5} />
            </div>
            <h2 className="text-sm font-medium text-zinc-900 dark:text-white mb-1">Create Your First Workspace</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
              A workspace is where you organize your design system projects.
            </p>
            <button
              onClick={() => setShowTenantModal(true)}
              className="flex items-center gap-1.5 px-3 h-8 bg-violet-600 text-white rounded-md text-xs font-medium hover:bg-violet-700 transition-colors"
            >
              <Plus size={14} />
              Create Workspace
            </button>
          </div>
        </div>
      );
    }
    
    // Show "no project" state if no active project (but allow projects and settings views)
    if (!projectId && !isProjectLoading && tenantId && currentView !== 'projects' && currentView !== 'settings') {
      // Redirect to projects page if no project is selected
      useEffect(() => {
        handleViewChange('projects');
      }, []);
      return null;
    }

    switch (currentView) {
      case 'dashboard':
        return <Dashboard />;
      case 'tokens':
        return <TokenManager />;
      case 'builder':
        return <ComponentBuilder />;
      case 'releases':
        return <ReleaseManager />;
      case 'settings':
        return <Settings themeMode={themeMode} resolvedTheme={resolvedTheme} onThemeModeChange={onThemeModeChange} />;
      case 'projects':
        return (
          <ProjectManagement 
            onProjectSelect={(projectId) => {
              // Navigate to dashboard when project is selected
              handleViewChange('dashboard');
            }}
          />
        );
      case 'documentation':
        return (
          <div className="flex flex-col h-full">
            <div className="p-6 border-b border-zinc-200/60 dark:border-zinc-800/60 flex justify-between items-center bg-white dark:bg-zinc-900 z-10">
                <div>
                    <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">Documentation</h2>
                </div>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 dark:text-zinc-400 space-y-4">
              <BookOpen size={48} className="text-zinc-400 dark:text-zinc-500" strokeWidth={1} />
              <h2 className="text-lg font-medium text-zinc-900 dark:text-white">Docusaurus Integration</h2>
              <p className="max-w-md text-center text-sm">Documentation is auto-generated and hosted on Docusaurus. <br/> <a href="#" className="text-violet-600 dark:text-violet-400 hover:underline">View Live Site</a></p>
            </div>
          </div>
        );
      case 'feedback':
        return (
            <div className="flex flex-col h-full">
                <div className="p-6 border-b border-zinc-200/60 dark:border-zinc-800/60 flex justify-between items-center bg-white dark:bg-zinc-900 z-10">
                    <div>
                        <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">Feedback</h2>
                    </div>
                </div>
                <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 dark:text-zinc-400 space-y-4">
                  <MessageSquare size={48} className="text-zinc-400 dark:text-zinc-500" strokeWidth={1} />
                  <h2 className="text-lg font-medium text-zinc-900 dark:text-white">No New Feedback</h2>
                  <p className="text-sm">No new tickets from Storybook or Docs integration.</p>
                </div>
            </div>
          );
      default:
        return <Dashboard />;
    }
  };

  return (
    <>
      <div className="flex h-screen w-full bg-zinc-100 dark:bg-zinc-950 font-sans text-zinc-900 dark:text-white selection:bg-violet-500/30 transition-colors duration-200">
        <Sidebar 
          currentView={currentView} 
          onChangeView={handleViewChange} 
          user={user} 
          onLogout={onLogout}
          onOpenProjectModal={() => setShowProjectModal(true)}
        />
        
        <div className="flex-1 h-full p-[10px] overflow-hidden flex flex-col">
          <main className="flex-1 h-full w-full rounded-[12px] bg-white dark:bg-zinc-900 overflow-hidden relative border border-zinc-200/50 dark:border-zinc-800/50">
            {renderView()}
          </main>
        </div>
      </div>
      
      {/* Tenant Creation Modal - TODO: Create TenantModal component */}
      {showTenantModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-zinc-900 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4 text-zinc-900 dark:text-white">Create Workspace</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
              Workspace creation UI coming soon. For now, a personal workspace will be created automatically.
            </p>
            <button
              onClick={() => setShowTenantModal(false)}
              className="px-4 py-2 bg-violet-600 text-white rounded-md text-sm font-medium hover:bg-violet-700"
            >
              Close
            </button>
          </div>
        </div>
      )}
      
      {/* Project Creation Modal */}
      {tenantId && (
        <ProjectModal
          isOpen={showProjectModal}
          onClose={() => setShowProjectModal(false)}
          tenantId={tenantId}
          userId={user.userId as Id<"users">}
        />
      )}
    </>
  );
};

const App: React.FC = () => {
  const [themeMode, setThemeMode] = useState<ThemeMode>('system');
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');
  
  // Authentication state
  const [user, setUser] = useState<User | null>(null);
  const [authView, setAuthView] = useState<'login' | 'signup' | null>(null);

  // Check if this is an OAuth callback
  const isOAuthCallback = window.location.pathname.startsWith('/auth/callback/');
  const oauthProvider = isOAuthCallback 
    ? window.location.pathname.split('/').pop() as 'google' | 'github'
    : null;

  // Load saved theme mode on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('themeMode') as ThemeMode | null;
    if (savedTheme && ['light', 'dark', 'system'].includes(savedTheme)) {
      setThemeMode(savedTheme);
    }
  }, []);

  // Apply theme immediately when themeMode changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    // Determine the resolved theme
    let newResolvedTheme: 'light' | 'dark';
    if (themeMode === 'system') {
      newResolvedTheme = mediaQuery.matches ? 'dark' : 'light';
    } else {
      newResolvedTheme = themeMode;
    }
    
    // Update state
    setResolvedTheme(newResolvedTheme);
    
    // Apply to DOM immediately (don't wait for state update)
    if (newResolvedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // Listen for system theme changes (only matters if mode is 'system')
    const handler = () => {
      if (themeMode === 'system') {
        const isDark = mediaQuery.matches;
        setResolvedTheme(isDark ? 'dark' : 'light');
        if (isDark) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
    };
    
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [themeMode]);

  // Check for stored user on mount
  useEffect(() => {
    // Don't check user storage if this is an OAuth callback
    if (isOAuthCallback) return;
    
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        setAuthView(null);
      } catch (e) {
        localStorage.removeItem('user');
      }
    } else {
      setAuthView('login');
    }
  }, [isOAuthCallback]);

  const handleThemeModeChange = (mode: ThemeMode) => {
    setThemeMode(mode);
    localStorage.setItem('themeMode', mode);
  };

  // Authentication handlers
  const handleLoginSuccess = (userData: User) => {
    setUser(userData);
    setAuthView(null);
  };

  const handleSignupSuccess = (userData: User) => {
    setUser(userData);
    setAuthView(null);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    setUser(null);
    setAuthView('login');
  };

  // Handle OAuth callback
  if (isOAuthCallback && oauthProvider) {
    return <OAuthCallback provider={oauthProvider} />;
  }

  // Show auth screens if not logged in
  if (!user) {
    if (authView === 'signup') {
      return <Signup onSignupSuccess={handleSignupSuccess} onSwitchToLogin={() => setAuthView('login')} />;
    }
    return <Login onLoginSuccess={handleLoginSuccess} onSwitchToSignup={() => setAuthView('signup')} />;
  }

  // Get Convex user ID from stored user
  const convexUserId = user.userId as Id<"users">;
  
  return (
    <TenantProvider userId={convexUserId}>
      <ProjectProvider>
        <AppContent 
          user={user} 
          onLogout={handleLogout}
          themeMode={themeMode}
          resolvedTheme={resolvedTheme}
          onThemeModeChange={handleThemeModeChange}
        />
      </ProjectProvider>
    </TenantProvider>
  );
};

export default App;
