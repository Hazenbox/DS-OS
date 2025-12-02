import React, { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Moon, Sun, Database, Key, Github, ExternalLink, Check, Loader2, Trash2 } from 'lucide-react';

interface SettingsProps {
    theme: 'light' | 'dark';
    toggleTheme: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ theme, toggleTheme }) => {
    const [geminiKey, setGeminiKey] = useState('');
    const [showKey, setShowKey] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    // Convex
    const themeSetting = useQuery(api.settings.get, { key: 'theme' });
    const setThemeSetting = useMutation(api.settings.set);

    const handleThemeToggle = async () => {
        toggleTheme();
        const newTheme = theme === 'dark' ? 'light' : 'dark';
        await setThemeSetting({ key: 'theme', value: newTheme });
    };

    const handleSaveApiKey = async () => {
        if (!geminiKey.trim()) return;
        
        setIsSaving(true);
        // In production, you'd want to encrypt this or use a secure vault
        // For now, we're just showing the UI
        localStorage.setItem('GEMINI_API_KEY', geminiKey);
        
        setTimeout(() => {
            setIsSaving(false);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        }, 500);
    };

    return (
        <div className="flex flex-col h-full">
            <div className="p-6 border-b border-border flex justify-between items-center bg-background z-10">
                <div>
                    <h2 className="text-xl font-semibold text-primary">Settings</h2>
                    <p className="text-sm text-muted">Manage your workspace preferences.</p>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-2xl mx-auto space-y-6">
                    
                    {/* Appearance */}
                    <div className="bg-[#fafafa] dark:bg-white/5 rounded-lg p-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-lg bg-background border border-border flex items-center justify-center">
                                    {theme === 'dark' ? <Moon size={20} className="text-primary" /> : <Sun size={20} className="text-primary" />}
                                </div>
                                <div>
                                    <h3 className="font-medium text-primary">Appearance</h3>
                                    <p className="text-sm text-muted">Toggle between light and dark themes.</p>
                                </div>
                            </div>
                            <button 
                                onClick={handleThemeToggle}
                                className="flex items-center gap-2 px-4 py-2 bg-background border border-border rounded-md text-sm font-medium hover:bg-surface transition-colors text-primary"
                            >
                                {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
                            </button>
                        </div>
                    </div>

                    {/* API Keys */}
                    <div className="bg-[#fafafa] dark:bg-white/5 rounded-lg p-6">
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-lg bg-background border border-border flex items-center justify-center flex-shrink-0">
                                <Key size={20} className="text-primary" />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-medium text-primary">Gemini API Key</h3>
                                <p className="text-sm text-muted mb-4">Required for AI-powered component generation.</p>
                                
                                <div className="flex gap-2">
                                    <input
                                        type={showKey ? 'text' : 'password'}
                                        value={geminiKey}
                                        onChange={(e) => setGeminiKey(e.target.value)}
                                        placeholder="Enter your Gemini API key"
                                        className="flex-1 px-3 py-2 bg-background border border-border rounded-md text-sm text-primary focus:outline-none focus:border-accent"
                                    />
                                    <button
                                        onClick={() => setShowKey(!showKey)}
                                        className="px-3 py-2 text-xs font-medium text-muted hover:text-primary border border-border rounded-md"
                                    >
                                        {showKey ? 'Hide' : 'Show'}
                                    </button>
                                    <button
                                        onClick={handleSaveApiKey}
                                        disabled={!geminiKey.trim() || isSaving}
                                        className="px-4 py-2 text-sm font-medium bg-accent text-white rounded-md hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                    >
                                        {isSaving ? (
                                            <Loader2 size={14} className="animate-spin" />
                                        ) : saved ? (
                                            <Check size={14} />
                                        ) : null}
                                        {saved ? 'Saved!' : 'Save'}
                                    </button>
                                </div>
                                
                                <a 
                                    href="https://aistudio.google.com/apikey" 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-xs text-accent hover:underline mt-2"
                                >
                                    Get API key from Google AI Studio <ExternalLink size={12} />
                                </a>
                            </div>
                        </div>
                    </div>

                    {/* Database Status */}
                    <div className="bg-[#fafafa] dark:bg-white/5 rounded-lg p-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-lg bg-background border border-border flex items-center justify-center">
                                    <Database size={20} className="text-primary" />
                                </div>
                                <div>
                                    <h3 className="font-medium text-primary">Database</h3>
                                    <p className="text-sm text-muted">Connected to Convex</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                                <span className="text-sm text-green-600 font-medium">Connected</span>
                            </div>
                        </div>
                    </div>

                    {/* Integrations */}
                    <div className="bg-[#fafafa] dark:bg-white/5 rounded-lg p-6">
                        <h3 className="font-medium text-primary mb-4">Integrations</h3>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between py-3 border-b border-border">
                                <div className="flex items-center gap-3">
                                    <Github size={20} className="text-primary" />
                                    <div>
                                        <p className="text-sm font-medium text-primary">GitHub</p>
                                        <p className="text-xs text-muted">Sync components to repository</p>
                                    </div>
                                </div>
                                <button className="px-3 py-1.5 text-xs font-medium text-primary bg-background border border-border rounded-md hover:bg-surface">
                                    Connect
                                </button>
                            </div>
                            
                            <div className="flex items-center justify-between py-3 border-b border-border">
                                <div className="flex items-center gap-3">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-primary">
                                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                                    </svg>
                                    <div>
                                        <p className="text-sm font-medium text-primary">Figma</p>
                                        <p className="text-xs text-muted">Sync tokens from Figma Variables</p>
                                    </div>
                                </div>
                                <button className="px-3 py-1.5 text-xs font-medium text-primary bg-background border border-border rounded-md hover:bg-surface">
                                    Connect
                                </button>
                            </div>
                            
                            <div className="flex items-center justify-between py-3">
                                <div className="flex items-center gap-3">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-primary">
                                        <path d="M12 2L2 7v10l10 5 10-5V7L12 2zm0 2.18l6.9 3.45L12 11.09 5.1 7.63 12 4.18zM4 8.82l7 3.5v7.36l-7-3.5V8.82zm9 10.86v-7.36l7-3.5v7.36l-7 3.5z"/>
                                    </svg>
                                    <div>
                                        <p className="text-sm font-medium text-primary">NPM</p>
                                        <p className="text-xs text-muted">Publish packages to npm registry</p>
                                    </div>
                                </div>
                                <button className="px-3 py-1.5 text-xs font-medium text-primary bg-background border border-border rounded-md hover:bg-surface">
                                    Connect
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Danger Zone */}
                    <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg p-6">
                        <h3 className="font-medium text-red-600 dark:text-red-400 mb-2">Danger Zone</h3>
                        <p className="text-sm text-red-600/70 dark:text-red-400/70 mb-4">
                            These actions are irreversible. Please proceed with caution.
                        </p>
                        <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-white dark:bg-transparent border border-red-300 dark:border-red-500/30 rounded-md hover:bg-red-50 dark:hover:bg-red-500/10">
                            <Trash2 size={14} />
                            Clear All Data
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
