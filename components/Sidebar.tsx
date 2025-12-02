
import React, { useState } from 'react';
import { ViewState } from '../types';
import { Hexagon, ChevronDown, Plus } from 'lucide-react';

interface SidebarProps {
  currentView: ViewState;
  onChangeView: (view: ViewState) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onChangeView }) => {
  const [isProjectMenuOpen, setIsProjectMenuOpen] = useState(false);

  const navItems: { id: ViewState; label: string }[] = [
    { id: 'dashboard', label: 'Overview' },
    { id: 'tokens', label: 'Tokens' },
    { id: 'builder', label: 'Builder' },
    { id: 'documentation', label: 'Documentation' },
    { id: 'releases', label: 'Release' },
    { id: 'feedback', label: 'Feedback' },
  ];

  return (
    <div className="w-64 h-full flex flex-col bg-[#fafafa] dark:bg-[#000000] flex-shrink-0 transition-colors duration-200 border-r border-transparent dark:border-white/5">
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

        <div className="relative">
            <button 
                onClick={() => setIsProjectMenuOpen(!isProjectMenuOpen)}
                className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-primary bg-black/[0.08] dark:bg-white/[0.08] rounded-lg border border-transparent transition-all"
            >
                <span>Orbit Design System</span>
                <ChevronDown size={14} className="text-primary/70" />
            </button>
            
            {isProjectMenuOpen && (
                <div className="absolute top-full left-0 w-full mt-1 bg-white dark:bg-[#18181b] border border-border/50 rounded-lg shadow-lg z-50 py-1">
                    <div className="px-3 py-2 text-xs font-semibold text-muted uppercase tracking-wider">Projects</div>
                    <button className="w-full text-left px-3 py-2 text-sm text-primary hover:bg-surface flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        Orbit DS (Active)
                    </button>
                    <button className="w-full text-left px-3 py-2 text-sm text-muted hover:text-primary hover:bg-surface flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600"></div>
                        Marketing Site
                    </button>
                    <div className="h-px bg-[#0d0d0d]/5 dark:bg-white/5 my-1"></div>
                    <button className="w-full text-left px-3 py-2 text-sm text-accent hover:bg-surface flex items-center gap-2">
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
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
              currentView === item.id
                ? 'bg-black/[0.08] dark:bg-white/[0.08] text-primary font-medium'
                : 'text-muted hover:text-primary hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="p-4 space-y-1">
         <button
            onClick={() => onChangeView('settings')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
              currentView === 'settings'
                ? 'bg-black/[0.08] dark:bg-white/[0.08] text-primary font-medium'
                : 'text-muted hover:text-primary hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            Settings
          </button>
          
          <div className="pt-2 mt-2 border-t border-[#0d0d0d]/5 dark:border-white/[0.03]">
            <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted hover:text-primary hover:bg-black/5 dark:hover:bg-white/5 transition-all duration-200">
                <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center text-white text-[10px] font-bold">
                    JD
                </div>
                <div className="flex flex-col items-start text-left">
                    <span className="text-xs font-medium text-primary">John Doe</span>
                    <span className="text-[10px]">Admin</span>
                </div>
            </button>
          </div>
      </div>
    </div>
  );
};
