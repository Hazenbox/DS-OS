import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { TokenType, ConvexToken, convexTokenToLegacy } from '../types';
import { Trash2, Edit2, Save, Upload, Download, X, FileJson, Check, MoreVertical, AlertCircle, Eye, Sun, Moon, Monitor, Network, ArrowUpDown, ArrowUp, ArrowDown, CheckCircle2 } from 'lucide-react';
import { TokenExport } from './TokenExport';
import { TokenVisualization } from './TokenVisualization';
import { TokenDependencyGraph } from './TokenDependencyGraph';
import { useProject } from '../contexts/ProjectContext';
import { useTenant } from '../contexts/TenantContext';
import { TableSkeleton, FileSkeleton } from './LoadingSpinner';
import { extractFontMetadata, parseFontUrl, fetchAndExtractFontMetadata, fontFamilyMatches } from '../utils/fontUtils';

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
    
    // Handle typography objects - preserve as JSON string
    if (typeof value === 'object' && !Array.isArray(value)) {
        // Check if it looks like a typography object
        if ('fontFamily' in value || 'fontSize' in value || 'fontWeight' in value || 
            'fontFamilyName' in value || 'lineHeightPx' in value || 'letterSpacing' in value) {
            return JSON.stringify(value);
        }
        // For other objects, try to stringify if it has meaningful properties
        if (Object.keys(value).length > 0 && Object.keys(value).length < 10) {
            try {
                return JSON.stringify(value);
            } catch {
                return String(value);
            }
        }
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
    const [tokenMode, setTokenMode] = useState<'light' | 'dark' | 'high-contrast'>('light');
    const [showDependencyGraph, setShowDependencyGraph] = useState(false);
    const [selectedTokenId, setSelectedTokenId] = useState<string | undefined>();
    
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
    const fontInputRef = useRef<HTMLInputElement>(null);
    const validationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const [showFontUploadModal, setShowFontUploadModal] = useState(false);
    const [uploadingFontFamily, setUploadingFontFamily] = useState<string | null>(null);
    const [fontUploadMethod, setFontUploadMethod] = useState<'url' | 'file'>('url');
    const [fontUrl, setFontUrl] = useState('');
    const [uploadingFonts, setUploadingFonts] = useState(false);
    const [fontValidationStatus, setFontValidationStatus] = useState<{
        isValidating: boolean;
        isValid: boolean;
        detectedFamily?: string;
        message?: string;
    } | null>(null);

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
    const createFile = useAction(api.tokenFiles.uploadAndCreate);
    const renameFile = useMutation(api.tokenFiles.rename);
    const toggleFileActive = useMutation(api.tokenFiles.toggleActive);
    const removeFile = useMutation(api.tokenFiles.remove);
    
    // Font file mutations
    const createFontFile = useMutation(api.fontFiles.create);
    const removeFontFile = useMutation(api.fontFiles.remove);
    
    // Filter tokens by active tab
    const filteredTokens = (tokens || []).filter(t => t.type === activeTab);
    
    // For typography tab: separate font families from typography styles
    const typographyTokens = activeTab === 'typography' ? (tokens || []).filter(t => t.type === 'typography') : [];
    const fontFamilyTokens = typographyTokens.filter(t => t.name.includes('font.family.') || t.name.includes('.fontFamily'));
    
    // Get unique font families only (deduplicate by value)
    const uniqueFontFamilies = Array.from(
        new Map(fontFamilyTokens.map(t => [t.value, t])).values()
    );
    
    const typographyStyleTokens = typographyTokens.filter(t => !t.name.includes('font.family.') && !t.name.includes('.fontFamily') && !t.name.includes('font.weight.'));
    
    // Group typography styles by base name (e.g., "body.large", "heading.display")
    const groupedTypographyStyles = typographyStyleTokens.reduce((acc, token) => {
        // Extract base name (e.g., "body.large" from "body.large.fontSize")
        const baseNameMatch = token.name.match(/^(.+?)\.(fontSize|fontWeight|lineHeight|letterSpacing)$/);
        if (baseNameMatch) {
            const baseName = baseNameMatch[1];
            const property = baseNameMatch[2];
            if (!acc[baseName]) {
                acc[baseName] = { baseName, fontFamily: null, fontSize: null, fontWeight: null, lineHeight: null, letterSpacing: null };
            }
            if (property === 'fontSize') acc[baseName].fontSize = token.value;
            else if (property === 'fontWeight') acc[baseName].fontWeight = token.value;
            else if (property === 'lineHeight') acc[baseName].lineHeight = token.value;
            else if (property === 'letterSpacing') acc[baseName].letterSpacing = token.value;
        } else {
            // Also check for fontFamily property
            const fontFamilyMatch = token.name.match(/^(.+?)\.fontFamily$/);
            if (fontFamilyMatch) {
                const baseName = fontFamilyMatch[1];
                if (!acc[baseName]) {
                    acc[baseName] = { baseName, fontFamily: null, fontSize: null, fontWeight: null, lineHeight: null, letterSpacing: null };
                }
                acc[baseName].fontFamily = token.value;
            }
        }
        return acc;
    }, {} as Record<string, { baseName: string; fontFamily: string | null; fontSize: string | null; fontWeight: string | null; lineHeight: string | null; letterSpacing: string | null }>);
    
    const groupedStyles = Object.values(groupedTypographyStyles);
    
    // Sort hierarchy: H1, H2, H3, H4, H5, H6, Body, Button, Caption
    const hierarchyOrder: Record<string, number> = {
        'h1': 1, 'heading.display': 1, 'heading.large': 1,
        'h2': 2, 'heading.medium': 2,
        'h3': 3, 'heading.small': 3,
        'h4': 4,
        'h5': 5,
        'h6': 6,
        'body': 7, 'body.large': 7, 'body.medium': 7, 'body.small': 7,
        'button': 8,
        'caption': 9, 'label': 9,
    };
    
    const getHierarchyOrder = (baseName: string): number => {
        const lower = baseName.toLowerCase();
        for (const [key, order] of Object.entries(hierarchyOrder)) {
            if (lower.includes(key)) return order;
        }
        return 999; // Unknown styles go to end
    };
    
    // State for sorting
    const [hierarchySort, setHierarchySort] = useState<'asc' | 'desc' | null>(null);
    
    // Sort grouped styles
    const sortedGroupedStyles = [...groupedStyles].sort((a, b) => {
        if (hierarchySort === null) {
            // Default: sort by hierarchy order
            return getHierarchyOrder(a.baseName) - getHierarchyOrder(b.baseName);
        }
        const orderA = getHierarchyOrder(a.baseName);
        const orderB = getHierarchyOrder(b.baseName);
        return hierarchySort === 'asc' ? orderA - orderB : orderB - orderA;
    });
    
    // Get all unique properties across all styles for dynamic columns
    const allProperties = new Set<string>();
    sortedGroupedStyles.forEach(style => {
        if (style.fontSize) allProperties.add('fontSize');
        if (style.fontWeight) allProperties.add('fontWeight');
        if (style.lineHeight) allProperties.add('lineHeight');
        if (style.letterSpacing) allProperties.add('letterSpacing');
    });
    
    // Font files query
    const fontFiles = useQuery(
        api.fontFiles.list,
        projectId && effectiveTenantId && effectiveUserId
            ? { projectId, tenantId: effectiveTenantId, userId: effectiveUserId }
            : "skip"
    ) as Array<{
        _id: Id<"fontFiles">;
        _creationTime: number;
        name: string;
        fontFamily: string;
        fontUrl: string;
        format: string;
        uploadedAt: number;
    }> | undefined;
    
    // Check if font is available
    const isFontAvailable = (fontFamily: string): boolean => {
        if (!fontFiles) return false;
        return fontFiles.some(f => f.fontFamily.toLowerCase() === fontFamily.toLowerCase());
    };
    
    // Get font URL for a font family
    const getFontUrl = (fontFamily: string): string | null => {
        if (!fontFiles) return null;
        const font = fontFiles.find(f => f.fontFamily.toLowerCase() === fontFamily.toLowerCase());
        return font?.fontUrl || null;
    };

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

    // Handle file selection - parse client-side for preview only, server will parse for import
    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const content = event.target?.result as string;
                // Validate JSON format
                const json = JSON.parse(content);
                
                // Parse client-side for preview only (UX)
                const parsed = parseTokensFromJSON(json);
                
                console.log(`[TokenManager] Preview: ${parsed.length} tokens from ${file.name}`);
                
                setPreviewFileName(file.name);
                setPreviewFileContent(content); // Store raw JSON for server-side import
                setPreviewTokens(parsed); // Show preview to user
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
    
    // Handle font file upload (multiple files)
    const handleFontFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0 || !projectId || !effectiveTenantId || !effectiveUserId || !uploadingFontFamily) return;
        
        setUploadingFonts(true);
        setFontValidationStatus(null);
        const validExtensions = ['.woff', '.woff2', '.ttf', '.otf'];
        let successCount = 0;
        let errorCount = 0;
        const validationErrors: string[] = [];
        
        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
                
                if (!validExtensions.includes(fileExtension)) {
                    console.warn(`Skipping invalid file: ${file.name}`);
                    errorCount++;
                    continue;
                }
                
                // Extract font metadata to validate font family
                let detectedFontFamily = uploadingFontFamily;
                let isValidFont = true;
                
                try {
                    const metadata = await extractFontMetadata(file);
                    if (metadata.isValid && metadata.fontFamily) {
                        detectedFontFamily = metadata.fontFamily;
                        // Validate that the detected font matches the expected font family
                        if (!fontFamilyMatches(uploadingFontFamily, detectedFontFamily)) {
                            isValidFont = false;
                            validationErrors.push(`${file.name}: Detected "${detectedFontFamily}" but expected "${uploadingFontFamily}"`);
                        }
                    } else if (metadata.error) {
                        console.warn(`[Font Validation] ${file.name}: ${metadata.error}`);
                    }
                } catch (metadataError) {
                    console.warn(`[Font Validation] Failed to extract metadata from ${file.name}:`, metadataError);
                    // Continue with upload using expected font family name
                }
                
                // Convert to base64 for storage
                const base64 = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = (event) => resolve(event.target?.result as string);
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });
                
                // Extract format from extension
                const format = fileExtension === '.woff' ? 'woff' : 
                              fileExtension === '.woff2' ? 'woff2' :
                              fileExtension === '.ttf' ? 'ttf' : 'otf';
                
                // Use detected font family if available, otherwise use expected
                const finalFontFamily = detectedFontFamily || uploadingFontFamily;
                
                await createFontFile({
                    projectId,
                    tenantId: effectiveTenantId,
                    userId: effectiveUserId,
                    name: `${finalFontFamily} (${format.toUpperCase()})`,
                    originalName: file.name,
                    fontFamily: finalFontFamily,
                    fontUrl: base64,
                    format: format as 'woff' | 'woff2' | 'ttf' | 'otf',
                });
                
                successCount++;
            }
            
            if (successCount > 0) {
                const message = validationErrors.length > 0
                    ? `Uploaded ${successCount} file(s) with warnings:\n${validationErrors.join('\n')}`
                    : `Successfully uploaded ${successCount} font file(s) for ${uploadingFontFamily}${errorCount > 0 ? ` (${errorCount} skipped)` : ''}`;
                alert(message);
            } else {
                alert('No valid font files were uploaded. Please upload .woff, .woff2, .ttf, or .otf files.');
            }
        } catch (err) {
            console.error('[TokenManager] Font upload error:', err);
            alert(`Failed to upload font files: ${err instanceof Error ? err.message : 'Unknown error'}`);
        } finally {
            setUploadingFonts(false);
            setFontValidationStatus(null);
            setShowFontUploadModal(false);
            setUploadingFontFamily(null);
            setFontUrl('');
            if (fontInputRef.current) {
                fontInputRef.current.value = '';
            }
        }
    };
    
    // Validate font URL in real-time
    const validateFontUrl = async (url: string) => {
        if (!url.trim()) {
            setFontValidationStatus(null);
            return;
        }
        
        setFontValidationStatus({ isValidating: true, isValid: false });
        
        try {
            // Parse URL to detect service and extract info
            const parsed = await parseFontUrl(url);
            
            if (!parsed.isValid) {
                setFontValidationStatus({
                    isValidating: false,
                    isValid: false,
                    message: parsed.error || 'Invalid font URL',
                });
                return;
            }
            
            // Try to fetch and extract metadata
            try {
                const metadata = await fetchAndExtractFontMetadata(url);
                
                if (metadata.isValid && metadata.fontFamily) {
                    const matches = fontFamilyMatches(uploadingFontFamily || '', metadata.fontFamily);
                    setFontValidationStatus({
                        isValidating: false,
                        isValid: matches,
                        detectedFamily: metadata.fontFamily,
                        message: matches
                            ? `Font validated: "${metadata.fontFamily}" matches "${uploadingFontFamily}"`
                            : `Warning: Detected "${metadata.fontFamily}" but expected "${uploadingFontFamily}"`,
                    });
                } else {
                    // Use parsed font family from URL if metadata extraction failed
                    const detectedFamily = parsed.fontFamily || metadata.fontFamily || 'Unknown';
                    setFontValidationStatus({
                        isValidating: false,
                        isValid: true, // Allow upload even if validation is uncertain
                        detectedFamily,
                        message: metadata.error || `Font detected: "${detectedFamily}"`,
                    });
                }
            } catch (fetchError) {
                // If fetch fails, still allow URL if parsing succeeded
                const detectedFamily = parsed.fontFamily || 'Unknown';
                setFontValidationStatus({
                    isValidating: false,
                    isValid: true,
                    detectedFamily,
                    message: `URL parsed successfully. Font family: "${detectedFamily}"`,
                });
            }
        } catch (error) {
            setFontValidationStatus({
                isValidating: false,
                isValid: false,
                message: error instanceof Error ? error.message : 'Failed to validate URL',
            });
        }
    };
    
    // Handle font URL upload
    const handleFontUrlUpload = async () => {
        if (!fontUrl.trim() || !projectId || !effectiveTenantId || !effectiveUserId || !uploadingFontFamily) return;
        
        setUploadingFonts(true);
        
        try {
            // Parse URL
            const parsed = await parseFontUrl(fontUrl);
            
            if (!parsed.isValid) {
                alert(parsed.error || 'Invalid font URL');
                setUploadingFonts(false);
                return;
            }
            
            // Handle Google Fonts specimen URLs - fetch actual font URL
            let actualFontUrl = fontUrl;
            if (parsed.fontUrl && parsed.fontUrl.startsWith('GOOGLE_FONTS_SPECIMEN:')) {
                // Fetch the actual font URL from Google Fonts API
                const fontName = parsed.fontUrl.replace('GOOGLE_FONTS_SPECIMEN:', '');
                const metadata = await fetchAndExtractFontMetadata(parsed.fontUrl);
                if (metadata.isValid && metadata.fontFamily) {
                    // The fetchAndExtractFontMetadata will have fetched the actual URL
                    // We need to get it from the Google Fonts API
                    const googleFontsApiUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontName)}:wght@400`;
                    const response = await fetch(googleFontsApiUrl);
                    const css = await response.text();
                    const urlMatch = css.match(/url\(([^)]+)\)/);
                    if (urlMatch && urlMatch[1]) {
                        actualFontUrl = urlMatch[1].replace(/['"]/g, '');
                    }
                }
            }
            
            // Try to extract metadata for validation
            let detectedFontFamily = uploadingFontFamily;
            let validationWarning = '';
            
            try {
                const metadata = await fetchAndExtractFontMetadata(parsed.fontUrl.startsWith('GOOGLE_FONTS_SPECIMEN:') ? parsed.fontUrl : fontUrl);
                if (metadata.isValid && metadata.fontFamily) {
                    detectedFontFamily = metadata.fontFamily;
                    if (!fontFamilyMatches(uploadingFontFamily, detectedFontFamily)) {
                        validationWarning = `\nWarning: Detected "${detectedFontFamily}" but expected "${uploadingFontFamily}"`;
                    }
                }
            } catch (metadataError) {
                // Use parsed font family as fallback
                if (parsed.fontFamily) {
                    detectedFontFamily = parsed.fontFamily;
                }
            }
            
            // Use detected font family if available, otherwise use expected
            const finalFontFamily = detectedFontFamily || uploadingFontFamily;
            
            await createFontFile({
                projectId,
                tenantId: effectiveTenantId,
                userId: effectiveUserId,
                name: `${finalFontFamily} (${parsed.format?.toUpperCase() || 'WOFF2'})`,
                originalName: fontUrl,
                fontFamily: finalFontFamily,
                fontUrl: actualFontUrl,
                format: parsed.format || 'woff2',
            });
            
            alert(`Font URL added successfully for ${finalFontFamily}${validationWarning}`);
            setShowFontUploadModal(false);
            setUploadingFontFamily(null);
            setFontUrl('');
            setFontValidationStatus(null);
        } catch (err) {
            console.error('[TokenManager] Font URL upload error:', err);
            alert(`Failed to add font URL: ${err instanceof Error ? err.message : 'Unknown error'}`);
        } finally {
            setUploadingFonts(false);
        }
    };

    // Confirm and import tokens from preview
    // Server will parse JSON and import tokens automatically
    const handleConfirmImport = async () => {
        if (!projectId || !effectiveTenantId || !effectiveUserId || !previewFileContent) return;
        
        try {
            // Server will parse JSON and import tokens automatically
            // No need to send parsed tokens - server handles everything
            await createFile({
                projectId,
                tenantId: effectiveTenantId,
                userId: effectiveUserId,
                name: previewFileName.replace('.json', ''),
                originalName: previewFileName,
                content: previewFileContent, // Raw JSON - server will parse
            });
            
            console.log('[TokenManager] File uploaded, server is parsing and importing tokens...');
            
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

    // Helper to find related typography tokens and build a complete typography object
    const buildTypographyFromRelatedTokens = (tokenName: string, value: string): { fontFamily: string | null; fontSize: string | null; fontWeight: string | null; lineHeight: string | null; letterSpacing: string | null } => {
        // Check if this is a typography property token (e.g., "body.large.fontFamily")
        const typographyPropertyMatch = tokenName.match(/^(.+)\.(fontFamily|fontSize|fontWeight|lineHeight|letterSpacing)$/);
        if (!typographyPropertyMatch) {
            // Not a property token, try to parse as complete typography object
            return { fontFamily: null, fontSize: null, fontWeight: null, lineHeight: null, letterSpacing: null };
        }
        
        const baseName = typographyPropertyMatch[1]; // e.g., "body.large"
        const property = typographyPropertyMatch[2]; // e.g., "fontFamily"
        
        // Find all related tokens in the same group
        const relatedTokens = (tokens || []).filter(t => 
            t.type === 'typography' && 
            t.name.startsWith(baseName + '.') &&
            (t.name.endsWith('.fontFamily') || t.name.endsWith('.fontSize') || 
             t.name.endsWith('.fontWeight') || t.name.endsWith('.lineHeight') || 
             t.name.endsWith('.letterSpacing'))
        );
        
        // Build typography object from related tokens
        const typography: { fontFamily: string | null; fontSize: string | null; fontWeight: string | null; lineHeight: string | null; letterSpacing: string | null } = {
            fontFamily: null,
            fontSize: null,
            fontWeight: null,
            lineHeight: null,
            letterSpacing: null
        };
        
        // Add current token's value
        if (property === 'fontFamily') typography.fontFamily = value;
        else if (property === 'fontSize') typography.fontSize = value;
        else if (property === 'fontWeight') typography.fontWeight = value;
        else if (property === 'lineHeight') typography.lineHeight = value;
        else if (property === 'letterSpacing') typography.letterSpacing = value;
        
        // Add values from related tokens
        for (const token of relatedTokens) {
            if (token.name.endsWith('.fontFamily')) typography.fontFamily = token.value;
            else if (token.name.endsWith('.fontSize')) typography.fontSize = token.value;
            else if (token.name.endsWith('.fontWeight')) typography.fontWeight = token.value;
            else if (token.name.endsWith('.lineHeight')) typography.lineHeight = token.value;
            else if (token.name.endsWith('.letterSpacing')) typography.letterSpacing = token.value;
        }
        
        return typography;
    };

    // Render token preview using enhanced visualization component
    const renderTokenPreview = (type: TokenType, value: string, tokenName?: string) => {
        // Use compact enhanced visualizations for table view
        if (type === 'color') {
            const isValidColor = /^(#|rgb|hsl|rgba|hsla)/.test(value.trim());
            if (isValidColor) {
                const color = parseColorForContrast(value);
                const contrastRatio = color ? getContrastRatio(color, { r: 255, g: 255, b: 255 }) : null;
                return (
                    <div className="flex items-center gap-2">
                        <div
                            className="w-10 h-10 rounded border border-zinc-200 dark:border-zinc-700 shadow-sm flex-shrink-0"
                            style={{ backgroundColor: value }}
                            title={value}
                        />
                        {contrastRatio && (
                            <div className="text-[10px] text-zinc-500 dark:text-zinc-400 hidden lg:block">
                                {contrastRatio.toFixed(1)}:1
                            </div>
                        )}
                    </div>
                );
            }
        }
        if (type === 'typography') {
            // First, try to build typography from related tokens (for property-based tokens like "body.large.fontFamily")
            let typographyProps = buildTypographyFromRelatedTokens(tokenName || '', value);
            
            // If we found related tokens, use those values
            if (typographyProps.fontFamily || typographyProps.fontSize || typographyProps.fontWeight) {
                const fontFamily = typographyProps.fontFamily || 'Inter';
                const fontSize = typographyProps.fontSize || '16px';
                const fontWeight = typographyProps.fontWeight || '400';
                const lineHeight = typographyProps.lineHeight || '1.5';
                const letterSpacing = typographyProps.letterSpacing || '0';
                
                // Determine preview text based on token name
                let previewText = 'The quick brown fox jumps over the lazy dog';
                if (tokenName) {
                    const nameLower = tokenName.toLowerCase();
                    if (nameLower.includes('heading') || nameLower.includes('title') || nameLower.includes('h1') || nameLower.includes('h2') || nameLower.includes('h3')) {
                        previewText = 'Heading Text';
                    } else if (nameLower.includes('body') || nameLower.includes('paragraph')) {
                        previewText = 'The quick brown fox jumps over the lazy dog';
                    } else if (nameLower.includes('caption') || nameLower.includes('small')) {
                        previewText = 'Caption text';
                    } else if (nameLower.includes('label')) {
                        previewText = 'Label Text';
                    } else if (nameLower.includes('button')) {
                        previewText = 'Button Text';
                    }
                }
                
                const fontSizeNum = parseFloat(fontSize);
                const showFullPreview = fontSizeNum <= 20;
                
                const displayLineHeight = lineHeight && lineHeight !== '1.5' && lineHeight !== 'normal' && lineHeight !== '1' ? lineHeight : null;
                const displayLetterSpacing = letterSpacing && letterSpacing !== '0' && letterSpacing !== '0px' && letterSpacing !== 'normal' ? letterSpacing : null;
                
                return (
                    <div className="flex flex-col gap-1.5 min-w-0 w-full">
                        <div
                            className="text-zinc-900 dark:text-white leading-tight"
                            style={{
                                fontFamily: `"${fontFamily}", -apple-system, BlinkMacSystemFont, sans-serif`,
                                fontSize,
                                fontWeight,
                                lineHeight,
                                letterSpacing,
                            }}
                        >
                            {showFullPreview ? previewText : previewText.substring(0, 20) + '...'}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-zinc-500 dark:text-zinc-400">
                            <span className="font-medium">{fontFamily}</span>
                            <span>•</span>
                            <span>{fontSize}</span>
                            <span>•</span>
                            <span className="font-mono">{fontWeight}</span>
                            {displayLineHeight && (
                                <>
                                    <span>•</span>
                                    <span>LH: {displayLineHeight}</span>
                                </>
                            )}
                            {displayLetterSpacing && (
                                <>
                                    <span>•</span>
                                    <span>LS: {displayLetterSpacing}</span>
                                </>
                            )}
                        </div>
                    </div>
                );
            }
            
            // Fallback: Try parsing as complete typography object (for tokens stored as JSON objects)
            let fontFamily: string | null = null;
            let fontSize: string | null = null;
            let fontWeight: string | null = null;
            let lineHeight: string | null = null;
            let letterSpacing: string | null = null;
            let textAlign: 'left' | 'center' | 'right' | 'justify' = 'left';
            let textTransform: 'none' | 'uppercase' | 'lowercase' | 'capitalize' = 'none';
            let textDecoration: 'none' | 'underline' | 'line-through' = 'none';
            
            // Normalize the value - handle if it's already an object or a string
            let valueToParse: any = value;
            if (typeof value === 'string') {
                try {
                    valueToParse = JSON.parse(value);
                } catch {
                    valueToParse = value;
                }
            }
            
            // If we got a parsed object, extract values
            if (valueToParse && typeof valueToParse === 'object' && !Array.isArray(valueToParse)) {
                if (valueToParse.typography) {
                    valueToParse = valueToParse.typography;
                }
                
                if (valueToParse.fontFamily) fontFamily = String(valueToParse.fontFamily).trim();
                if (!fontFamily && valueToParse.fontFamilyName) fontFamily = String(valueToParse.fontFamilyName).trim();
                if (!fontFamily && valueToParse.family) fontFamily = String(valueToParse.family).trim();
                
                if (valueToParse.fontSize !== undefined && valueToParse.fontSize !== null) {
                    fontSize = typeof valueToParse.fontSize === 'number' ? `${valueToParse.fontSize}px` : String(valueToParse.fontSize).trim();
                }
                if (!fontSize && valueToParse.size !== undefined && valueToParse.size !== null) {
                    fontSize = typeof valueToParse.size === 'number' ? `${valueToParse.size}px` : String(valueToParse.size).trim();
                }
                
                if (valueToParse.fontWeight !== undefined && valueToParse.fontWeight !== null) {
                    fontWeight = String(valueToParse.fontWeight).trim();
                }
                if (!fontWeight && valueToParse.weight !== undefined && valueToParse.weight !== null) {
                    fontWeight = String(valueToParse.weight).trim();
                }
                
                if (valueToParse.lineHeight !== undefined && valueToParse.lineHeight !== null) {
                    lineHeight = typeof valueToParse.lineHeight === 'number' ? String(valueToParse.lineHeight) : String(valueToParse.lineHeight).trim();
                }
                if (!lineHeight && valueToParse.lineHeightPx !== undefined && valueToParse.lineHeightPx !== null) {
                    lineHeight = `${valueToParse.lineHeightPx}px`;
                }
                
                if (valueToParse.letterSpacing !== undefined && valueToParse.letterSpacing !== null) {
                    letterSpacing = typeof valueToParse.letterSpacing === 'number' ? `${valueToParse.letterSpacing}px` : String(valueToParse.letterSpacing).trim();
                }
                if (!letterSpacing && valueToParse.letterSpacingPx !== undefined && valueToParse.letterSpacingPx !== null) {
                    letterSpacing = `${valueToParse.letterSpacingPx}px`;
                }
                
                if (valueToParse.textAlign) textAlign = valueToParse.textAlign;
                if (valueToParse.textTransform) textTransform = valueToParse.textTransform;
                if (valueToParse.textDecoration) textDecoration = valueToParse.textDecoration;
            }
            
            // Try CSS string parsing
            if ((!fontFamily || !fontSize) && typeof value === 'string') {
                const fontSizeMatch = value.match(/font-size:\s*([^;,\s]+)/i);
                if (fontSizeMatch && !fontSize) fontSize = fontSizeMatch[1].trim();
                
                const fontFamilyMatch = value.match(/font-family:\s*([^;,\n]+)/i);
                if (fontFamilyMatch && !fontFamily) {
                    fontFamily = fontFamilyMatch[1].trim().replace(/['"]/g, '').split(',')[0].trim();
                }
                
                const fontWeightMatch = value.match(/font-weight:\s*([^;,\s]+)/i);
                if (fontWeightMatch && !fontWeight) fontWeight = fontWeightMatch[1].trim();
                
                const lineHeightMatch = value.match(/line-height:\s*([^;,\s]+)/i);
                if (lineHeightMatch && !lineHeight) lineHeight = lineHeightMatch[1].trim();
                
                const letterSpacingMatch = value.match(/letter-spacing:\s*([^;,\s]+)/i);
                if (letterSpacingMatch && !letterSpacing) letterSpacing = letterSpacingMatch[1].trim();
            }
            
            // Try Figma style format
            if ((!fontFamily || !fontSize) && typeof value === 'string') {
                const figmaMatch = value.match(/([^\/\-]+)[\/\-](\d+)[\/\-]([^\/\-]+)/);
                if (figmaMatch) {
                    if (!fontFamily) fontFamily = figmaMatch[1].trim();
                    if (!fontSize) fontSize = `${figmaMatch[2]}px`;
                    if (!fontWeight) fontWeight = figmaMatch[3].trim();
                }
            }
            
            // Fallback to defaults only if we couldn't parse anything
            if (!fontFamily) fontFamily = 'Inter';
            if (!fontSize) fontSize = '16px';
            if (!fontWeight) fontWeight = '400';
            if (!lineHeight) lineHeight = '1.5';
            if (!letterSpacing) letterSpacing = '0';
            
            // Determine preview text based on token name or use default
            let previewText = 'The quick brown fox jumps over the lazy dog';
            if (tokenName) {
                const nameLower = tokenName.toLowerCase();
                if (nameLower.includes('heading') || nameLower.includes('title') || nameLower.includes('h1') || nameLower.includes('h2') || nameLower.includes('h3')) {
                    previewText = 'Heading Text';
                } else if (nameLower.includes('body') || nameLower.includes('paragraph')) {
                    previewText = 'The quick brown fox jumps over the lazy dog';
                } else if (nameLower.includes('caption') || nameLower.includes('small')) {
                    previewText = 'Caption text';
                } else if (nameLower.includes('label')) {
                    previewText = 'Label Text';
                } else if (nameLower.includes('button')) {
                    previewText = 'Button Text';
                }
            }
            
            // Calculate if we should show full preview or truncated
            const fontSizeNum = parseFloat(fontSize);
            const showFullPreview = fontSizeNum <= 20;
            
            // Normalize values for display
            const displayLineHeight = lineHeight && lineHeight !== '1.5' && lineHeight !== 'normal' && lineHeight !== '1' ? lineHeight : null;
            const displayLetterSpacing = letterSpacing && letterSpacing !== '0' && letterSpacing !== '0px' && letterSpacing !== 'normal' ? letterSpacing : null;
            
            return (
                <div className="flex flex-col gap-1.5 min-w-0 w-full">
                    {/* Live text preview with actual parsed values */}
                    <div
                        className="text-zinc-900 dark:text-white leading-tight"
                        style={{
                            fontFamily: `"${fontFamily}", -apple-system, BlinkMacSystemFont, sans-serif`,
                            fontSize,
                            fontWeight,
                            lineHeight,
                            letterSpacing,
                            textAlign,
                            textTransform,
                            textDecoration,
                        }}
                    >
                        {showFullPreview ? previewText : previewText.substring(0, 20) + '...'}
                    </div>
                    
                    {/* Typography details - show actual parsed values */}
                    <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-zinc-500 dark:text-zinc-400">
                        <span className="font-medium">{fontFamily}</span>
                        <span>•</span>
                        <span>{fontSize}</span>
                        <span>•</span>
                        <span className="font-mono">{fontWeight}</span>
                        {displayLineHeight && (
                            <>
                                <span>•</span>
                                <span>LH: {displayLineHeight}</span>
                            </>
                        )}
                        {displayLetterSpacing && (
                            <>
                                <span>•</span>
                                <span>LS: {displayLetterSpacing}</span>
                            </>
                        )}
                    </div>
                </div>
            );
        }
        if (type === 'spacing' || type === 'sizing') {
            const spacing = parseSpacingValue(value);
            return (
                <div className="flex items-center gap-2">
                    <div className="flex items-center justify-center w-12 h-12 bg-zinc-100 dark:bg-zinc-800 rounded border border-zinc-200 dark:border-zinc-700">
                        <div
                            className="bg-purple-500 rounded"
                            style={{
                                width: Math.min(spacing, 32),
                                height: Math.min(spacing, 32),
                                minWidth: Math.min(spacing, 32),
                                minHeight: Math.min(spacing, 32),
                            }}
                        />
                    </div>
                    <div className="text-[10px] text-zinc-500 dark:text-zinc-400 hidden lg:block">
                        {spacing}px
                    </div>
                </div>
            );
        }
        if (type === 'radius') {
            const radius = parseSpacingValue(value);
            return (
                <div className="flex items-center gap-2">
                    <div className="flex items-center justify-center w-12 h-12 bg-zinc-100 dark:bg-zinc-800 rounded border border-zinc-200 dark:border-zinc-700">
                        <div
                            className="bg-purple-500 w-8 h-8"
                            style={{
                                borderRadius: radius,
                            }}
                        />
                    </div>
                    <div className="text-[10px] text-zinc-500 dark:text-zinc-400 hidden lg:block">
                        {radius}px
                    </div>
                </div>
            );
        }
        if (type === 'shadow') {
            return (
                <div className="flex items-center gap-2">
                    <div className="flex items-center justify-center w-12 h-12 bg-zinc-100 dark:bg-zinc-800 rounded border border-zinc-200 dark:border-zinc-700">
                        <div
                            className="bg-white dark:bg-zinc-700 rounded w-8 h-8"
                            style={{
                                boxShadow: value,
                            }}
                        />
                    </div>
                </div>
            );
        }
        return <div className="w-10 h-10 bg-zinc-100 dark:bg-zinc-800 rounded flex items-center justify-center text-[8px] text-zinc-400 flex-shrink-0">?</div>;
    };

    // Helper functions for parsing
    const parseColorForContrast = (value: string): { r: number; g: number; b: number } | null => {
        const hexMatch = value.match(/#([0-9a-f]{6})/i);
        if (hexMatch) {
            return {
                r: parseInt(hexMatch[1].substring(0, 2), 16),
                g: parseInt(hexMatch[1].substring(2, 4), 16),
                b: parseInt(hexMatch[1].substring(4, 6), 16),
            };
        }
        const rgbaMatch = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (rgbaMatch) {
            return {
                r: parseInt(rgbaMatch[1], 10),
                g: parseInt(rgbaMatch[2], 10),
                b: parseInt(rgbaMatch[3], 10),
            };
        }
        return null;
    };

    const getContrastRatio = (color1: { r: number; g: number; b: number }, color2: { r: number; g: number; b: number }): number => {
        const l1 = getLuminance(color1);
        const l2 = getLuminance(color2);
        const lighter = Math.max(l1, l2);
        const darker = Math.min(l1, l2);
        return (lighter + 0.05) / (darker + 0.05);
    };

    const getLuminance = (color: { r: number; g: number; b: number }): number => {
        const [r, g, b] = [color.r, color.g, color.b].map(val => {
            val = val / 255;
            return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };

    const parseSpacingValue = (value: string): number => {
        const match = value.match(/(\d+(?:\.\d+)?)\s*px/);
        if (match) return parseFloat(match[1]);
        const numMatch = value.match(/(\d+(?:\.\d+)?)/);
        if (numMatch) return parseFloat(numMatch[1]);
        return 16;
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
                <div className="h-16 px-6 border-b border-zinc-200/60 dark:border-zinc-800/60 bg-white dark:bg-zinc-900 z-10 flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">Tokens</h2>
                    <div className="flex items-center gap-2">
                        {/* Mode Switcher */}
                        <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1">
                            <button
                                onClick={() => setTokenMode('light')}
                                title="Light Mode"
                                className={`p-1.5 rounded transition-colors ${
                                    tokenMode === 'light'
                                        ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm'
                                        : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                                }`}
                            >
                                <Sun size={14} />
                            </button>
                            <button
                                onClick={() => setTokenMode('dark')}
                                title="Dark Mode"
                                className={`p-1.5 rounded transition-colors ${
                                    tokenMode === 'dark'
                                        ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm'
                                        : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                                }`}
                            >
                                <Moon size={14} />
                            </button>
                            <button
                                onClick={() => setTokenMode('high-contrast')}
                                title="High Contrast Mode"
                                className={`p-1.5 rounded transition-colors ${
                                    tokenMode === 'high-contrast'
                                        ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm'
                                        : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                                }`}
                            >
                                <Monitor size={14} />
                            </button>
                        </div>
                        
                        {/* Dependency Graph Toggle */}
                        <button
                            onClick={() => setShowDependencyGraph(!showDependencyGraph)}
                            title="Toggle Dependency Graph"
                            className={`p-1.5 rounded transition-colors ${
                                showDependencyGraph
                                    ? 'bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400'
                                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800'
                            }`}
                        >
                            <Network size={16} />
                        </button>
                        
                        <input 
                            type="file" 
                            accept=".json" 
                            ref={fileInputRef} 
                            className="hidden" 
                            onChange={handleFileSelect}
                        />
                        <input 
                            type="file" 
                            accept=".woff,.woff2,.ttf,.otf" 
                            ref={fontInputRef} 
                            className="hidden" 
                            onChange={handleFontFileSelect}
                            multiple
                        />
                        <button 
                            onClick={() => setShowExportModal(true)}
                            title="Export Tokens"
                            className="p-1.5 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors"
                        >
                            <Download size={16} />
                        </button>
                    </div>
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
                        
                        {/* Dependency Graph View */}
                        {!isLoadingTokens && showDependencyGraph && tokens && tokens.length > 0 && (
                            <TokenDependencyGraph
                                tokens={tokens}
                                selectedToken={selectedTokenId}
                                onTokenSelect={setSelectedTokenId}
                            />
                        )}
                        
                        {/* Typography Tab - Special Layout */}
                        {!isLoadingTokens && !showDependencyGraph && activeTab === 'typography' && (
                            <>
                                {/* Font Families Section */}
                                {uniqueFontFamilies.length > 0 && (
                                    <div className="mb-6">
                                        <h3 className="text-sm font-medium text-zinc-900 dark:text-white mb-3">Font Families</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {uniqueFontFamilies.map(token => {
                                                const fontFamily = token.value;
                                                const fontAvailable = isFontAvailable(fontFamily);
                                                const fontUrl = getFontUrl(fontFamily);
                                                
                                                return (
                                                    <div key={token._id} className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/60 rounded-lg p-4 shadow-sm relative">
                                                        {!fontAvailable && (
                                                            <button
                                                                onClick={() => {
                                                                    setUploadingFontFamily(fontFamily);
                                                                    setShowFontUploadModal(true);
                                                                    setFontUploadMethod('url');
                                                                    setFontUrl('');
                                                                }}
                                                                className="absolute top-2 right-2 p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors"
                                                                title="Upload font file"
                                                            >
                                                                <Upload size={14} />
                                                            </button>
                                                        )}
                                                        {fontUrl && (
                                                            <style>{`
                                                                @font-face {
                                                                    font-family: "${fontFamily}";
                                                                    src: url("${fontUrl}") format("woff2");
                                                                }
                                                            `}</style>
                                                        )}
                                                        <div 
                                                            className="text-4xl font-normal text-zinc-900 dark:text-white mb-2" 
                                                            style={{ 
                                                                fontFamily: fontUrl ? `"${fontFamily}"` : `"${fontFamily}", -apple-system, BlinkMacSystemFont, sans-serif`
                                                            }}
                                                        >
                                                            Aa
                                                        </div>
                                                        <div className="text-sm font-medium text-zinc-900 dark:text-white">{fontFamily}</div>
                                                        {!fontAvailable && (
                                                            <div className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">Font file not uploaded</div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                                
                                {/* Typography Styles Table */}
                                {sortedGroupedStyles.length > 0 ? (
                                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/60 rounded-lg overflow-hidden">
                                        <table className="w-full text-left text-sm">
                                            <thead className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200/60 dark:border-zinc-800/60">
                                                <tr>
                                                    <th className="px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400 text-xs">
                                                        <button
                                                            onClick={() => {
                                                                if (hierarchySort === null) setHierarchySort('asc');
                                                                else if (hierarchySort === 'asc') setHierarchySort('desc');
                                                                else setHierarchySort(null);
                                                            }}
                                                            className="flex items-center gap-1 hover:text-zinc-900 dark:hover:text-white transition-colors"
                                                        >
                                                            Hierarchy
                                                            {hierarchySort === null && <ArrowUpDown size={12} />}
                                                            {hierarchySort === 'asc' && <ArrowUp size={12} />}
                                                            {hierarchySort === 'desc' && <ArrowDown size={12} />}
                                                        </button>
                                                    </th>
                                                    <th className="px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400 text-xs">Weight</th>
                                                    <th className="px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400 text-xs">Size</th>
                                                    {allProperties.has('lineHeight') && (
                                                        <th className="px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400 text-xs">Line Height</th>
                                                    )}
                                                    {allProperties.has('letterSpacing') && (
                                                        <th className="px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400 text-xs">Letter Spacing</th>
                                                    )}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                                {sortedGroupedStyles.map((style, index) => {
                                                    const fontFamily = style.fontFamily || 'Inter';
                                                    const fontSize = style.fontSize || '16px';
                                                    const fontWeight = style.fontWeight || '400';
                                                    const lineHeight = style.lineHeight || '1.5';
                                                    const letterSpacing = style.letterSpacing || null;
                                                    
                                                    // Determine hierarchy name from base name
                                                    let hierarchyName = style.baseName;
                                                    let hierarchyOrder = getHierarchyOrder(style.baseName);
                                                    
                                                    if (style.baseName.includes('heading') || style.baseName.includes('h1') || style.baseName.includes('h2') || style.baseName.includes('h3') || style.baseName.includes('h4') || style.baseName.includes('h5') || style.baseName.includes('h6')) {
                                                        const match = style.baseName.match(/(h[1-6]|heading)\.?(\w+)?/i);
                                                        if (match) {
                                                            const level = match[1].toLowerCase();
                                                            const variant = match[2] ? match[2].charAt(0).toUpperCase() + match[2].slice(1) : '';
                                                            hierarchyName = `${level.toUpperCase()}${variant ? ' ' + variant : ''} headline`;
                                                        }
                                                    } else if (style.baseName.includes('body')) {
                                                        const match = style.baseName.match(/body\.?(\w+)?/i);
                                                        if (match) {
                                                            const variant = match[1] ? match[1].charAt(0).toUpperCase() + match[1].slice(1) : 'Medium';
                                                            hierarchyName = `Body ${variant}`;
                                                        }
                                                    } else if (style.baseName.includes('button')) {
                                                        hierarchyName = 'Button';
                                                    } else if (style.baseName.includes('caption') || style.baseName.includes('label')) {
                                                        hierarchyName = style.baseName.charAt(0).toUpperCase() + style.baseName.slice(1);
                                                    }
                                                    
                                                    // Map font weight to readable names
                                                    const weightMap: Record<string, string> = {
                                                        '100': 'Thin',
                                                        '200': 'Extra Light',
                                                        '300': 'Light',
                                                        '400': 'Regular',
                                                        '450': 'Medium',
                                                        '500': 'Medium',
                                                        '550': 'Semibold',
                                                        '600': 'Semibold',
                                                        '700': 'Bold',
                                                        '800': 'Extra Bold',
                                                        '900': 'Black'
                                                    };
                                                    const weightName = weightMap[fontWeight] || fontWeight;
                                                    
                                                    // Extract numeric values
                                                    const sizeNum = fontSize.replace('px', '');
                                                    const lineHeightNum = lineHeight.replace('px', '').replace(/^(\d+(?:\.\d+)?)$/, '$1');
                                                    const letterSpacingNum = letterSpacing ? letterSpacing.replace('px', '') : null;
                                                    
                                                    const fontUrl = getFontUrl(fontFamily);
                                                    
                                                    return (
                                                        <tr key={index} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                                                            <td className="px-4 py-3">
                                                                {fontUrl && (
                                                                    <style>{`
                                                                        @font-face {
                                                                            font-family: "${fontFamily}";
                                                                            src: url("${fontUrl}") format("woff2");
                                                                        }
                                                                    `}</style>
                                                                )}
                                                                <div 
                                                                    className="text-zinc-900 dark:text-white font-medium"
                                                                    style={{
                                                                        fontFamily: fontUrl ? `"${fontFamily}"` : `"${fontFamily}", -apple-system, BlinkMacSystemFont, sans-serif`,
                                                                        fontSize,
                                                                        fontWeight,
                                                                        lineHeight,
                                                                    }}
                                                                >
                                                                    {hierarchyName}
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400 text-sm">
                                                                {weightName} • {fontWeight}
                                                            </td>
                                                            <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400 text-sm">{sizeNum}</td>
                                                            {allProperties.has('lineHeight') && (
                                                                <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400 text-sm">{lineHeightNum}</td>
                                                            )}
                                                            {allProperties.has('letterSpacing') && (
                                                                <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400 text-sm">{letterSpacingNum || '-'}</td>
                                                            )}
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : uniqueFontFamilies.length === 0 && (
                                    <div className="w-full py-12 text-center text-zinc-500 dark:text-zinc-400 text-sm border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg">
                                        No typography tokens found. Upload a JSON file to get started.
                                    </div>
                                )}
                            </>
                        )}
                        
                        {/* Other Tabs - Standard Layout */}
                        {!isLoadingTokens && !showDependencyGraph && activeTab !== 'typography' && (
                            <>
                                {/* Empty State */}
                                {filteredTokens.length === 0 && (
                                    <div className="w-full py-12 text-center text-zinc-500 dark:text-zinc-400 text-sm border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg">
                                        No {activeTab} tokens found. Upload a JSON file to get started.
                                    </div>
                                )}

                                {/* Token List */}
                                {filteredTokens.length > 0 && (
                                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/60 rounded-lg overflow-hidden">
                                        <table className="w-full text-left text-sm">
                                            <thead className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200/60 dark:border-zinc-800/60">
                                                <tr>
                                                    <th className="px-4 py-2 font-medium text-zinc-500 dark:text-zinc-400 text-xs w-48">Preview</th>
                                                    <th className="px-4 py-2 font-medium text-zinc-500 dark:text-zinc-400 text-xs">Name</th>
                                                    <th className="px-4 py-2 font-medium text-zinc-500 dark:text-zinc-400 text-xs">Value</th>
                                                    <th className="px-4 py-2 font-medium text-zinc-500 dark:text-zinc-400 text-xs text-right w-20">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                                {filteredTokens.map(token => (
                                                    <tr 
                                                        key={token._id} 
                                                        className={`group hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer transition-colors ${
                                                            selectedTokenId === token._id ? 'bg-purple-50 dark:bg-purple-900/10' : ''
                                                        }`}
                                                        onClick={() => setSelectedTokenId(selectedTokenId === token._id ? undefined : token._id)}
                                                    >
                                                        <td className="px-4 py-3 max-w-[200px]">
                                                            {renderTokenPreview(token.type as TokenType, token.value, token.name)}
                                                        </td>
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
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Files Side Panel */}
            <div className="w-72 border-l border-zinc-200/60 dark:border-zinc-800/60 bg-white dark:bg-zinc-900 flex flex-col">
                <div className="h-16 px-6 border-b border-zinc-200/60 dark:border-zinc-800/60 flex items-center justify-between">
                    <h3 className="text-sm font-medium text-zinc-900 dark:text-white">Source Files</h3>
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        title="Upload JSON File"
                        className="p-1.5 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors"
                    >
                        <Upload size={14} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                        {/* Loading State */}
                        {isLoadingFiles ? (
                            <FileSkeleton count={3} />
                        ) : (!tokenFiles || tokenFiles.length === 0) && (!fontFiles || fontFiles.length === 0) ? (
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
                                {/* Token Files */}
                                {tokenFiles && tokenFiles.map((file) => (
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
                                
                                {/* Font Files */}
                                {fontFiles && fontFiles.length > 0 && (
                                    <>
                                        <div className="pt-4 mt-4 border-t border-zinc-200/60 dark:border-zinc-800/60">
                                            <h4 className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2 uppercase tracking-wide">Font Files</h4>
                                        </div>
                                        {fontFiles.map((font) => (
                                            <div 
                                                key={font._id} 
                                                className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-800/60"
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium text-zinc-900 dark:text-white truncate" title={font.name}>
                                                            {font.fontFamily}
                                                        </p>
                                                        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                                                            {font.format.toUpperCase()} · {formatRelativeTime(font.uploadedAt || font._creationTime)}
                                                        </p>
                                                    </div>
                                                    <button
                                                        onClick={async () => {
                                                            if (!projectId || !effectiveTenantId || !effectiveUserId) return;
                                                            if (!confirm(`Delete font file for ${font.fontFamily}?`)) return;
                                                            try {
                                                                await removeFontFile({ id: font._id, tenantId: effectiveTenantId, userId: effectiveUserId });
                                                            } catch (error) {
                                                                console.error('Failed to delete font file:', error);
                                                            }
                                                        }}
                                                        className="p-1 text-zinc-400 hover:text-red-500 rounded hover:bg-zinc-200/50 dark:hover:bg-zinc-700/50 transition-colors"
                                                        title="Delete font file"
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </>
                                )}
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

            {/* Font Upload Modal */}
            {showFontUploadModal && uploadingFontFamily && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl w-full max-w-md border border-zinc-200/60 dark:border-zinc-800/60">
                        <div className="p-4 border-b border-zinc-200/60 dark:border-zinc-800/60">
                            <div className="flex justify-between items-center">
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-white truncate">Upload Font</h3>
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">
                                        {uploadingFontFamily}
                                    </p>
                                </div>
                                <button 
                                    onClick={() => {
                                        setShowFontUploadModal(false);
                                        setUploadingFontFamily(null);
                                        setFontUrl('');
                                        setFontUploadMethod('url');
                                        setFontValidationStatus(null);
                                    }} 
                                    className="ml-3 p-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-white flex-shrink-0"
                                    disabled={uploadingFonts}
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        </div>
                        
                        <div className="p-4 space-y-3">
                            {/* Method Toggle */}
                            <div className="flex gap-1.5 bg-zinc-100 dark:bg-zinc-800 rounded p-0.5">
                                <button
                                    onClick={() => {
                                        setFontUploadMethod('url');
                                        setFontUrl('');
                                        setFontValidationStatus(null);
                                    }}
                                    className={`flex-1 py-1.5 px-2.5 text-xs font-medium rounded transition-colors ${
                                        fontUploadMethod === 'url'
                                            ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm'
                                            : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                                    }`}
                                    disabled={uploadingFonts}
                                >
                                    URL
                                </button>
                                <button
                                    onClick={() => {
                                        setFontUploadMethod('file');
                                        setFontUrl('');
                                        setFontValidationStatus(null);
                                    }}
                                    className={`flex-1 py-1.5 px-2.5 text-xs font-medium rounded transition-colors ${
                                        fontUploadMethod === 'file'
                                            ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm'
                                            : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                                    }`}
                                    disabled={uploadingFonts}
                                >
                                    Files
                                </button>
                            </div>
                            
                            {/* URL Input */}
                            {fontUploadMethod === 'url' && (
                                <div className="space-y-2">
                                    <div>
                                        <input
                                            type="url"
                                            value={fontUrl}
                                            onChange={(e) => {
                                                setFontUrl(e.target.value);
                                                // Clear previous timeout
                                                if (validationTimeoutRef.current) {
                                                    clearTimeout(validationTimeoutRef.current);
                                                }
                                                // Debounce validation
                                                validationTimeoutRef.current = setTimeout(() => {
                                                    validateFontUrl(e.target.value);
                                                }, 500);
                                            }}
                                            placeholder="https://fonts.gstatic.com/s/inter/v18/..."
                                            className="w-full h-8 px-2.5 border border-zinc-200/60 dark:border-zinc-700/60 rounded text-xs bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:border-violet-500"
                                            disabled={uploadingFonts}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && !uploadingFonts && fontUrl.trim()) {
                                                    handleFontUrlUpload();
                                                }
                                            }}
                                        />
                                        {/* Validation Status */}
                                        {fontValidationStatus ? (
                                            <div className={`mt-1.5 flex items-start gap-1.5 text-[10px] ${
                                                fontValidationStatus.isValidating
                                                    ? 'text-zinc-500 dark:text-zinc-400'
                                                    : fontValidationStatus.isValid
                                                    ? 'text-green-600 dark:text-green-400'
                                                    : 'text-amber-600 dark:text-amber-400'
                                            }`}>
                                                {fontValidationStatus.isValidating ? (
                                                    <>
                                                        <div className="animate-spin h-3 w-3 border-2 border-zinc-400 border-t-transparent rounded-full mt-0.5 flex-shrink-0"></div>
                                                        <span>Validating...</span>
                                                    </>
                                                ) : fontValidationStatus.isValid ? (
                                                    <>
                                                        <CheckCircle2 size={12} className="flex-shrink-0 mt-0.5" />
                                                        <span className="flex-1">{fontValidationStatus.message || 'Font validated'}</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <AlertCircle size={12} className="flex-shrink-0 mt-0.5" />
                                                        <span className="flex-1">{fontValidationStatus.message || 'Invalid font URL'}</span>
                                                    </>
                                                )}
                                            </div>
                                        ) : null}
                                    </div>
                                    <button
                                        onClick={handleFontUrlUpload}
                                        disabled={!fontUrl.trim() || uploadingFonts || (fontValidationStatus ? !fontValidationStatus.isValidating && !fontValidationStatus.isValid : false)}
                                        className="w-full h-8 px-3 text-xs font-medium bg-violet-600 text-white rounded hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        {uploadingFonts ? 'Uploading...' : 'Add Font URL'}
                                    </button>
                                </div>
                            )}
                            
                            {/* File Upload */}
                            {fontUploadMethod === 'file' && (
                                <div className="space-y-2">
                                    <div className="border border-dashed border-zinc-300 dark:border-zinc-700 rounded p-4 text-center">
                                        <Upload size={18} className="mx-auto text-zinc-400 mb-1.5" />
                                        <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-0.5">
                                            Select font files
                                        </p>
                                        <p className="text-[10px] text-zinc-500 dark:text-zinc-500 mb-2">
                                            .woff, .woff2, .ttf, .otf (multiple)
                                        </p>
                                        <button
                                            onClick={() => fontInputRef.current?.click()}
                                            disabled={uploadingFonts}
                                            className="px-3 py-1 text-xs font-medium bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                            {uploadingFonts ? 'Uploading...' : 'Select Files'}
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 text-center">
                                        Font metadata will be extracted and validated automatically
                                    </p>
                                </div>
                            )}
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
