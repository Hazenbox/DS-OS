import React, { useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Token } from '../types';
import { Figma, Loader2, AlertCircle, Check, ExternalLink, X, Sparkles } from 'lucide-react';

interface FigmaComponentGeneratorProps {
    isOpen: boolean;
    onClose: () => void;
    tokens: Token[];
    onComponentGenerated?: (componentId: string) => void;
}

interface FigmaNodeInfo {
    fileKey: string;
    nodeId: string;
    name?: string;
}

export const FigmaComponentGenerator: React.FC<FigmaComponentGeneratorProps> = ({ 
    isOpen, 
    onClose, 
    tokens,
    onComponentGenerated 
}) => {
    const [figmaUrl, setFigmaUrl] = useState('');
    const [step, setStep] = useState<'input' | 'fetching' | 'preview' | 'generating' | 'success'>('input');
    const [error, setError] = useState<string | null>(null);
    const [nodeInfo, setNodeInfo] = useState<FigmaNodeInfo | null>(null);
    const [generatedCode, setGeneratedCode] = useState<string | null>(null);

    const createComponent = useMutation(api.components.create);

    if (!isOpen) return null;

    const parseFigmaUrl = (url: string): FigmaNodeInfo | null => {
        try {
            // Handle different Figma URL formats:
            // https://www.figma.com/design/{fileKey}/{fileName}?node-id={nodeId}
            // https://www.figma.com/file/{fileKey}/{fileName}?node-id={nodeId}
            // Or just a node ID like "2012:48557" or "2012-48557"
            
            if (url.includes('figma.com')) {
                const urlObj = new URL(url);
                const pathParts = urlObj.pathname.split('/').filter(Boolean);
                
                // /design/{fileKey}/... or /file/{fileKey}/...
                const fileKeyIndex = pathParts.findIndex(p => p === 'design' || p === 'file');
                if (fileKeyIndex === -1 || !pathParts[fileKeyIndex + 1]) {
                    return null;
                }
                
                const fileKey = pathParts[fileKeyIndex + 1];
                const nodeIdParam = urlObj.searchParams.get('node-id');
                
                if (!nodeIdParam) {
                    return null;
                }
                
                // Convert node-id from URL format (1-2) to Figma API format (1:2)
                const nodeId = nodeIdParam.replace('-', ':');
                
                return { fileKey, nodeId };
            } else {
                // Assume it's just a node ID
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

    const generateComponentFromFigma = async () => {
        setError(null);
        
        const parsed = parseFigmaUrl(figmaUrl);
        if (!parsed) {
            setError('Invalid Figma URL. Please provide a valid Figma design link with a node ID.');
            return;
        }
        
        setNodeInfo(parsed);
        setStep('fetching');
        
        try {
            // Since we can't directly call the Figma API from the browser,
            // we'll use the Figma MCP tool if available, or generate a template
            // that the user can refine with AI
            
            // For now, generate a component template based on the URL info
            const componentName = extractComponentName(figmaUrl);
            const code = generateComponentTemplate(componentName, tokens);
            
            setGeneratedCode(code);
            setStep('preview');
        } catch (err) {
            setError('Failed to fetch component from Figma. Please try again.');
            setStep('input');
        }
    };

    const extractComponentName = (url: string): string => {
        // Try to extract a meaningful name from the URL
        try {
            const urlObj = new URL(url);
            const pathParts = urlObj.pathname.split('/').filter(Boolean);
            
            // The file name is usually the last path part
            if (pathParts.length >= 3) {
                const fileName = pathParts[pathParts.length - 1];
                // Extract first word that looks like a component name
                const match = fileName.match(/([A-Z][a-z]+)/);
                if (match) return match[1];
            }
        } catch {}
        
        return 'FigmaComponent';
    };

    const generateComponentTemplate = (name: string, tokens: Token[]): string => {
        // Generate CSS variables from tokens
        const colorTokens = tokens.filter(t => t.type === 'color');
        const spacingTokens = tokens.filter(t => t.type === 'spacing');
        const radiusTokens = tokens.filter(t => t.type === 'radius');
        
        // Find primary/brand colors
        const primaryColor = colorTokens.find(t => t.name.includes('primary') || t.name.includes('brand'));
        const textColor = colorTokens.find(t => t.name.includes('text') && !t.name.includes('on'));
        
        return `import React from 'react';

interface ${name}Props {
  children?: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}

/**
 * ${name} Component
 * 
 * Generated from Figma design. Uses design tokens for consistent styling.
 * 
 * @example
 * <${name} variant="primary" size="md">
 *   Click me
 * </${name}>
 */
export const ${name}: React.FC<${name}Props> = ({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  onClick,
  className = '',
}) => {
  const baseStyles = \`
    inline-flex items-center justify-center font-medium rounded-lg
    transition-all duration-200 ease-in-out
    focus:outline-none focus:ring-2 focus:ring-offset-2
    disabled:opacity-50 disabled:cursor-not-allowed
  \`;
  
  const variants = {
    primary: \`
      bg-[${primaryColor?.value || 'var(--color-primary, #3b82f6)'}] 
      text-white 
      hover:opacity-90 
      focus:ring-blue-500
    \`,
    secondary: \`
      bg-zinc-100 dark:bg-zinc-800 
      text-zinc-900 dark:text-zinc-100 
      hover:bg-zinc-200 dark:hover:bg-zinc-700
      focus:ring-zinc-500
    \`,
    outline: \`
      border-2 border-current 
      text-[${primaryColor?.value || 'var(--color-primary, #3b82f6)'}]
      hover:bg-blue-50 dark:hover:bg-blue-900/20
      focus:ring-blue-500
    \`,
    ghost: \`
      text-zinc-700 dark:text-zinc-300
      hover:bg-zinc-100 dark:hover:bg-zinc-800
      focus:ring-zinc-500
    \`,
  };
  
  const sizes = {
    sm: 'px-3 py-1.5 text-sm gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-6 py-3 text-base gap-2.5',
  };
  
  return (
    <button
      className={\`\${baseStyles} \${variants[variant]} \${sizes[size]} \${className}\`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
};

export default ${name};
`;
    };

    const handleSaveComponent = async () => {
        if (!generatedCode || !nodeInfo) return;
        
        setStep('generating');
        
        try {
            const componentName = extractComponentName(figmaUrl);
            
            const componentId = await createComponent({
                name: componentName,
                status: 'draft',
                version: '0.1.0',
                code: generatedCode,
                docs: `# ${componentName}\n\nGenerated from Figma design.\n\n**Source:** ${figmaUrl}\n\n## Usage\n\n\`\`\`tsx\nimport { ${componentName} } from '@org/ui';\n\n<${componentName} variant="primary">\n  Button text\n</${componentName}>\n\`\`\``,
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
        setGeneratedCode(null);
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-background rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-border">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#F24E1E] via-[#A259FF] to-[#1ABCFE] flex items-center justify-center">
                            <Figma size={20} className="text-white" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-primary">Generate from Figma</h3>
                            <p className="text-xs text-muted">Create components from Figma designs</p>
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
                                />
                                <p className="text-xs text-muted mt-2">
                                    Paste a Figma link with a component selected. The URL should contain a <code className="bg-surface px-1 rounded">node-id</code> parameter.
                                </p>
                            </div>

                            <div className="p-4 bg-surface/50 rounded-lg space-y-3">
                                <h4 className="text-sm font-medium text-primary">How it works:</h4>
                                <ol className="text-xs text-muted space-y-2 list-decimal list-inside">
                                    <li>Select a component or component set in Figma</li>
                                    <li>Copy the URL from your browser (with the component selected)</li>
                                    <li>Paste the URL above and click "Generate Component"</li>
                                    <li>Review the generated code and save to your library</li>
                                    <li>Use AI prompts in the Builder to refine the component</li>
                                </ol>
                            </div>

                            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex gap-2">
                                <AlertCircle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
                                <p className="text-xs text-amber-600">
                                    <strong>Note:</strong> This generates a template based on your design tokens. 
                                    For full Figma extraction, use the Figma MCP integration with <code className="bg-amber-500/20 px-1 rounded">@mcp figma</code> in the AI prompt.
                                </p>
                            </div>
                        </div>
                    )}

                    {step === 'fetching' && (
                        <div className="flex flex-col items-center justify-center py-12">
                            <Loader2 size={32} className="animate-spin text-accent mb-4" />
                            <p className="text-sm text-primary">Fetching component from Figma...</p>
                            <p className="text-xs text-muted mt-1">Node ID: {nodeInfo?.nodeId}</p>
                        </div>
                    )}

                    {step === 'preview' && generatedCode && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                                <Check size={16} className="text-green-500" />
                                <span className="text-sm text-green-600">Component template generated!</span>
                            </div>

                            <div className="border border-border rounded-lg overflow-hidden">
                                <div className="bg-surface/50 px-3 py-2 border-b border-border flex justify-between items-center">
                                    <span className="text-xs font-medium text-primary">Generated Code</span>
                                    <span className="text-xs text-muted">TypeScript React</span>
                                </div>
                                <pre className="p-4 text-xs text-primary font-mono overflow-x-auto max-h-[300px] overflow-y-auto bg-[#1e1e1e] text-zinc-300">
                                    {generatedCode}
                                </pre>
                            </div>

                            <p className="text-xs text-muted">
                                This is a starting template using your design tokens. After saving, use the AI Builder to refine the component based on your Figma design.
                            </p>
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

                    {/* Error */}
                    {error && (
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
                                onClick={generateComponentFromFigma}
                                disabled={!figmaUrl.trim()}
                                className="px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-50 flex items-center gap-2"
                            >
                                <Sparkles size={14} />
                                Generate Component
                            </button>
                        )}
                        
                        {step === 'preview' && (
                            <button
                                onClick={handleSaveComponent}
                                className="px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:bg-accent/90 flex items-center gap-2"
                            >
                                <Check size={14} />
                                Save to Builder
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

