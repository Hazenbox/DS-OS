
import React, { useState, useEffect, useRef } from 'react';
import { ViewState } from '../types';
import { Hexagon, ChevronDown, LogOut } from 'lucide-react';

interface User {
  userId: string;
  email: string;
  name?: string;
  role: string;
}

interface SidebarProps {
  currentView: ViewState;
  onChangeView: (view: ViewState) => void;
  user: User | null;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onChangeView, user, onLogout }) => {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };

    if (isUserMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isUserMenuOpen]);

  const navItems: { id: ViewState; label: string }[] = [
    { id: 'dashboard', label: 'Overview' },
    { id: 'tokens', label: 'Tokens' },
    { id: 'builder', label: 'Builder' },
    { id: 'documentation', label: 'Documentation' },
    { id: 'releases', label: 'Release' },
    { id: 'feedback', label: 'Feedback' },
  ];

  return (
    <div className="w-64 h-full flex flex-col bg-zinc-100 dark:bg-zinc-950 flex-shrink-0 transition-colors duration-200">
      <div className="px-4 pt-6 pb-2">
        <div className="flex items-center gap-3 mb-6 px-2">
            <div className="w-8 h-8 bg-bg-inverse text-inverse rounded-lg flex items-center justify-center">
                <Hexagon size={20} fill="currentColor" />
            </div>
            <div>
                <h1 className="font-bold text-sm tracking-tight text-primary">DS-OS</h1>
                <p className="text-xs text-muted">Design System Platform</p>
            </div>
        </div>
      </div>

      <nav className="flex-1 px-4 py-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onChangeView(item.id)}
            className={`w-full h-8 flex items-center gap-3 px-3 rounded-lg text-sm transition-all duration-200 ease-in-out ${
              currentView === item.id
                ? 'bg-black/[0.08] dark:bg-white/[0.05] text-primary font-medium'
                : 'text-muted hover:text-primary hover:bg-black/5 dark:hover:bg-white/[0.05]'
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="p-4 space-y-1">
         <button
            onClick={() => onChangeView('settings')}
            className={`w-full h-8 flex items-center gap-3 px-3 rounded-lg text-sm transition-all duration-200 ease-in-out ${
              currentView === 'settings'
                ? 'bg-black/[0.08] dark:bg-white/[0.05] text-primary font-medium'
                : 'text-muted hover:text-primary hover:bg-black/5 dark:hover:bg-white/[0.05]'
            }`}
          >
            Settings
          </button>
          
          <div className="pt-2 mt-2 border-t border-border">
            {user && (
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="w-full h-8 flex items-center gap-3 px-3 rounded-lg text-sm text-muted hover:text-primary hover:bg-black/5 dark:hover:bg-white/[0.05] transition-all duration-200 ease-in-out"
                >
                  <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center text-white text-[10px] font-bold">
                    {user.email.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex flex-col items-start text-left flex-1 min-w-0">
                    <span className="text-xs font-medium text-primary truncate w-full">
                      {user.email}
                    </span>
                    <span className="text-[10px] text-muted capitalize">{user.role}</span>
                  </div>
                  <ChevronDown size={14} className={`text-primary/70 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`} />
                </button>
                
                {isUserMenuOpen && (
                  <div className="absolute bottom-full left-0 right-0 mb-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg z-50 py-1">
                    <div className="px-3 h-8 flex flex-col justify-center border-b border-zinc-200 dark:border-zinc-700">
                      <div className="text-sm font-medium text-zinc-900 dark:text-white leading-tight">
                        {user.name || user.email.split('@')[0]}
                      </div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate leading-tight">
                        {user.email}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onLogout();
                      }}
                      className="w-full h-8 text-left px-3 text-sm text-zinc-600 dark:text-zinc-400 hover:text-red-500 hover:bg-red-500/10 flex items-center gap-2 transition-all duration-200 ease-in-out"
                    >
                      <LogOut size={14} />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
      </div>
    </div>
  );
};
