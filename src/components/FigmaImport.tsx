import React, { useState, useRef } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { TokenType } from '../types';
import { Upload, FileJson, Check, AlertCircle, X, Loader2, Figma } from 'lucide-react';

interface FigmaImportProps {
    isOpen: boolean;
    onClose: () => void;
}

interface FigmaVariablesFile {
    brand?: string;
    theme?: string;
    modeName?: string;
    modeId?: string;
    tokens: Record<string, string>;
}

interface ParsedToken {
    name: string;
    value: string;
    type: TokenType;
    category?: string;
    brand?: string;
}

export const FigmaImport: React.FC<FigmaImportProps> = ({ isOpen, onClose }) => {
    const [dragActive, setDragActive] = useState(false);
    const [importing, setImporting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [preview, setPreview] = useState<ParsedToken[] | null>(null);
    const [rawFile, setRawFile] = useState<FigmaVariablesFile | null>(null);
    const [replaceExisting, setReplaceExisting] = useState(false);
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const bulkImport = useMutation(api.tokens.bulkImport);

    if (!isOpen) return null;

    const inferTokenType = (figmaPath: string, value: string): TokenType => {
        const path = figmaPath.toLowerCase();
        
        // Check path patterns
        if (path.includes('/bg/') || path.includes('/_bg/') || path.includes('background')) {
            return 'color';
        }
        if (path.includes('/text/') || path.includes('/_text/') || path.includes('/icon/') || path.includes('/_icon/')) {
            return 'color';
        }
        if (path.includes('/border/') || path.includes('/_border/')) {
            return 'color';
        }
        if (path.includes('multiplayer') || path.includes('color')) {
            return 'color';
        }
        if (path.includes('space') || path.includes('spacing') || path.includes('padding') || path.includes('gap')) {
            return 'spacing';
        }
        if (path.includes('radius') || path.includes('corner')) {
            return 'radius';
        }
        if (path.includes('font') || path.includes('text-') || path.includes('typography') || path.includes('line-height') || path.includes('letter-spacing')) {
            return 'typography';
        }
        if (path.includes('size') || path.includes('width') || path.includes('height')) {
            return 'sizing';
        }
        if (path.includes('shadow') || path.includes('elevation')) {
            return 'shadow';
        }
        if (path.includes('blur')) {
            return 'blur';
        }
        
        // Check value patterns
        if (value.startsWith('#') || value.startsWith('rgb') || value.startsWith('hsl')) {
            return 'color';
        }
        if (value.endsWith('px') || value.endsWith('rem') || value.endsWith('em')) {
            // Could be spacing, sizing, or typography
            if (path.includes('font') || path.includes('text')) {
                return 'typography';
            }
            return 'spacing';
        }
        
        return 'unknown';
    };

    const cleanTokenName = (figmaPath: string): string => {
        // Remove Figma prefix symbols like ✦, _
        let name = figmaPath
            .replace(/^✦\//, '')
            .replace(/^_/, '')
            .replace(/\//g, '-')
            .replace(/^-+/, '')
            .toLowerCase();
        
        return name;
    };

    const extractCategory = (figmaPath: string): string => {
        const parts = figmaPath.split('/').filter(p => p && !p.startsWith('✦'));
        if (parts.length > 0) {
            return parts[0].replace(/^_/, '');
        }
        return 'other';
    };

    const parseFigmaVariables = (file: FigmaVariablesFile): ParsedToken[] => {
        const tokens: ParsedToken[] = [];
        
        for (const [figmaPath, value] of Object.entries(file.tokens)) {
            const type = inferTokenType(figmaPath, value);
            const name = cleanTokenName(figmaPath);
            const category = extractCategory(figmaPath);
            
            tokens.push({
                name,
                value,
                type,
                category,
                brand: file.brand,
            });
        }
        
        return tokens;
    };

    const handleFile = (file: File) => {
        setError(null);
        
        if (!file.name.endsWith('.json')) {
            setError('Please upload a JSON file');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const json = JSON.parse(e.target?.result as string);
                
                // Check if it's a Figma Variables format
                if (json.tokens && typeof json.tokens === 'object') {
                    setRawFile(json);
                    const parsed = parseFigmaVariables(json);
                    setPreview(parsed);
                } else {
                    setError('Invalid Figma Variables format. Expected { tokens: { ... } }');
                }
            } catch (err) {
                setError('Failed to parse JSON file');
            }
        };
        reader.readAsText(file);
    };

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFile(e.dataTransfer.files[0]);
        }
    };

    const handleImport = async () => {
        if (!preview) return;
        
        setImporting(true);
        setError(null);
        
        try {
            const tokensToImport = preview.map(t => ({
                name: t.name,
                value: t.value,
                type: t.type,
                brand: t.brand,
            }));
            
            await bulkImport({
                tokens: tokensToImport,
                clearExisting: replaceExisting,
            });
            
            onClose();
        } catch (err) {
            setError('Failed to import tokens');
        } finally {
            setImporting(false);
        }
    };

    const groupedPreview = preview?.reduce((acc, token) => {
        const type = token.type;
        if (!acc[type]) acc[type] = [];
        acc[type].push(token);
        return acc;
    }, {} as Record<TokenType, ParsedToken[]>);

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col border border-zinc-200 dark:border-zinc-800">
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-zinc-900 flex items-center justify-center">
                            <Figma size={20} className="text-white" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">Import Figma Variables</h3>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">Upload a Figma Variables JSON export</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white p-1">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4">
                    {!preview ? (
                        <>
                            {/* Upload Zone */}
                            <div
                                className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                                    dragActive 
                                        ? 'border-violet-500 bg-violet-500/5' 
                                        : 'border-zinc-300 dark:border-zinc-700 hover:border-violet-500/50'
                                }`}
                                onDragEnter={handleDrag}
                                onDragLeave={handleDrag}
                                onDragOver={handleDrag}
                                onDrop={handleDrop}
                            >
                                <input
                                    type="file"
                                    accept=".json"
                                    ref={fileInputRef}
                                    className="hidden"
                                    onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                                />
                                
                                <div className="w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center mx-auto mb-4">
                                    <FileJson size={28} className="text-zinc-400 dark:text-zinc-500" />
                                </div>
                                
                                <p className="text-zinc-900 dark:text-white font-medium mb-1">
                                    Drop your Figma Variables JSON here
                                </p>
                                <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
                                    or click to browse
                                </p>
                                
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700"
                                >
                                    Select File
                                </button>
                            </div>

                            {/* Instructions */}
                            <div className="mt-6 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
                                <h4 className="text-sm font-medium text-zinc-900 dark:text-white mb-2">How to export from Figma:</h4>
                                <ol className="text-xs text-zinc-500 dark:text-zinc-400 space-y-1.5 list-decimal list-inside">
                                    <li>Open your Figma file with Variables</li>
                                    <li>Go to the Variables panel (right sidebar)</li>
                                    <li>Click the menu (⋯) and select "Export variables"</li>
                                    <li>Choose JSON format and download</li>
                                    <li>Upload the JSON file here</li>
                                </ol>
                                
                                <div className="mt-3 p-3 bg-white dark:bg-zinc-900 rounded border border-zinc-200 dark:border-zinc-700">
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Expected format:</p>
                                    <pre className="text-[10px] text-zinc-900 dark:text-white font-mono overflow-x-auto">
{`{
  "brand": "default",
  "theme": "light",
  "tokens": {
    "✦/bg/brand/default": "#0D99FF",
    "✦/_text/text-default": "rgba(0, 0, 0, 0.9)",
    ...
  }
}`}
                                    </pre>
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            {/* Preview */}
                            <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center gap-3">
                                <Check size={20} className="text-green-500" />
                                <div>
                                    <p className="text-sm font-medium text-green-600 dark:text-green-400">
                                        {preview.length} tokens found
                                    </p>
                                    {rawFile?.brand && (
                                        <p className="text-xs text-green-600/70 dark:text-green-400/70">
                                            Brand: {rawFile.brand} • Theme: {rawFile.theme || 'default'}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Token Groups */}
                            <div className="space-y-4">
                                {groupedPreview && Object.entries(groupedPreview).map(([type, tokens]) => (
                                    <div key={type} className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden">
                                        <div className="bg-zinc-50 dark:bg-zinc-800/50 px-3 py-2 border-b border-zinc-200 dark:border-zinc-700 flex justify-between items-center">
                                            <span className="text-xs font-medium text-zinc-900 dark:text-white capitalize">{type}</span>
                                            <span className="text-xs text-zinc-500 dark:text-zinc-400">{tokens.length} tokens</span>
                                        </div>
                                        <div className="max-h-48 overflow-y-auto">
                                            <table className="w-full text-xs">
                                                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
                                                    {tokens.slice(0, 10).map((token, i) => (
                                                        <tr key={i} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                                                            <td className="px-3 py-2 font-mono text-zinc-900 dark:text-white">{token.name}</td>
                                                            <td className="px-3 py-2 font-mono text-zinc-500 dark:text-zinc-400">{token.value}</td>
                                                            <td className="px-3 py-2 w-8">
                                                                {type === 'color' && (
                                                                    <div 
                                                                        className="w-5 h-5 rounded border border-zinc-200 dark:border-zinc-600"
                                                                        style={{ backgroundColor: token.value }}
                                                                    />
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                    {tokens.length > 10 && (
                                                        <tr>
                                                            <td colSpan={3} className="px-3 py-2 text-zinc-500 dark:text-zinc-400 text-center">
                                                                +{tokens.length - 10} more tokens
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Options */}
                            <div className="mt-4 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={replaceExisting}
                                        onChange={(e) => setReplaceExisting(e.target.checked)}
                                        className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-600"
                                    />
                                    <span className="text-sm text-zinc-900 dark:text-white">Replace existing tokens</span>
                                </label>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 ml-6">
                                    {replaceExisting 
                                        ? 'All existing tokens will be replaced'
                                        : 'New tokens will be added to existing ones'
                                    }
                                </p>
                            </div>
                        </>
                    )}

                    {/* Error */}
                    {error && (
                        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2">
                            <AlertCircle size={16} className="text-red-500" />
                            <span className="text-sm text-red-600">{error}</span>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex justify-between items-center p-4 border-t border-zinc-200 dark:border-zinc-800">
                    <button
                        onClick={() => {
                            setPreview(null);
                            setRawFile(null);
                            setError(null);
                        }}
                        className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                        disabled={!preview}
                    >
                        {preview ? 'Upload different file' : ''}
                    </button>
                    
                    <div className="flex gap-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                        >
                            Cancel
                        </button>
                        {preview && (
                            <button
                                onClick={handleImport}
                                disabled={importing}
                                className="px-4 py-2 text-sm font-medium bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 flex items-center gap-2"
                            >
                                {importing && <Loader2 size={14} className="animate-spin" />}
                                Import {preview.length} Tokens
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

