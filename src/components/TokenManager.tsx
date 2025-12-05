import React, { useState, useRef } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { TokenType, ConvexToken, convexActivityToLegacy, convexTokenToLegacy } from '../types';
import { Plus, Trash2, Edit2, Save, Upload, Download, History, LayoutGrid, List as ListIcon, Moon, Layers, ChevronDown, Activity, X, Figma } from 'lucide-react';
import { TokenExport } from './TokenExport';
import { FigmaImport } from './FigmaImport';

const TABS: { id: TokenType; label: string }[] = [
    { id: 'color', label: 'Colors' },
    { id: 'typography', label: 'Typography' },
    { id: 'spacing', label: 'Spacing' },
    { id: 'sizing', label: 'Sizing' },
    { id: 'radius', label: 'Shape' },
    { id: 'shadow', label: 'Shadows' },
];

export const TokenManager: React.FC = () => {
    const [activeTab, setActiveTab] = useState<TokenType>('color');
    const [showActivity, setShowActivity] = useState(false);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState('');
    const [density, setDensity] = useState<'1x' | '2x' | '3x'>('1x');
    const [isDarkModePreview, setIsDarkModePreview] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showExportModal, setShowExportModal] = useState(false);
    const [showFigmaImport, setShowFigmaImport] = useState(false);
    const [newToken, setNewToken] = useState({ name: '', value: '', description: '' });

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Convex queries
    const tokens = useQuery(api.tokens.list, {});
    const activityLogs = useQuery(api.activity.list, { limit: 20, targetType: 'token' });

    // Convex mutations
    const createToken = useMutation(api.tokens.create);
    const updateToken = useMutation(api.tokens.update);
    const removeToken = useMutation(api.tokens.remove);
    const bulkImport = useMutation(api.tokens.bulkImport);
    const logActivity = useMutation(api.activity.create);

    // Filter tokens by active tab
    const filteredTokens = (tokens || []).filter(t => t.type === activeTab);
    const activity = (activityLogs || []).map(convexActivityToLegacy);

    const handleEdit = (token: ConvexToken) => {
        setEditingId(token._id);
        setEditValue(token.value);
    };

    const handleSave = async (id: Id<"tokens">) => {
        try {
            await updateToken({ id, value: editValue });
            setEditingId(null);
        } catch (error) {
            console.error('Failed to update token:', error);
        }
    };

    const handleDelete = async (id: Id<"tokens">) => {
        try {
            await removeToken({ id });
        } catch (error) {
            console.error('Failed to delete token:', error);
        }
    };

    const handleAddToken = async () => {
        if (!newToken.name || !newToken.value) return;
        
        try {
            await createToken({
                name: newToken.name,
                value: newToken.value,
                type: activeTab,
                description: newToken.description || undefined,
            });
            setNewToken({ name: '', value: '', description: '' });
            setShowAddModal(false);
        } catch (error) {
            console.error('Failed to create token:', error);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const json = JSON.parse(event.target?.result as string);
                const parsedTokens = flattenTokens(json);
                
                await bulkImport({ 
                    tokens: parsedTokens,
                    clearExisting: false 
                });
            } catch (err) {
                console.error(err);
                alert('Invalid JSON format');
            }
        };
        reader.readAsText(file);
    };

    const flattenTokens = (obj: any, prefix: string = '', type: TokenType = 'unknown'): Array<{
        name: string;
        value: string;
        type: TokenType;
        description?: string;
    }> => {
        const result: Array<{
            name: string;
            value: string;
            type: TokenType;
            description?: string;
        }> = [];
        
        for (const key in obj) {
            const val = obj[key];
            const newKey = prefix ? `${prefix}-${key}` : key;
            
            // Infer type
            let currentType = type;
            const lowerKey = key.toLowerCase();
            if (['color', 'colors'].includes(lowerKey)) currentType = 'color';
            if (['space', 'spacing'].includes(lowerKey)) currentType = 'spacing';
            if (['font', 'typography', 'text'].includes(lowerKey)) currentType = 'typography';
            if (['radius', 'radii'].includes(lowerKey)) currentType = 'radius';
            if (['shadow', 'shadows'].includes(lowerKey)) currentType = 'shadow';
            if (['size', 'sizing'].includes(lowerKey)) currentType = 'sizing';

            if (typeof val === 'string' || typeof val === 'number') {
                 result.push({
                     name: newKey,
                     value: val.toString(),
                     type: currentType
                 });
            } else if (typeof val === 'object') {
                result.push(...flattenTokens(val, newKey, currentType));
            }
        }
        return result;
    };

    const handleDownload = async () => {
        if (!tokens) return;
        
        const exportObj = tokens.reduce((acc, token) => {
            if (!acc[token.type]) acc[token.type] = {};
            acc[token.type][token.name] = token.value;
            return acc;
        }, {} as any);
        
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportObj, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "design-tokens.json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
        
        await logActivity({
            user: 'Current User',
            action: 'download',
            target: 'Tokens exported',
            targetType: 'token',
        });
    };

    const getPreviewStyle = (token: ConvexToken) => {
        let scale = 1;
        if (density === '2x') scale = 1.5;
        if (density === '3x') scale = 2;

        if (token.type === 'color') return { backgroundColor: token.value };
        if (token.type === 'radius') return { borderRadius: token.value };
        if (token.type === 'shadow') return { boxShadow: token.value };
        if (token.type === 'spacing' || token.type === 'sizing') {
            const val = token.value;
            if (val.endsWith('rem') || val.endsWith('px')) {
                 return { width: `calc(${val} * ${scale})` };
            }
            return { width: token.value };
        }
        if (token.type === 'typography') return { fontSize: token.value };
        return {};
    };

    const renderPreview = (token: ConvexToken) => {
        const style = getPreviewStyle(token);
        const containerClass = isDarkModePreview ? 'bg-[#18181b] border-[#27272a]' : 'bg-surface border-border';

        if (token.type === 'color') {
            return <div className={`w-8 h-8 rounded border border-border shadow-sm`} style={style} />;
        }
        if (token.type === 'radius') {
            return <div className={`w-8 h-8 border border-primary ${containerClass}`} style={style} />;
        }
        if (token.type === 'spacing' || token.type === 'sizing') {
             return (
                 <div className="h-4 bg-accent/20 border border-accent/50 rounded flex items-center justify-center text-[10px] text-accent min-w-[20px]" style={style}>
                 </div>
             );
        }
        if (token.type === 'shadow') {
            return <div className={`w-8 h-8 rounded ${containerClass}`} style={style} />;
        }
        if (token.type === 'typography') {
            return <div className={`text-primary truncate ${containerClass} p-1 rounded`} style={style}>Ag</div>;
        }
        return <div className="w-8 h-8 bg-surface border border-border flex items-center justify-center text-[10px] text-muted">?</div>;
    };

    return (
        <div className="flex h-full">
            <div className="flex-1 flex flex-col h-full overflow-hidden">
                <div className="p-6 border-b border-zinc-200/60 dark:border-zinc-800/60 flex justify-between items-center bg-white dark:bg-zinc-900 z-10">
                    <div>
                        <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">Tokens</h2>
                    </div>
                    <div className="flex gap-2">
                         <input 
                            type="file" 
                            accept=".json" 
                            ref={fileInputRef} 
                            className="hidden" 
                            onChange={handleFileUpload} 
                        />
                        <button 
                            onClick={() => setShowFigmaImport(true)}
                            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-white bg-zinc-900 dark:bg-zinc-700 border border-zinc-700 dark:border-zinc-600 rounded hover:bg-zinc-800 dark:hover:bg-zinc-600"
                        >
                            <Figma size={14} /> Figma Variables
                        </button>
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-700/60 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700"
                        >
                            <Upload size={14} /> Import JSON
                        </button>
                        <button 
                            onClick={() => setShowExportModal(true)}
                            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-700/60 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700"
                        >
                            <Download size={14} /> Export
                        </button>
                         <button 
                            onClick={() => setShowActivity(!showActivity)}
                            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium border rounded ${showActivity ? 'bg-violet-600 text-white border-transparent' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200/60 dark:border-zinc-700/60 hover:bg-zinc-200 dark:hover:bg-zinc-700'}`}
                        >
                            <History size={14} /> Activity
                        </button>
                    </div>
                </div>

                {/* Toolbar */}
                <div className="px-6 py-3 border-b border-zinc-200/60 dark:border-zinc-800/60 bg-white dark:bg-zinc-900 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        {/* Density Selector */}
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium uppercase">Density</span>
                            <div className="relative">
                                <select 
                                    className="appearance-none bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-700/60 rounded px-3 py-1 pr-8 text-xs font-medium text-zinc-900 dark:text-white focus:outline-none focus:border-violet-500"
                                    value={density}
                                    onChange={(e) => setDensity(e.target.value as any)}
                                >
                                    <option value="1x">1x (Default)</option>
                                    <option value="2x">2x (Compact)</option>
                                    <option value="3x">3x (Dense)</option>
                                </select>
                                <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                            </div>
                        </div>

                        {/* Dark Mode Toggle for Preview */}
                        <button 
                             onClick={() => setIsDarkModePreview(!isDarkModePreview)}
                             className={`flex items-center gap-2 px-3 py-1 rounded text-xs border ${isDarkModePreview ? 'bg-zinc-800 text-white border-zinc-700' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200/60 dark:border-zinc-700/60'}`}
                        >
                            {isDarkModePreview ? <Moon size={12} /> : <Layers size={12} />}
                            {isDarkModePreview ? 'Dark Preview' : 'Light Preview'}
                        </button>
                    </div>

                    {/* View Toggle */}
                    <div className="flex bg-zinc-100 dark:bg-zinc-800 rounded p-0.5 border border-zinc-200/60 dark:border-zinc-700/60">
                        <button 
                            onClick={() => setViewMode('grid')}
                            className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-white' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'}`}
                        >
                            <LayoutGrid size={14} />
                        </button>
                        <button 
                            onClick={() => setViewMode('list')}
                            className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-white' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'}`}
                        >
                            <ListIcon size={14} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col">
                    <div className="flex gap-1 px-6 border-b border-zinc-200/60 dark:border-zinc-800/60 bg-white dark:bg-zinc-900">
                        {TABS.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                                    activeTab === tab.id 
                                        ? 'border-zinc-900 dark:border-white text-zinc-900 dark:text-white' 
                                        : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex-1 overflow-y-auto p-6">
                        {filteredTokens.length === 0 && (
                            <div className="w-full py-12 text-center text-zinc-500 dark:text-zinc-400 text-sm border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg">
                                No tokens found for {activeTab}. Import a JSON file or add manually.
                            </div>
                        )}

                        {viewMode === 'grid' ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {filteredTokens.map(token => (
                                    <div key={token._id} className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/60 rounded-lg p-3 hover:shadow-sm transition-shadow group">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-3">
                                                {renderPreview(token)}
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-sm text-zinc-900 dark:text-white">{token.name}</span>
                                                    <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono truncate max-w-[120px]" title={token.value}>{token.value}</span>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="pt-2 border-t border-zinc-200/60 dark:border-zinc-800/60 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            {editingId === token._id ? (
                                                 <div className="flex gap-2 w-full">
                                                    <input 
                                                        className="flex-1 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-700/60 text-xs px-1 rounded text-zinc-900 dark:text-white"
                                                        value={editValue}
                                                        onChange={(e) => setEditValue(e.target.value)}
                                                    />
                                                    <button onClick={() => handleSave(token._id)} className="text-green-500 hover:bg-green-50 dark:hover:bg-green-500/10 p-1 rounded"><Save size={12}/></button>
                                                 </div>
                                            ) : (
                                                <>
                                                    <span className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">{token.type}</span>
                                                    <div className="flex gap-1">
                                                        <button onClick={() => handleEdit(token)} className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"><Edit2 size={12}/></button>
                                                        <button onClick={() => handleDelete(token._id)} className="text-zinc-400 hover:text-red-500 p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"><Trash2 size={12}/></button>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                <button 
                                    onClick={() => setShowAddModal(true)}
                                    className="flex flex-col items-center justify-center p-4 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:border-zinc-500 dark:hover:border-zinc-500 transition-colors min-h-[100px]"
                                >
                                    <Plus size={24} className="mb-2 opacity-50" />
                                    <span className="text-xs font-medium">Add {activeTab}</span>
                                </button>
                            </div>
                        ) : (
                            <div className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/60 rounded-lg overflow-hidden">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200/60 dark:border-zinc-800/60">
                                        <tr>
                                            <th className="px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400 w-16">Preview</th>
                                            <th className="px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400">Name</th>
                                            <th className="px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400">Value</th>
                                            <th className="px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                                        {filteredTokens.map(token => (
                                            <tr key={token._id} className="group hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                                                <td className="px-4 py-2">
                                                    {renderPreview(token)}
                                                </td>
                                                <td className="px-4 py-2 font-medium text-zinc-900 dark:text-white">
                                                    {token.name}
                                                </td>
                                                <td className="px-4 py-2 font-mono text-zinc-500 dark:text-zinc-400 text-xs">
                                                     {editingId === token._id ? (
                                                         <div className="flex gap-2">
                                                            <input 
                                                                className="bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-700/60 text-xs px-1 rounded w-full text-zinc-900 dark:text-white"
                                                                value={editValue}
                                                                onChange={(e) => setEditValue(e.target.value)}
                                                            />
                                                            <button onClick={() => handleSave(token._id)} className="text-green-500 hover:bg-green-50 dark:hover:bg-green-500/10 p-1 rounded"><Save size={12}/></button>
                                                         </div>
                                                     ) : token.value}
                                                </td>
                                                <td className="px-4 py-2 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <div className="flex justify-end gap-1">
                                                        <button onClick={() => handleEdit(token)} className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"><Edit2 size={14}/></button>
                                                        <button onClick={() => handleDelete(token._id)} className="text-zinc-400 hover:text-red-500 p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"><Trash2 size={14}/></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Activity Sidebar */}
            {showActivity && (
                <div className="w-80 border-l border-zinc-200/60 dark:border-zinc-800/60 bg-white dark:bg-zinc-900 flex flex-col transition-all">
                    <div className="p-4 border-b border-zinc-200/60 dark:border-zinc-800/60 font-medium text-sm flex items-center gap-2 text-zinc-900 dark:text-white">
                        <Activity size={16} /> Activity Log
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {activity.length === 0 && <p className="text-sm text-zinc-500 dark:text-zinc-400">No activity yet.</p>}
                        {activity.map(log => (
                            <div key={log.id} className="flex gap-3 text-sm">
                                <div className="mt-1 w-2 h-2 rounded-full bg-violet-500 flex-shrink-0" />
                                <div>
                                    <p className="text-zinc-900 dark:text-white font-medium">{log.user}</p>
                                    <p className="text-zinc-500 dark:text-zinc-400">{log.target}</p>
                                    <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1">{new Date(log.timestamp).toLocaleTimeString()}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Add Token Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl w-full max-w-md p-6 border border-zinc-200/60 dark:border-zinc-800/60">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">Add {activeTab} token</h3>
                            <button onClick={() => setShowAddModal(false)} className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-zinc-900 dark:text-white mb-1">Name</label>
                                <input
                                    type="text"
                                    value={newToken.name}
                                    onChange={(e) => setNewToken({ ...newToken, name: e.target.value })}
                                    placeholder="e.g., primary-500"
                                    className="w-full px-3 py-2 border border-zinc-200/60 dark:border-zinc-700/60 rounded-md text-sm bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:border-violet-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-zinc-900 dark:text-white mb-1">Value</label>
                                <input
                                    type="text"
                                    value={newToken.value}
                                    onChange={(e) => setNewToken({ ...newToken, value: e.target.value })}
                                    placeholder={activeTab === 'color' ? '#3b82f6' : '16px'}
                                    className="w-full px-3 py-2 border border-zinc-200/60 dark:border-zinc-700/60 rounded-md text-sm bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:border-violet-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-zinc-900 dark:text-white mb-1">Description (optional)</label>
                                <input
                                    type="text"
                                    value={newToken.description}
                                    onChange={(e) => setNewToken({ ...newToken, description: e.target.value })}
                                    placeholder="Primary brand color"
                                    className="w-full px-3 py-2 border border-zinc-200/60 dark:border-zinc-700/60 rounded-md text-sm bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:border-violet-500"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-6">
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="px-4 py-2 text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAddToken}
                                disabled={!newToken.name || !newToken.value}
                                className="px-4 py-2 text-sm font-medium bg-violet-600 text-white rounded-md hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Add Token
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Export Modal */}
            <TokenExport 
                tokens={(tokens || []).map(convexTokenToLegacy)} 
                isOpen={showExportModal} 
                onClose={() => setShowExportModal(false)} 
            />

            {/* Figma Import Modal */}
            <FigmaImport 
                isOpen={showFigmaImport} 
                onClose={() => setShowFigmaImport(false)} 
            />
        </div>
    );
};
