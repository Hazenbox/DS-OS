import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { TokenManager } from './components/TokenManager';
import { ComponentBuilder } from './components/ComponentBuilder';
import { ReleaseManager } from './components/ReleaseManager';
import { Settings } from './components/Settings';
import { ViewState, Token, ComponentItem, TokenActivity } from './types';
import { BookOpen, MessageSquare } from 'lucide-react';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewState>('dashboard');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };
  
  // Initial Mock Data
  const [tokens, setTokens] = useState<Token[]>([
    { id: '1', name: 'primary', value: '#3b82f6', type: 'color' },
    { id: '2', name: 'surface', value: '#18181b', type: 'color' },
    { id: '3', name: 'text-base', value: '16px', type: 'typography' },
    { id: '4', name: 'spacing-4', value: '1rem', type: 'spacing' },
    { id: '5', name: 'radius-md', value: '0.375rem', type: 'radius' },
    { id: '6', name: 'shadow-sm', value: '0 1px 2px 0 rgb(0 0 0 / 0.05)', type: 'shadow' },
  ]);
  
  const [tokenActivity, setTokenActivity] = useState<TokenActivity[]>([
      { id: '1', user: 'System', action: 'create', target: 'Initial Tokens', timestamp: new Date().toISOString() }
  ]);

  const [components, setComponents] = useState<ComponentItem[]>([
    { 
        id: '1', 
        name: 'Button', 
        status: 'stable', 
        version: '1.2.0', 
        code: `export const Button = ({ children, variant = 'primary' }) => (\n  <button className="px-4 py-2 rounded bg-blue-500 text-white">\n    {children}\n  </button>\n);`, 
        docs: '# Button\n\nPrimary UI component for user interaction.' 
    },
    { 
        id: '2', 
        name: 'Input', 
        status: 'review', 
        version: '0.9.0', 
        code: `export const Input = (props) => (\n  <input {...props} className="border border-zinc-700 bg-transparent p-2 rounded" />\n);`, 
        docs: '# Input\n\nBasic text input field.' 
    },
  ]);

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard components={components} />;
      case 'tokens':
        return <TokenManager tokens={tokens} setTokens={setTokens} activity={tokenActivity} setActivity={setTokenActivity} />;
      case 'builder':
        return <ComponentBuilder components={components} setComponents={setComponents} tokens={tokens} />;
      case 'releases':
        return <ReleaseManager components={components} />;
      case 'settings':
        return <Settings theme={theme} toggleTheme={toggleTheme} />;
      case 'documentation':
        return (
          <div className="flex flex-col h-full">
            <div className="p-6 border-b border-border flex justify-between items-center bg-background z-10">
                <div>
                    <h2 className="text-xl font-semibold text-primary">Documentation</h2>
                    <p className="text-sm text-muted">External documentation hub.</p>
                </div>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center text-muted space-y-4">
              <BookOpen size={48} className="text-muted" strokeWidth={1} />
              <h2 className="text-lg font-medium text-primary">Docusaurus Integration</h2>
              <p className="max-w-md text-center text-sm">Documentation is auto-generated and hosted on Docusaurus. <br/> <a href="#" className="text-accent hover:underline">View Live Site</a></p>
            </div>
          </div>
        );
      case 'feedback':
        return (
            <div className="flex flex-col h-full">
                <div className="p-6 border-b border-border flex justify-between items-center bg-background z-10">
                    <div>
                        <h2 className="text-xl font-semibold text-primary">Feedback</h2>
                        <p className="text-sm text-muted">User feedback from connected apps.</p>
                    </div>
                </div>
                <div className="flex-1 flex flex-col items-center justify-center text-muted space-y-4">
                  <MessageSquare size={48} className="text-muted" strokeWidth={1} />
                  <h2 className="text-lg font-medium text-primary">No New Feedback</h2>
                  <p className="text-sm">No new tickets from Storybook or Docs integration.</p>
                </div>
            </div>
          );
      default:
        return <Dashboard components={components} />;
    }
  };

  return (
    <div className="flex h-screen w-full bg-[#fafafa] dark:bg-[#000000] font-sans text-primary selection:bg-accent/30 transition-colors duration-200">
      <Sidebar currentView={currentView} onChangeView={setCurrentView} />
      
      <div className="flex-1 h-full p-[10px] overflow-hidden">
        <main className="h-full w-full rounded-[12px] bg-background shadow-sm overflow-hidden relative border border-border">
          {renderView()}
        </main>
      </div>
    </div>
  );
};

export default App;