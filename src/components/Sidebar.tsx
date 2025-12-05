import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { ViewState } from '../types';
import { Hexagon, ChevronDown, LogOut, Plus, Check, Loader2, FolderOpen } from 'lucide-react';
import { Id } from '../../convex/_generated/dataModel';

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
  const [isCreating, setIsCreating] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const userMenuRef = useRef<HTMLDivElement>(null);
  const projectMenuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Convex queries and mutations
  const projects = useQuery(api.projects.list) || [];
  const activeProject = useQuery(api.projects.getActive);
  const createProject = useMutation(api.projects.create);
  const setActiveProject = useMutation(api.projects.setActive);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
      if (projectMenuRef.current && !projectMenuRef.current.contains(event.target as Node)) {
        setIsProjectMenuOpen(false);
        setIsCreating(false);
        setNewProjectName('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus input when creating
  useEffect(() => {
    if (isCreating && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isCreating]);

  const handleCreateProject = async () => {
    if (!newProjectName.trim() || isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      await createProject({ 
        name: newProjectName.trim(),
        userEmail: user?.email 
      });
      setNewProjectName('');
      setIsCreating(false);
    } catch (error) {
      console.error('Failed to create project:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectProject = async (projectId: Id<"projects">) => {
    try {
      await setActiveProject({ id: projectId });
      setIsProjectMenuOpen(false);
    } catch (error) {
      console.error('Failed to switch project:', error);
    }
  };

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

        {/* Project Dropdown */}
        <div className="relative" ref={projectMenuRef}>
          <button 
            onClick={() => setIsProjectMenuOpen(!isProjectMenuOpen)}
            className="w-full h-8 flex items-center justify-between px-3 text-sm font-medium text-primary bg-black/[0.08] dark:bg-white/[0.05] rounded-lg border border-transparent dark:border-white/10 transition-all duration-200 ease-in-out hover:bg-black/10 dark:hover:bg-white/[0.08]"
          >
            <span className="truncate">
              {activeProject?.name || 'Select Project'}
            </span>
            <ChevronDown size={14} className={`text-primary/70 transition-transform flex-shrink-0 ${isProjectMenuOpen ? 'rotate-180' : ''}`} />
          </button>
          
          {isProjectMenuOpen && (
            <div className="absolute top-full left-0 w-full mt-1 bg-white dark:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-700/60 rounded-lg shadow-lg z-50 py-1 max-h-64 overflow-y-auto">
              <div className="px-3 py-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Projects
              </div>
              
              {projects.length === 0 && !isCreating && (
                <div className="px-3 py-4 text-center">
                  <FolderOpen size={24} className="mx-auto mb-2 text-zinc-400 dark:text-zinc-500" />
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">No projects yet</p>
                </div>
              )}
              
              {projects.map((project) => (
                <button 
                  key={project._id}
                  onClick={() => handleSelectProject(project._id)}
                  className="w-full text-left px-3 py-2 text-sm text-zinc-900 dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center gap-2 transition-all duration-200 ease-in-out"
                >
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${project.isActive ? 'bg-green-500' : 'bg-zinc-300 dark:bg-zinc-600'}`} />
                  <span className="truncate flex-1">{project.name}</span>
                  {project.isActive && <Check size={14} className="text-green-500 flex-shrink-0" />}
                </button>
              ))}
              
              <div className="h-px bg-zinc-200/60 dark:bg-zinc-700/60 my-1" />
              
              {isCreating ? (
                <div className="px-3 py-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateProject();
                      if (e.key === 'Escape') {
                        setIsCreating(false);
                        setNewProjectName('');
                      }
                    }}
                    placeholder="Project name..."
                    className="w-full px-2 py-1.5 text-sm bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-700/60 rounded text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-violet-500"
                    disabled={isSubmitting}
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={handleCreateProject}
                      disabled={!newProjectName.trim() || isSubmitting}
                      className="flex-1 px-2 py-1 text-xs font-medium text-white bg-violet-600 rounded hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                    >
                      {isSubmitting ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                      Create
                    </button>
                    <button
                      onClick={() => {
                        setIsCreating(false);
                        setNewProjectName('');
                      }}
                      className="px-2 py-1 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button 
                  onClick={() => setIsCreating(true)}
                  className="w-full text-left px-3 py-2 text-sm text-violet-600 dark:text-violet-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center gap-2 transition-all duration-200 ease-in-out"
                >
                  <Plus size={14} /> Create Project
                </button>
              )}
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
                  <div className="absolute bottom-full left-0 right-0 mb-1 bg-white dark:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-700/60 rounded-lg shadow-lg z-50 py-1">
                    <div className="px-3 h-8 flex flex-col justify-center border-b border-zinc-200/60 dark:border-zinc-700/60">
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
