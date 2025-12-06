import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { TokenType, ConvexToken, convexTokenToLegacy } from '../types';
import { Trash2, Edit2, Save, Upload, Download, X, FileJson, Check, MoreVertical, AlertCircle, Eye } from 'lucide-react';
import { TokenExport } from './TokenExport';
import { useProject } from '../contexts/ProjectContext';
import { useTenant } from '../contexts/TenantContext';
import { TableSkeleton, FileSkeleton } from './LoadingSpinner';

const TABS: { id: TokenType; label: string }[] = [
    { id: 'color', label: 'Colors' },
    { id: 'typography', label: 'Typography' },
    { id: 'spacing', label: 'Spacing' },
    { id: 'sizing', label: 'Sizing' },
    { id: 'radius', label: 'Radius' },
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
// FIGMA VARIABLES PARSER
// ============================================================================

// Detect token type from Figma scopes
const getTypeFromScopes = (scopes: string[]): TokenType | null => {
    if (!scopes || scopes.length === 0) return null;
    
    // Corner radius
    if (scopes.includes('CORNER_RADIUS')) return 'radius';
    
    // Gap, margin, padding = spacing
    if (scopes.includes('GAP') || scopes.includes('WIDTH_HEIGHT')) return 'spacing';
    
    // All fill/stroke = color
    if (scopes.includes('ALL_FILLS') || scopes.includes('FRAME_FILL') || 
        scopes.includes('SHAPE_FILL') || scopes.includes('TEXT_FILL') ||
        scopes.includes('STROKE_COLOR')) return 'color';
    
    // Effects = shadow
    if (scopes.includes('EFFECT_COLOR') || scopes.includes('EFFECT_FLOAT')) return 'shadow';
    
    return null;
};

// Detect token type from variable name
const getTypeFromName = (name: string): TokenType | null => {
    const lower = name.toLowerCase();
    
    // Color patterns
    if (/\b(color|text|icon|bg|background|fill|stroke|border)\b/.test(lower)) return 'color';
    if (/_text\/|_icon\/|_bg\/|_border\/|_multiplayer\//.test(lower)) return 'color';
    
    // Spacing patterns
    if (/\b(spacer|spacing|gap|margin|padding)\b/.test(lower)) return 'spacing';
    
    // Radius patterns
    if (/\b(radius|radii|corner)\b/.test(lower)) return 'radius';
    
    // Typography patterns
    if (/\b(font|body|heading|display|caption|label|letterspacing|lineheight|fontsize|fontweight|fontfamily)\b/.test(lower)) return 'typography';
    
    // Shadow patterns
    if (/\b(shadow|elevation)\b/.test(lower)) return 'shadow';
    
    // Sizing patterns
    if (/\b(size|width|height|min|max)\b/.test(lower)) return 'sizing';
    
    return null;
};

// Detect token type from value
const getTypeFromValue = (value: any): TokenType | null => {
    if (value === null || value === undefined) return null;
    
    const strVal = String(value).trim();
    
    // Color detection
    if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(strVal)) return 'color';
    if (/^rgba?\s*\(/i.test(strVal)) return 'color';
    if (/^hsla?\s*\(/i.test(strVal)) return 'color';
    
    return null;
};

// Format value for display
const formatValue = (value: any, type?: string): string => {
    if (value === null || value === undefined) return '';
    
    // Handle Figma color objects
    if (typeof value === 'object' && 'r' in value && 'g' in value && 'b' in value) {
        const r = Math.round(value.r * 255);
        const g = Math.round(value.g * 255);
        const b = Math.round(value.b * 255);
        const a = value.a !== undefined ? value.a : 1;
        if (a < 1) {
            return `rgba(${r}, ${g}, ${b}, ${a.toFixed(2)})`;
        }
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase();
    }
    
    // Handle numbers - add px for sizing/spacing/radius
    if (typeof value === 'number') {
        // Font weights are unitless
        if (type === 'FLOAT' && value >= 100 && value <= 900 && value % 50 === 0) {
            return String(value);
        }
        // Small decimals might be line-height ratios
        if (value > 0 && value < 10 && !Number.isInteger(value)) {
            return String(value);
        }
        // Most Figma numeric values are in pixels
        return `${value}px`;
    }
    
    return String(value);
};

// Clean up variable name for display
const cleanName = (name: string): string => {
    // Remove special characters at start
    let cleaned = name.replace(/^[✦★◆●○■□▲△▼▽◇◈※@#$%^&*]+\/?/, '');
    // Replace slashes with dots for readability
    cleaned = cleaned.replace(/\//g, '.');
    // Remove leading dots
    cleaned = cleaned.replace(/^\.+/, '');
    return cleaned;
};

// Parse Figma Variables format (sizing.json, typography.json)
const parseFigmaVariables = (json: any): ParsedToken[] => {
    const tokens: ParsedToken[] = [];
    
    if (!json.variables || !Array.isArray(json.variables)) return tokens;
    
    // Get the first mode ID
    const modeIds = json.modes ? Object.keys(json.modes) : [];
    const defaultModeId = modeIds[0] || '1:0';
    
    for (const variable of json.variables) {
        const { name, description, type, scopes, resolvedValuesByMode, valuesByMode } = variable;
        
        // Get the resolved value
        let value: any = null;
        
        // Try resolved value first
        if (resolvedValuesByMode) {
            const modeData = resolvedValuesByMode[Object.keys(resolvedValuesByMode)[0]];
            if (modeData && modeData.resolvedValue !== undefined) {
                value = modeData.resolvedValue;
            }
        }
        
        // Fall back to valuesByMode
        if (value === null && valuesByMode) {
            const modeValue = valuesByMode[Object.keys(valuesByMode)[0]];
            // Skip aliases (references to other variables)
            if (typeof modeValue === 'object' && modeValue?.type === 'VARIABLE_ALIAS') {
                continue;
            }
            value = modeValue;
        }
        
        if (value === null || value === undefined) continue;
        
        // Determine token type
        let tokenType: TokenType = 'unknown';
        
        // First try scopes
        const scopeType = getTypeFromScopes(scopes);
        if (scopeType) tokenType = scopeType;
        
        // Then try name
        if (tokenType === 'unknown') {
            const nameType = getTypeFromName(name);
            if (nameType) tokenType = nameType;
        }
        
        // Then try value
        if (tokenType === 'unknown') {
            const valueType = getTypeFromValue(value);
            if (valueType) tokenType = valueType;
        }
        
        // Format the value
        const formattedValue = formatValue(value, type);
        
        tokens.push({
            name: cleanName(name),
            value: formattedValue,
            type: tokenType,
            description: description || undefined,
        });
    }
    
    return tokens;
};

// Parse flat tokens format (colors.slides.light.json)
const parseFlatTokens = (json: any): ParsedToken[] => {
    const tokens: ParsedToken[] = [];
    
    if (!json.tokens || typeof json.tokens !== 'object') return tokens;
    
    for (const [key, value] of Object.entries(json.tokens)) {
        if (value === null || value === undefined) continue;
        
        const strValue = String(value);
        
        // Determine token type
        let tokenType: TokenType = 'unknown';
        
        // Try name first
        const nameType = getTypeFromName(key);
        if (nameType) tokenType = nameType;
        
        // Then try value
        if (tokenType === 'unknown') {
            const valueType = getTypeFromValue(strValue);
            if (valueType) tokenType = valueType;
        }
        
        tokens.push({
            name: cleanName(key),
            value: strValue,
            type: tokenType,
        });
    }
    
    return tokens;
};

// Parse generic nested JSON
const parseGenericJSON = (json: any, parentKey: string = ''): ParsedToken[] => {
    const tokens: ParsedToken[] = [];
    
    if (json === null || json === undefined) return tokens;
    
    // Primitive value
    if (typeof json === 'string' || typeof json === 'number' || typeof json === 'boolean') {
        const value = String(json);
        const nameType = getTypeFromName(parentKey);
        const valueType = getTypeFromValue(value);
        
        tokens.push({
            name: cleanName(parentKey || 'token'),
            value: formatValue(json),
            type: nameType || valueType || 'unknown',
        });
        return tokens;
    }
    
    // Object with $value (DTCG format)
    if (typeof json === 'object' && '$value' in json) {
        const value = json.$value;
        const nameType = getTypeFromName(parentKey);
        const valueType = getTypeFromValue(value);
        
        tokens.push({
            name: cleanName(parentKey || 'token'),
            value: formatValue(value),
            type: nameType || valueType || 'unknown',
            description: json.$description,
        });
        return tokens;
    }
    
    // Object with value key
    if (typeof json === 'object' && 'value' in json && typeof json.value !== 'object') {
        const value = json.value;
        const nameType = getTypeFromName(parentKey);
        const valueType = getTypeFromValue(value);
        
        tokens.push({
            name: cleanName(parentKey || 'token'),
            value: formatValue(value),
            type: nameType || valueType || 'unknown',
            description: json.description,
        });
        return tokens;
    }
    
    // Recurse into object
    if (typeof json === 'object' && !Array.isArray(json)) {
        for (const [key, val] of Object.entries(json)) {
            // Skip metadata keys
            if (key.startsWith('$') || key.startsWith('_')) continue;
            
            const newKey = parentKey ? `${parentKey}/${key}` : key;
            tokens.push(...parseGenericJSON(val, newKey));
        }
    }
    
    // Array
    if (Array.isArray(json)) {
        json.forEach((item, idx) => {
            const newKey = parentKey ? `${parentKey}/${idx}` : String(idx);
            tokens.push(...parseGenericJSON(item, newKey));
        });
    }
    
    return tokens;
};

// Main parser - auto-detects format
const parseTokensFromJSON = (json: any): ParsedToken[] => {
    // Detect format and parse accordingly
    
    // Figma Variables format (has 'variables' array)
    if (json.variables && Array.isArray(json.variables)) {
        console.log('[Parser] Detected Figma Variables format');
        return parseFigmaVariables(json);
    }
    
    // Flat tokens format (has 'tokens' object with string values)
    if (json.tokens && typeof json.tokens === 'object' && !Array.isArray(json.tokens)) {
        const firstValue = Object.values(json.tokens)[0];
        if (typeof firstValue === 'string' || typeof firstValue === 'number') {
            console.log('[Parser] Detected flat tokens format');
            return parseFlatTokens(json);
        }
    }
    
    // Generic nested JSON
    console.log('[Parser] Using generic JSON parser');
    return parseGenericJSON(json);
};

// ============================================================================
// COMPONENT
// ============================================================================

export const TokenManager: React.FC = () => {
    const { projectId, tenantId, userId } = useProject();
    const { tenantId: tenantIdFromContext, userId: userIdFromContext } = useTenant();
    
    // Use tenantId and userId from TenantContext (more reliable)
    const effectiveTenantId = tenantIdFromContext || tenantId;
    const effectiveUserId = userIdFromContext || userId;
    const [activeTab, setActiveTab] = useState<TokenType>('color');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [showExportModal, setShowExportModal] = useState(false);
    const [newToken, setNewToken] = useState({ name: '', value: '', type: 'color' as TokenType, description: '' });
    
    // File management state
    const [editingFileId, setEditingFileId] = useState<string | null>(null);
    const [editingFileName, setEditingFileName] = useState('');
    const [fileMenuOpen, setFileMenuOpen] = useState<string | null>(null);
    
    // Close menu on outside click
    useEffect(() => {
        const handleClickOutside = () => {
            if (fileMenuOpen) {
                setFileMenuOpen(null);
            }
        };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, [fileMenuOpen]);
    
    // Import preview state
    const [showPreview, setShowPreview] = useState(false);
    const [previewTokens, setPreviewTokens] = useState<ParsedToken[]>([]);
    const [previewFileName, setPreviewFileName] = useState('');
    const [previewFileContent, setPreviewFileContent] = useState('');

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Convex queries - scoped to tenant and project
    const tokens = useQuery(
        api.tokens.list, 
        projectId && effectiveTenantId && effectiveUserId 
            ? { projectId, tenantId: effectiveTenantId, userId: effectiveUserId } 
            : "skip"
    );
    const tokenFiles = useQuery(
        api.tokenFiles.list, 
        projectId && effectiveTenantId && effectiveUserId 
            ? { projectId, tenantId: effectiveTenantId, userId: effectiveUserId } 
            : "skip"
    ) as TokenFile[] | undefined;
    
    // Loading states
    const isLoadingTokens = tokens === undefined && projectId;
    const isLoadingFiles = tokenFiles === undefined && projectId;

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
    const filteredTokens = (tokens || []).filter(t => t.type === activeTab);

    const handleEdit = (token: ConvexToken) => {
        setEditingId(token._id);
        setEditValue(token.value);
    };

    const handleSave = async (id: Id<"tokens">) => {
        if (!projectId || !effectiveTenantId || !effectiveUserId) return;
        try {
            await updateToken({ id, tenantId: effectiveTenantId, userId: effectiveUserId, value: editValue });
            setEditingId(null);
        } catch (error) {
            console.error('Failed to update token:', error);
        }
    };

    const handleDelete = async (id: Id<"tokens">) => {
        if (!projectId || !effectiveTenantId || !effectiveUserId) return;
        try {
            await removeToken({ id, tenantId: effectiveTenantId, userId: effectiveUserId });
        } catch (error) {
            console.error('Failed to delete token:', error);
        }
    };

    const handleAddToken = async () => {
        if (!newToken.name || !newToken.value || !projectId || !effectiveTenantId || !effectiveUserId) return;
        
        try {
            await createToken({
                projectId,
                tenantId: effectiveTenantId,
                userId: effectiveUserId,
                name: newToken.name,
                value: newToken.value,
                type: newToken.type,
                description: newToken.description || undefined,
            });
            setNewToken({ name: '', value: '', type: 'color', description: '' });
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
                
                console.log(`[TokenManager] Parsed ${parsed.length} tokens from ${file.name}`);
                console.log('[TokenManager] Sample tokens:', parsed.slice(0, 5));
                
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
        if (!projectId || !effectiveTenantId || !effectiveUserId || previewTokens.length === 0) return;
        
        try {
            // Create the file record first
            const fileId = await createFile({
                projectId,
                tenantId: effectiveTenantId,
                userId: effectiveUserId,
                name: previewFileName.replace('.json', ''),
                originalName: previewFileName,
                content: previewFileContent,
                tokenCount: previewTokens.length,
            });
            
            // Then import the tokens linked to this file
            await bulkImport({ 
                projectId,
                tenantId: effectiveTenantId,
                userId: effectiveUserId,
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
        if (!projectId || !effectiveTenantId || !effectiveUserId || !editingFileName.trim()) return;
        try {
            await renameFile({ id: fileId, tenantId: effectiveTenantId, userId: effectiveUserId, name: editingFileName.trim() });
            setEditingFileId(null);
            setEditingFileName('');
        } catch (error) {
            console.error('Failed to rename file:', error);
        }
    };

    const handleFileToggle = async (fileId: Id<"tokenFiles">) => {
        if (!projectId || !effectiveTenantId || !effectiveUserId) return;
        try {
            await toggleFileActive({ id: fileId, tenantId: effectiveTenantId, userId: effectiveUserId });
        } catch (error) {
            console.error('Failed to toggle file:', error);
        }
    };

    const handleFileDelete = async (fileId: Id<"tokenFiles">) => {
        if (!projectId || !effectiveTenantId || !effectiveUserId) return;
        if (!confirm('Delete this file and all its tokens?')) return;
        try {
            await removeFile({ id: fileId, tenantId: effectiveTenantId, userId: effectiveUserId });
        } catch (error) {
            console.error('Failed to delete file:', error);
            }
    };

    // Render token preview based on type
    const renderTokenPreview = (type: TokenType, value: string) => {
        if (type === 'color') {
            const isValidColor = /^(#|rgb|hsl|rgba|hsla)/.test(value.trim());
            if (isValidColor) {
                return <div className="w-6 h-6 rounded border border-zinc-200 dark:border-zinc-700 shadow-sm flex-shrink-0" style={{ backgroundColor: value }} />;
            }
        }
        if (type === 'radius') {
            return <div className="w-6 h-6 border-2 border-violet-500 bg-violet-100 dark:bg-violet-900/30 flex-shrink-0" style={{ borderRadius: value }} />;
        }
        if (type === 'shadow') {
            return <div className="w-6 h-6 rounded bg-white dark:bg-zinc-700 flex-shrink-0" style={{ boxShadow: value }} />;
        }
        if (type === 'spacing' || type === 'sizing') {
             return (
                <div className="h-5 bg-violet-500/20 border border-violet-500/50 rounded flex items-center justify-center flex-shrink-0" style={{ width: value, minWidth: '12px', maxWidth: '48px' }}>
                    <span className="text-[8px] text-violet-600 dark:text-violet-400 font-mono">{value}</span>
                 </div>
             );
        }
        if (type === 'typography') {
            return <div className="text-xs text-zinc-900 dark:text-white bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded font-mono flex-shrink-0">{value}</div>;
        }
        return <div className="w-6 h-6 bg-zinc-100 dark:bg-zinc-800 rounded flex items-center justify-center text-[8px] text-zinc-400 flex-shrink-0">?</div>;
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
        return acc;
    }, {} as Record<string, number>);

    // Preview counts
    const previewCounts = previewTokens.reduce((acc, t) => {
        acc[t.type] = (acc[t.type] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    return (
        <div className="flex h-full">
            <div className="flex-1 flex flex-col h-full overflow-hidden">
                <div className="p-6 border-b border-zinc-200/60 dark:border-zinc-800/60 bg-white dark:bg-zinc-900 z-10 flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">Tokens</h2>
                    <input 
                        type="file" 
                        accept=".json" 
                        ref={fileInputRef} 
                        className="hidden" 
                        onChange={handleFileSelect}
                    />
                    <button 
                        onClick={() => setShowExportModal(true)}
                        title="Export Tokens"
                        className="p-1.5 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors"
                    >
                        <Download size={16} />
                    </button>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col">
                    <div className="flex gap-0.5 px-6 border-b border-zinc-200/60 dark:border-zinc-800/60 bg-white dark:bg-zinc-900 overflow-x-auto">
                        {TABS.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b transition-colors whitespace-nowrap ${
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
                        {/* Loading State */}
                        {isLoadingTokens && <TableSkeleton rows={6} cols={5} />}
                        
                        {/* Empty State */}
                        {!isLoadingTokens && filteredTokens.length === 0 && (
                            <div className="w-full py-12 text-center text-zinc-500 dark:text-zinc-400 text-sm border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg">
                                No {activeTab} tokens found. Upload a JSON file to get started.
                            </div>
                        )}

                        {/* Token List */}
                        {!isLoadingTokens && filteredTokens.length > 0 && (
                            <div className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/60 rounded-lg overflow-hidden">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200/60 dark:border-zinc-800/60">
                                        <tr>
                                            {activeTab !== 'typography' && (
                                                <th className="px-4 py-2 font-medium text-zinc-500 dark:text-zinc-400 text-xs w-10"></th>
                                            )}
                                            <th className="px-4 py-2 font-medium text-zinc-500 dark:text-zinc-400 text-xs">Name</th>
                                            <th className="px-4 py-2 font-medium text-zinc-500 dark:text-zinc-400 text-xs">Value</th>
                                            <th className="px-4 py-2 font-medium text-zinc-500 dark:text-zinc-400 text-xs text-right w-20">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                        {filteredTokens.map(token => (
                                            <tr key={token._id} className="group hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                                                {activeTab !== 'typography' && (
                                                <td className="px-4 py-2">
                                                        {renderTokenPreview(token.type as TokenType, token.value)}
                                                </td>
                                                )}
                                                <td className="px-4 py-2 font-medium text-zinc-900 dark:text-white">
                                                    <span className="truncate block max-w-[250px]" title={token.name}>{token.name}</span>
                                                </td>
                                                <td className="px-4 py-2 font-mono text-zinc-500 dark:text-zinc-400 text-xs">
                                                     {editingId === token._id ? (
                                                         <div className="flex gap-2">
                                                            <input 
                                                                className="bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-700/60 text-xs px-2 h-6 rounded w-full text-zinc-900 dark:text-white"
                                                                value={editValue}
                                                                onChange={(e) => setEditValue(e.target.value)}
                                                            />
                                                            <button onClick={() => handleSave(token._id)} className="text-green-500 hover:bg-green-50 dark:hover:bg-green-500/10 p-1 rounded"><Save size={12}/></button>
                                                         </div>
                                                     ) : <span className="truncate block max-w-[180px]" title={token.value}>{token.value}</span>}
                                                </td>
                                                <td className="px-4 py-2 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <div className="flex justify-end gap-1">
                                                        <button onClick={() => handleEdit(token)} className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"><Edit2 size={12}/></button>
                                                        <button onClick={() => handleDelete(token._id)} className="text-zinc-400 hover:text-red-500 p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"><Trash2 size={12}/></button>
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
            <div className="w-72 border-l border-zinc-200/60 dark:border-zinc-800/60 bg-white dark:bg-zinc-900 flex flex-col">
                <div className="px-6 py-[25px] border-b border-zinc-200/60 dark:border-zinc-800/60">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-medium text-zinc-900 dark:text-white">Source Files</h3>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            title="Upload JSON File"
                            className="p-1.5 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors"
                        >
                            <Upload size={14} />
                        </button>
                    </div>
                </div>

                    <div className="flex-1 overflow-y-auto p-4">
                        {/* Loading State */}
                        {isLoadingFiles ? (
                            <FileSkeleton count={3} />
                        ) : (!tokenFiles || tokenFiles.length === 0) ? (
                            <div className="flex flex-col items-center justify-center h-full text-center p-4">
                                <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-3">
                                    <FileJson size={18} className="text-zinc-400" />
                                </div>
                                <p className="text-sm font-medium text-zinc-900 dark:text-white mb-1">No files</p>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
                                    Upload JSON to import tokens
                                </p>
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="flex items-center gap-1.5 px-3 h-8 text-xs font-medium bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded hover:bg-zinc-800 dark:hover:bg-zinc-200"
                                >
                                    <Upload size={12} /> Upload
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {tokenFiles.map((file) => (
                                    <div 
                                        key={file._id} 
                                        className={`p-3 rounded-lg transition-all ${
                                            file.isActive 
                                                ? 'bg-zinc-50 dark:bg-zinc-800/50' 
                                                : 'opacity-50'
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
                                                    
                                                    <div className="flex items-center gap-1">
                                                        {/* Toggle Switch - Small */}
                                                        <button
                                                            onClick={() => handleFileToggle(file._id)}
                                                            title={file.isActive ? 'Disable' : 'Enable'}
                                                            className={`relative w-7 h-4 rounded-full transition-colors ${
                                                                file.isActive 
                                                                    ? 'bg-violet-600' 
                                                                    : 'bg-zinc-300 dark:bg-zinc-600'
                                                            }`}
                                                        >
                                                            <span 
                                                                className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow-sm transition-all ${
                                                                    file.isActive ? 'left-[14px]' : 'left-0.5'
                                                                }`}
                                                            />
                                                        </button>
                                                        
                                                        <div className="relative">
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setFileMenuOpen(fileMenuOpen === file._id ? null : file._id);
                                                                }}
                                                                className="p-1 rounded hover:bg-zinc-200/50 dark:hover:bg-zinc-700/50 text-zinc-400"
                                                            >
                                                                <MoreVertical size={14} />
                                                            </button>
                                                            
                                                            {fileMenuOpen === file._id && (
                                                                <div className="absolute right-0 top-full mt-1 w-24 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg py-1 z-10">
                                                                    <button
                                                                        onClick={() => {
                                                                            setEditingFileId(file._id);
                                                                            setEditingFileName(file.name);
                                                                            setFileMenuOpen(null);
                                                                        }}
                                                                        className="w-full px-3 py-1.5 text-left text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                                                                    >
                                                                        Rename
                                                                    </button>
                                                                    <button
                                                                        onClick={() => {
                                                                            handleFileDelete(file._id);
                                                                            setFileMenuOpen(null);
                                                                        }}
                                                                        className="w-full px-3 py-1.5 text-left text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"
                                                                    >
                                                                        Delete
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
                            </div>
                        )}
                    </div>
                </div>

            {/* Import Preview Modal */}
            {showPreview && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl w-full max-w-4xl max-h-[85vh] flex flex-col border border-zinc-200/60 dark:border-zinc-800/60">
                        <div className="p-4 border-b border-zinc-200/60 dark:border-zinc-800/60 flex justify-between items-center">
                            <div>
                                <h3 className="text-lg font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                                    <Eye size={18} /> Preview: {previewFileName}
                                </h3>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                                    {previewTokens.length} tokens · 
                                    {previewCounts.color ? ` ${previewCounts.color} colors` : ''}
                                    {previewCounts.spacing ? ` · ${previewCounts.spacing} spacing` : ''}
                                    {previewCounts.typography ? ` · ${previewCounts.typography} typography` : ''}
                                    {previewCounts.radius ? ` · ${previewCounts.radius} radius` : ''}
                                    {previewCounts.unknown ? ` · ${previewCounts.unknown} other` : ''}
                                </p>
                            </div>
                            <button onClick={() => setShowPreview(false)} className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white">
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto">
                            {previewTokens.length === 0 ? (
                                <div className="text-center py-12">
                                    <AlertCircle size={32} className="mx-auto text-amber-500 mb-3" />
                                    <p className="text-zinc-900 dark:text-white font-medium mb-1">No tokens found</p>
                                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                                        The JSON file doesn't contain any recognizable tokens.
                                    </p>
                                </div>
                            ) : (
                                <table className="w-full text-sm">
                                    <thead className="bg-zinc-50 dark:bg-zinc-800/50 sticky top-0">
                                        <tr>
                                            <th className="px-4 py-2 text-left font-medium text-zinc-500 dark:text-zinc-400 text-xs w-12"></th>
                                            <th className="px-4 py-2 text-left font-medium text-zinc-500 dark:text-zinc-400 text-xs">Name</th>
                                            <th className="px-4 py-2 text-left font-medium text-zinc-500 dark:text-zinc-400 text-xs">Value</th>
                                            <th className="px-4 py-2 text-left font-medium text-zinc-500 dark:text-zinc-400 text-xs w-28">Type</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                        {previewTokens.map((token, index) => (
                                            <tr key={index} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                                                <td className="px-4 py-2">
                                                    {renderTokenPreview(token.type, token.value)}
                                                </td>
                                                <td className="px-4 py-2 font-mono text-xs text-zinc-900 dark:text-white">
                                                    <span className="truncate block max-w-[280px]" title={token.name}>{token.name}</span>
                                                </td>
                                                <td className="px-4 py-2 font-mono text-xs text-zinc-500 dark:text-zinc-400">
                                                    <span className="truncate block max-w-[180px]" title={token.value}>{token.value}</span>
                                                </td>
                                                <td className="px-4 py-2">
                                                    <select
                                                        value={token.type}
                                                        onChange={(e) => updatePreviewTokenType(index, e.target.value as TokenType)}
                                                        className="text-[10px] h-6 px-2 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300"
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
                        
                        <div className="p-4 border-t border-zinc-200/60 dark:border-zinc-800/60 flex justify-end gap-3">
                            <button
                                onClick={() => setShowPreview(false)}
                                className="px-4 h-8 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmImport}
                                disabled={previewTokens.length === 0}
                                className="px-4 h-8 text-sm font-medium bg-violet-600 text-white rounded hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Import {previewTokens.length} Tokens
                            </button>
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
                            <div className="flex gap-3">
                                <div className="flex-1">
                                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Name</label>
                                <input
                                    type="text"
                                    value={newToken.name}
                                    onChange={(e) => setNewToken({ ...newToken, name: e.target.value })}
                                        placeholder="e.g., primary.500"
                                        className="w-full h-8 px-3 border border-zinc-200/60 dark:border-zinc-700/60 rounded text-sm bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:border-violet-500"
                                    />
                                </div>
                                <div className="w-28">
                                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Type</label>
                                    <select
                                        value={newToken.type}
                                        onChange={(e) => setNewToken({ ...newToken, type: e.target.value as TokenType })}
                                        className="w-full h-8 px-2 border border-zinc-200/60 dark:border-zinc-700/60 rounded text-sm bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:border-violet-500"
                                    >
                                        <option value="color">Color</option>
                                        <option value="typography">Typography</option>
                                        <option value="spacing">Spacing</option>
                                        <option value="sizing">Sizing</option>
                                        <option value="radius">Radius</option>
                                        <option value="shadow">Shadow</option>
                                        <option value="unknown">Other</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Value</label>
                                <input
                                    type="text"
                                    value={newToken.value}
                                    onChange={(e) => setNewToken({ ...newToken, value: e.target.value })}
                                    placeholder={
                                        newToken.type === 'color' ? '#6366f1 or rgba(99, 102, 241, 1)' :
                                        newToken.type === 'spacing' || newToken.type === 'sizing' ? '16px or 1rem' :
                                        newToken.type === 'radius' ? '8px or 50%' :
                                        newToken.type === 'shadow' ? '0 4px 6px rgba(0,0,0,0.1)' :
                                        newToken.type === 'typography' ? 'Inter, 16px, 500' :
                                        'Enter value'
                                    }
                                    className="w-full h-8 px-3 border border-zinc-200/60 dark:border-zinc-700/60 rounded text-sm bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:border-violet-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Description (optional)</label>
                                <input
                                    type="text"
                                    value={newToken.description}
                                    onChange={(e) => setNewToken({ ...newToken, description: e.target.value })}
                                    placeholder="Brief description of the token"
                                    className="w-full h-8 px-3 border border-zinc-200/60 dark:border-zinc-700/60 rounded text-sm bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:border-violet-500"
                                />
                            </div>
                            
                            {/* Preview */}
                            {newToken.value && (
                                <div className="pt-3 border-t border-zinc-200/60 dark:border-zinc-700/60">
                                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-2">Preview</label>
                                    <div className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                                        {renderTokenPreview(newToken.type, newToken.value)}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">{newToken.name || 'token-name'}</p>
                                            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono truncate">{newToken.value}</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="flex justify-end gap-2 mt-6">
                            <button
                                onClick={() => {
                                    setShowAddModal(false);
                                    setNewToken({ name: '', value: '', type: 'color', description: '' });
                                }}
                                className="px-4 h-8 text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAddToken}
                                disabled={!newToken.name || !newToken.value}
                                className="px-4 h-8 text-sm font-medium bg-violet-600 text-white rounded hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
        </div>
    );
};
