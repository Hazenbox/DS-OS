import React, { useState, useCallback } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { Token, ConvexComponent } from '../types';
import { generateComponentCode, generateDocumentation } from '../services/geminiService';
import { Send, Zap, Code, FileText, Loader2, Trash2, Play, Eye, EyeOff, Copy, Check, Figma } from 'lucide-react';
import { FigmaComponentGenerator } from './FigmaComponentGenerator';
import Editor from '@monaco-editor/react';
import { 
  SandpackProvider, 
  SandpackPreview,
  useSandpack
} from '@codesandbox/sandpack-react';

interface BuilderProps {
    tokens: Token[];
}

// Custom preview component that handles errors gracefully
const PreviewPane: React.FC<{ code: string; tokens: Token[] }> = ({ code, tokens }) => {
    // Generate CSS variables from tokens
    const cssVariables = tokens.map(t => `  --${t.name}: ${t.value};`).join('\n');
    
    const files = {
        '/App.tsx': code,
        '/styles.css': `:root {\n${cssVariables}\n}\n\n* {\n  box-sizing: border-box;\n  margin: 0;\n  padding: 0;\n}\n\nbody {\n  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;\n  padding: 20px;\n}`,
        '/index.tsx': `import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

// Try to import the component
let Component;
try {
  const mod = require('./App.tsx');
  Component = mod.default || mod[Object.keys(mod)[0]] || (() => <div>No component exported</div>);
} catch (e) {
  Component = () => <div style={{ color: 'red', padding: 20 }}>Error loading component</div>;
}

const root = createRoot(document.getElementById('root')!);
root.render(<Component />);
`,
    };

    return (
        <SandpackProvider
            template="react-ts"
            files={files}
            theme="dark"
            options={{
                externalResources: ['https://cdn.tailwindcss.com'],
                classes: {
                    'sp-wrapper': 'h-full',
                    'sp-preview': 'h-full',
                    'sp-preview-container': 'h-full',
                },
            }}
            customSetup={{
                dependencies: {
                    'lucide-react': 'latest',
                },
            }}
        >
            <SandpackPreview 
                showNavigator={false}
                showRefreshButton={true}
                style={{ height: '100%' }}
            />
        </SandpackProvider>
    );
};

export const ComponentBuilder: React.FC<BuilderProps> = ({ tokens }) => {
    const [selectedComponentId, setSelectedComponentId] = useState<Id<"components"> | null>(null);
    const [prompt, setPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [activeTab, setActiveTab] = useState<'preview' | 'code' | 'docs'>('code');
    const [showPreview, setShowPreview] = useState(true);
    const [copied, setCopied] = useState(false);
    const [localCode, setLocalCode] = useState<string | null>(null);
    const [showFigmaGenerator, setShowFigmaGenerator] = useState(false);

    // Convex queries
    const components = useQuery(api.components.list, {});

    // Convex mutations
    const createComponent = useMutation(api.components.create);
    const updateComponent = useMutation(api.components.update);
    const removeComponent = useMutation(api.components.remove);

    const selectedComponent = components?.find(c => c._id === selectedComponentId) || null;
    
    // Use local code if editing, otherwise use component code
    const displayCode = localCode ?? selectedComponent?.code ?? '';

    const handleCreateNew = async () => {
        try {
            const newId = await createComponent({
                name: 'New Component',
                status: 'draft',
                version: '0.0.1',
                code: `import React from 'react';

interface Props {
  children?: React.ReactNode;
}

export const NewComponent: React.FC<Props> = ({ children }) => {
  return (
    <div className="p-4 bg-blue-500 text-white rounded-lg">
      {children || 'Hello from your new component!'}
    </div>
  );
};

export default NewComponent;`,
                docs: 'Documentation pending...'
            });
            setSelectedComponentId(newId);
            setLocalCode(null);
        } catch (error) {
            console.error('Failed to create component:', error);
        }
    };

    const handleDelete = async (id: Id<"components">) => {
        try {
            await removeComponent({ id });
            if (selectedComponentId === id) {
                setSelectedComponentId(null);
                setLocalCode(null);
            }
        } catch (error) {
            console.error('Failed to delete component:', error);
        }
    };

    const handleCodeChange = useCallback((value: string | undefined) => {
        if (value !== undefined) {
            setLocalCode(value);
        }
    }, []);

    const handleSaveCode = async () => {
        if (!selectedComponent || !localCode) return;
        
        try {
            await updateComponent({
                id: selectedComponent._id,
                code: localCode,
            });
            setLocalCode(null);
        } catch (error) {
            console.error('Failed to save code:', error);
        }
    };

    const handleGenerate = async () => {
        if (!selectedComponent) return;
        
        setIsGenerating(true);
        try {
            const currentCode = localCode ?? selectedComponent.code;
            const code = await generateComponentCode(prompt, tokens, currentCode);
            const docs = await generateDocumentation(code);
            
            // Extract component name from prompt
            const newName = prompt.split(' ').find(word => 
                word.length > 2 && word[0] === word[0].toUpperCase()
            ) || selectedComponent.name;
            
            await updateComponent({
                id: selectedComponent._id,
                code,
                docs,
                name: newName
            });
            
            setLocalCode(null);
            setPrompt('');
        } catch (e) {
            alert('Generation failed. Please check API Key.');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleStatusChange = async (id: Id<"components">, status: ConvexComponent['status']) => {
        try {
            await updateComponent({ id, status });
        } catch (error) {
            console.error('Failed to update status:', error);
        }
    };

    const handleCopyCode = async () => {
        await navigator.clipboard.writeText(displayCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleSelectComponent = (id: Id<"components">) => {
        setSelectedComponentId(id);
        setLocalCode(null);
    };

    const hasUnsavedChanges = localCode !== null && localCode !== selectedComponent?.code;

    return (
        <div className="flex h-full overflow-hidden">
            {/* Left Panel: List & Controls */}
            <div className="w-72 border-r border-zinc-200 dark:border-zinc-800 flex flex-col bg-zinc-50 dark:bg-zinc-900/50">
                <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-white dark:bg-zinc-900">
                    <div>
                        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Builder</h2>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">AI-powered generation</p>
                    </div>
                    <div className="flex gap-2">
                        <button 
                            onClick={() => setShowFigmaGenerator(true)}
                            className="text-xs bg-gradient-to-r from-[#F24E1E] via-[#A259FF] to-[#1ABCFE] text-white px-2.5 py-1.5 rounded font-medium hover:opacity-90 flex items-center gap-1.5"
                        >
                            <Figma size={12} /> Figma
                        </button>
                        <button 
                            onClick={handleCreateNew} 
                            className="text-xs bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-2.5 py-1.5 rounded font-medium hover:opacity-90"
                        >
                            + New
                        </button>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {components?.map(c => (
                        <div 
                            key={c._id} 
                            onClick={() => handleSelectComponent(c._id)}
                            className={`p-3 border-b border-zinc-200 dark:border-zinc-800 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 group ${selectedComponentId === c._id ? 'bg-zinc-100 dark:bg-zinc-800 border-l-2 border-l-violet-500' : ''}`}
                        >
                            <div className="flex justify-between items-start">
                                <div className="font-medium text-sm text-zinc-900 dark:text-white">{c.name}</div>
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDelete(c._id);
                                    }}
                                    className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-red-500 p-1"
                                >
                                    <Trash2 size={12} />
                                </button>
                            </div>
                            <div className="flex justify-between mt-1.5">
                                <select
                                    value={c.status}
                                    onChange={(e) => {
                                        e.stopPropagation();
                                        handleStatusChange(c._id, e.target.value as ConvexComponent['status']);
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    className={`text-[10px] uppercase px-1.5 py-0.5 rounded bg-transparent border-none cursor-pointer ${
                                        c.status === 'stable' ? 'text-green-600 dark:text-green-400' : 
                                        c.status === 'review' ? 'text-yellow-600 dark:text-yellow-400' : 
                                        c.status === 'deprecated' ? 'text-red-600 dark:text-red-400' : 'text-zinc-500 dark:text-zinc-400'
                                    }`}
                                >
                                    <option value="draft">Draft</option>
                                    <option value="review">Review</option>
                                    <option value="stable">Stable</option>
                                    <option value="deprecated">Deprecated</option>
                                </select>
                                <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono">v{c.version}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Main Content Area */}
            {selectedComponent ? (
                <div className="flex-1 flex flex-col bg-white dark:bg-zinc-900 overflow-hidden">
                    {/* Header Tabs */}
                    <div className="h-12 border-b border-zinc-200 dark:border-zinc-800 flex items-center px-3 justify-between bg-zinc-50 dark:bg-zinc-900/50">
                        <div className="flex gap-1 h-full items-center">
                            <button 
                                onClick={() => setActiveTab('code')}
                                className={`text-xs flex items-center gap-1.5 px-3 py-1.5 rounded transition-colors ${activeTab === 'code' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'}`}
                            >
                                <Code size={14} /> Code
                            </button>
                            <button 
                                onClick={() => setActiveTab('docs')}
                                className={`text-xs flex items-center gap-1.5 px-3 py-1.5 rounded transition-colors ${activeTab === 'docs' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'}`}
                            >
                                <FileText size={14} /> Docs
                            </button>
                        </div>
                        <div className="flex items-center gap-2">
                            {hasUnsavedChanges && (
                                <button
                                    onClick={handleSaveCode}
                                    className="text-xs px-2.5 py-1 bg-violet-600 text-white rounded font-medium hover:bg-violet-700"
                                >
                                    Save Changes
                                </button>
                            )}
                            <button
                                onClick={handleCopyCode}
                                className="p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                title="Copy code"
                            >
                                {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                            </button>
                            <button
                                onClick={() => setShowPreview(!showPreview)}
                                className={`p-1.5 rounded transition-colors ${showPreview ? 'bg-violet-600 text-white' : 'text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
                                title={showPreview ? 'Hide preview' : 'Show preview'}
                            >
                                {showPreview ? <Eye size={14} /> : <EyeOff size={14} />}
                            </button>
                            <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                                <div className={`w-1.5 h-1.5 rounded-full ${hasUnsavedChanges ? 'bg-yellow-500' : 'bg-green-500'}`}></div>
                                {hasUnsavedChanges ? 'Unsaved' : 'Synced'}
                            </div>
                        </div>
                    </div>

                    {/* Main Content */}
                    <div className="flex-1 overflow-hidden flex">
                        {/* Code/Docs Panel */}
                        <div className={`flex flex-col ${showPreview ? 'w-1/2 border-r border-zinc-200 dark:border-zinc-800' : 'w-full'}`}>
                            {activeTab === 'code' && (
                                <div className="flex-1 overflow-hidden">
                                    <Editor
                                        height="100%"
                                        defaultLanguage="typescript"
                                        value={displayCode}
                                        onChange={handleCodeChange}
                                        theme="vs-dark"
                                        options={{
                                            minimap: { enabled: false },
                                            fontSize: 13,
                                            lineHeight: 20,
                                            padding: { top: 16, bottom: 16 },
                                            scrollBeyondLastLine: false,
                                            wordWrap: 'on',
                                            tabSize: 2,
                                            automaticLayout: true,
                                            fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
                                            fontLigatures: true,
                                        }}
                                    />
                                </div>
                            )}
                            {activeTab === 'docs' && (
                                <div className="flex-1 overflow-y-auto p-6 bg-white dark:bg-zinc-900">
                                    <div className="prose prose-sm max-w-none dark:prose-invert">
                                        <pre className="whitespace-pre-wrap font-sans text-zinc-900 dark:text-white text-sm leading-relaxed">
                                            {selectedComponent.docs}
                                        </pre>
                                    </div>
                                </div>
                            )}

                            {/* Prompt Input */}
                            <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                                <div className="flex gap-2 items-end">
                                    <textarea
                                        className="flex-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-white py-2.5 px-3 resize-none placeholder:text-zinc-400 focus:outline-none focus:border-violet-500 min-h-[44px] max-h-24"
                                        placeholder="Describe changes (e.g., 'Add hover effect with scale animation')..."
                                        value={prompt}
                                        onChange={(e) => setPrompt(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleGenerate();
                                            }
                                        }}
                                        rows={1}
                                    />
                                    <button 
                                        onClick={handleGenerate}
                                        disabled={isGenerating || !prompt.trim()}
                                        className="h-[44px] w-[44px] flex items-center justify-center bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Preview Panel */}
                        {showPreview && (
                            <div className="w-1/2 flex flex-col bg-[#1e1e1e]">
                                <div className="h-8 border-b border-zinc-700 flex items-center px-3 gap-2">
                                    <Play size={12} className="text-green-500" />
                                    <span className="text-xs text-zinc-400">Live Preview</span>
                                </div>
                                <div className="flex-1 overflow-hidden">
                                    <PreviewPane code={displayCode} tokens={tokens} />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="flex-1 flex items-center justify-center text-zinc-500 dark:text-zinc-400 flex-col gap-4 bg-zinc-50 dark:bg-zinc-900/50">
                    <div className="w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center">
                        <Zap size={24} />
                    </div>
                    <p className="text-sm">Select a component or create new to start building</p>
                    <div className="flex gap-3">
                        <button
                            onClick={() => setShowFigmaGenerator(true)}
                            className="px-4 py-2 bg-gradient-to-r from-[#F24E1E] via-[#A259FF] to-[#1ABCFE] text-white rounded-lg text-sm font-medium hover:opacity-90 flex items-center gap-2"
                        >
                            <Figma size={14} />
                            From Figma
                        </button>
                        <button
                            onClick={handleCreateNew}
                            className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700"
                        >
                            Create Blank
                        </button>
                    </div>
                </div>
            )}

            {/* Figma Component Generator Modal */}
            <FigmaComponentGenerator
                isOpen={showFigmaGenerator}
                onClose={() => setShowFigmaGenerator(false)}
                tokens={tokens}
                onComponentGenerated={(id) => {
                    setSelectedComponentId(id as Id<"components">);
                }}
            />
        </div>
    );
};
