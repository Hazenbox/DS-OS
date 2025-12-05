import React, { useState, useEffect } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { TokenManager } from './components/TokenManager';
import { ComponentBuilder } from './components/ComponentBuilder';
import { ReleaseManager } from './components/ReleaseManager';
import { Settings } from './components/Settings';
import { Login } from './components/Login';
import { Signup } from './components/Signup';
import { OAuthCallback } from './components/OAuthCallback';
import { ProjectProvider, useProject } from './contexts/ProjectContext';
import { ViewState } from './types';
import { BookOpen, MessageSquare, Loader2, FolderOpen } from 'lucide-react';

interface User {
  userId: string;
  email: string;
  name?: string;
  image?: string;
  role: string;
}

export type ThemeMode = 'light' | 'dark' | 'system';

// Inner app component that uses project context
const AppContent: React.FC<{
  user: User;
  onLogout: () => void;
  themeMode: ThemeMode;
  resolvedTheme: 'light' | 'dark';
  onThemeModeChange: (mode: ThemeMode) => void;
}> = ({ user, onLogout, themeMode, resolvedTheme, onThemeModeChange }) => {
  const [currentView, setCurrentView] = useState<ViewState>('dashboard');
  const { activeProject, projectId, isLoading } = useProject();

  const renderView = () => {
    // Show "no project" state if no active project
    if (!projectId && !isLoading) {
      return (
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-zinc-200/60 dark:border-zinc-800/60 flex justify-between items-center bg-white dark:bg-zinc-900 z-10">
            <div>
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">
                {currentView === 'settings' ? 'Settings' : 'No Project Selected'}
              </h2>
            </div>
          </div>
          {currentView === 'settings' ? (
            <Settings themeMode={themeMode} resolvedTheme={resolvedTheme} onThemeModeChange={onThemeModeChange} />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 dark:text-zinc-400 space-y-4">
              <FolderOpen size={48} className="text-zinc-400 dark:text-zinc-500" strokeWidth={1} />
              <h2 className="text-lg font-medium text-zinc-900 dark:text-white">Create a Project</h2>
              <p className="max-w-md text-center text-sm">
                Select or create a project from the dropdown in the sidebar to get started.
              </p>
            </div>
          )}
        </div>
      );
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
    <div className="flex h-screen w-full bg-zinc-100 dark:bg-zinc-950 font-sans text-zinc-900 dark:text-white selection:bg-violet-500/30 transition-colors duration-200">
      <Sidebar currentView={currentView} onChangeView={setCurrentView} user={user} onLogout={onLogout} />
      
      <div className="flex-1 h-full p-[10px] overflow-hidden flex flex-col">
        <main className="flex-1 h-full w-full rounded-[12px] bg-white dark:bg-zinc-900 overflow-hidden relative border border-zinc-200/50 dark:border-zinc-800/50">
          {renderView()}
        </main>
      </div>
    </div>
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

  return (
    <ProjectProvider userId={user.email}>
      <AppContent 
        user={user} 
        onLogout={handleLogout}
        themeMode={themeMode}
        resolvedTheme={resolvedTheme}
        onThemeModeChange={handleThemeModeChange}
      />
    </ProjectProvider>
  );
};

export default App;
