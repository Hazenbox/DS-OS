import React, { useState, useRef } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { TokenType, ConvexToken, convexTokenToLegacy } from '../types';
import { Plus, Trash2, Edit2, Save, Upload, Download, LayoutGrid, List as ListIcon, X, Figma, FileJson, Check, ToggleLeft, ToggleRight, MoreVertical, Pencil, AlertCircle, Eye } from 'lucide-react';
import { TokenExport } from './TokenExport';
import { FigmaImport } from './FigmaImport';
import { useProject } from '../contexts/ProjectContext';

const TABS: { id: TokenType | 'all'; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'color', label: 'Colors' },
    { id: 'typography', label: 'Typography' },
    { id: 'spacing', label: 'Spacing' },
    { id: 'sizing', label: 'Sizing' },
    { id: 'radius', label: 'Shape' },
    { id: 'shadow', label: 'Shadows' },
    { id: 'unknown', label: 'Other' },
];

// File type from Convex
interface TokenFile {
    _id: Id<"tokenFiles">;
    _creationTime: number;
    name: string;
    originalName: string;
    tokenCount: number;
    isActive: boolean;
    uploadedAt: number;
    uploadedBy: string;
}

// Parsed token for preview
interface ParsedToken {
    name: string;
    value: string;
    type: TokenType;
    description?: string;
}

// ============================================================================
// TOKEN PARSING UTILITIES
// ============================================================================

// Detect if a string value looks like a color
const isColorValue = (value: string): boolean => {
    const v = value.trim();
    // Hex colors
    if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(v)) return true;
    // RGB/RGBA
    if (/^rgba?\s*\(/i.test(v)) return true;
    // HSL/HSLA
    if (/^hsla?\s*\(/i.test(v)) return true;
    // Named colors (common ones)
    const namedColors = ['transparent', 'currentcolor', 'inherit', 'white', 'black', 'red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink', 'gray', 'grey'];
    if (namedColors.includes(v.toLowerCase())) return true;
    return false;
};

// Detect if a value looks like a shadow
const isShadowValue = (value: string): boolean => {
    const v = value.trim().toLowerCase();
    // Box shadow pattern: offset-x offset-y blur spread color
    if (/^-?\d+(\.\d+)?(px|rem|em)?\s+-?\d+(\.\d+)?(px|rem|em)?/.test(v)) return true;
    // Multiple shadows
    if (v.includes(',') && /\d+px/.test(v)) return true;
    // Contains shadow keywords
    if (v.includes('inset') || /rgba?\s*\(.*\)/.test(v) && /\d+px/.test(v)) return true;
    return false;
};

// Detect if a value looks like a size/spacing value
const isSizeValue = (value: string): boolean => {
    const v = value.trim();
    // Numeric with units
    if (/^-?\d+(\.\d+)?(px|rem|em|%|vh|vw|pt|cm|mm|in)$/.test(v)) return true;
    // Just a number (could be pixels or unitless)
    if (/^\d+(\.\d+)?$/.test(v)) return true;
    return false;
};

// Detect if a value looks like typography
const isTypographyValue = (value: string): boolean => {
    const v = value.trim().toLowerCase();
    // Font weights
    if (/^(normal|bold|bolder|lighter|\d{3})$/.test(v)) return true;
    // Font families
    if (/^["']?[a-zA-Z\s-]+["']?(,\s*["']?[a-zA-Z\s-]+["']?)*$/.test(v) && !isColorValue(v)) return true;
    // Line heights (typically 1-3)
    if (/^[\d.]+$/.test(v) && parseFloat(v) >= 0.5 && parseFloat(v) <= 3) return true;
    // Letter spacing
    if (/^-?[\d.]+(px|em|rem)?$/.test(v) && v.includes('.')) return true;
    return false;
};

// Detect if a value looks like a border radius
const isRadiusValue = (value: string): boolean => {
    const v = value.trim().toLowerCase();
    // Percentage or pixel values that are typically radius sizes
    if (/^\d+(\.\d+)?(px|rem|em|%)$/.test(v)) {
        const num = parseFloat(v);
        // Radius values are typically 0-50px or 0-50%
        if (v.includes('%') && num <= 100) return true;
        if (num <= 100) return true;
    }
    return false;
};

// Infer token type from the key path
const inferTypeFromKey = (keyPath: string): TokenType | null => {
    const lower = keyPath.toLowerCase();
    
    // Color patterns
    if (/\b(color|colours?|fill|stroke|background|bg|foreground|fg|surface|border-color|text-color|icon-color)\b/.test(lower)) return 'color';
    if (/\b(primary|secondary|tertiary|accent|brand|neutral|success|warning|error|info|danger)\b/.test(lower) && !lower.includes('size') && !lower.includes('space')) return 'color';
    if (/\b(white|black|gray|grey|red|blue|green|yellow|orange|purple|pink|teal|cyan|indigo|violet)\b/.test(lower)) return 'color';
    
    // Shadow patterns
    if (/\b(shadow|elevation|drop-shadow|box-shadow)\b/.test(lower)) return 'shadow';
    
    // Spacing patterns
    if (/\b(space|spacing|gap|margin|padding|inset|gutter)\b/.test(lower)) return 'spacing';
    
    // Sizing patterns  
    if (/\b(size|sizing|width|height|min-width|max-width|min-height|max-height|icon-size)\b/.test(lower)) return 'sizing';
    
    // Typography patterns
    if (/\b(font|typography|text|letter-spacing|line-height|font-size|font-weight|font-family|heading|body|display|caption|label)\b/.test(lower)) return 'typography';
    
    // Radius patterns
    if (/\b(radius|radii|corner|rounded|border-radius)\b/.test(lower)) return 'radius';
    
    return null;
};

// Infer token type from value
const inferTypeFromValue = (value: string): TokenType => {
    if (isColorValue(value)) return 'color';
    if (isShadowValue(value)) return 'shadow';
    if (isSizeValue(value)) return 'spacing'; // Default numeric to spacing
    if (isTypographyValue(value)) return 'typography';
    return 'unknown';
};

// Main parsing function - handles multiple JSON formats
const parseTokensFromJSON = (json: any, parentKey: string = ''): ParsedToken[] => {
    const tokens: ParsedToken[] = [];
    
    if (json === null || json === undefined) return tokens;
    
    // If it's a primitive value, create a token
    if (typeof json === 'string' || typeof json === 'number' || typeof json === 'boolean') {
        const value = String(json);
        const keyType = inferTypeFromKey(parentKey);
        const valueType = inferTypeFromValue(value);
        
        tokens.push({
            name: parentKey || 'token',
            value: value,
            type: keyType || valueType,
        });
        return tokens;
    }
    
    // If it's an array, process each item
    if (Array.isArray(json)) {
        json.forEach((item, index) => {
            const newKey = parentKey ? `${parentKey}-${index}` : String(index);
            tokens.push(...parseTokensFromJSON(item, newKey));
        });
        return tokens;
    }
    
    // If it's an object
    if (typeof json === 'object') {
        // Check for Design Token Community Group format ($value)
        if ('$value' in json) {
            const value = String(json.$value);
            const keyType = inferTypeFromKey(parentKey);
            const valueType = inferTypeFromValue(value);
            const explicitType = json.$type ? mapDTCGType(json.$type) : null;
            
            tokens.push({
                name: parentKey || 'token',
                value: value,
                type: explicitType || keyType || valueType,
                description: json.$description,
            });
            return tokens;
        }
        
        // Check for simple {value: ...} format
        if ('value' in json && (typeof json.value === 'string' || typeof json.value === 'number')) {
            const value = String(json.value);
            const keyType = inferTypeFromKey(parentKey);
            const valueType = inferTypeFromValue(value);
            
            tokens.push({
                name: parentKey || 'token',
                value: value,
                type: keyType || valueType,
                description: json.description,
            });
            return tokens;
        }
        
        // Recursively process object keys
        for (const key of Object.keys(json)) {
            // Skip metadata keys
            if (key.startsWith('$') || key.startsWith('_')) continue;
            
            const newKey = parentKey ? `${parentKey}/${key}` : key;
            tokens.push(...parseTokensFromJSON(json[key], newKey));
        }
    }
    
    return tokens;
};

// Map DTCG $type to our TokenType
const mapDTCGType = (dtcgType: string): TokenType | null => {
    const typeMap: Record<string, TokenType> = {
        'color': 'color',
        'dimension': 'spacing',
        'spacing': 'spacing',
        'sizing': 'sizing',
        'fontFamily': 'typography',
        'fontWeight': 'typography',
        'fontSize': 'typography',
        'lineHeight': 'typography',
        'letterSpacing': 'typography',
        'typography': 'typography',
        'shadow': 'shadow',
        'borderRadius': 'radius',
        'radius': 'radius',
    };
    return typeMap[dtcgType] || null;
};

// ============================================================================
// COMPONENT
// ============================================================================

export const TokenManager: React.FC = () => {
    const { projectId, userId } = useProject();
    const [activeTab, setActiveTab] = useState<TokenType | 'all'>('all');
    const [showFiles, setShowFiles] = useState(true);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [showExportModal, setShowExportModal] = useState(false);
    const [showFigmaImport, setShowFigmaImport] = useState(false);
    const [newToken, setNewToken] = useState({ name: '', value: '', description: '' });
    
    // File management state
    const [editingFileId, setEditingFileId] = useState<string | null>(null);
    const [editingFileName, setEditingFileName] = useState('');
    const [fileMenuOpen, setFileMenuOpen] = useState<string | null>(null);
    
    // Import preview state
    const [showPreview, setShowPreview] = useState(false);
    const [previewTokens, setPreviewTokens] = useState<ParsedToken[]>([]);
    const [previewFileName, setPreviewFileName] = useState('');
    const [previewFileContent, setPreviewFileContent] = useState('');

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Convex queries - scoped to project
    const tokens = useQuery(api.tokens.list, projectId ? { projectId } : "skip");
    const tokenFiles = useQuery(api.tokenFiles.list, projectId ? { projectId } : "skip") as TokenFile[] | undefined;

    // Convex mutations
    const createToken = useMutation(api.tokens.create);
    const updateToken = useMutation(api.tokens.update);
    const removeToken = useMutation(api.tokens.remove);
    const bulkImport = useMutation(api.tokens.bulkImport);
    
    // File mutations
    const createFile = useMutation(api.tokenFiles.create);
    const renameFile = useMutation(api.tokenFiles.rename);
    const toggleFileActive = useMutation(api.tokenFiles.toggleActive);
    const removeFile = useMutation(api.tokenFiles.remove);

    // Filter tokens by active tab
    const filteredTokens = activeTab === 'all' 
        ? (tokens || []) 
        : (tokens || []).filter(t => t.type === activeTab);

    const handleEdit = (token: ConvexToken) => {
        setEditingId(token._id);
        setEditValue(token.value);
    };

    const handleSave = async (id: Id<"tokens">) => {
        if (!projectId || !userId) return;
        try {
            await updateToken({ id, projectId, userId, value: editValue });
            setEditingId(null);
        } catch (error) {
            console.error('Failed to update token:', error);
        }
    };

    const handleDelete = async (id: Id<"tokens">) => {
        if (!projectId || !userId) return;
        try {
            await removeToken({ id, projectId, userId });
        } catch (error) {
            console.error('Failed to delete token:', error);
        }
    };

    const handleAddToken = async () => {
        if (!newToken.name || !newToken.value || !projectId || !userId) return;
        
        try {
            const tokenType: TokenType = activeTab === 'all' ? 'unknown' : activeTab;
            
            await createToken({
                projectId,
                userId,
                name: newToken.name,
                value: newToken.value,
                type: tokenType,
                description: newToken.description || undefined,
            });
            setNewToken({ name: '', value: '', description: '' });
            setShowAddModal(false);
        } catch (error) {
            console.error('Failed to create token:', error);
        }
    };

    // Handle file selection - parse and show preview
    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const content = event.target?.result as string;
                const json = JSON.parse(content);
                const parsed = parseTokensFromJSON(json);
                
                console.log('[TokenManager] Parsed tokens:', parsed);
                
                setPreviewFileName(file.name);
                setPreviewFileContent(content);
                setPreviewTokens(parsed);
                setShowPreview(true);
            } catch (err) {
                console.error('[TokenManager] Parse error:', err);
                alert(`Failed to parse ${file.name}: ${err instanceof Error ? err.message : 'Invalid JSON'}`);
            }
        };
        reader.readAsText(file);
        
        // Reset file input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    // Confirm and import tokens from preview
    const handleConfirmImport = async () => {
        if (!projectId || !userId || previewTokens.length === 0) return;
        
        try {
            // Create the file record first
            const fileId = await createFile({
                projectId,
                name: previewFileName.replace('.json', ''),
                originalName: previewFileName,
                content: previewFileContent,
                tokenCount: previewTokens.length,
                uploadedBy: userId,
            });
            
            // Then import the tokens linked to this file
            await bulkImport({ 
                projectId,
                userId,
                tokens: previewTokens,
                sourceFileId: fileId,
                clearExisting: false 
            });
            
            // Close preview
            setShowPreview(false);
            setPreviewTokens([]);
            setPreviewFileName('');
            setPreviewFileContent('');
        } catch (err) {
            console.error('[TokenManager] Import error:', err);
            alert(`Failed to import tokens: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
    };

    // Update token type in preview
    const updatePreviewTokenType = (index: number, newType: TokenType) => {
        setPreviewTokens(prev => prev.map((t, i) => 
            i === index ? { ...t, type: newType } : t
        ));
    };

    const handleFileRename = async (fileId: Id<"tokenFiles">) => {
        if (!projectId || !editingFileName.trim()) return;
        try {
            await renameFile({ id: fileId, projectId, name: editingFileName.trim() });
            setEditingFileId(null);
            setEditingFileName('');
        } catch (error) {
            console.error('Failed to rename file:', error);
        }
    };

    const handleFileToggle = async (fileId: Id<"tokenFiles">) => {
        if (!projectId) return;
        try {
            await toggleFileActive({ id: fileId, projectId });
        } catch (error) {
            console.error('Failed to toggle file:', error);
        }
    };

    const handleFileDelete = async (fileId: Id<"tokenFiles">) => {
        if (!projectId) return;
        if (!confirm('Delete this file and all its tokens?')) return;
        try {
            await removeFile({ id: fileId, projectId });
        } catch (error) {
            console.error('Failed to delete file:', error);
        }
    };

    const getPreviewStyle = (token: ConvexToken) => {
        if (token.type === 'color') return { backgroundColor: token.value };
        if (token.type === 'radius') return { borderRadius: token.value };
        if (token.type === 'shadow') return { boxShadow: token.value };
        if (token.type === 'spacing' || token.type === 'sizing') {
            return { width: token.value };
        }
        if (token.type === 'typography') return { fontSize: token.value };
        return {};
    };

    const renderPreview = (token: ConvexToken) => {
        const style = getPreviewStyle(token);

        if (token.type === 'color') {
            return <div className="w-8 h-8 rounded border border-zinc-200/60 dark:border-zinc-700/60 shadow-sm" style={style} />;
        }
        if (token.type === 'radius') {
            return <div className="w-8 h-8 border border-zinc-300 dark:border-zinc-600 bg-zinc-100 dark:bg-zinc-800" style={style} />;
        }
        if (token.type === 'spacing' || token.type === 'sizing') {
             return (
                 <div className="h-4 bg-violet-500/20 border border-violet-500/50 rounded flex items-center justify-center text-[10px] text-violet-600 dark:text-violet-400 min-w-[20px]" style={style}>
                 </div>
             );
        }
        if (token.type === 'shadow') {
            return <div className="w-8 h-8 rounded bg-white dark:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-700/60" style={style} />;
        }
        if (token.type === 'typography') {
            return <div className="text-zinc-900 dark:text-white truncate bg-zinc-100 dark:bg-zinc-800 p-1 rounded" style={style}>Ag</div>;
        }
        return <div className="w-8 h-8 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-700/60 flex items-center justify-center text-[10px] text-zinc-500">?</div>;
    };

    const formatRelativeTime = (timestamp: number): string => {
        const diff = Date.now() - timestamp;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);
        
        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days === 1) return 'Yesterday';
        return `${days}d ago`;
    };

    // Get token counts per type for tabs
    const tokenCounts = (tokens || []).reduce((acc, t) => {
        acc[t.type] = (acc[t.type] || 0) + 1;
        acc.all = (acc.all || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    return (
        <div className="flex h-full">
            <div className="flex-1 flex flex-col h-full overflow-hidden">
                <div className="p-6 border-b border-zinc-200/60 dark:border-zinc-800/60 flex justify-between items-center bg-white dark:bg-zinc-900 z-10">
                    <div>
                        <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">Tokens</h2>
                    </div>
                    <div className="flex items-center gap-2">
                         <input 
                            type="file" 
                            accept=".json" 
                            ref={fileInputRef} 
                            className="hidden" 
                            onChange={handleFileSelect}
                        />
                        
                        {/* Figma Import */}
                        <button 
                            onClick={() => setShowFigmaImport(true)}
                            title="Import Figma Variables"
                            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-white bg-zinc-900 dark:bg-zinc-700 border border-zinc-700 dark:border-zinc-600 rounded hover:bg-zinc-800 dark:hover:bg-zinc-600"
                        >
                            <Figma size={14} /> Figma
                        </button>
                        
                        {/* Import JSON */}
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            title="Import JSON File"
                            className="p-1.5 text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-700/60 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-white"
                        >
                            <Upload size={16} />
                        </button>
                        
                        {/* Export */}
                        <button 
                            onClick={() => setShowExportModal(true)}
                            title="Export Tokens"
                            className="p-1.5 text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-700/60 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-white"
                        >
                            <Download size={16} />
                        </button>
                        
                        {/* Files Toggle */}
                        <button 
                            onClick={() => setShowFiles(!showFiles)}
                            title="Toggle File Panel"
                            className={`p-1.5 border rounded ${showFiles ? 'bg-violet-600 text-white border-transparent' : 'text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 border-zinc-200/60 dark:border-zinc-700/60 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-white'}`}
                        >
                            <FileJson size={16} />
                        </button>
                        
                        {/* Divider */}
                        <div className="w-px h-6 bg-zinc-200/60 dark:bg-zinc-700/60 mx-1" />

                        {/* View Toggle */}
                        <div className="flex bg-zinc-100 dark:bg-zinc-800 rounded p-0.5 border border-zinc-200/60 dark:border-zinc-700/60">
                            <button 
                                onClick={() => setViewMode('grid')}
                                title="Grid View"
                                className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-white' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'}`}
                            >
                                <LayoutGrid size={14} />
                            </button>
                            <button 
                                onClick={() => setViewMode('list')}
                                title="List View"
                                className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-white' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'}`}
                            >
                                <ListIcon size={14} />
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col">
                    <div className="flex gap-1 px-6 border-b border-zinc-200/60 dark:border-zinc-800/60 bg-white dark:bg-zinc-900 overflow-x-auto">
                        {TABS.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                                    activeTab === tab.id 
                                        ? 'border-zinc-900 dark:border-white text-zinc-900 dark:text-white' 
                                        : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                                }`}
                            >
                                {tab.label}
                                {tokenCounts[tab.id] > 0 && (
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                                        activeTab === tab.id 
                                            ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900' 
                                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
                                    }`}>
                                        {tokenCounts[tab.id]}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>

                    <div className="flex-1 overflow-y-auto p-6">
                        {filteredTokens.length === 0 && (
                            <div className="w-full py-12 text-center text-zinc-500 dark:text-zinc-400 text-sm border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg">
                                {activeTab === 'all' 
                                    ? 'No tokens found. Upload a JSON file to get started.' 
                                    : `No ${activeTab} tokens found. Try the "All" tab to see all tokens.`}
                            </div>
                        )}

                        {viewMode === 'grid' ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {filteredTokens.map(token => (
                                    <div key={token._id} className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/60 rounded-lg p-3 hover:shadow-sm transition-shadow group">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-3">
                                                {renderPreview(token)}
                                                <div className="flex flex-col min-w-0">
                                                    <span className="font-medium text-sm text-zinc-900 dark:text-white truncate" title={token.name}>{token.name}</span>
                                                    <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono truncate" title={token.value}>{token.value}</span>
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
                                    <span className="text-xs font-medium">Add Token</span>
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
                                            <th className="px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400">Type</th>
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
                                                    <span className="truncate block max-w-[200px]" title={token.name}>{token.name}</span>
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
                                                     ) : <span className="truncate block max-w-[150px]" title={token.value}>{token.value}</span>}
                                                </td>
                                                <td className="px-4 py-2">
                                                    <span className="text-[10px] uppercase px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">{token.type}</span>
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

            {/* Files Side Panel */}
            {showFiles && (
                <div className="w-72 border-l border-zinc-200/60 dark:border-zinc-800/60 bg-white dark:bg-zinc-900 flex flex-col transition-all">
                    <div className="p-4 border-b border-zinc-200/60 dark:border-zinc-800/60">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <FileJson size={16} className="text-zinc-400" />
                                <h3 className="font-semibold text-sm text-zinc-900 dark:text-white">Source Files</h3>
                            </div>
                            <span className="text-xs text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
                                {tokenFiles?.length || 0}
                            </span>
                        </div>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                            Toggle files to include/exclude their tokens
                        </p>
                    </div>

                    <div className="flex-1 overflow-y-auto p-3">
                        {(!tokenFiles || tokenFiles.length === 0) ? (
                            <div className="flex flex-col items-center justify-center h-full text-center p-4">
                                <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-3">
                                    <FileJson size={20} className="text-zinc-400" />
                                </div>
                                <p className="text-sm font-medium text-zinc-900 dark:text-white mb-1">No files uploaded</p>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
                                    Upload JSON files to manage your tokens
                                </p>
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-violet-600 text-white rounded hover:bg-violet-700"
                                >
                                    <Upload size={12} /> Upload Files
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {tokenFiles.map((file) => (
                                    <div 
                                        key={file._id} 
                                        className={`p-3 rounded-lg border transition-all ${
                                            file.isActive 
                                                ? 'bg-violet-50 dark:bg-violet-500/10 border-violet-200 dark:border-violet-500/30' 
                                                : 'bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200/60 dark:border-zinc-700/60 opacity-60'
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            {editingFileId === file._id ? (
                                                <div className="flex-1 flex gap-1">
                                                    <input
                                                        type="text"
                                                        value={editingFileName}
                                                        onChange={(e) => setEditingFileName(e.target.value)}
                                                        className="flex-1 h-6 px-2 text-xs bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-600 rounded text-zinc-900 dark:text-white"
                                                        autoFocus
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') handleFileRename(file._id);
                                                            if (e.key === 'Escape') setEditingFileId(null);
                                                        }}
                                                    />
                                                    <button 
                                                        onClick={() => handleFileRename(file._id)}
                                                        className="p-1 text-green-500 hover:bg-green-50 dark:hover:bg-green-500/10 rounded"
                                                    >
                                                        <Check size={12} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium text-zinc-900 dark:text-white truncate" title={file.name}>
                                                            {file.name}
                                                        </p>
                                                        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                                                            {file.tokenCount} tokens · {formatRelativeTime(file.uploadedAt)}
                                                        </p>
                                                    </div>
                                                    
                                                    {/* Toggle & Menu */}
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            onClick={() => handleFileToggle(file._id)}
                                                            title={file.isActive ? 'Disable file' : 'Enable file'}
                                                            className="p-1 rounded hover:bg-zinc-200/50 dark:hover:bg-zinc-700/50"
                                                        >
                                                            {file.isActive ? (
                                                                <ToggleRight size={18} className="text-violet-600 dark:text-violet-400" />
                                                            ) : (
                                                                <ToggleLeft size={18} className="text-zinc-400" />
                                                            )}
                                                        </button>
                                                        
                                                        <div className="relative">
                                                            <button
                                                                onClick={() => setFileMenuOpen(fileMenuOpen === file._id ? null : file._id)}
                                                                className="p-1 rounded hover:bg-zinc-200/50 dark:hover:bg-zinc-700/50 text-zinc-400"
                                                            >
                                                                <MoreVertical size={14} />
                                                            </button>
                                                            
                                                            {fileMenuOpen === file._id && (
                                                                <div className="absolute right-0 top-full mt-1 w-32 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg py-1 z-10">
                                                                    <button
                                                                        onClick={() => {
                                                                            setEditingFileId(file._id);
                                                                            setEditingFileName(file.name);
                                                                            setFileMenuOpen(null);
                                                                        }}
                                                                        className="w-full px-3 py-1.5 text-left text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center gap-2"
                                                                    >
                                                                        <Pencil size={12} /> Rename
                                                                    </button>
                                                                    <button
                                                                        onClick={() => {
                                                                            handleFileDelete(file._id);
                                                                            setFileMenuOpen(null);
                                                                        }}
                                                                        className="w-full px-3 py-1.5 text-left text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 flex items-center gap-2"
                                                                    >
                                                                        <Trash2 size={12} /> Delete
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                
                                {/* Upload More Button */}
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full p-2 border border-dashed border-zinc-300 dark:border-zinc-600 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:border-zinc-500 dark:hover:border-zinc-500 transition-colors flex items-center justify-center gap-2 text-xs"
                                >
                                    <Upload size={12} /> Upload More
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Import Preview Modal */}
            {showPreview && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl w-full max-w-3xl max-h-[80vh] flex flex-col border border-zinc-200/60 dark:border-zinc-800/60">
                        <div className="p-4 border-b border-zinc-200/60 dark:border-zinc-800/60 flex justify-between items-center">
                            <div>
                                <h3 className="text-lg font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                                    <Eye size={18} /> Preview Import
                                </h3>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                                    {previewFileName} · {previewTokens.length} tokens detected
                                </p>
                            </div>
                            <button onClick={() => setShowPreview(false)} className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white">
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-4">
                            {previewTokens.length === 0 ? (
                                <div className="text-center py-8">
                                    <AlertCircle size={32} className="mx-auto text-amber-500 mb-3" />
                                    <p className="text-zinc-900 dark:text-white font-medium mb-1">No tokens found</p>
                                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                                        The JSON file doesn't contain any recognizable token values.
                                    </p>
                                </div>
                            ) : (
                                <table className="w-full text-sm">
                                    <thead className="bg-zinc-50 dark:bg-zinc-800/50 sticky top-0">
                                        <tr>
                                            <th className="px-3 py-2 text-left font-medium text-zinc-500 dark:text-zinc-400 text-xs">Preview</th>
                                            <th className="px-3 py-2 text-left font-medium text-zinc-500 dark:text-zinc-400 text-xs">Name</th>
                                            <th className="px-3 py-2 text-left font-medium text-zinc-500 dark:text-zinc-400 text-xs">Value</th>
                                            <th className="px-3 py-2 text-left font-medium text-zinc-500 dark:text-zinc-400 text-xs">Type</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                                        {previewTokens.map((token, index) => (
                                            <tr key={index} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                                                <td className="px-3 py-2">
                                                    {token.type === 'color' && isColorValue(token.value) ? (
                                                        <div className="w-6 h-6 rounded border border-zinc-200 dark:border-zinc-700" style={{ backgroundColor: token.value }} />
                                                    ) : (
                                                        <div className="w-6 h-6 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-[8px] text-zinc-400">
                                                            {token.type.charAt(0).toUpperCase()}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2 font-mono text-xs text-zinc-900 dark:text-white">
                                                    <span className="truncate block max-w-[200px]" title={token.name}>{token.name}</span>
                                                </td>
                                                <td className="px-3 py-2 font-mono text-xs text-zinc-500 dark:text-zinc-400">
                                                    <span className="truncate block max-w-[150px]" title={token.value}>{token.value}</span>
                                                </td>
                                                <td className="px-3 py-2">
                                                    <select
                                                        value={token.type}
                                                        onChange={(e) => updatePreviewTokenType(index, e.target.value as TokenType)}
                                                        className="text-[10px] px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300"
                                                    >
                                                        <option value="color">Color</option>
                                                        <option value="typography">Typography</option>
                                                        <option value="spacing">Spacing</option>
                                                        <option value="sizing">Sizing</option>
                                                        <option value="radius">Radius</option>
                                                        <option value="shadow">Shadow</option>
                                                        <option value="unknown">Other</option>
                                                    </select>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                        
                        <div className="p-4 border-t border-zinc-200/60 dark:border-zinc-800/60 flex justify-between items-center">
                            <div className="text-xs text-zinc-500 dark:text-zinc-400">
                                {previewTokens.filter(t => t.type === 'color').length} colors, {' '}
                                {previewTokens.filter(t => t.type === 'spacing').length} spacing, {' '}
                                {previewTokens.filter(t => t.type === 'typography').length} typography
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setShowPreview(false)}
                                    className="px-4 py-2 text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleConfirmImport}
                                    disabled={previewTokens.length === 0}
                                    className="px-4 py-2 text-sm font-medium bg-violet-600 text-white rounded-md hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Import {previewTokens.length} Tokens
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Token Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl w-full max-w-md p-6 border border-zinc-200/60 dark:border-zinc-800/60">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">Add Token</h3>
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
