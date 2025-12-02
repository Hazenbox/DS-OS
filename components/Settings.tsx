
import React from 'react';
import { Moon, Sun } from 'lucide-react';

interface SettingsProps {
    theme: 'light' | 'dark';
    toggleTheme: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ theme, toggleTheme }) => {
    return (
        <div className="flex flex-col h-full">
            <div className="p-6 border-b border-border flex justify-between items-center bg-background z-10">
                <div>
                    <h2 className="text-xl font-semibold text-primary">Settings</h2>
                    <p className="text-sm text-muted">Manage your workspace preferences.</p>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-2xl mx-auto">
                    <div className="bg-[#fafafa] dark:bg-white/5 rounded-lg p-6 flex items-center justify-between">
                        <div>
                            <h3 className="font-medium text-primary">Appearance</h3>
                            <p className="text-sm text-muted">Toggle between light and dark themes.</p>
                        </div>
                        <button 
                            onClick={toggleTheme}
                            className="flex items-center gap-2 px-4 py-2 bg-background border border-border rounded-md text-sm font-medium hover:bg-surface transition-colors text-primary"
                        >
                            {theme === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
                            {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
