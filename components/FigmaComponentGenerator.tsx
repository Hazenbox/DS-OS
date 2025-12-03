import React, { useState } from 'react';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Token } from '../types';
import { Figma, Loader2, AlertCircle, Check, ExternalLink, X, Sparkles, Settings, Layers, Box, Palette } from 'lucide-react';

interface FigmaComponentGeneratorProps {
    isOpen: boolean;
    onClose: () => void;
    tokens: Token[];
    onComponentGenerated?: (componentId: string) => void;
}

interface FigmaNodeInfo {
    fileKey: string;
    nodeId: string;
}

export const FigmaComponentGenerator: React.FC<FigmaComponentGeneratorProps> = ({ 
    isOpen, 
    onClose, 
    tokens,
    onComponentGenerated 
}) => {
    const [figmaUrl, setFigmaUrl] = useState('');
    const [step, setStep] = useState<'input' | 'fetching' | 'preview' | 'generating' | 'success' | 'error'>('input');
    const [error, setError] = useState<string | null>(null);
    const [nodeInfo, setNodeInfo] = useState<FigmaNodeInfo | null>(null);
    const [extractedProps, setExtractedProps] = useState<any>(null);
    const [generatedCode, setGeneratedCode] = useState<string | null>(null);

    // Convex
    const figmaPatStatus = useQuery(api.figma.getFigmaPatStatus);
    const figmaPat = useQuery(api.figma.getFigmaPat);
    const fetchFigmaNode = useAction(api.figma.fetchFigmaNode);
    const generateCode = useAction(api.figma.generateComponentCode);
    const createComponent = useMutation(api.components.create);

    if (!isOpen) return null;

    const parseFigmaUrl = (url: string): FigmaNodeInfo | null => {
        try {
            if (url.includes('figma.com')) {
                const urlObj = new URL(url);
                const pathParts = urlObj.pathname.split('/').filter(Boolean);
                
                const fileKeyIndex = pathParts.findIndex(p => p === 'design' || p === 'file');
                if (fileKeyIndex === -1 || !pathParts[fileKeyIndex + 1]) {
                    return null;
                }
                
                const fileKey = pathParts[fileKeyIndex + 1];
                const nodeIdParam = urlObj.searchParams.get('node-id');
                
                if (!nodeIdParam) {
                    return null;
                }
                
                const nodeId = nodeIdParam.replace('-', ':');
                return { fileKey, nodeId };
            } else {
                const nodeId = url.replace('-', ':').trim();
                if (/^\d+:\d+$/.test(nodeId)) {
                    return { fileKey: '', nodeId };
                }
            }
            
            return null;
        } catch {
            return null;
        }
    };

    const extractComponentName = (name: string): string => {
        // Clean up the name and convert to PascalCase
        return name
            .replace(/[^a-zA-Z0-9\s]/g, '')
            .split(/\s+/)
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join('');
    };

    const handleFetchFromFigma = async () => {
        setError(null);
        
        const parsed = parseFigmaUrl(figmaUrl);
        if (!parsed) {
            setError('Invalid Figma URL. Please provide a valid Figma design link with a node ID.');
            return;
        }
        
        if (!parsed.fileKey) {
            setError('Could not extract file key from URL.');
            return;
        }

        if (!figmaPat) {
            setError('Figma Personal Access Token not configured. Please add it in Settings.');
            return;
        }
        
        setNodeInfo(parsed);
        setStep('fetching');
        
        try {
            // Fetch from Figma API via Convex action
            const result = await fetchFigmaNode({
                fileKey: parsed.fileKey,
                nodeId: parsed.nodeId,
                figmaPat: figmaPat,
            });
            
            if (!result.success) {
                setError(result.error || 'Failed to fetch from Figma');
                setStep('error');
                return;
            }
            
            setExtractedProps(result.data);
            
            // Generate component code
            const componentName = extractComponentName(result.data?.name || 'Component');
            const code = await generateCode({
                properties: result.data,
                componentName,
            });
            
            setGeneratedCode(code);
            setStep('preview');
        } catch (err) {
            console.error('Figma fetch error:', err);
            setError('Failed to fetch component from Figma. Please check your token and try again.');
            setStep('error');
        }
    };

    const handleSaveComponent = async () => {
        if (!generatedCode || !extractedProps) return;
        
        setStep('generating');
        
        try {
            const componentName = extractComponentName(extractedProps.name || 'Component');
            
            // Generate documentation
            const docs = `# ${componentName}

Auto-generated from Figma with full property extraction.

## Properties Extracted

- **Dimensions**: ${extractedProps.dimensions?.width}x${extractedProps.dimensions?.height}px
- **Layout**: ${extractedProps.layout?.mode} (${extractedProps.layout?.direction || 'none'})
- **Fills**: ${extractedProps.fills?.length || 0} (${extractedProps.fills?.map((f: any) => f.type).join(', ') || 'none'})
- **Strokes**: ${extractedProps.strokes?.length || 0}
- **Effects**: ${extractedProps.effects?.length || 0} (${extractedProps.effects?.map((e: any) => e.type).join(', ') || 'none'})
- **Corner Radius**: ${typeof extractedProps.cornerRadius === 'number' ? extractedProps.cornerRadius + 'px' : 'varies'}
${extractedProps.variants?.length > 0 ? `- **Variants**: ${extractedProps.variants.length}` : ''}

## Usage

\`\`\`tsx
import { ${componentName} } from '@org/ui';

<${componentName}>
  Content here
</${componentName}>
\`\`\`

## Source

Generated from Figma node: \`${nodeInfo?.nodeId}\`
`;
            
            const componentId = await createComponent({
                name: componentName,
                status: 'draft',
                version: '0.1.0',
                code: generatedCode,
                docs,
            });
            
            setStep('success');
            
            setTimeout(() => {
                onClose();
                if (onComponentGenerated) {
                    onComponentGenerated(componentId);
                }
            }, 1500);
        } catch (err) {
            setError('Failed to save component');
            setStep('preview');
        }
    };

    const handleReset = () => {
        setFigmaUrl('');
        setStep('input');
        setError(null);
        setNodeInfo(null);
        setExtractedProps(null);
        setGeneratedCode(null);
    };

    const isPatConfigured = figmaPatStatus?.configured;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-background rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-border">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#F24E1E] via-[#A259FF] to-[#1ABCFE] flex items-center justify-center">
                            <Figma size={20} className="text-white" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-primary">Generate from Figma</h3>
                            <p className="text-xs text-muted">
                                {isPatConfigured 
                                    ? 'Full API extraction (shadows, gradients, auto-layout)'
                                    : 'Configure Figma PAT for full extraction'
                                }
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-muted hover:text-primary p-1">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4">
                    {step === 'input' && (
                        <div className="space-y-4">
                            {/* PAT Status */}
                            {!isPatConfigured && (
                                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                                    <div className="flex gap-3">
                                        <AlertCircle size={20} className="text-amber-500 flex-shrink-0" />
                                        <div>
                                            <p className="text-sm font-medium text-amber-600">Figma Token Required</p>
                                            <p className="text-xs text-amber-600/70 mt-1">
                                                To use full Figma API extraction, please configure your Personal Access Token in Settings.
                                            </p>
                                            <button
                                                onClick={onClose}
                                                className="mt-2 text-xs text-amber-600 font-medium hover:underline flex items-center gap-1"
                                            >
                                                <Settings size={12} /> Go to Settings
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {isPatConfigured && (
                                <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center gap-2">
                                    <Check size={16} className="text-green-500" />
                                    <span className="text-sm text-green-600">Figma API connected</span>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-primary mb-2">
                                    Figma Component URL
                                </label>
                                <input
                                    type="text"
                                    value={figmaUrl}
                                    onChange={(e) => setFigmaUrl(e.target.value)}
                                    placeholder="https://www.figma.com/design/...?node-id=123:456"
                                    className="w-full px-4 py-3 bg-surface border border-border rounded-lg text-sm text-primary focus:outline-none focus:border-accent"
                                    disabled={!isPatConfigured}
                                />
                                <p className="text-xs text-muted mt-2">
                                    Select a component in Figma, then copy the URL from your browser.
                                </p>
                            </div>

                            {/* What gets extracted */}
                            <div className="p-4 bg-surface/50 rounded-lg">
                                <h4 className="text-sm font-medium text-primary mb-3">Full Extraction Includes:</h4>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="flex items-center gap-2 text-xs text-muted">
                                        <Palette size={14} className="text-accent" />
                                        <span>Colors & Gradients</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-muted">
                                        <Layers size={14} className="text-accent" />
                                        <span>Shadows & Effects</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-muted">
                                        <Box size={14} className="text-accent" />
                                        <span>Auto-layout (Flexbox)</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-muted">
                                        <Settings size={14} className="text-accent" />
                                        <span>Component Variants</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 'fetching' && (
                        <div className="flex flex-col items-center justify-center py-12">
                            <div className="relative">
                                <Loader2 size={32} className="animate-spin text-accent" />
                                <Figma size={14} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-accent" />
                            </div>
                            <p className="text-sm text-primary mt-4">Fetching from Figma API...</p>
                            <p className="text-xs text-muted mt-1">Extracting all properties</p>
                        </div>
                    )}

                    {step === 'preview' && extractedProps && (
                        <div className="space-y-4">
                            {/* Extraction Summary */}
                            <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                                <div className="flex items-center gap-2 mb-3">
                                    <Check size={16} className="text-green-500" />
                                    <span className="text-sm font-medium text-green-600">
                                        Extracted: {extractedProps.name}
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                                    <div className="bg-white/50 dark:bg-black/20 rounded p-2">
                                        <span className="text-muted">Size</span>
                                        <p className="font-mono text-primary">
                                            {Math.round(extractedProps.dimensions?.width)}×{Math.round(extractedProps.dimensions?.height)}
                                        </p>
                                    </div>
                                    <div className="bg-white/50 dark:bg-black/20 rounded p-2">
                                        <span className="text-muted">Fills</span>
                                        <p className="font-mono text-primary">{extractedProps.fills?.length || 0}</p>
                                    </div>
                                    <div className="bg-white/50 dark:bg-black/20 rounded p-2">
                                        <span className="text-muted">Effects</span>
                                        <p className="font-mono text-primary">{extractedProps.effects?.length || 0}</p>
                                    </div>
                                    <div className="bg-white/50 dark:bg-black/20 rounded p-2">
                                        <span className="text-muted">Layout</span>
                                        <p className="font-mono text-primary">{extractedProps.layout?.mode || 'None'}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Extracted Styles Preview */}
                            {(extractedProps.fills?.length > 0 || extractedProps.effects?.length > 0) && (
                                <div className="border border-border rounded-lg overflow-hidden">
                                    <div className="bg-surface/50 px-3 py-2 border-b border-border">
                                        <span className="text-xs font-medium text-primary">Extracted Styles</span>
                                    </div>
                                    <div className="p-3 space-y-2 text-xs">
                                        {extractedProps.fills?.map((fill: any, i: number) => (
                                            <div key={i} className="flex items-center gap-2">
                                                <div 
                                                    className="w-6 h-6 rounded border border-border"
                                                    style={{ 
                                                        background: fill.type === 'gradient' ? fill.gradient : fill.color 
                                                    }}
                                                />
                                                <span className="text-muted">
                                                    {fill.type === 'gradient' ? 'Gradient' : fill.color}
                                                </span>
                                            </div>
                                        ))}
                                        {extractedProps.effects?.map((effect: any, i: number) => (
                                            <div key={i} className="flex items-center gap-2">
                                                <span className="text-accent font-mono">{effect.type}:</span>
                                                <span className="text-muted truncate">{effect.css}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Generated Code */}
                            <div className="border border-border rounded-lg overflow-hidden">
                                <div className="bg-surface/50 px-3 py-2 border-b border-border flex justify-between items-center">
                                    <span className="text-xs font-medium text-primary">Generated React Component</span>
                                    <span className="text-xs text-muted">TypeScript</span>
                                </div>
                                <pre className="p-4 text-xs font-mono overflow-x-auto max-h-[250px] overflow-y-auto bg-[#1e1e1e] text-zinc-300">
                                    {generatedCode}
                                </pre>
                            </div>
                        </div>
                    )}

                    {step === 'generating' && (
                        <div className="flex flex-col items-center justify-center py-12">
                            <Sparkles size={32} className="text-accent mb-4 animate-pulse" />
                            <p className="text-sm text-primary">Saving component...</p>
                        </div>
                    )}

                    {step === 'success' && (
                        <div className="flex flex-col items-center justify-center py-12">
                            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
                                <Check size={32} className="text-green-500" />
                            </div>
                            <p className="text-lg font-medium text-primary">Component Created!</p>
                            <p className="text-sm text-muted mt-1">Opening in Builder...</p>
                        </div>
                    )}

                    {step === 'error' && (
                        <div className="flex flex-col items-center justify-center py-12">
                            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
                                <AlertCircle size={32} className="text-red-500" />
                            </div>
                            <p className="text-lg font-medium text-primary">Extraction Failed</p>
                            <p className="text-sm text-red-500 mt-1">{error}</p>
                            <button
                                onClick={handleReset}
                                className="mt-4 text-sm text-accent hover:underline"
                            >
                                Try again
                            </button>
                        </div>
                    )}

                    {/* Error (inline) */}
                    {error && step === 'input' && (
                        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2">
                            <AlertCircle size={16} className="text-red-500" />
                            <span className="text-sm text-red-600">{error}</span>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex justify-between items-center p-4 border-t border-border">
                    {step === 'preview' ? (
                        <button
                            onClick={handleReset}
                            className="text-sm text-muted hover:text-primary"
                        >
                            ← Start over
                        </button>
                    ) : (
                        <div />
                    )}
                    
                    <div className="flex gap-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-muted hover:text-primary"
                        >
                            Cancel
                        </button>
                        
                        {step === 'input' && (
                            <button
                                onClick={handleFetchFromFigma}
                                disabled={!figmaUrl.trim() || !isPatConfigured}
                                className="px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                <Sparkles size={14} />
                                Extract from Figma
                            </button>
                        )}
                        
                        {step === 'preview' && (
                            <button
                                onClick={handleSaveComponent}
                                className="px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:bg-accent/90 flex items-center gap-2"
                            >
                                <Check size={14} />
                                Save Component
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
