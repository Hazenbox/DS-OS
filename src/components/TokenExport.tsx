import React, { useState } from 'react';
import { Token } from '../types';
import { Download, Copy, Check, FileCode, Palette, Settings2, X } from 'lucide-react';

interface TokenExportProps {
    tokens: Token[];
    isOpen: boolean;
    onClose: () => void;
}

type ExportFormat = 'css' | 'scss' | 'tailwind' | 'json' | 'style-dictionary';

export const TokenExport: React.FC<TokenExportProps> = ({ tokens, isOpen, onClose }) => {
    const [activeFormat, setActiveFormat] = useState<ExportFormat>('css');
    const [copied, setCopied] = useState(false);
    const [prefix, setPrefix] = useState('ds');

    if (!isOpen) return null;

    const generateCSS = (): string => {
        const groups: Record<string, Token[]> = {};
        tokens.forEach(t => {
            if (!groups[t.type]) groups[t.type] = [];
            groups[t.type].push(t);
        });

        let css = '/* DS-OS Design Tokens - CSS Variables */\n';
        css += '/* Generated at ' + new Date().toISOString() + ' */\n\n';
        css += ':root {\n';
        
        Object.entries(groups).forEach(([type, typeTokens]) => {
            css += `  /* ${type.charAt(0).toUpperCase() + type.slice(1)} */\n`;
            typeTokens.forEach(t => {
                css += `  --${prefix}-${t.name}: ${t.value};\n`;
            });
            css += '\n';
        });
        
        css += '}\n\n';
        css += '/* Dark mode (add .dark class to html/body) */\n';
        css += '.dark {\n';
        css += '  /* Override tokens for dark mode here */\n';
        css += '}\n';

        return css;
    };

    const generateSCSS = (): string => {
        const groups: Record<string, Token[]> = {};
        tokens.forEach(t => {
            if (!groups[t.type]) groups[t.type] = [];
            groups[t.type].push(t);
        });

        let scss = '// DS-OS Design Tokens - SCSS Variables\n';
        scss += '// Generated at ' + new Date().toISOString() + '\n\n';
        
        Object.entries(groups).forEach(([type, typeTokens]) => {
            scss += `// ${type.charAt(0).toUpperCase() + type.slice(1)}\n`;
            typeTokens.forEach(t => {
                scss += `$${prefix}-${t.name}: ${t.value};\n`;
            });
            scss += '\n';
        });

        scss += '// Token Map (for programmatic access)\n';
        scss += `$${prefix}-tokens: (\n`;
        tokens.forEach((t, i) => {
            scss += `  '${t.name}': ${t.value}${i < tokens.length - 1 ? ',' : ''}\n`;
        });
        scss += ');\n\n';

        scss += '// Mixin for applying tokens\n';
        scss += `@mixin ${prefix}-token($property, $token-name) {\n`;
        scss += `  #{$property}: map-get($${prefix}-tokens, $token-name);\n`;
        scss += '}\n';

        return scss;
    };

    const generateTailwind = (): string => {
        const colors: Record<string, string> = {};
        const spacing: Record<string, string> = {};
        const fontSize: Record<string, string> = {};
        const borderRadius: Record<string, string> = {};
        const boxShadow: Record<string, string> = {};

        tokens.forEach(t => {
            const name = t.name.replace(/-/g, '.');
            switch (t.type) {
                case 'color':
                    colors[name] = t.value;
                    break;
                case 'spacing':
                case 'sizing':
                    spacing[name] = t.value;
                    break;
                case 'typography':
                    fontSize[name] = t.value;
                    break;
                case 'radius':
                    borderRadius[name] = t.value;
                    break;
                case 'shadow':
                    boxShadow[name] = t.value;
                    break;
            }
        });

        const config = {
            theme: {
                extend: {
                    colors: Object.keys(colors).length > 0 ? colors : undefined,
                    spacing: Object.keys(spacing).length > 0 ? spacing : undefined,
                    fontSize: Object.keys(fontSize).length > 0 ? fontSize : undefined,
                    borderRadius: Object.keys(borderRadius).length > 0 ? borderRadius : undefined,
                    boxShadow: Object.keys(boxShadow).length > 0 ? boxShadow : undefined,
                },
            },
        };

        // Clean up undefined entries
        Object.keys(config.theme.extend).forEach(key => {
            if (config.theme.extend[key as keyof typeof config.theme.extend] === undefined) {
                delete config.theme.extend[key as keyof typeof config.theme.extend];
            }
        });

        let output = '// DS-OS Design Tokens - Tailwind Config\n';
        output += '// Generated at ' + new Date().toISOString() + '\n';
        output += '// Add this to your tailwind.config.js\n\n';
        output += '/** @type {import("tailwindcss").Config} */\n';
        output += 'module.exports = ' + JSON.stringify(config, null, 2).replace(/"([^"]+)":/g, '$1:') + ';\n';

        return output;
    };

    const generateJSON = (): string => {
        const output: Record<string, Record<string, { value: string; type: string }>> = {};
        
        tokens.forEach(t => {
            if (!output[t.type]) output[t.type] = {};
            output[t.type][t.name] = {
                value: t.value,
                type: t.type,
            };
        });

        return JSON.stringify(output, null, 2);
    };

    const generateStyleDictionary = (): string => {
        const output: Record<string, Record<string, { value: string }>> = {};
        
        tokens.forEach(t => {
            if (!output[t.type]) output[t.type] = {};
            output[t.type][t.name] = {
                value: t.value,
            };
        });

        let result = '// DS-OS Design Tokens - Style Dictionary Format\n';
        result += '// Generated at ' + new Date().toISOString() + '\n';
        result += '// Save as tokens.json and use with Style Dictionary\n\n';
        result += JSON.stringify(output, null, 2);

        return result;
    };

    const getOutput = (): string => {
        switch (activeFormat) {
            case 'css': return generateCSS();
            case 'scss': return generateSCSS();
            case 'tailwind': return generateTailwind();
            case 'json': return generateJSON();
            case 'style-dictionary': return generateStyleDictionary();
            default: return '';
        }
    };

    const handleCopy = async () => {
        await navigator.clipboard.writeText(getOutput());
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleDownload = () => {
        const output = getOutput();
        const extensions: Record<ExportFormat, string> = {
            css: 'css',
            scss: 'scss',
            tailwind: 'js',
            json: 'json',
            'style-dictionary': 'json',
        };
        
        const filename = `design-tokens.${extensions[activeFormat]}`;
        const blob = new Blob([output], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    };

    const formats: { id: ExportFormat; label: string; icon: React.ReactNode }[] = [
        { id: 'css', label: 'CSS Variables', icon: <Palette size={14} /> },
        { id: 'scss', label: 'SCSS', icon: <FileCode size={14} /> },
        { id: 'tailwind', label: 'Tailwind', icon: <Settings2 size={14} /> },
        { id: 'json', label: 'JSON', icon: <FileCode size={14} /> },
        { id: 'style-dictionary', label: 'Style Dictionary', icon: <FileCode size={14} /> },
    ];

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-zinc-200 dark:border-zinc-800">
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-zinc-200 dark:border-zinc-800">
                    <div>
                        <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">Export Tokens</h3>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">{tokens.length} tokens ready to export</p>
                    </div>
                    <button onClick={onClose} className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white p-1">
                        <X size={20} />
                    </button>
                </div>

                {/* Format Tabs */}
                <div className="flex gap-1 p-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
                    {formats.map(f => (
                        <button
                            key={f.id}
                            onClick={() => setActiveFormat(f.id)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                                activeFormat === f.id 
                                    ? 'bg-violet-600 text-white' 
                                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-700'
                            }`}
                        >
                            {f.icon}
                            {f.label}
                        </button>
                    ))}
                </div>

                {/* Options */}
                {(activeFormat === 'css' || activeFormat === 'scss') && (
                    <div className="px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 flex items-center gap-3">
                        <label className="text-xs text-zinc-500 dark:text-zinc-400">Variable prefix:</label>
                        <input
                            type="text"
                            value={prefix}
                            onChange={(e) => setPrefix(e.target.value)}
                            className="px-2 py-1 text-xs border border-zinc-200 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white w-24"
                        />
                    </div>
                )}

                {/* Output */}
                <div className="flex-1 overflow-hidden p-4">
                    <pre className="h-full overflow-auto bg-zinc-900 rounded-lg p-4 text-sm text-zinc-300 font-mono">
                        {getOutput()}
                    </pre>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-2 p-4 border-t border-zinc-200 dark:border-zinc-800">
                    <button
                        onClick={handleCopy}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700"
                    >
                        {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                        {copied ? 'Copied!' : 'Copy'}
                    </button>
                    <button
                        onClick={handleDownload}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700"
                    >
                        <Download size={16} />
                        Download
                    </button>
                </div>
            </div>
        </div>
    );
};

