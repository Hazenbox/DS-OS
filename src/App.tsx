import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
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
import { ViewState, convexTokenToLegacy, convexComponentToLegacy, convexActivityToLegacy } from './types';
import { BookOpen, MessageSquare, Loader2, Database } from 'lucide-react';

interface User {
  userId: string;
  email: string;
  name?: string;
  image?: string;
  role: string;
}

export type ThemeMode = 'light' | 'dark' | 'system';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewState>('dashboard');
  const [themeMode, setThemeMode] = useState<ThemeMode>('system');
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');
  const [isSeeding, setIsSeeding] = useState(false);
  const [backendAvailable, setBackendAvailable] = useState<boolean | null>(null);
  
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

  // Handle system theme detection and changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const updateResolvedTheme = () => {
      if (themeMode === 'system') {
        setResolvedTheme(mediaQuery.matches ? 'dark' : 'light');
      } else {
        setResolvedTheme(themeMode);
      }
    };

    updateResolvedTheme();

    // Listen for system theme changes
    const handler = () => updateResolvedTheme();
    mediaQuery.addEventListener('change', handler);
    
    return () => mediaQuery.removeEventListener('change', handler);
  }, [themeMode]);

  // Apply theme to document
  useEffect(() => {
    if (resolvedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [resolvedTheme]);

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

  // Convex queries
  const convexTokens = useQuery(api.tokens.list, {});
  const convexComponents = useQuery(api.components.list, {});
  const convexActivity = useQuery(api.activity.list, { limit: 50 });

  // Convex mutations
  const seedData = useMutation(api.seed.seedInitialData);

  // Check backend availability with timeout
  useEffect(() => {
    const timer = setTimeout(() => {
      if (convexTokens === undefined && convexComponents === undefined) {
        setBackendAvailable(false);
      } else {
        setBackendAvailable(true);
      }
    }, 3000); // Wait 3 seconds before assuming backend is unavailable

    return () => clearTimeout(timer);
  }, [convexTokens, convexComponents]);

  // Convert to legacy format for backward compatibility
  const tokens = convexTokens?.map(convexTokenToLegacy) || [];
  const components = convexComponents?.map(convexComponentToLegacy) || [];
  const activity = convexActivity?.map(convexActivityToLegacy) || [];

  // Check if data needs seeding
  const needsSeeding = convexTokens !== undefined && convexTokens.length === 0;

  const handleThemeModeChange = (mode: ThemeMode) => {
    setThemeMode(mode);
    localStorage.setItem('themeMode', mode);
  };

  const handleSeedData = async () => {
    setIsSeeding(true);
    try {
      await seedData();
    } catch (error) {
      console.error('Failed to seed data:', error);
    } finally {
      setIsSeeding(false);
    }
  };

  // Authentication handlers
  const handleLoginSuccess = (userData: User) => {
    setUser(userData);
    setAuthView(null);
  };

  const handleSignupSuccess = (userData: User) => {
    // Email is auto-verified, so directly log the user in
    setUser(userData);
    setAuthView(null);
    // Store user in localStorage
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

  // Loading state - but allow fallback if backend is unavailable
  if (convexTokens === undefined || convexComponents === undefined) {
    if (backendAvailable === false) {
      // Backend is confirmed unavailable, show warning but continue
      return (
        <div className="flex h-screen w-full bg-zinc-50 dark:bg-zinc-950 items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Backend unavailable - using offline mode</p>
          </div>
        </div>
      );
    }
    // Still loading, show loading state
    return (
      <div className="flex h-screen w-full bg-zinc-50 dark:bg-zinc-950 items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Connecting to database...</p>
        </div>
      </div>
    );
  }

  // Empty state - offer to seed
  if (needsSeeding) {
    return (
      <div className="flex h-screen w-full bg-zinc-50 dark:bg-zinc-950 items-center justify-center">
        <div className="flex flex-col items-center gap-6 max-w-md text-center p-8">
          <div className="w-16 h-16 rounded-full bg-violet-500/10 flex items-center justify-center">
            <Database className="w-8 h-8 text-violet-500" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-white mb-2">
              Welcome to DS-OS
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Your database is empty. Would you like to seed it with initial design tokens and components?
            </p>
          </div>
          <button
            onClick={handleSeedData}
            disabled={isSeeding}
            className="px-6 py-2.5 bg-violet-600 text-white rounded-lg font-medium hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSeeding ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Seeding...
              </>
            ) : (
              'Seed Initial Data'
            )}
          </button>
        </div>
      </div>
    );
  }

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard components={components} activity={activity} />;
      case 'tokens':
        return <TokenManager />;
      case 'builder':
        return <ComponentBuilder tokens={tokens} />;
      case 'releases':
        return <ReleaseManager components={components} />;
      case 'settings':
        return <Settings themeMode={themeMode} resolvedTheme={resolvedTheme} onThemeModeChange={handleThemeModeChange} />;
      case 'documentation':
        return (
          <div className="flex flex-col h-full">
            <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-white dark:bg-zinc-900 z-10">
                <div>
                    <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">Documentation</h2>
                </div>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 dark:text-zinc-400 space-y-4 bg-zinc-50 dark:bg-zinc-950">
              <BookOpen size={48} className="text-zinc-400 dark:text-zinc-500" strokeWidth={1} />
              <h2 className="text-lg font-medium text-zinc-900 dark:text-white">Docusaurus Integration</h2>
              <p className="max-w-md text-center text-sm">Documentation is auto-generated and hosted on Docusaurus. <br/> <a href="#" className="text-violet-600 dark:text-violet-400 hover:underline">View Live Site</a></p>
            </div>
          </div>
        );
      case 'feedback':
        return (
            <div className="flex flex-col h-full">
                <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-white dark:bg-zinc-900 z-10">
                    <div>
                        <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">Feedback</h2>
                    </div>
                </div>
                <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 dark:text-zinc-400 space-y-4 bg-zinc-50 dark:bg-zinc-950">
                  <MessageSquare size={48} className="text-zinc-400 dark:text-zinc-500" strokeWidth={1} />
                  <h2 className="text-lg font-medium text-zinc-900 dark:text-white">No New Feedback</h2>
                  <p className="text-sm">No new tickets from Storybook or Docs integration.</p>
                </div>
            </div>
          );
      default:
        return <Dashboard components={components} activity={activity} />;
    }
  };

  return (
    <div className="flex h-screen w-full bg-zinc-100 dark:bg-zinc-950 font-sans text-zinc-900 dark:text-white selection:bg-violet-500/30 transition-colors duration-200">
      <Sidebar currentView={currentView} onChangeView={setCurrentView} user={user} onLogout={handleLogout} />
      
      <div className="flex-1 h-full p-[10px] overflow-hidden flex flex-col">
        {backendAvailable === false && (
          <div className="mb-2 px-4 py-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-sm text-yellow-600 dark:text-yellow-400">
            ⚠️ Backend unavailable - Running in offline mode. Data changes will not be persisted.
          </div>
        )}
        <main className="flex-1 h-full w-full rounded-[12px] bg-white dark:bg-zinc-900 overflow-hidden relative border border-zinc-200/50 dark:border-zinc-800/50">
          {renderView()}
        </main>
      </div>
    </div>
  );
};

export default App;
