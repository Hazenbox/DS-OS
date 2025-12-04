
import React, { useState, useEffect, useRef } from 'react';
import { ViewState } from '../types';
import { Hexagon, ChevronDown, Plus, LogOut, User } from 'lucide-react';

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
  const [isProjectMenuOpen, setIsProjectMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const projectMenuRef = useRef<HTMLDivElement>(null);

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

  // Close project menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (projectMenuRef.current && !projectMenuRef.current.contains(event.target as Node)) {
        setIsProjectMenuOpen(false);
      }
    };

    if (isProjectMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isProjectMenuOpen]);

  const navItems: { id: ViewState; label: string }[] = [
    { id: 'dashboard', label: 'Overview' },
    { id: 'tokens', label: 'Tokens' },
    { id: 'builder', label: 'Builder' },
    { id: 'documentation', label: 'Documentation' },
    { id: 'releases', label: 'Release' },
    { id: 'feedback', label: 'Feedback' },
  ];

  return (
    <div className="w-64 h-full flex flex-col bg-[#fafafa] dark:bg-[#18181b] flex-shrink-0 transition-colors duration-200">
      <div className="px-4 pt-6 pb-2">
        <div className="flex items-center gap-3 mb-6 px-2">
            <div className="w-8 h-8 bg-bg-inverse text-inverse rounded-lg flex items-center justify-center">
                <Hexagon size={20} fill="currentColor" />
            </div>
            <div>
                <h1 className="font-bold text-sm tracking-tight text-primary">Orbit</h1>
                <p className="text-xs text-muted">Design System OS</p>
            </div>
        </div>

        <div className="relative" ref={projectMenuRef}>
            <button 
                onClick={() => setIsProjectMenuOpen(!isProjectMenuOpen)}
                className="w-full h-8 flex items-center justify-between px-3 text-sm font-medium text-primary bg-black/[0.08] dark:bg-white/[0.05] rounded-lg border border-transparent dark:border-white/10 transition-all duration-200 ease-in-out hover:bg-black/10 dark:hover:bg-white/[0.08]"
            >
                <span>Orbit Design System</span>
                <ChevronDown size={14} className={`text-primary/70 transition-transform ${isProjectMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            
            {isProjectMenuOpen && (
                <div className="absolute top-full left-0 w-full mt-1 bg-background border border-border rounded-lg shadow-lg z-50 py-1">
                    <div className="px-3 h-8 flex items-center text-xs font-semibold text-muted uppercase tracking-wider">Projects</div>
                    <button className="w-full h-8 text-left px-3 text-sm text-primary hover:bg-surface flex items-center gap-2 transition-all duration-200 ease-in-out">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        Orbit DS (Active)
                    </button>
                    <button className="w-full h-8 text-left px-3 text-sm text-muted hover:text-primary hover:bg-surface flex items-center gap-2 transition-all duration-200 ease-in-out">
                        <div className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600"></div>
                        Marketing Site
                    </button>
                    <div className="h-px bg-border my-1"></div>
                    <button className="w-full h-8 text-left px-3 text-sm text-accent hover:bg-surface flex items-center gap-2 transition-all duration-200 ease-in-out">
                        <Plus size={14} /> Create Project
                    </button>
                </div>
            )}
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
                  <div className="absolute bottom-full left-0 right-0 mb-1 bg-background border border-border rounded-lg shadow-lg z-50 py-1">
                    <div className="px-3 h-8 flex flex-col justify-center border-b border-border">
                      <div className="text-sm font-medium text-primary leading-tight">
                        {user.name || 'Upen'}
                      </div>
                      <div className="text-xs text-muted truncate leading-tight">
                        {user.email}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onLogout();
                      }}
                      className="w-full h-8 text-left px-3 text-sm text-muted hover:text-red-500 hover:bg-red-500/10 dark:hover:bg-red-500/10 flex items-center gap-2 transition-all duration-200 ease-in-out"
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
