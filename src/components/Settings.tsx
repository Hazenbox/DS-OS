import React, { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Moon, Sun, Monitor, Database, Key, Github, ExternalLink, Check, Loader2, Trash2, Figma, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { ThemeMode } from '../App';
import { useProject } from '../contexts/ProjectContext';
import { useTenant } from '../contexts/TenantContext';
import { SSOConfig } from './SSOConfig';

interface SettingsProps {
    themeMode: ThemeMode;
    resolvedTheme: 'light' | 'dark';
    onThemeModeChange: (mode: ThemeMode) => void;
}

// Theme Switcher Component (Icon only)
const ThemeSwitcher: React.FC<{
    value: ThemeMode;
    onChange: (mode: ThemeMode) => void;
    resolvedTheme: 'light' | 'dark';
}> = ({ value, onChange, resolvedTheme }) => {
    const options: { mode: ThemeMode; icon: React.ReactNode; label: string }[] = [
        { mode: 'light', icon: <Sun size={16} />, label: 'Light' },
        { mode: 'dark', icon: <Moon size={16} />, label: 'Dark' },
        { mode: 'system', icon: <Monitor size={16} />, label: 'System' },
    ];

    return (
        <div className="flex flex-col gap-3">
            {/* Icon-only Segmented Control */}
            <div className="inline-flex p-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg w-fit">
                {options.map((option) => (
                    <button
                        key={option.mode}
                        onClick={() => onChange(option.mode)}
                        title={option.label}
                        className={`flex items-center justify-center w-9 h-8 rounded-md transition-all duration-200 ${
                            value === option.mode
                                ? 'bg-white dark:bg-zinc-700 shadow-sm text-violet-600 dark:text-violet-400'
                                : 'text-zinc-500 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                        }`}
                    >
                        {option.icon}
                    </button>
                ))}
            </div>
            
            {/* Current theme indicator */}
            {value === 'system' && (
                <p className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                    Using {resolvedTheme} mode (system)
                </p>
            )}
        </div>
    );
};

export const Settings: React.FC<SettingsProps> = ({ themeMode, resolvedTheme, onThemeModeChange }) => {
    const { userId, tenantId, projectId } = useProject();
    const { tenantId: tenantIdFromContext, userId: userIdFromContext } = useTenant();
    
    // Use tenantId and userId from TenantContext (more reliable)
    const effectiveTenantId = tenantIdFromContext || tenantId;
    const effectiveUserId = userIdFromContext || userId;
    
    const [geminiKey, setGeminiKey] = useState('');
    const [showGeminiKey, setShowGeminiKey] = useState(false);
    const [isGeminiSaving, setIsGeminiSaving] = useState(false);
    const [geminiSaved, setGeminiSaved] = useState(false);

    // Figma PAT
    const [figmaPat, setFigmaPat] = useState('');
    const [showFigmaPat, setShowFigmaPat] = useState(false);
    const [isFigmaSaving, setIsFigmaSaving] = useState(false);
    const [figmaSaved, setFigmaSaved] = useState(false);

    // Claude API Key
    const [claudeKey, setClaudeKey] = useState('');
    const [showClaudeKey, setShowClaudeKey] = useState(false);
    const [isClaudeSaving, setIsClaudeSaving] = useState(false);
    const [claudeSaved, setClaudeSaved] = useState(false);

    // Clear data
    const [isClearing, setIsClearing] = useState(false);
    const [showClearConfirm, setShowClearConfirm] = useState(false);

    // Convex - scoped to tenant
    const setThemeSetting = useMutation(api.settings.set);
    const setSetting = useMutation(api.settings.set);
    const figmaPatStatus = useQuery(
        api.figma.getFigmaPatStatus, 
        effectiveTenantId && effectiveUserId 
            ? { tenantId: effectiveTenantId, userId: effectiveUserId } 
            : "skip"
    );
    const claudeKeyStatus = useQuery(
        api.settings.get, 
        effectiveTenantId && effectiveUserId 
            ? { tenantId: effectiveTenantId, userId: effectiveUserId, key: 'claudeApiKey' } 
            : "skip"
    );
    const saveFigmaPat = useMutation(api.figma.setFigmaPat);
    const clearProjectData = useMutation(api.seed.clearProjectData);

    const handleThemeModeChange = async (mode: ThemeMode) => {
        onThemeModeChange(mode);
        // Theme is stored in localStorage, not Convex (per-device preference)
    };

    const handleSaveGeminiKey = async () => {
        if (!geminiKey.trim()) return;
        
        setIsGeminiSaving(true);
        localStorage.setItem('GEMINI_API_KEY', geminiKey);
        
        setTimeout(() => {
            setIsGeminiSaving(false);
            setGeminiSaved(true);
            setTimeout(() => setGeminiSaved(false), 2000);
        }, 500);
    };

    const handleSaveFigmaPat = async () => {
        if (!figmaPat.trim() || !effectiveTenantId || !effectiveUserId) return;
        
        setIsFigmaSaving(true);
        try {
            await saveFigmaPat({ tenantId: effectiveTenantId, userId: effectiveUserId, pat: figmaPat });
            setFigmaSaved(true);
            setFigmaPat(''); // Clear input after saving
            setTimeout(() => setFigmaSaved(false), 2000);
        } catch (error) {
            console.error('Failed to save Figma PAT:', error);
        } finally {
            setIsFigmaSaving(false);
        }
    };

    const handleSaveClaudeKey = async () => {
        if (!claudeKey.trim() || !effectiveTenantId || !effectiveUserId) return;
        
        setIsClaudeSaving(true);
        try {
            await setSetting({ tenantId: effectiveTenantId, userId: effectiveUserId, key: 'claudeApiKey', value: claudeKey });
            setClaudeSaved(true);
            setClaudeKey(''); // Clear input after saving
            setTimeout(() => setClaudeSaved(false), 2000);
        } catch (error) {
            console.error('Failed to save Claude API key:', error);
        } finally {
            setIsClaudeSaving(false);
        }
    };

    const getThemeIcon = () => {
        if (themeMode === 'system') {
            return <Monitor size={20} className="text-violet-500" />;
        }
        return resolvedTheme === 'dark' 
            ? <Moon size={20} className="text-violet-500" /> 
            : <Sun size={20} className="text-amber-500" />;
    };

    return (
        <div className="flex flex-col h-full">
            <div className="h-16 px-6 border-b border-zinc-200/60 dark:border-zinc-800/60 flex justify-between items-center bg-white dark:bg-zinc-900 z-10">
                <div>
                    <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">Settings</h2>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-2xl mx-auto space-y-6">
                    
                    {/* Appearance / Theme */}
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/60 rounded-lg p-6">
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-700/60 flex items-center justify-center flex-shrink-0">
                                {getThemeIcon()}
                                </div>
                            <div className="flex-1">
                                <h3 className="font-medium text-zinc-900 dark:text-white mb-1">Appearance</h3>
                                <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
                                    Choose your preferred theme or sync with your system settings.
                                </p>
                                <ThemeSwitcher 
                                    value={themeMode}
                                    onChange={handleThemeModeChange}
                                    resolvedTheme={resolvedTheme}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Figma PAT */}
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/60 rounded-lg p-6">
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#F24E1E] via-[#A259FF] to-[#1ABCFE] flex items-center justify-center flex-shrink-0">
                                <Figma size={20} className="text-white" />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-medium text-zinc-900 dark:text-white">Figma Personal Access Token</h3>
                                <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
                                    Required for full Figma API extraction (shadows, gradients, auto-layout).
                                </p>
                                
                                {figmaPatStatus?.configured && (
                                    <div className="mb-3 p-2 bg-green-500/10 border border-green-500/20 rounded flex items-center gap-2">
                                        <Check size={14} className="text-green-500" />
                                            <span className="text-xs text-green-600 dark:text-green-400">
                                            Token configured: {figmaPatStatus.masked}
                                        </span>
                                    </div>
                                )}
                                
                                <div className="flex gap-2">
                                    <div className="flex-1 relative">
                                        <input
                                            type={showFigmaPat ? 'text' : 'password'}
                                            value={figmaPat}
                                            onChange={(e) => setFigmaPat(e.target.value)}
                                            placeholder={figmaPatStatus?.configured ? 'Enter new token to replace' : 'figd_xxxxxxxxxxxxx'}
                                            className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-700/60 rounded-md text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-violet-500 pr-10"
                                        />
                                        <button
                                            onClick={() => setShowFigmaPat(!showFigmaPat)}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                                        >
                                            {showFigmaPat ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                    <button
                                        onClick={handleSaveFigmaPat}
                                        disabled={!figmaPat.trim() || isFigmaSaving}
                                        className="px-4 py-2 text-sm font-medium bg-violet-600 text-white rounded-md hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 min-w-[80px] justify-center"
                                    >
                                        {isFigmaSaving ? (
                                            <Loader2 size={14} className="animate-spin" />
                                        ) : figmaSaved ? (
                                            <Check size={14} />
                                        ) : null}
                                        {figmaSaved ? 'Saved!' : 'Save'}
                                    </button>
                                </div>
                                
                                <div className="mt-3 space-y-2">
                                    <a 
                                        href="https://www.figma.com/developers/api#access-tokens" 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-xs text-violet-600 dark:text-violet-400 hover:underline"
                                    >
                                        Get your Personal Access Token <ExternalLink size={12} />
                                    </a>
                                    
                                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded">
                                        <div className="flex gap-2">
                                            <AlertCircle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
                                            <div className="text-xs text-amber-600 dark:text-amber-400">
                                                <p className="font-medium mb-1">Required Scopes:</p>
                                                <ul className="list-disc list-inside space-y-0.5">
                                                    <li>File content (read-only)</li>
                                                    <li>File metadata (read-only)</li>
                                                </ul>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Claude API Key (for Component Builder) */}
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/60 rounded-lg p-6">
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center flex-shrink-0">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                                </svg>
                            </div>
                            <div className="flex-1">
                                <h3 className="font-medium text-zinc-900 dark:text-white">Claude API Key</h3>
                                <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
                                    Required for AI-powered component extraction in the Builder tab.
                                </p>
                                
                                {claudeKeyStatus && (
                                    <div className="mb-3 p-2 bg-green-500/10 border border-green-500/20 rounded flex items-center gap-2">
                                        <Check size={14} className="text-green-500" />
                                        <span className="text-xs text-green-600 dark:text-green-400">
                                            API Key configured
                                        </span>
                                    </div>
                                )}
                                
                                <div className="flex gap-2">
                                    <div className="flex-1 relative">
                                        <input
                                            type={showClaudeKey ? 'text' : 'password'}
                                            value={claudeKey}
                                            onChange={(e) => setClaudeKey(e.target.value)}
                                            placeholder={claudeKeyStatus ? 'Enter new key to replace' : 'sk-ant-xxxxxxxxxxxxx'}
                                            className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-700/60 rounded-md text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-violet-500 pr-10"
                                        />
                                        <button
                                            onClick={() => setShowClaudeKey(!showClaudeKey)}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                                        >
                                            {showClaudeKey ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                    <button
                                        onClick={handleSaveClaudeKey}
                                        disabled={!claudeKey.trim() || isClaudeSaving}
                                        className="px-4 py-2 text-sm font-medium bg-violet-600 text-white rounded-md hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 min-w-[80px] justify-center"
                                    >
                                        {isClaudeSaving ? (
                                            <Loader2 size={14} className="animate-spin" />
                                        ) : claudeSaved ? (
                                            <Check size={14} />
                                        ) : null}
                                        {claudeSaved ? 'Saved!' : 'Save'}
                                    </button>
                                </div>
                                
                                <a 
                                    href="https://console.anthropic.com/settings/keys" 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-xs text-violet-600 dark:text-violet-400 hover:underline mt-2"
                                >
                                    Get API key from Anthropic Console <ExternalLink size={12} />
                                </a>
                            </div>
                        </div>
                    </div>

                    {/* Gemini API Key */}
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/60 rounded-lg p-6">
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-700/60 flex items-center justify-center flex-shrink-0">
                                <Key size={20} className="text-zinc-700 dark:text-zinc-300" />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-medium text-zinc-900 dark:text-white">Gemini API Key</h3>
                                <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">Optional - for alternative AI-powered generation.</p>
                                
                                <div className="flex gap-2">
                                    <div className="flex-1 relative">
                                        <input
                                            type={showGeminiKey ? 'text' : 'password'}
                                            value={geminiKey}
                                            onChange={(e) => setGeminiKey(e.target.value)}
                                            placeholder="Enter your Gemini API key"
                                            className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-700/60 rounded-md text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-violet-500 pr-10"
                                        />
                                        <button
                                            onClick={() => setShowGeminiKey(!showGeminiKey)}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                                        >
                                            {showGeminiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                    <button
                                        onClick={handleSaveGeminiKey}
                                        disabled={!geminiKey.trim() || isGeminiSaving}
                                        className="px-4 py-2 text-sm font-medium bg-violet-600 text-white rounded-md hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 min-w-[80px] justify-center"
                                    >
                                        {isGeminiSaving ? (
                                            <Loader2 size={14} className="animate-spin" />
                                        ) : geminiSaved ? (
                                            <Check size={14} />
                                        ) : null}
                                        {geminiSaved ? 'Saved!' : 'Save'}
                                    </button>
                                </div>
                                
                                <a 
                                    href="https://aistudio.google.com/apikey" 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-xs text-violet-600 dark:text-violet-400 hover:underline mt-2"
                                >
                                    Get API key from Google AI Studio <ExternalLink size={12} />
                                </a>
                            </div>
                        </div>
                    </div>

                    {/* SSO Configuration */}
                    {effectiveTenantId && effectiveUserId && (
                        <SSOConfig 
                            tenantId={effectiveTenantId} 
                            userId={effectiveUserId} 
                        />
                    )}

                    {/* Database Status */}
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/60 rounded-lg p-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-700/60 flex items-center justify-center">
                                    <Database size={20} className="text-zinc-700 dark:text-zinc-300" />
                                </div>
                                <div>
                                    <h3 className="font-medium text-zinc-900 dark:text-white">Database</h3>
                                    <p className="text-sm text-zinc-500 dark:text-zinc-400">Connected to Convex</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                                <span className="text-sm text-green-600 dark:text-green-400 font-medium">Connected</span>
                            </div>
                        </div>
                    </div>

                    {/* Integrations */}
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/60 rounded-lg p-6">
                        <h3 className="font-medium text-zinc-900 dark:text-white mb-4">Integrations</h3>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between py-3 border-b border-zinc-200/60 dark:border-zinc-800/60">
                                <div className="flex items-center gap-3">
                                    <Github size={20} className="text-zinc-700 dark:text-zinc-300" />
                                    <div>
                                        <p className="text-sm font-medium text-zinc-900 dark:text-white">GitHub</p>
                                        <p className="text-xs text-zinc-500 dark:text-zinc-400">Sync components to repository</p>
                                    </div>
                                </div>
                                <button className="px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-700/60 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700">
                                    Connect
                                </button>
                            </div>
                            
                            <div className="flex items-center justify-between py-3 border-b border-zinc-200/60 dark:border-zinc-800/60">
                                <div className="flex items-center gap-3">
                                    <Figma size={20} className="text-zinc-700 dark:text-zinc-300" />
                                    <div>
                                        <p className="text-sm font-medium text-zinc-900 dark:text-white">Figma API</p>
                                        <p className="text-xs text-zinc-500 dark:text-zinc-400">Full component extraction</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {figmaPatStatus?.configured ? (
                                        <>
                                            <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                            <span className="text-xs text-green-600 dark:text-green-400">Connected</span>
                                        </>
                                    ) : (
                                        <>
                                            <div className="w-2 h-2 rounded-full bg-zinc-400 dark:bg-zinc-600"></div>
                                            <span className="text-xs text-zinc-500 dark:text-zinc-400">Not configured</span>
                                        </>
                                    )}
                                </div>
                            </div>
                            
                            <div className="flex items-center justify-between py-3">
                                <div className="flex items-center gap-3">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-zinc-700 dark:text-zinc-300">
                                        <path d="M12 2L2 7v10l10 5 10-5V7L12 2zm0 2.18l6.9 3.45L12 11.09 5.1 7.63 12 4.18zM4 8.82l7 3.5v7.36l-7-3.5V8.82zm9 10.86v-7.36l7-3.5v7.36l-7 3.5z"/>
                                    </svg>
                                    <div>
                                        <p className="text-sm font-medium text-zinc-900 dark:text-white">NPM</p>
                                        <p className="text-xs text-zinc-500 dark:text-zinc-400">Publish packages to npm registry</p>
                                    </div>
                                </div>
                                <button className="px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-700/60 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700">
                                    Connect
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Danger Zone */}
                    <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg p-6">
                        <h3 className="font-medium text-red-600 dark:text-red-400 mb-2">Danger Zone</h3>
                        <p className="text-sm text-red-600/70 dark:text-red-400/70 mb-4">
                            These actions are irreversible. Please proceed with caution.
                        </p>
                        
                        {!showClearConfirm ? (
                            <button 
                                onClick={() => setShowClearConfirm(true)}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-white dark:bg-transparent border border-red-300 dark:border-red-500/30 rounded-md hover:bg-red-50 dark:hover:bg-red-500/10"
                            >
                            <Trash2 size={14} />
                            Clear All Data
                        </button>
                        ) : (
                            <div className="space-y-3">
                                <p className="text-sm text-red-600 dark:text-red-400 font-medium">
                                    Are you sure? This will delete all tokens, components, releases, and activity for this project.
                                </p>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={async () => {
                                            if (!projectId) return;
                                            setIsClearing(true);
                                            try {
                                                if (effectiveTenantId && effectiveUserId) {
                                                    await clearProjectData({ projectId, tenantId: effectiveTenantId, userId: effectiveUserId });
                                                }
                                                setShowClearConfirm(false);
                                            } catch (error) {
                                                console.error('Failed to clear data:', error);
                                            } finally {
                                                setIsClearing(false);
                                            }
                                        }}
                                        disabled={isClearing || !projectId}
                                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
                                    >
                                        {isClearing ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                        {isClearing ? 'Clearing...' : 'Yes, Clear Project Data'}
                                    </button>
                                    <button 
                                        onClick={() => setShowClearConfirm(false)}
                                        className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
